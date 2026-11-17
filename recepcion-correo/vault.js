import {probarConexion} from './src/index.js';
import {cifrar,descifrar} from './src/cifrado.js';
const validEmail=email=>typeof email==='string'&&email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
async function init(db){
 await db.prepare('CREATE TABLE IF NOT EXISTS pos_gmail_accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE COLLATE NOCASE, credential TEXT NOT NULL)').run();
}
export async function manageAccounts(body,env){
 const db=env.DB;
 await init(db);
 if(body.action==='remove'){
  if(typeof body.id!=='string')throw Error('Seleccione una cuenta.');
  await db.prepare('DELETE FROM pos_gmail_accounts WHERE id=?').bind(body.id).run();
 }else if(body.action==='save'){
  if(!Array.isArray(body.accounts)||body.accounts.length>3)throw Error('Se permiten hasta tres cuentas.');
  const writes=[];
  const hasPlan=await db.prepare("SELECT 1 FROM sqlite_master WHERE name='gmail_plan'").first();
  const plan=hasPlan&&await db.prepare('SELECT minutes FROM gmail_plan WHERE id=1').first();
  for(const account of body.accounts){
   if(!validEmail(account.email)||typeof account.password!=='string'||!account.password.trim()||account.password.length>128)throw Error('Revise el correo y la contraseña de aplicación.');
   const encrypted=await cifrar(account.password.replace(/\s/g,''),env.POS365_GMAIL_KEY);
   const id=crypto.randomUUID();
   writes.push(db.prepare('INSERT INTO pos_gmail_accounts(id,email,credential) VALUES (?,?,?)').bind(id,account.email.trim().toLowerCase(),encrypted));
   if(plan?.minutes){
     const head=await probarConexion({usuario:account.email.trim(),clave:account.password.replace(/\s/g,''),servidorImap:'imap.gmail.com',puerto:993});
     if(!head.uidNext||!head.uidValidez)throw Error('Gmail no confirmó el punto inicial.');
     writes.push(db.prepare('INSERT INTO gmail_progress(id,validity,uid,since_day,due) VALUES(?,?,?,?,?)').bind(id,head.uidValidez,head.uidNext-1,new Date().toISOString().slice(0,10),Date.now()));
   }
  }
  if(writes.length){
   await db.prepare("CREATE TRIGGER IF NOT EXISTS pos_gmail_limit BEFORE INSERT ON pos_gmail_accounts WHEN (SELECT count(*) FROM pos_gmail_accounts)>=3 BEGIN SELECT RAISE(ABORT,'limite'); END").run();
   try{await db.batch(writes);}catch{throw Error('No se guardaron las cuentas. Revise si ya existen o si se alcanzó el límite de tres.');}
  }
 }
 const list=await db.prepare('SELECT id,email FROM pos_gmail_accounts ORDER BY rowid').all();
 return {accounts:list.results};
}
export async function savedLogin(id,env){
 const account=await env.DB.prepare('SELECT email,credential FROM pos_gmail_accounts WHERE id=?').bind(id).first();
 if(!account)throw Error('La conexión fue quitada. Vuelva a abrir Cargas XML.');
 const password=await descifrar(account.credential,env.POS365_GMAIL_KEY);
 if(!password)throw Error('Revise la clave de cifrado del servidor antes de volver a consultar Gmail.');
 return {email:account.email,password};
}
