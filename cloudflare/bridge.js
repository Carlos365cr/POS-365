let queue=Promise.resolve(),revision,latest=0,blocked=false,confirmedParts=[];
const frame=document.getElementById('codex-visualization');
async function loadShared(){
  for(let attempt=0;attempt<3;attempt++){
    const response=await fetch('/api/state',{cache:'no-store'});
    if(!response.ok)throw Error('Se requiere iniciar sesión para abrir CEDI.');
    const head=await response.json(),parts=[];
    for(let start=0;start<head.parts;start+=8){
      const response=await fetch('/api/parts?revision='+encodeURIComponent(head.revision)+'&start='+start,{cache:'no-store'});
      if(!response.ok)throw Error('No se pudo leer la base compartida.');
      const page=await response.json();
      if(page.some((row,i)=>row.part!==start+i)||page.length!==Math.min(8,head.parts-start))break;
      parts.push(...page.map(row=>row.payload));
    }
    if(parts.length===head.parts){revision=head.revision;confirmedParts=parts;return {cediShared:true,cediTrialGzip:parts.join('')};}
  }
  throw Error('El inventario cambió mientras se cargaba. Volvé a abrir la página.');
}
function stop(message){
  blocked=true;
  frame.inert=true;
  const panel=document.createElement('dialog'),text=document.createElement('p'),button=document.createElement('button');
  text.textContent=message;button.textContent='Volver a cargar';button.onclick=()=>location.reload();
  panel.append(text,button);document.body.append(panel);panel.showModal();panel.oncancel=e=>e.preventDefault();
}
window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.data?.type!=='cedi-trial-state-save')return;
  const {content,updatedAt}=event.data;
  const reply=(ok,reason)=>frame.contentWindow.postMessage({type:'cedi-trial-state-saved',updatedAt,ok,reason},'*');
  queue=queue.then(async()=>{
    if(blocked||!revision){reply(false);return;}
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
    let response;
    try{
      response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({base:revision,count:parts.length,changes})});
    }catch{
      throw Error('Se perdió la conexión al guardar. Consultá Compras registradas antes de repetir la operación.');
    }
    if(!response.ok){
      const details=await response.json().catch(()=>({}));
      throw Error(details.error || 'El servidor respondió con el código '+response.status+'. Consultá Compras registradas antes de reintentar.');
    }
    revision=(await response.json()).revision;confirmedParts=parts;latest=updatedAt;reply(true);
  }).catch(e=>{reply(false,e.message);if(!blocked)stop(e.message);});
});
