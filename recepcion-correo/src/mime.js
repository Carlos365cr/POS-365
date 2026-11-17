// Lectura de correos (MIME) para sacar sus adjuntos, y lectura de archivos ZIP. Sin dependencias.
// Versión para Cloudflare Workers: Buffer viene de node:buffer (requiere el flag nodejs_compat).

import { Buffer } from 'node:buffer';

function decodificarTexto(buf, charset) {
  const nombre = String(charset || 'utf-8').toLowerCase();
  try {
    return new TextDecoder(nombre === 'us-ascii' ? 'utf-8' : nombre).decode(buf);
  } catch {
    return buf.toString('latin1');
  }
}

function quotedPrintable(texto, esCabecera) {
  const t = esCabecera ? texto.replace(/_/g, ' ') : texto.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < t.length; i += 1) {
    if (t[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) {
      bytes.push(parseInt(t.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(t.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/** Palabras codificadas de cabecera: =?UTF-8?B?...?= y =?ISO-8859-1?Q?...?= */
function decodificarPalabras(valor) {
  return String(valor || '')
    .replace(/(=\?[^?]+\?[bBqQ]\?[^?]*\?=)\s+(?==\?)/g, '$1')
    .replace(/=\?([^?*]+)(?:\*[^?]*)?\?([bBqQ])\?([^?]*)\?=/g, (_, charset, modo, dato) => {
      const buf = modo.toLowerCase() === 'b' ? Buffer.from(dato, 'base64') : quotedPrintable(dato, true);
      return decodificarTexto(buf, charset);
    });
}

/** Separa cabeceras y cuerpo. Las cabeceras quedan en minúsculas; si una se repite, gana la primera. */
function separar(buf) {
  let corte = buf.indexOf('\r\n\r\n');
  let salto = 4;
  const alterno = buf.indexOf('\n\n');
  if (corte === -1 || (alterno !== -1 && alterno < corte)) {
    corte = alterno;
    salto = 2;
  }
  const bloque = corte === -1 ? buf.toString('latin1') : buf.toString('latin1', 0, corte);
  const cabeceras = {};
  for (const linea of bloque.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = linea.indexOf(':');
    if (i <= 0) continue;
    const nombre = linea.slice(0, i).trim().toLowerCase();
    if (!(nombre in cabeceras)) cabeceras[nombre] = linea.slice(i + 1).trim();
  }
  return { cabeceras, cuerpo: corte === -1 ? Buffer.alloc(0) : buf.subarray(corte + salto) };
}

/** "multipart/mixed; boundary=abc; name*=UTF-8''fact%C3%BAra.xml" → { valor, params } */
function parametros(cabecera) {
  const texto = String(cabecera || '');
  const valor = (texto.split(';')[0] || '').trim().toLowerCase();
  const crudos = {};
  const re = /;\s*([^=;\s]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]*))/g;
  let m;
  while ((m = re.exec(texto))) {
    crudos[m[1].toLowerCase()] = m[2] !== undefined ? m[2].replace(/\\(.)/g, '$1') : m[3].trim();
  }
  const params = {};
  const porPartes = {};
  for (const [clave, dato] of Object.entries(crudos)) {
    const p = /^([^*]+)\*(\d+)?(\*)?$/.exec(clave);
    if (!p) {
      if (!(clave in params)) params[clave] = decodificarPalabras(dato);
      continue;
    }
    // RFC 2231: nombre*=charset''valor%XX  o  nombre*0*=…; nombre*1*=…
    (porPartes[p[1]] = porPartes[p[1]] || []).push({ orden: Number(p[2] || 0), codificado: !!p[3] || p[2] === undefined, dato });
  }
  for (const [clave, partes] of Object.entries(porPartes)) {
    partes.sort((a, b) => a.orden - b.orden);
    let charset = 'utf-8';
    const bytes = [];
    partes.forEach((parte, i) => {
      let dato = parte.dato;
      if (parte.codificado) {
        if (i === 0) {
          const c = /^([^']*)'[^']*'(.*)$/.exec(dato);
          if (c) {
            charset = c[1] || 'utf-8';
            dato = c[2];
          }
        }
        bytes.push(quotedPrintable(dato.replace(/%/g, '='), false));
      } else {
        bytes.push(Buffer.from(dato, 'latin1'));
      }
    });
    params[clave] = decodificarTexto(Buffer.concat(bytes), charset);
  }
  return { valor, params };
}

function decodificarCuerpo(cuerpo, codificacion) {
  const tipo = String(codificacion || '7bit').trim().toLowerCase();
  if (tipo === 'base64') return Buffer.from(cuerpo.toString('latin1').replace(/[^A-Za-z0-9+/=]/g, ''), 'base64');
  if (tipo === 'quoted-printable') return quotedPrintable(cuerpo.toString('latin1'), false);
  return cuerpo;
}

function partesDe(cuerpo, limite) {
  const marca = Buffer.from(`--${limite}`);
  const partes = [];
  let inicio = -1;
  let pos = 0;
  for (;;) {
    const i = cuerpo.indexOf(marca, pos);
    if (i === -1) break;
    pos = i + marca.length;
    if (i !== 0 && cuerpo[i - 1] !== 0x0a) continue; // la marca tiene que empezar línea
    if (inicio !== -1) {
      let fin = i;
      if (cuerpo[fin - 1] === 0x0a) fin -= 1;
      if (cuerpo[fin - 1] === 0x0d) fin -= 1;
      partes.push(cuerpo.subarray(inicio, Math.max(inicio, fin)));
    }
    if (cuerpo[pos] === 0x2d && cuerpo[pos + 1] === 0x2d) {
      inicio = -1;
      break; // marca de cierre: --limite--
    }
    const finLinea = cuerpo.indexOf('\n', pos);
    if (finLinea === -1) {
      inicio = -1;
      break;
    }
    inicio = finLinea + 1;
  }
  if (inicio !== -1) partes.push(cuerpo.subarray(inicio)); // correo truncado: se toma lo que haya
  return partes;
}

/**
 * Adjuntos de un correo crudo: [{ nombre, tipo, datos }].
 * Solo devuelve partes con nombre de archivo o de tipo XML/PDF/ZIP.
 */
function adjuntos(mensaje, profundidad = 0, salida = []) {
  if (profundidad > 12 || salida.length > 500) return salida;
  const { cabeceras, cuerpo } = separar(mensaje);
  const tipo = parametros(cabeceras['content-type'] || 'text/plain');
  if (tipo.valor.startsWith('multipart/') && tipo.params.boundary) {
    for (const parte of partesDe(cuerpo, tipo.params.boundary)) adjuntos(parte, profundidad + 1, salida);
    return salida;
  }
  const datos = decodificarCuerpo(cuerpo, cabeceras['content-transfer-encoding']);
  if (tipo.valor === 'message/rfc822') return adjuntos(datos, profundidad + 1, salida);
  const disposicion = parametros(cabeceras['content-disposition'] || '');
  const nombre = (disposicion.params.filename || tipo.params.name || '').split(/[\\/]/).pop().trim();
  const interesa = /(^|\/)(xml|pdf|zip|x-zip-compressed)$/.test(tipo.valor) || tipo.valor === 'text/xml';
  if ((nombre || interesa) && datos.length > 0 && tipo.valor !== 'text/plain' && tipo.valor !== 'text/html') {
    salida.push({ nombre: nombre || `adjunto.${tipo.valor.split('/').pop().replace('x-zip-compressed', 'zip')}`, tipo: tipo.valor, datos });
  } else if (nombre && datos.length > 0) {
    salida.push({ nombre, tipo: tipo.valor, datos });
  }
  return salida;
}

/** A qué clase de archivo corresponde un adjunto: 'xml' | 'pdf' | 'zip' | null. */
function claseDe(adjunto) {
  const nombre = adjunto.nombre.toLowerCase();
  const d = adjunto.datos;
  if (nombre.endsWith('.zip') || /zip/.test(adjunto.tipo) || (d.length > 4 && d.readUInt32LE(0) === 0x04034b50)) return 'zip';
  if (nombre.endsWith('.pdf') || adjunto.tipo === 'application/pdf' || d.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (nombre.endsWith('.xml') || /xml$/.test(adjunto.tipo)) return 'xml';
  const inicio = d.subarray(0, 200).toString('utf8').replace(/^﻿/, '').trimStart();
  return inicio.startsWith('<?xml') || /^<[A-Za-z]/.test(inicio) ? 'xml' : null;
}

// ---------------------------------------------------------------- ZIP

class ZipDemasiadoGrande extends Error {}

/** Descomprime "deflate-raw" con el DecompressionStream del Worker, cortando si pasa de `maximo` bytes. */
async function inflar(datos, maximo) {
  const ds = new DecompressionStream('deflate-raw');
  const escritor = ds.writable.getWriter();
  // No se espera a write(): con contrapresión se trabaría hasta que alguien lea.
  escritor.write(datos).catch(() => {});
  escritor.close().catch(() => {});
  const lector = ds.readable.getReader();
  const trozos = [];
  let total = 0;
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximo) {
      await lector.cancel().catch(() => {});
      throw new ZipDemasiadoGrande();
    }
    trozos.push(Buffer.from(value));
  }
  return Buffer.concat(trozos);
}

/**
 * Archivos de un ZIP, en memoria: [{ nombre, datos }]. Nunca escribe a disco.
 * Corta si el contenido descomprimido pasa de `maxBytes` (protege de ZIP bomba).
 * Asíncrona: en Workers la descompresión es un stream.
 */
async function leerZip(buf, { maxArchivos = 2000, maxBytes = 40 * 1024 * 1024, filtro = () => true } = {}) {
  const FIRMA_FIN = 0x06054b50;
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i -= 1) {
    if (buf.readUInt32LE(i) === FIRMA_FIN) {
      fin = i;
      break;
    }
  }
  if (fin === -1) throw new Error('El archivo ZIP está dañado o incompleto.');
  const cantidad = buf.readUInt16LE(fin + 10);
  let pos = buf.readUInt32LE(fin + 16);
  if (cantidad > maxArchivos) throw new Error('El archivo ZIP trae demasiados archivos.');
  const archivos = [];
  let total = 0;
  for (let n = 0; n < cantidad; n += 1) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('El archivo ZIP está dañado.');
    const banderas = buf.readUInt16LE(pos + 8);
    const metodo = buf.readUInt16LE(pos + 10);
    const comprimido = buf.readUInt32LE(pos + 20);
    const largoNombre = buf.readUInt16LE(pos + 28);
    const largoExtra = buf.readUInt16LE(pos + 30);
    const largoComentario = buf.readUInt16LE(pos + 32);
    const local = buf.readUInt32LE(pos + 42);
    const nombre = buf.toString(banderas & 0x800 ? 'utf8' : 'latin1', pos + 46, pos + 46 + largoNombre);
    pos += 46 + largoNombre + largoExtra + largoComentario;
    if (nombre.endsWith('/') || banderas & 1 || !filtro(nombre)) continue; // carpeta, cifrado o no interesa
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) continue;
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const crudo = buf.subarray(inicio, inicio + comprimido);
    let datos;
    if (metodo === 0) datos = crudo;
    else if (metodo === 8) {
      try {
        datos = await inflar(crudo, Math.max(1, maxBytes - total));
      } catch (e) {
        if (e instanceof ZipDemasiadoGrande) throw new Error('El contenido del ZIP es demasiado grande.');
        continue; // archivo dañado dentro del ZIP: se salta
      }
    } else continue;
    total += datos.length;
    if (total > maxBytes) throw new Error('El contenido del ZIP es demasiado grande.');
    archivos.push({ nombre: nombre.split(/[\\/]/).pop(), datos });
  }
  return archivos;
}

export { adjuntos, claseDe, leerZip, parametros, decodificarPalabras, separar };
