import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ui=fs.readFileSync('work/cedi-legacy-purchases.html','utf8');
const bridge=fs.readFileSync('cloudflare/bridge.js','utf8');
const catalog={products:[]};
vm.runInNewContext(bridge.slice(bridge.indexOf('function addLegacyExamples'),bridge.indexOf('async function loadShared'))+';addLegacyExamples(catalog,{})',{catalog});
const dialogs=[];
function element(){
 const children=new Map();
 return {style:{},rows:[],cells:[],elements:{query:{},day:{}},setAttribute(){},
  querySelector(key){if(!children.has(key))children.set(key,element());return children.get(key);},
  addEventListener(key,fn){this['on'+key]=fn;},append(el){this.child=el;},
  insertRow(){const row=element();this.rows.push(row);return row;},
  insertCell(){const cell=element();this.cells.push(cell);return cell;},
  replaceChildren(){this.rows=[];},showModal(){this.open=true;},close(){this.open=false;this.onclose?.();},
  focus(){},dispatchEvent(){}};
}
const main=element(),row=element(),field=row.querySelector('[aria-label="Precio 1"]');
row.dataset={};field.isConnected=true;
row.querySelector('[aria-label="Código"]').value='FV-01';
main.querySelector('[name=compraRecibido]').value='2026-11-14';
const ctx={purchasesMain:main,selectedPurchaseRow:row,document:{createElement(tag){const el=element();if(tag==='dialog')dialogs.push(el);return el;}},
 allArticleRecords:()=>catalog.products,findArticleByKey:()=>null,normalizeCabysText:s=>s.trim().toLowerCase(),
 captureContactsState:()=>catalog.contactsState,articleCodeValues:p=>p.codes,
 purchaseSupplierValue:p=>p.details.general.find(f=>f[0]==='proveedor')[1],Event};
vm.runInNewContext(ui.slice(ui.indexOf('function legacyExamplePrices'),ui.indexOf('function applyLegacySalePrice'))+';installLegacyPriceHistory()',ctx);
main.querySelector('[data-purchase-old-prices]').onclick();
const [dialog,picker]=dialogs,form=dialog.querySelector('form'),body=dialog.querySelector('tbody');
assert.equal(dialog.open,true);assert.ok(!picker.open);assert.equal(body.rows.length,2);
function buscar(term,day){form.elements.query.value=term;form.elements.day.value=day;form.onsubmit({preventDefault(){}});}
buscar('','2026-11-14');assert.equal(body.rows.length,20);
buscar('Ejemplo','2026-11-15');assert.equal(body.rows.length,20);
buscar('FV-01','2026-11-25');assert.equal(body.rows.length,0);assert.match(dialog.querySelector('[role=status]').textContent,/14 al 24/);
buscar('FV-01','2026-11-15');body.rows[0].cells[4].child.onclick();
assert.equal(field.value,'1470');assert.equal(dialog.open,false);assert.ok(!picker.open);
console.log('PASS: Buscar with ten packaged examples, unique code without supplier, date changes and selection.');
