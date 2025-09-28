import { parseNum } from './utils.js';
import { getAll } from './storage.js';

export const getProducts = () => getAll().products;
export const getSales = () => getAll().sales;
export const getExpenses = () => getAll().expenses;
export const getIngredients = () => getAll().ingredients;
export const getRecipes = () => getAll().recipes;

export const productRecipeCost = (productId) => {
  const r = getRecipes()[productId];
  if(!r) return null;
  const ingMap = Object.fromEntries(getIngredients().map(i=>[i.id,i]));
  let total=0;
  for(const [ingId,qty] of Object.entries(r)){
    const ing=ingMap[ingId]; if(!ing) continue;
    total += parseNum(ing.costPerUnit)*parseNum(qty);
  }
  return total;
};
export const productBaseCost = (productId) => {
  const p=getProducts().find(p=>p.id===productId);
  return p? p.unitCost:0;
};
export const productCost = (productId) => {
  const rc=productRecipeCost(productId);
  return rc!==null? rc : productBaseCost(productId);
};

export const saleTotal = s => s.unitPrice*s.quantity - (s.discount||0);
export const saleCost = s => productCost(s.productId)*s.quantity;

export const computeMetrics = (sales, expenses) => {
  const revenue=sales.reduce((a,s)=>a+saleTotal(s),0);
  const cogs=sales.reduce((a,s)=>a+saleCost(s),0);
  const gross=revenue-cogs;
  const expSum=expenses.reduce((a,e)=>a+parseNum(e.amount),0);
  const net=gross-expSum;
  const orders=sales.length;
  return {
    revenue, cogs, gross,
    expenses:expSum,
    net,
    aov:orders?revenue/orders:0,
    margin:revenue? (gross/revenue)*100:0
  };
};