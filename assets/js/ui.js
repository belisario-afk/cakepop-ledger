/* ui.js – Consolidated with working Quick Modal & proper exports */

import {
  fmtMoney, uuid, parseNum, betweenDates, todayISO, downloadBlob
} from './utils.js';
import {
  addProduct, removeProduct, addSale, removeSale, addExpense, removeExpense,
  getAll, importJson, exportJson, resetAll,
  addIngredient, removeIngredient, upsertRecipeItem, removeRecipeItem, persist
} from './storage.js';
import {
  getProducts, getSales, getExpenses, computeMetrics, saleTotal,
  getIngredients, getRecipes, productRecipeCost, productBaseCost, productCost
} from './models.js';
import { dailyRevenueSeries, topProducts } from './analytics.js';
import { lineChart } from './charts.js';
import { exportSalesCsv } from './export.js';
import { encryptJSON, decryptJSON } from './crypto.js';
import {
  backupToGist, restoreFromGist, loadGistConfig,
  saveGistConfig, startAutoBackup, stopAutoBackup
} from './gist-backup.js';
import { getActiveUser, signOut, initGoogleSignIn } from './auth.js';
import { ensureSettings, getSettings, saveSettings } from './user-settings.js';
import {
  applyTheme, previewTheme, generatePattern, resetThemeToDefault,
  updatePreviewCard, mergePresetIntoSettings, tempApplyPreset,
  exportThemeOnly, importThemeObject
} from './theme.js';
import { initParallax } from './parallax.js';

/* =============== STATE =============== */
let currentView = 'dashboard';
let recentProducts = [];
let lastSaveTime = Date.now();
let saveTickerInterval = null;

let uiPrefs = loadUIPrefs();
function loadUIPrefs(){
  try {
    return JSON.parse(localStorage.getItem('smallbatch-ui-prefs')) || {
      lockDate:false,
      reduceVibrancy:false,
      ambient:false,
      autoCloseQuick:true
    };
  } catch {
    return { lockDate:false, reduceVibrancy:false, ambient:false, autoCloseQuick:true };
  }
}
function saveUIPrefs(){
  localStorage.setItem('smallbatch-ui-prefs', JSON.stringify(uiPrefs));
}

/* =============== UTIL DOM HELPERS =============== */
function viewContainer(){ return document.getElementById('viewContainer'); }
function setText(id,val){ const el=document.getElementById(id); if(el) el.textContent=val; }

/* =============== NAV / VIEW =============== */
export function switchView(view){
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  document.querySelectorAll('.bottom-nav .nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  render();
}

export function render(){
  const tpl = document.getElementById(`tpl-${currentView}`);
  if (!tpl){
    viewContainer().innerHTML = '<p>View not found.</p>';
    return;
  }
  viewContainer().innerHTML = '';
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
  updateBackupBanner();
  initSaveTicker();
  initQuickModal();              // ensure modal bindings persist
}

/* =============== DASHBOARD =============== */
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
    ul.innerHTML = '';
    topProducts().forEach(p=>{
      const li=document.createElement('li');
      li.textContent = `${p.name} — ${p.qty} pcs`;
      ul.appendChild(li);
    });
  }
}

