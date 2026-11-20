using System.Data;
using Microsoft.Data.SqlClient;

public static class ProductTaxApi
{
    public sealed record TaxSelection(decimal Rate);

    public static void Map(WebApplication app, string connectionString)
    {
        app.MapGet("/api/catalog/products/{id:guid}/tax", async (Guid id, CancellationToken ct) =>
        {
            try
            {
                await using var db = new SqlConnection(connectionString);
                await db.OpenAsync(ct);
                await using var cmd = new SqlCommand("""
                    SELECT p.IncludesVAT,t.TaxRate FROM dbo.POS365_Product p
                    LEFT JOIN dbo.POS365_ProductTax t ON t.ProductId=p.ProductId
                    WHERE p.ProductId=@id
                    """, db);
                cmd.Parameters.Add("@id",SqlDbType.UniqueIdentifier).Value=id;
                await using var r=await cmd.ExecuteReaderAsync(ct);
                if(!await r.ReadAsync(ct))return Results.NotFound(new {error="Articulo no existe."});
                return Results.Ok(new {includesVAT=r.GetBoolean(0),
                    rate=r.IsDBNull(1)?(decimal?)null:r.GetDecimal(1),
                    note="Tarifa declarada para desarrollo. No se infiere del CABYS ni se verifica con Hacienda."});
            }
            catch(SqlException e){return Results.Json(new {error="Error SQL de tarifas.",sqlError=e.Number},statusCode:503);}
        });

        app.MapPut("/api/catalog/products/{id:guid}/tax", async (Guid id, TaxSelection tax, CancellationToken ct) =>
        {
            if (tax.Rate < 0m || tax.Rate > 100m || decimal.Round(tax.Rate,4)!=tax.Rate)
                return Results.BadRequest(new {error="Tarifa inválida. Ingrese un porcentaje entre 0 y 100, hasta cuatro decimales."});
            try
            {
                await using var db=new SqlConnection(connectionString);
                await db.OpenAsync(ct);
                await using var cmd=new SqlCommand("""
                    UPDATE dbo.POS365_ProductTax SET TaxRate=@rate, UpdatedAt=SYSUTCDATETIME()
                    WHERE ProductId=@id;
                    IF @@ROWCOUNT=0
                      INSERT dbo.POS365_ProductTax(ProductId,TaxRate)
                      SELECT ProductId,@rate FROM dbo.POS365_Product WHERE ProductId=@id;
                    """,db);
                cmd.Parameters.Add("@id",SqlDbType.UniqueIdentifier).Value=id;
                var rate=cmd.Parameters.Add("@rate",SqlDbType.Decimal);rate.Precision=7;rate.Scale=4;rate.Value=tax.Rate;
                await cmd.ExecuteNonQueryAsync(ct);
                return Results.Ok(new {rate=tax.Rate,
                    note="Tarifa guardada para desarrollo, sin validación fiscal contra CABYS."});
            }
            catch(SqlException e){return Results.Json(new {error="Error SQL de tarifas.",sqlError=e.Number},statusCode:503);}
        });
    }
}