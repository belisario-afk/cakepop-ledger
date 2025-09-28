import {
  fmtMoney, uuid, parseNum, betweenDates, todayISO, downloadBlob
} from './utils.js';
import {
  addProduct, removeProduct, addSale, removeSale, addExpense, removeExpense,
  getAll, importJson, exportJson, resetAll,
  addIngredient, removeIngredient, upsertRecipeItem, removeRecipeItem
} from './storage.js';
import {
  getProducts, getSales, getExpenses, computeMetrics, saleTotal,
  getIngredients, getRecipes, productRecipeCost, productBaseCost, productCost
} from './models.js';
import { dailyRevenueSeries, topProducts } from './analytics.js';
import { lineChart } from './charts.js';
import { exportSalesCsv } from './export.js';
import { encryptJSON, decryptJSON } from './crypto.js';
import { backupToGist, restoreFromGist, loadGistConfig, saveGistConfig, startAutoBackup, stopAutoBackup } from './gist-backup.js';
import { getActiveUser, signOut, initGoogleSignIn } from './auth.js';

let currentView = 'dashboard';

const viewContainer = () => document.getElementById('viewContainer');

export function switchView(view){
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.view===view);
  });
  document.querySelectorAll('.bottom-nav .nav-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.view===view);
  });
  render();
}

function el(id){ return document.getElementById(id); }

function fillDashboard(){
  const sales = getSales();
  const expenses = getExpenses();
  const m = computeMetrics(sales, expenses);
  el('m-revenue').textContent = fmtMoney(m.revenue);
  el('m-cogs').textContent = fmtMoney(m.cogs);
  el('m-gross').textContent = fmtMoney(m.gross);
  el('m-net').textContent = fmtMoney(m.net);
  el('m-margin').textContent = (m.margin).toFixed(1)+'%';
  el('m-aov').textContent = fmtMoney(m.aov);
  lineChart(el('chartRevenue'), dailyRevenueSeries(30));
  const list = el('topFlavors');
  list.innerHTML = '';
  topProducts().forEach(p=>{
    const li = document.createElement('li');
    li.textContent = `${p.name} — ${p.qty} pcs`;
    list.appendChild(li);
  });
}

function fillProducts(){
  const tbody = el('productsTable').querySelector('tbody');
  tbody.innerHTML='';
  getProducts().forEach(p=>{
    const baseCost = productBaseCost(p.id);
    const recipeCost = productRecipeCost(p.id);
    const effective = productCost(p.id);
    const margin = p.unitPrice ? ((p.unitPrice - effective)/p.unitPrice*100).toFixed(1) : '0';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${fmtMoney(baseCost)}</td>
      <td>${recipeCost !== null ? fmtMoney(recipeCost) : '-'}</td>
      <td>${fmtMoney(p.unitPrice)}</td>
      <td>${margin}%</td>
      <td><button data-del="${p.id}" aria-label="Delete product ${p.name}">Del</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', e=>{
    if (e.target.matches('button[data-del]')){
      if (confirm('Delete product (and recipe)?')){
        removeProduct(e.target.getAttribute('data-del'));
        fillProducts();
        fillDashboard();
      }
    }
  }, { once:true });
}

function fillSales(){
  const from = el('salesFrom').value;
  const to = el('salesTo').value;
  const tbody = el('salesTable').querySelector('tbody');
  tbody.innerHTML='';
  const prod = Object.fromEntries(getProducts().map(p=>[p.id,p]));
  const filtered = getSales().filter(s=>betweenDates(s.date, from, to));
  el('salesCount').textContent = `${filtered.length} rows`;
  filtered.sort((a,b)=>b.date.localeCompare(a.date)).forEach(s=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.date}</td>
      <td>${prod[s.productId]?.name || s.productId}</td>
      <td>${s.quantity}</td>
      <td>${fmtMoney(s.unitPrice)}</td>
      <td>${fmtMoney(s.discount||0)}</td>
      <td>${fmtMoney(saleTotal(s))}</td>
      <td>${(s.notes||'').replace(/</g,'&lt;')}</td>
      <td><button data-sale-del="${s.id}" aria-label="Delete sale">x</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', e=>{
    if (e.target.matches('button[data-sale-del]')){
      if (confirm('Delete this sale?')){
        removeSale(e.target.getAttribute('data-sale-del'));
        fillSales(); fillDashboard();
      }
    }
  },{ once:true });
}

