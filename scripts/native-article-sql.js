(() => {
  'use strict';
  const endpoint='/api/catalog/products';
  let current=null, working=false;
  const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').replace(/\s*\*/g,'').trim();
  const say=(area,message,error=false)=>{
    const status=area.querySelector('[data-native-sql-status]');
    if(status){status.textContent=message;status.style.color=error?'#a32024':'#285c43';}
  };
  function field(root,heading,scope=''){
    const wanted=normalize(heading);
    const scopes=[...root.querySelectorAll('fieldset')].filter(el=>
      !scope||normalize(el.querySelector('legend')?.textContent).includes(normalize(scope)));
    const candidates=scope?scopes:[root];
    for(const container of candidates){
      for(const label of container.querySelectorAll('label')){
        const ownText=normalize([...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' '));
        if(ownText===wanted || (ownText===''&&normalize(label.textContent).startsWith(wanted))){
          const input=label.querySelector('input,textarea,select') ||
            (label.htmlFor && root.querySelector('[id="'+CSS.escape(label.htmlFor)+'"]')) ||
            label.parentElement?.querySelector('input,textarea,select');
          if(input)return input;
        }
      }
      for(const el of container.querySelectorAll('input,textarea,select')){
        const text=normalize(el.getAttribute('aria-label')||el.getAttribute('placeholder')||'');
        if(text===wanted)return el;
      }
    }
    return null;
  }
  function write(el,value){
    if(!el)return;
    if(el.type==='checkbox')el.checked=!!value;
    else el.value=String(value??'');
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  async function api(path,options){
    const response=await fetch(path,{cache:'no-store',...options});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||'SQL Server devolvio HTTP '+response.status);
    return data;
  }
  function activeArticleRoot(title){
    return title.closest('section,article,main,[role="tabpanel"]')||document;
  }
  function getControls(root,bar){
    return {
      name:field(root,'Nombre','Descripción'),
      barcode:field(root,'Código de barras','Códigos'),
      cabys:field(root,'Código','CABYS'),
      supplier:field(root,'Código proveedor','Códigos'),
      sku:field(root,'SKU','Códigos'),
      internal:field(root,'Código interno','Códigos'),
      extra:[1,2,3].map((n)=>field(root,n===1?'Código de barras adicional':'Código de barras adicional '+n,'Códigos')),
      price:bar.querySelector('[data-native-sql-price]'),
      tax:bar.querySelector('[data-native-sql-tax]'),
      code:bar.querySelector('[data-native-sql-code]')
    };
  }
  function getValues(c){
    const read=el=>el?.value?.trim()||'';
    const barcode=read(c.barcode), internal=read(c.internal);
    // Never silently treat a historical auto-number as the SQL primary code.
    const code=read(c.code)||barcode||read(c.sku)||internal;
    const priceText=read(c.price).replace(',','.');
    if(!code||!read(c.name))throw Error('Complete codigo SQL y nombre del articulo.');
    if(priceText===''||! /^(?:0|[0-9]+)(?:\.[0-9]{1,4})?$/.test(priceText))
      throw Error('Ingrese el precio de la lista 0 (hasta 4 decimales).');
    const price=Number(priceText);
    if(!Number.isFinite(price))throw Error('Precio SQL invalido.');
    const cabys=read(c.cabys);
    if(cabys&&!/^[0-9]{13}$/.test(cabys))
      throw Error('El CABYS debe contener 13 digitos.');
    const codes=[barcode,internal,read(c.sku),read(c.supplier),...c.extra.map(read)]
      .filter(x=>x&&x!==code);
    const rate=read(c.tax).replace(',','.');
    if(rate!==''&&(!/^\d+(?:\.\d{1,4})?$/.test(rate)||Number(rate)>100))
      throw Error('Tarifa IVA de desarrollo debe ser un porcentaje de 0 a 100.');
    return {code,barcode,name:read(c.name),cabys,price,
      codes:[...new Set(codes)],taxRate:rate===''?null:Number(rate)};
  }
  function apply(p,c){
    write(c.code,p.code);
    write(c.barcode,p.barcode);
    write(c.name,p.name);
    write(c.cabys,p.cabys);
    write(c.price,p.prices?.find(x=>x.listNumber===0)?.amount??'');
    c.extra.forEach((el,i)=>write(el,p.codes.filter(x=>x!==p.code&&x!==p.barcode)[i]??''));
  }
  function createBar(title){
    const bar=document.createElement('div');
    bar.dataset.nativeSqlBar='true';
    bar.style.cssText='padding:12px;margin:10px 0;border:1px solid #9eb5aa;border-radius:8px;background:#eaf3ed;display:flex;align-items:end;gap:10px;flex-wrap:wrap;font:13px system-ui';
    const input=(label,key,width='140px')=>{
      const box=document.createElement('label');box.style.cssText='display:grid;gap:4px';
      box.append(document.createTextNode(label));
      const el=document.createElement('input');el.dataset[key]='true';el.style.cssText='width:'+width+';padding:7px;border:1px solid #9aaca2;border-radius:5px';
      box.append(el);bar.append(box);return el;
    };
    const code=input('Código SQL / barras','nativeSqlCode');
    code.placeholder='P3';
    const price=input('Precio lista 0 (₡)','nativeSqlPrice','120px');price.type='number';price.min='0';price.step='0.0001';
    const tax=input('Tarifa IVA % (prueba)','nativeSqlTax','110px');tax.type='number';tax.min='0';tax.max='100';tax.step='0.0001';
    const query=input('Buscar en SQL','nativeSqlQuery','170px');query.placeholder='Código o nombre';
    const button=(text,fn)=>{
      const b=document.createElement('button');b.type='button';b.textContent=text;
      b.style.cssText='padding:8px 11px;border:0;border-radius:5px;background:#15618c;color:white;cursor:pointer';
      b.addEventListener('click',fn);bar.append(b);return b;
    };
    const root=activeArticleRoot(title);
    const controls=()=>getControls(root,bar);
    const search=async()=>{
      if(working)return;
      working=true;
      try{
        const q=query.value.trim();if(!q)throw Error('Escriba el codigo o nombre para buscar.');
        const result=await api(endpoint+'?'+new URLSearchParams({q,page:'1'}));
        if(!result.items.length)throw Error('No existe en POS365_DEV. Puede crearlo con Guardar artículo SQL.');
        let selected=result.items[0];
        if(result.items.length>1){
          const selection=prompt('Articulos encontrados:\n'+result.items.slice(0,15).map((p,i)=>(i+1)+'. '+p.code+' — '+p.name).join('\n')+'\nEscriba el numero a abrir:', '1');
          if(selection===null)return;
          const index=Number(selection)-1;
          if(!Number.isInteger(index)||index<0||index>=Math.min(15,result.items.length))
            throw Error('Seleccion invalida. Refine la busqueda.');
          selected=result.items[index];
        }
        current=await api(endpoint+'/'+encodeURIComponent(selected.id));
        apply(current,controls());
        const rate=await api(endpoint+'/'+encodeURIComponent(selected.id)+'/tax');
        write(controls().tax,rate.rate??'');
        say(bar,'Artículo cargado desde SQL: '+current.code+'. Puede modificarlo y guardar.');
      }catch(error){say(bar,error.message,true)}
      finally{working=false}
    };
    const save=async()=>{
      if(working)return;
      working=true;
      try{
        const values=getValues(controls());
        const p=current?{...current}:{id:crypto.randomUUID(),version:null,source:null};
        p.code=values.code;p.barcode=values.barcode;p.name=values.name;p.cabys=values.cabys;
        p.includesVAT=true;
        p.codes=values.codes;
        // Do not overwrite other price lists on an existing product.
        p.prices=current?[...current.prices]:[];
        const zero=p.prices.find(x=>x.listNumber===0);
        if(zero){zero.amount=values.price;zero.currency='Colón';}
        else p.prices.push({listNumber:0,amount:values.price,currency:'Colón'});
        if(!confirm('Guardar '+values.code+' en POS365_DEV? Solo codigo, nombre, barras, CABYS, lista 0 y tarifa IVA de desarrollo. NO se guardan costos, categorias, existencias ni otros campos historicos.'))return;
        const saved=await api(endpoint+'/'+p.id,{method:'PUT',
          headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
        current=saved;
        if(values.taxRate!==null){
          await api(endpoint+'/'+p.id+'/tax',{method:'PUT',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({rate:values.taxRate})});
        }
        apply(saved,controls());
        say(bar,'Guardado en SQL Server: '+saved.code+'. Compruebe el articulo en Facturacion POS.');
      }catch(error){say(bar,error.message,true)}
      finally{working=false}
    };
    button('Buscar SQL',search);
    button('Nuevo artículo SQL',()=>{current=null;write(code,'');write(price,'');write(tax,'');say(bar,'Modo inclusion SQL. Complete los campos del mantenimiento original.');});
    button('Guardar artículo SQL',save);
    const message=document.createElement('span');message.dataset.nativeSqlStatus='true';message.setAttribute('role','status');
    message.style.cssText='flex-basis:100%;font-weight:600';bar.append(message);
    title.parentNode?.insertBefore(bar,title.nextSibling);
    say(bar,'Edite nombre, barras y CABYS en el formulario principal; código/precio/IVA arriba. Los otros campos aún no se guardan en SQL.');
  }
  let pending=false;
  function attach(){
    pending=false;
    for(const heading of document.querySelectorAll('h1,h2,h3,h4,legend,strong')){
      if(normalize(heading.textContent)!=='mantenimiento de articulos')continue;
      const parent=heading.parentElement;
      if(!parent||parent.querySelector('[data-native-sql-bar]'))continue;
      createBar(heading);
    }
  }
  new MutationObserver(()=>{
    if(!pending){pending=true;requestAnimationFrame(attach)}
  }).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach);
  else attach();
})();
