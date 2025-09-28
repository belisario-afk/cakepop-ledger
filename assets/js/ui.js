/* Core UI orchestrator */
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
import { ensureSettings, getSettings, saveSettings } from './user-settings.js';
import { applyTheme, previewTheme, generatePattern, resetThemeToDefault, updatePreviewCard, mergePresetIntoSettings, tempApplyPreset, exportThemeOnly, importThemeObject } from './theme.js';
import { initParallax } from './parallax.js';

let currentView='dashboard';

const viewContainer = () => document.getElementById('viewContainer');

export function switchView(view){
  currentView=view;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  document.querySelectorAll('.bottom-nav .nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  render();
}

/* ---- Rendering ---- */
export function render(){
  const tpl = document.getElementById(`tpl-${currentView}`);
  if (!tpl){
    viewContainer().innerHTML='<p>View not found.</p>';
    return;
  }
  viewContainer().innerHTML='';
  viewContainer().appendChild(tpl.content.cloneNode(true));

  if (currentView==='dashboard') fillDashboard();
  else if (currentView==='products'){ bindProductForm(); fillProducts(); }
  else if (currentView==='ingredients'){ bindIngredientForm(); fillIngredients(); }
  else if (currentView==='recipes'){ bindRecipeForm(); fillRecipes(); }
  else if (currentView==='sales'){ bindSaleForm(); fillSales(); }
  else if (currentView==='expenses'){ bindExpenseForm(); fillExpenses(); }
  else if (currentView==='data'){ bindDataActions(); fillDataView(); }
  else if (currentView==='settings'){ bindSettings(); }

  ensureDateDefaults();
  updateAuthBar();
  initParallax();
}

function fillDashboard(){
  const sales = getSales();
  const expenses = getExpenses();
  const m = computeMetrics(sales, expenses);
  setText('m-revenue', fmtMoney(m.revenue));
  setText('m-cogs', fmtMoney(m.cogs));
  setText('m-gross', fmtMoney(m.gross));
  setText('m-net', fmtMoney(m.net));
  setText('m-margin', m.margin.toFixed(1)+'%');
  setText('m-aov', fmtMoney(m.aov));
  lineChart(document.getElementById('chartRevenue'), dailyRevenueSeries(30));
  const ul = document.getElementById('topFlavors');
  if (ul){
    ul.innerHTML='';
    topProducts().forEach(p=>{
      const li=document.createElement('li');
      li.textContent = `${p.name} — ${p.qty} pcs`;
      ul.appendChild(li);
    });
  }
}

function fillProducts(){
  const tbody = document.querySelector('#productsTable tbody');
  if (!tbody) return;
  tbody.innerHTML='';
  getProducts().forEach(p=>{
    const baseCost = productBaseCost(p.id);
    const recipeCost = productRecipeCost(p.id);
    const effective = productCost(p.id);
    const margin = p.unitPrice ? ((p.unitPrice - effective)/p.unitPrice*100).toFixed(1) : '0';
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${p.name}</td>
      <td>${fmtMoney(baseCost)}</td>
      <td>${recipeCost!==null? fmtMoney(recipeCost): '-'}</td>
      <td>${fmtMoney(p.unitPrice)}</td>
      <td>${margin}%</td>
      <td><button data-del="${p.id}">Del</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', e=>{
    if (e.target.matches('button[data-del]')){
      if (confirm('Delete product and its recipe?')){
        removeProduct(e.target.getAttribute('data-del'));
        fillProducts(); fillDashboard();
      }
    }
  }, { once:true });
}

function fillIngredients(){
  const tbody = document.querySelector('#ingredientsTable tbody');
  if (!tbody) return;
  tbody.innerHTML='';
  getIngredients().forEach(i=>{
    const tr=document.createElement('tr');
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
      if (confirm('Delete ingredient (will remove from recipes)?')){
        removeIngredient(e.target.getAttribute('data-ing-del'));
        fillIngredients();
      }
    }
  }, { once:true });
}

function fillRecipes(){
  const pSel = document.querySelector('select[name="productId"]');
  const iSel = document.querySelector('select[name="ingredientId"]');
  const prodSel = document.getElementById('recipeProductSelect');
  if (!pSel || !iSel || !prodSel) return;
  pSel.innerHTML=''; iSel.innerHTML=''; prodSel.innerHTML='';
  getProducts().forEach(p=>{
    const o1=document.createElement('option'); o1.value=p.id; o1.textContent=p.name; pSel.appendChild(o1);
    const o2=document.createElement('option'); o2.value=p.id; o2.textContent=p.name; prodSel.appendChild(o2);
  });
  getIngredients().forEach(i=>{
    const o=document.createElement('option'); o.value=i.id; o.textContent=i.name; iSel.appendChild(o);
  });
  updateRecipeTable();
}

