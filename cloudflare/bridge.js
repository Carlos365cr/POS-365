let queue=Promise.resolve(),revision,latest=0,blocked=false,confirmedParts=[];
const frame=document.getElementById('codex-visualization');
async function storeReadError(response,stage){
  const problem=await response.json().catch(()=>null);
  const detail=typeof problem?.error==='string'?problem.error:'';
  if(response.status===401)return Error('La sesión de POS 365 venció. Volvé a ingresar con Google.');
  return Error(stage+' (HTTP '+response.status+'). '+(detail||'Volvé a intentarlo.'));
}
async function readStore(prefix,catalog=false){
  for(let attempt=0;attempt<3;attempt++){
    const response=await fetch(prefix+(catalog?'/catalog':'/state'),{cache:'no-store'});
    if(catalog&&response.status===503&&attempt<2)continue;
    if(!response.ok)throw await storeReadError(response,catalog?'Error al abrir el catálogo':'Error al abrir la base de compras');
    const head=await response.json(),parts=[];
    for(let start=0;start<head.parts;start+=24){
      const starts=[start,start+8,start+16].filter(offset=>offset<head.parts);
      const pages=await Promise.all(starts.map(async offset=>{
        const response=await fetch(prefix+(catalog?'/catalog-parts?generation='+encodeURIComponent(head.generation):'/parts?revision='+encodeURIComponent(head.revision))+'&start='+offset,{cache:'no-store'});
        if(!response.ok)throw await storeReadError(response,catalog?'Error al leer el detalle del catálogo':'Error al leer los datos guardados');
        const page=await response.json();
        if(!Array.isArray(page)||page.length!==Math.min(8,head.parts-offset)||
            page.some((row,i)=>row.part!==offset+i||typeof row.payload!=='string'))return null;
        return page;
      }));
      if(pages.some(page=>page===null))break;
      for(const page of pages)parts.push(...page.map(row=>row.payload));
    }
    if(parts.length===head.parts){return {revision:head.revision,parts};}
  }
  throw Error('El inventario cambió mientras se cargaba. Volvé a abrir la página.');
}
const storePrefix='/api';
async function decodeStore(parts){
  const bytes=Uint8Array.from(atob(parts.join('')),c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}
function addLegacyExamples(snapshot,saved){
  const samples=[
    ['Arroz blanco 1 kg','2316100000100',1470],['Frijol negro 900 g','0170102000400',1690],
    ['Lentejas secas 500 g','0170400000000',950],['Harina de avena 400 g','2312000000200',1120],
    ['Café en grano 250 g','2391102010100',2650],['Café molido 250 g','2391102010200',2430],
    ['Harina de trigo 1 kg','2311000000100',890],['Pan tostado 200 g','2341000000100',1040],
    ['Galletas de vainilla 180 g','2342001000200',765],['Tortillas de trigo 300 g','2349001010200',1250]
  ];
  const state=snapshot.contactsState??{version:1,draft:[],draftAttachments:[],mode:'inclusion',tab:'general'};
  const supplier='legacy-example-supplier';
  const contacts=state.records||[];
  if(contacts.some(c=>c.id===supplier&&!c.legacyExample))return;
  snapshot.contactsState={...state,records:contacts.slice()};
  if(!contacts.some(c=>c.id===supplier))snapshot.contactsState.records.push({id:supplier,code:'FV-DEMO',name:'Proveedor de ejemplo',cedula:'',supplier:true,client:false,active:true,status:'saved',fields:[],attachments:[],location:{},legacyExample:true});
  const products=[...(snapshot.products||[])];
  const taken=new Set([...products,...(snapshot.xmlPendingArticles||[])].flatMap(p=>[p.code,p.barcode,...(p.codes||[])]));
  samples.forEach(([label,cabys,base],index)=>{
    const number=String(index+1).padStart(2,'0'),code='FV-'+number,barcode='FV-DEMO-'+number;
    if(taken.has(code)||taken.has(barcode))return;
    const previous=(saved.products||[]).find(p=>p.legacyExample===true&&p.barcode===barcode&&p.code===code);
    const name='Ejemplo · '+label;
    const fields=values=>Object.entries(values).map(([key,value])=>[key,String(value),null]);
    products.push(previous||{legacyExample:true,barcode,code,name,cabys,codes:[code,barcode],price:base+5,currency:'Colón',includesVAT:true,
      details:{general:fields({codigo:code,barras:barcode,nombre:name,cabys,referencia:code,proveedor:supplier,caja:1}),
        costs:fields({crc_reposicion:base-200}),prices:fields({lista0_precio:base+5})}});
    products.at(-1).legacyExampleBase=base;
  });
  snapshot.products=products;
}
async function loadShared(){
  const store=await readStore(storePrefix);
  revision=store.revision;
  confirmedParts=store.parts;
  if(storePrefix==='/api')return {cediShared:true,cediTrialGzip:store.parts.join('')};
  const catalog=await decodeStore((await readStore(storePrefix,true)).parts);
  const saved=store.parts.length?await decodeStore(store.parts):{};
  const snapshot={...catalog,purchases:saved.purchases??[],purchaseOrders:saved.purchaseOrders??[],
    purchaseDraft:{header:[],rows:[],xmlDocument:null},legacyPurchaseDraft:saved.legacyPurchaseDraft??null,
    sales:[],cashOutContacts:[],cashOutEntries:[],cxpState:null,xmlInboxState:saved.xmlInboxState??undefined,
    updatedAt:Math.max(saved.updatedAt||0,catalog.updatedAt||0)};
  addLegacyExamples(snapshot,saved);
  return {cediShared:true,cediTrial:snapshot};
}
function stop(message){
  blocked=true;
  frame.inert=true;
  const panel=document.createElement('dialog'),text=document.createElement('p'),button=document.createElement('button');
  text.textContent=message;button.textContent='Volver a cargar';button.onclick=()=>location.reload();
  panel.append(text,button);document.body.append(panel);panel.showModal();panel.oncancel=e=>e.preventDefault();
}
let logoutTimer,accessCheck;
function checkSessionAccess(){
  if(accessCheck)return accessCheck;
  accessCheck=fetchSaveResponse('/api/session-access',{cache:'no-store'},20000).then(async ({response,payload})=>{
    if(response.status===401||response.status===403){location.replace('/login');return {};}
    if(!response.ok)throw Error('No se pudo comprobar el permiso.');
    const access=payload;
    if(access.email)frame.contentWindow?.postMessage({type:'pos365-billing-user',email:access.email,name:access.name,master:access.master,kind:access.kind,box:access.box,userId:access.userId},'*');
    if(Number.isFinite(access.remaining)){
      let warning=document.getElementById('cedi-session-warning');
      if(!warning){
        warning=document.createElement('div');warning.id='cedi-session-warning';warning.setAttribute('role','alert');
        warning.style.cssText='position:fixed;inset:0 0 auto;z-index:2147483647;background:#fff2ce;color:#362900;padding:8px;text-align:center';
        document.body.append(warning);
      }
      warning.textContent='Su usuario fue bloqueado. La sesión se cerrará en '+Math.ceil(access.remaining/60000)+' min.';
      clearTimeout(logoutTimer);
      logoutTimer=setTimeout(()=>location.replace('/login'),access.remaining);
    }
    return access;
  }).finally(()=>{accessCheck=null;});
  return accessCheck;
}
window.addEventListener('message',event=>{
  if(event.source===frame.contentWindow&&event.data?.type==='pos365-read-billing-user')checkActiveSession();
});
function checkActiveSession(){checkSessionAccess().catch(()=>{});}
checkActiveSession();setInterval(checkActiveSession,60000);
window.addEventListener('focus',checkActiveSession);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkActiveSession();});
let cachedPrintRevision,cachedPrintModels;
window.addEventListener('message',async event=>{
  if(event.source!==frame.contentWindow||event.data?.type!=='cedi-read-print-models')return;
  const id=event.data.id;
  const reply=data=>frame.contentWindow.postMessage({type:'cedi-print-models',id,...data},'*');
  try{
    await queue;
    const response=await fetch('/api/state',{cache:'no-store'});
    if(!response.ok)throw Error();
    const head=await response.json();
    if(storePrefix==='/api'&&head.revision===revision){reply({current:true});return;}
    if(cachedPrintRevision!==head.revision){
      const store=await readStore('/api');
      const state=await decodeStore(store.parts);
      cachedPrintModels=state.printDesigns?.printModels||{};
      cachedPrintRevision=store.revision;
    }
    reply({models:cachedPrintModels});
  }catch{reply({error:true});}
});
const pendingPrices=new Map();
window.addEventListener('message',async event=>{
  if(storePrefix==='/api'||event.source!==frame.contentWindow||event.data?.type!=='cedi-legacy-price')return;
  const {day,keys,id}=event.data;
  const query=new URLSearchParams({day});
  for(const key of keys)query.append('key',key);
  if(event.data.history){
    query.set('history','1');
    for(const supplier of event.data.suppliers||[])query.append('supplier',supplier);
  }
  const path=storePrefix+'/price?'+query;
  if(!pendingPrices.has(path)){
    pendingPrices.set(path,fetch(path).then(async response=>{
      if(!response.ok)throw Error();
      return await response.json();
    }).finally(()=>pendingPrices.delete(path)));
  }
  try{const result=await pendingPrices.get(path);frame.contentWindow.postMessage({type:'cedi-legacy-price-result',id,...result},'*');}
  catch{frame.contentWindow.postMessage({type:'cedi-legacy-price-result',id,error:true},'*');}
});
async function fetchSaveResponse(url,options={},timeout=30000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{const response=await fetch(url,{...options,signal:controller.signal});const payload=await response.json().catch(error=>{if(controller.signal.aborted)throw error;return {};});return {response,payload};}finally{clearTimeout(timer);}
}
async function sendSaveStep(body){
  for(let attempt=0;;attempt++){
    let response,payload;
    try{
      ({response,payload}=await fetchSaveResponse(storePrefix+'/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
      if(response.ok)return payload;
    }catch{
      if(attempt===2)throw Error('Se perdió la conexión al guardar. Verificá el último registro guardado antes de reintentar.');
    }
    if(response && (attempt===2 || ![429,500,502,503,504].includes(response.status))){
      const details=payload||{};
      throw Error(details.error || 'El servidor no confirmó el guardado. Verificá el último registro guardado antes de reintentar.');
    }
    await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
  }
}
window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.data?.type!=='cedi-trial-state-save')return;
  const {content,updatedAt,blockEmail,authUsers,voucherOp,boxSizeOp}=event.data;
  const reply=(ok,reason,voucher)=>frame.contentWindow.postMessage({type:'cedi-trial-state-saved',updatedAt,ok,reason,voucher},'*');
  queue=queue.then(async()=>{
    if(blocked||!revision){reply(false,"La sesión tiene un guardado sin confirmar. Revisá Compras registradas.");return;}
    if(updatedAt<=latest){reply(false,"Se recibió una versión más reciente. Consultá Compras registradas.");return;}
    if(blockEmail!==undefined){
      const access=await checkSessionAccess().catch(()=>null);
      if(!access?.mayBlock){reply(false,'La cuenta requiere permiso de administración para bloquear usuarios.');return;}
    }
    const access=storePrefix==='/api'&&authUsers!==undefined?await checkSessionAccess():null;
    const directory=access?.master===true?authUsers:undefined;
    let encoded=content.cediTrialGzip;
    if(!encoded){
      const zipped=new Blob([JSON.stringify(content.cediTrial)]).stream().pipeThrough(new CompressionStream('gzip'));
      const bytes=new Uint8Array(await new Response(zipped).arrayBuffer());
      encoded=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
    }
    const parts=encoded.match(/.{1,64000}/g)||[];
    const changes=[];
    parts.forEach((payload,part)=>{if(payload!==confirmedParts[part])changes.push({part,payload});});
    const save={id:crypto.randomUUID(),base:revision,count:parts.length};
    for(let start=0;start<changes.length;start+=4){
      await sendSaveStep({...save,changes:changes.slice(start,start+4)});
    }
    const result=await sendSaveStep({...save,finish:true,changes:changes.length,blockEmail,authUsers:directory,voucherOp,boxSizeOp});
    if(result.revision!=='save:'+save.id)throw Error('La confirmación del guardado no coincide con la operación.');
    revision=result.revision;confirmedParts=parts;latest=updatedAt;reply(true,undefined,result.voucher);
  }).catch(e=>{reply(false,e.message);if(!blocked)stop(e.message);});
});

