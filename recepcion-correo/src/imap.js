// Cliente IMAP mínimo para Cloudflare Workers: lo justo para revisar un buzón y bajar mensajes completos.
// Usa los sockets TCP de Cloudflare (cloudflare:sockets) y Buffer de node:buffer (flag nodejs_compat).

import { connect } from 'cloudflare:sockets';
import { Buffer } from 'node:buffer';

export class ErrorImap extends Error {}

const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const codificador = new TextEncoder();

/** '2026-11-14' → '14-Nov-2026' (formato de fechas de IMAP). */
export function fechaImap(dia) {
  const [a, m, d] = String(dia).slice(0, 10).split('-').map(Number);
  return `${d}-${MESES[m - 1]}-${a}`;
}

/** Nombre de carpeta en UTF-7 modificado (así viajan las carpetas con tildes). */
export function utf7(nombre) {
  return nombre
    .replace(/&/g, '&-')
    .replace(/[^\x20-\x7e]+/g, (s) => `&${Buffer.from(s, 'utf16le').swap16().toString('base64').replace(/=+$/, '').replace(/\//g, ',')}-`);
}

function entreComillas(valor, nombre) {
  const t = String(valor ?? '');
  // Sin saltos de línea ni caracteres de control: impedirían distinguir dónde termina la orden.
  if (/[\x00-\x1f\x7f]/.test(t)) throw new ErrorImap(`El dato "${nombre}" contiene caracteres no permitidos.`);
  if (/[^\x20-\x7e]/.test(t)) throw new ErrorImap(`El dato "${nombre}" solo puede llevar letras sin tilde, números y símbolos comunes.`);
  return `"${t.replace(/[\\"]/g, '\\$&')}"`;
}

export class ClienteImap {
  /**
   * @param {{host: string, puerto: number, ssl: boolean, tiempoMs?: number, permitirSinCifrar?: boolean}} opciones
   */
  constructor({ host, puerto, ssl, tiempoMs = 45000, permitirSinCifrar = false }) {
    this.host = host;
    this.puerto = puerto;
    this.ssl = ssl;
    this.tiempoMs = tiempoMs;
    this.permitirSinCifrar = permitirSinCifrar;
    this.socket = null;
    this.lector = null;
    this.escritor = null;
    this.trozos = [];
    this.total = 0;
    this.necesita = 0;
    this.contador = 0;
    this.espera = null; // { etiqueta, sinEtiqueta: [], resolver, rechazar }
    this.error = null;
    this.fase = 'conectar'; // para traducir errores: 'conectar' (hasta el saludo) | 'starttls' | 'sesion'
  }

  // ---- Conexión ----

  async conectar() {
    const saludo = new Promise((resolver, rechazar) => {
      this.espera = { etiqueta: '*', sinEtiqueta: [], resolver, rechazar };
    });
    try {
      this.socket = connect({ hostname: this.host, port: this.puerto }, { secureTransport: this.ssl ? 'on' : 'starttls', allowHalfOpen: false });
    } catch (e) {
      throw this.traducir(e);
    }
    this.escuchar();
    this.socket.opened.catch((e) => this.fallar(e));
    const sinRespuesta = this.ssl
      ? `No hubo respuesta de ${this.host}:${this.puerto}. Revise el servidor y el puerto (con SSL normalmente es el 993).`
      : `No hubo respuesta de ${this.host}:${this.puerto}. Revise el servidor y el puerto.`;
    await this.conTiempo(saludo, sinRespuesta, Math.min(this.tiempoMs, 20000));
    this.fase = 'sesion';
    if (this.ssl) return;

    const capacidades = await this.comando('CAPABILITY');
    const texto = capacidades.sinEtiqueta.map((r) => r.partes[0]).join(' ').toUpperCase();
    if (texto.includes('STARTTLS')) {
      // El canal sin cifrar se suelta justo después de leer el "OK" de STARTTLS, sin dejar otra lectura
      // pendiente: startTls() no funciona con el stream tomado.
      const pausada = new Promise((resolver) => {
        this.pausa = resolver;
      });
      try {
        await this.comando('STARTTLS');
      } catch (e) {
        this.fallar(e); // el canal ya quedó suelto: no se puede seguir en esta conexión
        throw this.error;
      }
      await pausada;
      this.subirATls();
      // Tras STARTTLS el servidor no saluda de nuevo: se comprueba el canal cifrado pidiendo las capacidades.
      await this.comando('CAPABILITY');
      this.fase = 'sesion';
    } else if (!this.permitirSinCifrar) {
      throw new ErrorImap('El servidor no ofrece conexión cifrada. Active "Usar SSL / TLS" (normalmente puerto 993).');
    }
  }

  subirATls() {
    try {
      this.escritor.releaseLock();
    } catch {
      /* nada que soltar */
    }
    this.trozos = [];
    this.total = 0;
    this.necesita = 0;
    this.fase = 'starttls';
    try {
      // Sin opciones: el certificado se valida contra el mismo nombre de servidor de connect().
      this.socket = this.socket.startTls();
    } catch (e) {
      throw this.traducir(e);
    }
    this.escuchar();
    this.socket.opened.catch((e) => this.fallar(e));
  }

