"""Adapt the original POS only for local, read-only SQL catalog tests."""
from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
import argparse
import subprocess
parser=argparse.ArgumentParser()
parser.add_argument('--verify-main',action='store_true',help='Validate SQL integration against current origin/main without replacing the deployed UI')
args=parser.parse_args()
if args.verify_main:
 s=subprocess.check_output(['git','show','origin/main:work/cedi-current-inner.html'],cwd=root).decode('utf-8-sig')
else:
 s=(root/'work/cedi-current-inner.html').read_text(encoding='utf-8')
# UUID compatibility for non-secret UI identifiers on HTTP test origins.
compat = """<script>
if(typeof crypto.randomUUID!=='function'){
 crypto.randomUUID=function(){
 const b=crypto.getRandomValues(new Uint8Array(16));
 b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
 };
}
</script>"""
if '<head>' not in s: raise RuntimeError('No se encontro head')
s=s.replace('<head>','<head>'+compat,1)
s=s.replace('__CODEX_VISUALIZATION_WIDGET_STATE__','{}')
def replace(old,new):
 global s
 if s.count(old)!=1: raise RuntimeError('Original POS changed; review integration anchor: '+old[:90])
 s=s.replace(old,new)
replace('connect-src blob: data:;',"connect-src 'self' blob: data:;")
replace('globalThis.cediEntryModule = initialGlobals.entryModule;',"globalThis.cediEntryModule = null;")
replace('function initializePos(){', '''function initializePos(){
let sqlBusy=false, sqlSearchSequence=0;
async function sqlProduct(code){
 const response=await fetch('/api/pos/product?'+new URLSearchParams({code,list:0}),{cache:'no-store'});
 const p=await response.json();if(!response.ok)throw Error(p.error||'No se pudo consultar SQL.');
 return {...p,codes:[p.code,p.barcode].filter(Boolean),details:{general:[],costs:[],prices:[],promotions:{scannerEnabled:false,scaleEnabled:false}}};
}
''')
replace('entry.onsubmit=event=>{\nevent.preventDefault();', '''entry.onsubmit=async event=>{
event.preventDefault();
if(sqlBusy)return;
''')
start=s.index('const matches=forcedPosProduct?',s.index('entry.onsubmit=async'))
end=s.index("if(product.currency!=='Colón')",start)
s=s[:start]+'''let product;sqlBusy=true;entry.inert=true;
try{product=await sqlProduct(code);}
catch(error){feedback.textContent=error.message;return;}
finally{sqlBusy=false;entry.inert=false;}
forcedPosProduct=null;
'''+s[end:]
replace("if(/^NC[0-9A-F]{24}$/i.test(code)){", "if(/^NC[0-9A-F]{24}$/i.test(code)){feedback.textContent='Notas comerciales pendientes de migración.';return;}\nif(false){")
start=s.index('function searchPosProducts(){');end=s.index('\nfunction openPosProducts()',start)
s=s[:start]+'''async function searchPosProducts(){
 const sequence=++sqlSearchSequence;
 posProductMatches=[];posProductIndex=0;renderPosProducts();
 posProductDialog.querySelector('[data-count]').textContent='Consultando SQL Server…';
 try{
  const response=await fetch('/api/catalog/products?'+new URLSearchParams({q:posProductQuery.value,page:1}),{cache:'no-store'});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Error SQL.');
  if(sequence!==sqlSearchSequence)return;
  posProductMatches=data.items.map(p=>({...p,details:{promotions:{scannerEnabled:false,scaleEnabled:false}}}));renderPosProducts();
  if(data.hasMore)posProductDialog.querySelector('[data-count]').textContent+=' Refine la búsqueda: se muestran las primeras 50 coincidencias.';
 }catch(error){if(sequence===sqlSearchSequence)posProductDialog.querySelector('[data-count]').textContent=error.message;}
}
'''+s[end:]
replace('function openPaymentMethod(){',"function openPaymentMethod(){paymentPanel.querySelector('[data-pos-balance]').textContent='Cobro pendiente de migración. No se guardó ninguna venta.';return;\n")
replace('async function completeTrialPayment(method){',"async function completeTrialPayment(method){throw Error('Ventas SQL pendientes de migración.');\n")
snapshot_anchor=re.search(r'function persistTrialSnapshot\(requireConfirmation=false,blockEmail,voucherOp(?:,boxSizeOp)?\)\{',s)
if not snapshot_anchor: raise RuntimeError('No se encontro persistTrialSnapshot')
snapshot_signature=snapshot_anchor.group(0)
replace(snapshot_signature,snapshot_signature+"if(requireConfirmation)throw Error('Operación no migrada a SQL Server.');return;\n")
replace("const entryModule=[...menu.querySelectorAll('button.menu-item')]", "for(const b of menu.querySelectorAll('button')){const name=b.textContent.trim();const group=b.getAttribute('aria-controls')==='article-menu-options';if(!group&&!['Inicio','Facturación POS','Artículos','Propiedad artículo','Propiedad de artículo','Cargas XML','Cerrar sesión','Usuarios y permisos'].includes(name)){b.disabled=true;b.title='Pendiente de migración a SQL Server';}}\nconst entryModule=[...menu.querySelectorAll('button.menu-item')]")
replace('const saleDate=posMain.querySelector', '''const sqlNotice=document.createElement('p');sqlNotice.style.cssText='padding:12px;background:#fff1d0;color:#493400';sqlNotice.textContent='DESARROLLO SQL · Pantalla original · Lista 0 · Detalle temporal. Sin guardar ventas, pagos ni inventario. Costos y promociones aún no migrados.';posMain.prepend(sqlNotice);
const saleDate=posMain.querySelector''')
replace('async function restoreTrialState(){', 'async function restoreTrialState(){return;\n')
# Disable clear while a lookup is in flight, so delayed responses cannot refill a cleared cart.
s=s.replace("posMain.querySelector('[data-pos-clear]').onclick=()=>{", "posMain.querySelector('[data-pos-clear]').onclick=()=>{if(sqlBusy)return;")
# Add a draft-only action beside the original payment controls.
# This NEVER invokes completeTrialPayment or the fiscal/stock paths.
sql_payment_bridge = r"""
(() => {
 const sqlKnownProducts = new Map();
 const oldSqlProduct = sqlProduct;
 sqlProduct = async function(code) {
   const p = await oldSqlProduct(code);
   if(p && p.id) {
     for(const key of [p.code,p.barcode,p.name,code]) {
       if(key)sqlKnownProducts.set(String(key).trim().toLowerCase(),p);
     }
   }
   return p;
 };
 let sqlDraftBusy=false, lastDraftRequest=null;
 function sqlMoney(v){return Number(Number(v).toFixed(4));}
 function findSqlLine(line) {
   const source=line.product||line.article||line.articulo||line;
   for(const key of [source.id,source.productId,source.code,source.barcode,source.name,
                     line.code,line.barcode,line.name,line.description]) {
     const product=sqlKnownProducts.get(String(key??'').trim().toLowerCase());
     if(product)return product;
   }
   if(lines.length===1 && new Set(sqlKnownProducts.values()).size===1) {
      const only=[...sqlKnownProducts.values()][0];
      if(posMain.textContent.includes(only.name))return only;
   }
   throw Error('No se pudo identificar de forma segura un articulo de la pantalla. Vuelva a escanearlo.');
 }
 function quantityOf(line,index) {
   for(const value of [line.quantity,line.qty,line.cantidad,line.cant,line.units,line.count]) {
     const n=Number(value);
     if(Number.isInteger(n)&&n>0&&n<=99999)return n;
   }
   // Read visible first column only for the single-line POS test.
   if(lines.length===1 && index===0) {
      const cells=[...posMain.querySelectorAll('td')];
      const n=Number(cells[0]?.textContent?.trim());
      if(Number.isInteger(n)&&n>0&&n<=99999)return n;
   }
   throw Error('No se pudo validar la cantidad de la linea '+(index+1)+'.');
 }
 async function sqlSaveDraft() {
   if(sqlDraftBusy)return;
   sqlDraftBusy=true;
   const button=paymentPanel.querySelector('[data-sql-draft-button]');
   if(button)button.disabled=true;
   try {
     if(!Array.isArray(lines)||lines.length===0)throw Error('Agregue articulos antes de guardar.');
     if(lines.length>100)throw Error('Limite de 100 renglones para la prueba.');
     const mapped=lines.map((l,i)=>({product:findSqlLine(l),quantity:quantityOf(l,i)}));
     // Never reuse an idempotency key for different cart contents.
     const total=sqlMoney(mapped.reduce((sum,l)=>sum+Number(l.product.price)*l.quantity,0));
     if(!Number.isFinite(total)||total<=0)throw Error('Importes invalidos.');
     // Confirm the displayed amount agrees before sending any data.
     const shown=Number(saleExactTotalCents)/100;
     if(!Number.isFinite(shown)||Math.abs(shown-total)>0.0001)
       throw Error('El total original no coincide con el precio SQL. Descuentos, promociones e impuestos pendientes de migracion.');
     if(mapped.length!==1)
       throw Error('La prueba de IVA automatico admite un solo renglon por ahora.');
     const productId=mapped[0].product.id;
     const taxResponse=await fetch('/api/catalog/products/'+encodeURIComponent(productId)+'/tax',{cache:'no-store'});
     const taxData=await taxResponse.json().catch(()=>({}));
     if(!taxResponse.ok)throw Error(taxData.error||'No se pudo consultar la tarifa IVA.');
     if(taxData.rate===null || taxData.rate===undefined)
       throw Error('Configure una tarifa IVA en Articulos SQL antes de guardar.');
     if(taxData.includesVAT!==true)
       throw Error('El calculo con precio sin IVA aun no esta migrado.');
     const rate=Number(taxData.rate);
     if(!Number.isFinite(rate)||rate<0||rate>100)throw Error('Tarifa SQL no valida.');
     const tax=sqlMoney(Math.round((total-total/(1+rate/100))*100)/100);
     const subtotal=sqlMoney(total-tax);
     const body={registerCode:'Caja-DEV',expectedTotal:total,
        lines:[{productId,quantity:mapped[0].quantity,tax:null}],
        payments:[{method:'EFECTIVO-PRUEBA',amount:total}]};
     const fingerprint=JSON.stringify(body);
     if(lastDraftRequest?.fingerprint!==fingerprint)
       lastDraftRequest={fingerprint,requestId:crypto.randomUUID()};
     body.requestId=lastDraftRequest.requestId;
     if(!confirm('Guardar BORRADOR SQL de prueba? Total: '+total.toFixed(2)+'; subtotal: '+subtotal.toFixed(2)+'; IVA calculado con tarifa SQL '+rate+'%: '+tax.toFixed(2)+'. No hay validacion fiscal oficial, pago real ni inventario.'))return;
     const response=await fetch('/api/pos/drafts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
     const data=await response.json().catch(()=>({}));
     if(!response.ok)throw Error(data.error||'No se confirmo el borrador.');
     alert('Borrador SQL '+(data.alreadySaved?'ya existente':'guardado')+': '+data.draftId+
        '\nEstado: Draft. No es factura fiscal. Total: '+data.total);
   }catch(error){alert('No se guardo el borrador SQL: '+error.message);}
   finally{sqlDraftBusy=false;if(button)button.disabled=false;}
 }
 // The payment pane is part of the original POS. Add a distinct button rather
 // than hijacking the original Guardar handler, which still must remain blocked.
 setTimeout(()=>{
   if(!paymentPanel || paymentPanel.querySelector('[data-sql-draft-button]'))return;
   const button=document.createElement('button');
   button.type='button';button.dataset.sqlDraftButton='true';
   button.textContent='Guardar borrador SQL (prueba)';
   button.style.cssText='padding:8px 12px;background:#176b8b;color:white;border:0;border-radius:6px;margin:8px';
   button.onclick=sqlSaveDraft;
   const target=[...paymentPanel.querySelectorAll('button')].find(b=>b.textContent.trim()==='Guardar');
   if(target)target.after(button);else paymentPanel.append(button);
 },0);
})();
"""
# Inject inside initializePos body so lines and saleExactTotalCents resolve in the
# same lexical scope. Runtime initialization is deferred until its DOM is ready.
replace('function initializePos(){', 'function initializePos(){\n'+sql_payment_bridge+'\n')

