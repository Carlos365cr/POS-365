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

## Etapa 2: catalogo relacional

Ejecute otra vez `scripts/Iniciar-Local.ps1 -Inicializar` para aplicar la version 2.
El diagnostico exige ahora schemaVersion >= 2. Abra `/catalogo.html` desde el enlace
Articulos y precios. Puede crear, buscar por nombre/codigo/barras, editar y gestionar
listas 0 a 99. Un precio vacio se guarda como NULL; cero se conserva como cero.
Se permiten hasta cuatro decimales, sin redondeo silencioso. Los ceros iniciales de
codigos se conservan. CABYS se valida por formato; no se comprueba aun contra el
catalogo oficial. Incluye IVA es informacion del articulo, no un calculo fiscal.

Las tablas Product, ProductIdentifier y ProductPrice son la fuente del catalogo local.
Cada guardado de articulo y listas se confirma en una transaccion. Un token rowversion
impide sobrescribir cambios de otro editor: si aparece conflicto, cierre el editor y
vuelva a abrir el articulo para revisar los datos actuales. No se implementa borrado.

El importador acepta el JSON original `cedi-trial-backup`, snapshot version 1, hasta
5000 articulos (products y xmlPendingArticles) y 20 MB desde la pantalla. Primero
revise el archivo y despues confirme. Todo el lote se confirma o se revierte; no
sobrescribe codigos ya existentes. El mismo contenido JSON ya importado se reconoce
por SHA-256. Si el archivo cambia de formato/espacios se revisa de nuevo y los codigos
existentes bloquean una duplicacion. La restriccion unica SQL resuelve tambien carreras
entre importaciones o editores simultaneos.

Se importan precios listaN_precio/listaN_moneda, precio principal, moneda, CABYS,
indicador IVA y codigos. Los demas campos se conservan en SourceJson como copia
inmutable del articulo original, NO como datos operativos de costos, promociones,
fotos ni existencias. La pantalla nueva no aplica promociones ni reglas de redondeo
de la facturacion antigua. No usarla para operar cajas. No se ha enlazado aun el
catalogo con la interfaz original ni con el servicio de sincronizacion.

Prueba local: crear un articulo, guardarlo con dos listas y un codigo alterno;
cerrar y reiniciar la API y buscarlo por ese codigo. Abrir el mismo articulo en dos
pestanas: guardar en una y verificar que la otra recibe conflicto. Probar un codigo
duplicado y verificar que se conserva el articulo anterior. Importar solo un respaldo
de pruebas y comprobar el conteo; repetir el archivo no debe duplicar productos.

Validaciones automatizadas sin SQL:
`dotnet run --project tests/CatalogValidation`
La compilacion y estas pruebas no sustituyen la validacion real del esquema, transacciones
e importacion sobre SERVER360. No se han ejecutado desde el entorno del desarrollador
contra ese servidor.

## POS original: consulta SQL (desarrollo)

El arranque genera `wwwroot/pos-original.html` desde `work/cedi-current-inner.html`
mediante `scripts/build-local-pos.py`. Se conserva el frontend original; no es la
caja simplificada de prueba. Los puntos de adaptacion se verifican para detener la
generacion si cambia la fuente original. No se modifica el paquete Cloudflare.

Abrir `/pos-original.html`. Codigo/barras y busqueda usan la API local (lista 0).
La busqueda devuelve hasta 50 coincidencias; refinar el texto si hay mas. Al seleccionar
se consulta otra vez el precio SQL. La validacion original requiere CABYS con tarifa
definida; no inventar una tasa para articulos de prueba sin CABYS. Solo colones.
No se cargan los metadatos historicos como promociones o costos activos.

El detalle permanece temporal. Se bloquea la confirmacion del cobro y la persistencia
del estado original, y se deshabilita la navegacion a modulos no migrados. No se leen
respaldos locales antiguos. No usar para ventas reales. Se conserva la logica visual
y calculos originales, incluido redondeo; no constituye una validacion fiscal.

La generacion y sintaxis JavaScript fueron verificadas. Falta validar interaccion
completa en navegador y contra SERVER360. El navegador automatizado del entorno
no pudo arrancar por restricciones del sistema.

## Etapa 3: estructura relacional de ventas (sin guardar facturas todavía)

Ejecute `scripts/Iniciar-Local.ps1 -Inicializar` para aplicar la migración 3.
`/health/ready` exige ahora `schemaVersion >= 3`.

La migración crea `POS365_Sale`, `POS365_SaleLine` y
`POS365_SalePayment` para documentar encabezados, renglones y pagos.
Incluye claves foráneas al producto y a la sucursal, RequestId único
para idempotencia futura, importes decimales y restricciones de integridad.
Por ahora son tablas preparatorias: **no existe API de guardado de ventas**
ni asignación definitiva de consecutivos, impuestos fiscales, descuentos,
inventario o anulación. No escribir registros manualmente ni usarlas
para facturación real. El botón de cobro se mantiene inoperativo.

Comprobar el esquema en SSMS:
```sql
USE POS365_DEV;
SELECT Version,AppliedAt FROM dbo.POS365_SchemaVersion ORDER BY Version;
SELECT name FROM sys.tables WHERE name IN
('POS365_Sale','POS365_SaleLine','POS365_SalePayment');
SELECT COUNT_BIG(*) AS Ventas FROM dbo.POS365_Sale;
```
La consulta de ventas debe devolver cero en una base que no haya recibido
intervenciones manuales. Volver a inicializar debe ser idempotente.
El paso siguiente es desarrollar el servicio de confirmación atómica,
con validación del catálogo y precios en servidor, cálculo fiscal,
numeración, pagos, existencias e idempotencia. No confiar en totales
calculados por el navegador.
