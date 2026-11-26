using System.Net;
using Microsoft.Data.SqlClient;

var initialize = args.Contains("--initialize-db");
var setupAdmin = args.Contains("--setup-admin");
var resetAdmin = args.Contains("--reset-admin-password");
var resetAdminIndex = Array.IndexOf(args, "--reset-admin-password");
var resetUsername = resetAdminIndex >= 0 && resetAdminIndex + 1 < args.Length ? args[resetAdminIndex + 1] : "";
var builder = WebApplication.CreateBuilder(args.TakeWhile(a => a != "--reset-admin-password").Where(a => a != "--initialize-db" && a != "--setup-admin").ToArray());
// Development remains loopback-only. IIS staging uses POS365 cookie authentication
// and IIS in-process hosting. This is not a production release.
var iisStaging = builder.Environment.IsEnvironment("IIS-Staging");
var allowHttp = !iisStaging || builder.Configuration.GetValue<bool>("IisTesting:AllowHttp");
PosAuth.Configure(builder.Services, allowHttp);
if (!builder.Environment.IsDevelopment() && !iisStaging)
    throw new InvalidOperationException("POS365 solo admite Development o IIS-Staging por ahora.");
if (iisStaging && !setupAdmin && !resetAdmin && string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_IIS_PHYSICAL_PATH")))
    throw new InvalidOperationException("IIS-Staging requiere hospedaje mediante IIS.");
if (!iisStaging)
    builder.WebHost.UseUrls("http://127.0.0.1:5085");
var raw = builder.Configuration.GetConnectionString("Pos365");
if (string.IsNullOrWhiteSpace(raw))
    throw new InvalidOperationException("Configure ConnectionStrings__Pos365 mediante scripts/Iniciar-Local.ps1.");
var cs = new SqlConnectionStringBuilder(raw);
if (!string.Equals(cs.InitialCatalog, "POS365_DEV", StringComparison.OrdinalIgnoreCase))
    throw new InvalidOperationException("Esta fase solo permite la base POS365_DEV.");
cs.ConnectTimeout = 5;
if (resetAdmin)
{
    if (!builder.Environment.IsDevelopment()) throw new InvalidOperationException("El restablecimiento requiere Development y consola local.");
    await PosAuth.ResetAdminPassword(cs.ConnectionString, resetUsername);
    return;
}
if (setupAdmin)
{
    if (!builder.Environment.IsDevelopment()) throw new InvalidOperationException("El alta inicial requiere Development y consola local.");
    await PosAuth.SetupFirstAdmin(cs.ConnectionString);
    return;
}
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
    foreach (var resource in new[] { "POS365.Schema.sql", "POS365.Catalog.sql", "POS365.Sales.sql", "POS365.Tax.sql", "POS365.ArticleExtended.sql", "POS365.Auth.sql", "POS365.PurchaseInbox.sql" })
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
    if (iisStaging)
    {
        // Authentication and passwords must never traverse public HTTP.
        if (!context.Request.IsHttps && !allowHttp)
        { context.Response.StatusCode = 426; return; }
        if (context.Request.IsHttps)
            context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000";
    }
    else
    {
        if (context.Connection.RemoteIpAddress is not { } ip || !IPAddress.IsLoopback(ip))
        { context.Response.StatusCode = 403; return; }
        if (context.Request.Host.Host is not ("127.0.0.1" or "localhost" or "::1"))
        { context.Response.StatusCode = 400; return; }
    }
    context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    await next();
});
app.UseAuthentication();
app.UseAuthorization();
// Gate ALL pages, static files and API endpoints, not only the visible UI.
app.Use(async (context,next) =>
{
    var p=context.Request.Path;
    var publicPath=p.Equals("/login",StringComparison.OrdinalIgnoreCase) ||
        p.Equals("/login.html",StringComparison.OrdinalIgnoreCase) ||
        p.Equals("/api/auth/login",StringComparison.OrdinalIgnoreCase);
    var authenticated=context.User.Identity?.IsAuthenticated==true;
    // Login first, including when requesting the original HTML directly.
    // Do not expose the API or static assets before authentication.
    if(!publicPath && !authenticated)
    {
        if(p.StartsWithSegments("/api")){context.Response.StatusCode=401;return;}
        context.Response.Redirect("/login");return;
    }
    if(authenticated && (p.Equals("/login",StringComparison.OrdinalIgnoreCase) ||
                         p.Equals("/login.html",StringComparison.OrdinalIgnoreCase)))
    { context.Response.Redirect("/pos-original.html"); return; }
    // In IIS, state-changing requests must come from the same origin.
    if(iisStaging && !publicPath &&
       (HttpMethods.IsPost(context.Request.Method) || HttpMethods.IsPut(context.Request.Method) ||
        HttpMethods.IsPatch(context.Request.Method) || HttpMethods.IsDelete(context.Request.Method)))
    {
        var origin=context.Request.Headers.Origin.ToString();
        if(string.IsNullOrWhiteSpace(origin) ||
           !Uri.TryCreate(origin,UriKind.Absolute,out var from) ||
           !string.Equals(from.Authority,context.Request.Host.Value,StringComparison.OrdinalIgnoreCase) ||
           !string.Equals(from.Scheme,context.Request.Scheme,StringComparison.OrdinalIgnoreCase))
        {context.Response.StatusCode=403;return;}
    }
    await next();
});
app.Use(async (context, next) =>
{
    if (context.Request.Path.Equals("/usuarios.html", StringComparison.OrdinalIgnoreCase) && !context.User.IsInRole("Admin"))
    { context.Response.StatusCode = StatusCodes.Status403Forbidden; return; }
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
        return version is int n && n >= 6
            ? Results.Ok(new { status = "ok", database = "POS365_DEV", schemaVersion = n })
            : Results.Json(new { status = "pending", message = "Inicialice el esquema." }, statusCode: 503);
    }
    catch (SqlException ex)
    {
        app.Logger.LogWarning("SQL Server no disponible. Codigo SQL: {Number}", ex.Number);
        return Results.Json(new { status = "error", sqlError = ex.Number, message = "Verifique servidor, credenciales, permisos y esquema. No comparta contrasenas." }, statusCode: 503);
    }
});
PosAuth.Map(app, cs.ConnectionString, allowHttp);
PosUserManagement.Map(app, cs.ConnectionString);
CatalogApi.Map(app, cs.ConnectionString);
PosLookupApi.Map(app, cs.ConnectionString);
HandheldSqlApi.Map(app, cs.ConnectionString);
PosDraftApi.Map(app, cs.ConnectionString);
ProductTaxApi.Map(app, cs.ConnectionString);
PurchaseInboxApi.Map(app, cs.ConnectionString);
app.MapFallback("/api/{**path}", () => Results.Json(new { error = "Funcion del POS pendiente de migracion; no se ha guardado ninguna operacion." }, statusCode: 501));
app.Run();