# The original module already captures General, Costs and Prices through
# captureTrialForm(). Replace its historical Process handler with a SQL transaction.
native_process=(root/'scripts/native-article-process.js').read_text(encoding='utf-8')
handler_anchor="for(const target of [form,costsForm,priceForm]){\ntarget.noValidate=true;\ntarget.onsubmit=saveTrialArticle;"
if s.count(handler_anchor)!=1:
 raise RuntimeError('Cambio en el guardado original; revisar el anclaje SQL.')
s=s.replace(handler_anchor,native_process+"\nfor(const target of [form,costsForm,priceForm]){\ntarget.noValidate=true;\ntarget.onsubmit=saveSqlArticle;")
replace('processButton.onclick=saveTrialArticle;', 'processButton.onclick=saveSqlArticle;')
original_search_start=s.index('function searchArticleForOperation(){')
original_search_end=s.index('const trialSearchStyle=',original_search_start)
s=s[:original_search_start]+'''function searchArticleForOperation(){
 return searchSqlArticle();
}
'''+s[original_search_end:]

# Keep the original article properties markup and styles; replace only storage handlers.
a=s.index('function installArticleProperties(){')
b=s.index('root.append(style,main);',a)+len('root.append(style,main);')
c=s.index('refreshArticleProperties=()=>',b)
d=s.index('item.onclick=',c)
e=s.index('\n}',d)+2
properties=(root/'scripts/native-article-properties.js').read_text(encoding='utf-8')
s=s[:b]+'\n'+properties+'\n}'+s[e:]

