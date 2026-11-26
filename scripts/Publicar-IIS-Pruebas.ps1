param(
    [string]$Destino = 'C:\inetpub\POS365-Pruebas',
    [switch]$AllowHttpTests
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$project = Join-Path $root 'src\POS365.Local\POS365.Local.csproj'
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Instale el SDK .NET 10.' }
if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw 'Instale Python 3 para generar la interfaz original.' }
& py -3 -X utf8 (Join-Path $root 'scripts\build-local-pos.py')
if ($LASTEXITCODE -ne 0) { throw 'Error generando la pantalla original.' }
& dotnet publish $project -c Release -o $Destino --self-contained false
if ($LASTEXITCODE -ne 0) { throw 'Error publicando POS365.' }
$logo = Join-Path $root 'plantilla\assets\pos-365-logo.png'
if (-not (Test-Path $logo)) { throw 'No se encontro el logotipo original.' }
$assets = Join-Path $Destino 'wwwroot\assets'
New-Item -ItemType Directory -Path $assets -Force | Out-Null
Copy-Item $logo (Join-Path $assets 'pos-365-logo.png') -Force
# Some publish environments generate a web.config without an aspNetCore node.
# Write the IIS configuration deterministically instead of editing missing XML nodes.
$dll = Join-Path $Destino 'POS365.Local.dll'
if (-not (Test-Path $dll)) { throw 'No se encontro POS365.Local.dll en la publicacion.' }
$webConfig = Join-Path $Destino 'web.config'
$xml = @'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" arguments=".\POS365.Local.dll" stdoutLogEnabled="false" hostingModel="inprocess">
        <environmentVariables>
          <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="IIS-Staging" />
        </environmentVariables>
      </aspNetCore>
    </system.webServer>
  </location>
</configuration>
'@
if ($AllowHttpTests) {
    $xml = $xml.Replace('</environmentVariables>', '<environmentVariable name="IisTesting__AllowHttp" value="true" /></environmentVariables>')
    Write-Warning 'HTTP sin cifrado: solo datos y credenciales desechables de pruebas; restrinja IP de origen.'
}
[xml]$validate = $xml
if ($validate.configuration.location.'system.webServer'.aspNetCore.hostingModel -ne 'inprocess') {
    throw 'La configuracion IIS generada es invalida.'
}
[System.IO.File]::WriteAllText($webConfig, $xml, (New-Object System.Text.UTF8Encoding($false)))
$settingsPath = Join-Path $Destino 'appsettings.IIS-Staging.json'
if (-not (Test-Path $settingsPath)) {
    $settingsTemplate = @'
{
  "ConnectionStrings": {
    "Pos365": "Server=SERVER360;Database=POS365_DEV;User Id=USUARIO_SQL;Password=CONTRASENA_SQL;Encrypt=True;TrustServerCertificate=True;"
  }
}
'@
    [System.IO.File]::WriteAllText($settingsPath, $settingsTemplate, (New-Object System.Text.UTF8Encoding($false)))
    Write-Warning ('Plantilla privada creada en '+$settingsPath+'. Edite las credenciales antes de iniciar IIS.')
} else {
    Write-Host ('Configuracion privada existente conservada: '+$settingsPath)
}
Write-Host 'web.config generado y validado para IIS-Staging.'
Write-Host ('Publicado en '+$Destino)
Write-Host 'IMPORTANTE: IIS requiere Anonymous Authentication ACTIVADA y Windows Authentication DESACTIVADA; POS365 valida usuarios con cookies y SQL Server.'
Write-Host 'Configure ConnectionStrings:Pos365 en appsettings.IIS-Staging.json (archivo privado, no versionado).'
if ($AllowHttpTests) { Write-Warning 'HTTP de pruebas habilitado. No utilice credenciales ni datos reales.' } else { Write-Host 'HTTPS obligatorio (HTTP devuelve 426).' }
