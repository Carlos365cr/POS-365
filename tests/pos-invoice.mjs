import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

const source=fs.readFileSync('work/cedi-current-inner.html','utf8');
const slice=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const ui={value:'',textContent:''};
const method={open:true,querySelectorAll:()=>[],querySelector:()=>ui,close(){this.open=false;}};
let settle,fail;
const ctx=vm.createContext({
 trialCompletedSales:[{id:'older-sale'}],paymentMethodDialog:method,tenderCents:100,lines:[{}],paymentTotalCents:100,
 getPosContactSnapshot:()=>null,distributePosSaleDiscount:()=>({amounts:[]}),saleRows:[],saleDiscountCents:0,saleExactTotalCents:100,
 saleDate:{value:'2026-11-20',checkValidity:()=>true},crypto:{randomUUID},posMain:{querySelector:()=>ui},
 persistPurchaseConfirmed:()=>new Promise((resolve,reject)=>{settle=resolve;fail=reject;}),
 entry:{elements:{codigo:{},cantidad:{}}},selectedLine:0,resetPosContact(){},paymentPanel:{querySelectorAll:()=>[]},
 render(){},showPosPanel(){},format:String,paymentDoneDialog:{querySelector:()=>({focus(){}}),showModal(){}}
});
vm.runInContext(slice('function nextPosInvoiceNumber','function calculatePosPayment')+
 slice('function posDocumentTimestamp','function initializePos')+
 slice('let savingPosInvoice=false','paidInput.addEventListener'),ctx);
const pay=()=>vm.runInContext("completeTrialPayment('1')",ctx);
const first=pay();await pay();
assert.equal(ctx.trialCompletedSales.length,2);
assert.equal(ctx.trialCompletedSales[1].invoiceNumber,'POS-0000000001');
settle();await first;
assert.equal(ui.value,'POS-0000000002');
ctx.saleDate.value='2026-11-10';ctx.lines.push({});ctx.tenderCents=100;method.open=true;
const failed=pay();fail(Error('conflict'));await failed;
assert.equal(ctx.trialCompletedSales.length,2);assert.equal(ctx.lines.length,1);
const second=pay();settle();await second;
assert.equal(ctx.trialCompletedSales[2].invoiceNumber,'POS-0000000002');
assert.match(ctx.trialCompletedSales[2].date,/^2026-11-10T/);
assert.equal(ctx.nextPosInvoiceNumber(JSON.parse(JSON.stringify(ctx.trialCompletedSales))),'POS-0000000003');
console.log('PASS: consecutive invoices, changed date, double click, unconfirmed save and reload');
