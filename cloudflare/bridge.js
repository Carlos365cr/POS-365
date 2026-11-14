let queue=Promise.resolve(),revision,latest=0,blocked=false,confirmedParts=[];
const frame=document.getElementById('codex-visualization');
async function readStore(prefix){
  for(let attempt=0;attempt<3;attempt++){
    const response=await fetch(prefix+'/state',{cache:'no-store'});
    if(!response.ok)throw Error('Se requiere iniciar sesión para abrir POS 365.');
    const head=await response.json(),parts=[];
    for(let start=0;start<head.parts;start+=24){
      const starts=[start,start+8,start+16].filter(offset=>offset<head.parts);
      const pages=await Promise.all(starts.map(async offset=>{
        const response=await fetch(prefix+'/parts?revision='+encodeURIComponent(head.revision)+'&start='+offset,{cache:'no-store'});
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
async function loadShared(){
  const store=await readStore(storePrefix);
  revision=store.revision;
  confirmedParts=store.parts;
  if(storePrefix==='/api')return {cediShared:true,cediTrialGzip:store.parts.join('')};
  const catalog=await decodeStore((await readStore('/api')).parts);
  const saved=store.parts.length?await decodeStore(store.parts):{};
  const snapshot={...catalog,purchases:saved.purchases??[],purchaseOrders:saved.purchaseOrders??[],
    purchaseDraft:{header:[],rows:[],xmlDocument:null},legacyPurchaseDraft:saved.legacyPurchaseDraft??null,
    sales:[],cashOutContacts:[],cashOutEntries:[],cxpState:null,xmlInboxState:saved.xmlInboxState??undefined,
    updatedAt:Math.max(saved.updatedAt||0,catalog.updatedAt||0)};
  return {cediShared:true,cediTrial:snapshot};
}
function stop(message){
  blocked=true;
  frame.inert=true;
  const panel=document.createElement('dialog'),text=document.createElement('p'),button=document.createElement('button');
  text.textContent=message;button.textContent='Volver a cargar';button.onclick=()=>location.reload();
  panel.append(text,button);document.body.append(panel);panel.showModal();panel.oncancel=e=>e.preventDefault();
}
async function sendSaveStep(body){
  for(let attempt=0;;attempt++){
    let response;
    try{
      response=await fetch(storePrefix+'/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(response.ok)return await response.json();
    }catch{
      if(attempt===2)throw Error('Se perdió la conexión al guardar. Consultá Compras registradas antes de reintentar.');
    }
    if(response && (attempt===2 || ![429,500,502,503,504].includes(response.status))){
      const details=await response.json().catch(()=>({}));
      throw Error(details.error || 'El servidor no confirmó el guardado. Consultá Compras registradas antes de reintentar.');
    }
    await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
  }
}
window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.data?.type!=='cedi-trial-state-save')return;
  const {content,updatedAt}=event.data;
  const reply=(ok,reason)=>frame.contentWindow.postMessage({type:'cedi-trial-state-saved',updatedAt,ok,reason},'*');
  queue=queue.then(async()=>{
    if(blocked||!revision){reply(false,"La sesión tiene un guardado sin confirmar. Revisá Compras registradas.");return;}
    if(updatedAt<=latest){reply(false,"Se recibió una versión más reciente. Consultá Compras registradas.");return;}
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
    const result=await sendSaveStep({...save,finish:true,changes:changes.length});
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