# Preserve the original XML module layout while replacing its cloud behavior.
a=s.index('function installXmlInboxModule(){')
b=s.index('root.append(style,main);',a)+len('root.append(style,main);')
c=s.index('\nfunction emptyCompanyHeader()',b)
s=s[:b]+r'''
const status=main.querySelector('[data-inbox-status]'),from=main.querySelector('[data-inbox-from]'),to=main.querySelector('[data-inbox-to]'),mail=main.querySelector('[data-inbox-mail]');
for(const x of main.querySelectorAll('fieldset button,fieldset input,fieldset select,[data-inbox-files]'))x.disabled=true;
const accountBox=main.querySelector('[data-inbox-accounts]');
const addAccount=main.querySelector('[data-inbox-add]'),saveAccount=main.querySelector('[data-inbox-save]');
const secure=location.protocol==='https:' || location.protocol==='http:';
let savedAccounts=[];
const picker=window.document.createElement('select');picker.setAttribute('aria-label','Cuenta para cargar XML');
accountBox.before(picker);
const note=window.document.createElement('p');note.textContent='Seleccione una cuenta o agregue una nueva. Sincronización automática pendiente.';if(location.protocol==='http:'){note.textContent+=' HTTP de pruebas: use datos y credenciales desechables.';}
accountBox.after(note);
addAccount.disabled=!secure;saveAccount.disabled=true;
function accountButton(label,fn){const b=window.document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;}
function accountInput(row,label,type,value=''){const l=window.document.createElement('label');l.textContent=label;const i=window.document.createElement('input');i.type=type;i.value=value;i.autocomplete=type==='password'?'new-password':'off';l.append(i);row.append(l);return i;}
async function loadAccounts(){
 const selected=picker.value;
 savedAccounts=await api('/api/purchases/inbox/accounts');
 picker.replaceChildren();const empty=window.document.createElement('option');empty.value='';empty.textContent='Seleccione cuenta Gmail';picker.append(empty);
 accountBox.replaceChildren();saveAccount.disabled=true;
 for(const a of savedAccounts){
 const o=window.document.createElement('option');o.value=a.id;o.textContent=a.email;picker.append(o);
 const row=window.document.createElement('div');row.className='xml-account-row';
 const title=window.document.createElement('span');title.textContent=a.email+' | Receptor: '+a.receiverId;row.append(title);
 const remove=accountButton('Quitar',async()=>{if(!secure||!confirm('¿Quitar esta cuenta de correo?'))return;try{await api('/api/purchases/inbox/accounts/'+encodeURIComponent(a.id),{method:'DELETE'});await loadAccounts();}catch(e){status.textContent=e.message;}});remove.disabled=!secure;row.append(remove);accountBox.append(row);
 }
 if(savedAccounts.some(a=>a.id===selected))picker.value=selected;else if(savedAccounts.length===1)picker.value=savedAccounts[0].id;
 mail.disabled=busy||!picker.value;
}
picker.onchange=()=>{mail.disabled=busy||!picker.value;};
addAccount.onclick=()=>{
 if(!secure||accountBox.querySelector('[data-new-mail-account]'))return;
 const row=window.document.createElement('div');row.dataset.newMailAccount='1';row.className='xml-account-row';
 const email=accountInput(row,'Gmail','email'),password=accountInput(row,'Contraseña de aplicación','password'),receiver=accountInput(row,'Cédula receptora','text');
 const payload=()=>({email:email.value.trim(),password:password.value,receiverId:receiver.value.trim()});
 async function sendAccount(test){
 if(!secure)return;row.inert=true;saveAccount.disabled=true;
 try{await api('/api/purchases/inbox/accounts'+(test?'/test':''),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});status.textContent=test?'Conexión correcta.':'Cuenta guardada.';if(!test){password.value='';await loadAccounts();}}
 catch(e){status.textContent=e.message;}finally{row.inert=false;saveAccount.disabled=!accountBox.querySelector('[data-new-mail-account]');}
 }
 row.append(accountButton('Probar conexión',()=>sendAccount(true)),accountButton('Cancelar',()=>{password.value='';row.remove();saveAccount.disabled=true;}));
 accountBox.append(row);saveAccount.disabled=false;saveAccount.onclick=()=>sendAccount(false);email.focus();
};
from.value=cashOutToday().slice(0,8)+'01';to.value=cashOutToday();
let rows=[],page=0,busy=false;mail.disabled=true;
const head=main.querySelector('.xml-inbox-table thead'),body=main.querySelector('.xml-inbox-table tbody');
const prev=main.querySelector('[data-inbox-prev]'),next=main.querySelector('[data-inbox-next]');
const hr=window.document.createElement('tr');for(const label of ['Detalle','Estado SQL','Tipo','Emisión','Cédula emisor','Emisor','Clave electrónica','Moneda','Total']){const th=window.document.createElement('th');th.textContent=label;hr.append(th);}head.append(hr);
function renderSql(){
 body.replaceChildren();
 page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(rows.length/15)-1)));
 for(const d of rows.slice(page*15,page*15+15)){
 const tr=window.document.createElement('tr'),td=window.document.createElement('td');
 for(const label of ['Ver artículos','Ingresar compras']){const b=window.document.createElement('button');b.type='button';b.textContent=label;b.disabled=true;td.append(b);}tr.append(td);
 for(const v of [d.status,d.type,d.date,d.supplierId,d.supplier,d.key,d.currency,d.total]){const cell=window.document.createElement('td');cell.textContent=v??'';tr.append(cell);}body.append(tr);
 }
 main.querySelector('[data-inbox-summary]').textContent=rows.length+' comprobantes SQL (máximo 500)';
 main.querySelector('[data-inbox-page]').textContent=(page+1)+' / '+Math.max(1,Math.ceil(rows.length/15));prev.disabled=page===0;next.disabled=(page+1)*15>=rows.length;
}
prev.onclick=()=>{page--;renderSql();};next.onclick=()=>{page++;renderSql();};
async function api(url,opt){const r=await fetch(url,{cache:'no-store',...opt});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||d.detail||('HTTP '+r.status));return d;}
async function refreshSql(){try{rows=await api('/api/purchases/inbox/');page=0;renderSql();}catch(e){status.textContent=e.message;}}
mail.onclick=async()=>{if(busy||!picker.value)return;const accountId=picker.value;busy=true;picker.disabled=true;mail.disabled=true;status.textContent='Consultando correo…';try{
 let offset=0,inserted=0,duplicate=0,ignored=0,errors=0;
 for(let batch=0;batch<100;batch++){const d=await api('/api/purchases/inbox/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:from.value,to:to.value,offset,accountId})});inserted+=d.inserted;duplicate+=d.duplicate;ignored+=d.ignored;errors+=d.errors;if(!d.remaining)break;if(d.nextOffset<=offset||batch===99)throw Error('Consulta parcial; reduzca el rango.');offset=d.nextOffset;}
 status.textContent='Nuevos: '+inserted+' | Duplicados: '+duplicate+' | Ignorados: '+ignored+' | Errores: '+errors;
 }catch(e){status.textContent=e.message;}finally{await refreshSql();busy=false;picker.disabled=false;mail.disabled=!picker.value;}};
refreshXmlInbox=()=>{if(!main.hidden)refreshSql();};
for(const other of menu.querySelectorAll('.menu-item')){if(other===item)continue;const previous=other.onclick;other.onclick=function(...args){main.hidden=true;item.classList.remove('selected');item.removeAttribute('aria-current');return previous?.apply(this,args);};}
item.onclick=()=>{showConfiguration(false);for(const view of Array.from(root.children).filter(view=>view.tagName==='MAIN'))view.hidden=view!==main;menu.querySelectorAll('.menu-item').forEach(b=>{b.classList.remove('selected');b.removeAttribute('aria-current');});main.hidden=false;item.classList.add('selected');item.setAttribute('aria-current','page');refreshSql();loadAccounts().catch(e=>{status.textContent=e.message;mail.disabled=true;});};
}
'''+s[c:]

