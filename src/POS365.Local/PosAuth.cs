using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Data.SqlClient;

public static class PosAuth
{
    private const int Iterations = 210_000;
    public sealed record Credentials(string Username, string Password);
    public sealed record NewUser(string Username, string DisplayName, string Password, bool IsAdmin);

    public static void Configure(IServiceCollection services, bool allowLocalHttp)
    {
        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = allowLocalHttp ? "POS365-TestSession" : "__Host-POS365";
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = allowLocalHttp ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.Cookie.Path = "/";
                options.LoginPath = "/login";
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.SlidingExpiration = true;
                options.Events.OnRedirectToLogin = context =>
                {
                    if (context.Request.Path.StartsWithSegments("/api"))
                    { context.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; }
                    context.Response.Redirect("/login"); return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = context =>
                { context.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };
            });
        services.AddAuthorization();
    }

    private static bool ValidUsername(string? s) =>
        !string.IsNullOrWhiteSpace(s) && Regex.IsMatch(s, @"^[a-zA-Z0-9._-]{3,64}$");
    private static bool ValidPassword(string? s) =>
        s is {Length: >= 12 and <= 256};
    private static byte[] Hash(string password, byte[] salt) =>
        Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, 32);

    private static async Task<SqlConnection> Connect(string cs)
    { var db = new SqlConnection(cs); await db.OpenAsync(); return db; }

    // Operación explícita, solo desde PowerShell local: no existe usuario predeterminado.
    public static async Task SetupFirstAdmin(string cs)
    {
        await using var db = await Connect(cs);
        await using(var check = new SqlCommand("SELECT COUNT_BIG(*) FROM dbo.POS365_User",db))
        {
            if(Convert.ToInt64(await check.ExecuteScalarAsync()) != 0)
                throw new InvalidOperationException("Ya existen usuarios. El alta inicial solo se permite en una base vacía.");
        }
        Console.Write("Usuario administrador (3-64 caracteres): ");
        var username=Console.ReadLine()?.Trim() ?? "";
        Console.Write("Nombre visible: ");
        var name=Console.ReadLine()?.Trim() ?? "";
        Console.Write("Contraseña (mínimo 12 caracteres; no se mostrará): ");
        var password=ReadSecret();
        Console.WriteLine();
        if(!ValidUsername(username)||name.Length is <1 or >150||!ValidPassword(password))
            throw new InvalidOperationException("Datos inválidos: usuario 3-64, nombre 1-150 y contraseña mínimo 12 caracteres.");
        await InsertUser(db,null,username,name,password,true);
        Console.WriteLine("Administrador SQL inicial creado. No se creó contraseña predeterminada.");
    }

    // Recuperacion administrativa local: requiere acceso autorizado a SQL Server.
    // No crea otro usuario, no cambia roles ni almacena la contrasena en scripts.
    public static async Task ResetAdminPassword(string cs, string username)
    {
        username = (username ?? "").Trim().ToLowerInvariant();
        if (!ValidUsername(username)) throw new InvalidOperationException("Usuario administrador invalido.");
        await using var db = await Connect(cs);
        await using (var check = new SqlCommand("SELECT COUNT(*) FROM dbo.POS365_User WHERE Username=@u AND IsAdmin=1", db))
        {
            check.Parameters.Add("@u",SqlDbType.NVarChar,64).Value=username;
            if (Convert.ToInt32(await check.ExecuteScalarAsync()) != 1)
                throw new InvalidOperationException("No existe un administrador POS365 con ese nombre en POS365_DEV.");
        }
        Console.Write("Restablecer la clave del administrador '" + username + "' en POS365_DEV? Escriba SI: ");
        if (!string.Equals(Console.ReadLine()?.Trim(), "SI", StringComparison.Ordinal))
        {
            Console.WriteLine("Operacion cancelada.");
            return;
        }
        Console.Write("Nueva contrasena POS365 (12-256 caracteres; oculta): ");
        var password = ReadSecret(); Console.WriteLine();
        Console.Write("Repita la nueva contrasena (oculta): ");
        var confirmation = ReadSecret(); Console.WriteLine();
        if (!ValidPassword(password) || !string.Equals(password, confirmation, StringComparison.Ordinal))
            throw new InvalidOperationException("Las contrasenas no coinciden o no cumplen la longitud requerida.");
        var salt = RandomNumberGenerator.GetBytes(32);
        var hash = Hash(password, salt);
        await using var command = new SqlCommand("""
            UPDATE dbo.POS365_User
            SET PasswordSalt=@s,PasswordHash=@h,FailedAttempts=0,LockedUntil=NULL,UpdatedUtc=SYSUTCDATETIME()
            WHERE Username=@u AND IsAdmin=1
            """, db);
        command.Parameters.Add("@s",SqlDbType.VarBinary,32).Value=salt;
        command.Parameters.Add("@h",SqlDbType.VarBinary,32).Value=hash;
        command.Parameters.Add("@u",SqlDbType.NVarChar,64).Value=username;
        if (await command.ExecuteNonQueryAsync() != 1)
            throw new InvalidOperationException("No se pudo actualizar la cuenta administradora.");
        Console.WriteLine("Contrasena del administrador POS365 restablecida y bloqueo temporal limpiado.");
    }

    private static string ReadSecret()
    {
        var s=new StringBuilder();
        while(true)
        {
            var k=Console.ReadKey(true);
            if(k.Key==ConsoleKey.Enter)break;
            if(k.Key==ConsoleKey.Backspace) { if(s.Length>0)s.Length--; continue; }
            if(!char.IsControl(k.KeyChar) && s.Length<256)s.Append(k.KeyChar);
        }
        return s.ToString();
    }

    private static async Task InsertUser(SqlConnection db,SqlTransaction? tx,string user,string display,string pass,bool admin)
    {
        var salt=RandomNumberGenerator.GetBytes(32);
        var hash=Hash(pass,salt);
        await using var cmd=new SqlCommand("""
            INSERT INTO dbo.POS365_User(UserId,Username,DisplayName,PasswordSalt,PasswordHash,IsAdmin)
            VALUES(NEWID(),@u,@d,@s,@h,@a)
            """,db,tx);
        cmd.Parameters.Add("@u",SqlDbType.NVarChar,64).Value=user.Trim().ToLowerInvariant();
        cmd.Parameters.Add("@d",SqlDbType.NVarChar,150).Value=display.Trim();
        cmd.Parameters.Add("@s",SqlDbType.VarBinary,32).Value=salt;
        cmd.Parameters.Add("@h",SqlDbType.VarBinary,32).Value=hash;
        cmd.Parameters.Add("@a",SqlDbType.Bit).Value=admin;
        await cmd.ExecuteNonQueryAsync();
    }

    public static void Map(WebApplication app,string cs,bool allowLocalHttp)
    {
        app.MapGet("/login",() => Results.Redirect("/login.html")).AllowAnonymous();
        app.MapGet("/api/auth/me",(ClaimsPrincipal user) => Results.Ok(new {
            userId=user.FindFirstValue(ClaimTypes.NameIdentifier),
            username=user.Identity?.Name,admin=user.IsInRole("Admin")
        })).RequireAuthorization();

        app.MapPost("/api/auth/login",async(HttpContext ctx,Credentials input) =>
        {
            if(!ctx.Request.IsHttps && !allowLocalHttp)return Results.StatusCode(426);
            var name=input.Username?.Trim().ToLowerInvariant()??"";
            if(!ValidUsername(name)||input.Password is null||input.Password.Length>256)
                return Results.Unauthorized();
            await using var db=await Connect(cs);
            await using var cmd=new SqlCommand("""
                SELECT UserId,DisplayName,PasswordSalt,PasswordHash,IsAdmin,IsActive,FailedAttempts,LockedUntil
                FROM dbo.POS365_User WHERE Username=@u
                """,db);
            cmd.Parameters.Add("@u",SqlDbType.NVarChar,64).Value=name;
            Guid userId; string display;byte[] salt,hash;bool admin,active;int fails;DateTime? locked;
            await using(var rd=await cmd.ExecuteReaderAsync())
            {
                if(!await rd.ReadAsync())return Results.Unauthorized();
                userId=rd.GetGuid(0);display=rd.GetString(1);salt=(byte[])rd[2];hash=(byte[])rd[3];
                admin=rd.GetBoolean(4);active=rd.GetBoolean(5);fails=rd.GetInt32(6);
                locked=rd.IsDBNull(7)?null:rd.GetDateTime(7);
            }
            if(!active||locked>DateTime.UtcNow)return Results.Unauthorized();
            var accepted=CryptographicOperations.FixedTimeEquals(Hash(input.Password,salt),hash);
            if(!accepted)
            {
                await using var fail=new SqlCommand("""
                    UPDATE dbo.POS365_User SET FailedAttempts=FailedAttempts+1,
                    LockedUntil=CASE WHEN FailedAttempts+1>=5 THEN DATEADD(minute,15,SYSUTCDATETIME()) ELSE LockedUntil END
                    WHERE UserId=@id
                    """,db);
                fail.Parameters.Add("@id",SqlDbType.UniqueIdentifier).Value=userId;
                await fail.ExecuteNonQueryAsync();
                return Results.Unauthorized();
            }
            await using(var reset=new SqlCommand("""
                UPDATE dbo.POS365_User SET FailedAttempts=0,LockedUntil=NULL WHERE UserId=@id
                """,db))
            { reset.Parameters.Add("@id",SqlDbType.UniqueIdentifier).Value=userId;await reset.ExecuteNonQueryAsync(); }
            var claims=new List<Claim>{new(ClaimTypes.NameIdentifier,userId.ToString()),new(ClaimTypes.Name,name),
                new("DisplayName",display)};
            if(admin)claims.Add(new Claim(ClaimTypes.Role,"Admin"));
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(new ClaimsIdentity(claims,CookieAuthenticationDefaults.AuthenticationScheme)));
            return Results.Ok(new{username=name,displayName=display,admin});
        }).AllowAnonymous();

        app.MapPost("/api/auth/logout",async(HttpContext ctx)=>
        {
            await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok(new{ok=true});
        }).RequireAuthorization();

        app.MapPost("/api/auth/users",async(NewUser input)=>
        {
            if(!ValidUsername(input.Username)||string.IsNullOrWhiteSpace(input.DisplayName)||
               input.DisplayName.Length>150||!ValidPassword(input.Password))
                return Results.BadRequest(new{error="Usuario, nombre o contraseña inválidos."});
            try
            {
                await using var db=await Connect(cs);
                await InsertUser(db,null,input.Username,input.DisplayName,input.Password,input.IsAdmin);
                return Results.Ok(new{created=true});
            }
            catch(SqlException e) when(e.Number is 2601 or 2627)
            { return Results.Conflict(new{error="El usuario ya existe."}); }
        }).RequireAuthorization(policy=>policy.RequireRole("Admin"));
    }
}
