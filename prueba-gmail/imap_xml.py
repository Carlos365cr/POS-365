"""Prueba local de lectura de XML de Gmail para Facturación CEDI."""
import datetime as dt
import email
import subprocess
import imaplib
import json
import pathlib
import re
import ssl
import tempfile
from urllib.parse import quote
from email import policy
from zoneinfo import ZoneInfo

DEFAULT_ACCOUNT = "operador@example.com"
ZONE = ZoneInfo("America/Costa_Rica")
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def imap_date(day):
    return f"{day.day:02}-{MONTHS[day.month - 1]}-{day.year}"


def checked(result):
    status, values = result
    if status != "OK":
        raise ValueError("Gmail no pudo completar la consulta.")
    return values


def export(box, start, last, folder, account):
    end = last + dt.timedelta(days=1)
    entries = checked(box.list())
    pattern = rb'^\(([^)]*)\) "[^"]*" (.+)$'
    folders = {}
    for entry in entries:
        match = re.fullmatch(pattern, entry) if isinstance(entry, bytes) else None
        if match:
            for role in (b'\\all', b'\\junk', b'\\trash'):
                if role in match[1].lower().split():
                    folders[role] = match[2]
    if b'\\all' not in folders:
        raise ValueError("Gmail no mostró la carpeta Todos. Revisá el acceso IMAP.")
    count = 0
    seen = set()
    with (folder / 'origenes.jsonl').open('x') as manifest:
        for name in folders.values():
            checked(box.select(name, readonly=True))
            ids = checked(box.uid('SEARCH', None, 'SINCE', imap_date(start-dt.timedelta(days=1)), 'BEFORE', imap_date(end+dt.timedelta(days=1))))[0].split()
            for uid in ids:
                rows = checked(box.uid('FETCH', uid, '(INTERNALDATE X-GM-MSGID)'))
                meta = next(v for v in rows if isinstance(v, bytes))
                stamp = re.search(rb'INTERNALDATE "([^"]+)"', meta)[1].decode()
                day, month, tail = stamp.split('-', 2)
                received = dt.datetime.strptime(f'{day}-{MONTHS.index(month)+1}-{tail}', '%d-%m-%Y %H:%M:%S %z').astimezone(ZONE)
                msg_id = int(re.search(rb'X-GM-MSGID (\d+)', meta)[1])
                if msg_id in seen or not start <= received.date() < end:
                    continue
                raw = next(v[1] for v in checked(box.uid('FETCH', uid, '(BODY.PEEK[])')) if isinstance(v, tuple))
                message = email.message_from_bytes(raw, policy=policy.default)
                for index, part in enumerate(message.walk()):
                    filename = part.get_filename() or ''
                    if not (filename.lower().endswith('.xml') or part.get_content_type() in ('text/xml','application/xml')):
                        continue
                    data = part.get_payload(decode=True)
                    if data is None:
                        raise ValueError("No se pudo leer un adjunto XML.")
                    target = folder / f'{msg_id:x}-{index}.xml'
                    target.write_bytes(data)
                    manifest.write(json.dumps(dict(archivo=target.name, nombreOriginal=filename, recibido=received.isoformat(), enlaceCorreo=f'https://mail.google.com/mail/u/?authuser={quote(account, safe="")}#all/{msg_id:x}'))+'\n')
                    count += 1
                seen.add(msg_id)
    return count


def main():
    selection = subprocess.run(
        ["osascript", "-e", "activate", "-e", f'text returned of (display dialog "Correo de Gmail o Google Workspace" default answer "{DEFAULT_ACCOUNT}" buttons {{"Cancelar", "Continuar"}} default button "Continuar" cancel button "Cancelar" with title "Correo · CEDI")'],
        capture_output=True, text=True, check=False,
    )
    if selection.returncode:
        return
    account = selection.stdout.strip()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", account):
        raise SystemExit("Ingresá una dirección de correo completa.")
    print('Prueba de CEDI con', account, flush=True)
    print('Esperando la clave en la ventana Probar Gmail · CEDI…', flush=True)
    dialog = subprocess.run(
        ["osascript", "-e", "activate", "-e", 'text returned of (display dialog "Pegá la contraseña de aplicación del correo seleccionado." default answer "" with hidden answer buttons {"Cancelar", "Probar conexión"} default button "Probar conexión" cancel button "Cancelar" with title "Probar Gmail · CEDI")'],
        capture_output=True, text=True, check=False,
    )
    if dialog.returncode:
        raise SystemExit("La ventana de la clave se canceló o no pudo abrirse. Volvé a ejecutar la prueba.")
    password = "".join(dialog.stdout.split())
    if len(password) != 16:
        raise SystemExit('No se recibió una clave de aplicación de 16 caracteres. La prueba terminó. Volvé a abrir el programa antes de pegar una clave.')
    with imaplib.IMAP4_SSL('imap.gmail.com', 993, ssl_context=ssl.create_default_context(), timeout=40) as box:
        try:
            checked(box.login(account, password))
        except imaplib.IMAP4.error:
            raise SystemExit('Gmail no aceptó el inicio de sesión IMAP. Revisá la cuenta, su clave de aplicación y el permiso IMAP. La prueba terminó.')
        print('Conexión con Gmail confirmada.')
        first = input('Fecha inicial AAAA-MM-DD (Enter para terminar solo la prueba): ').strip()
        if first:
            start = dt.date.fromisoformat(first)
            last = dt.date.fromisoformat(input('Fecha final AAAA-MM-DD: ').strip())
            if start > last:
                raise ValueError('Revisá las fechas.')
            folder = pathlib.Path(tempfile.mkdtemp(prefix='CEDI-XML-', dir=pathlib.Path.home()/'Downloads'))
            print('Carpeta:', folder)
            print('XML descargados:', export(box, start, last, folder, account))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, imaplib.IMAP4.error, EOFError, KeyboardInterrupt):
        raise SystemExit('La prueba no terminó. Revisá la conexión, el permiso IMAP, la clave de CEDI y las fechas.')
