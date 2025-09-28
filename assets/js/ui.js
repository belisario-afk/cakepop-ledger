/* Excerpt: Only settings-related modifications for ambientAnimation + preview.
   Replace your existing ui.js with this full file if you want a clean sync. */

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
import {
  applyTheme, previewTheme, generatePattern, resetThemeToDefault, updatePreviewCard,
  mergePresetIntoSettings, tempApplyPreset, exportThemeOnly, importThemeObject
} from './theme.js';
import { initParallax } from './parallax.js';

let currentView='dashboard';
const viewContainer=()=>document.getElementById('viewContainer');

export function switchView(view){
  currentView=view;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  document.querySelectorAll('.bottom-nav .nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  render();
}

export function render(){
  const tpl=document.getElementById(`tpl-${currentView}`);
  if(!tpl){ viewContainer().innerHTML='<p>View not found.</p>'; return; }
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
  const sales=getSales();
  const expenses=getExpenses();
  const m=computeMetrics(sales, expenses);
  setText('m-revenue', fmtMoney(m.revenue));
  setText('m-cogs', fmtMoney(m.cogs));
  setText('m-gross', fmtMoney(m.gross));
  setText('m-net', fmtMoney(m.net));
  setText('m-margin', m.margin.toFixed(1)+'%');
  setText('m-aov', fmtMoney(m.aov));
  lineChart(document.getElementById('chartRevenue'), dailyRevenueSeries(30));
  const ul=document.getElementById('topFlavors');
  if(ul){
    ul.innerHTML='';
    topProducts().forEach(p=>{
      const li=document.createElement('li');
      li.textContent=`${p.name} — ${p.qty} pcs`;
      ul.appendChild(li);
    });
  }
}

/* (Other fill/bind functions unchanged from earlier revision – omitted for brevity) */
/* ... Keep your previous implementations for products, ingredients, recipes, sales, expenses, data ... */

/* SETTINGS */
function bindSettings(){
  const settings=ensureSettings();
  applyTheme(settings);

  // Profile
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

  // Theme
  const tForm=document.getElementById('themeForm');
  if(!tForm) return;

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
  tForm.ambient.value=settings.ambientAnimation||'off';

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
    patternSeed:tForm.patternSeed.value,
    ambient:tForm.ambient.value
  });

  document.getElementById('applyPresetBtn')?.addEventListener('click', ()=>{
    const name=tForm.preset.value;
    if(!name){ alert('Select a preset.'); return; }
    mergePresetIntoSettings(name, settings);
    saveSettings(settings);
    applyTheme(settings);
    updatePreviewCard(settings);
    // refresh fields
    tForm.primaryColor.value=settings.colors.primary;
    tForm.accentColor.value=settings.colors.accent;
    tForm.bgColor.value=settings.colors.bg;
    tForm.elevColor.value=settings.colors.elev;
    tForm.bgStyle.value=settings.background.mode;
    tForm.gradientValue.value=settings.background.gradient;
    tForm.imageUrl.value=settings.background.imageUrl;
    tForm.patternSeed.value=settings.background.patternSeed;
    tForm.font.value=settings.font;
    tForm.ambient.value=settings.ambientAnimation||'off';
    alert('Preset applied (not all changes saved unless you click Save Theme).');
  });

  document.getElementById('previewPresetBtn')?.addEventListener('click', ()=>{
    const p=tForm.preset.value;
    if(!p){ alert('Select a preset first.'); return; }
    tempApplyPreset(p);
    alert('Preset previewed.');
  });

  document.getElementById('previewThemeBtn')?.addEventListener('click', ()=>{
    previewTheme(collect());
    alert('Theme preview applied (not saved).');
  });

  document.getElementById('genPatternBtn')?.addEventListener('click', ()=>{
    const vals=collect();
    const dataUrl=generatePattern(vals.patternSeed||Date.now().toString(), vals.primaryColor, vals.accentColor);
    settings.background.patternDataUrl=dataUrl;
    const clone=structuredClone(settings);
    clone.background.mode='pattern';
    clone.background.patternDataUrl=dataUrl;
    updatePreviewCard(clone);
    applyTheme(clone);
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
    settings.ambientAnimation=vals.ambient;
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
    if(confirm('Reset theme & profile to defaults?')){
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
        tForm.ambient.value=obj.ambientAnimation||'off';
        alert('Theme imported.');
      } catch(err){ alert('Invalid theme file.'); }
    };
    reader.readAsText(file);
  });

  updatePreviewCard(settings);
}

/* Helpers & Other existing functions (products, sales, etc.) remain the same as your last working version */

function ensureDateDefaults(){
  document.querySelectorAll('input[type="date"]').forEach(inp=>{
    if(!inp.value) inp.value=todayISO();
  });
}
function setText(id,val){ const el=document.getElementById(id); if(el) el.textContent=val; }

export function initNav(){
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn=>{
    btn.addEventListener('click', ()=>switchView(btn.dataset.view));
  });
  const year=document.getElementById('year'); if(year) year.textContent=new Date().getFullYear();
}
export function initTheme(){
  const saved=localStorage.getItem('smallbatch-theme');
  if (saved==='light') document.body.classList.add('light');
  if (saved==='high-contrast') document.body.classList.add('high-contrast');
  document.getElementById('darkModeBtn')?.addEventListener('click', ()=>{
    document.body.classList.toggle('light');
    document.body.classList.remove('high-contrast');
    localStorage.setItem('smallbatch-theme', document.body.classList.contains('light')?'light':'dark');
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