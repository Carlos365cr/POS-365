
let sqlNativeCurrent=null,sqlNativeBusy=false;
const sqlCatalogUrl='/api/catalog/';
async function sqlArticleRequest(url,options={}){
 const r=await fetch(url,{cache:'no-store',...options});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.error||'Error SQL HTTP '+r.status);
 return data;
}
function sqlArticleStatus(text,error=false){
 message.textContent=text;
 message.style.color=error?'#a32222':'#23633f';
}
// Tax configuration lives in the original Prices tab, not in a parallel toolbar.
const nativeTaxLabel=document.createElement('label');
nativeTaxLabel.textContent='Tarifa IVA SQL (%) · desarrollo';
const nativeTaxInput=document.createElement('input');
nativeTaxInput.type='number';nativeTaxInput.name='sqlTaxRate';nativeTaxInput.min='0';
nativeTaxInput.max='100';nativeTaxInput.step='0.0001';nativeTaxInput.placeholder='Sin configurar';
nativeTaxLabel.append(nativeTaxInput);
priceForm.querySelector('.price-settings')?.prepend(nativeTaxLabel);
function sqlArticleRates(){
 const tax=priceForm.elements.sqlTaxRate;
 if(tax && tax.value.trim()){
  const n=Number(tax.value);
  if(!Number.isFinite(n)||n<0||n>100)throw Error('Tarifa IVA no valida.');
  return n;
 }
 // If no explicit rate was supplied, retain the existing SQL tax-rate selection.
 return null;
}
function sqlOriginalPriceRows(){
 const list=[];
 for(let index=0;index<100;index++){
  const input=priceForm.elements['lista'+index+'_precio'];
  if(!input)continue;
  const currencyField=priceForm.elements['lista'+index+'_moneda'];
  const amount=input.value.trim()===''?null:Number(input.value);
  if(amount!==null&&(!Number.isFinite(amount)||amount<0||
     Math.round(amount*10000)/10000!==amount))
     throw Error('Precio invalido en lista '+index);
  const currency=currencyField?.value||'Colón';
  list.push({listNumber:index,amount,currency});
 }
 if(!list.some(x=>x.listNumber===0))throw Error('No se encontro precio de lista 0 en la pestaña Precios.');
 return list;
}
function sqlOriginalExtraCodes(){
 return Array.from(root.querySelectorAll('#art-codigos input'))
   .map(el=>el.value.trim()).filter(Boolean);
}
function sqlArticlePayload(){
 const id=sqlNativeCurrent?.product?.id||crypto.randomUUID();
 const barcode=form.elements.barras.value.trim();
 const code=form.elements.codigo.value.trim()||barcode;
 const name=form.elements.nombre.value.trim();
 const cabys=cabysCode.value.trim();
 if(!code||!barcode||!name)throw Error('Complete código interno, código de barras y nombre.');
 if(cabys&&!/^\d{13}$/.test(cabys))throw Error('CABYS debe contener 13 dígitos.');
 if(form.elements.referencia.value.trim()&&(!form.elements.proveedor.value||
      form.elements.proveedor.value==='Sin asignar'))
   throw Error('Seleccione proveedor para el código de proveedor.');
 const codes=[code,barcode,form.elements.sku?.value.trim(),
    ...sqlOriginalExtraCodes()].filter(Boolean);
 const prices=sqlOriginalPriceRows();
 const product={id,code,barcode,name,cabys,
   includesVAT:priceForm.elements.incluyeIVA.checked,
   codes:[...new Set(codes)],prices,
   version:sqlNativeCurrent?.product?.version??null,source:null};
 const other={
   promotions:{scannerEnabled:scannerCheckbox.checked,scaleEnabled},
   pendingGainIndices:Array.from(pendingGainEdits),
   photo:articlePhoto||null,photoSuspended:articlePhotoSuspended===true
 };
 return {product,general:captureTrialForm(form),costs:captureTrialForm(costsForm),
         prices:captureTrialForm(priceForm),other,taxRate:sqlArticleRates()};
}
async function sqlArticleLoad(id){
 const data=await sqlArticleRequest(sqlCatalogUrl+'native/'+id);
 if(!data.product)throw Error('Articulo SQL no encontrado.');
 const t=await sqlArticleRequest(sqlCatalogUrl+'products/'+id+'/tax');
 const p=data.product;
 const oldStyle={code:p.code,barcode:p.barcode,name:p.name,cabys:p.cabys,
     currency:p.prices.find(v=>v.listNumber===0)?.currency||'Colón',
     price:p.prices.find(v=>v.listNumber===0)?.amount??null,
     codes:p.codes,details:{
       general:data.general||[],costs:data.costs||[],prices:data.prices||[],
       promotions:data.other?.promotions||{},
       pendingGainIndices:data.other?.pendingGainIndices||[]},
     photo:data.other?.photo||null,photoSuspended:data.other?.photoSuspended===true};
 // Existing native renderer populates all three tabs and their dependent controls.
 loadTrialProduct(oldStyle);
 sqlNativeCurrent=data;
 if(priceForm.elements.sqlTaxRate)
   priceForm.elements.sqlTaxRate.value=t.rate??'';
 setArticleOperation('modificacion');
 sqlArticleStatus('Artículo '+p.code+' cargado desde SQL. Edite y pulse Procesar.');
}
async function searchSqlArticle(){
 if(sqlNativeBusy)return;
 sqlNativeBusy=true;
 try{
  const query=root.querySelector('#art-buscar').value.trim()||
    form.elements.barras.value.trim();
  if(!query)throw Error('Escriba código o nombre para buscar en SQL.');
  const result=await sqlArticleRequest(sqlCatalogUrl+'products?'+new URLSearchParams({q:query,page:'1'}));
  if(!result.items.length){sqlArticleStatus('No hay coincidencias en POS365_DEV.',true);return;}
  let item=result.items[0];
  if(result.items.length>1){
   const list=result.items.slice(0,15);
   const selection=prompt('Artículos SQL:\n'+list.map((p,i)=>
       (i+1)+'. '+p.code+' | '+p.name).join('\n')+
       '\nSeleccione número (o refine la búsqueda):','1');
   if(selection===null)return;
   const n=Number(selection)-1;
   if(!Number.isInteger(n)||n<0||n>=list.length)throw Error('Selección inválida.');
   item=list[n];
  }
  await sqlArticleLoad(item.id);
 }catch(error){sqlArticleStatus(error.message,true)}
 finally{sqlNativeBusy=false;}
}
async function saveSqlArticle(event){
 event.preventDefault();
 event.stopPropagation();
 if(sqlNativeBusy)return;
 sqlNativeBusy=true;
 try{
  const mode=getArticleOperation();
  if(mode==='consulta')throw Error('Modo Consulta: use Buscar artículo.');
  if(mode==='exclusion')throw Error('La exclusión SQL aún no está habilitada.');
  if(mode==='modificacion'&&!sqlNativeCurrent)
    throw Error('Primero busque el artículo en SQL para obtener su versión de edición.');
  if(mode==='inclusion'&&sqlNativeCurrent)
    throw Error('Hay un artículo cargado. Seleccione Inclusión o busque el artículo a modificar.');
  if(articlePhotoBusy)throw Error('Espere a que finalice la imagen.');
  const payload=sqlArticlePayload();
  if(!confirm((mode==='modificacion'?'Modificar':'Crear')+
    ' '+payload.product.code+' en POS365_DEV con TODOS los campos de General, Costos y Precios?'))return;
  const result=await sqlArticleRequest(sqlCatalogUrl+'native/'+payload.product.id,{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  if(!result.extendedSaved)throw Error('El servidor no confirmó todos los campos.');
  sqlNativeCurrent={...payload,product:result.product};
  sqlArticleStatus('Artículo '+result.product.code+' guardado correctamente en SQL Server. Puede buscarlo en facturación.');
 }catch(error){sqlArticleStatus('No se guardó: '+error.message,true);}
 finally{sqlNativeBusy=false;}
}
