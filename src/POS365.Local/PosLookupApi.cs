using Microsoft.Data.SqlClient;

public static class PosLookupApi
{
    public static void Map(WebApplication app, string connectionString)
    {
        // Solo consulta de articulos: NO confirma ventas, inventario ni pagos.
        app.MapGet("/api/pos/product", async (string? code, int? list, CancellationToken ct) =>
        {
            code = code?.Trim();
            var priceList = list ?? 0;
            if (string.IsNullOrWhiteSpace(code) || code.Length > 100 || priceList is < 0 or > 99)
                return Results.BadRequest(new { error = "Indique un codigo valido y una lista de precios entre 0 y 99." });
            try
            {
                await using var db = new SqlConnection(connectionString);
                await db.OpenAsync(ct);
                const string sql = """
                    SELECT TOP (1) p.ProductId, p.Code, p.Barcode, p.Name,
                           p.Cabys, p.IncludesVAT, r.Amount, r.Currency
                    FROM dbo.POS365_ProductIdentifier AS i
                    INNER JOIN dbo.POS365_Product AS p ON p.ProductId = i.ProductId
                    LEFT JOIN dbo.POS365_ProductPrice AS r
                        ON r.ProductId = p.ProductId AND r.ListNumber = @list
                    WHERE i.Identifier = @code
                    """;
                await using var cmd = new SqlCommand(sql, db);
                cmd.Parameters.Add("@code", System.Data.SqlDbType.NVarChar, 100).Value = code;
                cmd.Parameters.Add("@list", System.Data.SqlDbType.Int).Value = priceList;
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                if (!await reader.ReadAsync(ct))
                    return Results.NotFound(new { error = "Articulo no encontrado.", code });
                return Results.Ok(new
                {
                    id = reader.GetGuid(0),
                    code = reader.GetString(1),
                    barcode = reader.GetString(2),
                    name = reader.GetString(3),
                    cabys = reader.GetString(4),
                    includesVAT = reader.GetBoolean(5),
                    price = reader.IsDBNull(6) ? (decimal?)null : reader.GetDecimal(6),
                    currency = reader.IsDBNull(7) ? null : reader.GetString(7),
                    priceList,
                    canInvoice = false,
                    message = "Consulta de catalogo SQL; la facturacion transaccional sigue pendiente."
                });
            }
            catch (SqlException ex)
            {
                app.Logger.LogWarning("Consulta POS SQL fallo. Codigo {Number}", ex.Number);
                return Results.Json(new { error = "No se pudo consultar SQL Server.", sqlError = ex.Number }, statusCode: 503);
            }
        });
    }
}
