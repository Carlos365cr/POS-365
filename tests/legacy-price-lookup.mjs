import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {DatabaseSync} from 'node:sqlite';

const source=fs.readFileSync('cloudflare/_worker.js','utf8').replace('await verify(cookie(request,sessionCookie))',"({email:'qa@example.test'})");
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
function database(){
  const sql=new DatabaseSync(':memory:');
  return {sql,prepare(query){
    const statement=sql.prepare(query);
    return {args:[],bind(...args){this.args=args;return this;},first(){return statement.get(...this.args);},
      run(){return {meta:statement.run(...this.args)};},all(){return {results:statement.all(...this.args)};}};
  },async batch(statements){return statements.map(statement=>statement.run());}};
}
const env={DB:database(),LEGACY_PURCHASES_DB:database()};
env.DB.sql.exec('CREATE TABLE cedi_head(id PRIMARY KEY, revision, parts); CREATE TABLE cedi_parts(revision,part,payload);');
const sales=Array.from({length:12000},(_,i)=>({date:'2026-11-10T15:00:00Z',lines:[{code:'item'+i,price:i}]}));
sales.push(...[
  ['2026-11-11T05:59:59Z',999],['2026-11-10T12:00:00Z',500],
  ['2026-11-11T06:00:00Z',850],['2026-11-11T05:59:59.999Z',1200,'cancelled']
].map(([date,price,status])=>({date,status,lines:[{barcode:'abc',price}]})));
function save(revision){
  const parts=gzipSync(JSON.stringify({version:1,products:[{barcode:'abc'}],sales})).toString('base64').match(/.{1,64000}/g);
  env.DB.sql.prepare('INSERT OR REPLACE INTO cedi_head VALUES(1,?,?)').run(revision,parts.length);
  parts.forEach((part,i)=>env.DB.sql.prepare('INSERT INTO cedi_parts VALUES(?,?,?)').run(revision,i,part));
}
async function get(path){
  const res=await worker.fetch(new Request('https://cedi.test/api/legacy-purchases/'+path),env);
  assert.equal(res.status,200);return res.json();
}
save('first');
const head=await get('catalog');
const parts=await get('catalog-parts?generation='+head.generation+'&start=0');
const catalog=JSON.parse(gunzipSync(Buffer.from(parts.map(p=>p.payload).join(''),'base64')));
assert.deepEqual(catalog,{version:1,products:[{barcode:'abc'}]});
assert.equal((await get('catalog')).generation,head.generation);
assert.deepEqual(await get('price?day=2026-11-10&key=abc'),{price:999});
assert.deepEqual(await get('price?day=2026-11-11&key=abc'),{price:850});
assert.deepEqual(await get('price?day=2026-11-12&key=abc'),{price:null});
assert.deepEqual(await get('price?day=2026-11-10&key=item0'),{price:0});
sales.at(-4).status='void';
save('second');
assert.notEqual((await get('catalog')).generation,head.generation);
assert.deepEqual(await get('price?day=2026-11-10&key=abc'),{price:500});
assert.equal(env.LEGACY_PURCHASES_DB.sql.prepare('SELECT count(distinct generation) AS n FROM lookup_price').get().n,1);
sales.push({date:'2026-11-10T18:00:00Z',lines:[1471,1474.57,1470,1475,1470].map(price=>({barcode:'abc',price,supplier:'Proveedor A'})).concat([{barcode:'abc',price:1550,supplier:'Proveedor B'}])});
save('third');await get('catalog');
assert.deepEqual(await get('price?history=1&day=2026-11-10&key=abc&supplier=Proveedor%20A'),{day:'2026-11-10',prices:[500,1470,1475]});
assert.deepEqual(await get('price?history=1&day=2026-11-11&key=abc&supplier=Proveedor%20A'),{day:'2026-11-11',prices:[850]});
assert.deepEqual(await get('price?history=1&day=2026-11-12&key=abc'),{day:'2026-11-12',prices:[]});
console.log('PASS: indexed lookup, compact catalog, cache reuse and replacement, 12,004 sales');
const posSource=fs.readFileSync('work/cedi-current-inner.html','utf8');
const timestamp=(await import('data:text/javascript;base64,'+Buffer.from('export '+posSource.slice(posSource.indexOf('function posDocumentTimestamp'),posSource.indexOf('function initializePos'))).toString('base64'))).posDocumentTimestamp;
for(const [recordedAt,price] of [['2026-11-15T05:58:00.001Z',1470],['2026-11-16T06:01:00.002Z',1475]]){
  const date=timestamp('2026-11-20',new Date(recordedAt));
  sales.push({date,recordedAt,lines:[{code:'002',price}]});
}
save('future');await get('catalog');
assert.deepEqual(await get('price?day=2026-11-20&key=002'),{price:1475});
assert.deepEqual(await get('price?history=1&day=2026-11-20&key=002'),{day:'2026-11-20',prices:[1470,1475]});
assert.deepEqual(await get('price?day=2026-11-14&key=002'),{price:null});
