function commercialRequest(query={},body){return new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('No se recibió confirmación. Reintente con los mismos datos.'));},45000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};window.parent.postMessage({type:'pos365-commercial-notes',query,body},'*',[channel.port2]);});}
let commercialLedger=[];
async function refreshCommercialLedger(){const result=await commercialRequest({ledger:'1'});if(result.error)throw Error(result.error);commercialLedger=result.entries;return commercialLedger;}
function commercialAdjustment(account,party,currency='CRC'){return commercialLedger.filter(e=>e.account===account&&e.party===String(party)&&e.currency===currency).reduce((sum,e)=>sum+e.amount,0);}
function appendCommercialLedger(view,account){
 const section=document.createElement('section');section.style.cssText='padding:12px;overflow:auto';const h=document.createElement('h3');h.textContent='Notas comerciales · '+account;section.append(h);
 const table=document.createElement('table'),head=table.createTHead().insertRow();for(const label of ['Documento','Cliente / proveedor','Moneda','Referencia','Importe del documento','Estado','Efecto en saldo']){const th=document.createElement('th');th.textContent=label;head.append(th);}
 const label=document.createElement('label');label.textContent='Buscar documento o referencia de factura ';const search=document.createElement('input');search.type='search';search.placeholder='Referencia, factura, consecutivo o cliente / proveedor';search.dataset.commercialReferenceSearch='';label.append(search);section.append(label);
 const tbody=table.createTBody(),norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 function draw(){tbody.replaceChildren();const term=norm(search.value);for(const e of commercialLedger.filter(e=>e.account===account&&norm([e.note,e.party,e.partyName,e.reference].join(' ')).includes(term))){const tr=tbody.insertRow();for(const value of [e.note,e.partyName||e.party,e.currency,e.reference||'Sin referencia',((e.originalAmount??e.amount)/100).toFixed(2),e.state||'Activa',(e.amount/100).toFixed(2)])tr.insertCell().textContent=value;if((e.originalAmount??e.amount)<0)tr.cells[4].style.color='#b91c1c';if(e.amount<0)tr.lastElementChild.style.color='#b91c1c';}if(!tbody.rows.length){const cell=tbody.insertRow().insertCell();cell.colSpan=7;cell.textContent='Sin documentos que coincidan con la búsqueda.';}}
 search.oninput=draw;draw();section.append(table);view.append(section);
}
function installCommercialNotes(){
 const item=document.createElement('button');item.type='button';item.className='menu-item cursor-interaction';item.textContent='Notas Comercial Internos';menu.append(item);
 const view=document.createElement('main');view.hidden=true;view.className='commercial-notes-view';view.style.cssText='min-width:0;min-height:0;width:100%;max-width:100%;overflow-y:auto;overflow-x:hidden;flex:1';root.append(view);
 const activate=()=>{for(const m of root.querySelectorAll(':scope > main'))m.hidden=m!==view;for(const b of menu.querySelectorAll('.menu-item')){b.classList.toggle('selected',b===item);b.removeAttribute('aria-current');}item.setAttribute('aria-current','page');};
 item.onclick=async()=>{activate();view.textContent='Cargando notas comerciales…';try{
  const [catalog,designs]=await Promise.all([commercialRequest({catalog:'1'}),commercialRequest({designs:'1'})]);if(catalog.error||designs.error)throw Error(catalog.error||designs.error);
  const records=[];let after='';do{const result=await commercialRequest({after});if(result.error)throw Error(result.error);records.push(...result.records);after=result.next;}while(after);
  const history=[];after='';do{const result=await commercialRequest({history:'1',after});if(result.error)throw Error(result.error);history.push(...result.history);after=result.next;}while(after);
  const invoices={};for(const i of catalog.invoices){(invoices[i.party]||=[]).push([i.source,i.id,i.number,i.date,i.total/100,i.currency]);}
  const warehouses=[...new Set(Array.from(document.querySelectorAll('[name=bodega] option, [name=compraBodega] option'),o=>o.value).filter(Boolean))];if(!warehouses.length)warehouses.push('Belén');
  view.innerHTML=COMMERCIAL_NOTE_MARKUP;
  const noteRoot=view.querySelector('#nc-proposal');noteRoot.commercialContext={...catalog,invoices,invoiceLabels:Object.fromEntries(catalog.invoices.map(i=>[i.id,i.number])),records,history,designs:designs.designs,warehouses,company:root.dataset.businessName||'POS 365'};noteRoot.commercialApi=commercialRequest;noteRoot.commercialChanged=()=>{refreshCommercialLedger().catch(()=>{});};noteRoot.commercialExport=(filename,mime,content)=>window.parent.postMessage({type:'cedi-cash-export',filename,mime,content},'*');
  COMMERCIAL_NOTE_SCRIPTS
 }catch(e){view.textContent=e.message;const retry=document.createElement('button');retry.textContent='Reintentar';retry.onclick=()=>item.click();view.append(retry);}};
 menu.addEventListener('click',e=>{const b=e.target.closest('.menu-item');if(b&&b!==item)view.hidden=true;});
 const designs=root.querySelector('.print-designs-view');if(designs){const link=document.createElement('button');link.type='button';link.textContent='Notas Comercial Internos · Cliente / Proveedor · Carta';link.onclick=async()=>{await item.onclick();view.querySelector('[data-design-open]')?.click();};designs.prepend(link);}
}
