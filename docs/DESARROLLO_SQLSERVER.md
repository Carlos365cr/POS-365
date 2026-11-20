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

## Etapa 3B: escritura de borradores de desarrollo

Se añadió `POST /api/pos/drafts` (exclusivamente loopback/Development). Recibe
un identificador único de solicitud, caja, artículos con cantidades e impuestos
declarados, pagos y total esperado. Consulta de nuevo los precios de la lista 0
en SQL y guarda encabezado, líneas y pagos en una única transacción serializable.
El reintento con el mismo RequestId devuelve el mismo borrador. Si el precio
cambió o los pagos no coinciden, se rechaza la transacción.

**Advertencia**: los impuestos del cliente no se verifican contra el CABYS
ni contra un catálogo tributario vigente. Los registros se guardan exclusivamente
con estado `Draft`, sin consecutivo fiscal, inventario, caja ni emisión electrónica.
No es apto para facturación ni cobros reales. El botón original **Guardar**
sigue sin estar conectado a la API.

Con el servidor local en marcha, en otra consola PowerShell:
```powershell
cd C:\proyectos\POS365
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Probar-Borrador-SQL.ps1 -Codigo P1
```
La prueba crea deliberadamente un borrador con impuesto 0 para validar solo la
persistencia (no el cálculo fiscal). Ejecutarla nuevamente crea otro borrador,
pero cada ejecución reintenta internamente el mismo RequestId para verificar
que esa solicitud no se duplique.

En SSMS:
```sql
USE POS365_DEV;
SELECT TOP 10 SaleId,RequestId,Status,Total,CreatedAt
FROM dbo.POS365_Sale ORDER BY CreatedAt DESC;
SELECT SaleId,LineNumber,Code,Quantity,UnitPrice,Total
FROM dbo.POS365_SaleLine ORDER BY SaleId,LineNumber;
SELECT SaleId,PaymentNumber,Method,Amount
FROM dbo.POS365_SalePayment ORDER BY SaleId,PaymentNumber;
```
Pendiente: integración con el formulario original, numeración definitiva,
validación de impuesto por CABYS, descuentos, cambio/vuelto, caja, existencias
y comprobantes.

## Etapa 3C: panel original de pago y borrador SQL

El generador local añade al panel original de pago un botón separado:
`Guardar borrador SQL (prueba)`. El botón original `Guardar` continúa
bloqueado: no existen todavía reglas completas de factura fiscal, cierre de caja
o inventario.

El botón de prueba toma los artículos SQL escaneados en la sesión, intenta
resolver sus cantidades del detalle original, compara el total original con
el total de la lista SQL 0 y solicita confirmación antes de llamar
`POST /api/pos/drafts`. Si no puede identificar un artículo, cantidad o
precio de forma inequívoca, cancela el registro. Se registra solo un pago
`EFECTIVO-PRUEBA` por el **total exacto**, nunca el efectivo entregado con
vuelto. Si vuelve a enviarse el mismo detalle en la misma sesión, conserva
el RequestId para impedir duplicados.

**Limitación de esta etapa:** para comprobar exclusivamente la escritura,
se registra impuesto de prueba igual a cero. Esto no coincide con el IVA
mostrado en la pantalla original y **no debe interpretarse como
facturación fiscal**. Tampoco se registran descuentos, múltiples pagos,
inventario o consecutivos. La discrepancia entre el total visual y el precio
SQL impide guardar un borrador. Solo usar productos simples, sin descuentos
ni promociones, y con cantidades enteras para esta prueba inicial.

Prueba de navegador a realizar en SERVER360: iniciar la API, abrir
`/pos-original.html`, buscar y agregar P1 una sola vez, abrir Pago con,
presionar `Guardar borrador SQL (prueba)` y confirmar. Revisar en SSMS
el estado `Draft`, las líneas y el pago de prueba. Repetir el mismo
botón sin cambiar el detalle: debe devolver el mismo identificador sin
duplicar. No fue posible verificar el navegador remoto desde el conector.

## Etapa 3D: conciliacion aritmetica de IVA declarado en borradores

La pantalla original ahora solicita expresamente el **IVA de prueba** al pulsar
`Guardar borrador SQL (prueba)`. No lo calcula automaticamente: el catalogo
relacional aun no tiene fuente validada para tarifas fiscales CABYS.
En esta etapa el boton admite **solo un renglon de articulo** para no distribuir
incorrectamente un IVA global entre productos. Valida que el impuesto no sea
negativo ni supere el total, y concilia subtotal + IVA = total. El identificador
de solicitud idempotente incluye el importe declarado, de modo que cambiarlo
constituye otra solicitud.

Prueba orientativa con P1 (precio ₡150 y sin descuentos):
- En la pantalla original, verificar que el IVA visual sea ₡17,26.
- Al pulsar el boton de borrador, escribir **17.26** en el campo de IVA de prueba.
- Confirmar que SQL guarde `Subtotal=132.7400`, `Tax=17.2600`,
  `Total=150.0000` en encabezado y linea, y el pago neto `150.0000`.
