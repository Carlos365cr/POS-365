from pathlib import Path
import re,json
root=Path(__file__).resolve().parents[1]
view=(root/'work/commercial-notes/view.html').read_text()
scripts=re.findall(r'<script>([\s\S]*?)</script>',view)
markup=re.sub(r'<script>[\s\S]*?</script>','',view)
installer=(root/'work/commercial-notes/install.js').read_text().replace('COMMERCIAL_NOTE_MARKUP',json.dumps(markup,ensure_ascii=True).replace('<','\\u003c')).replace('COMMERCIAL_NOTE_SCRIPTS','\n'.join(scripts))
for name in ['cedi-current-inner.html','cedi-legacy-purchases.html']:
 p=root/'work'/name;s=p.read_text()
 if '// commercial-notes-start' in s:s=re.sub(r'// commercial-notes-start[\s\S]*?// commercial-notes-end',lambda m:'// commercial-notes-start\n'+installer+'\n// commercial-notes-end',s,count=1)
 else:s=s.replace('function installReceipts(){','// commercial-notes-start\n'+installer+'\n// commercial-notes-end\nfunction installReceipts(){',1).replace('installReceipts();','installReceipts();\ninstallCommercialNotes();',1)
 s=s.replace("'Productos restringidos','Cargas XML'","'Productos restringidos','Notas Comercial Internos','Cargas XML'")
 p.write_text('\n'.join(line.rstrip() for line in s.split('\n')))
# Keep server implementation in the worker artifact consumed by the existing publisher.
p=root/'cloudflare/_worker.js';s=p.read_text();start=s.index('// Internal commercial notes.');end=s.index('export default { async fetch',start);s=s[:start]+(root/'work/commercial-notes/server.js').read_text()+'\n'+s[end:];p.write_text('\n'.join(line.rstrip() for line in s.split('\n')))
