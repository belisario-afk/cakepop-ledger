import { fmtMoney, uuid, parseNum, betweenDates, todayISO, downloadBlob } from './utils.js';
import {
  addProduct, removeProduct, addSale, removeSale, addExpense, removeExpense,
  getAll, importJson, exportJson, resetAll
} from './storage.js';
import { getProducts, getSales, getExpenses, computeMetrics, saleTotal } from './models.js';
import { dailyRevenueSeries, topProducts } from './analytics.js';
import { lineChart } from './charts.js';
import { exportSalesCsv } from './export.js';

let currentView = 'dashboard';

const viewContainer = () => document.getElementById('viewContainer');

export function switchView(view){
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b=>{
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

  const series = dailyRevenueSeries(30);
  lineChart(el('chartRevenue'), series);

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
  tbody.innerHTML = '';
  getProducts().forEach(p=>{
    const tr = document.createElement('tr');
    const margin = p.unitPrice ? ((p.unitPrice - p.unitCost)/p.unitPrice*100).toFixed(1) : '0';
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${fmtMoney(p.unitCost)}</td>
      <td>${fmtMoney(p.unitPrice)}</td>
      <td>${margin}%</td>
      <td><button data-del="${p.id}" aria-label="Delete ${p.name}">Del</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', e=>{
    if (e.target.matches('button[data-del]')){
      const id = e.target.getAttribute('data-del');
      if (confirm('Delete product?')) {
        removeProduct(id);
        fillProducts();
        if (currentView==='sales') fillSales();
        if (currentView==='dashboard') fillDashboard();
      }
    }
  }, { once:true });
}

function fillSales(){
  const from = el('salesFrom').value;
  const to = el('salesTo').value;
  const tbody = el('salesTable').querySelector('tbody');
  tbody.innerHTML='';
  const prodLookup = Object.fromEntries(getProducts().map(p=>[p.id,p]));
  const filtered = getSales().filter(s=>betweenDates(s.date, from, to));
  el('salesCount').textContent = `${filtered.length} rows`;
  filtered.sort((a,b)=> b.date.localeCompare(a.date)).forEach(s=>{
    const tr = document.createElement('tr');
    const total = saleTotal(s);
    tr.innerHTML = `
      <td>${s.date}</td>
      <td>${prodLookup[s.productId]?.name || s.productId}</td>
      <td>${s.quantity}</td>
      <td>${fmtMoney(s.unitPrice)}</td>
      <td>${fmtMoney(s.discount||0)}</td>
      <td>${fmtMoney(total)}</td>
      <td>${(s.notes||'').replace(/</g,'&lt;')}</td>
      <td><button data-sale-del="${s.id}" aria-label="Delete sale">x</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', e=>{
    if (e.target.matches('button[data-sale-del]')){
      const id = e.target.getAttribute('data-sale-del');
      if (confirm('Delete sale?')) {
        removeSale(id);
        fillSales();
        fillDashboard();
      }
    }
  }, { once:true });
}

function fillExpenses(){
  const from = el('expFrom').value;
  const to = el('expTo').value;
  const tbody = el('expensesTable').querySelector('tbody');
  tbody.innerHTML='';
  const filtered = getExpenses().filter(e=>betweenDates(e.date, from, to));
  const total = filtered.reduce((a,e)=>a + (parseFloat(e.amount)||0),0);
  el('expenseTotal').textContent = fmtMoney(total);
  filtered.sort((a,b)=>b.date.localeCompare(a.date)).forEach(e=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.date}</td>
      <td>${e.category}</td>
      <td>${fmtMoney(e.amount)}</td>
      <td>${(e.notes||'').replace(/</g,'&lt;')}</td>
      <td><button data-exp-del="${e.id}" aria-label="Delete expense">x</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', (e)=>{
    if (e.target.matches('button[data-exp-del]')){
      const id = e.target.getAttribute('data-exp-del');
      if (confirm('Delete expense?')){
        removeExpense(id);
        fillExpenses();
        fillDashboard();
      }
    }
  }, { once:true });
}

function fillDataView(){
  const list = document.getElementById('sysInfo');
  const all = getAll();
  list.innerHTML = '';
  const items = [
    ['Products', all.products.length],
    ['Sales', all.sales.length],
    ['Expenses', all.expenses.length],
    ['Created', new Date(all.meta.created).toLocaleString()],
    ['Last Save', new Date(all.meta.lastSaved||Date.now()).toLocaleString()]
  ];
  items.forEach(([k,v])=>{
    const li = document.createElement('li');
    li.textContent = `${k}: ${v}`;
    list.appendChild(li);
  });
}

function ensureDateDefaults(){
  document.querySelectorAll('input[type="date"]').forEach(inp=>{
    if (!inp.value) inp.value = todayISO();
  });
}

export function render(){
  const tplId = `tpl-${currentView}`;
  const tpl = document.getElementById(tplId);
  if (!tpl){ viewContainer().innerHTML = '<p>View not found</p>'; return; }
  viewContainer().innerHTML = '';
  viewContainer().appendChild(tpl.content.cloneNode(true));

  if (currentView==='dashboard') {
    fillDashboard();
  } else if (currentView==='products') {
    bindProductForm();
    fillProducts();
  } else if (currentView==='sales') {
    bindSaleForm();
    fillSales();
  } else if (currentView==='expenses') {
    bindExpenseForm();
    fillExpenses();
  } else if (currentView==='data') {
    bindDataActions();
    fillDataView();
  }
  ensureDateDefaults();
}

function bindProductForm(){
  const form = document.getElementById('productForm');
  form.addEventListener('submit', e=>{
    e.preventDefault();
    const fd = new FormData(form);
    const product = {
      id: 'p-'+uuid(),
      name: fd.get('name').trim(),
      unitCost: parseNum(fd.get('unitCost')),
      unitPrice: parseNum(fd.get('unitPrice')),
      active: true
    };
    if (!product.name) return;
    addProduct(product);
    form.reset();
    render();
  });
}

function bindSaleForm(){
  const sel = document.querySelector('select[name="productId"]');
  getProducts().forEach(p=>{
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });

  const form = document.getElementById('saleForm');
  form.addEventListener('submit', e=>{
    e.preventDefault();
    const fd = new FormData(form);
    const sale = {
      id:'s-'+uuid(),
      date: fd.get('date'),
      productId: fd.get('productId'),
      quantity: parseInt(fd.get('quantity'))||0,
      unitPrice: parseNum(fd.get('unitPrice')),
      discount: parseNum(fd.get('discount')) || 0,
      notes: fd.get('notes')?.trim()
    };
    if (!sale.productId || sale.quantity <= 0) return;
    addSale(sale);
    form.reset();
    form.date.value = sale.date;
    fillSales();
    fillDashboard();
  });

  document.getElementById('filterSalesBtn').addEventListener('click', fillSales);
  document.getElementById('clearSalesFilterBtn').addEventListener('click', ()=>{
    document.getElementById('salesFrom').value='';
    document.getElementById('salesTo').value='';
    fillSales();
  });
}

function bindExpenseForm(){
  const form = document.getElementById('expenseForm');
  form.addEventListener('submit', e=>{
    e.preventDefault();
    const fd = new FormData(form);
    const exp = {
      id:'e-'+uuid(),
      date: fd.get('date'),
      category: fd.get('category'),
      amount: parseNum(fd.get('amount')),
      notes: fd.get('notes')?.trim()
    };
    if (exp.amount <= 0) return;
    addExpense(exp);
    form.reset();
    form.date.value = exp.date;
    fillExpenses();
    fillDashboard();
  });

  document.getElementById('filterExpBtn').addEventListener('click', fillExpenses);
  document.getElementById('clearExpFilterBtn').addEventListener('click', ()=>{
    document.getElementById('expFrom').value='';
    document.getElementById('expTo').value='';
    fillExpenses();
  });
}

function bindDataActions(){
  document.getElementById('exportJsonBtn').addEventListener('click', ()=>{
    downloadBlob(exportJson(), 'cakepop-ledger.json');
  });
  document.getElementById('exportCsvBtn').addEventListener('click', ()=>{
    exportSalesCsv();
  });
  document.getElementById('importJsonInput').addEventListener('change', e=>{
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (confirm('Import will overwrite existing data. Continue?')){
          importJson(obj);
          render();
        }
      } catch(err){
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('resetAllBtn').addEventListener('click', ()=>{
    if (confirm('This will CLEAR ALL DATA. Are you sure?')){
      resetAll();
      render();
    }
  });

  const link = document.getElementById('exportJsonLink');
  if (link){
    link.addEventListener('click', (e)=>{
      e.preventDefault();
      downloadBlob(exportJson(),'cakepop-ledger.json');
    });
  }
}

export function initNav(){
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      switchView(btn.dataset.view);
    });
  });
  document.getElementById('year').textContent = new Date().getFullYear();
}

export function initTheme(){
  const saved = localStorage.getItem('cakepop-theme');
  if (saved==='light') document.body.classList.add('light');
  document.getElementById('darkModeBtn').addEventListener('click', ()=>{
    document.body.classList.toggle('light');
    localStorage.setItem('cakepop-theme', document.body.classList.contains('light')?'light':'dark');
  });
}