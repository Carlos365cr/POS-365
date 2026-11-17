// Cifrado de las contraseñas de los buzones antes de guardarlas en D1 (AES-GCM con Web Crypto).
// La llave sale del secreto CLAVE_CIFRADO del Worker: `npx wrangler secret put CLAVE_CIFRADO`.

import { Buffer } from 'node:buffer';

const codificador = new TextEncoder();
const llaves = new Map();

function llave(secreto) {
  if (!secreto || String(secreto).length < 32) {
    throw new Error('Falta el secreto CLAVE_CIFRADO del Worker o es muy corto (mínimo 32 caracteres).');
  }
  if (!llaves.has(secreto)) {
    llaves.set(
      secreto,
      crypto.subtle.digest('SHA-256', codificador.encode(secreto)).then((hash) => crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']))
    );
  }
  return llaves.get(secreto);
}

/** Texto → "v1:<iv>:<cifrado>" en base64. */
export async function cifrar(texto, secreto) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await llave(secreto), codificador.encode(String(texto)));
  return `v1:${Buffer.from(iv).toString('base64')}:${Buffer.from(cifrado).toString('base64')}`;
}

/** Lo inverso de cifrar(). Devuelve null si no se puede (dato dañado o el secreto cambió). */
export async function descifrar(guardado, secreto) {
  const [version, iv, datos] = String(guardado || '').split(':');
  if (version !== 'v1' || !iv || !datos) return null;
  try {
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(iv, 'base64') }, await llave(secreto), Buffer.from(datos, 'base64'));
    return new TextDecoder().decode(plano);
  } catch {
    return null;
  }
}
