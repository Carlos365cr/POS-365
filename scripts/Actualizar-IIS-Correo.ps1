param([string]$Sitio='POS365',[string]$Destino='C:\inetpub\POS365')
$ErrorActionPreference='Stop'
Import-Module WebAdministration
$root=Split-Path $PSScriptRoot -Parent
$siteObject=Get-Website -Name $Sitio
if (-not $siteObject) { throw 'Sitio IIS no encontrado.' }
if ([IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($siteObject.physicalPath)).TrimEnd('\') -ne [IO.Path]::GetFullPath($Destino).TrimEnd('\')) { throw 'El destino no coincide con el sitio IIS.' }
$pool=$siteObject.applicationPool
$settings=Join-Path $Destino 'appsettings.IIS-Staging.json'
if (-not (Test-Path $settings)) { throw 'No existe configuracion SQL privada del sitio.' }
$cfg=Get-Content $settings -Raw | ConvertFrom-Json
$cs=$cfg.ConnectionStrings.Pos365
if (-not $cs) { throw 'Falta ConnectionStrings:Pos365.' }
$keys=Join-Path $env:ProgramData ('POS365\'+$Sitio+'\Keys')
New-Item -ItemType Directory -Path $keys -Force | Out-Null
$identity=(Get-Item "IIS:\AppPools\$pool").processModel.identityType
if ($identity.ToString() -ne 'ApplicationPoolIdentity') { throw 'Configure manualmente permisos de claves para la identidad personalizada del pool.' }
& icacls $keys /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' ("IIS AppPool\"+$pool+':(OI)(CI)M') | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron establecer permisos de claves.' }
$cfg | Add-Member -NotePropertyName DataProtection -NotePropertyValue ([pscustomobject]@{KeyPath=$keys}) -Force
# Validate before interrupting the running site.
& py -3 -X utf8 (Join-Path $root 'scripts\build-local-pos.py')
if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar interfaz.' }
& dotnet build (Join-Path $root 'src\POS365.Local\POS365.Local.csproj') -c Release
if ($LASTEXITCODE -ne 0) { throw 'Error de compilacion. IIS no se ha detenido.' }
# Apply only the idempotent migration to the existing development database.
$db=New-Object System.Data.SqlClient.SqlConnection
$db.ConnectionString=$cs
try {
 $db.Open()
 $cmd=$db.CreateCommand()
 $cmd.CommandText=Get-Content (Join-Path $root 'sql\008_mail_accounts.sql') -Raw
 $cmd.CommandTimeout=120
 [void]$cmd.ExecuteNonQuery()
} finally { $db.Dispose() }
$backup=Join-Path $env:ProgramData ('POS365\'+$Sitio+'\Backups\'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
& icacls $backup /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No se pudo proteger respaldo.' }
Stop-WebAppPool -Name $pool
try {
 Copy-Item (Join-Path $Destino '*') $backup -Recurse -Force
 [IO.File]::WriteAllText($settings,($cfg | ConvertTo-Json -Depth 20),(New-Object Text.UTF8Encoding($false)))
 & (Join-Path $root 'scripts\Publicar-IIS-Pruebas.ps1') -Destino $Destino -AllowHttpTests
 Write-Host ('Respaldo de publicacion: '+$backup)
} catch {
 Write-Warning ('Error de publicacion. Respaldo: '+$backup)
 throw
} finally {
 Start-WebAppPool -Name $pool
}
Write-Host 'Para cuentas Gmail y XML utilice HTTPS con certificado valido. HTTP solo para pruebas sin datos reales.'