window.addEventListener('message', event=>{
  if(event.source!==frame.contentWindow || event.data?.type!=='cedi-switch-purchase-format')return;
  const destination=event.data.destination;
  if(destination==='legacy')location.assign('/compras-formato-viejo.html');
  if(destination==='current')location.assign('/?modulo='+encodeURIComponent(event.data.moduleName||'Compras'));
});
window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow)return;
 if(event.data?.type==='pos365-logout'){
  try{
   const response=await fetch('/auth/logout',{method:'POST'});
   if(!response.ok)throw Error();
   location.replace('/login');
  }catch{frame.contentWindow.postMessage({type:'pos365-logout-result',error:'No se pudo cerrar sesión. Intente de nuevo.'},'*');}
 }
 if(event.data?.type!=='pos365-save-credential')return;
 const {id,userId,password}=event.data;
 try{
  const response=await fetch('/api/user-credential',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,password})});
  const result=await response.json();
  frame.contentWindow.postMessage({type:'pos365-credential-result',id,ok:response.ok,error:result.error},'*');
 }catch{frame.contentWindow.postMessage({type:'pos365-credential-result',id,ok:false,error:'No se confirmó la clave. Puede volver a guardarla.'},'*');}
});

window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.data?.type!=='pos365-voucher-lookup')return;
 const {id,code}=event.data;
 try{const response=await fetch('/api/pos-voucher?code='+encodeURIComponent(code),{cache:'no-store'});const result=await response.json();frame.contentWindow.postMessage({type:'pos365-voucher-result',id,ok:response.ok,result},'*');}catch{frame.contentWindow.postMessage({type:'pos365-voucher-result',id,ok:false,result:{error:'No se pudo consultar la nota de crédito comercial.'}},'*');}
});