function updateRecipeTable(){
  const productId = document.getElementById('recipeProductSelect')?.value;
  if (!productId) return;
  const tbody = document.querySelector('#recipeTable tbody');
  if (!tbody) return;
  tbody.innerHTML='';
  const recipe = getRecipes()[productId] || {};
  const ingMap = Object.fromEntries(getIngredients().map(i=>[i.id,i]));
  let total=0;
  Object.entries(recipe).forEach(([ingId, qty])=>{
    const ing=ingMap[ingId]; if(!ing) return;
    const line=ing.costPerUnit*qty;
    total+=line;
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
  setText('recipeTotalCost', `Total Recipe Cost: ${fmtMoney(total)} (Overrides base cost)`);
  tbody.addEventListener('click', e=>{
    if (e.target.matches('button[data-r-del]')){
      if (confirm('Remove ingredient from recipe?')){
        removeRecipeItem(productId, e.target.getAttribute('data-r-del'));
        updateRecipeTable();
      }
    }
  }, { once:true });
}

function fillSales(){
  const from = document.getElementById('salesFrom')?.value;
  const to = document.getElementById('salesTo')?.value;
  const tbody = document.querySelector('#salesTable tbody');
  if (!tbody) return;
  tbody.innerHTML='';
  const prodLookup = Object.fromEntries(getProducts().map(p=>[p.id,p]));
  const filtered = getSales().filter(s=>betweenDates(s.date, from, to));
  setText('salesCount', `${filtered.length} rows`);
  filtered.sort((a,b)=>b.date.localeCompare(a.date)).forEach(s=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${s.date}</td>
      <td>${prodLookup[s.productId]?.name || s.productId}</td>
      <td>${s.quantity}</td>
      <td>${fmtMoney(s.unitPrice)}</td>
      <td>${fmtMoney(s.discount||0)}</td>
      <td>${fmtMoney(saleTotal(s))}</td>
      <td>${(s.notes||'').replace(/</g,'&lt;')}</td>
      <td><button data-sale-del="${s.id}">x</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', e=>{
    if (e.target.matches('button[data-sale-del]')){
      if (confirm('Delete sale?')){
        removeSale(e.target.getAttribute('data-sale-del'));
        fillSales(); fillDashboard();
      }
    }
  }, { once:true });
}

function fillExpenses(){
  const from = document.getElementById('expFrom')?.value;
  const to = document.getElementById('expTo')?.value;
  const tbody = document.querySelector('#expensesTable tbody');
  if (!tbody) return;
  tbody.innerHTML='';
  const filtered = getExpenses().filter(e=>betweenDates(e.date, from, to));
  setText('expenseTotal', fmtMoney(filtered.reduce((a,e)=>a+parseNum(e.amount),0)));
  filtered.sort((a,b)=>b.date.localeCompare(a.date)).forEach(e=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
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
  }, { once:true });
}

function fillDataView(){
  const list=document.getElementById('sysInfo');
  if(!list) return;
  const all=getAll();
  list.innerHTML='';
  [
    ['Products', all.products.length],
    ['Ingredients', all.ingredients.length],
    ['Recipes with items', Object.values(all.recipes).filter(r=>Object.keys(r).length).length],
    ['Sales', all.sales.length],
    ['Expenses', all.expenses.length],
    ['Created', new Date(all.meta.created).toLocaleString()],
    ['Last Save', new Date(all.meta.lastSaved||Date.now()).toLocaleString()]
  ].forEach(([k,v])=>{
    const li=document.createElement('li'); li.textContent=`${k}: ${v}`; list.appendChild(li);
  });

  const cfg=loadGistConfig();
  const form=document.getElementById('gistForm');
  if (form){
    form.token.value = cfg.token || '';
    form.gistId.value = cfg.gistId || '';
    form.interval.value = cfg.interval || 0;
  }
  const status=document.getElementById('gistStatus');
  if (status){
    status.textContent = cfg.lastBackup ? `Last backup: ${new Date(cfg.lastBackup).toLocaleString()}` : 'No backups yet.';
  }
}

