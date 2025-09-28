import { getSales, getProducts } from './models.js';
import { saleTotal } from './models.js';
import { daysAgo } from './utils.js';

export function salesLastNDays(n=30){
  const from = daysAgo(n-1);
  return getSales().filter(s => s.date >= from);
}

export function dailyRevenueSeries(n=30){
  const map = new Map();
  for (let i=n-1;i>=0;i--){
    const d = daysAgo(i);
    map.set(d,0);
  }
  salesLastNDays(n).forEach(s=>{
    map.set(s.date, (map.get(s.date)||0) + saleTotal(s));
  });
  return Array.from(map.entries());
}

export function topProducts(limit=5){
  const counts = {};
  getSales().forEach(s=>{
    counts[s.productId] = (counts[s.productId]||0) + s.quantity;
  });
  const prodLookup = Object.fromEntries(getProducts().map(p=>[p.id,p]));
  return Object.entries(counts)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,limit)
    .map(([id,qty])=>({ id, name: prodLookup[id]?.name || id, qty }));
}