function fillExpenses(){
  const from = el('expFrom').value;
  const to = el('expTo').value;
  const tbody = el('expensesTable').querySelector('tbody');
  tbody.innerHTML='';
  const filtered = getExpenses().filter(e=>betweenDates(e.date, from, to));
  el('expenseTotal').textContent = fmtMoney(filtered.reduce((a,e)=>a+parseNum(e.amount),0));
  filtered.sort((a,b)=>b.date.localeCompare(a.date)).forEach(e=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.date}</td>
      <td>${e.category}</td>
      <td>${fmtMoney(e.amount)}</td>
      <td>${(e.notes||'').replace(/</g,'&lt;')}</td>
      <td><button data-exp-del="${e.id}">x</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', e=>{
    if (e.target.matches('button[data-exp-del]')){
      if (confirm('Delete expense?')){
        removeExpense(e.target.getAttribute('data-exp-del'));
        fillExpenses(); fillDashboard();
      }
    }
  },{ once:true });
}

function fillIngredients(){
  const tbody = el('ingredientsTable').querySelector('tbody');
  tbody.innerHTML='';
  getIngredients().forEach(i=>{
    const tr = document.createElement('tr');
    tr.innerHTML=`
      <td>${i.name}</td>
      <td>${i.unit}</td>
      <td>${fmtMoney(i.costPerUnit)}</td>
      <td><button data-ing-del="${i.id}">Del</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', e=>{
    if (e.target.matches('button[data-ing-del]')){
      if (confirm('Delete ingredient (removes from recipes)?')){
        removeIngredient(e.target.getAttribute('data-ing-del'));
        fillIngredients();
      }
    }
  }, { once:true });
}

function fillRecipes(){
  const pSel = document.querySelector('select[name="productId"]');
  const iSel = document.querySelector('select[name="ingredientId"]');
  pSel.innerHTML=''; iSel.innerHTML='';
  getProducts().forEach(p=>{
    const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; pSel.appendChild(o);
  });
  getIngredients().forEach(i=>{
    const o=document.createElement('option'); o.value=i.id; o.textContent=i.name; iSel.appendChild(o);
  });
  const recipeProdSel = el('recipeProductSelect');
  recipeProdSel.innerHTML='';
  getProducts().forEach(p=>{
    const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; recipeProdSel.appendChild(o);
  });
  updateRecipeTable();
}

function updateRecipeTable(){
  const productId = el('recipeProductSelect').value;
  const tbody = el('recipeTable').querySelector('tbody');
  tbody.innerHTML='';
  const recipe = getRecipes()[productId] || {};
  const ingMap = Object.fromEntries(getIngredients().map(i=>[i.id,i]));
  let total=0;
  Object.entries(recipe).forEach(([ingId, qty])=>{
    const ing = ingMap[ingId]; if (!ing) return;
    const line = ing.costPerUnit*qty; total+=line;
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${ing.name}</td>
      <td>${qty}</td>
      <td>${fmtMoney(ing.costPerUnit)}</td>
      <td>${fmtMoney(line)}</td>
      <td><button data-r-del="${ingId}">x</button></td>
    `;
    tbody.appendChild(tr);
  });
  el('recipeTotalCost').textContent = `Total Recipe Cost: ${fmtMoney(total)} (Overrides base cost)`;
  tbody.addEventListener('click', e=>{
    if (e.target.matches('button[data-r-del]')){
      if (confirm('Remove ingredient from recipe?')){
        removeRecipeItem(productId, e.target.getAttribute('data-r-del'));
        updateRecipeTable();
      }
    }
  }, { once:true });
}

function fillDataView(){
  const list = document.getElementById('sysInfo');
  const all = getAll();
  list.innerHTML='';
  [
    ['Products', all.products.length],
    ['Ingredients', all.ingredients.length],
    ['Recipes with items', Object.values(all.recipes).filter(r=>Object.keys(r).length).length],
    ['Sales', all.sales.length],
    ['Expenses', all.expenses.length],
    ['Created', new Date(all.meta.created).toLocaleString()],
    ['Last Save', new Date(all.meta.lastSaved||Date.now()).toLocaleString()],
    ['Brand', all.meta.brand||'unknown']
  ].forEach(([k,v])=>{
    const li=document.createElement('li');
    li.textContent=`${k}: ${v}`;
    list.appendChild(li);
  });

  const cfg = loadGistConfig();
  const form = document.getElementById('gistForm');
  form.token.value = cfg.token || '';
  form.gistId.value = cfg.gistId || '';
  form.interval.value = cfg.interval || 0;
  el('gistStatus').textContent = cfg.lastBackup
    ? `Last backup: ${new Date(cfg.lastBackup).toLocaleString()}`
    : 'No backups yet.';
}

function ensureDateDefaults(){
  document.querySelectorAll('input[type="date"]').forEach(inp=>{
    if (!inp.value) inp.value = todayISO();
  });
}

