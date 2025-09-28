import { parseNum } from './utils.js';
import { getAll } from './storage.js';

export const getProducts = () => getAll().products;
export const getSales = () => getAll().sales;
export const getExpenses = () => getAll().expenses;
export const getIngredients = () => getAll().ingredients;
export const getRecipes = () => getAll().recipes;

// Compute recipe-based unit cost if recipe exists
export const productRecipeCost = (productId) => {
  const recipes = getRecipes();
  const recipe = recipes[productId];
  if (!recipe) return null;
  const ingredients = getIngredients();
  const ingMap = Object.fromEntries(ingredients.map(i=>[i.id,i]));
  let total = 0;
  Object.entries(recipe).forEach(([ingId, qty])=>{
    const ing = ingMap[ingId];
    if (!ing) return;
    total += parseNum(ing.costPerUnit) * parseNum(qty);
  });
  return total;
};

export const productBaseCost = (productId) => {
  const p = getProducts().find(p=>p.id===productId);
  return p ? p.unitCost : 0;
};

export const productCost = (productId) => {
  const rCost = productRecipeCost(productId);
  if (rCost !== null) return rCost;
  return productBaseCost(productId);
};

export const saleTotal = sale => {
  const gross = sale.unitPrice * sale.quantity;
  const net = gross - (sale.discount || 0);
  return net;
};

export const saleCost = sale => productCost(sale.productId) * sale.quantity;

export const computeMetrics = (filteredSales, filteredExpenses) => {
  const revenue = filteredSales.reduce((a,s)=>a + saleTotal(s),0);
  const cogs = filteredSales.reduce((a,s)=>a + saleCost(s),0);
  const gross = revenue - cogs;
  const expenses = filteredExpenses.reduce((a,e)=>a + parseNum(e.amount),0);
  const net = gross - expenses;
  const orders = filteredSales.length;
  const aov = orders ? revenue / orders : 0;
  const margin = revenue ? (gross / revenue)*100 : 0;
  return { revenue, cogs, gross, expenses, net, aov, margin };
};