/* =============== PRODUCTS =============== */
function fillProducts(){
  const tbody = document.querySelector('#productsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  getProducts().forEach(p=>{
    const baseCost = productBaseCost(p.id);
    const recipeCost = productRecipeCost(p.id);
    const effective = productCost(p.id);
    const margin = p.unitPrice ? ((p.unitPrice - effective)/p.unitPrice*100).toFixed(1) : '0';
    const tr = document.createElement('tr');
    tr.innerHTML = `
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
        markSaved();
        fillProducts(); fillDashboard();
      }
    }
  }, { once:true });
}

/* =============== INGREDIENTS =============== */
function fillIngredients(){
  const tbody = document.querySelector('#ingredientsTable tbody');
  if(!tbody) return;
  tbody.innerHTML='';
  getIngredients().forEach(i=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${i.name}</td>
      <td>${i.unit}</td>
      <td>${fmtMoney(i.costPerUnit)}</td>
      <td><button data-ing-del="${i.id}">Del</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', e=>{
    if(e.target.matches('button[data-ing-del]')){
      if(confirm('Delete ingredient (removes from recipes)?')){
        removeIngredient(e.target.getAttribute('data-ing-del'));
        markSaved();
        fillIngredients();
      }
    }
  }, { once:true });
}

/* =============== RECIPES =============== */
function fillRecipes(){
  const pSel=document.querySelector('select[name="productId"]');
  const iSel=document.querySelector('select[name="ingredientId"]');
  const prodSel=document.getElementById('recipeProductSelect');
  if(!pSel||!iSel||!prodSel) return;
  pSel.innerHTML=''; iSel.innerHTML=''; prodSel.innerHTML='';

  getProducts().forEach(p=>{
    const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; pSel.appendChild(o);
    const o2=document.createElement('option'); o2.value=p.id; o2.textContent=p.name; prodSel.appendChild(o2);
  });
  getIngredients().forEach(i=>{
    const o=document.createElement('option'); o.value=i.id; o.textContent=i.name; iSel.appendChild(o);
  });
  updateRecipeTable();
}

function updateRecipeTable(){
  const productId=document.getElementById('recipeProductSelect')?.value;
  if(!productId) return;
  const tbody=document.querySelector('#recipeTable tbody');
  if(!tbody) return;
  tbody.innerHTML='';
  const recipe=getRecipes()[productId]||{};
  const ingMap=Object.fromEntries(getIngredients().map(i=>[i.id,i]));
  let total=0;
  Object.entries(recipe).forEach(([ingId, qty])=>{
    const ing=ingMap[ingId]; if(!ing) return;
    const line=ing.costPerUnit*qty; total+=line;
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${ing.name}</td>
      <td>${qty}</td>
      <td>${fmtMoney(ing.costPerUnit)}</td>
      <td>${fmtMoney(line)}</td>
      <td><button data-r-del="${ingId}">x</button></td>`;
    tbody.appendChild(tr);
  });
  setText('recipeTotalCost', `Total Recipe Cost: ${fmtMoney(total)} (Overrides base cost)`);
  tbody.addEventListener('click', e=>{
    if(e.target.matches('button[data-r-del]')){
      if(confirm('Remove ingredient from recipe?')){
        removeRecipeItem(productId, e.target.getAttribute('data-r-del'));
        markSaved();
        updateRecipeTable();
      }
    }
  }, { once:true });
}

/* =============== SALES =============== */
function fillSales(){
  const from=document.getElementById('salesFrom')?.value;
  const to=document.getElementById('salesTo')?.value;
  const tbody=document.querySelector('#salesTable tbody');
  if(!tbody) return;
  tbody.innerHTML='';
  const prodLookup=Object.fromEntries(getProducts().map(p=>[p.id,p]));
  const filtered=getSales().filter(s=>betweenDates(s.date, from, to));
  setText('salesCount', `${filtered.length} rows`);
  filtered.sort((a,b)=>b.date.localeCompare(a.date)).forEach(s=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${s.date}</td>
      <td>${prodLookup[s.productId]?.name||s.productId}</td>
      <td>${s.quantity}</td>
      <td>${fmtMoney(s.unitPrice)}</td>
      <td>${fmtMoney(s.discount||0)}</td>
      <td>${fmtMoney(saleTotal(s))}</td>
      <td>${(s.notes||'').replace(/</g,'&lt;')}</td>
      <td><button data-sale-del="${s.id}">x</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', e=>{
    if(e.target.matches('button[data-sale-del]')){
      if(confirm('Delete sale?')){
        removeSale(e.target.getAttribute('data-sale-del'));
        markSaved();
        fillSales(); fillDashboard();
      }
    }
  }, { once:true });
}

/* =============== EXPENSES =============== */
function fillExpenses(){
  const from=document.getElementById('expFrom')?.value;
  const to=document.getElementById('expTo')?.value;
  const tbody=document.querySelector('#expensesTable tbody');
  if(!tbody) return;
  tbody.innerHTML='';
  const filtered=getExpenses().filter(e=>betweenDates(e.date, from, to));
  setText('expenseTotal', fmtMoney(filtered.reduce((a,e)=>a+parseNum(e.amount),0)));
  filtered.sort((a,b)=>b.date.localeCompare(a.date)).forEach(e=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${e.date}</td>
      <td>${e.category}</td>
      <td>${fmtMoney(e.amount)}</td>
      <td>${(e.notes||'').replace(/</g,'&lt;')}</td>
      <td><button data-exp-del="${e.id}">x</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', e=>{
    if(e.target.matches('button[data-exp-del]')){
      if(confirm('Delete expense?')){
        removeExpense(e.target.getAttribute('data-exp-del'));
        markSaved();
        fillExpenses(); fillDashboard();
      }
    }
  }, { once:true });
}

