# POS365 – publicación IIS para pruebas internas

Esta configuración es **exclusivamente para pruebas en LAN/VPN**. No abrir a Internet ni conectar Cloudflare Tunnel hasta implementar autenticación/roles por aplicación, auditoría y los módulos de venta/inventario.

## Requisitos del servidor
- IIS (Windows Authentication instalada y habilitada).
- .NET **10 Hosting Bundle** instalado después de IIS, o reparar el Bundle si IIS se instaló después.
- SQL Server disponible con base **POS365_DEV** y esquema versión 5.
- SDK .NET 10 y Python 3 en el equipo que compila (no imprescindibles en el servidor si se copian los archivos publicados).

## Compilar
```powershell
cd C:\proyectos\POS365
git switch desarrollo/sqlserver
git pull --ff-only origin desarrollo/sqlserver
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Publicar-IIS-Pruebas.ps1
```
Publica en `C:\inetpub\POS365-Pruebas` y genera `web.config` para `IIS-Staging`. Para publicar en otro equipo, copiar el contenido de esa carpeta al destino.

## Configurar IIS
1. Crear Application Pool `POS365-Pruebas`: **No Managed Code**, 64 bits habilitado.
2. Crear sitio `POS365-Pruebas` con ruta física `C:\inetpub\POS365-Pruebas`, pool anterior, binding **solo LAN** y preferiblemente HTTPS.
3. Authentication del sitio: **Windows Authentication habilitada** y **Anonymous Authentication deshabilitada**. Autorizar únicamente las cuentas de prueba; configurar autorización IIS por usuarios/grupos.
4. Restringir acceso con Firewall a LAN/VPN (no exponer públicamente).
5. Dar permiso de lectura/ejecución al usuario del Application Pool en la carpeta publicada. Nunca usar identidad administrativa para el pool.
6. Configurar variable `ConnectionStrings__Pos365` **en el entorno del Application Pool**, con servidor SQL y catálogo POS365_DEV, usando credencial SQL de mínimo privilegio o identidad de servicio Windows con acceso adecuado. No guardarla en Git ni en `web.config` controlado por código.
7. Reciclar el pool y comprobar `https://servidor/health/ready`, luego `/pos-original.html`. La autenticación Windows debe solicitase antes de mostrar datos.
8. Verificar que la API rechace peticiones anónimas. Si devuelve 500.30, revisar Event Viewer / ASP.NET Core Module y la conexión SQL.

La publicación **no ejecuta migraciones SQL** ni habilita operaciones de facturación aún pendientes. No confundir con producción.

## Desarrollo local
`scripts/Iniciar-Local.ps1` continúa funcionando exactamente igual en `http://127.0.0.1:5085`. No modificar rama `main`.
