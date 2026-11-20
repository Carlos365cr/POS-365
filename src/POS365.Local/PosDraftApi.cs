using System.Data;
using Microsoft.Data.SqlClient;

// Test-only endpoint: saves an unposted Draft, never a fiscal invoice or stock movement.
public static class PosDraftApi
{
    public sealed record DraftLine(Guid ProductId, decimal Quantity, decimal Tax);
    public sealed record DraftPayment(string Method, decimal Amount);
    public sealed record DraftRequest(Guid RequestId, string RegisterCode, DraftLine[] Lines,
        DraftPayment[] Payments, decimal ExpectedTotal);

    private static SqlParameter Money(string name, decimal value) =>
        new(name, SqlDbType.Decimal) { Precision = 19, Scale = 4, Value = value };

    public static void Map(WebApplication app, string connectionString)
    {
        app.MapPost("/api/pos/drafts", async (DraftRequest request, CancellationToken ct) =>
        {
            if (request.RequestId == Guid.Empty || string.IsNullOrWhiteSpace(request.RegisterCode)
                || request.RegisterCode.Length > 30 || request.Lines is null
                || request.Lines.Length is < 1 or > 100 || request.Payments is null
                || request.Payments.Length is < 1 or > 10 || request.ExpectedTotal <= 0
                || request.Lines.Any(x => x.ProductId == Guid.Empty || x.Quantity <= 0
                    || x.Quantity > 99999 || decimal.Round(x.Quantity, 4) != x.Quantity
                    || x.Tax < 0 || decimal.Round(x.Tax, 4) != x.Tax)
                || request.Payments.Any(x => string.IsNullOrWhiteSpace(x.Method) || x.Method.Length > 30
                    || x.Amount <= 0 || decimal.Round(x.Amount, 4) != x.Amount))
                return Results.BadRequest(new { error = "Solicitud de prueba invalida." });

            try
            {
                await using var db = new SqlConnection(connectionString);
                await db.OpenAsync(ct);
                await using var tx = (SqlTransaction)await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
                // The same request ID must not generate two drafts after a network retry.
                await using (var check = new SqlCommand(
                    "SELECT SaleId,Total FROM dbo.POS365_Sale WITH (UPDLOCK,HOLDLOCK) WHERE RequestId=@request",
                    db, tx))
                {
                    check.Parameters.Add("@request", SqlDbType.UniqueIdentifier).Value = request.RequestId;
                    await using var existing = await check.ExecuteReaderAsync(ct);
                    if (await existing.ReadAsync(ct))
                    {
                        var id = existing.GetGuid(0);
                        var total = existing.GetDecimal(1);
                        await existing.DisposeAsync();
                        await tx.CommitAsync(ct);
                        return Results.Ok(new { draftId = id, total, alreadySaved = true, status = "Draft" });
                    }
                }

                const string branchSql = """
                    DECLARE @branch uniqueidentifier;
                    SELECT @branch=BranchId FROM dbo.POS365_Branch WITH (UPDLOCK,HOLDLOCK) WHERE Code=N'DEV';
                    IF @branch IS NULL
                    BEGIN
                        SET @branch=NEWID();
                        INSERT dbo.POS365_Branch(BranchId,Code,Name)
                        VALUES(@branch,N'DEV',N'Desarrollo local - sin validez fiscal');
                    END
                    SELECT @branch;
                    """;
                Guid branchId;
                await using (var branch = new SqlCommand(branchSql, db, tx))
                    branchId = (Guid)(await branch.ExecuteScalarAsync(ct))!;

                var rows = new List<(Guid Id, string Code, string Name, string Cabys, decimal Qty,
                    decimal Gross, decimal Tax, decimal Net)>();
                for (var i = 0; i < request.Lines.Length; i++)
                {
                    var line = request.Lines[i];
                    await using var lookup = new SqlCommand("""
                        SELECT p.Code,p.Name,p.Cabys,r.Amount,r.Currency
                        FROM dbo.POS365_Product p WITH (HOLDLOCK)
                        INNER JOIN dbo.POS365_ProductPrice r ON r.ProductId=p.ProductId AND r.ListNumber=0
                        WHERE p.ProductId=@id
                        """, db, tx);
                    lookup.Parameters.Add("@id", SqlDbType.UniqueIdentifier).Value = line.ProductId;
                    await using var reader = await lookup.ExecuteReaderAsync(ct);
                    if (!await reader.ReadAsync(ct) || reader.IsDBNull(3) ||
                        reader.GetString(4) != "Colón")
                        return Results.BadRequest(new { error = "Articulo sin precio en colones para lista 0." });
                    var code = reader.GetString(0);
                    var name = reader.GetString(1);
                    var cabys = reader.GetString(2);
                    var price = reader.GetDecimal(3);
                    var gross = decimal.Round(price * line.Quantity, 4);
                    if (line.Tax > gross)
                        return Results.BadRequest(new { error = "Impuesto supera importe de linea." });
                    rows.Add((line.ProductId, code, name, cabys, line.Quantity, gross,
                        line.Tax, gross - line.Tax));
                }
                var total = rows.Sum(x => x.Gross);
                var tax = rows.Sum(x => x.Tax);
                if (total != request.ExpectedTotal || request.Payments.Sum(x => x.Amount) != total)
                    return Results.Conflict(new { error = "Los importes o pagos no coinciden con los precios actuales en SQL. No se guardo el borrador." });

                var saleId = Guid.NewGuid();
                await using (var cmd = new SqlCommand("""
                    INSERT dbo.POS365_Sale
                    (SaleId,RequestId,BranchId,RegisterCode,DocumentNumber,OccurredAt,Currency,
                     Subtotal,Discount,Tax,Total,Status)
                    VALUES(@id,@request,@branch,@register,NULL,SYSUTCDATETIME(),N'Colón',
                           @subtotal,0,@tax,@total,N'Draft')
                    """, db, tx))
                {
                    cmd.Parameters.Add("@id", SqlDbType.UniqueIdentifier).Value = saleId;
                    cmd.Parameters.Add("@request", SqlDbType.UniqueIdentifier).Value = request.RequestId;
                    cmd.Parameters.Add("@branch", SqlDbType.UniqueIdentifier).Value = branchId;
                    cmd.Parameters.Add("@register", SqlDbType.NVarChar, 30).Value = request.RegisterCode.Trim();
                    cmd.Parameters.Add(Money("@subtotal", total - tax));
                    cmd.Parameters.Add(Money("@tax", tax));
                    cmd.Parameters.Add(Money("@total", total));
                    await cmd.ExecuteNonQueryAsync(ct);
                }
                for (var i = 0; i < rows.Count; i++)
                {
                    var r = rows[i];
                    await using var cmd = new SqlCommand("""
                        INSERT dbo.POS365_SaleLine
                        (SaleId,LineNumber,ProductId,Code,Description,Cabys,Quantity,
                         UnitPrice,Subtotal,Discount,Tax,Total)
                        VALUES(@sale,@number,@product,@code,@name,@cabys,@qty,@unit,
                               @subtotal,0,@tax,@total)
                        """, db, tx);
                    cmd.Parameters.Add("@sale", SqlDbType.UniqueIdentifier).Value = saleId;
                    cmd.Parameters.Add("@number", SqlDbType.Int).Value = i + 1;
                    cmd.Parameters.Add("@product", SqlDbType.UniqueIdentifier).Value = r.Id;
                    cmd.Parameters.Add("@code", SqlDbType.NVarChar, 100).Value = r.Code;
                    cmd.Parameters.Add("@name", SqlDbType.NVarChar, 250).Value = r.Name;
                    cmd.Parameters.Add("@cabys", SqlDbType.NVarChar, 13).Value = r.Cabys;
                    cmd.Parameters.Add(Money("@qty", r.Qty));
                    cmd.Parameters.Add(Money("@unit", r.Gross / r.Qty));
                    cmd.Parameters.Add(Money("@subtotal", r.Net));
                    cmd.Parameters.Add(Money("@tax", r.Tax));
                    cmd.Parameters.Add(Money("@total", r.Gross));
                    await cmd.ExecuteNonQueryAsync(ct);
                }
                for (var i = 0; i < request.Payments.Length; i++)
                {
                    var payment = request.Payments[i];
                    await using var cmd = new SqlCommand("""
                        INSERT dbo.POS365_SalePayment
                        (SaleId,PaymentNumber,Method,Currency,Amount,Reference)
                        VALUES(@sale,@number,@method,N'Colón',@amount,NULL)
                        """, db, tx);
                    cmd.Parameters.Add("@sale", SqlDbType.UniqueIdentifier).Value = saleId;
                    cmd.Parameters.Add("@number", SqlDbType.Int).Value = i + 1;
                    cmd.Parameters.Add("@method", SqlDbType.NVarChar, 30).Value = payment.Method.Trim();
                    cmd.Parameters.Add(Money("@amount", payment.Amount));
                    await cmd.ExecuteNonQueryAsync(ct);
                }
                await tx.CommitAsync(ct);
                return Results.Ok(new { draftId = saleId, total, alreadySaved = false, status = "Draft",
                    warning = "Borrador de desarrollo: impuestos declarados por el cliente, no validados fiscalmente. No es una venta." });
            }
            catch (SqlException ex) when (ex.Number is 2601 or 2627 or 1205)
            {
                return Results.Conflict(new { error = "Conflicto simultaneo. Consulte el borrador antes de reintentar." });
            }
            catch (SqlException ex)
            {
                app.Logger.LogWarning("Error SQL al guardar borrador: {SqlError}", ex.Number);
                return Results.Json(new { error = "No se confirmo el borrador SQL. Verifique los registros antes de reintentar.",
                    sqlError = ex.Number }, statusCode: 503);
            }
        });
    }
}
