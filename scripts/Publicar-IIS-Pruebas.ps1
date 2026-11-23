param(
    [string]$Destino = 'C:\inetpub\POS365-Pruebas'
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
      <aspNetCore processPath="dotnet" arguments=".\\POS365.Local.dll" stdoutLogEnabled="false" hostingModel="inprocess">
        <environmentVariables>
          <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="IIS-Staging" />
        </environmentVariables>
      </aspNetCore>
    </system.webServer>
  </location>
</configuration>
'@
[xml]$validate = $xml
if ($validate.configuration.location.'system.webServer'.aspNetCore.hostingModel -ne 'inprocess') {
    throw 'La configuracion IIS generada es invalida.'
}
[System.IO.File]::WriteAllText($webConfig, $xml, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'web.config generado y validado para IIS-Staging.'
Write-Host ('Publicado en '+$Destino)
Write-Host 'IMPORTANTE: IIS requiere Windows Authentication ACTIVADA y Anonymous Authentication DESACTIVADA.'
Write-Host 'Configure ConnectionStrings__Pos365 en el entorno del Application Pool (no en Git).'
Write-Host 'Restrinja el sitio a la LAN/VPN y pruebe /health/ready tras iniciar.'