- No registrar el efectivo recibido de ₡200 como pago de ₡200: el pago
  aplicado al borrador sigue siendo ₡150, dejando ₡50 de vuelto fuera
  del registro hasta migrar la captura de tender/change.
- Repetir sin cambiar el importe de IVA ni los productos: debe devolver
  el mismo borrador. Una nueva carga de la pagina crea una nueva sesion.

La coincidencia aritmetica NO implica validacion legal ni tributaria;
no se han migrado tarifas por CABYS, redondeos fiscales, descuentos,
promociones, consecutivos definitivos ni inventario. No utilizar
estos borradores para declaraciones o facturas reales.

## Etapa 4: tarifa IVA explicitamente configurada y calculada en la API

Se añade migracion SQL version 4 (`POS365_ProductTax`). No modifica
los borradores previos. El operador debe configurar explicitamente la tarifa
en el catalogo SQL, usando el mantenimiento de articulos SQL, campo
`Tarifa IVA de desarrollo`. No se infiere automaticamente del CABYS
ni se asegura que la tarifa sea fiscalmente aplicable. Tarifa NULL significa
**sin configurar**, distinto de una tarifa exenta configurada en 0%.

`POST /api/pos/drafts` consulta el indicador de precio con IVA, el precio
lista 0 y la tarifa configurada en SQL. Para esta etapa solo se admiten
productos cuyo precio incluye IVA: al resto se le devuelve un error.
La API calcula el impuesto dentro de la transaccion; rechaza cualquier
impuesto enviado que difiera. Redondea el IVA a 2 decimales para esta
prueba (no supone validacion fiscal). El boton de borrador del POS original
ya no solicita el IVA manualmente y envia tax=null, para que el servidor
realice el calculo. La vista previa del navegador es solo informativa.

### Prueba

1. Detener POS local y actualizar la rama.
2. Ejecutar `scripts/Iniciar-Local.ps1 -Inicializar` UNA vez para la version 4.
3. Abrir `/catalogo.html`, editar P1 y configurar **13** en tarifa IVA
   solo si el usuario verifica que esa tarifa corresponde al producto de prueba.
   La opcion "Precios incluyen IVA" debe estar activada.
4. Abrir `/pos-original.html`; agregar P1 (150 colones), ir a Pago con
   y pulsar "Guardar borrador SQL (prueba)". Si se configuró 13%, el nuevo
   borrador debe indicar subtotal 132.7400, IVA 17.2600, total 150.0000.
5. Comprobar en SSMS versiones 1 a 4 y nuevos registros Draft en
   `POS365_Sale` y `POS365_SaleLine`. Los borradores previos permanecen.

Aun NO se ha implementado la determinacion fiscal oficial por CABYS,
exenciones, descuentos, precios que excluyen IVA, multiproducto en
la interfaz, numero fiscal ni inventario.

## Integración inicial del mantenimiento original de artículos con SQL (P3)

`scripts/native-article-sql.js` se inserta al generar
`pos-original.html` con `scripts/build-local-pos.py`.
Dentro del mantenimiento original aparecen controles **Buscar SQL**,
**Nuevo artículo SQL**, **Guardar artículo SQL** y campos explícitos
**Código SQL**, **Precio lista 0** y **Tarifa IVA de desarrollo**.

Al guardar toma nombre, barras y CABYS desde el formulario original, y
utiliza `PUT /api/catalog/products/{id}`. En modificación primero se
debe cargar el artículo con Buscar SQL; así se usa el `rowversion` real y
se conservan las listas de precios adicionales. Guarda además la tarifa
de desarrollo, si se indica. **No** migra ni guarda todavía costos,
categorías, bodegas, existencias, proveedor, imágenes ni demás campos
históricos. El consecutivo visual `18262` del formulario antiguo no se
interpreta como código SQL: el operador indica código SQL o usa barras.
No se activa el guardado histórico de la aplicación.

Prueba P3: en `/pos-original.html` abrir Mantenimiento de artículos,
pulsar `Nuevo artículo SQL`, rellenar nombre y barras en el formulario
original, indicar código SQL `P3` y precio lista 0 `1500`, registrar
CABYS válido si corresponde y pulsar `Guardar artículo SQL`.
Confirmar en SSMS `POS365_Product`, `POS365_ProductIdentifier` y
`POS365_ProductPrice`. Desde Facturación POS escanear `P3`: debe
devolver el artículo, salvo validaciones fiscales aún pendientes.
Para editarlo, usar **Buscar SQL** y luego **Guardar artículo SQL**.
Si la interfaz no encuentra un campo nativo muestra un error de
validación; nunca afirmar que todos los campos del formulario histórico
se han almacenado.

Los cambios de esta etapa están subidos a la rama, pero la compilación
y el comportamiento del formulario deben validarse en el navegador del
usuario. No utilizar para producción.
