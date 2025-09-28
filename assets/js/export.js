import { getSales, getProducts } from './models.js';
import { saleTotal } from './models.js';
import { downloadBlob } from './utils.js';

export function exportSalesCsv(){
  const header = ['id','date','product','quantity','unitPrice','discount','total','notes'];
  const prodLookup = Object.fromEntries(getProducts().map(p=>[p.id,p.name]));
  const rows = getSales().map(s=>[
    s.id,
    s.date,
    (prodLookup[s.productId]||s.productId),
    s.quantity,
    s.unitPrice,
    s.discount||0,
    saleTotal(s).toFixed(2),
    `"${(s.notes||'').replace(/"/g,'""')}"`
  ]);
  const csv = [header.join(','), ...rows.map(r=>r.join(','))].join('\n');
  downloadBlob(csv, 'sales.csv', 'text/csv');
}