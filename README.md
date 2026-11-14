# POS 365

La interfaz editable está en work/cedi-current-inner.html. Incluye Compras, Facturación POS, Artículos, Cargas XML y diseños. Desde esta carpeta ejecutá:

    python3 cloudflare/build.py salida
    node tests/guardado.mjs

La prueba usa Node con node:sqlite. La salida es para Cloudflare Pages con un Worker, una base D1 vinculada como DB y un origen autorizado en Google. Configurá el identificador público de Google y los usuarios permitidos en una copia de desarrollo de cloudflare/_worker.js. La lista inicial está vacía. El esquema de almacenamiento está en cloudflare/migrate.py. La autenticación real de Hacienda sigue pendiente de verificación.

La interfaz y los colores están en la fuente original. El respaldo de negocio y las credenciales se entregan por un canal privado. El WMS de Rubén está pendiente de incorporar tras identificar su fuente y su modelo de inventario.