/* =============== DATA VIEW =============== */
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
  if(form){
    form.token.value=cfg.token||'';
    form.gistId.value=cfg.gistId||'';
    form.interval.value=cfg.interval||0;
  }
  const status=document.getElementById('gistStatus');
  if(status){
    status.textContent = cfg.lastBackup
      ? `Last backup: ${new Date(cfg.lastBackup).toLocaleString()}`
      : 'No backups yet.';
  }
}

/* =============== FORM BINDERS =============== */
function bindProductForm(){
  const f=document.getElementById('productForm');
  if(!f) return;
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
    if(!p.name) return;
    addProduct(p);
    markSaved();
    f.reset();
    render();
  });
}

function bindIngredientForm(){
  const f=document.getElementById('ingredientForm');
  if(!f) return;
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
    markSaved();
    f.reset();
    fillIngredients();
  });
}

function bindRecipeForm(){
  const f=document.getElementById('recipeForm');
  if(!f) return;
  f.addEventListener('submit', e=>{
    e.preventDefault();
    const fd=new FormData(f);
    const pid=fd.get('productId');
    const ing=fd.get('ingredientId');
    const qty=parseNum(fd.get('quantity'));
    if(!pid||!ing||qty<=0) return;
    upsertRecipeItem(pid,ing,qty);
    markSaved();
    updateRecipeTable();
  });
  document.getElementById('recipeProductSelect')?.addEventListener('change', updateRecipeTable);
  document.getElementById('recalcRecipeBtn')?.addEventListener('click', updateRecipeTable);
}

function bindSaleForm(){
  const sel=document.querySelector('select[name="productId"]');
  if(sel){
    sel.innerHTML='';
    getProducts().forEach(p=>{
      const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; sel.appendChild(o);
    });
  }
  const f=document.getElementById('saleForm');
  if(!f) return;
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
    if(!sale.productId || sale.quantity<=0) return;
    addSale(sale);
    trackRecentProduct(sale.productId);
    markSaved();
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
  if(!f) return;
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
    if(exp.amount<=0) return;
    addExpense(exp);
    markSaved();
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
  document.getElementById('exportJsonBtn')?.addEventListener('click', ()=>{
    downloadBlob(exportJson(),'smallbatch-ledger.json'); noteExportTime();
  });
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportSalesCsv);
  document.getElementById('exportEncryptedBtn')?.addEventListener('click', async ()=>{
    const pw=prompt('Password for encryption:');
    if(!pw) return;
    try {
      const encObj=await encryptJSON(exportJson(),pw);
      downloadBlob(JSON.stringify(encObj,null,2),'smallbatch-ledger-encrypted.json');
      noteExportTime();
    } catch(e){ alert('Encryption failed: '+e.message); }
  });

  document.getElementById('importJsonInput')?.addEventListener('change', e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      try {
        const obj=JSON.parse(reader.result);
        if(confirm('Overwrite current data?')){
          importJson(obj);
          markSaved();
          render();
        }
      } catch(err){ alert('Invalid JSON'); }
    };
    reader.readAsText(file);
  });

  document.getElementById('importEncryptedInput')?.addEventListener('change', e=>{
    const file=e.target.files[0]; if(!file) return;
    const pw=prompt('Password to decrypt:'); if(!pw) return;
    const reader=new FileReader();
    reader.onload=async ()=>{
      try {
        const encObj=JSON.parse(reader.result);
        const plain=await decryptJSON(encObj,pw);
        const obj=JSON.parse(plain);
        if(confirm('Overwrite decrypted data?')){
          importJson(obj);
          markSaved();
          render();
        }
      } catch(err){ alert('Decryption failed: '+err.message); }
    };
    reader.readAsText(file);
  });

  document.getElementById('resetAllBtn')?.addEventListener('click', ()=>{
    if(confirm('Clear ALL data for this user?')){
      resetAll(); markSaved(); render();
    }
  });

  document.getElementById('exportJsonLink')?.addEventListener('click', e=>{
    e.preventDefault();
    downloadBlob(exportJson(),'smallbatch-ledger.json');
    noteExportTime();
  });
  document.getElementById('backupNowLink')?.addEventListener('click', e=>{
    e.preventDefault(); updateBackupBanner(true);
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
    try{
      const r=await backupToGist();
      st.textContent='Backup OK. Gist: '+r.gistId;
    }catch(e){
      st.textContent='Backup failed: '+e.message;
    }
  });
  document.getElementById('gistRestoreBtn')?.addEventListener('click', async ()=>{
    const st=document.getElementById('gistStatus');
    st.textContent='Restoring...';
    try{
      await restoreFromGist();
      st.textContent='Restore complete.';
      markSaved();
      render();
    }catch(e){
      st.textContent='Restore failed: '+e.message;
    }
  });
}

