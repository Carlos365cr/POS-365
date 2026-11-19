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
    public static void Map(WebApplication app,string connectionString)
    {
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
