let queue=Promise.resolve(),revision,latest=0,blocked=false,confirmedParts=[];
const frame=document.getElementById('codex-visualization');
async function readStore(prefix,catalog=false){
  for(let attempt=0;attempt<3;attempt++){
    const response=await fetch(prefix+(catalog?'/catalog':'/state'),{cache:'no-store'});
    if(catalog&&response.status===503&&attempt<2)continue;
    if(!response.ok)throw Error(response.status===401?'Se requiere iniciar sesión para abrir POS 365.':'No se pudo cargar el catálogo o la base de datos. Volvé a intentarlo.');
    const head=await response.json(),parts=[];
    for(let start=0;start<head.parts;start+=24){
      const starts=[start,start+8,start+16].filter(offset=>offset<head.parts);
      const pages=await Promise.all(starts.map(async offset=>{
        const response=await fetch(prefix+(catalog?'/catalog-parts?generation='+encodeURIComponent(head.generation):'/parts?revision='+encodeURIComponent(head.revision))+'&start='+offset,{cache:'no-store'});
        if(!response.ok)throw Error('No se pudo leer la base compartida.');
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
  accessCheck=fetch('/api/session-access',{cache:'no-store'}).then(async response=>{
    if(response.status===401||response.status===403){location.replace('/login');return {};}
    if(!response.ok)throw Error('No se pudo comprobar el permiso.');
    const access=await response.json();
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
async function sendSaveStep(body){
  for(let attempt=0;;attempt++){
    let response;
    try{
      response=await fetch(storePrefix+'/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(response.ok)return await response.json();
    }catch{
      if(attempt===2)throw Error('Se perdió la conexión al guardar. Verificá el último registro guardado antes de reintentar.');
    }
    if(response && (attempt===2 || ![429,500,502,503,504].includes(response.status))){
      const details=await response.json().catch(()=>({}));
      throw Error(details.error || 'El servidor no confirmó el guardado. Verificá el último registro guardado antes de reintentar.');
    }
    await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
  }
}
window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.data?.type!=='cedi-trial-state-save')return;
  const {content,updatedAt,blockEmail}=event.data;
  const reply=(ok,reason)=>frame.contentWindow.postMessage({type:'cedi-trial-state-saved',updatedAt,ok,reason},'*');
  queue=queue.then(async()=>{
    if(blocked||!revision){reply(false,"La sesión tiene un guardado sin confirmar. Revisá Compras registradas.");return;}
    if(updatedAt<=latest){reply(false,"Se recibió una versión más reciente. Consultá Compras registradas.");return;}
    if(blockEmail!==undefined){
      const access=await checkSessionAccess().catch(()=>null);
      if(!access?.mayBlock){reply(false,'La cuenta requiere permiso de administración para bloquear usuarios.');return;}
    }
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
    const result=await sendSaveStep({...save,finish:true,changes:changes.length,blockEmail});
    if(result.revision!=='save:'+save.id)throw Error('La confirmación del guardado no coincide con la operación.');
    revision=result.revision;confirmedParts=parts;latest=updatedAt;reply(true);
  }).catch(e=>{reply(false,e.message);if(!blocked)stop(e.message);});
});

window.addEventListener('message', event=>{
  if(event.source!==frame.contentWindow || event.data?.type!=='cedi-switch-purchase-format')return;
  const destination=event.data.destination;
  if(destination==='legacy')location.assign('/compras-formato-viejo.html');
  if(destination==='current')location.assign('/?modulo='+encodeURIComponent(event.data.moduleName||'Compras'));
});
