# POS365: desarrollo local con SQL Server

Esta rama agrega una API .NET 10 y un panel local para comprobar SQL Server.
No convierte aun la interfaz Cloudflare en un POS operativo sobre SQL Server.
No usar en cajas ni publicar en IIS de produccion.

## Primera ejecucion (PowerShell)

```powershell
Set-Location C:\proyectos\POS365
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Iniciar-Local.ps1 -Inicializar
```

El script solicita la contrasena sin mostrarla, compila y crea POS365_DEV si no existe.
Aplica un esquema versionado en transaccion sin borrar datos. Para crear la base se
necesitan permisos de creacion; si ya existe, bastan los permisos necesarios de DDL.
El servidor predeterminado es SERVER360 y el usuario inicial es sa; se puede cambiar
con -Servidor y -Usuario, o utilizar -WindowsAuth. No se guardan credenciales en Git.
La variable de entorno de conexion se restaura al salir. Las variables de entorno
no son un almacen cifrado; usar un usuario SQL exclusivo para desarrollo.

Abra http://127.0.0.1:5085 y pulse Comprobar conexion. Debe informar schemaVersion=1.
En ejecuciones posteriores puede omitir -Inicializar. Ctrl+C detiene la API.
Para actualizar: detener, git pull --ff-only y volver a ejecutar el script.

## Alcance real

- API limitada a loopback y entorno Development; no incorpora autenticacion de negocio.
- Esquema inicial: versiones, sucursales, bandeja de eventos salientes y recibidos.
- No hay aun productor/consumidor de sincronizacion ni migracion de datos D1.
- /health/live comprueba el proceso; /health/ready verifica conexion y esquema.
- Las rutas /api/* no implementadas devuelven 501, nunca simulan ventas exitosas.
- El build de Cloudflare permanece intacto. La carpeta salida no se sirve desde esta API.

## Migracion pendiente

La interfaz usa /api/state, /api/parts y /api/save para instantaneas compartidas.
Tambien existen autenticacion, cajeros, cierres, avisos, lotes, comprobantes internos,
analisis de ventas, Gmail y compras heredadas. Cada contrato debe migrarse y probarse.
Proximas etapas: catalogo relacional y precios; ventas/pagos/inventario atomicos;
compras y gastos; autenticacion y permisos; importacion verificable del respaldo;
sincronizacion idempotente por sucursal; pruebas de desconexion y carga.
No importar instantaneas como sustituto del modelo transaccional definitivo.
El respaldo del negocio y las credenciales externas no estan incluidos en GitHub.

## Validacion en el servidor del usuario

Ejecutar inicializacion dos veces debe conservar los mismos objetos y version.
Comprobar /health/ready, detener SQL para confirmar respuesta 503, restaurar servicio
y comprobar recuperacion. Hacer estas pruebas solo sobre el entorno de desarrollo.
