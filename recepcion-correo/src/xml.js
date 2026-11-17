// Lector de XML mínimo (sin dependencias) y lectura de comprobantes electrónicos de Costa Rica.

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function desescapar(t) {
  return t.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (todo, e) => {
    if (e[0] === '#') {
      const codigo = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(codigo) && codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : '';
    }
    return ENTIDADES[e] ?? todo;
  });
}

/** Devuelve el elemento raíz: { nombre (sin prefijo), hijos: [], texto }. */
function parsear(xml) {
  let t = String(xml);
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  const raiz = { nombre: '#raiz', hijos: [], texto: '' };
  const pila = [raiz];
  let i = 0;
  while (i < t.length) {
    const abre = t.indexOf('<', i);
    if (abre === -1) break;
    if (abre > i) pila[pila.length - 1].texto += desescapar(t.slice(i, abre));
    if (t.startsWith('<!--', abre)) {
      const fin = t.indexOf('-->', abre + 4);
      if (fin === -1) throw new Error('Comentario sin cerrar.');
      i = fin + 3;
    } else if (t.startsWith('<![CDATA[', abre)) {
      const fin = t.indexOf(']]>', abre + 9);
      if (fin === -1) throw new Error('CDATA sin cerrar.');
      pila[pila.length - 1].texto += t.slice(abre + 9, fin);
      i = fin + 3;
    } else if (t.startsWith('<?', abre)) {
      const fin = t.indexOf('?>', abre + 2);
      if (fin === -1) throw new Error('Instrucción sin cerrar.');
      i = fin + 2;
    } else if (t.startsWith('<!', abre)) {
      // DOCTYPE: no se admiten (evita entidades externas o expansivas).
      throw new Error('El XML contiene una declaración DOCTYPE, que no se admite.');
    } else {
      const fin = t.indexOf('>', abre + 1);
      if (fin === -1) throw new Error('Etiqueta sin cerrar.');
      const cuerpo = t.slice(abre + 1, fin);
      if (cuerpo[0] === '/') {
        const nombre = cuerpo.slice(1).trim().split(':').pop();
        const actual = pila.pop();
        if (pila.length === 0 || actual.nombre !== nombre) throw new Error(`Cierre inesperado de <${nombre}>.`);
      } else {
        const autocierre = cuerpo.endsWith('/');
        const nombre = (/^[^\s/]+/.exec(cuerpo) || [''])[0].split(':').pop();
        if (!nombre) throw new Error('Etiqueta vacía.');
        const nodo = { nombre, hijos: [], texto: '' };
        pila[pila.length - 1].hijos.push(nodo);
        if (!autocierre) {
          if (pila.length > 200) throw new Error('El XML tiene demasiados niveles.');
          pila.push(nodo);
        }
      }
      i = fin + 1;
    }
  }
  if (pila.length !== 1 || raiz.hijos.length === 0) throw new Error('El XML está incompleto.');
  return raiz.hijos[0];
}

const hijo = (nodo, nombre) => (nodo ? nodo.hijos.find((h) => h.nombre === nombre) || null : null);
const hijos = (nodo, nombre) => (nodo ? nodo.hijos.filter((h) => h.nombre === nombre) : []);
const valor = (nodo, ...camino) => {
  let actual = nodo;
  for (const paso of camino) actual = hijo(actual, paso);
  const t = actual ? actual.texto.trim() : '';
  return t || null;
};
const num = (nodo, ...camino) => {
  const n = Number(valor(nodo, ...camino));
  return Number.isFinite(n) ? n : 0;
};

const TIPOS_RAIZ = {
  FacturaElectronica: 'FE',
  TiqueteElectronico: 'TE',
  NotaCreditoElectronica: 'NC',
  NotaDebitoElectronica: 'ND',
  FacturaElectronicaCompra: 'FEC',
  FacturaElectronicaExportacion: 'FEE',
};
const TIPOS_CLAVE = { '01': 'FE', '02': 'ND', '03': 'NC', '04': 'TE', '08': 'FEC', '09': 'FEE' };

function persona(nodo) {
  if (!nodo) return { identificacion: null, nombre: null, nombreComercial: null, correo: null, telefono: null, direccion: null };
  const ubicacion = hijo(nodo, 'Ubicacion');
  return {
    identificacion: valor(nodo, 'Identificacion', 'Numero') || valor(nodo, 'IdentificacionExtranjero'),
    nombre: valor(nodo, 'Nombre'),
    nombreComercial: valor(nodo, 'NombreComercial'),
    correo: valor(nodo, 'CorreoElectronico'),
    telefono: valor(nodo, 'Telefono', 'NumTelefono'),
    direccion: valor(ubicacion, 'OtrasSenas'),
  };
}

function fechaIso(texto) {
  if (!texto) return null;
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}(?::\d{2})?))?/.exec(texto.trim());
  if (!m) return null;
  const hora = m[2] ? (m[2].length === 5 ? `${m[2]}:00` : m[2]) : '00:00:00';
  return `${m[1]}T${hora}-06:00`;
}

