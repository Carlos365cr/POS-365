using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;

public static class CatalogApi
{
    static SqlCommand Cmd(SqlConnection db, SqlTransaction? tx, string sql, params (string,object?)[] values)
    {
        var cmd=new SqlCommand(sql,db,tx) { CommandTimeout=60 };
        foreach(var (key,value) in values) cmd.Parameters.AddWithValue(key,value??DBNull.Value);
        return cmd;
    }
    static async Task<IResult> Guard(Func<Task<IResult>> action)
    {
        try { return await action(); }
        catch(CatalogConflict e) { return Results.Conflict(new {error=e.Message}); }
        catch(ArgumentException e) { return Results.BadRequest(new {error=e.Message}); }
        catch(JsonException) { return Results.BadRequest(new {error="JSON invalido."}); }
        catch(InvalidOperationException) { return Results.BadRequest(new {error="Estructura de datos no reconocida."}); }
        catch(SqlException e) when(e.Number is 2601 or 2627 or 1205)
        { return Results.Conflict(new {error="Codigo ya registrado o conflicto simultaneo. Recargue antes de reintentar. No se guardo esta transaccion."}); }
        catch(SqlException e) { return Results.Json(new {error="No se completo la operacion SQL. Verifique conexion y ejecute -Inicializar.",sqlError=e.Number},statusCode:503); }
    }
    public sealed record PropertyVersion(Guid Id,string Version);
    public sealed record PropertyBatch(string Field,string? Value,PropertyVersion[] Items);
    public sealed record NativeArticle(CatalogProduct Product, JsonElement General, JsonElement Costs,
        JsonElement Prices, JsonElement Other, decimal? TaxRate);

