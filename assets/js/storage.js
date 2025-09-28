const KEY = 'cakepop-ledger-v1';

const defaultData = () => ({
  products: [
    { id:'p-vanilla', name:'Vanilla', unitCost:0.40, unitPrice:2.50, active:true },
    { id:'p-chocolate', name:'Chocolate', unitCost:0.45, unitPrice:2.75, active:true },
    { id:'p-redvelvet', name:'Red Velvet', unitCost:0.50, unitPrice:3.00, active:true }
  ],
  sales: [],
  expenses: [],
  meta: { created: Date.now(), lastExport:null }
});

let _data = null;

export function loadData() {
  if (_data) return _data;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      _data = defaultData();
      persist();
    } else {
      _data = JSON.parse(raw);
    }
  } catch(e) {
    console.warn('Failed load, resetting', e);
    _data = defaultData();
    persist();
  }
  return _data;
}

export function persist(){
  _data.meta.lastSaved = Date.now();
  localStorage.setItem(KEY, JSON.stringify(_data));
}

export function getAll(){ return loadData(); }

export function addProduct(p){ loadData().products.push(p); persist(); }
export function updateProduct(id, patch){
  const p = loadData().products.find(x=>x.id===id);
  if (p){ Object.assign(p, patch); persist(); }
}
export function removeProduct(id){
  _data.products = _data.products.filter(p=>p.id!==id);
  persist();
}

export function addSale(s) { _data.sales.push(s); persist(); }
export function removeSale(id) {
  _data.sales = _data.sales.filter(s=>s.id!==id); persist();
}

export function addExpense(e){ _data.expenses.push(e); persist(); }
export function removeExpense(id){
  _data.expenses = _data.expenses.filter(e=>e.id!==id); persist();
}

export function resetAll(){
  _data = defaultData();
  persist();
}

export function importJson(obj){
  _data = obj;
  persist();
}

export function exportJson(){
  return JSON.stringify(getAll(), null, 2);
}