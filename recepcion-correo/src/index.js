/*
 * Recepción automática de comprobantes electrónicos por correo (IMAP) — versión Cloudflare Workers.
 *
 * Misma idea que la versión para Node: no usa base de datos; quien lo usa le pasa la configuración
 * del buzón y una función que guarda lo recibido en SU sistema. Diferencias por estar en un Worker:
 *   - la conexión usa los sockets TCP de Cloudflare (cloudflare:sockets);
 *   - procesarMensaje es asíncrona (la descompresión de ZIP es un stream);
 *   - revisarBuzon y buscarPorFechas procesan como máximo `maxCorreos` correos por llamada y dicen
 *     cuántos quedaron pendientes, para no pasarse del tiempo de CPU de una ejecución del Worker.
 *
 *   probarConexion(config)                                   botón "Probar conexión IMAP"
 *   revisarBuzon(config, estado, alRecibir, opciones)        revisión periódica (solo correos nuevos)
 *   buscarPorFechas(config, desde, hasta, alRecibir, opc.)   "Buscar en correo" por rango de fechas, por tandas
 *   procesarMensaje(correoCrudo, opciones)                   saca XML / PDF / ZIP de un correo ya bajado
 *
 * config = {
 *   servidorImap: 'imap.gmail.com', puerto: 993, usarSsl: true,
 *   usuario: 'facturas@empresa.com', clave: '…', carpeta: 'INBOX',
 *   descargarXml: true, descargarPdf: true, procesarZip: true, marcarComoLeido: true,
 * }
 */

import { ClienteImap, ErrorImap, fechaImap } from './imap.js';
import { adjuntos, claseDe, leerZip } from './mime.js';
import { leerComprobante } from './xml.js';

// Un Worker tiene 128 MB de memoria: correos más grandes se saltan (y se avisa).
const MAX_MENSAJE = 15 * 1024 * 1024;

