
const propStatus=main.querySelector('[data-prop-status]'),propCount=main.querySelector('[data-prop-count]');
const propSelected=new Set();let propRows=[],propFiltered=[],propPage=0,propBusy=false;
const propField=(p,section,name)=>p[section]?.find(f=>f[0]===name)?.[1]??'';
const propGeneral=(p,name)=>propField(p,'general',name);
const propNormalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const propQuery=s=>main.querySelector(s);
async function propApi(path,opt){const r=await fetch('/api/catalog/'+path,{cache:'no-store',...opt});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'HTTP '+r.status);return d;}
function propMessage(msg){propStatus.textContent=msg;}
function propOptions(){
 for(const el of main.querySelectorAll('select[data-prop-filter]')){
  const old=el.value,key=el.dataset.propFilter,name=key==='supplier'?'proveedor':key;
  const values=new Set(propRows.map(p=>propGeneral(p,name)).filter(Boolean));
  for(const o of form.elements[name]?.options||[])if(o.value)values.add(o.value);
  el.replaceChildren(new Option('Todos',''),...[...values].sort().map(v=>new Option(v,v)));
  if(values.has(old))el.value=old;
 }
 propBatchOptions();
}
function propBatchOptions(){
 const name=propQuery('[data-prop-batch-field]').value,target=propQuery('[data-prop-batch-value]'),old=target.value;
 const values=new Set(propRows.map(p=>propGeneral(p,name)).filter(Boolean));
 for(const o of form.elements[name]?.options||[])if(o.value)values.add(o.value);
 target.replaceChildren(new Option('Seleccione',''),...[...values].sort().map(v=>new Option(v,v)));
 if(values.has(old))target.value=old;
}
const propPhotoBox=document.createElement('div');propPhotoBox.className='property-batch';
propPhotoBox.innerHTML='<button type="button" data-prop-images-delete>Eliminar imágenes</button><button type="button" data-prop-images-suspend>Suspender imágenes</button>';
propQuery('.property-batch').after(propPhotoBox);
const propPhotos=()=>propRows.filter(p=>propSelected.has(p.id)&&p.hasPhoto);
function propControls(){
 const n=propSelected.size,b=propQuery('[data-prop-batch-process]');b.disabled=propBusy||!n;b.textContent='Procesar seleccionados ('+n+')';
 const all=propQuery('[data-prop-select-filtered]'),matching=propFiltered.filter(p=>propSelected.has(p.id)).length;
 all.checked=!!propFiltered.length&&matching===propFiltered.length;all.indeterminate=matching>0&&matching<propFiltered.length;
 const photos=propPhotos(),suspend=propQuery('[data-prop-images-suspend]');
 propQuery('[data-prop-images-delete]').disabled=propBusy||!photos.length;suspend.disabled=propBusy||!photos.length;
 suspend.textContent=photos.length&&photos.every(p=>p.photoSuspended)?'Reactivar imágenes':'Suspender imágenes';
}
function propCost(p){
 const legacy={code:p.code,barcode:p.barcode,name:p.name,cabys:p.cabys,price:p.price,currency:p.currency,details:{general:p.general,costs:p.costs,prices:p.prices}};
 try{return getProductCurrentCost(legacy,costBasis.value);}catch{return null;}
}
function propPricing(p,driver,value){
 const n=Number(String(value).replace(',','.'));if(String(value).trim()===''||!Number.isFinite(n))throw Error('Número inválido.');
 const cost=propCost(p),tax=p.tax;
 if(driver==='gain'&&(cost==null||cost<=0||tax==null))throw Error('Configure costo e IVA SQL antes de calcular ganancia.');
 const price=driver==='gain'?normalizePrimaryPrice(priceFromGain(cost,p.includesVAT?tax:0,n),p.currency):normalizePrimaryPrice(n,p.currency);
 if(!Number.isFinite(price)||price<0)throw Error('Precio inválido.');
 return {price,gain:cost!=null&&cost>0&&tax!=null?gainFromPrice(cost,p.includesVAT?tax:0,price):null};
}
const propCore=[
 ['Código interno',p=>p.code],['Nombre',p=>p.name],['Código proveedor',p=>propGeneral(p,'referencia')],['Código de barras',p=>p.barcode],['SKU',p=>propGeneral(p,'sku')],['Nombre adicional',p=>propGeneral(p,'nombre2')],['Proveedor',p=>propGeneral(p,'proveedor')],['CABYS',p=>p.cabys],
 ...[1,2,3,4].map(i=>['Categoría '+i,p=>propGeneral(p,'categoria'+i)]),
 ['Existencia',()=> 'No migrada'],['Cantidad por caja',p=>{try{return getProductUnitsPerBox({details:{general:p.general,costs:p.costs,prices:p.prices}});}catch{return '';}}],
 ['% Gan.',p=>{try{return p.price==null?null:propPricing(p,'price',p.price).gain;}catch{return null;}}],['Precio 1',p=>p.price],['Costo sin IVA',propCost],['Costo con IVA',p=>{const c=propCost(p);return c==null||p.tax==null?null:c*(1+p.tax/100);}],
 ['Imagen',p=>p.hasPhoto?(p.photoSuspended?'Sí · suspendida':'Sí'):'No'],['Estado XML',()=> 'No integrado']
];
function propExtra(){
 if(!propQuery('[data-prop-all]').checked)return [];
 const out=[],seen=new Set();
 for(const [section,target] of [['general',form],['costs',costsForm],['prices',priceForm]]){
  for(const input of Array.from(target.elements).filter(e=>e.name&&e.name!=='articuloOperacion')){
   const key=section+':'+input.name+(['checkbox','radio'].includes(input.type)?':'+input.value:'');if(seen.has(key))continue;seen.add(key);
   const label=input.closest('label')?.childNodes[0]?.textContent?.trim()||input.name;
   out.push([section+' · '+label,p=>{const f=p[section]?.find(v=>v[0]===input.name&&(!['checkbox','radio'].includes(input.type)||v[1]===input.value));return f?f[2]===null?f[1]:f[2]?'Sí':'No':'';}]);
  }
 }
 return out;
}
function propRender(){
 const filters=Object.fromEntries([...main.querySelectorAll('[data-prop-filter]')].map(i=>[i.dataset.propFilter,i.value]));
 propFiltered=propRows.filter(p=>(!propQuery('[data-prop-missing]').checked||!p.barcode)&&(!filters.name||propNormalize(p.name).includes(propNormalize(filters.name)))&&(!filters.providerCode||propNormalize(propGeneral(p,'referencia')).includes(propNormalize(filters.providerCode)))&&(!filters.barcode||propNormalize(p.barcode+' '+p.code+' '+propGeneral(p,'sku')).includes(propNormalize(filters.barcode)))&&(!filters.supplier||propGeneral(p,'proveedor')===filters.supplier)&&[1,2,3,4].every(i=>!filters['categoria'+i]||propGeneral(p,'categoria'+i)===filters['categoria'+i]));
 const cols=[...propCore,...propExtra()],head=propQuery('thead'),body=propQuery('tbody');head.replaceChildren();body.replaceChildren();
 const hr=document.createElement('tr');for(const label of ['Elegir',...cols.map(c=>c[0]),'Acción']){const th=document.createElement('th');th.textContent=label;hr.append(th);}head.append(hr);
 const pages=Math.ceil(propFiltered.length/50);propPage=Math.max(0,Math.min(propPage,pages-1));
 for(const p of propFiltered.slice(propPage*50,(propPage+1)*50)){
  const row=document.createElement('tr'),first=document.createElement('td'),check=document.createElement('input');check.type='checkbox';check.checked=propSelected.has(p.id);check.onchange=()=>{check.checked?propSelected.add(p.id):propSelected.delete(p.id);propControls();};first.append(check);row.append(first);
  const inputs={};let driver='price',edited=false;
  for(const [label,read] of cols){const td=document.createElement('td'),value=read(p);
   if(['Código de barras','% Gan.','Precio 1','Costo sin IVA','Costo con IVA'].includes(label)){
    const input=document.createElement('input');input.value=value==null?'':typeof value==='number'?value.toFixed(2):value;input.setAttribute('aria-label',label+' · '+p.name);input.readOnly=label.startsWith('Costo')||(label!=='Código de barras'&&expectedEnabled);inputs[label]=input;td.append(input);
   }else td.textContent=value??'';row.append(td);
  }
  const price=inputs['Precio 1'],gain=inputs['% Gan.'],barcode=inputs['Código de barras'];
  for(const [el,d] of [[price,'price'],[gain,'gain']])el.oninput=()=>{driver=d;edited=true;try{const v=propPricing(p,d,el.value);if(d==='gain')price.value=v.price.toFixed(2);else gain.value=v.gain==null?'':v.gain.toFixed(2);propMessage('');}catch(e){propMessage(e.message);}};
  const td=document.createElement('td'),save=document.createElement('button');save.type='button';save.textContent='Guardar';td.append(save);row.append(td);body.append(row);
  save.onclick=async()=>{
   if(propBusy)return;propBusy=true;main.inert=true;
   try{
    const newBarcode=barcode.value.trim();if(!newBarcode)throw Error('El artículo debe conservar código de barras.');
    const native=await propApi('native/'+p.id);if(native.product.version!==p.version)throw Error('Otro usuario modificó el artículo. Recargue.');
    const product=native.product,originalBarcode=product.barcode;
    const general=native.general||[],costs=native.costs||[],prices=native.prices||[],other=native.other||{};
    const set=(fields,key,val)=>{const f=fields.find(a=>a[0]===key);if(f)f[1]=String(val);else fields.push([key,String(val),null]);};
    product.barcode=newBarcode;product.codes=[...new Set([product.code,newBarcode,...product.codes.filter(c=>c!==originalBarcode)])];set(general,'barras',newBarcode);
    if(edited){
     if(expectedEnabled)throw Error('El porcentaje esperado está activado.');
     const v=price.value.trim()===''&&driver==='price'?{price:null,gain:null}:propPricing(p,driver,driver==='gain'?gain.value:price.value);
     let primary=product.prices.find(a=>a.listNumber===0);
     if(!primary){primary={listNumber:0,amount:null,currency:p.currency||'Colón'};product.prices.push(primary);}
     set(prices,'precioAnterior',primary.amount??'');primary.amount=v.price;set(prices,'lista0_precio',v.price==null?'':v.price.toFixed(2));set(prices,'lista0_ganancia',v.gain==null?'':v.gain.toFixed(2));
    }
    await propApi('native/'+p.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({product,general,costs,prices,other,taxRate:null})});
    await propLoad();propMessage('Artículo guardado: '+p.name);
   }catch(e){propMessage('No se guardó: '+e.message);}finally{propBusy=false;main.inert=false;propControls();}
  };
 }
 propCount.textContent=propFiltered.length+' artículos SQL';propQuery('[data-prop-page]').textContent=pages?'Página '+(propPage+1)+' de '+pages:'';
 propQuery('[data-prop-prev]').disabled=propPage===0;propQuery('[data-prop-next]').disabled=propPage+1>=pages;propControls();
}
async function propLoad(){
 const rows=[];for(let n=1;n<=500;n++){const result=await propApi('properties?page='+n);rows.push(...result.items);if(!result.hasMore)break;if(n===500)throw Error('Catálogo supera límite de consulta de 50.000 artículos.');}
 propRows=rows;for(const id of propSelected)if(!rows.some(p=>p.id===id))propSelected.delete(id);
 propOptions();propRender();
}
async function propBatch(field,value,rows){
 if(propBusy||!rows.length)return;if(rows.length>5000){propMessage('Seleccione máximo 5000 artículos por operación.');return;}
 if(!confirm('¿Aplicar '+field+' a '+rows.length+' artículos?'))return;
 propBusy=true;main.inert=true;
 try{const result=await propApi('properties/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({field,value,items:rows.map(p=>({id:p.id,version:p.version}))})});propSelected.clear();await propLoad();propMessage(result.updated+' artículos actualizados en SQL.');}
 catch(e){propMessage('No se completó: '+e.message);}finally{propBusy=false;main.inert=false;propControls();}
}
propQuery('[data-prop-batch-field]').onchange=propBatchOptions;
propQuery('[data-prop-batch-process]').onclick=()=>{const v=propQuery('[data-prop-batch-value]').value;if(!v){propMessage('Seleccione la nueva clasificación.');return;}propBatch(propQuery('[data-prop-batch-field]').value,v,propRows.filter(p=>propSelected.has(p.id)));};
propQuery('[data-prop-images-delete]').onclick=()=>propBatch('deletePhoto',null,propPhotos());
propQuery('[data-prop-images-suspend]').onclick=()=>{const rows=propPhotos();propBatch(rows.every(p=>p.photoSuspended)?'reactivatePhoto':'suspendPhoto',null,rows);};
propQuery('[data-prop-select-filtered]').onchange=e=>{for(const p of propFiltered)e.target.checked?propSelected.add(p.id):propSelected.delete(p.id);propRender();};
for(const el of main.querySelectorAll('[data-prop-filter],[data-prop-missing],[data-prop-all]'))el.addEventListener(el.type==='search'?'input':'change',()=>{propPage=0;propRender();});
propQuery('[data-prop-xml]').disabled=true;propQuery('[data-prop-xml]').title='Pendiente de registro de compras SQL';
propQuery('[data-prop-prev]').onclick=()=>{propPage--;propRender();};propQuery('[data-prop-next]').onclick=()=>{propPage++;propRender();};
refreshArticleProperties=()=>{if(!main.hidden&&!propBusy)propLoad().catch(e=>propMessage(e.message));};
for(const other of menu.querySelectorAll('.menu-item')){if(other===item)continue;const previous=other.onclick;other.onclick=function(...args){main.hidden=true;item.classList.remove('selected');return previous?.apply(this,args);};}
item.onclick=()=>{showConfiguration(false);for(const view of Array.from(root.children).filter(v=>v.tagName==='MAIN'))view.hidden=view!==main;menu.querySelectorAll('.menu-item').forEach(b=>b.classList.remove('selected'));main.hidden=false;item.classList.add('selected');propMessage('Consultando SQL…');propLoad().then(()=>propMessage('')).catch(e=>propMessage(e.message));};