    public static void Map(WebApplication app,string connectionString)
    {
        app.MapGet("/api/catalog/properties", (int? page)=>Guard(async()=>{
            int n=page??1;if(n<1||n>100000)throw new ArgumentException("Página inválida.");
            await using var db=new SqlConnection(connectionString);await db.OpenAsync();
            await using var cmd=Cmd(db,null,"""
                SELECT p.ProductId,p.Code,p.Barcode,p.Name,p.Cabys,p.IncludesVAT,p.Version,
                    e.GeneralJson,e.CostsJson,e.PricesJson,
                    JSON_VALUE(e.OtherJson,'$.photoSuspended'),
                    CASE WHEN JSON_QUERY(e.OtherJson,'$.photo') IS NOT NULL OR JSON_VALUE(e.OtherJson,'$.photo') IS NOT NULL THEN 1 ELSE 0 END,
                    r.Amount,r.Currency,t.TaxRate
                FROM dbo.POS365_Product p
                LEFT JOIN dbo.POS365_ProductExtended e ON e.ProductId=p.ProductId
                LEFT JOIN dbo.POS365_ProductPrice r ON r.ProductId=p.ProductId AND r.ListNumber=0
                LEFT JOIN dbo.POS365_ProductTax t ON t.ProductId=p.ProductId
                ORDER BY p.Code,p.ProductId OFFSET @offset ROWS FETCH NEXT 101 ROWS ONLY
                """,("@offset",(n-1)*100));
            await using var rd=await cmd.ExecuteReaderAsync();var items=new List<object>();
            while(await rd.ReadAsync()){
                JsonElement Fields(int i)=>JsonSerializer.Deserialize<JsonElement>(rd.IsDBNull(i)?"[]":rd.GetString(i));
                items.Add(new {id=rd.GetGuid(0),code=rd.GetString(1),barcode=rd.GetString(2),name=rd.GetString(3),cabys=rd.GetString(4),includesVAT=rd.GetBoolean(5),
                    version=Convert.ToBase64String((byte[])rd[6]),general=Fields(7),costs=Fields(8),prices=Fields(9),
                    photoSuspended=!rd.IsDBNull(10)&&rd.GetString(10)=="true",hasPhoto=rd.GetInt32(11)==1,
                    price=rd.IsDBNull(12)?(decimal?)null:rd.GetDecimal(12),currency=rd.IsDBNull(13)?"":rd.GetString(13),tax=rd.IsDBNull(14)?(decimal?)null:rd.GetDecimal(14)});
            }
            return Results.Ok(new {items=items.Take(100),hasMore=items.Count>100});
        })).RequireAuthorization(p=>p.RequireRole("Admin"));
        app.MapPost("/api/catalog/properties/batch",(PropertyBatch input)=>Guard(async()=>{
            if(input.Items is null || input.Items.Length is <1 or >5000 || input.Items.Select(x=>x.Id).Distinct().Count()!=input.Items.Length)
                throw new ArgumentException("Seleccione entre 1 y 5000 artículos distintos.");
            bool category=input.Field is "categoria1" or "categoria2" or "categoria3" or "categoria4";
            if(!category && input.Field is not ("deletePhoto" or "suspendPhoto" or "reactivatePhoto"))throw new ArgumentException("Operación inválida.");
            if(category && (string.IsNullOrWhiteSpace(input.Value)||input.Value.Length>250))throw new ArgumentException("Clasificación inválida.");
            await using var db=new SqlConnection(connectionString);await db.OpenAsync();
            await using var tx=(SqlTransaction)await db.BeginTransactionAsync();
            foreach(var item in input.Items.OrderBy(x=>x.Id)){
                var version=Convert.FromBase64String(item.Version);
                await using(var lockCmd=Cmd(db,tx,"UPDATE dbo.POS365_Product SET UpdatedAt=SYSUTCDATETIME() WHERE ProductId=@id AND Version=@v",("@id",item.Id),("@v",version)))
                    if(await lockCmd.ExecuteNonQueryAsync()!=1)throw new CatalogConflict("Un artículo cambió. Recargue; no se aplicó el lote.");
                await using(var init=Cmd(db,tx,"IF NOT EXISTS(SELECT 1 FROM dbo.POS365_ProductExtended WHERE ProductId=@id) INSERT dbo.POS365_ProductExtended(ProductId,GeneralJson,CostsJson,PricesJson,OtherJson) VALUES(@id,N'[]',N'[]',N'[]',N'{}')",("@id",item.Id)))await init.ExecuteNonQueryAsync();
                if(category){
                    string raw;
                    await using(var read=Cmd(db,tx,"SELECT GeneralJson FROM dbo.POS365_ProductExtended WHERE ProductId=@id",("@id",item.Id)))raw=(string)(await read.ExecuteScalarAsync())!;
                    var array=System.Text.Json.Nodes.JsonNode.Parse(raw)!.AsArray();
                    var index=-1;for(int i=0;i<array.Count;i++)if(array[i] is System.Text.Json.Nodes.JsonArray a && a.Count>=3 && a[0]?.GetValue<string>()==input.Field){index=i;break;}
                    if(index<0){index=array.Count;array.Add(new System.Text.Json.Nodes.JsonArray(System.Text.Json.Nodes.JsonValue.Create(input.Field),System.Text.Json.Nodes.JsonValue.Create(input.Value),null));}
                    else array[index]!.AsArray()[1]=System.Text.Json.Nodes.JsonValue.Create(input.Value);
                    await using var update=Cmd(db,tx,"""
                        UPDATE dbo.POS365_ProductExtended SET GeneralJson=@json,UpdatedAt=SYSUTCDATETIME() WHERE ProductId=@id;
                        UPDATE dbo.POS365_ProductField SET FieldValue=@value,FieldName=@field,IsChecked=NULL WHERE ProductId=@id AND Section=N'General' AND FieldIndex=@index;
                        IF @@ROWCOUNT=0 INSERT dbo.POS365_ProductField(ProductId,Section,FieldIndex,FieldName,FieldValue,IsChecked) VALUES(@id,N'General',@index,@field,@value,NULL);
                        """,("@json",array.ToJsonString()),("@id",item.Id),("@value",input.Value),("@field",input.Field),("@index",index));
                    await update.ExecuteNonQueryAsync();
                }else{
                    var expression=input.Field=="deletePhoto"?"JSON_MODIFY(JSON_MODIFY(OtherJson,'$.photo',NULL),'$.photoSuspended',NULL)":"JSON_MODIFY(OtherJson,'$.photoSuspended',CAST(@s AS bit))";
                    await using var update=Cmd(db,tx,"UPDATE dbo.POS365_ProductExtended SET OtherJson="+expression+",UpdatedAt=SYSUTCDATETIME() WHERE ProductId=@id",("@s",input.Field=="suspendPhoto"),("@id",item.Id));
                    await update.ExecuteNonQueryAsync();
                }
            }
            await tx.CommitAsync();return Results.Ok(new {updated=input.Items.Length});
        })).RequireAuthorization(p=>p.RequireRole("Admin"));

        app.MapGet("/api/catalog/native/{id:guid}",(Guid id)=>Guard(async()=>
        {
            await using var db=new SqlConnection(connectionString);
            await db.OpenAsync();
            await using var tx=(SqlTransaction)await db.BeginTransactionAsync(IsolationLevel.ReadCommitted);
            var product=await Read(db,tx,id);
            if(product is null)return Results.NotFound(new {error="Artículo SQL no encontrado."});
            await using var cmd=Cmd(db,tx,"""
                SELECT GeneralJson,CostsJson,PricesJson,OtherJson FROM dbo.POS365_ProductExtended WHERE ProductId=@id
                """,("@id",id));
            JsonElement? general=null,costs=null,prices=null,other=null;
            await using(var r=await cmd.ExecuteReaderAsync())
            {
                if(await r.ReadAsync())
                {
                    general=JsonSerializer.Deserialize<JsonElement>(r.GetString(0));
                    costs=JsonSerializer.Deserialize<JsonElement>(r.GetString(1));
                    prices=JsonSerializer.Deserialize<JsonElement>(r.GetString(2));
                    other=JsonSerializer.Deserialize<JsonElement>(r.GetString(3));
                }
            }
            await tx.CommitAsync();
            return Results.Ok(new {product, general, costs, prices, other});
        }));
        app.MapPut("/api/catalog/native/{id:guid}",(Guid id,NativeArticle article)=>Guard(async()=>
        {
            if(article.Product is null || article.Product.Id!=id)
                throw new ArgumentException("Identificador de artículo incorrecto.");
            var p=CatalogValidation.Normalize(article.Product);
            static string CheckedJson(JsonElement value,string field)
            {
                if(value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
                    throw new ArgumentException("Falta información de "+field);
                var json=value.GetRawText();
                if(json.Length>(field=="Metadatos"?6000000:1000000))throw new ArgumentException(field+" supera el tamaño permitido.");
                return json;
            }
            var general=CheckedJson(article.General,"General");
            var costs=CheckedJson(article.Costs,"Costos");
            var prices=CheckedJson(article.Prices,"Precios");
            var other=CheckedJson(article.Other,"Metadatos");
            if(article.General.ValueKind!=JsonValueKind.Array || article.Costs.ValueKind!=JsonValueKind.Array ||
               article.Prices.ValueKind!=JsonValueKind.Array || article.Other.ValueKind!=JsonValueKind.Object)
                throw new ArgumentException("Formato de campos del mantenimiento original inválido.");
            static List<(string Section,int Index,string Name,string Value,bool? Checked)> ParseFields(JsonElement fields,string section)
            {
                var rows=new List<(string,int,string,string,bool?)>();
                var index=0;
                foreach(var entry in fields.EnumerateArray())
                {
                    if(entry.ValueKind!=JsonValueKind.Array || entry.GetArrayLength()<3 ||
                       entry[0].ValueKind!=JsonValueKind.String)
                        throw new ArgumentException("Estructura de campos inválida en "+section);
                    var name=entry[0].GetString()??"";
                    var value=entry[1].ValueKind==JsonValueKind.String?entry[1].GetString()??"":entry[1].ToString();
                    var check=entry[2].ValueKind switch
                    {
                        JsonValueKind.True => (bool?)true,
                        JsonValueKind.False => false,
                        JsonValueKind.Null => null,
                        _ => throw new ArgumentException("Selección inválida en "+section)
                    };
                    if(name.Length is <1 or >150 || value.Length>200000)
                        throw new ArgumentException("Campo demasiado grande o sin nombre en "+section);
                    rows.Add((section,index++,name,value,check));
                    if(index>1500)throw new ArgumentException("Demasiados campos en "+section);
                }
                return rows;
            }
            var allFields=ParseFields(article.General,"General");
            allFields.AddRange(ParseFields(article.Costs,"Costos"));
            allFields.AddRange(ParseFields(article.Prices,"Precios"));
            if(article.TaxRate is decimal rate &&
                (rate<0m || rate>100m || decimal.Round(rate,4)!=rate))
                throw new ArgumentException("Tarifa IVA inválida.");
            await using var db=new SqlConnection(connectionString);
            await db.OpenAsync();
            await using var tx=(SqlTransaction)await db.BeginTransactionAsync();
            await Write(db,tx,p);
            await using(var cmd=Cmd(db,tx,"""
                UPDATE dbo.POS365_ProductExtended SET GeneralJson=@general,CostsJson=@costs,
                    PricesJson=@prices,OtherJson=@other,UpdatedAt=SYSUTCDATETIME()
                WHERE ProductId=@id;
                IF @@ROWCOUNT=0
                   INSERT dbo.POS365_ProductExtended(ProductId,GeneralJson,CostsJson,PricesJson,OtherJson)
                   VALUES(@id,@general,@costs,@prices,@other);
                """,("@id",id),("@general",general),("@costs",costs),("@prices",prices),("@other",other)))
                await cmd.ExecuteNonQueryAsync();
            await using(var clear=Cmd(db,tx,
                "DELETE dbo.POS365_ProductField WHERE ProductId=@id",("@id",id)))
                await clear.ExecuteNonQueryAsync();
            foreach(var field in allFields)
            {
                await using var cmd=Cmd(db,tx,"""
                    INSERT dbo.POS365_ProductField(ProductId,Section,FieldIndex,FieldName,FieldValue,IsChecked)
                    VALUES(@id,@section,@index,@name,@value,@checked)
                    """,("@id",id),("@section",field.Section),("@index",field.Index),
                    ("@name",field.Name),("@value",field.Value),("@checked",field.Checked));
                await cmd.ExecuteNonQueryAsync();
            }
            if(article.TaxRate is decimal tax)
            {
                await using var cmd=Cmd(db,tx,"""
                    UPDATE dbo.POS365_ProductTax SET TaxRate=@rate,UpdatedAt=SYSUTCDATETIME() WHERE ProductId=@id;
                    IF @@ROWCOUNT=0 INSERT dbo.POS365_ProductTax(ProductId,TaxRate) VALUES(@id,@rate);
                    """,("@id",id));
                var parameter=cmd.Parameters.Add("@rate",SqlDbType.Decimal);
                parameter.Precision=7;parameter.Scale=4;parameter.Value=tax;
                await cmd.ExecuteNonQueryAsync();
            }
            var saved=await Read(db,tx,id);
            await tx.CommitAsync();
            return Results.Ok(new {product=saved,extendedSaved=true,fields=new[]{"General","Costos","Precios"}});
        }));

        app.MapGet("/api/catalog/products",(string? q,int? page)=>Guard(async()=>
        {
            var query=(q??"").Trim(); if(query.Length>100) throw new ArgumentException("Busqueda demasiado larga.");
            int p=page??1; if(p<1||p>100000) throw new ArgumentException("Pagina invalida.");
            await using var db=new SqlConnection(connectionString);await db.OpenAsync();
            await using var cmd=Cmd(db,null,"""
                SELECT p.ProductId,p.Code,p.Barcode,p.Name,r.Amount,r.Currency,p.Version
                FROM dbo.POS365_Product p LEFT JOIN dbo.POS365_ProductPrice r ON r.ProductId=p.ProductId AND r.ListNumber=0
                WHERE @q=N'' OR CHARINDEX(@q,p.Name)>0 OR EXISTS(SELECT 1 FROM dbo.POS365_ProductIdentifier i WHERE i.ProductId=p.ProductId AND i.Identifier=@q)
                ORDER BY p.Code OFFSET @offset ROWS FETCH NEXT 51 ROWS ONLY
                """,("@q",query),("@offset",(p-1)*50));
            var rows=new List<object>();await using var reader=await cmd.ExecuteReaderAsync();
            while(await reader.ReadAsync()) rows.Add(new {id=reader.GetGuid(0),code=reader.GetString(1),barcode=reader.GetString(2),name=reader.GetString(3),price=reader.IsDBNull(4)?(decimal?)null:reader.GetDecimal(4),currency=reader.IsDBNull(5)?"":reader.GetString(5),version=Convert.ToBase64String((byte[])reader[6])});
            return Results.Ok(new {items=rows.Take(50),page=p,hasMore=rows.Count>50});
        }));
        app.MapGet("/api/catalog/products/{id:guid}",(Guid id)=>Guard(async()=>
        {
            await using var db=new SqlConnection(connectionString);await db.OpenAsync();
            await using var tx=(SqlTransaction)await db.BeginTransactionAsync(IsolationLevel.RepeatableRead);
            var product=await Read(db,tx,id);await tx.CommitAsync();
            return product is null?Results.NotFound():Results.Ok(product);
        }));
        app.MapPut("/api/catalog/products/{id:guid}",(Guid id,CatalogProduct product)=>Guard(async()=>
        {
            if(id!=product.Id) throw new ArgumentException("Identificador no coincide.");
            product=CatalogValidation.Normalize(product);
            await using var db=new SqlConnection(connectionString);await db.OpenAsync();
            await using var tx=(SqlTransaction)await db.BeginTransactionAsync();
            await Write(db,tx,product);
            var saved=await Read(db,tx,id);await tx.CommitAsync();return Results.Ok(saved);
        }));
        app.MapPost("/api/catalog/import",(CatalogImport input)=>Guard(async()=>
        {
            var products=CatalogValidation.ReadBackup(input.Backup);
            string hash=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input.Backup.GetRawText())));
            await using var db=new SqlConnection(connectionString);await db.OpenAsync();
            await using var tx=(SqlTransaction)await db.BeginTransactionAsync();
            await using(var existing=Cmd(db,tx,"SELECT ProductCount FROM dbo.POS365_CatalogImport WHERE ContentHash=@hash",("@hash",hash)))
            {
                if(await existing.ExecuteScalarAsync() is int count)
                    return Results.Ok(new {alreadyImported=true,count,hash,message="Este archivo ya fue importado. No se cambiaron articulos."});
            }
            var known=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            await using(var ids=Cmd(db,tx,"SELECT Identifier FROM dbo.POS365_ProductIdentifier"))
            await using(var reader=await ids.ExecuteReaderAsync())
                while(await reader.ReadAsync()) known.Add(reader.GetString(0));
            var conflicts=products.SelectMany(p=>p.Codes).Where(known.Contains).Distinct().Take(20).ToArray();
            if(conflicts.Length>0) throw new CatalogConflict("El archivo coincide con codigos ya existentes: "+string.Join(", ",conflicts)+". No se sobrescribiran articulos; no se importo nada.");
            if(!input.Confirm) return Results.Ok(new {preview=true,count=products.Count,hash,message="Solo articulos y precios. Ventas, compras, existencias y contactos no se importan en esta etapa."});
            foreach(var product in products) await Write(db,tx,product);
            await using(var mark=Cmd(db,tx,"INSERT dbo.POS365_CatalogImport(ContentHash,ProductCount) VALUES(@hash,@count)",("@hash",hash),("@count",products.Count))) await mark.ExecuteNonQueryAsync();
            await tx.CommitAsync();return Results.Ok(new {imported=true,count=products.Count,hash});
        }));
    }
    static async Task Write(SqlConnection db,SqlTransaction tx,CatalogProduct p)
    {
        string sql=p.Version is null?"""
            INSERT dbo.POS365_Product(ProductId,Code,Barcode,Name,Cabys,IncludesVAT,SourceJson)
            VALUES(@id,@code,@barcode,@name,@cabys,@vat,@source)
            """:"""
            UPDATE dbo.POS365_Product SET Code=@code,Barcode=@barcode,Name=@name,Cabys=@cabys,IncludesVAT=@vat,UpdatedAt=SYSUTCDATETIME()
            WHERE ProductId=@id AND Version=@version
            """;
        // SourceJson is an immutable copy of the imported original; edits affect relational columns.
        await using(var cmd=Cmd(db,tx,sql,("@id",p.Id),("@code",p.Code),("@barcode",p.Barcode),("@name",p.Name),("@cabys",p.Cabys),("@vat",p.IncludesVAT),("@source",p.Source?.GetRawText()??"{}"),("@version",p.Version is null?null:Convert.FromBase64String(p.Version))))
            if(await cmd.ExecuteNonQueryAsync()!=1) throw new CatalogConflict("Otro usuario modifico el articulo o ya no existe. Recargue antes de guardar.");
        await using(var clear=Cmd(db,tx,"DELETE dbo.POS365_ProductIdentifier WHERE ProductId=@id; DELETE dbo.POS365_ProductPrice WHERE ProductId=@id;",("@id",p.Id))) await clear.ExecuteNonQueryAsync();
        foreach(var code in p.Codes)
        {
            await using var cmd=Cmd(db,tx,"INSERT dbo.POS365_ProductIdentifier(Identifier,ProductId) VALUES(@code,@id)",("@code",code),("@id",p.Id));
            await cmd.ExecuteNonQueryAsync();
        }
        foreach(var price in p.Prices)
        {
            await using var cmd=Cmd(db,tx,"INSERT dbo.POS365_ProductPrice(ProductId,ListNumber,Amount,Currency) VALUES(@id,@list,@amount,@currency)",("@id",p.Id),("@list",price.ListNumber),("@currency",price.Currency));
            var amount=cmd.Parameters.Add("@amount",SqlDbType.Decimal);amount.Precision=19;amount.Scale=4;amount.Value=(object?)price.Amount??DBNull.Value;
            await cmd.ExecuteNonQueryAsync();
        }
    }
    static async Task<CatalogProduct?> Read(SqlConnection db,SqlTransaction tx,Guid id)
    {
        CatalogProduct p;
        await using(var cmd=Cmd(db,tx,"SELECT Code,Barcode,Name,Cabys,IncludesVAT,Version,SourceJson FROM dbo.POS365_Product WHERE ProductId=@id",("@id",id)))
        await using(var r=await cmd.ExecuteReaderAsync())
        {
            if(!await r.ReadAsync()) return null;
            p=new(id,r.GetString(0),r.GetString(1),r.GetString(2),r.GetString(3),r.GetBoolean(4),[],[],Convert.ToBase64String((byte[])r[5]),JsonSerializer.Deserialize<JsonElement>(r.GetString(6)));
        }
        var codes=new List<string>();var prices=new List<CatalogPrice>();
        await using(var cmd=Cmd(db,tx,"SELECT Identifier FROM dbo.POS365_ProductIdentifier WHERE ProductId=@id ORDER BY Identifier",("@id",id)))
        await using(var r=await cmd.ExecuteReaderAsync()) while(await r.ReadAsync()) codes.Add(r.GetString(0));
        await using(var cmd=Cmd(db,tx,"SELECT ListNumber,Amount,Currency FROM dbo.POS365_ProductPrice WHERE ProductId=@id ORDER BY ListNumber",("@id",id)))
        await using(var r=await cmd.ExecuteReaderAsync()) while(await r.ReadAsync()) prices.Add(new(r.GetInt32(0),r.IsDBNull(1)?null:r.GetDecimal(1),r.GetString(2)));
        return p with {Codes=codes.ToArray(),Prices=prices.ToArray()};
    }
}