function posVoucherBarcode(code){
// Code 128, subset B, including modulo-103 check symbol and quiet zones.
const bars='11011001100 11001101100 11001100110 10010011000 10010001100 10001001100 10011001000 10011000100 10001100100 11001001000 11001000100 11000100100 10110011100 10011011100 10011001110 10111001100 10011101100 10011100110 11001110010 11001011100 11001001110 11011100100 11001110100 11101101110 11101001100 11100101100 11100100110 11101100100 11100110100 11100110010 11011011000 11011000110 11000110110 10100011000 10001011000 10001000110 10110001000 10001101000 10001100010 11010001000 11000101000 11000100010 10110111000 10110001110 10001101110 10111011000 10111000110 10001110110 11101110110 11010001110 11000101110 11011101000 11011100010 11011101110 11101011000 11101000110 11100010110 11101101000 11101100010 11100011010 11101111010 11001000010 11110001010 10100110000 10100001100 10010110000 10010000110 10000101100 10000100110 10110010000 10110000100 10011010000 10011000010 10000110100 10000110010 11000010010 11001010000 11110111010 11000010100 10001111010 10100111100 10010111100 10010011110 10111100100 10011110100 10011110010 11110100100 11110010100 11110010010 11011011110 11011110110 11110110110 10101111000 10100011110 10001011110 10111101000 10111100010 11110101000 11110100010 10111011110 10111101110 11101011110 11110101110 11010000100 11010010000 11010011100 1100011101011'.split(' ');
if(!/^NC[0-9A-F]{24}$/.test(code))throw Error('Código inválido.');
const symbols=Array.from(code,c=>c.charCodeAt(0)-32),check=(104+symbols.reduce((n,c,i)=>n+c*(i+1),0))%103,bits=[104,...symbols,check,106].map(c=>bars[c]).join('');
return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Código de barras de la nota" viewBox="0 0 '+(bits.length+24)+' 92" style="width:100%;max-width:720px;background:white"><rect width="100%" height="100%" fill="white"/>'+Array.from(bits,(bit,i)=>bit==='1'?'<rect x="'+(i+12)+'" y="6" width="1" height="60" fill="black"/>':'').join('')+'<text x="'+((bits.length+24)/2)+'" y="82" text-anchor="middle" font-family="monospace" font-size="10" fill="black">'+code+'</text></svg>';
}

