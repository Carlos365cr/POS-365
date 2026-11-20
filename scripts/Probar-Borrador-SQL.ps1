param([string]$Codigo = 'P1')
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:5085'
Write-Host 'Consultando articulo SQL:' $Codigo
$product = Invoke-RestMethod "$base/api/pos/product?code=$([uri]::EscapeDataString($Codigo))&list=0"
if (-not $product.id -or $null -eq $product.price) { throw 'Articulo o precio no encontrado.' }
Write-Host ('Producto: {0} / Precio: {1} {2}' -f $product.name,$product.price,$product.currency)
# ASCII-safe for Windows PowerShell 5.1, which reads UTF-8 without BOM as ANSI.
$colonCurrency = 'Col' + [char]0x00F3 + 'n'
if ($product.currency -cne $colonCurrency) { throw ('Moneda inesperada: [' + $product.currency + ']. Solo pruebas en colones.') }

# El impuesto cero es intencional: esta prueba comprueba persistencia SQL,
# no calcula impuestos de Hacienda ni registra un comprobante fiscal.
$requestId = [guid]::NewGuid().ToString()
$payload = @{
  requestId = $requestId
  registerCode = 'Caja-DEV'
  expectedTotal = [decimal]$product.price
  lines = @(@{ productId = $product.id; quantity = 1; tax = $null })
  payments = @(@{ method = 'EFECTIVO-PRUEBA'; amount = [decimal]$product.price })
} | ConvertTo-Json -Depth 8
Write-Host 'Creando borrador de desarrollo (NO una factura)...'
$first = Invoke-RestMethod "$base/api/pos/drafts" -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($payload))
Write-Host ('Borrador: {0} / Estado: {1} / Total: {2}' -f $first.draftId,$first.status,$first.total)
Write-Host 'Repitiendo la misma solicitud para verificar idempotencia...'
$second = Invoke-RestMethod "$base/api/pos/drafts" -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($payload))
if ($second.draftId -ne $first.draftId -or $second.alreadySaved -ne $true) {
  throw 'FALLO: el reintento no devolvio el mismo borrador.'
}
Write-Host 'OK: mismo borrador confirmado; no se duplico la solicitud.'
Write-Host 'Comprobacion adicional en SSMS:'
Write-Host ('SELECT * FROM dbo.POS365_Sale WHERE SaleId = ''' + $first.draftId + ''';')
