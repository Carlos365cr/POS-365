// Google Identity Services authenticates the three approved workspace accounts.
const allowed = new Set([]);
const json = (value, status=200) => Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const decode = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
const clientId = '';
const sessionCookie = '__Host-cedi_session';
const nonceCookie = '__Host-cedi_nonce';
function cookie(request, name) {
  return (request.headers.get('Cookie') || '').split(';').map(entry => entry.trim())
    .find(entry => entry.startsWith(name + '='))?.slice(name.length + 1);
}
function setCookie(name, value, age) {
  return name + '=' + value + '; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + age;
}
let keys, expiry = 0;
async function verify(token, nonce, failure = {}) {
  const fail = message => { failure.message = message; return null; };
  try {
    if (!token || token.length > 3800) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [head, body, signature] = parts;
    const parse = part => JSON.parse(new TextDecoder().decode(decode(part)));
    const header = parse(head), claims = parse(body), now = Date.now()/1000;
    if (header.alg !== 'RS256' || !['accounts.google.com','https://accounts.google.com'].includes(claims.iss)
        || claims.aud !== clientId) return null;
    if (!Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 60)
      return fail('La identificación venció. Recargá esta página para volver a entrar.');
    if (nonce !== undefined && claims.nonce !== nonce)
      return fail('Se abrió otra sesión de ingreso. Recargá esta pestaña y elegí tu cuenta de nuevo.');
    if (!keys || expiry <= now) {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
      if (!response.ok) return null;
      keys = (await response.json()).keys;
      expiry = now + 300;
    }
    const jwk = keys.find(key => key.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(signature),new TextEncoder().encode(head+'.'+body));
    if (!valid) return null;
    if (claims.email_verified !== true || !allowed.has(claims.email?.toLowerCase()))
      return fail('Elegí el correo de empresa autorizado de Carlos, Yuna o Rubén.');
    if (typeof claims.hd !== 'string' || !claims.hd.trim())
      return fail('Google no identificó esta cuenta como cuenta administrada de la empresa.');
    return claims;
  } catch { return null; }
}
function login() {
  const nonce = crypto.randomUUID();
  return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ingresar a POS 365</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:32px;background:#edf2ed;color:#142e28;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{width:min(100%,990px);display:grid;grid-template-columns:1.1fr 1fr;border-radius:24px;overflow:hidden;background:#fff;box-shadow:0 24px 80px #17362a20}
.brand{position:relative;isolation:isolate;overflow:hidden;min-height:520px;padding:48px;display:flex;flex-direction:column;justify-content:space-between;color:#fff;background:linear-gradient(140deg,#123930,#075845)}
.brand:before{content:"";position:absolute;inset:-5% -60% -40% 20%;z-index:-1;background:repeating-radial-gradient(ellipse at 90% 42%,transparent 0 26px,#c9edb326 27px 28px,transparent 29px 45px);transform:rotate(-20deg)}
.wordmark{font-size:26px;font-weight:800;letter-spacing:-1.8px;display:flex;align-items:center;gap:10px}.mark{width:25px;height:25px;display:inline-block;border:6px solid #c7ee88;border-right-color:transparent;border-radius:8px;transform:rotate(-12deg)}
.art{position:relative;align-self:center;width:160px;height:172px;margin:24px;transform:rotate(9deg);filter:drop-shadow(0 11px 9px #092c2770)}
.paper{height:100%;background:#edf7d5;padding:24px 20px;color:#275541;clip-path:polygon(0 0,100% 0,100% 100%,90% 95%,80% 100%,70% 95%,60% 100%,50% 95%,40% 100%,30% 95%,20% 100%,10% 95%,0 100%)}
.paper b{font-size:18px;letter-spacing:-1px}.lines{height:42px;margin:12px 0;border-block:2px dashed #88a68a;background:repeating-linear-gradient(0deg,transparent 0 7px,#88a68a 7px 9px,transparent 9px 14px);background-size:65% 100%;background-repeat:no-repeat}.bars{height:24px;background:repeating-linear-gradient(90deg,#275541 0 2px,transparent 2px 5px,#275541 5px 9px,transparent 9px 11px)}
.brand h1{margin:0;font-size:clamp(34px,5vw,56px);line-height:1;letter-spacing:-.055em}.brand p{margin:12px 0 0;color:#cfdfd5;line-height:1.5}
.entry{padding:clamp(28px,5vw,64px);align-self:center;min-width:0}.entry h2{margin:0;font-size:clamp(32px,4vw,44px);letter-spacing:-.05em}.entry p{line-height:1.55;color:#51665f}.entry #google{min-height:44px;margin-top:32px}.entry #status{color:#8a331d;font-size:14px}.entry #status:empty{display:none}
@media(max-width:680px){body{padding:16px}main{grid-template-columns:1fr}.brand{min-height:202px;padding:26px}.art{position:absolute;right:4px;top:8px;transform:rotate(9deg) scale(.66);transform-origin:top right;margin:12px}.brand h1{font-size:32px}.brand p{font-size:14px}.entry{padding:32px 26px 40px}}
</style>
<main><section class="brand"><div class="wordmark"><img src="/assets/pos-365-logo.png" alt="POS 365 · Sistema de facturación" style="width:min(100%,320px);height:auto;background:#edf2ed;padding:12px;border-radius:12px"></div>
<div class="art" aria-hidden="true"><div class="paper"><b>POS 365</b><div class="lines"></div><div class="bars"></div></div></div>
<div><h1>POS 365</h1><p>Ventas, compras e inventario</p></div></section>
<section class="entry" aria-labelledby="welcome"><h2 id="welcome">Bienvenido</h2><p>Ingresá con tu cuenta de la empresa.</p><div id="google"></div><p id="status" role="status"></p><noscript>Activá JavaScript para iniciar sesión con Google.</noscript></section></main>
<script nonce="${nonce}">function iniciar(){google.accounts.id.initialize({client_id:'${clientId}',nonce:'${nonce}',callback:async function(r){const status=document.getElementById('status');try{const result=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:r.credential,challenge:'${nonce}'})});if(result.ok){location.replace('/');return}const error=await result.json();status.textContent=error.error || 'Falló la verificación de Google. Volvé a intentarlo.'}catch{status.textContent='Falló la conexión. Intentá otra vez.'}}});google.accounts.id.renderButton(document.getElementById('google'),{type:'standard',locale:'es',size:'large',width:Math.min(360,document.getElementById('google').clientWidth)})}</script>
<script src="https://accounts.google.com/gsi/client" async onload="iniciar()"></script></html>`,{headers:{'Content-Type':'text/html;charset=UTF-8','Cache-Control':'no-store','Set-Cookie':setCookie(nonceCookie+'_'+nonce,nonce,600),'Cross-Origin-Opener-Policy':'same-origin-allow-popups','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY'}});
}
function saveError(error){
      const kind=String(error.message||'').toLowerCase();
      const reason=/too large|too big|limit|quota/.test(kind)?'La base alcanzó un límite al guardar.':/busy|locked/.test(kind)?'La base estaba ocupada.':'El servicio de base de datos no pudo completar la escritura.';
      return json({error:reason+' Consultá Compras registradas antes de reintentar.'},503);
}
// Derived read model. The primary snapshot remains authoritative. A generation
// becomes visible only after every catalog part and price row has been written.
const priceDayFormat=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Costa_Rica',year:'numeric',month:'2-digit',day:'2-digit'});
async function prepareLegacyCatalog(primary,cache) {
  await cache.batch([
    cache.prepare('CREATE TABLE IF NOT EXISTS lookup_head(id INTEGER PRIMARY KEY, revision TEXT, generation TEXT, parts INTEGER)'),
    cache.prepare('CREATE TABLE IF NOT EXISTS lookup_catalog(generation TEXT, part INTEGER, payload TEXT, PRIMARY KEY(generation,part))'),
    cache.prepare('CREATE TABLE IF NOT EXISTS lookup_sold_price(generation TEXT,day TEXT,article TEXT,supplier TEXT,price REAL,PRIMARY KEY(generation,day,article,supplier,price))'),
    cache.prepare('CREATE TABLE IF NOT EXISTS lookup_price(generation TEXT, day TEXT, article TEXT, time REAL, price REAL, PRIMARY KEY(generation,day,article))')
  ]);
  const current=await primary.prepare('SELECT revision,parts FROM cedi_head WHERE id=1').first();
  if(!current)throw Error('Falta la base principal');
  const previous=await cache.prepare('SELECT revision,generation,parts FROM lookup_head WHERE id=1').first();
  const indexRevision='confirmed-history-v2:'+current.revision;
  if(previous?.revision===indexRevision)return previous;
  let offset=0;
  const stream=new ReadableStream({async pull(controller){
    if(offset>=current.parts){controller.close();return;}
    const {results}=await primary.prepare('SELECT part,payload FROM cedi_parts WHERE revision=? AND part>=? ORDER BY part LIMIT 8').bind(current.revision,offset).all();
    if(!results.length)throw Error('Cambió el catálogo');
    for(const row of results){
      if(row.part!==offset++)throw Error('Catálogo incompleto');
      controller.enqueue(Uint8Array.from(atob(row.payload),c=>c.charCodeAt(0)));
    }
  }});
  const snapshot=await new Response(stream.pipeThrough(new DecompressionStream('gzip'))).json();
  const generation=crypto.randomUUID();
  const sales=snapshot.sales||[];
  for(const field of ['sales','purchases','purchaseOrders','purchaseDraft','legacyPurchaseDraft','cashOutContacts','cashOutEntries','cxpState','xmlInboxState'])delete snapshot[field];
  const compressed=await new Response(new Blob([JSON.stringify(snapshot)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const writes=[];
  async function flush(){
    if(writes.length)await cache.batch(writes.splice(0));
  }
  async function clean(id){
    await cache.batch(['lookup_catalog','lookup_price','lookup_sold_price'].map(table=>cache.prepare('DELETE FROM '+table+' WHERE generation=? AND generation NOT IN (SELECT generation FROM lookup_head)').bind(id)));
  }
  try{
    let parts=0;
    for(let start=0;start<compressed.byteLength;start+=48000){
      const block=new Uint8Array(compressed,start,Math.min(48000,compressed.byteLength-start));
      writes.push(cache.prepare('INSERT INTO lookup_catalog VALUES(?,?,?)').bind(generation,parts++,btoa(String.fromCharCode(...block))));
      if(writes.length===8)await flush();
    }
    const latest=new Map(),sold=new Set();
    for(const sale of sales){
      const documentTime=Date.parse(sale.date);
      const time=Date.parse(sale.recordedAt||sale.date);
      if(!Number.isFinite(documentTime)||!Number.isFinite(time)||['annulled','cancelled','void'].includes(sale.status))continue;
      const day=/^\d{4}-\d{2}-\d{2}$/.test(sale.date)?sale.date:priceDayFormat.format(documentTime);
      // The previous POS stored the selected date in a Costa Rica timestamp
      // alongside recordedAt. Older clock-only receipts cannot establish that date.
      const confirmedDay=sale.invoiceDate!==undefined?sale.invoiceDate===day:
        Number.isFinite(Date.parse(sale.recordedAt))&&sale.date.endsWith('-06:00');
      for(const line of sale.lines||[]){
        const article=line.barcode||line.code;
        if(!article||!Number.isFinite(line.price)||line.price<0)continue;
        if(confirmedDay&&Number.isSafeInteger(line.price)&&line.price%5===0)sold.add(JSON.stringify([day,article,line.supplier||'',line.price]));
        const key=JSON.stringify([day,article]),old=latest.get(key);
        if(!old||old[2]<=time)latest.set(key,[day,article,time,line.price]);
      }
    }
    async function writePrices(table,items,encode){
      let rows=[],size=0;
      function enqueue(){
        writes.push(cache.prepare('INSERT INTO '+table+' SELECT ?,value->>0,value->>1,value->>2,value->>3 FROM json_each(?)').bind(generation,'['+rows.join(',')+']'));
        rows=[];size=0;
      }
      for(const item of items){
        const encoded=encode(item);
        rows.push(encoded);size+=encoded.length;
        if(size>=16000)enqueue();
        if(writes.length>=8)await flush();
      }
      if(rows.length)enqueue();
    }
    await writePrices('lookup_price',latest.values(),JSON.stringify);
    await writePrices('lookup_sold_price',sold,value=>value);
    await flush();
    const head=await primary.prepare('SELECT revision FROM cedi_head WHERE id=1').first();
    if(head?.revision!==current.revision)throw Error('Cambió el catálogo');
    const changed=await cache.prepare('INSERT INTO lookup_head VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,generation=excluded.generation,parts=excluded.parts WHERE lookup_head.generation IS ?').bind(indexRevision,generation,parts,previous?.generation??null).run();
    if(!changed.meta.changes){
      const winner=await cache.prepare('SELECT revision,generation,parts FROM lookup_head WHERE id=1').first();
      if(winner?.revision!==indexRevision)throw Error('Cambió el catálogo');
      await clean(generation);return winner;
    }
    if(previous)await clean(previous.generation);
    return {revision:indexRevision,generation,parts};
  }catch(error){await clean(generation);throw error;}
}

export default { async fetch(request, env) {
  const url=new URL(request.url);
  if(url.pathname==='/assets/pos-365-logo.png' && request.method==='GET')return env.ASSETS.fetch(request);
  if(url.pathname==='/favicon.ico')return new Response(null,{status:204});
  if(url.pathname==='/login')return login();
  if(url.pathname==='/auth/login' && request.method==='POST'){
    const {token,challenge}=await request.json();
    if(typeof challenge!=='string'||!/^[0-9a-f-]{36}$/.test(challenge))return json({error:'Recargá POS 365 para actualizar la pantalla de ingreso.'},403);
    const nonce=cookie(request,nonceCookie+'_'+challenge);
    if(!nonce)return json({error:'La sesión de ingreso venció o el navegador bloqueó su cookie. Abrí la página directamente en Firefox y volvé a entrar.'},403);
    if(request.headers.get('Origin')!==url.origin || request.headers.get('Content-Type')!=='application/json')return json({},403);
    const failure={};
    const claims=await verify(token,nonce,failure);
    if(!claims)return json({error:failure.message || 'POS 365 no pudo verificar la firma o el origen de la identificación de Google.'},403);
    const response=json({ok:true});
    response.headers.append('Set-Cookie',setCookie(sessionCookie,token,Math.floor(claims.exp-Date.now()/1000)));
    response.headers.append('Set-Cookie',setCookie(nonceCookie+'_'+challenge,'',0));
    return response;
  }
  if(url.pathname==='/auth/logout' && request.method==='POST' && request.headers.get('Origin')===url.origin){
    return new Response(null,{status:303,headers:{Location:'/login','Cache-Control':'no-store','Set-Cookie':setCookie(sessionCookie,'',0)}});
  }
  const claims=await verify(cookie(request,sessionCookie));
  if(!claims)return url.pathname.startsWith('/api/') ? json({error:'Ingresá a POS 365 con Google.'},401) : new Response(null,{status:302,headers:{Location:'/login','Cache-Control':'no-store'}});
  const email=claims.email.toLowerCase();
  if(!url.pathname.startsWith('/api/')){
    const asset=await env.ASSETS.fetch(request);
    const response=new Response(asset.body,asset);
    response.headers.set('Cache-Control','private, no-store');
    return response;
  }
  const legacy=url.pathname.startsWith('/api/legacy-purchases/');
  const db=legacy?env.LEGACY_PURCHASES_DB:env.DB;
  if(legacy){
    if(!db)return json({error:'Falta conectar la base independiente de Compras formato viejo.'},503);
    if(db===env.DB)return json({error:'La base de formato viejo debe ser independiente.'},503);
    url.pathname=url.pathname.replace('/api/legacy-purchases/','/api/');
    if(request.method==='GET'&&url.pathname==='/api/catalog'){
      try{return json(await prepareLegacyCatalog(env.DB,db));}
      catch{return json({error:'Volvé a cargar para actualizar el catálogo.'},503);}
    }
    if(request.method==='GET'&&url.pathname==='/api/catalog-parts'){
      const start=Number(url.searchParams.get('start'));
      if(!Number.isSafeInteger(start)||start<0)return json({},400);
      const {results}=await db.prepare('SELECT part,payload FROM lookup_catalog WHERE generation=? AND part>=? ORDER BY part LIMIT 8').bind(url.searchParams.get('generation'),start).all();
      return json(results);
    }
    if(request.method==='GET'&&url.pathname==='/api/price'){
      const keys=url.searchParams.getAll('key'),day=url.searchParams.get('day');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!keys.length||keys.length>3)return json({},400);
      if(url.searchParams.get('history')==='1'){
        const suppliers=url.searchParams.getAll('supplier');
        const {results}=await db.prepare("SELECT DISTINCT p.day,p.price FROM lookup_sold_price p WHERE generation=(SELECT generation FROM lookup_head WHERE id=1) AND day=? AND article IN (SELECT value FROM json_each(?)) AND (supplier='' OR supplier IN (SELECT value FROM json_each(?))) ORDER BY price").bind(day,JSON.stringify(keys),JSON.stringify(suppliers)).all();
        return json({day:results[0]?.day??day,prices:results.map(row=>row.price)});
      }
      const row=await db.prepare('SELECT (SELECT price FROM lookup_price WHERE generation=h.generation AND day=? AND article IN (SELECT value FROM json_each(?)) ORDER BY time DESC LIMIT 1) AS price FROM lookup_head h WHERE id=1').bind(day,JSON.stringify(keys)).first();
      return row?json(row):json({},503);
    }
    if(url.pathname==='/api/state'&&request.method==='GET'){
      await db.batch([
        db.prepare('CREATE TABLE IF NOT EXISTS cedi_head(id INTEGER PRIMARY KEY, revision TEXT NOT NULL, parts INTEGER NOT NULL, author TEXT NOT NULL)'),
        db.prepare('CREATE TABLE IF NOT EXISTS cedi_parts(revision TEXT NOT NULL, part INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(revision,part))'),
        db.prepare("INSERT OR IGNORE INTO cedi_head VALUES(1,'legacy-empty',0,'initial')")
      ]);
    }
  }
  if(url.pathname==='/api/state' && request.method==='GET'){
    const row=await db.prepare('SELECT revision,parts FROM cedi_head WHERE id=1').first();
    return row?json({...row,email}):json({error:'Falta importar la base.'},503);
  }
  if(url.pathname==='/api/parts' && request.method==='GET'){
    const start=Number(url.searchParams.get('start')),rev=url.searchParams.get('revision');
    if(!Number.isSafeInteger(start)||start<0||!rev)return json({},400);
    const {results}=await db.prepare('SELECT part,payload FROM cedi_parts WHERE revision=? AND part>=? ORDER BY part LIMIT 8').bind(rev,start).all();
    return json(results);
  }
  // Upload bounded batches first. Only the final transaction publishes a revision.
  if(url.pathname==='/api/save' && request.method==='POST'){
    if(request.headers.get('Origin')!==url.origin || request.headers.get('Content-Type')!=='application/json')return json({},403);
    const {base,id,count,changes,finish}=await request.json();
    if(typeof base!=='string'||typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id)||!Number.isInteger(count)||count<1||count>1600)return json({},400);
    try{
      const rev='save:'+id;
      const head=await db.prepare('SELECT revision,parts FROM cedi_head WHERE id=1').first();
      if(head?.revision===rev)return json({revision:rev});
      const conflict=()=>json({error:'La base cambió en otra sesión. Revisá la compra antes de repetirla.'},409);
      if(head?.revision!==base)return conflict();
      // Keep staging separate from live parts so retries cannot modify a published revision.
      await db.prepare('CREATE TABLE IF NOT EXISTS cedi_stage (id TEXT, part INTEGER, payload TEXT, created INTEGER, PRIMARY KEY(id,part))').run();
      const key=email+'|'+base+'|'+id;
      if(finish!==true){
        if(!Array.isArray(changes)||!changes.length||changes.length>4||changes.some(c=>!c||!Number.isInteger(c.part)||c.part<0||c.part>=count||typeof c.payload!=='string'||!c.payload.length||c.payload.length>64000||!/^[A-Za-z0-9+/]+=*$/.test(c.payload)))return json({},400);
        await db.prepare("INSERT OR REPLACE INTO cedi_stage SELECT ?,json_extract(value,'$.part'),json_extract(value,'$.payload'),unixepoch() FROM json_each(?)").bind(key,JSON.stringify(changes)).run();
        return json({staged:true});
      }
      if(!Number.isInteger(changes)||changes<0||changes>count)return json({},400);
      // Both copies and the head switch run under the same D1 transaction.
      const results=await db.batch([
        db.prepare('INSERT INTO cedi_parts SELECT ?,p.part,p.payload FROM cedi_parts p WHERE p.revision=? AND p.part<? AND NOT EXISTS(SELECT 1 FROM cedi_stage s WHERE s.id=? AND s.part=p.part) AND EXISTS(SELECT 1 FROM cedi_head WHERE id=1 AND revision=?)').bind(rev,base,count,key,base),
        db.prepare('INSERT INTO cedi_parts SELECT ?,part,payload FROM cedi_stage WHERE id=? AND part<? AND EXISTS(SELECT 1 FROM cedi_head WHERE id=1 AND revision=?)').bind(rev,key,count,base),
        db.prepare('UPDATE cedi_head SET revision=?,parts=?,author=? WHERE id=1 AND revision=? AND (SELECT COUNT(*) FROM cedi_parts WHERE revision=?)=? AND (SELECT COUNT(*) FROM cedi_stage WHERE id=?)=?').bind(rev,count,email,base,rev,count,key,changes),
        db.prepare('DELETE FROM cedi_parts WHERE revision IN (?,?) AND revision<>(SELECT revision FROM cedi_head WHERE id=1)').bind(base,rev),
        db.prepare('DELETE FROM cedi_stage WHERE id=? OR created<unixepoch()-86400').bind(key)
      ]);
      if(!results[2].meta.changes){
        const now=await db.prepare('SELECT revision FROM cedi_head WHERE id=1').first();
        if(now?.revision!==rev)return conflict();
      }
      return json({revision:rev});
    }catch(error){return saveError(error);}
  }
  if(url.pathname==='/api/state' && request.method==='PUT'){
    if(request.headers.get('Origin')!==url.origin||request.headers.get('Content-Type')!=='application/json')return json({},403);
    const body=await request.json();
    const {base}=body;
    // Accept complete snapshots from tabs opened before the upgrade.
    const legacy=Array.isArray(body.parts);
    const count=legacy?body.parts.length:body.count;
    const changes=legacy?body.parts.map((payload,part)=>({part,payload})):body.changes;
    if(typeof base!=='string'||!Number.isSafeInteger(count)||count<1||count>1600||!Array.isArray(changes)||changes.length>count)
      return json({error:'El tamaño o formato del guardado excede lo admitido.'},400);
    const seen=new Set();
    for(const change of changes){
      if(!change||!Number.isInteger(change.part)||change.part<0||change.part>=count||seen.has(change.part)||typeof change.payload!=='string'||!change.payload.length||change.payload.length>64000||!/^[A-Za-z0-9+/]+=*$/.test(change.payload))
        return json({error:'Se recibió un fragmento de datos inválido.'},400);
      seen.add(change.part);
    }
    const conflict=()=>json({error:'La base cambió en otra sesión. Recargá y revisá Compras registradas.'},409);
    const old=await db.prepare('SELECT revision,parts FROM cedi_head WHERE id=1').first();
    if(old?.revision!==base)return conflict();
    for(let part=old.parts;part<count;part++)if(!seen.has(part))return json({error:'Faltan datos en el guardado.'},400);
    const rev=crypto.randomUUID();
    try{
      const statements=[];
      // Copy unchanged blocks inside D1. Each bound JSON array stays below 1 MB.
      if(changes.length<count)statements.push(db.prepare('INSERT INTO cedi_parts SELECT ?,part,payload FROM cedi_parts WHERE revision=? AND part<? AND part NOT IN (SELECT value FROM json_each(?))').bind(rev,base,count,JSON.stringify([...seen])));
      for(let i=0;i<changes.length;i+=8){
        statements.push(db.prepare("INSERT INTO cedi_parts SELECT ?,json_extract(value,'$.part'),json_extract(value,'$.payload') FROM json_each(?)").bind(rev,JSON.stringify(changes.slice(i,i+8))));
      }
      statements.push(db.prepare('UPDATE cedi_head SET revision=?,parts=?,author=? WHERE id=1 AND revision=? AND (SELECT COUNT(*) FROM cedi_parts WHERE revision=?)=?').bind(rev,count,email,base,rev,count));
      const results=await db.batch(statements);
      if(!results.at(-1).meta.changes){
        await db.prepare('DELETE FROM cedi_parts WHERE revision=?').bind(rev).run();
        return conflict();
      }
    }catch(error){
      return saveError(error);
    }
    // Cleanup failure must not turn a confirmed commit into an apparent failure.
    await db.prepare('DELETE FROM cedi_parts WHERE revision=?').bind(base).run().catch(()=>{});
    return json({revision:rev});
  }
  return json({},404);
}};
