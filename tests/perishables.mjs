import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../work/cedi-current-inner.html',import.meta.url),'utf8');
const product={barcode:'0001234567890',code:'P01',name:'Tomate',cabys:'0123100000100',price:999999};
const ctx=vm.createContext({Intl,Date,Map,Set,Number,String,Array,Error,
 cashOutDateISO:v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null,
 findArticleByKey:k=>k===product.barcode?product:null,
 articleRecordKey:p=>p.barcode,getProductCategory3:()=> 'Hortalizas',
 cabysCatalog:new Map([[product.cabys,['Tomate','kg',.01]]]),
 trialCompletedSales:[{date:'2026-10-02T18:00:00Z',lines:[{barcode:product.barcode,quantity:.25,price:12,totalCents:12345}]},{date:'2026-11-01T05:59:00Z',lines:[{barcode:product.barcode,totalCents:100}]},{date:'2026-11-01T06:00:00Z',lines:[{barcode:product.barcode,totalCents:99999}]}],
 trialPurchases:[{receivedDate:'2026-10-20',invoiceDate:'2026-09-20',currency:'Colón',lines:[{barcode:product.barcode,totalCents:2345}]},{status:'annulled',receivedDate:'2026-10-20',lines:[{barcode:product.barcode,totalCents:99999}]}]
});
vm.runInContext(source.slice(source.indexOf('function perishableDay('),source.indexOf('function installVegetableProducts(')),ctx);
assert.equal(ctx.perishableReport([],'2026-10-01','2026-10-31','animal').title,'Ventas de origen animal');
let report=ctx.perishableReport([product.barcode,product.barcode],'2026-10-01','2026-10-31');
assert.equal(report.salesCents,12445);assert.equal(report.purchaseCents,2345);assert.equal(report.rows.length,1);
product.price=1;assert.equal(ctx.perishableReport([product.barcode],'2026-10-01','2026-10-31').salesCents,12445);
assert.equal(ctx.perishableReport([product.barcode],'2026-09-01','2026-09-30').purchaseCents,0);
const sheets=ctx.perishableExportSheets({...report,openingCents:1000,closingCents:2000,resultCents:11100});
assert.equal(sheets[0].data[1][0],product.barcode);assert.equal(sheets[0].data[1][4],124.45);assert.equal(sheets[0].data[1][5],23.45);assert.equal(sheets[1].data.at(-1)[1],111);
assert.throws(()=>ctx.perishableReport([],'2026-11-01','2026-10-01'),/fechas/);
ctx.trialPurchases.push({currency:'Dólar',receivedDate:'2026-10-03',lines:[{barcode:product.barcode,totalCents:100}]});
assert.throws(()=>ctx.perishableReport([product.barcode],'2026-10-01','2026-10-31'),/otra moneda/);ctx.trialPurchases.pop();
ctx.trialPurchases.push({lines:[{barcode:product.barcode,totalCents:100}]});assert.equal(ctx.perishableReport([product.barcode],'2026-10-01','2026-10-31').missingReceived,1);
ctx.trialCompletedSales.push({date:'2026-10-10',lines:[{barcode:product.barcode,price:123,quantity:1}]});assert.throws(()=>ctx.perishableReport([product.barcode],'2026-10-01','2026-10-31'),/total de línea/);
console.log('PASS: perishable historical totals, Costa Rica boundaries, received dates, annulments, stable identifiers, numeric export cells and missing-data guards');
