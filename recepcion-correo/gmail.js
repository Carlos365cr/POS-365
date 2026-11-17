import {autoAction,autoTick} from './automatico.js';
export {autoTick};
import {probarConexion,buscarPorFechas} from './src/index.js';
import {manageAccounts,savedLogin} from './vault.js';
export async function gmailRequest(request,env){
 const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST'||request.headers.get('Origin')!==new URL(request.url).origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'Solicitud no permitida.'},403);
 try{
  const body=await request.json(),{action,from,to,cursor=0}=body;
  if(typeof action==='string'&&action.startsWith('auto-'))return reply(await autoAction(body,env));
  if(['list','save','remove'].includes(action)){
   if(action==='save'&&body.accounts?.length&&(!env.POS365_GMAIL_KEY||env.POS365_GMAIL_KEY.length<32))return reply({error:'Configure el secreto POS365_GMAIL_KEY en Cloudflare para guardar la cuenta.'},503);
   return reply(await manageAccounts(body,env));
  }
  const {email,password}=body.id?await savedLogin(body.id,env):body;
  if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||!password.trim()||password.length>128)return reply({error:'Revise el correo y la contraseña de aplicación.'},400);
  const config={usuario:email,clave:password.replace(/\s/g,''),servidorImap:'imap.gmail.com',puerto:993,usarSsl:true,carpeta:'INBOX',descargarPdf:false};
  if(action==='test')return reply(await probarConexion(config));
  if(action!=='sync'||!Number.isSafeInteger(cursor)||cursor<0||![from,to].every(x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x))||from>to)return reply({error:'Revise las fechas de recepción.'},400);
  const files=[];
  const result=await buscarPorFechas(config,from,to,async content=>{
   for(const entry of [...content.comprobantes,...content.respuestas]){
    files.push({name:entry.archivo,xml:entry.xml});
   }
  },{desdeUid:cursor,maxCorreos:1});
  if(result.error)return reply({error:result.error},502);
  return reply({files,validity:result.validity,processed:result.procesados, cursor:result.ultimoUid,done:result.terminado,errors:result.errores.length});
 }catch(error){return reply({error:error.message||'No se pudo consultar Gmail.'},502);}
}