/* =============== SETTINGS (Profile & Theme) =============== */
function bindSettings(){
  const settings=ensureSettings();
  applyTheme(settings);

  const profileForm=document.getElementById('storeProfileForm');
  if(profileForm){
    profileForm.storeName.value=settings.storeName||'';
    profileForm.tagline.value=settings.tagline||'';
    profileForm.logoEmoji.value=settings.logoEmoji||'🧁';
    profileForm.addEventListener('submit', e=>{
      e.preventDefault();
      const fd=new FormData(profileForm);
      settings.storeName=fd.get('storeName').trim()||'SmallBatch';
      settings.tagline=fd.get('tagline').trim()||'Sales • Costs • Ingredients';
      settings.logoEmoji=fd.get('logoEmoji').trim()||'🧁';
      const file=fd.get('logoFile');
      if(file && file.size){
        const reader=new FileReader();
        reader.onload=()=>{
          settings.logoDataUrl=reader.result;
          saveSettings(settings); applyTheme(settings); markSaved();
          alert('Profile saved.');
        };
        reader.readAsDataURL(file);
      } else {
        saveSettings(settings); applyTheme(settings); markSaved();
        alert('Profile saved.');
      }
    });
  }

  const tForm=document.getElementById('themeForm');
  if(tForm){
    /* Add quick-win preset expansions if missing */
    addPresetOption(tForm.preset,'ivory','Minimal Ivory');
    addPresetOption(tForm.preset,'stealth','Stealth Slate');

    /* Reduce vibrancy & Ambient toggles if not there (depends on previous markup) */
    if(!tForm.querySelector('[name="reduceVibrancy"]')){
      const wrap=document.createElement('div');
      wrap.className='inline-buttons';
      wrap.innerHTML=`
        <label style="display:flex;align-items:center;gap:.4rem;font-size:.63rem;">
          <input type="checkbox" name="reduceVibrancy"> Reduce Vibrancy
        </label>
        <label style="display:flex;align-items:center;gap:.4rem;font-size:.63rem;">
          <input type="checkbox" name="ambientMotion"> Ambient Animation
        </label>`;
      tForm.appendChild(wrap);
    }
    tForm.querySelector('[name="reduceVibrancy"]').checked=!!uiPrefs.reduceVibrancy;
    tForm.querySelector('[name="ambientMotion"]').checked=!!uiPrefs.ambient;
    tForm.addEventListener('change', e=>{
      if(e.target.name==='reduceVibrancy'){
        uiPrefs.reduceVibrancy=e.target.checked; applyVibrancy(); saveUIPrefs();
      } else if(e.target.name==='ambientMotion'){
        uiPrefs.ambient=e.target.checked; applyAmbient(); saveUIPrefs();
      }
    });

    document.getElementById('applyPresetBtn')?.addEventListener('click', ()=>{
      const name=tForm.preset.value;
      if(!name) return alert('Select a preset.');
      const settings=getSettings();
      if(name==='ivory'){
        mergePresetIntoSettings('default',settings);
        Object.assign(settings.colors,{
          primary:'#b89b4c',
          accent:'#d5bb6e',
          bg:'#f8f6f1',
          elev:'#ffffff'
        });
        settings.mode='light';
        settings.glass='off';
        settings.preset='ivory';
      } else if(name==='stealth'){
        mergePresetIntoSettings('noir', settings);
        Object.assign(settings.colors,{
          primary:'#3d3e42',
          accent:'#5a5b61',
          bg:'#0b0c0d',
          elev:'#141517'
        });
        settings.preset='stealth';
      } else {
        mergePresetIntoSettings(name, settings);
        settings.preset=name;
      }
      saveSettings(settings); applyTheme(settings); updatePreviewCard(settings); markSaved();
      alert('Preset applied.');
      runContrastCheck();
    });

    document.getElementById('previewPresetBtn')?.addEventListener('click', ()=>{
      const name=tForm.preset.value;
      if(!name) return alert('Select a preset.');
      if(name==='ivory'){
        const s=structuredClone(getSettings());
        Object.assign(s.colors,{
          primary:'#b89b4c',
          accent:'#d5bb6e',
          bg:'#f8f6f1',
          elev:'#ffffff'
        });
        s.mode='light'; applyTheme(s); updatePreviewCard(s);
      } else if(name==='stealth'){
        const s=structuredClone(getSettings());
        Object.assign(s.colors,{
          primary:'#3d3e42',
            accent:'#5a5b61',
            bg:'#0b0c0d',
            elev:'#141517'
        });
        applyTheme(s); updatePreviewCard(s);
      } else {
        tempApplyPreset(name);
      }
      alert('Preset previewed (not saved).');
      runContrastCheck();
    });

    document.getElementById('previewThemeBtn')?.addEventListener('click', ()=>{
      // gather quickly:
      const vals = new FormData(tForm);
      previewTheme({
        preset: vals.get('preset'),
        primaryColor: vals.get('primaryColor'),
        accentColor: vals.get('accentColor'),
        bgColor: vals.get('bgColor'),
        elevColor: vals.get('elevColor'),
        mode: vals.get('mode'),
        glass: vals.get('glass'),
        font: vals.get('font'),
        bgStyle: vals.get('bgStyle'),
        gradientValue: vals.get('gradientValue'),
        imageUrl: vals.get('imageUrl'),
        patternSeed: vals.get('patternSeed')
      });
      alert('Theme previewed (not saved).');
      runContrastCheck();
    });

    document.getElementById('genPatternBtn')?.addEventListener('click', ()=>{
      const vals=new FormData(tForm);
      const pri=vals.get('primaryColor');
      const acc=vals.get('accentColor');
      const seed=vals.get('patternSeed')||Date.now().toString();
      const dataUrl=generatePattern(seed, pri, acc);
      const s=getSettings();
      s.background.mode='pattern';
      s.background.patternSeed=seed;
      s.background.patternDataUrl=dataUrl;
      saveSettings(s); applyTheme(s); updatePreviewCard(s); markSaved();
      alert('Pattern generated & applied.');
    });

    tForm.addEventListener('submit', e=>{
      e.preventDefault();
      const vals=new FormData(tForm);
      const s=getSettings();
      s.colors.primary = vals.get('primaryColor');
      s.colors.accent  = vals.get('accentColor');
      s.colors.bg      = vals.get('bgColor');
      s.colors.elev    = vals.get('elevColor');
      s.mode           = vals.get('mode');
      s.glass          = vals.get('glass');
      s.font           = vals.get('font');
      s.background.mode= vals.get('bgStyle');
      s.background.gradient = vals.get('gradientValue');
      s.background.imageUrl = vals.get('imageUrl');
      s.background.patternSeed = vals.get('patternSeed');
      if (s.background.mode!=='pattern') s.background.patternDataUrl='';
      s.preset = vals.get('preset') || 'custom';
      saveSettings(s); applyTheme(s); updatePreviewCard(s); markSaved();
      alert('Theme saved.');
      runContrastCheck();
    });

    document.getElementById('resetThemeBtn')?.addEventListener('click', ()=>{
      if(confirm('Reset theme & profile to defaults?')){
        resetThemeToDefault(); markSaved(); render();
      }
    });

    document.getElementById('exportThemeBtn')?.addEventListener('click', ()=>{
      downloadBlob(exportThemeOnly(),'smallbatch-theme.json');
    });

    document.getElementById('importThemeInput')?.addEventListener('change', e=>{
      const file=e.target.files[0]; if(!file) return;
      const reader=new FileReader();
      reader.onload=()=>{
        try{
          const obj=JSON.parse(reader.result);
          importThemeObject(obj);
          markSaved();
          alert('Theme imported.');
          runContrastCheck();
          render();
        }catch(err){ alert('Invalid theme file'); }
      };
      reader.readAsText(file);
    });
  }

  applyVibrancy();
  applyAmbient();
  runContrastCheck();
  updatePreviewCard(getSettings());
}

