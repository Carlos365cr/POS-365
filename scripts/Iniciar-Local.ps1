param(
    [string]$Servidor = 'SERVER360',
    [string]$Usuario = 'sa',
    [switch]$WindowsAuth,
    [switch]$Inicializar,
    [switch]$CrearAdministrador,
    [switch]$RestablecerAdministrador,
    [string]$UsuarioPOS365 = "pos365"
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$project = Join-Path $root 'src\POS365.Local\POS365.Local.csproj'
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Instale el SDK .NET 10.' }
$connection = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$connection['Data Source'] = $Servidor
$connection['Initial Catalog'] = 'POS365_DEV'
$connection['Encrypt'] = $true
$connection['TrustServerCertificate'] = $true # Solo desarrollo con certificado local.
$connection['Integrated Security'] = [bool]$WindowsAuth
if (-not $WindowsAuth) {
    $connection['User ID'] = $Usuario
    $secret = Read-Host 'Contrasena SQL (no se guarda en archivos)' -AsSecureString
    $credential = New-Object System.Net.NetworkCredential('', $secret)
    $connection['Password'] = $credential.Password
}
$previousConnection = $env:ConnectionStrings__Pos365
$previousEnvironment = $env:ASPNETCORE_ENVIRONMENT
try {
    $env:ConnectionStrings__Pos365 = $connection.get_ConnectionString()
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    & py -3 -X utf8 (Join-Path $root 'scripts\build-local-pos.py')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el POS original. Verifique Python 3.' }
    & dotnet build $project -c Debug
    if ($LASTEXITCODE -ne 0) { throw 'La compilacion fallo.' }
    if ($Inicializar) {
        & dotnet run --project $project --no-build --no-launch-profile -- --initialize-db
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo inicializar POS365_DEV. Revise el error SQL mostrado arriba (version, esquema, conexion o permisos).' }
    }
    if ($RestablecerAdministrador) {
        & dotnet run --project $project --no-build --no-launch-profile -- --reset-admin-password $UsuarioPOS365
        if ($LASTEXITCODE -ne 0) { throw "No se pudo restablecer la contrasena del administrador POS365." }
        return
    }
    if ($CrearAdministrador) {
        & dotnet run --project $project --no-build --no-launch-profile -- --setup-admin
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el administrador inicial. Revise el error mostrado.' }
        return
    }
    Write-Host 'Abra http://127.0.0.1:5085 . Para detener: Ctrl+C.'
    & dotnet run --project $project --no-build --no-launch-profile
    if ($LASTEXITCODE -ne 0) { throw 'La API termino con error.' }
} finally {
    $env:ConnectionStrings__Pos365 = $previousConnection
    $env:ASPNETCORE_ENVIRONMENT = $previousEnvironment
    $connection.Clear()
    $credential = $null
    if ($secret) { $secret.Dispose() }
}