/* ---- Binding Forms ---- */
function bindProductForm(){
  const f=document.getElementById('productForm');
  if (!f) return;
  f.addEventListener('submit', e=>{
    e.preventDefault();
    const fd=new FormData(f);
    const p={
      id:'p-'+uuid(),
      name:fd.get('name').trim(),
      unitCost:parseNum(fd.get('unitCost')),
      unitPrice:parseNum(fd.get('unitPrice')),
      active:true
    };
    if (!p.name) return;
    addProduct(p);
    f.reset();
    render();
  });
}

function bindIngredientForm(){
  const f=document.getElementById('ingredientForm');
  if (!f) return;
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
  if (!f) return;
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
  document.getElementById('recipeProductSelect')?.addEventListener('change', updateRecipeTable);
  document.getElementById('recalcRecipeBtn')?.addEventListener('click', updateRecipeTable);
}

function bindSaleForm(){
  const sel=document.querySelector('select[name="productId"]');
  if (sel){
    sel.innerHTML='';
    getProducts().forEach(p=>{
      const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; sel.appendChild(o);
    });
  }
  const f=document.getElementById('saleForm');
  if (!f) return;
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
    if (!sale.productId || sale.quantity<=0) return;
    addSale(sale);
    f.reset();
    f.date.value=sale.date;
    fillSales(); fillDashboard();
  });
  document.getElementById('filterSalesBtn')?.addEventListener('click', fillSales);
  document.getElementById('clearSalesFilterBtn')?.addEventListener('click', ()=>{
    document.getElementById('salesFrom').value='';
    document.getElementById('salesTo').value='';
    fillSales();
  });
}

function bindExpenseForm(){
  const f=document.getElementById('expenseForm');
  if (!f) return;
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
  document.getElementById('filterExpBtn')?.addEventListener('click', fillExpenses);
  document.getElementById('clearExpFilterBtn')?.addEventListener('click', ()=>{
    document.getElementById('expFrom').value='';
    document.getElementById('expTo').value='';
    fillExpenses();
  });
}