function addPresetOption(selectEl, value, label){
  if(!selectEl) return;
  if([...selectEl.options].some(o=>o.value===value)) return;
  const opt=document.createElement('option');
  opt.value=value; opt.textContent=label;
  selectEl.appendChild(opt);
}

/* =============== QUICK MODAL (Robust Close / Toggle) =============== */
let quickModalBound=false;
let quickEscListener=null;

function initQuickModal(){
  const btn=document.getElementById('quickAddBtn');
  const modal=document.getElementById('quickModal');
  if(!btn||!modal) return;

  // Toggle open/close on button
  btn.addEventListener('click', ()=>{
    if(!modal.hidden) closeQuickModal(); else openQuickModal('sale');
  });

  if(!quickModalBound){
    quickModalBound=true;
    // Backdrop / any data-close
    modal.addEventListener('click', e=>{
      if(e.target.classList.contains('qm-backdrop') || e.target.hasAttribute('data-close')){
        closeQuickModal();
      }
    });
    // Tabs
    modal.querySelectorAll('.qm-tab').forEach(tab=>{
      tab.addEventListener('click', ()=>switchQuickTab(tab.getAttribute('data-tab')));
    });
  }

  populateQuickSaleProducts();
  seedQuickDates();
  restoreQuickPrefs();
  rebuildRecentChips();
  wireQuickForms();
}

