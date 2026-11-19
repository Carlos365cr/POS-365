using System.Text.Json;
int passed=0;
void Check(bool condition,string name){if(!condition)throw new Exception(name);passed++;Console.WriteLine("OK "+name);}
void Reject(Action action,string name){try{action();}catch(ArgumentException){passed++;Console.WriteLine("OK "+name);return;}throw new Exception("Accepted: "+name);}
CatalogProduct Sample()=>new(Guid.NewGuid(),"0001","012345","Arroz","",true,["0001","012345","ALT"],[new(0,123.4567m,"Colón")],null,null);
var p=CatalogValidation.Normalize(Sample());
Check(p.Code=="0001"&&p.Barcode=="012345"&&p.Codes.Length==3,"Leading zeros and identifier deduplication");
Reject(()=>CatalogValidation.Normalize(Sample() with {Code=""}),"Required code");
Reject(()=>CatalogValidation.Normalize(Sample() with {Cabys="ABC"}),"CABYS shape");
Reject(()=>CatalogValidation.Normalize(Sample() with {Prices=[new(0,-1,"Colón")]}),"Negative price");
Reject(()=>CatalogValidation.Normalize(Sample() with {Prices=[new(0,.00001m,"Colón")]}),"No silent decimal rounding");
Reject(()=>CatalogValidation.Normalize(Sample() with {Prices=[new(1,1,"Colón")]}),"Primary list required");
Reject(()=>CatalogValidation.Normalize(Sample() with {Prices=[new(0,1,"Colón"),new(0,2,"Colón")]}),"Duplicate lists");
Reject(()=>CatalogValidation.Normalize(Sample() with {Version="not-base64"}),"Invalid concurrency token");
Reject(()=>CatalogValidation.Normalize(Sample() with {Prices=[new(0,1,"unknown")]}),"Unknown currency");
Check(CatalogValidation.Normalize(Sample() with {Prices=[new(0,null,"Colón")]}).Prices[0].Amount is null,"Missing price remains null");
Check(CatalogValidation.Normalize(Sample() with {Prices=[new(0,0,"Colón")]}).Prices[0].Amount==0,"Zero price remains zero");
string product="""{"code":"0002","barcode":"00123","name":"Importado","price":12.50,"currency":"Colón","includesVAT":true,"codes":["ALT2"],"details":{"prices":[["lista0_precio","12.50",null],["lista1_precio","15.25",null],["lista1_moneda","Dólar",null]],"costs":[["custom","keep",null]]}}""";
JsonElement Backup(string products)=>JsonSerializer.Deserialize<JsonElement>("{\"format\":\"cedi-trial-backup\",\"snapshot\":{\"version\":1,\"products\":["+products+"]}}");
var imported=CatalogValidation.ReadBackup(Backup(product))[0];
Check(imported.Prices.Length==2&&imported.Prices[1].Currency=="Dólar"&&imported.Prices[1].Amount==15.25m,"Import additional price lists");
Check(imported.Source!.Value.GetProperty("details").GetProperty("costs")[0][1].GetString()=="keep","Preserve original noncatalog fields");
Reject(()=>CatalogValidation.ReadBackup(Backup(product+","+product)),"Cross-product duplicate identifiers");
Reject(()=>CatalogValidation.ReadBackup(Backup(product.Replace("\"price\":12.50","\"price\":99"))),"Conflicting primary prices");
Reject(()=>CatalogValidation.ReadBackup(JsonSerializer.Deserialize<JsonElement>("{}")),"Unsupported backup format");
Console.WriteLine($"{passed} checks passed.");