function sumarDias(dia, cantidad) {
  const d = new Date(`${String(dia).slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + cantidad);
  return d.toISOString().slice(0, 10);
}

/** Hoy en Costa Rica (UTC-6, sin horario de verano). */
const hoy = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);

function validar(config) {
  if (!config || !config.servidorImap) throw new ErrorImap('Debe indicar el servidor IMAP.');
  if (!config.usuario) throw new ErrorImap('Debe indicar el correo o usuario IMAP.');
  if (!config.clave) throw new ErrorImap('Debe indicar la contraseña del correo.');
  const puerto = Number(config.puerto || 993);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) throw new ErrorImap('El puerto IMAP debe estar entre 1 y 65535.');
  return puerto;
}

/** Abre la conexión, entra con el usuario, ejecuta la tarea y siempre cierra. */
async function conBuzon(config, tarea) {
  const puerto = validar(config);
  const cliente = new ClienteImap({
    host: config.servidorImap,
    puerto,
    ssl: config.usarSsl !== false,
    // Solo para pruebas contra un servidor local sin cifrar. En uso real déjelo en false:
    // así la contraseña nunca viaja sin cifrar.
    permitirSinCifrar: config.permitirSinCifrar === true,
  });
  try {
    await cliente.conectar();
    await cliente.login(config.usuario, config.clave);
    return await tarea(cliente);
  } finally {
    await cliente.salir();
  }
}

/**
 * Botón "Probar conexión IMAP". Devuelve { mensajes, uidValidez } o lanza un Error cuyo .message ya está
 * redactado para mostrarlo al usuario. No cambia nada en el buzón (abre la carpeta en solo lectura).
 */
export function probarConexion(config) {
  return conBuzon(config, (cliente) => cliente.seleccionar(config.carpeta || 'INBOX', { soloLectura: true }));
}

/**
 * Saca de un correo crudo lo que interesa. No guarda nada: solo devuelve
 *
 *   {
 *     comprobantes: [{ archivo, xml, pdfs: [{nombre, datos}], tipoDocumento, clave, consecutivo, fechaEmision,
 *                      emisor, receptor, condicionVenta, medioPago, codigoMoneda, tipoCambio,
 *                      totalVenta, totalDescuentos, totalVentaNeta, totalImpuesto, totalOtrosCargos,
 *                      totalComprobante, lineas: [...] }],
 *     respuestas:   [{ archivo, xml, clave, estado, detalle }],   // MensajeHacienda: ACEPTADA / RECHAZADA / …
 *     pdfs:         [{ nombre, datos }],                          // todos los PDF del correo
 *     errores:      [{ archivo, mensaje }],                       // XML dañados, ZIP dañados, etc.
 *     interesa:     true | false                                  // ¿traía XML, PDF o ZIP?
 *   }
 * `datos` es un Buffer (de node:buffer); para guardarlo en D1 o R2 sirve tal cual o como datos.buffer.
 */
export async function procesarMensaje(crudo, opciones = {}) {
  const o = { descargarXml: true, descargarPdf: true, procesarZip: true, ...opciones };
  const r = { comprobantes: [], respuestas: [], pdfs: [], errores: [], interesa: false };
  let lista;
  try {
    lista = adjuntos(crudo);
  } catch (e) {
    r.errores.push({ archivo: null, mensaje: `Correo ilegible: ${e.message}` });
    return r;
  }

  const xmls = [];
  const clasificar = (a) => {
    const clase = claseDe(a);
    if (clase === 'xml') xmls.push(a);
    else if (clase === 'pdf') r.pdfs.push({ nombre: a.nombre, datos: a.datos });
    return clase;
  };
  for (const a of lista) {
    if (clasificar(a) !== 'zip' || !o.procesarZip) continue;
    r.interesa = true;
    try {
      // El ZIP se abre en memoria, con tope de tamaño (protege de un "ZIP bomba").
      for (const interno of await leerZip(a.datos, { filtro: (nombre) => /\.(xml|pdf)$/i.test(nombre) })) {
        clasificar({ nombre: interno.nombre, tipo: '', datos: interno.datos });
      }
    } catch (e) {
      r.errores.push({ archivo: a.nombre, mensaje: e.message });
    }
  }
  if (!o.descargarXml) xmls.length = 0;
  if (!o.descargarPdf) r.pdfs.length = 0;
  if (xmls.length || r.pdfs.length) r.interesa = true;

  for (const a of xmls) {
    const xml = a.datos.toString('utf8');
    try {
      const { clase, ...datos } = leerComprobante(xml);
      if (clase === 'respuesta') r.respuestas.push({ archivo: a.nombre, xml, ...datos });
      else r.comprobantes.push({ archivo: a.nombre, xml, pdfs: [], ...datos });
    } catch (e) {
      // Un XML que no es factura/tiquete/nota (por ejemplo una firma suelta) se ignora sin ruido.
      if (!/no es un comprobante electrónico reconocido/.test(e.message)) r.errores.push({ archivo: a.nombre, mensaje: e.message });
    }
  }

  // A cuál comprobante pertenece cada PDF: si el correo trae uno solo, es suyo; si trae varios,
  // del que tenga su clave o su consecutivo en el nombre del archivo.
  for (const pdf of r.pdfs) {
    const destino =
      r.comprobantes.length === 1
        ? r.comprobantes[0]
        : r.comprobantes.find((c) => (c.clave && pdf.nombre.includes(c.clave)) || (c.consecutivo && pdf.nombre.includes(c.consecutivo)));
    if (destino) destino.pdfs.push(pdf);
  }
  return r;
}

const vacio = () => ({ comprobantes: [], respuestas: [], pdfs: [], errores: [], interesa: false });

async function leerUid(cliente, uid, config) {
  if ((await cliente.tamano(uid)) > MAX_MENSAJE) {
    return { ...vacio(), errores: [{ archivo: null, mensaje: `Correo ${uid} omitido: pasa de ${MAX_MENSAJE / 1024 / 1024} MB.` }] };
  }
  const crudo = await cliente.mensaje(uid); // BODY.PEEK[]: bajar el correo NO lo marca como leído
  return crudo ? procesarMensaje(crudo, config) : vacio();
}

/**
 * Revisión periódica: solo correos nuevos.
 *
 * estado = { uidValidez, ultimoUid, revisarDesde }   ← hay que guardarlo entre una revisión y la siguiente
 *   - revisarDesde: día ('AAAA-MM-DD') desde el que se toman correos. Póngalo el día en que el usuario
 *     activa la recepción, para no tragarse años de buzón. (Lo anterior se trae con buscarPorFechas.)
 *   - ultimoUid / uidValidez: los llena esta función.
 *
 * alRecibir(contenido, { uid }) — se llama una vez por cada correo que traía XML/PDF/ZIP, con lo que
 *   devuelve procesarMensaje(). Ahí usted guarda en su base (y decide qué es duplicado).
 *   - Si devuelve false, el correo NO se marca como leído.
 *   - Si lanza un error, la revisión se detiene ahí y ese correo se reintenta en la próxima revisión.
 *
 * opciones.guardarEstado(estado) — opcional; se llama después de cada correo para que el avance no se
 *   pierda si el Worker se corta a la mitad (por tiempo de CPU, por ejemplo).
 * opciones.maxCorreos — cuántos correos procesar como máximo en esta llamada (por defecto 20).
 *
 * Nunca lanza. Devuelve { correos, comprobantes, respuestas, procesados, pendientes, errores, error, estado }.
 *   Si `pendientes` > 0, vuelva a llamar pronto (por ejemplo, en la siguiente ejecución del cron).
 */
export async function revisarBuzon(config, estado, alRecibir, opciones = {}) {
  const maxCorreos = Math.max(1, Number(opciones.maxCorreos) || 20);
  const actual = {
    uidValidez: (estado && estado.uidValidez) || null,
    ultimoUid: Number(estado && estado.ultimoUid) || 0,
    revisarDesde: (estado && estado.revisarDesde) || hoy(),
  };
  const resumen = { correos: 0, comprobantes: 0, respuestas: 0, procesados: 0, pendientes: 0, errores: [], error: null, estado: actual };
  try {
    await conBuzon(config, async (cliente) => {
      // Sin "marcar como leído" la carpeta se abre en solo lectura: imposible alterar el buzón por error.
      const { uidValidez } = await cliente.seleccionar(config.carpeta || 'INBOX', { soloLectura: !config.marcarComoLeido });
      // Si el servidor recreó la carpeta, sus UID empiezan de nuevo.
      if (actual.uidValidez && uidValidez && actual.uidValidez !== uidValidez) actual.ultimoUid = 0;
      actual.uidValidez = uidValidez;
      // Un día de margen por diferencias de zona horaria. "n:*" siempre devuelve el último correo aunque
      // su UID sea menor que n (rareza de IMAP), por eso se filtra otra vez aquí.
      const criterio = `UID ${actual.ultimoUid + 1}:*` + (actual.ultimoUid ? '' : ` SINCE ${fechaImap(sumarDias(actual.revisarDesde, -1))}`);
      const uids = (await cliente.buscar(criterio)).filter((u) => u > actual.ultimoUid);
      const lote = uids.slice(0, maxCorreos);
      resumen.pendientes = uids.length - lote.length;
      for (const uid of lote) {
        const contenido = await leerUid(cliente, uid, config);
        if (contenido.interesa) {
          const guardado = (await alRecibir(contenido, { uid })) !== false; // si lanza, corta aquí y se reintenta luego
          resumen.correos += 1;
          resumen.comprobantes += contenido.comprobantes.length;
          resumen.respuestas += contenido.respuestas.length;
          // Solo se marcan como leídos los correos que entraron bien. Los que dieron error quedan sin leer
          // para que una persona los revise; los correos sin comprobantes no se tocan nunca.
          if (config.marcarComoLeido && guardado && contenido.errores.length === 0) await cliente.marcarLeido(uid).catch(() => {});
        }
        if (opciones.reintentarErrores && contenido.errores.length) {
          throw new ErrorImap('Pendiente de revisar, correo ' + uid + ': ' + contenido.errores[0].mensaje);
        }
        for (const e of contenido.errores) resumen.errores.push({ uid, ...e });
        actual.ultimoUid = uid;
        resumen.procesados += 1;
        if (opciones.guardarEstado) await opciones.guardarEstado({ ...actual });
      }
    });
  } catch (e) {
    resumen.error = e.message;
  }
  return resumen;
}

/**
 * "Buscar en correo": recorre TODOS los correos de un rango de fechas ('AAAA-MM-DD'), leídos o no.
 * No marca nada como leído y no usa ni cambia el estado de la revisión periódica.
 * alRecibir es la misma función que en revisarBuzon (por eso debe saber reconocer duplicados).
 *
 * En un Worker una búsqueda grande no cabe en una sola ejecución, así que va por tandas:
 *   opciones.desdeUid   — seguir después de este UID (0 la primera vez; luego, el `ultimoUid` que devolvió).
 *   opciones.maxCorreos — tamaño de la tanda (por defecto 20).
 *   opciones.alAvanzar({ uid }) — opcional, después de cada correo (para guardar el avance).
 *
 * Nunca lanza. Devuelve { correos, comprobantes, respuestas, procesados, pendientes, terminado, ultimoUid, errores, error }.
 */
export async function buscarPorFechas(config, desde, hasta, alRecibir, opciones = {}) {
  const maxCorreos = Math.max(1, Number(opciones.maxCorreos) || 20);
  const desdeUid = Number(opciones.desdeUid) || 0;
  const resumen = { correos: 0, comprobantes: 0, respuestas: 0, procesados: 0, pendientes: 0, terminado: false, ultimoUid: desdeUid, errores: [], error: null };
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(desde)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(hasta)) || hasta < desde) {
      throw new ErrorImap('Las fechas Desde y Hasta no son válidas.');
    }
    await conBuzon(config, async (cliente) => {
      const folder=await cliente.seleccionar(config.carpeta || 'INBOX', { soloLectura: true });
      resumen.validity=folder.uidValidez;
      // SINCE incluye el día; BEFORE lo excluye. Fechas de recepción del buzón.
      const uids = (await cliente.buscar(`SINCE ${fechaImap(desde)} BEFORE ${fechaImap(sumarDias(hasta, 1))}`)).filter((u) => u > desdeUid);
      const lote = uids.slice(0, maxCorreos);
      resumen.pendientes = uids.length - lote.length;
      for (const uid of lote) {
        const contenido = await leerUid(cliente, uid, config);
        if (contenido.interesa) {
          await alRecibir(contenido, { uid });
          resumen.correos += 1;
          resumen.comprobantes += contenido.comprobantes.length;
          resumen.respuestas += contenido.respuestas.length;
        }
        for (const e of contenido.errores) resumen.errores.push({ uid, ...e });
        resumen.ultimoUid = uid;
        resumen.procesados += 1;
        if (opciones.alAvanzar) await opciones.alAvanzar({ uid });
      }
      resumen.terminado = resumen.pendientes === 0;
    });
  } catch (e) {
    resumen.error = e.message;
  }
  return resumen;
}

export { leerComprobante, ErrorImap };