function switchQuickTab(name){
  const modal=document.getElementById('quickModal');
  if(!modal) return;
  modal.querySelectorAll('.qm-tab').forEach(t=>{
    const active=t.getAttribute('data-tab')===name;
    t.classList.toggle('active',active);
    t.setAttribute('aria-selected',active?'true':'false');
  });
  modal.querySelectorAll('.qm-form').forEach(f=>{
    f.hidden = f.getAttribute('data-pane')!==name;
  });
  modal.querySelector(`[data-pane="${name}"]`)?.querySelector('input,select')?.focus();
}

function openQuickModal(tab='sale'){
  const modal=document.getElementById('quickModal');
  const btn=document.getElementById('quickAddBtn');
  if(!modal) return;
  populateQuickSaleProducts();
  seedQuickDates();
  restoreQuickPrefs();
  rebuildRecentChips();
  switchQuickTab(tab);
  modal.hidden=false;
  document.body.style.overflow='hidden';
  btn?.setAttribute('aria-expanded','true');

  if(!quickEscListener){
    quickEscListener = (e)=>{
      if(
        e.key==='Escape' ||
        (e.altKey && (e.key.toLowerCase()==='q'||e.key.toLowerCase()==='w')) ||
        (e.ctrlKey && e.key.toLowerCase()==='w')
      ){
        if(!modal.hidden){
          e.preventDefault();
          closeQuickModal();
        }
      }
    };
    window.addEventListener('keydown', quickEscListener, { capture:true });
  }
}

function closeQuickModal(){
  const modal=document.getElementById('quickModal');
  const btn=document.getElementById('quickAddBtn');
  if(!modal || modal.hidden) return;
  modal.hidden=true;
  document.body.style.overflow='';
  btn?.setAttribute('aria-expanded','false');
  // Keep the listener to allow immediate reopen (less overhead). Could remove if desired.
}

function populateQuickSaleProducts(){
  const sel=document.querySelector('#quickSaleForm select[name="productId"]');
  if(!sel) return;
  const current=sel.value;
  sel.innerHTML='';
  getProducts().forEach(p=>{
    const o=document.createElement('option'); o.value=p.id; o.textContent=p.name;
    sel.appendChild(o);
  });
  if(current && [...sel.options].some(o=>o.value===current)) sel.value=current;
}

function seedQuickDates(){
  document.querySelectorAll('#quickModal input[type="date"]').forEach(d=>{
    if(!d.value) d.value=todayISO();
  });
}

function restoreQuickPrefs(){
  const saleLock=document.querySelector('#quickSaleForm input[name="lockDate"]');
  const saleAuto=document.querySelector('#quickSaleForm input[name="autoClose"]');
  const expAuto=document.querySelector('#quickExpenseForm input[name="autoClose"]');
  if(saleLock) saleLock.checked = !!uiPrefs.lockDate;
  if(saleAuto) saleAuto.checked = (uiPrefs.autoCloseQuick!==false);
  if(expAuto) expAuto.checked = (uiPrefs.autoCloseQuick!==false);
  saleLock?.addEventListener('change', e=>{
    uiPrefs.lockDate=e.target.checked; saveUIPrefs();
  });
  ;[saleAuto,expAuto].forEach(ch=>{
    ch?.addEventListener('change', e=>{
      uiPrefs.autoCloseQuick = e.target.checked;
      saveUIPrefs();
    });
  });
}

