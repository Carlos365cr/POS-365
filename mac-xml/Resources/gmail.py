"""Prueba local de lectura de XML de Gmail para POS 365."""
import datetime as dt
import email
import subprocess
import imaplib
import json
import pathlib
import re
import ssl
import tempfile
import xml.etree.ElementTree as ET
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


