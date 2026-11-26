using System.Data;
using Microsoft.Data.SqlClient;

public static class HandheldSqlApi
{
    // Consulta SQL de solo lectura. No altera precios ni existencias.
    public static void Map(WebApplication app, string cs)
    {
        app.MapGet("/api/handheld/search", async (string? q,int? page,CancellationToken ct) =>
        {
            q=(q??"").Trim();
            int p=page??1;
            if(q.Length>100 || p<1 || p>10000)
                return Results.BadRequest(new {error="Filtro o página inválidos."});
            try
            {
                await using var db=new SqlConnection(cs);
                await db.OpenAsync(ct);
                const string sql="""
                    SELECT x.ProductId,x.Code,x.Barcode,x.Name,x.Cabys,x.IncludesVAT,
                           r.Amount,r.Currency
                    FROM dbo.POS365_Product x
                    LEFT JOIN dbo.POS365_ProductPrice r ON x.ProductId=r.ProductId AND r.ListNumber=0
                    WHERE @q=N'' OR x.Code=@q OR x.Barcode=@q OR
                          x.Name LIKE N'%'+@q+N'%' OR
                          EXISTS(SELECT 1 FROM dbo.POS365_ProductIdentifier i
                                 WHERE i.ProductId=x.ProductId AND i.Identifier=@q)
                    ORDER BY x.Name,x.Code
                    OFFSET @offset ROWS FETCH NEXT 21 ROWS ONLY
                    """;
                await using var cmd=new SqlCommand(sql,db);
                cmd.Parameters.Add("@q",SqlDbType.NVarChar,100).Value=q;
                cmd.Parameters.Add("@offset",SqlDbType.Int).Value=(p-1)*20;
                var items=new List<object>();
                await using var rd=await cmd.ExecuteReaderAsync(ct);
                while(await rd.ReadAsync(ct))
                {
                    items.Add(new {
                      id=rd.GetGuid(0),code=rd.GetString(1),barcode=rd.GetString(2),
                      name=rd.GetString(3),cabys=rd.GetString(4),includesVAT=rd.GetBoolean(5),
                      price=rd.IsDBNull(6)?(decimal?)null:rd.GetDecimal(6),
                      currency=rd.IsDBNull(7)?null:rd.GetString(7)
                    });
                }
                return Results.Ok(new{items=items.Take(20),page=p,hasMore=items.Count>20});
            }
            catch(SqlException e)
            {
                return Results.Json(new{error="No se pudo consultar SQL Server.",sqlError=e.Number},statusCode:503);
            }
        });
    }
}