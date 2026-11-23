using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.Data.SqlClient;

public static class PosUserManagement
{
    public sealed record UserChange(string DisplayName, bool IsAdmin, bool IsActive);
    public sealed record PasswordChange(string Password);
    public static void Map(WebApplication app, string connectionString)
    {
        var group = app.MapGroup("/api/auth/users").RequireAuthorization(p => p.RequireRole("Admin"));
        group.MapGet("", async () =>
        {
            var list = new List<object>();
            await using var db = new SqlConnection(connectionString);
            await db.OpenAsync();
            await using var cmd = new SqlCommand("SELECT UserId,Username,DisplayName,IsAdmin,IsActive,FailedAttempts,LockedUntil,CreatedUtc FROM dbo.POS365_User ORDER BY Username",db);
            await using var r = await cmd.ExecuteReaderAsync();
            while(await r.ReadAsync()) list.Add(new {
                userId=r.GetGuid(0),username=r.GetString(1),displayName=r.GetString(2),
                isAdmin=r.GetBoolean(3),isActive=r.GetBoolean(4),failedAttempts=r.GetInt32(5),
                lockedUntil=r.IsDBNull(6)?(DateTime?)null:r.GetDateTime(6),createdUtc=r.GetDateTime(7)
            });
            return Results.Ok(list);
        });
        group.MapPut("/{id:guid}", async (Guid id, UserChange input, ClaimsPrincipal actor) =>
        {
            var name=input.DisplayName?.Trim();
            if (string.IsNullOrEmpty(name)||name.Length>150) return Results.BadRequest(new {error="Nombre inválido."});
            var actorId=Guid.Parse(actor.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await using var db=new SqlConnection(connectionString); await db.OpenAsync();
            await using var tx=(SqlTransaction)await db.BeginTransactionAsync(IsolationLevel.Serializable);
            await using var lockcmd=new SqlCommand("SELECT IsAdmin,IsActive FROM dbo.POS365_User WITH(UPDLOCK,HOLDLOCK) WHERE UserId=@id",db,tx);
            lockcmd.Parameters.Add("@id",SqlDbType.UniqueIdentifier).Value=id;
            bool wasAdmin,wasActive;
            await using(var reader=await lockcmd.ExecuteReaderAsync()){
                if(!await reader.ReadAsync())return Results.NotFound();
                wasAdmin=reader.GetBoolean(0);wasActive=reader.GetBoolean(1);
            }
            if(id==actorId && (!input.IsActive || !input.IsAdmin))return Results.BadRequest(new {error="No puede desactivar ni quitarse permisos de administrador."});
            if(wasAdmin && wasActive && (!input.IsAdmin || !input.IsActive)){
                await using var count=new SqlCommand("SELECT COUNT(*) FROM dbo.POS365_User WITH(UPDLOCK,HOLDLOCK) WHERE IsAdmin=1 AND IsActive=1",db,tx);
                if(Convert.ToInt32(await count.ExecuteScalarAsync())<=1)
                    return Results.BadRequest(new {error="Debe permanecer al menos un administrador activo."});
            }
            await using var cmd=new SqlCommand("UPDATE dbo.POS365_User SET DisplayName=@n,IsAdmin=@a,IsActive=@active,UpdatedUtc=SYSUTCDATETIME() WHERE UserId=@id",db,tx);
            cmd.Parameters.Add("@n",SqlDbType.NVarChar,150).Value=name;
            cmd.Parameters.Add("@a",SqlDbType.Bit).Value=input.IsAdmin;
            cmd.Parameters.Add("@active",SqlDbType.Bit).Value=input.IsActive;
            cmd.Parameters.Add("@id",SqlDbType.UniqueIdentifier).Value=id;
            await cmd.ExecuteNonQueryAsync(); await tx.CommitAsync();
            return Results.Ok(new {updated=true});
        });
        group.MapPost("/{id:guid}/password",async(Guid id,PasswordChange input)=>
        {
            if(input.Password is null || input.Password.Length<12 || input.Password.Length>256)
                return Results.BadRequest(new {error="La contraseña debe tener entre 12 y 256 caracteres."});
            var salt=RandomNumberGenerator.GetBytes(32);
            var hash=Rfc2898DeriveBytes.Pbkdf2(input.Password,salt,210_000,HashAlgorithmName.SHA256,32);
            await using var db=new SqlConnection(connectionString); await db.OpenAsync();
            await using var cmd=new SqlCommand("UPDATE dbo.POS365_User SET PasswordSalt=@s,PasswordHash=@h,FailedAttempts=0,LockedUntil=NULL,UpdatedUtc=SYSUTCDATETIME() WHERE UserId=@id",db);
            cmd.Parameters.Add("@s",SqlDbType.VarBinary,32).Value=salt;
            cmd.Parameters.Add("@h",SqlDbType.VarBinary,32).Value=hash;
            cmd.Parameters.Add("@id",SqlDbType.UniqueIdentifier).Value=id;
            return await cmd.ExecuteNonQueryAsync()==1 ? Results.Ok(new{updated=true}) : Results.NotFound();
        });
        group.MapPost("/{id:guid}/unlock",async(Guid id)=>
        {
            await using var db=new SqlConnection(connectionString); await db.OpenAsync();
            await using var cmd=new SqlCommand("UPDATE dbo.POS365_User SET FailedAttempts=0,LockedUntil=NULL,UpdatedUtc=SYSUTCDATETIME() WHERE UserId=@id",db);
            cmd.Parameters.Add("@id",SqlDbType.UniqueIdentifier).Value=id;
            return await cmd.ExecuteNonQueryAsync()==1 ? Results.Ok(new{unlocked=true}) : Results.NotFound();
        });
    }
}