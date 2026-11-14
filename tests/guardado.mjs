import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import vm from 'node:vm';
const src=fs.readFileSync('cloudflare/_worker.js','utf8').replace('await verify(cookie(request,sessionCookie))', "({email:'qa@example.test'})");
const worker=(await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'))).default;
const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE cedi_parts(revision,part,payload,PRIMARY KEY(revision,part));CREATE TABLE cedi_head(id PRIMARY KEY,revision,parts,author);INSERT INTO cedi_head VALUES(1,'initial',268,'test')");
const insert=sql.prepare("INSERT INTO cedi_parts VALUES('initial',?,'AAAA')");for(let i=0;i<268;i++)insert.run(i);
let fail=false;
const db={prepare(query){return {bind(...args){this.args=args;return this},first(){return sql.prepare(query).get(...this.args||[])},async run(){return {meta:sql.prepare(query).run(...this.args||[])}}}},async batch(statements){sql.exec('BEGIN');try{if(fail)throw Error('database is locked');const results=[];for(const st of statements)results.push(await st.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
const put=body=>worker.fetch(new Request('https://cedi.test/api/state',{method:'PUT',headers:{Origin:'https://cedi.test','Content-Type':'application/json'},body:JSON.stringify(body)}),{DB:db});
const body={base:'initial',count:269,changes:[{part:0,payload:'BBBB'},{part:268,payload:'CCCC'}]};
let response=await put(body);assert.equal(response.status,200);const {revision}=await response.json();
assert.equal(sql.prepare('SELECT COUNT(*) n FROM cedi_parts').get().n,269);
assert.deepEqual(sql.prepare('SELECT payload FROM cedi_parts ORDER BY part').all().map(x=>x.payload),['BBBB',...Array(267).fill('AAAA'),'CCCC']);
assert.equal((await put(body)).status,409);fail=true;response=await put({...body,base:revision});assert.equal(response.status,503);assert.match((await response.json()).error,/ocupada/);assert.equal(sql.prepare('SELECT revision FROM cedi_head').get().revision,revision);
const inner=fs.readFileSync('work/cedi-current-inner.html','utf8');const fn=inner.slice(inner.indexOf('function persistPurchaseConfirmed'),inner.indexOf('function calculatePurchaseLine',inner.indexOf('function persistPurchaseConfirmed')));
let callback,timeout=0;const parent={};const ctx={window:{parent,addEventListener:(t,c)=>callback=c,removeEventListener(){}},persistTrialSnapshot:()=>42,sharedPurchaseStorage:true,setTimeout(){timeout++},clearTimeout(){}};
vm.runInNewContext(fn,ctx);let saved=ctx.persistPurchaseConfirmed();assert.equal(timeout,0);callback({source:parent,data:{type:'cedi-trial-state-saved',updatedAt:42,ok:true}});await saved;saved=ctx.persistPurchaseConfirmed();callback({source:parent,data:{type:'cedi-trial-state-saved',updatedAt:42,ok:false,reason:'La base estaba ocupada.'}});await assert.rejects(saved,/ocupada/);
console.log('PASS: partial write, preserved blocks, concurrency conflict, failed write rollback, shared confirmation without 12s timeout, error display');

const operation={base:revision,id:crypto.randomUUID(),count:270};
const stage=(data)=>worker.fetch(new Request('https://cedi.test/api/save',{method:'POST',headers:{Origin:'https://cedi.test','Content-Type':'application/json'},body:JSON.stringify({...operation,...data})}),{DB:db});
const current=()=>sql.prepare('SELECT revision FROM cedi_head').get().revision;
const edits={changes:[{part:269,payload:'DDDD'}]};
fail=false;
assert.equal((await stage(edits)).status,200);
assert.equal((await stage(edits)).status,200);
assert.equal(current(),revision);
fail=true;
assert.equal((await stage({finish:true,changes:1})).status,503);
assert.equal(current(),revision);
fail=false;
const finished=await stage({finish:true,changes:1});
assert.equal(finished.status,200);
assert.equal(current(),(await finished.json()).revision);
assert.equal((await stage({finish:true,changes:1})).status,200);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM cedi_parts').get().n,270);
assert.equal((await stage({...edits,id:crypto.randomUUID()})).status,409);
assert.equal((await stage({id:crypto.randomUUID(),base:current(),count:271,changes:0,finish:true})).status,409);

const draftListeners={},pendingTimers=new Map();let saves=0;
const draftContext={purchaseModification:null,currentPurchaseXml:{},purchasesMain:{addEventListener:(name,fn)=>draftListeners[name]=fn},clearTimeout:id=>pendingTimers.delete(id),setTimeout:fn=>{pendingTimers.set(1,fn);return 1},persistTrialSnapshot:()=>saves++};
vm.runInNewContext(inner.slice(inner.indexOf('let purchaseBackupTimer;'),inner.indexOf("window.addEventListener('openai:set_globals'",inner.indexOf('let purchaseBackupTimer;'))),draftContext);
draftListeners.input();draftListeners.change();assert.equal(pendingTimers.size,0);
draftContext.currentPurchaseXml=null;draftListeners.input();pendingTimers.get(1)();assert.equal(saves,1);
draftListeners.change();draftContext.currentPurchaseXml={};pendingTimers.get(1)();assert.equal(saves,1);
console.log('PASS: XML edit isolation and atomic staged saves, including retries, conflicts and rollback');

const bridge=fs.readFileSync('cloudflare/bridge.js','utf8');
let inFlight=0,maxInFlight=0,headReads=0,dropFirst=false;
const loadContext={document:{getElementById:()=>({})},fetch:async url=>{
 if(url==='/api/state'){headReads++;return {ok:true,json:async()=>({revision:'snapshot-'+headReads,parts:50})};}
 const parsed=new URL(url,'https://cedi.test'),offset=Number(parsed.searchParams.get('start'));
 inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
 await new Promise(resolve=>setTimeout(resolve,offset===0?8:1));
 inFlight--;
 return {ok:true,json:async()=>dropFirst&&headReads===1&&offset===8?[]:Array.from({length:Math.min(8,50-offset)},(_,i)=>({part:offset+i,payload:String(offset+i)+','}))};
}};
vm.createContext(loadContext);
vm.runInContext(bridge.slice(0,bridge.indexOf('function stop(')),loadContext);
let loaded=await vm.runInContext('loadShared()',loadContext);
assert.equal(loaded.cediTrialGzip,Array.from({length:50},(_,i)=>i+',').join(''));
assert.equal(maxInFlight,3);assert.equal(inFlight,0);
dropFirst=true;headReads=0;
loaded=await vm.runInContext('loadShared()',loadContext);
assert.equal(headReads,2);
assert.equal(loaded.cediTrialGzip,Array.from({length:50},(_,i)=>i+',').join(''));
console.log('PASS: three concurrent reads, ordered reconstruction, complete retry after snapshot changes');

draftContext.currentPurchaseXml=null;draftContext.purchaseModification={record:{id:'saved-purchase'}};draftListeners.input();assert.equal(pendingTimers.size,0);assert.equal(saves,1);console.log('PASS: edits to registered purchases remain pending until Process');
