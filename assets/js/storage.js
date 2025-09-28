// Upgraded storage with multi-user namespace + ingredients/recipes + migration
import { getActiveUser } from './auth.js';

const BASE_KEY_V2 = 'cakepop-ledger-v2';

const legacyKeyV1 = 'cakepop-ledger-v1';

function nsKey() {
  const u = getActiveUser();
  const suffix = u?.sub || 'guest';
  return `${BASE_KEY_V2}::${suffix}`;
}

const defaultData = () => ({
  version: 2,
  products: [
    { id:'p-vanilla', name:'Vanilla', unitCost:0.40, unitPrice:2.50, active:true },
    { id:'p-chocolate', name:'Chocolate', unitCost:0.45, unitPrice:2.75, active:true },
    { id:'p-redvelvet', name:'Red Velvet', unitCost:0.50, unitPrice:3.00, active:true }
  ],
  ingredients: [
    { id:'ing-sugar', name:'Sugar', unit:'g', costPerUnit:0.002 },
    { id:'ing-flour', name:'Flour', unit:'g', costPerUnit:0.0015 }
  ],
  // recipe: productId -> { ingredientId: quantity }
  recipes: {
    // Example default recipe for vanilla (optional)
    // 'p-vanilla': { 'ing-sugar': 12, 'ing-flour': 18 }
  },
  sales: [],
  expenses: [],
  meta: { created: Date.now(), lastExport:null, lastSaved:null, migratedFromV1:false }
});

let _data = null;

function migrateFromV1IfNeeded(dataKey){
  if (localStorage.getItem(dataKey)) return; // already has v2 for this user
  const legacy = localStorage.getItem(legacyKeyV1);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy);
      const d = defaultData();
      // merge fields that existed
      d.products = parsed.products || d.products;
      d.sales = parsed.sales || [];
      d.expenses = parsed.expenses || [];
      d.meta.created = parsed.meta?.created || Date.now();
      d.meta.migratedFromV1 = true;
      localStorage.setItem(dataKey, JSON.stringify(d));
    } catch(e){
      // ignore
    }
  }
}

export function loadData() {
  const key = nsKey();
  if (_data && _data.__key === key) return _data;
  migrateFromV1IfNeeded(key);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      _data = defaultData();
      _data.__key = key;
      persist();
    } else {
      _data = JSON.parse(raw);
      _data.__key = key;
      if (!_data.version) _data.version = 2;
      if (!_data.ingredients) _data.ingredients = [];
      if (!_data.recipes) _data.recipes = {};
    }
  } catch(e) {
    console.warn('Failed load, resetting', e);
    _data = defaultData();
    _data.__key = key;
    persist();
  }
  return _data;
}

export function persist(){
  if (!_data) return;
  _data.meta.lastSaved = Date.now();
  const key = nsKey();
  localStorage.setItem(key, JSON.stringify(_data));
}

export function getAll(){ return loadData(); }

// Products
export function addProduct(p){ loadData().products.push(p); persist(); }
export function removeProduct(id){
  const d = loadData();
  d.products = d.products.filter(p=>p.id!==id);
  delete d.recipes[id];
  persist();
}

// Ingredients
export function addIngredient(i){ loadData().ingredients.push(i); persist(); }
export function removeIngredient(id){
  const d = loadData();
  d.ingredients = d.ingredients.filter(x=>x.id!==id);
  // Remove from recipes
  Object.keys(d.recipes).forEach(pid=>{
    if (d.recipes[pid][id] !== undefined) {
      delete d.recipes[pid][id];
    }
  });
  persist();
}

export function upsertRecipeItem(productId, ingId, qty){
  const d = loadData();
  if (!d.recipes[productId]) d.recipes[productId] = {};
  d.recipes[productId][ingId] = qty;
  persist();
}

export function removeRecipeItem(productId, ingId){
  const d = loadData();
  if (d.recipes[productId]) {
    delete d.recipes[productId][ingId];
    persist();
  }
}

// Sales
export function addSale(s) { loadData().sales.push(s); persist(); }
export function removeSale(id) {
  const d = loadData();
  d.sales = d.sales.filter(s=>s.id!==id); 
  persist();
}

// Expenses
export function addExpense(e){ loadData().expenses.push(e); persist(); }
export function removeExpense(id){
  const d = loadData();
  d.expenses = d.expenses.filter(x=>x.id!==id);
  persist();
}

export function resetAll(){
  _data = defaultData();
  _data.__key = nsKey();
  persist();
}

export function importJson(obj){
  _data = obj;
  _data.__key = nsKey();
  if (!_data.version) _data.version = 2;
  if (!_data.ingredients) _data.ingredients = [];
  if (!_data.recipes) _data.recipes = {};
  persist();
}

export function exportJson(){
  const clone = structuredClone(getAll());
  delete clone.__key;
  return JSON.stringify(clone, null, 2);
}