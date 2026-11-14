from gmail import export
import datetime as dt
import imaplib, json, pathlib, ssl, sys, tempfile, sqlite3, hashlib, shutil
import xml.etree.ElementTree as ET
ROOT = pathlib.Path.home() / 'Library/Application Support/CEDI Cargas XML'
ROOT.mkdir(exist_ok=True, parents=True)
db = sqlite3.connect(ROOT/'biblioteca.sqlite')
db.execute('create table if not exists docs (id text primary key, clave text, datos text, xml blob)')
db.execute('create table if not exists sources (id text, link text, unique(id,link))')

def ingest(path, link=''):
    data = path.read_bytes()
    root = ET.fromstring(data)
    for e in root.iter():
        e.tag = e.tag.rsplit('}',1)[-1]
    def val(node,key):
        return (node.findtext(key) or '').strip()
    key = val(root,'Clave')
    if not key:
        raise ValueError('Documento sin clave')
    uid = hashlib.sha256(data).hexdigest()
    msg = val(root,'Mensaje')
    status = {'1':'Aceptado','2':'Aceptado parcialmente','3':'Rechazado'}.get(msg,msg)
    lines = [[val(line,x) for x in ('CodigoComercial/Codigo','CodigoCABYS','Detalle','Cantidad','PrecioUnitario','MontoTotalLinea')] for line in root.findall('DetalleServicio/LineaDetalle')]
    doc = dict(tipo=root.tag,clave=key,fecha=val(root,'FechaEmision') or val(root,'FechaEmisionDoc'),emisor=val(root,'Emisor/Nombre') or val(root,'NombreEmisor'),receptor=val(root,'Receptor/Nombre') or val(root,'NombreReceptor'),total=val(root,'ResumenFactura/TotalComprobante') or val(root,'TotalFactura'),estado=status,aviso=val(root,'DetalleMensaje'),lineas=lines)
    with db:
        added=db.execute('insert or ignore into docs values (?,?,?,?)',(uid,key,json.dumps(doc),data)).rowcount
        if link: db.execute('insert or ignore into sources values (?,?)',(uid,link))
    return added

def run(req):
    mode=req['mode']
    if mode=='list':
        return [dict(json.loads(d),id=i,enlaces=[v[0] for v in db.execute('select link from sources where id=?',(i,))]) for i,d in db.execute('select id,datos from docs order by rowid desc')]
    if mode=='original':
        return db.execute('select xml from docs where id=?',(req['id'],)).fetchone()[0].decode('utf-8-sig',errors='replace')
    links={}
    if mode=='download':
        a,b=map(dt.date.fromisoformat,(req['start'],req['end']))
        if a>b: raise ValueError('Revisá las fechas.')
        with imaplib.IMAP4_SSL('imap.gmail.com',993,ssl_context=ssl.create_default_context(),timeout=60) as box:
            box.login(req['email'].strip(),''.join(req['password'].split()))
            folder=pathlib.Path(tempfile.mkdtemp(prefix='CEDI-XML-',dir=pathlib.Path.home()/'Downloads'))
            export(box,a,b,folder,req['email'].strip())
        paths=list(folder.glob('*.xml'))
        links={v['archivo']:v['enlaceCorreo'] for v in map(json.loads,(folder/'origenes.jsonl').read_text().splitlines())}
    elif mode=='import': paths=list(map(pathlib.Path,req['files']))
    else: raise ValueError('Acción desconocida')
    added=repeat=0
    errors=[]
    for p in paths:
        try:
            if ingest(p,links.get(p.name,'')): added+=1
            else: repeat+=1
        except (ValueError,OSError,ET.ParseError): errors.append(p.name)
    return f'{added} nuevos · {repeat} repetidos · {len(errors)} con error'+ ('\n'+', '.join(errors) if errors else '')
if __name__=='__main__':
    try: print(json.dumps({'ok':True,'value':run(json.load(sys.stdin))}))
    except Exception as e: print(json.dumps({'ok':False,'error':'Gmail rechazó el acceso. Revisá la cuenta, la clave de aplicación y el permiso IMAP.' if isinstance(e,imaplib.IMAP4.error) else str(e)}))
