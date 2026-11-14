from pathlib import Path
from zipfile import ZipFile
import sys
root=Path(__file__).resolve().parent
out=Path(sys.argv[1]);out.mkdir(exist_ok=True,parents=True)
import shutil, html
shutil.copytree(root.parent/'plantilla', out, dirs_exist_ok=True)
f=out/'index.html'
template=f.read_text()
for source,page in [('cedi-current-inner.html','index.html'),('cedi-legacy-purchases.html','compras-formato-viejo.html')]:
    s=template.replace('__CEDI_UI__', html.escape((root.parent/'work'/source).read_text(), quote=True))
    start=s.index('// Origin-local backups');end=s.index('</script>',start)
    s=s[:start]+s[end:]
    s=s.replace('connect-src blob: data:',"connect-src 'self' blob: data:",1)
    bridge=(root/'bridge.js').read_text()
    if source=='cedi-legacy-purchases.html':
        bridge=bridge.replace("const storePrefix='/api';","const storePrefix='/api/legacy-purchases';")
    s=s.replace('</iframe>\n\n<script>(() => {','</iframe>\n<script>'+ bridge+'</script>\n<script>(async () => {',1)
    assert s.count('async () => {\n  const frame')==1
    target='const initialGlobals = {\n    widgetState: state,'
    assert s.count(target)==1
    s=s.replace(target,'const initialGlobals = {\n    widgetState: {privateContent: await loadShared()},',1)
    target='delete frame.dataset.srcdoc;'
    pos=s.index(target);close=s.index('})();',pos);s=s[:close]+s[close:].replace('})();','})().catch(error=>stop(error.message));',1)
    if page=='index.html':
        s=s.replace('widgetState: {privateContent: await loadShared()},',"widgetState: {privateContent: await loadShared()}, openPurchases: location.search==='?modulo=compras',",1)
    (out/page).write_text(s)
(out/'_worker.js').write_bytes((root/'_worker.js').read_bytes())
