"""Adapt the original POS only for local, read-only SQL catalog tests."""
from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
s=(root/'work/cedi-current-inner.html').read_text(encoding='utf-8')
def replace(old,new):
 global s
 if s.count(old)!=1: raise RuntimeError('Original POS changed; review integration anchor: '+old[:90])
 s=s.replace(old,new)
replace('connect-src blob: data:;',"connect-src 'self' blob: data:;")
replace('globalThis.cediEntryModule = initialGlobals.entryModule;',"globalThis.cediEntryModule = 'Facturación POS';")
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
replace('function persistTrialSnapshot(requireConfirmation=false,blockEmail,voucherOp){',"function persistTrialSnapshot(requireConfirmation=false,blockEmail,voucherOp){if(requireConfirmation)throw Error('Operación no migrada a SQL Server.');return;\n")
replace("const entryModule=[...menu.querySelectorAll('button.menu-item')]", "for(const b of menu.querySelectorAll('button')){if(b.textContent.trim()!=='Facturación POS')b.disabled=true;}\nconst entryModule=[...menu.querySelectorAll('button.menu-item')]")
replace('const saleDate=posMain.querySelector', '''const sqlNotice=document.createElement('p');sqlNotice.style.cssText='padding:12px;background:#fff1d0;color:#493400';sqlNotice.textContent='DESARROLLO SQL · Pantalla original · Lista 0 · Detalle temporal. Sin guardar ventas, pagos ni inventario. Costos y promociones aún no migrados.';posMain.prepend(sqlNotice);
const saleDate=posMain.querySelector''')
replace('async function restoreTrialState(){', 'async function restoreTrialState(){return;\n')
# Disable clear while a lookup is in flight, so delayed responses cannot refill a cleared cart.
s=s.replace("posMain.querySelector('[data-pos-clear]').onclick=()=>{", "posMain.querySelector('[data-pos-clear]').onclick=()=>{if(sqlBusy)return;")
# SQL maintenance access from the original application without allowing legacy writes.
# This interim bridge avoids showing an empty legacy catalog as if it were SQL data.
maintenance_bridge = r"""
<script>
(() => {
  let scheduling = false;
  function attach() {
    scheduling = false;
    const headers = document.querySelectorAll('h1,h2,h3,h4,legend,strong');
    for (const title of headers) {
      if (title.textContent.trim() !== 'Mantenimiento de artículos' ||
          title.dataset.sqlCatalogLinked === 'true') continue;
      title.dataset.sqlCatalogLinked = 'true';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Buscar y modificar artículos SQL';
      button.title = 'Abre el catálogo real POS365_DEV; este formulario histórico todavía no está migrado.';
      button.style.cssText = 'margin-left:12px;padding:7px 12px;border-radius:6px;background:#155f89;color:white;border:0;cursor:pointer;font:inherit;font-size:13px';
      button.onclick = () => window.open('/catalogo.html', '_blank', 'noopener');
      title.append(button);
      const note = document.createElement('small');
      note.textContent = ' Los artículos de SQL Server se modifican desde el botón azul. La búsqueda de este formulario sigue pendiente de migración.';
      note.style.cssText = 'display:block;font-size:12px;color:#8b4b12;margin-top:6px';
      title.after(note);
    }
  }
  const observer = new MutationObserver(() => {
    if (!scheduling) {
      scheduling = true;
      requestAnimationFrame(attach);
    }
  });
  if (document.documentElement) observer.observe(document.documentElement, {childList:true,subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
})();
</script>
"""
if '</body>' not in s:
    raise RuntimeError('No se encontró el cierre HTML del POS original.')
head,tail=s.rsplit('</body>',1)
s=head+maintenance_bridge+'</body>'+tail
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
     const body={registerCode:'Caja-DEV',expectedTotal:total,
        lines:mapped.map(l=>({productId:l.product.id,quantity:l.quantity,tax:0})),
        payments:[{method:'EFECTIVO-PRUEBA',amount:total}]};
     const fingerprint=JSON.stringify(body);
     if(lastDraftRequest?.fingerprint!==fingerprint)
       lastDraftRequest={fingerprint,requestId:crypto.randomUUID()};
     body.requestId=lastDraftRequest.requestId;
     if(!confirm('Guardar BORRADOR SQL de prueba por '+total.toFixed(2)+' colones? No registra pago real ni inventario. El impuesto se guardara como 0 SOLO para probar persistencia.'))return;
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
out=root/'src/POS365.Local/wwwroot/pos-original.html';out.write_text(s,encoding='utf-8')
print('POS original conectado a consulta SQL:',out)