window.addEventListener('message',event=>{
 if(event.source!==frame.contentWindow||event.data?.type!=='pos365-print-voucher')return;
 const {code,text,details}=event.data;if(!/^NC[0-9A-F]{24}$/.test(code)||typeof text!=='string'||typeof details!=='string')return;
 const paper=document.createElement('iframe');paper.style.cssText='position:fixed;width:1px;height:1px;bottom:0;left:0;border:0';document.body.append(paper);
 const doc=paper.contentDocument;doc.open();doc.write('<!doctype html><html><head><title>Nota de crédito comercial</title><style>body{font:16px sans-serif;max-width:180mm;margin:12mm auto;padding:5mm}svg{width:100%}</style></head><body><h1>Nota de crédito comercial</h1></body></html>');doc.close();
 const amount=doc.createElement('p');amount.textContent=text.slice(0,500);doc.body.append(amount);const barcode=doc.createElement('div');barcode.innerHTML=posVoucherBarcode(code);doc.body.append(barcode);const note=doc.createElement('p');note.textContent=details.slice(0,500);doc.body.append(note);
 paper.contentWindow.addEventListener('afterprint',()=>paper.remove(),{once:true});setTimeout(()=>{paper.contentWindow.focus();paper.contentWindow.print();},200);
});

window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.data?.type!=='pos365-cashiers')return;
 const {id,body}=event.data;
 try{const response=await fetch('/api/cashiers',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const result=await response.json();frame.contentWindow.postMessage({type:'pos365-cashiers-result',id,ok:response.ok,result},'*');}catch{frame.contentWindow.postMessage({type:'pos365-cashiers-result',id,ok:false,result:{error:'No se confirmó la operación. Recargue la lista para verificar.'}},'*');}
});