body_end=s.lower().rfind('</body>')
if body_end<0: raise RuntimeError('No se encontro el cierre real del documento POS.')
s=s[:body_end]+'''<script>
document.addEventListener('DOMContentLoaded',()=>{
 const shell=document.getElementById('articulos-cedi');
 const menu=shell?.querySelector(':scope>aside');
 if(!menu)return;
 const name=b=>b.getAttribute('aria-label')||b.textContent.trim();
 const allowed=new Set(['Inicio','Facturación POS','Artículos','Propiedad artículo','Propiedad de artículo','Cargas XML','Cerrar sesión','Usuarios y permisos']);
 const group=b=>b.getAttribute('aria-controls')==='article-menu-options';
 for(const b of menu.querySelectorAll('button')){
   if(group(b)){b.disabled=false;continue;}
   if(!allowed.has(name(b))){b.disabled=true;b.title='Pendiente de migración a SQL Server';}
 }
 for(const b of shell.querySelectorAll('[data-home-target]')){
   if(!allowed.has(b.dataset.homeTarget)){b.disabled=true;b.title='Pendiente de migración a SQL Server';}
 }
 const users=[...menu.querySelectorAll('button')].find(b=>name(b)==='Usuarios y permisos');
 const logout=[...menu.querySelectorAll('button')].find(b=>name(b)==='Cerrar sesión');
 if(users){users.disabled=true;users.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();location.href='/usuarios.html';},true);}
 if(logout){logout.disabled=false;logout.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();try{const r=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});if(!r.ok)throw Error('No se pudo cerrar la sesión');location.replace('/login');}catch(err){alert(err.message);}},true);}
 fetch('/api/auth/me',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Sesión no disponible');return r.json();}).then(u=>{shell.dataset.businessName='POS365_DEV';shell.dataset.signedInUser=u.username||'';if(users)users.disabled=!u.admin;}).catch(()=>{if(users)users.disabled=true;});
 const props=[...menu.querySelectorAll('button')].filter(b=>['Propiedad artículo','Propiedad de artículo'].includes(name(b))||['Propiedad artículo','Propiedad de artículo'].includes(b.textContent.trim()));
 for(const b of props){b.disabled=true;fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(u=>{b.disabled=!u?.admin;if(u?.admin)b.removeAttribute('title');}).catch(()=>{b.disabled=true;});}
 const btn=[...menu.querySelectorAll('button')].find(b=>name(b)==='Cargas XML');
 if(btn){btn.disabled=true;fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(u=>{btn.disabled=!u?.admin;}).catch(()=>{btn.disabled=true;});}
});
</script>'''+s[body_end:]
if args.verify_main:
 out=root/'src/POS365.Local/wwwroot/pos-original.html'
 print('Validacion de anclajes SQL contra origin/main completada; no se modifico',out)
else:
 out=root/'src/POS365.Local/wwwroot/pos-original.html';out.write_text(s,encoding='utf-8')
print('POS original conectado a consulta SQL:',out)
