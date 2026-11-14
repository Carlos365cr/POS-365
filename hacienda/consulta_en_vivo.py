import base64
import binascii
import json
import re
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

TOKEN = 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token'
RECEPCION = 'https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/'

class SinRedireccion(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None

def leer_json(request, paso):
    request.add_header('Accept', 'application/json')
    request.add_header('User-Agent', 'CEDI-Verificador/1.0')
    try:
        with urllib.request.build_opener(SinRedireccion()).open(request, timeout=35) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        try:
            payload = json.loads(exc.read(8192))
        except (ValueError, UnicodeError, OSError):
            payload = {}
        error = payload.get('error') if isinstance(payload, dict) else None
        motivos = {
            'invalid_grant': 'El servicio rechazó la autorización de la cuenta.',
            'invalid_client': 'El servicio rechazó la identificación de la aplicación.',
            'access_denied': 'El servicio denegó el acceso solicitado.',
        }
        detalle = motivos.get(error) if isinstance(error, str) else None
        if not detalle:
            if exc.headers.get('cf-mitigated') == 'challenge':
                detalle = 'El filtro de seguridad solicitó una verificación interactiva.'
            elif 'html' in exc.headers.get('Content-Type', '').lower():
                detalle = 'El servidor devolvió una página HTML sin un motivo de autenticación reconocible.'
            else:
                detalle = 'La respuesta no especifica un motivo reconocido por CEDI.'
        referencia = exc.headers.get('cf-ray', '')
        if re.fullmatch(r'[0-9a-fA-F]{12,32}(?:-[A-Z]{3})?', referencia):
            detalle += ' Referencia para soporte: ' + referencia
        raise ValueError(f'{paso}: HTTP {exc.code}. {detalle}') from None
    except (OSError, UnicodeError, ValueError):
        raise ValueError(f'{paso}: no se pudo obtener una respuesta válida de Hacienda. Revisá la conexión.') from None

def consultar(clave, credenciales):
    if not re.fullmatch(r'[0-9]{50}', clave):
        raise ValueError('La clave debe tener 50 dígitos.')
    datos = {}
    for linea in credenciales.splitlines():
        campo, _, valor = linea.partition(':')
        datos[campo.strip().casefold()] = valor.strip()
    if not datos.get('usuario') or not datos.get('contraseña'):
        raise ValueError('Elegí el TXT de credenciales de Hacienda con usuario y contraseña.')
    formulario = urllib.parse.urlencode(dict(grant_type='password', client_id='api-prod', client_secret='',
        username=datos['usuario'], password=datos['contraseña'])).encode()
    token = leer_json(urllib.request.Request(TOKEN, data=formulario), 'Inicio de sesión').get('access_token')
    if not token:
        raise ValueError('Hacienda no devolvió autorización.')
    resultado = leer_json(urllib.request.Request(RECEPCION + clave, headers={
        'Authorization': 'Bearer ' + token}), 'Consulta')
    if resultado.get('clave') != clave or not resultado.get('ind-estado'):
        raise ValueError('La respuesta no confirma la clave y el estado solicitados.')
    mensaje = 'Estado informado por Hacienda: ' + resultado['ind-estado']
    if resultado.get('respuesta-xml'):
        xml = base64.b64decode(''.join(resultado['respuesta-xml'].split()), validate=True)
        raiz = ET.fromstring(xml)
        if raiz.findtext('{*}Clave') != clave:
            raise ValueError('La clave del XML recibido no coincide.')
        with tempfile.NamedTemporaryFile(prefix='Respuesta-MH-', suffix='.xml',
                dir=Path.home()/'Downloads', delete=False) as archivo:
            archivo.write(xml)
        mensaje += '\nTotal: ' + str(raiz.findtext('{*}TotalFactura') or 'sin informar')
        mensaje += '\nImpuesto: ' + str(raiz.findtext('{*}MontoTotalImpuesto') or 'sin informar')
        mensaje += '\nXML en Descargas: ' + Path(archivo.name).name
    return mensaje

def dialogo(script, *args):
    return subprocess.run(['osascript', '-', *args], input=script, text=True,
                          capture_output=True, check=True).stdout.strip()

def main():
    try:
        clave = dialogo('text returned of (display dialog "Clave electrónica de 50 dígitos" default answer "" with title "CEDI · Consulta en vivo")')
        ruta = dialogo('POSIX path of (choose file with prompt "Elegí el TXT de credenciales de Hacienda")')
        mensaje = consultar(clave.strip(), Path(ruta).read_text(encoding='utf-8-sig'))
    except subprocess.CalledProcessError:
        return
    except (ValueError, OSError, ET.ParseError, binascii.Error) as exc:
        mensaje = str(exc)
    dialogo('on run argv\ndisplay dialog (item 1 of argv) with title "CEDI · Hacienda" buttons {"Cerrar"} default button 1\nend run', mensaje)

if __name__ == '__main__':
    main()
