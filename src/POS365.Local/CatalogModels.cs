using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

public sealed record CatalogPrice(int ListNumber, decimal? Amount, string Currency);
public sealed record CatalogProduct(Guid Id, string Code, string Barcode, string Name, string Cabys,
    bool IncludesVAT, string[] Codes, CatalogPrice[] Prices, string? Version, JsonElement? Source);
public sealed record CatalogImport(JsonElement Backup, bool Confirm);
public sealed class CatalogConflict(string message) : Exception(message);
public static class CatalogValidation
{
    public static CatalogProduct Normalize(CatalogProduct p)
    {
        string Text(string? value, int max, string field, bool required=false)
        {
            var s=(value??"").Trim();
            if ((required && s.Length==0) || s.Length>max || s.Any(char.IsControl))
                throw new ArgumentException($"{field}: valor vacio, demasiado largo o con caracteres de control.");
            return s;
        }
        var code=Text(p.Code,100,"Codigo",true);
        var barcode=Text(p.Barcode,100,"Barras");
        var name=Text(p.Name,250,"Nombre",true);
        var cabys=Text(p.Cabys,13,"CABYS");
        if(cabys.Length>0 && !Regex.IsMatch(cabys,@"^\d{13}$")) throw new ArgumentException("CABYS debe contener 13 digitos o estar vacio.");
        if(p.Id==Guid.Empty) throw new ArgumentException("Identificador de articulo requerido.");
        if(p.Codes is null || p.Codes.Length>100 || p.Prices is null || p.Prices.Length>100)
            throw new ArgumentException("Maximo 100 codigos y 100 listas por articulo.");
        var codes=p.Codes.Select(c=>Text(c,100,"Codigo adicional")).Append(code).Append(barcode)
            .Where(c=>c.Length>0).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if(p.Prices.Select(x=>x.ListNumber).Distinct().Count()!=p.Prices.Length || !p.Prices.Any(x=>x.ListNumber==0))
            throw new ArgumentException("Se requiere lista 0 y no se permiten listas repetidas.");
        foreach(var price in p.Prices)
        {
            if(price.ListNumber is <0 or >99 || price.Amount is <0 or >999999999999999.9999m ||
                (price.Amount is decimal a && decimal.Round(a,4)!=a))
                throw new ArgumentException("Precio invalido: use hasta 4 decimales y listas de 0 a 99.");
            if(price.Currency is not ("Colón" or "Dólar" or "Euro" or "Yen"))
                throw new ArgumentException("Moneda no reconocida. Use Colón, Dólar, Euro o Yen.");
        }
        if(p.Source is { } source && source.GetRawText().Length>2_000_000)
            throw new ArgumentException("Metadatos del articulo superan 2 MB.");
        if(p.Version is not null)
        {
            try { if(Convert.FromBase64String(p.Version).Length!=8) throw new FormatException(); }
            catch(FormatException) { throw new ArgumentException("Version de articulo invalida."); }
        }
        return p with {Code=code,Barcode=barcode,Name=name,Cabys=cabys,Codes=codes};
    }
    public static List<CatalogProduct> ReadBackup(JsonElement root)
    {
        if(!root.TryGetProperty("format",out var format) || format.GetString()!="cedi-trial-backup" ||
           !root.TryGetProperty("snapshot",out var snapshot) || !snapshot.TryGetProperty("version",out var version) || version.GetInt32()!=1)
            throw new ArgumentException("Seleccione un respaldo cedi-trial-backup version 1 exportado del sistema original.");
        var result=new List<CatalogProduct>();
        foreach(var section in new[]{"products","xmlPendingArticles"})
        {
            if(!snapshot.TryGetProperty(section,out var items)) { if(section=="products") throw new ArgumentException("Falta products en el respaldo."); continue; }
            if(items.ValueKind!=JsonValueKind.Array) throw new ArgumentException(section+" debe ser una lista.");
            foreach(var item in items.EnumerateArray())
            {
                string Str(string key,string fallback="")=>item.TryGetProperty(key,out var x)&&x.ValueKind==JsonValueKind.String?x.GetString()!:fallback;
                decimal? Money(JsonElement v)
                {
                    if(v.ValueKind==JsonValueKind.Null || (v.ValueKind==JsonValueKind.String && v.GetString()=="")) return null;
                    if(v.ValueKind==JsonValueKind.Number && v.TryGetDecimal(out var n)) return n;
                    if(v.ValueKind==JsonValueKind.String && decimal.TryParse(v.GetString(),NumberStyles.AllowDecimalPoint|NumberStyles.AllowLeadingSign,CultureInfo.InvariantCulture,out n)) return n;
                    throw new ArgumentException("Precio no reconocido en articulo "+Str("code"));
                }
                var currency=Str("currency","Colón");
                var prices=new Dictionary<int,CatalogPrice>();
                if(item.TryGetProperty("details",out var details)&&details.TryGetProperty("prices",out var fields)&&fields.ValueKind==JsonValueKind.Array)
                {
                    var values=new Dictionary<string,JsonElement>();
                    foreach(var f in fields.EnumerateArray()) if(f.ValueKind==JsonValueKind.Array&&f.GetArrayLength()>=2&&f[0].ValueKind==JsonValueKind.String) values[f[0].GetString()!]=f[1];
                    foreach(var entry in values)
                    {
                        var m=Regex.Match(entry.Key,@"^lista(\d+)_precio$"); if(!m.Success) continue;
                        if(!int.TryParse(m.Groups[1].Value,NumberStyles.None,CultureInfo.InvariantCulture,out int index) || index>99) throw new ArgumentException("Numero de lista fuera del rango 0 a 99.");
                        var cur=values.TryGetValue($"lista{index}_moneda",out var cv)&&cv.ValueKind==JsonValueKind.String?cv.GetString()!:currency;
                        prices[index]=new(index,Money(entry.Value),cur);
                    }
                }
                var topPrice=item.TryGetProperty("price",out var value)?Money(value):null;
                if(prices.TryGetValue(0,out var primary) && item.TryGetProperty("price",out _) && primary.Amount!=topPrice)
                    throw new ArgumentException("Precio principal y lista 0 difieren en "+Str("code")+". Corrija el respaldo antes de importar.");
                prices[0]=new(0,item.TryGetProperty("price",out _)?topPrice:prices.GetValueOrDefault(0)?.Amount,currency);
                var codes=item.TryGetProperty("codes",out var cc)&&cc.ValueKind==JsonValueKind.Array?cc.EnumerateArray().Select(x=>x.GetString()??"").ToArray():[];
                var vat=item.TryGetProperty("includesVAT",out var vv)?vv.GetBoolean():true;
                result.Add(Normalize(new(Guid.NewGuid(),Str("code"),Str("barcode"),Str("name"),Str("cabys"),vat,codes,prices.Values.OrderBy(x=>x.ListNumber).ToArray(),null,item.Clone())));
                if(result.Count>5000) throw new ArgumentException("Este importador de desarrollo admite hasta 5000 articulos por archivo.");
            }
        }
        var all=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach(var p in result) foreach(var code in p.Codes)
            if(!all.Add(code)) throw new ArgumentException("Codigo repetido entre articulos del respaldo: "+code);
        if(result.Count==0) throw new ArgumentException("El respaldo no contiene articulos.");
        return result;
    }
}