export function render(){
  const tpl = document.getElementById(`tpl-${currentView}`);
  if (!tpl) {
    viewContainer().innerHTML='<p>View not found.</p>';
    return;
  }
  viewContainer().innerHTML='';
  viewContainer().appendChild(tpl.content.cloneNode(true));

  if (currentView==='dashboard') fillDashboard();
  else if (currentView==='products') { bindProductForm(); fillProducts(); }
  else if (currentView==='sales') { bindSaleForm(); fillSales(); }
  else if (currentView==='expenses') { bindExpenseForm(); fillExpenses(); }
  else if (currentView==='ingredients') { bindIngredientForm(); fillIngredients(); }
  else if (currentView==='recipes') { bindRecipeForm(); fillRecipes(); }
  else if (currentView==='data') { bindDataActions(); fillDataView(); }

  ensureDateDefaults();
  updateAuthBar();
}

function bindProductForm(){
  const f = document.getElementById('productForm');
  f.addEventListener('submit', e=>{
    e.preventDefault();
    const fd=new FormData(f);
    const prod={
      id:'p-'+uuid(),
      name:fd.get('name').trim(),
      unitCost:parseNum(fd.get('unitCost')),
      unitPrice:parseNum(fd.get('unitPrice')),
      active:true
    };
    if (!prod.name) return;
    addProduct(prod);
    f.reset();
    render();
  });
}

function bindIngredientForm(){
  const f=document.getElementById('ingredientForm');
  f.addEventListener('submit', e=>{
    e.preventDefault();
    const fd=new FormData(f);
    const ing={
      id:'ing-'+uuid(),
      name:fd.get('name').trim(),
      unit:fd.get('unit').trim(),
      costPerUnit:parseNum(fd.get('costPerUnit'))
    };
    if(!ing.name) return;
    addIngredient(ing);
    f.reset();
    fillIngredients();
  });
}

function bindRecipeForm(){
  const f=document.getElementById('recipeForm');
  f.addEventListener('submit', e=>{
    e.preventDefault();
    const fd=new FormData(f);
    const pid=fd.get('productId');
    const ing=fd.get('ingredientId');
    const qty=parseNum(fd.get('quantity'));
    if (!pid||!ing||qty<=0) return;
    upsertRecipeItem(pid,ing,qty);
    updateRecipeTable();
  });
  el('recipeProductSelect').addEventListener('change', updateRecipeTable);
  el('recalcRecipeBtn').addEventListener('click', updateRecipeTable);
}

function bindSaleForm(){
  const sel=document.querySelector('select[name="productId"]');
  getProducts().forEach(p=>{
    const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; sel.appendChild(o);
  });
  const f=document.getElementById('saleForm');
  f.addEventListener('submit', e=>{
    e.preventDefault();
    const fd=new FormData(f);
    const sale={
      id:'s-'+uuid(),
      date:fd.get('date'),
      productId:fd.get('productId'),
      quantity:parseInt(fd.get('quantity'))||0,
      unitPrice:parseNum(fd.get('unitPrice')),
      discount:parseNum(fd.get('discount'))||0,
      notes:fd.get('notes')?.trim()
    };
    if (!sale.productId||sale.quantity<=0) return;
    addSale(sale);
    f.reset();
    f.date.value=sale.date;
    fillSales(); fillDashboard();
  });
  el('filterSalesBtn').addEventListener('click', fillSales);
  el('clearSalesFilterBtn').addEventListener('click', ()=>{
    el('salesFrom').value=''; el('salesTo').value=''; fillSales();
  });
}

function bindExpenseForm(){
  const f=document.getElementById('expenseForm');
  f.addEventListener('submit', e=>{
    e.preventDefault();
    const fd=new FormData(f);
    const exp={
      id:'e-'+uuid(),
      date:fd.get('date'),
      category:fd.get('category'),
      amount:parseNum(fd.get('amount')),
      notes:fd.get('notes')?.trim()
    };
    if (exp.amount<=0) return;
    addExpense(exp);
    f.reset();
    f.date.value=exp.date;
    fillExpenses(); fillDashboard();
  });
  el('filterExpBtn').addEventListener('click', fillExpenses);
  el('clearExpFilterBtn').addEventListener('click', ()=>{
    el('expFrom').value=''; el('expTo').value=''; fillExpenses();
  });
}