function bindDataActions(){
  document.getElementById('exportJsonBtn')?.addEventListener('click', ()=>downloadBlob(exportJson(),'smallbatch-ledger.json'));
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportSalesCsv);
  document.getElementById('exportEncryptedBtn')?.addEventListener('click', async ()=>{
    const pw=prompt('Password for encryption (store safely):');
    if(!pw) return;
    try {
      const encObj=await encryptJSON(exportJson(),pw);
      downloadBlob(JSON.stringify(encObj,null,2),'smallbatch-ledger-encrypted.json');
    } catch(e){ alert('Encryption failed: '+e.message); }
  });
  document.getElementById('importJsonInput')?.addEventListener('change', e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      try {
        const obj=JSON.parse(reader.result);
        if (confirm('Overwrite current data?')){ importJson(obj); render(); }
      } catch(err){ alert('Invalid JSON'); }
    };
    reader.readAsText(file);
  });
  document.getElementById('importEncryptedInput')?.addEventListener('change', e=>{
    const file=e.target.files[0]; if(!file) return;
    const pw=prompt('Enter decryption password:'); if(!pw) return;
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
  document.getElementById('resetAllBtn')?.addEventListener('click', ()=>{
    if (confirm('Clear ALL data for this user?')){ resetAll(); render(); }
  });
  document.getElementById('exportJsonLink')?.addEventListener('click', e=>{
    e.preventDefault(); downloadBlob(exportJson(),'smallbatch-ledger.json');
  });

  const gistForm=document.getElementById('gistForm');
  gistForm?.addEventListener('submit', e=>{
    e.preventDefault();
    const fd=new FormData(gistForm);
    const cfg=loadGistConfig();
    cfg.token=fd.get('token').trim();
    cfg.gistId=fd.get('gistId').trim();
    cfg.interval=parseInt(fd.get('interval'))||0;
    saveGistConfig(cfg);
    stopAutoBackup(); startAutoBackup();
    setText('gistStatus','Settings saved.');
  });
  document.getElementById('gistBackupBtn')?.addEventListener('click', async ()=>{
    const st=document.getElementById('gistStatus');
    st.textContent='Backing up...';
    try { const r=await backupToGist(); st.textContent='Backup OK. Gist: '+r.gistId; }
    catch(e){ st.textContent='Backup failed: '+e.message; }
  });
  document.getElementById('gistRestoreBtn')?.addEventListener('click', async ()=>{
    const st=document.getElementById('gistStatus');
    st.textContent='Restoring...';
    try { await restoreFromGist(); st.textContent='Restore complete.'; render(); }
    catch(e){ st.textContent='Restore failed: '+e.message; }
  });
}

/* SETTINGS */
function bindSettings(){
  const settings = ensureSettings();
  applyTheme(settings);
  const profileForm=document.getElementById('storeProfileForm');
  if (profileForm){
    profileForm.storeName.value=settings.storeName||'';
    profileForm.tagline.value=settings.tagline||'';
    profileForm.logoEmoji.value=settings.logoEmoji||'🧁';
    profileForm.addEventListener('submit', e=>{
      e.preventDefault();
      const fd=new FormData(profileForm);
      settings.storeName = fd.get('storeName').trim() || 'SmallBatch';
      settings.tagline = fd.get('tagline').trim() || 'Sales • Costs • Ingredients';
      settings.logoEmoji = fd.get('logoEmoji').trim() || '🧁';
      const file = fd.get('logoFile');
      if (file && file.size){
        const reader=new FileReader();
        reader.onload=()=>{
          settings.logoDataUrl=reader.result;
          saveSettings(settings);
          applyTheme(settings);
          alert('Profile saved.');
        };
        reader.readAsDataURL(file);
      } else {
        saveSettings(settings);
        applyTheme(settings);
        alert('Profile saved.');
      }
    });
  }
  const tForm=document.getElementById('themeForm');
  if (!tForm) return;
  tForm.primaryColor.value=settings.colors.primary;
  tForm.accentColor.value=settings.colors.accent;
  tForm.bgColor.value=settings.colors.bg;
  tForm.elevColor.value=settings.colors.elev;
  tForm.mode.value=settings.mode||'system';
  tForm.glass.value=settings.glass||'off';
  tForm.bgStyle.value=settings.background.mode;
  tForm.gradientValue.value=settings.background.gradient||'';
  tForm.imageUrl.value=settings.background.imageUrl||'';
  tForm.patternSeed.value=settings.background.patternSeed||'';
  tForm.font.value=settings.font||'system';
  tForm.preset.value=settings.preset||'';

  const collect=()=>({
    preset:tForm.preset.value,
    primaryColor:tForm.primaryColor.value,
    accentColor:tForm.accentColor.value,
    bgColor:tForm.bgColor.value,
    elevColor:tForm.elevColor.value,
    mode:tForm.mode.value,
    glass:tForm.glass.value,
    font:tForm.font.value,
    bgStyle:tForm.bgStyle.value,
    gradientValue:tForm.gradientValue.value,
    imageUrl:tForm.imageUrl.value,
    patternSeed:tForm.patternSeed.value
  });

  document.getElementById('applyPresetBtn')?.addEventListener('click', ()=>{
    const name=tForm.preset.value;
    if (!name){ alert('Select a preset.'); return; }
    mergePresetIntoSettings(name, settings);
    saveSettings(settings);
    applyTheme(settings);
    updatePreviewCard(settings);
    // refresh form
    tForm.primaryColor.value=settings.colors.primary;
    tForm.accentColor.value=settings.colors.accent;
    tForm.bgColor.value=settings.colors.bg;
    tForm.elevColor.value=settings.colors.elev;
    tForm.bgStyle.value=settings.background.mode;
    tForm.gradientValue.value=settings.background.gradient;
    tForm.imageUrl.value=settings.background.imageUrl;
    tForm.patternSeed.value=settings.background.patternSeed;
    tForm.font.value=settings.font;
    alert('Preset applied. Adjust and Save Theme to persist changes.');
  });

  document.getElementById('previewPresetBtn')?.addEventListener('click', ()=>{
    const name=tForm.preset.value;
    if (!name){ alert('Select a preset.'); return; }
    tempApplyPreset(name);
    alert('Preset previewed (not saved).');
  });

  document.getElementById('previewThemeBtn')?.addEventListener('click', ()=>{
    previewTheme(collect());
    alert('Preview applied (not saved).');
  });

  document.getElementById('genPatternBtn')?.addEventListener('click', ()=>{
    const vals=collect();
    const dataUrl=generatePattern(vals.patternSeed||Date.now().toString(), vals.primaryColor, vals.accentColor);
    settings.background.patternDataUrl=dataUrl;
    const previewClone=structuredClone(settings);
    previewClone.background.mode='pattern';
    previewClone.background.patternDataUrl=dataUrl;
    updatePreviewCard(previewClone);
    applyTheme(previewClone);
    alert('Pattern generated (Preview). Save Theme to persist.');
  });

  tForm.addEventListener('submit', e=>{
    e.preventDefault();
    const vals=collect();
    settings.colors.primary=vals.primaryColor;
    settings.colors.accent=vals.accentColor;
    settings.colors.bg=vals.bgColor;
    settings.colors.elev=vals.elevColor;
    settings.mode=vals.mode;
    settings.glass=vals.glass;
    settings.font=vals.font;
    settings.preset=vals.preset||'custom';
    settings.background.mode=vals.bgStyle;
    settings.background.gradient=vals.gradientValue;
    settings.background.imageUrl=vals.imageUrl;
    settings.background.patternSeed=vals.patternSeed;
    if (vals.bgStyle==='pattern'){
      settings.background.patternDataUrl = settings.background.patternDataUrl ||
        generatePattern(vals.patternSeed||Date.now().toString(), vals.primaryColor, vals.accentColor);
    } else {
      settings.background.patternDataUrl='';
    }
    saveSettings(settings);
    applyTheme(settings);
    updatePreviewCard(settings);
    alert('Theme saved.');
  });

  document.getElementById('resetThemeBtn')?.addEventListener('click', ()=>{
    if (confirm('Reset theme & profile to defaults?')){
      resetThemeToDefault();
      render();
    }
  });

  document.getElementById('exportThemeBtn')?.addEventListener('click', ()=>{
    const json=exportThemeOnly();
    downloadBlob(json,'smallbatch-theme.json');
  });

  document.getElementById('importThemeInput')?.addEventListener('change', e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      try {
        const obj=JSON.parse(reader.result);
        importThemeObject(obj);
        tForm.primaryColor.value=obj.colors.primary;
        tForm.accentColor.value=obj.colors.accent;
        tForm.bgColor.value=obj.colors.bg;
        tForm.elevColor.value=obj.colors.elev;
        tForm.bgStyle.value=obj.background.mode;
        tForm.gradientValue.value=obj.background.gradient;
        tForm.imageUrl.value=obj.background.imageUrl;
        tForm.patternSeed.value=obj.background.patternSeed;
        tForm.font.value=obj.font||'system';
        tForm.preset.value=obj.preset||'';
        alert('Theme imported.');
      } catch(err){ alert('Invalid theme file.'); }
    };
    reader.readAsText(file);
  });

  updatePreviewCard(settings);
}