function wireQuickForms(){
  const saleForm=document.getElementById('quickSaleForm');
  const expForm=document.getElementById('quickExpenseForm');
  if(saleForm && !saleForm.dataset.bound){
    saleForm.dataset.bound='1';
    saleForm.addEventListener('submit', e=>{
      e.preventDefault();
      const fd=new FormData(saleForm);
      const date=fd.get('date');
      const sale={
        id:'s-'+uuid(),
        date,
        productId:fd.get('productId'),
        quantity:parseInt(fd.get('quantity'))||0,
        unitPrice:parseNum(fd.get('unitPrice')),
        discount:parseNum(fd.get('discount'))||0,
        notes:fd.get('notes')?.trim()
      };
      if(!sale.productId||sale.quantity<=0) return;
      addSale(sale);
      trackRecentProduct(sale.productId);
      markSaved();
      if(!uiPrefs.lockDate) saleForm.reset();
      if(uiPrefs.lockDate) saleForm.date.value=date;
      saleForm.productId.focus();
      rebuildRecentChips();
      if(currentView==='dashboard') fillDashboard();
      if(currentView==='sales') fillSales();
      if(uiPrefs.autoCloseQuick) closeQuickModal();
    });
  }
  if(expForm && !expForm.dataset.bound){
    expForm.dataset.bound='1';
    expForm.addEventListener('submit', e=>{
      e.preventDefault();
      const fd=new FormData(expForm);
      const exp={
        id:'e-'+uuid(),
        date:fd.get('date'),
        category:fd.get('category'),
        amount:parseNum(fd.get('amount')),
        notes:fd.get('notes')?.trim()
      };
      if(exp.amount<=0) return;
      addExpense(exp);
      markSaved();
      expForm.reset();
      expForm.date.value=todayISO();
      if(currentView==='dashboard') fillDashboard();
      if(currentView==='expenses') fillExpenses();
      if(uiPrefs.autoCloseQuick) closeQuickModal();
    });
  }
}

function rebuildRecentChips(){
  const cont=document.getElementById('recentProducts');
  if(!cont) return;
  cont.innerHTML='';
  if(!recentProducts.length) return;
  const prodLookup=Object.fromEntries(getProducts().map(p=>[p.id,p.name]));
  recentProducts.slice(0,3).forEach(pid=>{
    const chip=document.createElement('button');
    chip.type='button';
    chip.className='recent-chip';
    chip.textContent=prodLookup[pid]||pid;
    chip.title='Use '+(prodLookup[pid]||pid);
    chip.addEventListener('click', ()=>{
      const sel=document.querySelector('#quickSaleForm select[name="productId"]');
      if(sel){
        sel.value=pid;
        sel.dispatchEvent(new Event('change'));
      }
    });
    cont.appendChild(chip);
  });
}

/* =============== RECENT PRODUCT UTILS =============== */
function trackRecentProduct(pid){
  recentProducts=[pid,...recentProducts.filter(p=>p!==pid)];
  if(recentProducts.length>6) recentProducts=recentProducts.slice(0,6);
  localStorage.setItem('smallbatch-recent-products', JSON.stringify(recentProducts));
  rebuildRecentChips();
}
function loadRecentProducts(){
  try {
    recentProducts=JSON.parse(localStorage.getItem('smallbatch-recent-products'))||[];
  } catch { recentProducts=[]; }
}

/* =============== SAVE STATUS / BACKUP REMINDER =============== */
function markSaved(){
  lastSaveTime=Date.now();
  updateSaveIndicator();
  persist();
}
function initSaveTicker(){
  if(saveTickerInterval) return;
  saveTickerInterval=setInterval(updateSaveIndicator,1000);
  updateSaveIndicator();
}
function updateSaveIndicator(){
  const el=document.getElementById('saveStatus');
  if(!el) return;
  const secs=Math.floor((Date.now()-lastSaveTime)/1000);
  el.textContent=`Saved • ${secs}s`;
}

const BACKUP_REMINDER_KEY='smallbatch-last-export-banner-dismiss';
function noteExportTime(){
  const all=getAll();
  all.meta.lastExport = Date.now();
  persist();
  localStorage.setItem(BACKUP_REMINDER_KEY,'dismissed-'+all.meta.lastExport);
  updateBackupBanner(true);
}

function updateBackupBanner(force=false){
  const bannerArea=document.getElementById('bannerArea');
  if(!bannerArea) return;
  const all=getAll();
  const lastExport=all.meta.lastExport||0;
  const DAYS=14;
  const due=Date.now()-lastExport > DAYS*86400000;
  const dismissed=localStorage.getItem(BACKUP_REMINDER_KEY)||'';
  bannerArea.querySelector('.notice-banner.backup')?.remove();
  if((due||force) && !dismissed.startsWith('dismissed-'+lastExport)){
    const div=document.createElement('div');
    div.className='notice-banner backup';
    div.innerHTML=`<span><strong>Reminder:</strong> You have not exported in over ${DAYS} days. Export JSON or Encrypted backup.</span>
      <button type="button" id="dismissBackup">Dismiss</button>`;
    bannerArea.appendChild(div);
    div.querySelector('#dismissBackup')?.addEventListener('click', ()=>{
      localStorage.setItem(BACKUP_REMINDER_KEY,'dismissed-'+(all.meta.lastExport||0));
      div.remove();
    });
  }
}