  escuchar() {
    const lector = this.socket.readable.getReader();
    this.lector = lector;
    this.escritor = this.socket.writable.getWriter();
    (async () => {
      try {
        for (;;) {
          const { value, done } = await lector.read();
          if (done) break;
          if (value && value.byteLength) this.alRecibir(Buffer.from(value));
          // STARTTLS: ya llegó su respuesta; se suelta el lector sin pedir más datos.
          if (this.pausa && !this.espera) {
            const avisar = this.pausa;
            this.pausa = null;
            this.lector = null;
            lector.releaseLock();
            avisar();
            return;
          }
        }
        if (this.lector === lector) this.fallar(new ErrorImap('El servidor de correo cerró la conexión.'));
      } catch (e) {
        if (this.lector === lector) this.fallar(e);
      }
    })();
  }

  traducir(e) {
    if (e instanceof ErrorImap) return e;
    const texto = String((e && e.message) || e || '');
    if (/dns|resolve|lookup|ENOTFOUND|name not known/i.test(texto)) {
      return new ErrorImap(`No se encontró el servidor "${this.host}". Revise el nombre.`);
    }
    // Cloudflare da el mismo mensaje ("proxy request failed, cannot connect to the specified address") para
    // un puerto cerrado, un certificado no válido o una dirección que no permite: se dice qué revisar.
    if (this.fase === 'conectar') {
      return new ErrorImap(
        this.ssl
          ? `No se pudo abrir una conexión segura con ${this.host}:${this.puerto}. Revise el servidor y el puerto (con SSL normalmente es el 993). Si están bien, el servidor no tiene un certificado válido.`
          : `No se pudo conectar con ${this.host}:${this.puerto}. Revise el servidor y el puerto.`
      );
    }
    if (this.fase === 'starttls') {
      return new ErrorImap(`No se pudo cifrar la conexión con ${this.host} (STARTTLS): el certificado del servidor no es válido.`);
    }
    return new ErrorImap(texto || 'Error de conexión con el servidor de correo.');
  }

  fallar(e) {
    if (this.error) return;
    this.error = this.traducir(e);
    this.cerrarSocket();
    const espera = this.espera;
    this.espera = null;
    if (espera) espera.rechazar(this.error);
  }

  cerrarSocket() {
    this.lector = null;
    if (this.socket) {
      try {
        this.socket.close().catch(() => {});
      } catch {
        /* ya estaba cerrado */
      }
    }
  }

  cerrar() {
    if (!this.error) this.error = new ErrorImap('Conexión cerrada.');
    this.cerrarSocket();
  }

  conTiempo(promesa, mensaje, ms = this.tiempoMs) {
    let reloj;
    const limite = new Promise((_, rechazar) => {
      reloj = setTimeout(() => {
        const e = new ErrorImap(mensaje);
        this.fallar(e);
        rechazar(e);
      }, ms);
    });
    return Promise.race([promesa, limite]).finally(() => clearTimeout(reloj));
  }

  // ---- Lectura de respuestas ----

  alRecibir(trozo) {
    this.trozos.push(trozo);
    this.total += trozo.length;
    if (this.total < this.necesita) return;
    let buf = this.trozos.length === 1 ? this.trozos[0] : Buffer.concat(this.trozos);
    for (;;) {
      const r = this.extraer(buf);
      if (!r) break;
      buf = buf.subarray(r.consumido);
      this.necesita = 0;
      this.alResponder(r.partes);
    }
    this.trozos = buf.length ? [buf] : [];
    this.total = buf.length;
  }

  /** Una respuesta completa: texto y, si trae literales `{n}`, los bytes que siguen. */
  extraer(buf) {
    const partes = [];
    let pos = 0;
    for (;;) {
      const fin = buf.indexOf('\r\n', pos);
      if (fin === -1) {
        this.necesita = buf.length + 1;
        return null;
      }
      const linea = buf.toString('utf8', pos, fin);
      const literal = /\{(\d+)\}$/.exec(linea);
      if (!literal) {
        partes.push(linea);
        return { partes, consumido: fin + 2 };
      }
      const largo = Number(literal[1]);
      const inicio = fin + 2;
      if (buf.length < inicio + largo) {
        this.necesita = inicio + largo + 2;
        return null;
      }
      partes.push(linea.slice(0, literal.index), Buffer.from(buf.subarray(inicio, inicio + largo)));
      pos = inicio + largo;
    }
  }

  alResponder(partes) {
    const espera = this.espera;
    if (!espera) return;
    const primera = partes[0];
    if (espera.etiqueta === '*') {
      // Saludo inicial.
      this.espera = null;
      if (/^\* (OK|PREAUTH)/i.test(primera)) espera.resolver();
      else espera.rechazar(new ErrorImap(`El servidor de correo no aceptó la conexión: ${primera}`));
      return;
    }
    if (primera.startsWith(`${espera.etiqueta} `)) {
      this.espera = null;
      const m = /^\S+ (OK|NO|BAD)\s*(.*)$/i.exec(primera) || [];
      espera.resolver({ estado: (m[1] || 'BAD').toUpperCase(), texto: m[2] || primera, sinEtiqueta: espera.sinEtiqueta });
    } else if (primera.startsWith('* ')) {
      espera.sinEtiqueta.push({ partes });
    }
  }

