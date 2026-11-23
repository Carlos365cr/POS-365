# POS365 – publicación IIS para pruebas internas

Esta configuración es **exclusivamente para pruebas en LAN/VPN**. No abrir a Internet durante pruebas: ya existe autenticación SQL por cookie y roles de administrador, pero aún faltan pruebas completas, auditoría y módulos de venta/inventario.

## Requisitos del servidor
- IIS con autenticación anónima habilitada y autenticación de Windows deshabilitada: el inicio de sesión de POS365 se gestiona mediante SQL Server y cookies.
- .NET **10 Hosting Bundle** instalado después de IIS, o reparar el Bundle si IIS se instaló después.
- SQL Server disponible con base **POS365_DEV** y esquema versión 6 (migración 006_auth.sql aplicada).
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
2. Crear sitio `POS365-Pruebas` con ruta física `C:\inetpub\POS365-Pruebas`, pool anterior, binding **solo LAN/VPN con HTTPS obligatorio** y certificado válido.
3. Authentication del sitio: **Anonymous Authentication habilitada** y **Windows Authentication deshabilitada**. POS365 exige login propio en /login antes de mostrar cualquier módulo.
4. Restringir acceso con Firewall a LAN/VPN (no exponer públicamente).
5. Dar permiso de lectura/ejecución al usuario del Application Pool en la carpeta publicada. Nunca usar identidad administrativa para el pool.
6. Configurar `ConnectionStrings:Pos365` en `appsettings.IIS-Staging.json` privado en el directorio publicado, con catálogo POS365_DEV, credenciales SQL de mínimo privilegio y ACL restringida. No subir secretos a Git.
7. Reciclar el pool y abrir `https://servidor/login`. Iniciar sesión con un usuario de `dbo.POS365_User`. Sin iniciar sesión, `/pos-original.html`, `/` y `/api/catalog/products` deben redirigir a `/login` o devolver HTTP 401 según el tipo de solicitud. Después del login, `/health/ready` debe mostrar schemaVersion >= 6.
8. Verificar que la API rechace peticiones anónimas. Si devuelve 500.30, revisar Event Viewer / ASP.NET Core Module y la conexión SQL.

La publicación **no ejecuta migraciones SQL** ni habilita operaciones de facturación aún pendientes. No confundir con producción.

## Desarrollo local
`scripts/Iniciar-Local.ps1` continúa funcionando exactamente igual en `http://127.0.0.1:5085`. No modificar rama `main`.