window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.data?.type!=='pos365-notices'||!event.ports?.[0])return;
 const port=event.ports[0],body=event.data.body;
 try{const response=await fetch('/api/notices'+(event.data.inbox?'?view=inbox':''),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const data=await response.json();port.postMessage({ok:response.ok,data});}catch{port.postMessage({ok:false,data:{error:'No hay conexión para confirmar el aviso. Reintente.'}});}finally{port.close();}
});

window.addEventListener('message',async event=>{if(event.source!==frame.contentWindow||event.data?.type!=='pos365-closings'||!event.ports?.[0])return;const port=event.ports[0],body=event.data.body;try{const response=await fetch('/api/closings'+(event.data.id?'?id='+encodeURIComponent(event.data.id):''),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});port.postMessage({ok:response.ok,status:response.status,data:await response.json()});}catch{port.postMessage({ok:false,data:{error:'No hay conexión para confirmar el cierre.'}});}finally{port.close();}});

window.addEventListener('message',event=>{
 if(event.source!==frame.contentWindow||event.data?.type!=='pos365-print-closing')return;
 const model=event.data.model;if(!model||!Array.isArray(model.sections))return;
 const paper=document.createElement('iframe');paper.style.cssText='position:fixed;width:1px;height:1px;bottom:0;left:0;border:0';document.body.append(paper);
 try{
 const doc=paper.contentDocument;doc.open();doc.write('<!doctype html><html><head><title>Cierre de cajas</title></head><body></body></html>');doc.close();
 const style=doc.createElement('style');style.textContent='@page{size:'+(model.format==='letter'?'letter':'80mm auto')+';margin:4mm}body{font:12px Arial,sans-serif;color:#000;margin:0 auto;max-width:'+(model.format==='letter'?'185mm':'72mm')+'}h1{font-size:17px;text-align:center}h2{font-size:14px;text-align:center}h3{font-size:12px;border-bottom:1px solid #333;padding:7px 0 4px}section{break-inside:avoid}p{white-space:pre-wrap;overflow-wrap:anywhere}.row{display:flex;gap:8px;justify-content:space-between;padding:3px 0}.row span:last-child{text-align:right;overflow-wrap:anywhere;max-width:60%}';doc.head.append(style);
 const append=(tag,text,parent=doc.body)=>{const node=doc.createElement(tag);node.textContent=String(text??'').slice(0,2000);parent.append(node);return node;};append('h1',model.company);append('h2',model.title);
 for(const section of model.sections.slice(0,12)){const block=doc.createElement('section');doc.body.append(block);append('h3',section.title,block);for(const row of (section.rows||[]).slice(0,100)){const line=doc.createElement('div');line.className='row';block.append(line);append('span',row[0],line);append('span',row[1],line);}}
 if(model.note)append('p',model.note);paper.contentWindow.addEventListener('afterprint',()=>paper.remove(),{once:true});setTimeout(()=>{try{paper.contentWindow.focus();paper.contentWindow.print();}catch{paper.remove();frame.contentWindow.postMessage({type:'pos365-print-closing-error'},'*');}},200);
 }catch{paper.remove();frame.contentWindow.postMessage({type:'pos365-print-closing-error'},'*');}
});