/* =============== CONTRAST CHECK =============== */
function runContrastCheck(){
  const settings=getSettings();
  const ratio=contrastRatio(settings.colors.primary, settings.colors.bg);
  const existing=document.getElementById('contrastWarn');
  if(ratio<4){
    if(!existing){
      const div=document.createElement('div');
      div.id='contrastWarn';
      div.className='notice-banner';
      div.innerHTML=`<span>Low contrast (ratio ${ratio.toFixed(2)}). Adjust accent or background.</span>
        <button type="button" id="dismissContrastWarn">Dismiss</button>`;
      document.getElementById('bannerArea')?.appendChild(div);
      div.querySelector('#dismissContrastWarn')?.addEventListener('click', ()=>div.remove());
    }
  } else if(existing){
    existing.remove();
  }
}
function contrastRatio(h1,h2){
  function lum(h){
    h=h.replace('#','');
    if(h.length===3) h=h.split('').map(c=>c+c).join('');
    const n=parseInt(h,16);
    const r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    const a=[r,g,b].map(v=>{
      v/=255;
      return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4);
    });
    return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2];
  }
  const L1=lum(h1)+0.05;
  const L2=lum(h2)+0.05;
  return L1>L2? L1/L2 : L2/L1;
}

/* =============== THEME VIBRANCY / AMBIENT =============== */
function applyVibrancy(){
  document.body.classList.toggle('reduce-vibrancy', !!uiPrefs.reduceVibrancy);
}
function applyAmbient(){
  document.body.classList.toggle('ambient-active', !!uiPrefs.ambient);
}

/* =============== DATE DEFAULTS =============== */
function ensureDateDefaults(){
  document.querySelectorAll('input[type="date"]').forEach(inp=>{
    if(!inp.value) inp.value=todayISO();
  });
}

/* =============== NAV INIT / SHORTCUTS =============== */
export function initNav(){
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn=>{
    btn.addEventListener('click', ()=>switchView(btn.dataset.view));
  });
  const year=document.getElementById('year');
  if(year) year.textContent=new Date().getFullYear();
  loadRecentProducts();
  initQuickModal();  // ensure available immediately
  initShortcuts();
}

function initShortcuts(){
  window.addEventListener('keydown', e=>{
    if(e.altKey){
      switch(e.key.toLowerCase()){
        case 'd': e.preventDefault(); switchView('dashboard'); break;
        case 's': e.preventDefault(); openQuickModal('sale'); break;
        case 'e': e.preventDefault(); openQuickModal('expense'); break;
        case 'p': e.preventDefault(); switchView('products'); break;
        case 'r': e.preventDefault(); switchView('recipes'); break;
        case 'i': e.preventDefault(); switchView('ingredients'); break;
        case 'x': e.preventDefault(); switchView('expenses'); break;
        case 'q': e.preventDefault(); const qm=document.getElementById('quickModal'); qm && !qm.hidden ? closeQuickModal(): openQuickModal('sale'); break;
      }
    }
    if(e.key==='Escape'){
      const modal=document.getElementById('quickModal');
      if(modal && !modal.hidden) closeQuickModal();
    }
  });
}

/* =============== AUTH / THEME INIT =============== */
export function initTheme(){
  const saved=localStorage.getItem('smallbatch-theme');
  if(saved==='light') document.body.classList.add('light');
  if(saved==='high-contrast') document.body.classList.add('high-contrast');
  document.getElementById('darkModeBtn')?.addEventListener('click', ()=>{
    document.body.classList.toggle('light');
    document.body.classList.remove('high-contrast');
    localStorage.setItem('smallbatch-theme',
      document.body.classList.contains('light')?'light':'dark');
  });
  document.getElementById('contrastBtn')?.addEventListener('click', ()=>{
    const hc=document.body.classList.toggle('high-contrast');
    if(hc) document.body.classList.remove('light');
    localStorage.setItem('smallbatch-theme',
      hc?'high-contrast':(document.body.classList.contains('light')?'light':'dark'));
  });
  applyVibrancy();
  applyAmbient();
}

function updateAuthBar(){
  const user=getActiveUser();
  const span=document.getElementById('authUser');
  const btn=document.getElementById('signOutBtn');
  if(!span||!btn) return;
  if(user){
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
    if(confirm('Sign out current user?')) signOut();
  });
  window.addEventListener('smallbatch-user-change', ()=>{
    ensureSettings(); applyTheme(getSettings()); render();
  });
}

/* EXPORT QUICK MODAL HANDLERS FOR OTHER MODULES IF NEEDED */
export { openQuickModal, closeQuickModal };