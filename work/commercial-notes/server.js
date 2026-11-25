// Internal commercial notes. Amounts are integer minor currency units.
async function commercialNoteTables(db){
 await db.batch([
  db.prepare(`CREATE TABLE IF NOT EXISTS commercial_notes(id TEXT PRIMARY KEY,series TEXT NOT NULL,seq INTEGER NOT NULL CHECK(seq BETWEEN 1 AND 9999999999),version INTEGER NOT NULL,payload TEXT NOT NULL,last_operation TEXT NOT NULL UNIQUE,UNIQUE(series,seq))`),
  db.prepare(`CREATE TABLE IF NOT EXISTS commercial_note_operations(id TEXT PRIMARY KEY,author TEXT NOT NULL,request TEXT NOT NULL,response TEXT NOT NULL)`),
  db.prepare(`CREATE TABLE IF NOT EXISTS commercial_note_history(note TEXT NOT NULL,version INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(note,version))`),
  db.prepare(`CREATE TABLE IF NOT EXISTS commercial_note_ledger(note TEXT PRIMARY KEY,account TEXT NOT NULL,party TEXT NOT NULL,currency TEXT NOT NULL,invoice TEXT,amount INTEGER NOT NULL,version INTEGER NOT NULL)`),
  db.prepare(`CREATE TABLE IF NOT EXISTS commercial_note_designs(kind TEXT PRIMARY KEY,version INTEGER NOT NULL,payload TEXT NOT NULL,author TEXT NOT NULL)`)
 ]);
}
function commercialNoteRow(row){return {...JSON.parse(row.payload),id:row.id,version:row.version};}
function commercialNoteContact(c,type){const flags=Object.fromEntries((c.fields||[]).map(f=>[f[0],f[2]??f[1]]));return c.active!==false&&!c.deleted&&(type==='proveedor'?c.supplier||flags.esProveedor:c.customer||c.client||flags.esCliente||flags.esClienteInterno);}
async function commercialNoteCatalog(db){
 const {snapshot,revision}=await readBoxSnapshot(db);
 const contacts=(snapshot.contactsState?.records||[]),parties={cliente:[],proveedor:[]},invoices=[];
 for(const type of Object.keys(parties))for(const c of contacts)if(commercialNoteContact(c,type))parties[type].push([String(c.id),c.name||c.code||String(c.id)]);
 for(const p of snapshot.purchases||[])if(p.status!=='annulled'&&p.supplier?.id)invoices.push({id:'purchase:'+p.id,number:p.invoice||p.id,party:String(p.supplier.id),type:'proveedor',currency:p.currency==='USD'?'USD':'CRC',date:p.invoiceDate||p.receivedDate,total:p.totalCents||0,source:'Compras'});
 const exists=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='internal_invoices'").first();
 if(exists){const rows=await db.prepare('SELECT payload FROM internal_invoices').all();for(const r of rows.results){const b=JSON.parse(r.payload);if(b.header?.clientId)invoices.push({id:'internal:'+b.number,number:b.number,party:String(b.header.clientId),type:'cliente',currency:(b.header.moneda||b.header.currency)==='USD'?'USD':'CRC',date:(b.header.fecha||b.header.date||'').slice(0,10),total:b.gross-b.discount,source:'Facturación interna'});}}
 for(const b of snapshot.sales||[]){const party=b.clientId||b.customer?.id||b.header?.clientId;if(party&&b.status!=='annulled')invoices.push({id:'pos:'+b.id,number:b.invoiceNumber||b.number||b.id,party:String(party),type:'cliente',currency:b.currency==='USD'?'USD':'CRC',date:(b.date||'').slice(0,10),total:b.totalCents||0,source:'Facturación POS'});}
 return {parties,invoices,revision};
}
function commercialNoteValidation(d){
 const text=(x,n)=>typeof x==='string'&&x.length<=n;
 if(!d||!['cliente','proveedor'].includes(d.type)||!['credito','debito'].includes(d.noteType)||!text(d.party,200)||!d.party||!['CRC','USD'].includes(d.currency)||!text(d.warehouse,200)||!d.warehouse||!text(d.reference,300)||!text(d.reason,200)||!d.reason||!text(d.comment,4000)||!text(d.date,10)||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date||![10,15,30,45,60].includes(d.term)||!Number.isFinite(d.rate)||d.rate<=0||![d.subtotal,d.tax,d.other].every(v=>Number.isSafeInteger(v)&&Math.abs(v)<=1000000000000)||!Number.isSafeInteger(d.subtotal+d.tax+d.other)||[d.subtotal,d.tax,d.other].some(v=>d.noteType==='credito'?v>0:v<0)||!(d.invoice==null||text(d.invoice,200)))return 'Revise los campos, las fechas, los importes y el tipo de nota.';
 return '';
}
async function manageCommercialNotes(request,env,email,claims){
 const db=env.DB,url=new URL(request.url);await commercialNoteTables(db);
 if(request.method==='GET'){
  if(url.searchParams.get('catalog')==='1')return json({...await commercialNoteCatalog(db),user:claims.name||email});
  if(url.searchParams.get('history')==='1'){const rows=await db.prepare('SELECT rowid AS cursor,note,version,payload FROM commercial_note_history WHERE rowid>? ORDER BY rowid LIMIT 201').bind(Number(url.searchParams.get('after'))||0).all();return json({history:rows.results.slice(0,200),next:rows.results.length>200?String(rows.results[199].cursor):null});}
  if(url.searchParams.get('ledger')==='1'){
   const rows=await db.prepare('SELECT l.*,n.payload FROM commercial_note_ledger l JOIN commercial_notes n ON n.id=l.note ORDER BY l.note').all();
   return json({entries:rows.results.map(({payload,...entry})=>{const note=JSON.parse(payload);return {...entry,reference:[note.reference?.trim(),note.invoice?note.invoiceNumber:''].filter(Boolean).join(' - '),partyName:note.partyName||entry.party,state:note.state,originalAmount:note.subtotal+note.tax+note.other};})});
  }
  if(url.searchParams.get('designs')==='1')return json({designs:(await db.prepare('SELECT * FROM commercial_note_designs').all()).results});
  const after=url.searchParams.get('after')||'',rows=await db.prepare('SELECT * FROM commercial_notes WHERE id>? ORDER BY id LIMIT 201').bind(after).all();
  const records=rows.results.slice(0,200).map(commercialNoteRow);
  return json({records,next:rows.results.length>200?records.at(-1).id:null});
 }
 if(request.method!=='POST'||request.headers.get('Origin')!==url.origin||request.headers.get('Content-Type')!=='application/json')return json({error:'Solicitud no permitida.'},403);
 const body=await request.json().catch(()=>null);
 if(!body||! /^[a-f0-9-]{36}$/i.test(body.operation||''))return json({error:'Intento de guardado inválido.'},400);
 const payload=JSON.stringify(body),seen=await db.prepare('SELECT * FROM commercial_note_operations WHERE id=?').bind(body.operation).first();
 if(seen)return seen.author===email&&seen.request===payload?json(JSON.parse(seen.response)):json({error:'El intento de guardado corresponde a otros datos.'},409);
 if(body.action==='design'){
  const fields=body.fields;
  if(!['cliente','proveedor'].includes(body.kind)||!Number.isSafeInteger(body.version)||!Array.isArray(fields)||fields.length!==26||new Set(fields.map(f=>f.key)).size!==26||fields.some(f=>typeof f.key!=='string'||![f.x,f.y,f.w,f.size].every(Number.isFinite)||f.x<0||f.y<0||f.x+f.w>215.9||f.y>279.4||f.w<1||f.size<7||f.size>32||!['helvetica','times','courier'].includes(f.font)||!['left','center','right'].includes(f.align)||['visible','bold','italic'].some(k=>typeof f[k]!=='boolean')))return json({error:'Diseño de carta inválido.'},400);
  const data=JSON.stringify(fields),response=JSON.stringify({ok:true,version:body.version+1});
  await db.batch([db.prepare('INSERT INTO commercial_note_designs(kind,version,payload,author) SELECT ?,1,?,? WHERE ?=0 ON CONFLICT(kind) DO UPDATE SET version=version+1,payload=excluded.payload,author=excluded.author WHERE version=?').bind(body.kind,data,email,body.version,body.version),db.prepare('INSERT INTO commercial_note_operations(id,author,request,response) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM commercial_note_designs WHERE kind=? AND version=? AND payload=? AND author=?) ON CONFLICT(id) DO NOTHING').bind(body.operation,email,payload,response,body.kind,body.version+1,data,email)]);
  const saved=await db.prepare('SELECT response FROM commercial_note_operations WHERE id=?').bind(body.operation).first();
  return saved?json(JSON.parse(saved.response)):json({error:'El diseño cambió en otra sesión. Vuelva a abrir Diseños.'},409);
 }
 if(!['inclusion','modificacion','exclusion'].includes(body.action))return json({error:'Operación inválida.'},400);
 const old=body.id?await db.prepare('SELECT * FROM commercial_notes WHERE id=?').bind(body.id).first():null;
 if(body.action!=='inclusion'&&(!old||old.version!==body.version||JSON.parse(old.payload).state!=='Activa'))return json({error:'La nota cambió o ya está anulada. Vuelva a consultarla.'},409);
 const previous=old?commercialNoteRow(old):null,source=body.action==='exclusion'?previous:body.note,error=commercialNoteValidation(source);if(error)return json({error},400);
 if(previous&&['type','noteType','party','currency'].some(k=>source[k]!==previous[k]))return json({error:'No se puede cambiar destinatario, moneda o tipo de una nota procesada. Anúlela y cree otra.'},400);
 const catalog=await commercialNoteCatalog(db);
 if(body.action!=='exclusion'&&!catalog.parties[source.type].some(p=>p[0]===source.party))return json({error:'El cliente o proveedor no existe o está inactivo.'},409);
 if(body.action!=='exclusion'&&source.invoice&&!catalog.invoices.some(i=>i.id===source.invoice&&i.party===source.party&&i.type===source.type&&i.currency===source.currency))return json({error:'La factura no pertenece al destinatario o a la moneda elegida.'},409);
 const d=Object.fromEntries(['type','noteType','party','currency','warehouse','reference','reason','comment','date','term','rate','subtotal','tax','other','invoice'].map(k=>[k,source[k]??null]));
 const now=new Date().toISOString();Object.assign(d,{invoiceNumber:d.invoice?(catalog.invoices.find(i=>i.id===d.invoice)?.number||(previous?.invoice===d.invoice?previous.invoiceNumber:'')||''):'',state:body.action==='exclusion'?'Anulado':'Activa',user:claims.name||email,userId:email,createdBy:previous?.createdBy||email,createdAt:previous?.createdAt||now,processedAt:now,operation:body.action,partyName:catalog.parties[d.type].find(p=>p[0]===d.party)?.[1]||previous?.partyName||d.party});
 const series=(d.noteType==='credito'?'NC':'ND')+'-'+(d.type==='cliente'?'C':'P'),data=JSON.stringify(d),version=body.action==='inclusion'?1:old.version+1;
 const writes=[];
 if(body.action==='inclusion')writes.push(db.prepare(`INSERT INTO commercial_notes(id,series,seq,version,payload,last_operation) SELECT ?||'-'||printf('%010d',COALESCE(MAX(seq),0)+1),?,COALESCE(MAX(seq),0)+1,1,?,? FROM commercial_notes WHERE series=? HAVING COALESCE(MAX(seq),0)<9999999999 AND NOT EXISTS(SELECT 1 FROM commercial_note_operations WHERE id=?)`).bind(series,series,data,body.operation,series,body.operation));
 else writes.push(db.prepare('UPDATE commercial_notes SET version=version+1,payload=?,last_operation=? WHERE id=? AND version=? AND NOT EXISTS(SELECT 1 FROM commercial_note_operations WHERE id=?)').bind(data,body.operation,old.id,old.version,body.operation));
 writes.push(db.prepare(`INSERT INTO commercial_note_ledger(note,account,party,currency,invoice,amount,version) SELECT id,?,?,?,?,?,version FROM commercial_notes WHERE last_operation=? ON CONFLICT(note) DO UPDATE SET account=excluded.account,party=excluded.party,currency=excluded.currency,invoice=excluded.invoice,amount=excluded.amount,version=excluded.version`).bind(d.type==='cliente'?'CXC':'CXP',d.party,d.currency,d.invoice,d.state==='Anulado'?0:d.subtotal+d.tax+d.other,body.operation));
 writes.push(db.prepare('INSERT INTO commercial_note_history(note,version,payload) SELECT id,version,payload FROM commercial_notes WHERE last_operation=? ON CONFLICT(note,version) DO NOTHING').bind(body.operation));
 writes.push(db.prepare(`INSERT INTO commercial_note_operations(id,author,request,response) SELECT ?,?,?,json_object('ok',json('true'),'record',json_set(payload,'$.id',id,'$.version',version)) FROM commercial_notes WHERE last_operation=? ON CONFLICT(id) DO NOTHING`).bind(body.operation,email,payload,body.operation));
 await db.batch(writes);
 const result=await db.prepare('SELECT response FROM commercial_note_operations WHERE id=?').bind(body.operation).first();
 return result?json(JSON.parse(result.response)):json({error:'La nota cambió en otra sesión. Vuelva a consultarla.'},409);
}