/**
 * Lee un XML de Hacienda. Devuelve
 *   { clase: 'comprobante', ... }  para facturas, tiquetes y notas, o
 *   { clase: 'respuesta', clave, estado, detalle }  para un MensajeHacienda.
 */
function leerComprobante(xml) {
  let raiz;
  try {
    raiz = parsear(xml);
  } catch (e) {
    throw new Error(`El archivo no es un XML válido. ${e.message}`);
  }

  if (raiz.nombre === 'MensajeHacienda') {
    const clave = valor(raiz, 'Clave');
    if (!clave) throw new Error('La respuesta de Hacienda no trae la clave del comprobante.');
    const codigo = valor(raiz, 'Mensaje');
    return {
      clase: 'respuesta',
      clave,
      estado: codigo === '1' ? 'ACEPTADA' : codigo === '2' ? 'ACEPTADA_PARCIALMENTE' : codigo === '3' ? 'RECHAZADA' : 'SIN RESPUESTA',
      detalle: valor(raiz, 'DetalleMensaje'),
    };
  }

  const clave = valor(raiz, 'Clave');
  const tipoDocumento = TIPOS_RAIZ[raiz.nombre] || (clave && TIPOS_CLAVE[clave.slice(29, 31)]);
  if (!tipoDocumento || !hijo(raiz, 'ResumenFactura')) {
    throw new Error('El XML no es un comprobante electrónico reconocido (factura, tiquete o nota).');
  }
  if (clave && !/^\d{50}$/.test(clave)) throw new Error('La clave del comprobante no tiene 50 dígitos.');
  const fechaEmision = fechaIso(valor(raiz, 'FechaEmision'));
  if (!fechaEmision) throw new Error('El comprobante no trae una fecha de emisión válida.');

  const resumen = hijo(raiz, 'ResumenFactura');
  const lineas = hijos(hijo(raiz, 'DetalleServicio'), 'LineaDetalle').map((l, indice) => {
    const impuestos = hijos(l, 'Impuesto').map((imp) => ({ tarifa: imp ? num(imp, 'Tarifa') : 0, monto: num(imp, 'Monto') }));
    const comercial = hijo(l, 'CodigoComercial');
    const cabys = valor(l, 'CodigoCABYS') || (hijo(l, 'Codigo') && hijo(l, 'Codigo').hijos.length === 0 ? valor(l, 'Codigo') : null);
    const montoTotal = num(l, 'MontoTotal');
    const descuento = hijos(l, 'Descuento').reduce((s, d) => s + num(d, 'MontoDescuento'), 0);
    const impuesto = hijo(l, 'ImpuestoNeto') ? num(l, 'ImpuestoNeto') : impuestos.reduce((s, x) => s + x.monto, 0);
    const subtotal = hijo(l, 'SubTotal') ? num(l, 'SubTotal') : montoTotal - descuento;
    return {
      numeroLinea: num(l, 'NumeroLinea') || indice + 1,
      codigoCabys: cabys,
      codigoComercial: valor(comercial, 'Codigo'),
      descripcion: valor(l, 'Detalle'),
      cantidad: num(l, 'Cantidad'),
      unidadMedida: valor(l, 'UnidadMedida'),
      precioUnitario: num(l, 'PrecioUnitario'),
      descuento,
      subtotal,
      impuesto,
      tarifa: impuestos.length ? impuestos[0].tarifa : hijo(l, 'Impuesto') ? 0 : null,
      montoTotalLinea: hijo(l, 'MontoTotalLinea') ? num(l, 'MontoTotalLinea') : subtotal + impuesto,
    };
  });

  const medios = [
    ...hijos(raiz, 'MedioPago').map((m) => m.texto.trim()),
    ...hijos(resumen, 'MedioPago').map((m) => valor(m, 'TipoMedioPago')),
  ].filter(Boolean);

  return {
    clase: 'comprobante',
    tipoDocumento,
    clave,
    consecutivo: valor(raiz, 'NumeroConsecutivo'),
    fechaEmision,
    emisor: persona(hijo(raiz, 'Emisor')),
    receptor: persona(hijo(raiz, 'Receptor')),
    condicionVenta: valor(raiz, 'CondicionVenta'),
    medioPago: [...new Set(medios)].join(',') || null,
    codigoMoneda: valor(resumen, 'CodigoTipoMoneda', 'CodigoMoneda') || valor(resumen, 'CodigoMoneda') || 'CRC',
    tipoCambio: num(resumen, 'CodigoTipoMoneda', 'TipoCambio') || num(resumen, 'TipoCambio') || 1,
    totalVenta: num(resumen, 'TotalVenta'),
    totalDescuentos: num(resumen, 'TotalDescuentos'),
    totalVentaNeta: num(resumen, 'TotalVentaNeta'),
    totalImpuesto: num(resumen, 'TotalImpuesto'),
    totalOtrosCargos: num(resumen, 'TotalOtrosCargos'),
    totalComprobante: num(resumen, 'TotalComprobante'),
    lineas,
  };
}

export { parsear, leerComprobante, hijo, hijos, valor };