  /** Envía una orden y espera su respuesta final. Rechaza si el servidor contesta NO o BAD. */
  comando(orden, { permitirNo = false, tiempoMs = this.tiempoMs } = {}) {
    if (this.error) return Promise.reject(this.error);
    if (this.espera) return Promise.reject(new ErrorImap('Hay otra orden en curso.'));
    this.contador += 1;
    const etiqueta = `A${String(this.contador).padStart(4, '0')}`;
    const respuesta = new Promise((resolver, rechazar) => {
      this.espera = { etiqueta, sinEtiqueta: [], resolver, rechazar };
    });
    this.escritor.write(codificador.encode(`${etiqueta} ${orden}\r\n`)).catch((e) => this.fallar(e));
    return this.conTiempo(respuesta, 'El servidor de correo tardó demasiado en responder.', tiempoMs).then((r) => {
      if (r.estado !== 'OK' && !permitirNo) throw new ErrorImap(r.texto || 'El servidor de correo rechazó la orden.');
      return r;
    });
  }

  // ---- Operaciones ----

  async login(usuario, clave) {
    try {
      await this.comando(`LOGIN ${entreComillas(usuario, 'usuario')} ${entreComillas(clave, 'contraseña')}`);
    } catch (e) {
      if (e instanceof ErrorImap && !/caracteres|tilde|conexi/.test(e.message)) {
        const pista = /application-specific|app password|contrase.a de aplicaci/i.test(e.message)
          ? ' Gmail exige una "contraseña de aplicación" (no la contraseña normal de la cuenta).'
          : '';
        throw new ErrorImap(`El servidor rechazó el usuario o la contraseña: ${e.message}${pista}`);
      }
      throw e;
    }
  }

  /** Abre la carpeta. `soloLectura` usa EXAMINE (no cambia nada en el buzón). */
  async seleccionar(carpeta, { soloLectura = false } = {}) {
    let r;
    try {
      r = await this.comando(`${soloLectura ? 'EXAMINE' : 'SELECT'} ${entreComillas(utf7(carpeta), 'carpeta')}`);
    } catch (e) {
      throw new ErrorImap(`No se pudo abrir la carpeta "${carpeta}": ${e.message}`);
    }
    const lineas = r.sinEtiqueta.map((x) => x.partes[0]);
    const existe = lineas.map((l) => /^\* (\d+) EXISTS/i.exec(l)).find(Boolean);
    const validez = lineas.map((l) => /UIDVALIDITY (\d+)/i.exec(l)).find(Boolean);
    const next = lineas.map((l) => /UIDNEXT (\d+)/i.exec(l)).find(Boolean);
    return { uidNext: next ? Number(next[1]) : null, mensajes: existe ? Number(existe[1]) : 0, uidValidez: validez ? validez[1] : null };
  }

  /** UID de los mensajes que cumplen el criterio, de menor a mayor. */
  async buscar(criterio) {
    const r = await this.comando(`UID SEARCH ${criterio}`);
    const uids = [];
    for (const x of r.sinEtiqueta) {
      const m = /^\* SEARCH\b(.*)$/i.exec(x.partes[0]);
      if (m) for (const n of m[1].trim().split(/\s+/)) if (/^\d+$/.test(n)) uids.push(Number(n));
    }
    return [...new Set(uids)].sort((a, b) => a - b);
  }

  async tamano(uid) {
    const r = await this.comando(`UID FETCH ${Number(uid)} (RFC822.SIZE)`);
    const m = r.sinEtiqueta.map((x) => /RFC822\.SIZE (\d+)/i.exec(x.partes[0])).find(Boolean);
    return m ? Number(m[1]) : 0;
  }

  /** El mensaje completo, sin marcarlo como leído (BODY.PEEK). */
  async mensaje(uid) {
    const r = await this.comando(`UID FETCH ${Number(uid)} (BODY.PEEK[])`, { tiempoMs: Math.max(this.tiempoMs, 90000) });
    for (const x of r.sinEtiqueta) {
      if (!/FETCH/i.test(x.partes[0])) continue;
      const cuerpo = x.partes.find((p) => Buffer.isBuffer(p));
      if (cuerpo) return cuerpo;
    }
    return null;
  }

  async marcarLeido(uid) {
    await this.comando(`UID STORE ${Number(uid)} +FLAGS.SILENT (\\Seen)`);
  }

  async salir() {
    if (!this.error && this.escritor) {
      try {
        await this.comando('LOGOUT', { permitirNo: true, tiempoMs: 5000 });
      } catch {
        /* da igual: ya nos íbamos */
      }
    }
    this.cerrar();
  }
}
