import {probarConexion,revisarBuzon} from './src/index.js';
import {savedLogin} from './vault.js';

const minutesAllowed = [5,10,15,20,30,60,120,180,720,1440];
async function schema(db) {
  if(await db.prepare("SELECT 1 FROM sqlite_master WHERE name='gmail_sync_counts' AND type='table'").first())return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS gmail_plan (id INTEGER PRIMARY KEY, minutes INTEGER NOT NULL)'),
    db.prepare("CREATE TABLE IF NOT EXISTS gmail_progress (id TEXT PRIMARY KEY REFERENCES pos_gmail_accounts(id) ON DELETE CASCADE, validity TEXT, uid INTEGER NOT NULL, since_day TEXT NOT NULL, due INTEGER NOT NULL, lease TEXT, expires INTEGER DEFAULT 0, notice TEXT DEFAULT '')"),
    db.prepare("CREATE TABLE IF NOT EXISTS gmail_arrivals (digest TEXT PRIMARY KEY, name TEXT NOT NULL, xml TEXT NOT NULL, response INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS gmail_completed (id TEXT PRIMARY KEY REFERENCES pos_gmail_accounts(id) ON DELETE CASCADE, completed_at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS gmail_sync_items (id TEXT NOT NULL REFERENCES pos_gmail_accounts(id) ON DELETE CASCADE, digest TEXT NOT NULL, PRIMARY KEY(id,digest))"),
    db.prepare("CREATE TABLE IF NOT EXISTS gmail_sync_counts (id TEXT PRIMARY KEY REFERENCES pos_gmail_accounts(id) ON DELETE CASCADE, completed_at INTEGER NOT NULL, xml_count INTEGER NOT NULL)")
  ]);
}
async function config(env,id) {
  const {email,password}=await savedLogin(id,env);
  return {usuario:email,clave:password,servidorImap:'imap.gmail.com',puerto:993,usarSsl:true,descargarPdf:false};
}
async function status(db) {
  const plan=await db.prepare('SELECT minutes FROM gmail_plan WHERE id=1').first();
  const problem=await db.prepare("SELECT email,notice FROM gmail_progress JOIN pos_gmail_accounts USING(id) WHERE notice<>'' LIMIT 1").first();
  const accounts=await db.prepare('SELECT a.email,c.completed_at,n.xml_count FROM pos_gmail_accounts a LEFT JOIN gmail_completed c ON c.id=a.id LEFT JOIN gmail_sync_counts n ON n.id=a.id AND n.completed_at=c.completed_at ORDER BY a.rowid').all();
  return {completed:accounts.results,minutes:plan?.minutes||0,notice:problem?problem.email+' · '+problem.notice:''};
}
export async function autoAction(body,env) {
  const db=env.DB;
  await schema(db);
  if(body.action==='auto-list')return status(db);
  if(body.action==='auto-checkpoint'){
    if(!Number.isSafeInteger(body.uid)||body.uid<=0||!/^\d+$/.test(body.validity)||!/^\d{4}-\d{2}-\d{2}$/.test(body.day))throw Error('Punto de carga inválido.');
    await db.prepare(`INSERT INTO gmail_progress(id,validity,uid,since_day,due)
      SELECT id,?,?,?,0 FROM pos_gmail_accounts WHERE id=? AND NOT EXISTS(SELECT 1 FROM gmail_plan)
      ON CONFLICT(id) DO UPDATE SET validity=excluded.validity,uid=excluded.uid,since_day=excluded.since_day
      WHERE excluded.uid>gmail_progress.uid AND excluded.validity=gmail_progress.validity`)
      .bind(body.validity,body.uid,body.day,body.id).run();
    return {ok:true};
  }
  if(body.action==='auto-set'){
    const minutes=body.minutes;
    if(minutes!==0&&!minutesAllowed.includes(minutes))throw Error('Seleccione un intervalo válido.');
    const rows=(await db.prepare('SELECT id FROM pos_gmail_accounts').all()).results;
    if(minutes&&!rows.length)throw Error('Guarde primero una cuenta de Gmail.');
    const writes=[];
    if(minutes)for(const {id} of rows){
      if(await db.prepare('SELECT id FROM gmail_progress WHERE id=?').bind(id).first())continue;
      const head=await probarConexion(await config(env,id));
      if(!head.uidValidez||!head.uidNext)throw Error('Gmail no confirmó el punto inicial.');
      const prior=typeof body.since==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(body.since)&&body.since<=new Date().toISOString().slice(0,10)?body.since:null;
      writes.push(db.prepare('INSERT OR IGNORE INTO gmail_progress(id,validity,uid,since_day,due) VALUES(?,?,?,?,?)').bind(id,head.uidValidez,prior?0:head.uidNext-1,prior||new Date().toISOString().slice(0,10),Date.now()));
    }
    writes.push(db.prepare('INSERT INTO gmail_plan VALUES(1,?) ON CONFLICT(id) DO UPDATE SET minutes=excluded.minutes').bind(minutes));
    writes.push(db.prepare('UPDATE gmail_progress SET due=?,lease=NULL,expires=0').bind(Date.now()));
    await db.batch(writes);
    return status(db);
  }
  if(body.action==='auto-files'){
    const row=await db.prepare('SELECT rowid AS seq,digest,name,xml FROM gmail_arrivals WHERE rowid>? AND response=? ORDER BY rowid LIMIT 1').bind(Number(body.after)||0,body.response?1:0).first();
    return {row};
  }
  if(body.action==='auto-ack'){
    await db.prepare('DELETE FROM gmail_arrivals WHERE digest=?').bind(String(body.digest)).run();
    return {ok:true};
  }
  throw Error('Acción desconocida.');
}
export async function autoTick(request,env){
  if(request.method!=='POST'||!env.POS365_SYNC_TRIGGER||request.headers.get('Authorization')!=='Bearer '+env.POS365_SYNC_TRIGGER)return new Response(null,{status:403});
  const db=env.DB;
  // A fresh installation stays idle until someone opens the settings.
  if(!await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='gmail_plan'").first())return new Response(null,{status:204});
  const plan=await db.prepare('SELECT minutes FROM gmail_plan WHERE id=1 AND minutes>0').first();
  if(!plan)return new Response(null,{status:204});
  await schema(db);
  const now=Date.now();
  const jobs=(await db.prepare('SELECT p.* FROM gmail_progress p JOIN pos_gmail_accounts a ON a.id=p.id WHERE due<=? AND expires<=? ORDER BY due').bind(now,now).all()).results;
  for(const job of jobs){
    const lease=crypto.randomUUID();
    const claim=await db.prepare('UPDATE gmail_progress SET lease=?,expires=? WHERE id=? AND expires<=? AND due<=? AND (SELECT minutes FROM gmail_plan WHERE id=1)=?').bind(lease,now+240000,job.id,now,now,plan.minutes).run();
    if(!claim.meta.changes)continue;
    let delay=plan.minutes*60000,notice='',complete=false;
    try{
      const result=await revisarBuzon(await config(env,job.id),{uidValidez:job.validity,ultimoUid:job.uid,revisarDesde:job.since_day},async content=>{
        for(const [response,items] of [[0,content.comprobantes],[1,content.respuestas]]){
          for(const item of items){
            const bytes=new TextEncoder().encode(item.xml);
            const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
            const arrival = db.prepare('INSERT OR IGNORE INTO gmail_arrivals(digest,name,xml,response) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM gmail_progress WHERE id=? AND lease=?)').bind(digest,item.archivo,item.xml,response,job.id,lease);
            // D1 ejecuta el lote en una transacción. Solo cuenta inserciones efectivas.
            await db.batch([arrival, db.prepare('INSERT OR IGNORE INTO gmail_sync_items(id,digest) SELECT ?,? WHERE changes()=1').bind(job.id,digest)]);
          }
        }
      },{maxCorreos:5,reintentarErrores:true,guardarEstado:async state=>{
        const saved=await db.prepare('UPDATE gmail_progress SET validity=?,uid=? WHERE id=? AND lease=?').bind(state.uidValidez,state.ultimoUid,job.id,lease).run();
        if(!saved.meta.changes)throw Error('La programación cambió.');
      }});
      if(result.error)throw Error(result.error);
      if(result.pendientes)delay=60000;
      complete=!result.pendientes&&!result.errores.length;
    }catch(error){delay=60000;notice=error.message;}
    const finished=Date.now(),writes=[];
    if(complete){
      writes.push(db.prepare(`INSERT INTO gmail_completed(id,completed_at)
        SELECT id,? FROM gmail_progress WHERE id=? AND lease=?
        ON CONFLICT(id) DO UPDATE SET completed_at=excluded.completed_at`).bind(finished,job.id,lease));
      writes.push(db.prepare(`INSERT INTO gmail_sync_counts(id,completed_at,xml_count)
        SELECT p.id,?,(SELECT COUNT(*) FROM gmail_sync_items i WHERE i.id=p.id)
        FROM gmail_progress p WHERE p.id=? AND p.lease=?
        ON CONFLICT(id) DO UPDATE SET completed_at=excluded.completed_at,xml_count=excluded.xml_count`).bind(finished,job.id,lease));
      writes.push(db.prepare('DELETE FROM gmail_sync_items WHERE id=? AND EXISTS(SELECT 1 FROM gmail_progress WHERE id=? AND lease=?)').bind(job.id,job.id,lease));
    }
    writes.push(db.prepare('UPDATE gmail_progress SET due=?,lease=NULL,expires=0,notice=? WHERE id=? AND lease=?').bind(finished+delay,notice,job.id,lease));
    await db.batch(writes);
  }
  return new Response(null,{status:204});
}