window.addEventListener('message',async event=>{if(event.source!==frame.contentWindow||event.data?.type!=='pos365-sales-analysis'||!event.ports?.[0])return;const port=event.ports[0];try{const response=await fetch('/api/sales-analysis',{cache:'no-store'});port.postMessage({ok:response.ok,data:await response.json()});}catch{port.postMessage({ok:false,data:{error:'No hay conexión para consultar ventas.'}});}finally{port.close();}});

// The expiration switch uses its own server setting; manual Avisos remains independent.
window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.data?.type!=='pos365-dynamic-notice-settings'||!event.ports?.[0])return;
 const port=event.ports[0],body=event.data.body;
 try{const response=await fetch('/api/dynamic-notice-settings',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});port.postMessage({ok:response.ok,data:await response.json()});}catch{port.postMessage({ok:false,data:{error:'No hay conexión para confirmar el ajuste.'}});}finally{port.close();}
});
// Shared receipt renderer: keep identical in the inner screens and the print bridge.
function renderExpiryTicket(doc,container,model,now=new Date(),printed=false){
 container.replaceChildren();container.className='expiry-ticket';
 const add=(tag,text,parent=container,cls='')=>{const el=doc.createElement(tag);el.textContent=String(text??'');if(cls)el.className=cls;parent.append(el);return el;};
 const short=day=>day.split('-').reverse().join('/'),long=day=>new Intl.DateTimeFormat('es-CR',{timeZone:'America/Costa_Rica',weekday:'long'}).format(new Date(day+'T12:00:00Z'))+', '+short(day);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Costa_Rica',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),next=new Date(Date.parse(model.day+'T12:00:00Z')+86400000).toISOString().slice(0,10);
 const pair=(label,value,parent=container,cls='')=>{const row=add('div','',parent,'ticket-pair '+cls);add('span',label,row);add('span',value,row);return row;};
 add('p',model.company||'POS 365',container,'ticket-company');add('p','POS 365 · Aviso de dinámicas',container,'ticket-center');
 add('h1',model.day===today?'Estas promociones\nvencen hoy':'Promociones finalizadas',container);add('p',long(model.day),container,'ticket-center ticket-day');
 const action=add('div','',container,'ticket-action');add('p',model.day===today?'RETIRAR LOS RÓTULOS MAÑANA':'RETIRAR LOS RÓTULOS',action);add('p',long(next),action);
 const metadata=add('div','',container,'ticket-metadata');pair('Caja',model.recipient||'Consulta por fecha',metadata);pair('Aviso programado',short(model.day)+' · 1:00 p. m.',metadata);
 if(printed){const printDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Costa_Rica',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),time=new Intl.DateTimeFormat('es-CR',{timeZone:'America/Costa_Rica',hour:'numeric',minute:'2-digit',hour12:true}).format(now);pair('Impreso',short(printDay)+' · '+time,metadata);}
 model.products.forEach((p,i)=>{const section=add('section','',container,'ticket-product');add('h2',(i+1)+'. '+p.name,section);add('p',p.barcode||'Sin código de barras',section,'ticket-barcode');add('p',p.type==='scale'?'Venta escala':'Venta escáner',section,'ticket-type');add('p','Promoción: '+p.promotion,section);add('p','Último día vigente: '+short(p.day),section,'ticket-small');});
 pair('Total de productos',model.products.length,container,'ticket-total');add('p','Las promociones permanecen vigentes durante todo el día de finalización.',container,'ticket-footnote');
}
const expiryTicketStyles='.expiry-ticket{box-sizing:border-box;width:100%;max-width:320px;margin:0 auto;padding:24px 20px 28px;background:#fff;color:#111;font:14px/1.45 Arial,sans-serif;overflow-wrap:anywhere;white-space:normal}.expiry-ticket *{box-sizing:border-box}.expiry-ticket p{font:inherit;margin:3px 0;color:#111;white-space:normal}.expiry-ticket .ticket-company{text-align:center;text-transform:uppercase;font-weight:700}.expiry-ticket .ticket-center{text-align:center}.expiry-ticket h1{font:700 19px/1.2 Arial,sans-serif;white-space:pre-line;text-align:center;margin:14px 0;color:#111}.expiry-ticket .ticket-day{margin:14px 0}.expiry-ticket .ticket-action{border-top:2px solid #111;border-bottom:2px solid #111;padding:12px 0;margin:18px 0;text-align:center;font-weight:700}.expiry-ticket .ticket-metadata{margin:12px 0 18px;font-size:12px}.expiry-ticket .ticket-pair{display:flex;justify-content:space-between;gap:12px}.expiry-ticket .ticket-pair span:last-child{text-align:right;font-variant-numeric:tabular-nums}.expiry-ticket section.ticket-product{border-top:1px dashed #777;margin:0;padding:16px 0;break-inside:avoid}.expiry-ticket h2{font:700 15px/1.4 Arial,sans-serif;margin:0 0 8px;color:#111}.expiry-ticket .ticket-barcode{font-family:monospace;font-size:14px;letter-spacing:.4px}.expiry-ticket .ticket-type{font-weight:700}.expiry-ticket .ticket-small{font-size:12px}.expiry-ticket .ticket-total{border-top:1px dashed #777;padding-top:16px;font-weight:700}.expiry-ticket .ticket-footnote{text-align:center;margin:18px 0 0;padding-bottom:18px;border-bottom:1px dashed #777;font-size:12px}@media print{@page{size:80mm auto;margin:4mm}.expiry-ticket{max-width:72mm;padding:0}}';
// End shared receipt renderer.

window.addEventListener('message',event=>{
 if(event.source!==frame.contentWindow||event.data?.type!=='pos365-print-dynamic-notice')return;
 const {model,noticeId}=event.data;if(!model||!/^\d{4}-\d{2}-\d{2}$/.test(model.day)||!Array.isArray(model.products))return;
 const reply=ok=>frame.contentWindow.postMessage({type:'pos365-print-dynamic-notice-status',noticeId,ok},'*');
 const paper=document.createElement('iframe');paper.style.cssText='position:fixed;width:1px;height:1px;bottom:0;left:0;border:0';document.body.append(paper);
 try{
 const doc=paper.contentDocument;doc.open();doc.write('<!doctype html><html><head><title>Aviso de dinámicas</title></head><body></body></html>');doc.close();
 const style=doc.createElement('style');style.textContent='body{margin:0;background:#fff}'+expiryTicketStyles;doc.head.append(style);const receipt=doc.createElement('article');doc.body.append(receipt);renderExpiryTicket(doc,receipt,model,new Date(),true);
 paper.contentWindow.addEventListener('afterprint',()=>paper.remove(),{once:true});setTimeout(()=>{try{paper.contentWindow.focus();paper.contentWindow.print();reply(true);}catch{paper.remove();reply(false);}},200);
 }catch{paper.remove();reply(false);}
});

window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.data?.type!=='pos365-dynamic-notice-history'||!event.ports?.[0])return;
 const port=event.ports[0],query=new URLSearchParams({view:'day-list',day:String(event.data.day||'')});
 try{const response=await fetch('/api/dynamic-notice-settings?'+query,{cache:'no-store'});port.postMessage({ok:response.ok,data:await response.json()});}catch{port.postMessage({ok:false,data:{error:'No se pudo consultar el historial. Revise la conexión y reintente.'}});}finally{port.close();}
});
