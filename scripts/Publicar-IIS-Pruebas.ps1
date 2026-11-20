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
$webConfig = Join-Path $Destino 'web.config'
if (-not (Test-Path $webConfig)) { throw 'dotnet publish no genero web.config.' }
[xml]$config = Get-Content $webConfig -Raw
$asp = $config.configuration.'system.webServer'.aspNetCore
$asp.SetAttribute('hostingModel','inprocess')
$asp.SetAttribute('stdoutLogEnabled','false')
$envs = $config.CreateElement('environmentVariables')
$envItem = $config.CreateElement('environmentVariable')
$envItem.SetAttribute('name','ASPNETCORE_ENVIRONMENT')
$envItem.SetAttribute('value','IIS-Staging')
$envs.AppendChild($envItem) | Out-Null
$asp.AppendChild($envs) | Out-Null
$config.Save($webConfig)
Write-Host ('Publicado en '+$Destino)
Write-Host 'IMPORTANTE: IIS requiere Windows Authentication ACTIVADA y Anonymous Authentication DESACTIVADA.'
Write-Host 'Configure ConnectionStrings__Pos365 en el entorno del Application Pool (no en Git).'
Write-Host 'Restrinja el sitio a la LAN/VPN y pruebe /health/ready tras iniciar.'