function bindDataActions(){
  el('exportJsonBtn').addEventListener('click', ()=>downloadBlob(exportJson(),'smallbatch-ledger.json'));
  el('exportCsvBtn').addEventListener('click', exportSalesCsv);
  el('exportEncryptedBtn').addEventListener('click', async ()=>{
    const pw=prompt('Password for encryption (keep safe):');
    if(!pw) return;
    try {
      const encObj=await encryptJSON(exportJson(),pw);
      downloadBlob(JSON.stringify(encObj,null,2),'smallbatch-ledger-encrypted.json');
    } catch(e){
      alert('Encryption failed: '+e.message);
    }
  });
  el('importJsonInput').addEventListener('change', e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      try {
        const obj=JSON.parse(reader.result);
        if (confirm('Overwrite current data?')){ importJson(obj); render(); }
      } catch(e){ alert('Invalid JSON'); }
    };
    reader.readAsText(file);
  });
  el('importEncryptedInput').addEventListener('change', e=>{
    const file=e.target.files[0]; if(!file) return;
    const pw=prompt('Password to decrypt:'); if(!pw) return;
    const reader=new FileReader();
    reader.onload=async ()=>{
      try {
        const encObj=JSON.parse(reader.result);
        const plain=await decryptJSON(encObj,pw);
        const obj=JSON.parse(plain);
        if(confirm('Overwrite current data?')){ importJson(obj); render(); }
      } catch(err){ alert('Decryption failed: '+err.message); }
    };
    reader.readAsText(file);
  });
  el('resetAllBtn').addEventListener('click', ()=>{
    if (confirm('Clear ALL data for this user?')){ resetAll(); render(); }
  });
  el('exportJsonLink')?.addEventListener('click', (evt)=>{
    evt.preventDefault();
    downloadBlob(exportJson(),'smallbatch-ledger.json');
  });

  const gistForm = document.getElementById('gistForm');
  gistForm.addEventListener('submit', e=>{
    e.preventDefault();
    const fd=new FormData(gistForm);
    const cfg=loadGistConfig();
    cfg.token=fd.get('token').trim();
    cfg.gistId=fd.get('gistId').trim();
    cfg.interval=parseInt(fd.get('interval'))||0;
    saveGistConfig(cfg);
    stopAutoBackup();
    startAutoBackup();
    el('gistStatus').textContent='Settings saved.';
  });
  el('gistBackupBtn').addEventListener('click', async ()=>{
    const status=el('gistStatus'); status.textContent='Backing up...';
    try {
      const r=await backupToGist();
      status.textContent=`Backup OK. Gist: ${r.gistId}`;
    } catch(e){ status.textContent='Backup failed: '+e.message; }
  });
  el('gistRestoreBtn').addEventListener('click', async ()=>{
    const status=el('gistStatus'); status.textContent='Restoring...';
    try {
      await restoreFromGist();
      status.textContent='Restore complete.';
      render();
    } catch(e){ status.textContent='Restore failed: '+e.message; }
  });
}

export function initNav(){
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn=>{
    btn.addEventListener('click', ()=>switchView(btn.dataset.view));
  });
  document.getElementById('year').textContent = new Date().getFullYear();
}

export function initTheme(){
  const saved = localStorage.getItem('smallbatch-theme');
  if (saved==='light') document.body.classList.add('light');
  if (saved==='high-contrast') document.body.classList.add('high-contrast');
  document.getElementById('darkModeBtn').addEventListener('click', ()=>{
    document.body.classList.toggle('light');
    document.body.classList.remove('high-contrast');
    localStorage.setItem('smallbatch-theme',
      document.body.classList.contains('light')?'light':'dark');
  });
  document.getElementById('contrastBtn').addEventListener('click', ()=>{
    const hc = document.body.classList.toggle('high-contrast');
    if (hc) document.body.classList.remove('light');
    localStorage.setItem('smallbatch-theme', hc ? 'high-contrast' :
      (document.body.classList.contains('light')?'light':'dark'));
  });
}

function updateAuthBar(){
  const user = getActiveUser();
  const span = document.getElementById('authUser');
  const btn = document.getElementById('signOutBtn');
  if (user){
    span.textContent = user.name || user.email;
    btn.style.display='';
  } else {
    span.textContent='Guest';
    btn.style.display='none';
  }
}

export function initAuth(){
  const CLIENT_ID = window.SMALLBATCH_GOOGLE_CLIENT_ID
    || '1086175730023-fjulcqbi6076ed70386j8sbiqlr7ir7f.apps.googleusercontent.com';
  initGoogleSignIn(CLIENT_ID);
  document.getElementById('signOutBtn').addEventListener('click', ()=>{
    if(confirm('Sign out current user?')) signOut();
  });
  updateAuthBar();
  window.addEventListener('smallbatch-user-change', ()=>render());
}