/* Helpers */
function ensureDateDefaults(){
  document.querySelectorAll('input[type="date"]').forEach(inp=>{
    if (!inp.value) inp.value=todayISO();
  });
}

function setText(id,val){
  const el=document.getElementById(id);
  if (el) el.textContent=val;
}

/* ---- Auth / Theme / Nav initialization ---- */
export function initNav(){
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn=>{
    btn.addEventListener('click', ()=>switchView(btn.dataset.view));
  });
  const year=document.getElementById('year');
  if (year) year.textContent=new Date().getFullYear();
}

export function initTheme(){
  const saved = localStorage.getItem('smallbatch-theme');
  if (saved==='light') document.body.classList.add('light');
  if (saved==='high-contrast') document.body.classList.add('high-contrast');
  document.getElementById('darkModeBtn')?.addEventListener('click', ()=>{
    document.body.classList.toggle('light');
    document.body.classList.remove('high-contrast');
    localStorage.setItem('smallbatch-theme',
      document.body.classList.contains('light')?'light':'dark');
  });
  document.getElementById('contrastBtn')?.addEventListener('click', ()=>{
    const hc=document.body.classList.toggle('high-contrast');
    if (hc) document.body.classList.remove('light');
    localStorage.setItem('smallbatch-theme', hc?'high-contrast':
      (document.body.classList.contains('light')?'light':'dark'));
  });
}

function updateAuthBar(){
  const user=getActiveUser();
  const span=document.getElementById('authUser');
  const btn=document.getElementById('signOutBtn');
  if (!span||!btn) return;
  if (user){
    span.textContent=user.name||user.email;
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
  document.getElementById('signOutBtn')?.addEventListener('click', ()=>{
    if (confirm('Sign out current user?')) signOut();
  });
  window.addEventListener('smallbatch-user-change', ()=>{
    ensureSettings(); applyTheme(getSettings()); render();
  });
}