import { parseNum } from './utils.js';
import { getAll } from './storage.js';

export const getProducts = () => getAll().products;
export const getSales = () => getAll().sales;
export const getExpenses = () => getAll().expenses;
export const getIngredients = () => getAll().ingredients;
export const getRecipes = () => getAll().recipes;

export const productRecipeCost = (productId) => {
  const r = getRecipes()[productId];
  if (!r) return null;
  const ingMap = Object.fromEntries(getIngredients().map(i=>[i.id,i]));
  let sum = 0;
  for (const [ingId, qty] of Object.entries(r)){
    const ing = ingMap[ingId];
    if (!ing) continue;
    sum += parseNum(ing.costPerUnit) * parseNum(qty);
  }
  return sum;
};

export const productBaseCost = (productId) => {
  const p = getProducts().find(p=>p.id===productId);
  return p ? p.unitCost : 0;
};

export const productCost = (productId) => {
  const rc = productRecipeCost(productId);
  return rc !== null ? rc : productBaseCost(productId);
};

export const saleTotal = sale => {
  const gross = sale.unitPrice * sale.quantity;
  return gross - (sale.discount || 0);
};

export const saleCost = sale => productCost(sale.productId) * sale.quantity;

export const computeMetrics = (sales, expenses) => {
  const rev = sales.reduce((a,s)=>a + saleTotal(s),0);
  const cogs = sales.reduce((a,s)=>a + saleCost(s),0);
  const gross = rev - cogs;
  const expSum = expenses.reduce((a,e)=>a + parseNum(e.amount),0);
  const net = gross - expSum;
  const orders = sales.length;
  return {
    revenue: rev,
    cogs,
    gross,
    expenses: expSum,
    net,
    aov: orders ? rev/orders : 0,
    margin: rev ? (gross/rev)*100 : 0
  };
};