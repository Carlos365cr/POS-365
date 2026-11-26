using Microsoft.AspNetCore.DataProtection;
using System.Data;
using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Search;
using MailKit.Security;
using MimeKit;
using Microsoft.Data.SqlClient;

public static class PurchaseInboxApi
{
    public sealed record SearchInput(DateOnly From, DateOnly To, int Offset = 0, Guid? AccountId = null);
    static readonly SemaphoreSlim Gate = new(1,1);
    static XElement? Child(XElement? node,string name) =>
        node?.Elements().FirstOrDefault(e=>e.Name.LocalName==name);
    static string Value(XElement? node,string name) => Child(node,name)?.Value.Trim() ?? "";
    static string Required(string s,int max) =>
        s.Length>0 && s.Length<=max ? s : throw new FormatException("Campo XML requerido o demasiado largo.");
    static async Task<string> Store(string cs,byte[] bytes,string receiver,CancellationToken ct)
    {
        if(bytes.Length>5_000_000) throw new FormatException("XML demasiado grande.");
        using var stream=new MemoryStream(bytes);
        using var reader=XmlReader.Create(stream,new XmlReaderSettings{DtdProcessing=DtdProcessing.Prohibit,XmlResolver=null,MaxCharactersInDocument=5_000_000});
        var doc=XDocument.Load(reader);
        var root=doc.Root ?? throw new FormatException("XML vacio.");
        var type=root.Name.LocalName;
        if(type is not ("FacturaElectronica" or "TiqueteElectronico" or "NotaCreditoElectronica" or "NotaDebitoElectronica")) return "ignored";
        var key=Value(root,"Clave");
        if(!Regex.IsMatch(key,@"^[0-9]{50}$")) throw new FormatException("Clave invalida.");
        var em=Child(root,"Emisor"); var rec=Child(root,"Receptor");
        var supplier=Required(Value(Child(em,"Identificacion"),"Numero"),50);
        var target=Value(Child(rec,"Identificacion"),"Numero");
        if(target!=receiver) return "ignored";
        var name=Required(Value(em,"Nombre"),250);
        var date=DateTimeOffset.Parse(Value(root,"FechaEmision"),CultureInfo.InvariantCulture);
        var summary=Child(root,"ResumenFactura");
        var currency=Value(Child(summary,"CodigoTipoMoneda"),"CodigoMoneda");
        if(currency.Length==0) currency=Value(summary,"CodigoMoneda");
        if(currency.Length==0) currency="CRC";
        if(!Regex.IsMatch(currency,@"^[A-Z]{3}$")) throw new FormatException("Moneda invalida.");
        var total=decimal.Parse(Value(summary,"TotalComprobante"),NumberStyles.AllowDecimalPoint,CultureInfo.InvariantCulture);
        if(total<0 || decimal.Round(total,5)!=total) throw new FormatException("Total invalido.");
        var xml=doc.ToString(SaveOptions.DisableFormatting);
        var hash=SHA256.HashData(bytes);
        await using var db=new SqlConnection(cs); await db.OpenAsync(ct);
        await using var cmd=new SqlCommand("""
          INSERT dbo.POS365_PurchaseInbox(DocumentKey,DocumentType,SupplierId,SupplierName,ReceiverId,IssuedAt,Currency,Total,XmlContent,ContentHash)
          SELECT @key,@type,@supplier,@name,@receiver,@date,@currency,@total,@xml,@hash
          WHERE NOT EXISTS(SELECT 1 FROM dbo.POS365_PurchaseInbox WITH(UPDLOCK,HOLDLOCK) WHERE DocumentKey=@key);
          """,db);
        cmd.Parameters.Add("@key",SqlDbType.Char,50).Value=key;
        cmd.Parameters.Add("@type",SqlDbType.NVarChar,40).Value=type;
        cmd.Parameters.Add("@supplier",SqlDbType.NVarChar,50).Value=supplier;
        cmd.Parameters.Add("@name",SqlDbType.NVarChar,250).Value=name;
        cmd.Parameters.Add("@receiver",SqlDbType.NVarChar,50).Value=target;
        cmd.Parameters.Add("@date",SqlDbType.DateTimeOffset).Value=date;
        cmd.Parameters.Add("@currency",SqlDbType.Char,3).Value=currency;
        var p=cmd.Parameters.Add("@total",SqlDbType.Decimal);p.Precision=19;p.Scale=5;p.Value=total;
        cmd.Parameters.Add("@xml",SqlDbType.NVarChar,-1).Value=xml;
        cmd.Parameters.Add("@hash",SqlDbType.Binary,32).Value=hash;
        return await cmd.ExecuteNonQueryAsync(ct)==1?"inserted":"duplicate";
    }
    static IEnumerable<byte[]> XmlParts(MimeMessage message)
    {
        foreach(var part in message.BodyParts.OfType<MimePart>())
        {
            var name=part.FileName??"";
            if(!name.EndsWith(".xml",StringComparison.OrdinalIgnoreCase) && !name.EndsWith(".zip",StringComparison.OrdinalIgnoreCase)) continue;
            using var ms=new MemoryStream();part.Content.DecodeTo(ms);
            if(ms.Length>15_000_000) continue;
            if(name.EndsWith(".xml",StringComparison.OrdinalIgnoreCase)){yield return ms.ToArray();continue;}
            ms.Position=0;
            using var zip=new ZipArchive(ms,ZipArchiveMode.Read);
            if(zip.Entries.Count>100) continue;
            long expanded=0;
            foreach(var entry in zip.Entries)
            {
                if(!entry.Name.EndsWith(".xml",StringComparison.OrdinalIgnoreCase)) continue;
                expanded+=entry.Length;
                if(entry.Length>5_000_000 || expanded>20_000_000) break;
                using var input=entry.Open();using var output=new MemoryStream();input.CopyTo(output);
                yield return output.ToArray();
            }
        }
    }
    public sealed record MailAccountInput(string Email,string Password,string ReceiverId);
    static bool ValidAccount(MailAccountInput a) =>
        a.Email is {Length: > 0 and <= 254} && Regex.IsMatch(a.Email,@"^[^\s@]+@[^\s@]+\.[^\s@]+$") &&
        a.Password is {Length: > 0 and <= 128} &&
        Regex.IsMatch(a.Password.Replace(" ",""),@"^[a-zA-Z0-9]{16}$") &&
        a.ReceiverId is {Length: > 0 and <= 50} && Regex.IsMatch(a.ReceiverId,@"^[0-9]+$");
    static async Task CheckMail(MailAccountInput a,CancellationToken ct)
    {
        using var client=new ImapClient();client.Timeout=15000;
        await client.ConnectAsync("imap.gmail.com",993,SecureSocketOptions.SslOnConnect,ct);
        await client.AuthenticateAsync(a.Email.Trim(),a.Password.Replace(" ",""),ct);
        await client.Inbox.OpenAsync(FolderAccess.ReadOnly,ct);
        await client.DisconnectAsync(true,ct);
    }
    static void MapAccounts(RouteGroupBuilder group,WebApplication app,string cs)
    {
        var protector=app.Services.GetRequiredService<IDataProtectionProvider>().CreateProtector("POS365.PurchaseMail.v1");
        group.MapGet("/accounts",async(CancellationToken ct)=>{
            await using var db=new SqlConnection(cs);await db.OpenAsync(ct);
            await using var cmd=new SqlCommand("SELECT AccountId,Email,ReceiverId FROM dbo.POS365_MailAccount ORDER BY Email",db);
            await using var rd=await cmd.ExecuteReaderAsync(ct);var rows=new List<object>();
            while(await rd.ReadAsync(ct))rows.Add(new {id=rd.GetGuid(0),email=rd.GetString(1),receiverId=rd.GetString(2)});
            return Results.Ok(rows);
        });
        group.MapPost("/accounts/test",async(HttpContext ctx,MailAccountInput input,CancellationToken ct)=>{
            if(!ctx.Request.IsHttps)return Results.StatusCode(426);
            if(!ValidAccount(input))return Results.BadRequest(new{error="Revise correo, contraseña de aplicación de 16 caracteres y cédula."});
            try{await CheckMail(input,ct);return Results.Ok(new{ok=true});}
            catch(Exception e) when(e is not OperationCanceledException){return Results.BadRequest(new{error="No se pudo autenticar en Gmail o abrir el buzón."});}
        });
        group.MapPost("/accounts",async(HttpContext ctx,MailAccountInput input,CancellationToken ct)=>{
            if(!ctx.Request.IsHttps)return Results.StatusCode(426);
            if(!ValidAccount(input))return Results.BadRequest(new{error="Datos de correo inválidos."});
            if(string.IsNullOrWhiteSpace(app.Configuration["DataProtection:KeyPath"]))return Results.Problem("Configure la carpeta permanente de claves antes de guardar cuentas.",statusCode:503);
            try{await CheckMail(input,ct);}
            catch(Exception e) when(e is not OperationCanceledException){return Results.BadRequest(new{error="No se guardó: Gmail no aceptó la conexión."});}
            await using var db=new SqlConnection(cs);await db.OpenAsync(ct);
            await using var cmd=new SqlCommand("""
                INSERT dbo.POS365_MailAccount(AccountId,Email,ProtectedPassword,ReceiverId)
                VALUES(NEWID(),@e,@p,@r)
                """,db);
            cmd.Parameters.Add("@e",SqlDbType.NVarChar,254).Value=input.Email.Trim().ToLowerInvariant();
            cmd.Parameters.Add("@p",SqlDbType.NVarChar,-1).Value=protector.Protect(input.Password.Replace(" ",""));
            cmd.Parameters.Add("@r",SqlDbType.NVarChar,50).Value=input.ReceiverId;
            try{await cmd.ExecuteNonQueryAsync(ct);return Results.Ok(new{ok=true});}
            catch(SqlException e) when(e.Number is 2601 or 2627){return Results.Conflict(new{error="La cuenta ya existe. Quite la anterior para cambiar la clave."});}
        });
        group.MapDelete("/accounts/{id:guid}",async(HttpContext ctx,Guid id,CancellationToken ct)=>{
            if(!ctx.Request.IsHttps)return Results.StatusCode(426);
            await using var db=new SqlConnection(cs);await db.OpenAsync(ct);
            await using var cmd=new SqlCommand("DELETE dbo.POS365_MailAccount WHERE AccountId=@id",db);
            cmd.Parameters.Add("@id",SqlDbType.UniqueIdentifier).Value=id;
            return await cmd.ExecuteNonQueryAsync(ct)==1?Results.Ok(new{ok=true}):Results.NotFound();
        });
    }
    public static void Map(WebApplication app,string cs)
    {
        var group=app.MapGroup("/api/purchases/inbox").RequireAuthorization(p=>p.RequireRole("Admin"));
        group.AddEndpointFilter(async (context,next)=>{
            if(!context.HttpContext.Request.IsHttps)
                return Results.Json(new {error="Utilice HTTPS para administrar cuentas y consultar comprobantes de compras."},statusCode:426);
            return await next(context);
        });
        MapAccounts(group,app,cs);
        group.MapGet("/",async(CancellationToken ct)=>{
            await using var db=new SqlConnection(cs);await db.OpenAsync(ct);
            await using var cmd=new SqlCommand("SELECT TOP(500) DocumentKey,DocumentType,SupplierId,SupplierName,IssuedAt,Currency,Total,Status FROM dbo.POS365_PurchaseInbox ORDER BY ReceivedAt DESC",db);
            await using var rd=await cmd.ExecuteReaderAsync(ct);var rows=new List<object>();
            while(await rd.ReadAsync(ct)) rows.Add(new {key=rd.GetString(0),type=rd.GetString(1),supplierId=rd.GetString(2),supplier=rd.GetString(3),date=rd.GetDateTimeOffset(4),currency=rd.GetString(5),total=rd.GetDecimal(6),status=rd.GetString(7)});
            return Results.Ok(rows);
        });
        group.MapPost("/search",async(SearchInput input,CancellationToken ct)=>{
            if(input.From>input.To || input.To.DayNumber-input.From.DayNumber>31 || input.Offset<0 || input.To==DateOnly.MaxValue)
                return Results.BadRequest(new {error="Rango maximo de 32 dias y offset no negativo."});
            var cfg=app.Configuration.GetSection("PurchaseMail");
            var host=cfg["Host"];var user=cfg["Username"];var secret=cfg["Password"];var receiver=cfg["ReceiverId"];
            if(input.AccountId is Guid accountId)
            {
                await using var db=new SqlConnection(cs);await db.OpenAsync(ct);
                await using var cmd=new SqlCommand("SELECT Email,ProtectedPassword,ReceiverId FROM dbo.POS365_MailAccount WHERE AccountId=@id",db);
                cmd.Parameters.Add("@id",SqlDbType.UniqueIdentifier).Value=accountId;
                await using var rd=await cmd.ExecuteReaderAsync(ct);
                if(!await rd.ReadAsync(ct))return Results.NotFound(new{error="Cuenta no encontrada."});
                host="imap.gmail.com";user=rd.GetString(0);receiver=rd.GetString(2);
                try{secret=app.Services.GetRequiredService<IDataProtectionProvider>().CreateProtector("POS365.PurchaseMail.v1").Unprotect(rd.GetString(1));}
                catch(CryptographicException){return Results.Problem("No se pudo descifrar la cuenta. Revise las claves de protección del servidor.",statusCode:503);}
            }
            if(new[]{host,user,secret,receiver}.Any(string.IsNullOrWhiteSpace))
                return Results.BadRequest(new {error="Configure PurchaseMail en el archivo privado del servidor."});
            if(!await Gate.WaitAsync(0,ct)) return Results.Conflict(new {error="Ya hay una consulta en proceso."});
            try
            {
                using var client=new ImapClient();client.Timeout=30000;
                await client.ConnectAsync(host!,993,SecureSocketOptions.SslOnConnect,ct);
                await client.AuthenticateAsync(user!,secret!,ct);
                var folder=client.Inbox;await folder.OpenAsync(FolderAccess.ReadOnly,ct);
                var ids=await folder.SearchAsync(SearchQuery.DeliveredAfter(input.From.ToDateTime(TimeOnly.MinValue)).And(SearchQuery.DeliveredBefore(input.To.AddDays(1).ToDateTime(TimeOnly.MinValue))),ct);
                int inserted=0,duplicate=0,ignored=0,errors=0,processed=0;
                foreach(var uid in ids.Skip(input.Offset).Take(20))
                {
                    try
                    {
                        var summaries=await folder.FetchAsync(new[]{uid},MessageSummaryItems.Size,ct);
                        if(summaries.Count==0 || summaries[0].Size>15_000_000){errors++;processed++;continue;}
                        var message=await folder.GetMessageAsync(uid,ct);
                        foreach(var bytes in XmlParts(message))
                        {
                            try{switch(await Store(cs,bytes,receiver!,ct)){case "inserted":inserted++;break;case "duplicate":duplicate++;break;default:ignored++;break;}}
                            catch(Exception ex) when(ex is FormatException or XmlException or InvalidDataException or OverflowException){errors++;}
                        }
                    }
                    catch(InvalidDataException){errors++;}
                    processed++;
                }
                await client.DisconnectAsync(true,ct);
                return Results.Ok(new {inserted,duplicate,ignored,errors,processed,nextOffset=input.Offset+processed,remaining=Math.Max(0,ids.Count-input.Offset-processed)});
            }
            catch(Exception ex) when(ex is not OperationCanceledException)
            {
                app.Logger.LogWarning("Recepcion IMAP/SQL fallo: {Type}",ex.GetType().Name);
                return Results.Problem("No se completo la consulta. Revise IMAP, credenciales y migracion SQL 007. Los XML ya guardados no se duplican.",statusCode:502);
            }
            finally{Gate.Release();}
        });
    }
}
