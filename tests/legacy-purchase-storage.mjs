import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const source=fs.readFileSync('cloudflare/_worker.js','utf8').replace('await verify(cookie(request,sessionCookie))',"({email:'qa@example.test'})");
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
function binding(){
  const sql=new DatabaseSync(':memory:');
  return {prepare(query){return {bind(...args){this.args=args;return this},first(){return sql.prepare(query).get(...this.args||[])},run(){return {meta:sql.prepare(query).run(...this.args||[])}}}},async batch(statements){return statements.map(s=>s.run())}};
}
const legacy=binding();
const primary=new Proxy({}, {get(){throw Error('Unexpected access to operational database')}});
const env={DB:primary,LEGACY_PURCHASES_DB:legacy};
const request=(path,body)=>new Request('https://cedi.test/api/legacy-purchases/'+path,body?{method:'POST',headers:{Origin:'https://cedi.test','Content-Type':'application/json'},body:JSON.stringify(body)}:{});
const head=await (await worker.fetch(request('state'),env)).json();
assert.equal(head.parts,0);
const save={base:head.revision,id:crypto.randomUUID(),count:1};
for(const step of [{changes:[{part:0,payload:'AAAA'}]},{finish:true,changes:1}])assert.equal((await worker.fetch(request('save',{...save,...step}),env)).status,200);
assert.equal((await (await worker.fetch(request('state'),env)).json()).parts,1);
assert.equal((await worker.fetch(request('state'),{DB:primary})).status,503);
console.log('PASS: legacy save and reload access only separate database, missing binding fails closed');
