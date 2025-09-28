// (Modified to expose persist + no changes to existing logic except adding settings field if missing)
import { getActiveUser } from './auth.js';

const NEW_BASE_KEY = 'smallbatch-ledger-v2';
const LEGACY_KEYS = ['cakepop-ledger-v2', 'cakepop-ledger-v1'];

function nsKey(){
  const u = getActiveUser();
  const suffix = u?.sub || 'guest';
  return `${NEW_BASE_KEY}::${suffix}`;
}

const defaultData = () => ({
  version: 2,
  products: [],
  ingredients: [],
  recipes: {},
  sales: [],
  expenses: [],
  settings: null,
  meta: { created: Date.now(), lastExport:null, lastSaved:null, migrated:true, brand:'smallbatch' }
});

let _data = null;

function attemptMigration(targetKey){
  if (localStorage.getItem(targetKey)) return;
  for (const legacyBase of LEGACY_KEYS){
    const legacyKey = `${legacyBase}::guest`;
    const raw = localStorage.getItem(legacyKey);
    if (raw){
      try {
        const parsed = JSON.parse(raw);
        parsed.meta = parsed.meta || {};
        parsed.meta.migratedFrom = legacyBase;
        parsed.meta.migratedAt = Date.now();
        parsed.meta.brand = 'smallbatch';
        if (!parsed.settings) parsed.settings = null;
        localStorage.setItem(targetKey, JSON.stringify(parsed));
        return;
      } catch {}
    }
  }
}

export function loadData(){
  const key = nsKey();
  if (_data && _data.__key === key) return _data;
  attemptMigration(key);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      _data = defaultData();
      _data.__key = key;
      seedInitialProducts();
      persist();
    } else {
      _data = JSON.parse(raw);
      _data.__key = key;
      if (!_data.version) _data.version = 2;
      if (!_data.ingredients) _data.ingredients = [];
      if (!_data.recipes) _data.recipes = {};
      if (_data.settings === undefined) _data.settings = null;
    }
  } catch(e){
    console.warn('Storage load error; resetting', e);
    _data = defaultData();
    _data.__key = key;
    seedInitialProducts();
    persist();
  }
  return _data;
}

function seedInitialProducts(){
  if (!_data.products.length){
    _data.products.push(
      { id:'p-sample1', name:'Classic Vanilla', unitCost:0.40, unitPrice:2.50, active:true },
      { id:'p-sample2', name:'Rich Chocolate', unitCost:0.48, unitPrice:2.80, active:true }
    );
    _data.ingredients.push(
      { id:'ing-sugar', name:'Sugar', unit:'g', costPerUnit:0.002 },
      { id:'ing-flour', name:'Flour', unit:'g', costPerUnit:0.0015 }
    );
  }
}

export function persist(){
  if (!_data) return;
  _data.meta.lastSaved = Date.now();
  localStorage.setItem(_data.__key, JSON.stringify(_data));
}

export function getAll(){ return loadData(); }

export function addProduct(p){ loadData().products.push(p); persist(); }
export function removeProduct(id){
  const d = loadData();
  d.products = d.products.filter(p=>p.id!==id);
  delete d.recipes[id];
  persist();
}

export function addIngredient(i){ loadData().ingredients.push(i); persist(); }
export function removeIngredient(id){
  const d = loadData();
  d.ingredients = d.ingredients.filter(x=>x.id!==id);
  Object.keys(d.recipes).forEach(pid=>{
    if (d.recipes[pid][id] !== undefined) delete d.recipes[pid][id];
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

export function addSale(s){ loadData().sales.push(s); persist(); }
export function removeSale(id){
  const d = loadData();
  d.sales = d.sales.filter(s=>s.id!==id);
  persist();
}

export function addExpense(e){ loadData().expenses.push(e); persist(); }
export function removeExpense(id){
  const d = loadData();
  d.expenses = d.expenses.filter(x=>x.id!==id);
  persist();
}

export function resetAll(){
  _data = defaultData();
  _data.__key = nsKey();
  seedInitialProducts();
  persist();
}

export function importJson(obj){
  _data = obj;
  _data.__key = nsKey();
  if (!_data.version) _data.version = 2;
  if (!_data.ingredients) _data.ingredients = [];
  if (!_data.recipes) _data.recipes = {};
  if (_data.settings === undefined) _data.settings = null;
  persist();
}

export function exportJson(){
  const clone = structuredClone(getAll());
  delete clone.__key;
  return JSON.stringify(clone, null, 2);
}