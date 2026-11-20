using System.Net;
using Microsoft.Data.SqlClient;

var initialize = args.Contains("--initialize-db");
var builder = WebApplication.CreateBuilder(args.Where(a => a != "--initialize-db").ToArray());
// Development scaffold: cannot be exposed as a production POS.
if (!builder.Environment.IsDevelopment())
    throw new InvalidOperationException("Este entorno inicial solo funciona en Development; aun no incluye autenticacion de produccion.");
builder.WebHost.UseUrls("http://127.0.0.1:5085");
var raw = builder.Configuration.GetConnectionString("Pos365");
if (string.IsNullOrWhiteSpace(raw))
    throw new InvalidOperationException("Configure ConnectionStrings__Pos365 mediante scripts/Iniciar-Local.ps1.");
var cs = new SqlConnectionStringBuilder(raw);
if (!string.Equals(cs.InitialCatalog, "POS365_DEV", StringComparison.OrdinalIgnoreCase))
    throw new InvalidOperationException("Esta fase solo permite la base POS365_DEV.");
cs.ConnectTimeout = 5;
if (initialize)
{
    var master = new SqlConnectionStringBuilder(cs.ConnectionString) { InitialCatalog = "master" };
    await using (var connection = new SqlConnection(master.ConnectionString))
    {
        await connection.OpenAsync();
        await using var command = new SqlCommand("IF DB_ID(N'POS365_DEV') IS NULL CREATE DATABASE [POS365_DEV];", connection) { CommandTimeout = 60 };
        await command.ExecuteNonQueryAsync();
    }
    await using var db = new SqlConnection(cs.ConnectionString);
    await db.OpenAsync();
    foreach (var resource in new[] { "POS365.Schema.sql", "POS365.Catalog.sql", "POS365.Sales.sql", "POS365.Tax.sql", "POS365.ArticleExtended.sql" })
    {
        using var stream = typeof(Program).Assembly.GetManifestResourceStream(resource)!;
        using var reader = new StreamReader(stream);
        await using var migration = new SqlCommand(await reader.ReadToEndAsync(), db) { CommandTimeout = 120 };
        await migration.ExecuteNonQueryAsync();
    }
    Console.WriteLine("POS365_DEV inicializada. No se modificaron otras bases.");
    return;
}
var app = builder.Build();
app.Use(async (context, next) =>
{
    if (context.Connection.RemoteIpAddress is not { } ip || !IPAddress.IsLoopback(ip))
    { context.Response.StatusCode = 403; return; }
    if (context.Request.Host.Host is not ("127.0.0.1" or "localhost" or "::1"))
    { context.Response.StatusCode = 400; return; }
    context.Response.Headers.CacheControl = "no-store";
    await next();
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapGet("/health/live", () => Results.Ok(new { status = "ok", stage = "development-foundation" }));
app.MapGet("/health/ready", async (CancellationToken ct) =>
{
    try
    {
        await using var connection = new SqlConnection(cs.ConnectionString);
        await connection.OpenAsync(ct);
        await using var command = new SqlCommand("SELECT MAX(Version) FROM dbo.POS365_SchemaVersion", connection);
        var version = await command.ExecuteScalarAsync(ct);
        return version is int n && n >= 5
            ? Results.Ok(new { status = "ok", database = "POS365_DEV", schemaVersion = n })
            : Results.Json(new { status = "pending", message = "Inicialice el esquema." }, statusCode: 503);
    }
    catch (SqlException ex)
    {
        app.Logger.LogWarning("SQL Server no disponible. Codigo SQL: {Number}", ex.Number);
        return Results.Json(new { status = "error", sqlError = ex.Number, message = "Verifique servidor, credenciales, permisos y esquema. No comparta contrasenas." }, statusCode: 503);
    }
});
CatalogApi.Map(app, cs.ConnectionString);
PosLookupApi.Map(app, cs.ConnectionString);
PosDraftApi.Map(app, cs.ConnectionString);
ProductTaxApi.Map(app, cs.ConnectionString);
app.MapFallback("/api/{**path}", () => Results.Json(new { error = "Funcion del POS pendiente de migracion; no se ha guardado ninguna operacion." }, statusCode: 501));
app.Run();
