// Extended theme management with presets, typography & pattern export/import

import { getSettings, saveSettings } from './user-settings.js';

const FONT_MAP = {
  system: { class: '', link: null },
  modern: { class: 'font-modern', link: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
  serif:  { class: 'font-serif', link: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;600;700&display=swap' },
  rounded:{ class: 'font-rounded', link: 'https://fonts.googleapis.com/css2?family=Nunito+Rounded:wght@400;600;700&display=swap' }
};

const PRESETS = {
  default: {
    colors:{ primary:'#0d9488', accent:'#10b09f', bg:'#0f1617', elev:'#1d2b2f' },
    background:{ mode:'solid', solid:'#0f1617', gradient:'linear-gradient(135deg,#0d9488,#10b09f)', imageUrl:'', patternSeed:'', patternDataUrl:'' },
    glass:'off', mode:'system', font:'system'
  },
  gold: {
    colors:{ primary:'#c79a3d', accent:'#e7c16a', bg:'#12100c', elev:'#1e1a12' },
    background:{ mode:'gradient', solid:'#12100c', gradient:'linear-gradient(135deg,#2a2117,#584023)', imageUrl:'', patternSeed:'golden', patternDataUrl:'' },
    glass:'on', mode:'dark', font:'serif', luxClass:'lux-gold'
  },
  noir: {
    colors:{ primary:'#4f4f55', accent:'#6b6b72', bg:'#0b0b0d', elev:'#16161a' },
    background:{ mode:'solid', solid:'#0b0b0d', gradient:'linear-gradient(135deg,#141418,#2a2a30)', imageUrl:'', patternSeed:'noir', patternDataUrl:'' },
    glass:'off', mode:'dark', font:'modern', luxClass:'lux-noir'
  },
  rose: {
    colors:{ primary:'#d35b85', accent:'#e17099', bg:'#1a1014', elev:'#28181e' },
    background:{ mode:'gradient', solid:'#1a1014', gradient:'linear-gradient(140deg,#2d1a22,#5a2d3d)', imageUrl:'', patternSeed:'rose', patternDataUrl:'' },
    glass:'on', mode:'dark', font:'rounded', luxClass:'lux-rose'
  },
  emerald: {
    colors:{ primary:'#0f9d58', accent:'#13b069', bg:'#0c1310', elev:'#15231c' },
    background:{ mode:'gradient', solid:'#0c1310', gradient:'linear-gradient(140deg,#13251c,#1f3b2e)', imageUrl:'', patternSeed:'emerald', patternDataUrl:'' },
    glass:'on', mode:'dark', font:'modern', luxClass:'lux-emerald'
  }
};

export function listPresetNames(){
  return Object.keys(PRESETS);
}

export function getPreset(name){
  return PRESETS[name] ? structuredClone(PRESETS[name]) : null;
}

export function mergePresetIntoSettings(presetName, settings){
  const p = getPreset(presetName);
  if (!p) return settings;
  settings.colors = { ...settings.colors, ...p.colors };
  settings.background = { ...settings.background, ...p.background };
  settings.glass = p.glass;
  settings.mode = p.mode;
  settings.font = p.font;
  settings.preset = presetName;
  settings.luxClass = p.luxClass || '';
  return settings;
}

export function applyTheme(settings){
  if (!settings) return;
  const { storeName, tagline, colors, background, glass, logoEmoji, logoDataUrl, font, luxClass } = settings;

  // Brand text
  safeSetText('brandName', storeName || 'SmallBatch');
  safeSetText('footerBrand', storeName || 'SmallBatch');
  safeSetText('brandTagline', tagline || 'Sales • Costs • Ingredients');

  // Logo
  const img = document.getElementById('logoImage');
  const emoji = document.getElementById('logoEmoji');
  if (logoDataUrl) {
    img.src = logoDataUrl; img.style.display='block'; emoji.style.display='none';
  } else {
    img.style.display='none'; emoji.style.display='block'; emoji.textContent = logoEmoji || '🧁';
  }

  // Colors
  const root = document.documentElement;
  if (colors) {
    root.style.setProperty('--color-accent', colors.primary);
    root.style.setProperty('--color-accent-hover', colors.accent);
    root.style.setProperty('--color-bg', colors.bg);
    root.style.setProperty('--color-elev', colors.elev);
    root.style.setProperty('--color-accent-soft', hexToRgba(colors.primary, 0.18));
    const meta = document.getElementById('metaThemeColor');
    if (meta) meta.setAttribute('content', colors.primary);
  }

  // Background
  applyBackground(background, colors);

  // Glass
  document.body.classList.toggle('glass-enabled', glass === 'on');

  // Mode (light/dark override only if explicit)
  if (settings.mode === 'light') document.body.classList.add('light');
  else if (settings.mode === 'dark') document.body.classList.remove('light');

  // Typography
  applyFontClass(font);

  // Luxury class (remove any others first)
  ['lux-gold','lux-noir','lux-rose','lux-emerald'].forEach(c=>document.body.classList.remove(c));
  if (luxClass) document.body.classList.add(luxClass);
}

function applyBackground(bg, colors){
  if (!bg) return;
  const root = document.documentElement;
  if (bg.mode === 'solid') {
    root.style.setProperty('--app-background', bg.solid || colors?.bg || '#0f1617');
  } else if (bg.mode === 'gradient') {
    root.style.setProperty('--app-background', bg.gradient || 'linear-gradient(135deg,#0d9488,#10b09f)');
  } else if (bg.mode === 'image') {
    root.style.setProperty('--app-background', `url('${(bg.imageUrl||'').replace(/'/g,"%27")}')`);
  } else if (bg.mode === 'pattern') {
    if (bg.patternDataUrl) root.style.setProperty('--app-background', `url('${bg.patternDataUrl}')`);
    else root.style.setProperty('--app-background', colors?.bg || '#0f1617');
  }
}

function applyFontClass(fontKey){
  Object.values(FONT_MAP).forEach(cfg=>{
    if (cfg.class) document.body.classList.remove(cfg.class);
  });
  const cfg = FONT_MAP[fontKey] || FONT_MAP.system;
  if (cfg.class) document.body.classList.add(cfg.class);
  injectFontLink(cfg.link);
}

function injectFontLink(href){
  if (!href) return;
  const id='dynamicFontLink';
  let el=document.getElementById(id);
  if (el && el.href===href) return;
  if (el) el.remove();
  el=document.createElement('link');
  el.id=id; el.rel='stylesheet'; el.href=href;
  document.head.appendChild(el);
}

function safeSetText(id,text){
  const el=document.getElementById(id);
  if (el) el.textContent=text;
}

function hexToRgba(hex, alpha=1){
  const h = hex.replace('#','');
  const full = h.length===3 ? h.split('').map(c=>c+c).join('') : h;
  const n = parseInt(full,16);
  const r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Pattern generator reused from previous version (slightly tuned)
export function generatePattern(seedStr, primary='#0d9488', accent='#10b09f') {
  const seed = hash(seedStr || (Date.now()+'')) & 0xffffffff;
  const size = 420;
  const cell = 24;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0f11';
  ctx.fillRect(0,0,size,size);

  for (let y=0;y<size;y+=cell){
    for (let x=0;x<size;x+=cell){
      const r = pseudoRandom(seed + x*73856093 + y*19349663);
      if (r > 0.62) {
        const grad = ctx.createLinearGradient(x,y,x+cell,y+cell);
        grad.addColorStop(0, blend(primary, accent, r*0.5));
        grad.addColorStop(1, blend(accent, primary, 1-r*0.5));
        ctx.fillStyle = grad;
        const inset = (r*0.6)*cell*0.25;
        ctx.beginPath();
        const rx = 4 + (r*5);
        roundRect(ctx, x+inset, y+inset, cell - inset*2, cell - inset*2, rx);
        ctx.fill();
      } else if (r < 0.08) {
        ctx.fillStyle = hexToRgba(primary, 0.12);
        ctx.fillRect(x,y,cell,cell);
      }
    }
  }
  ctx.fillStyle='rgba(255,255,255,0.03)';
  ctx.fillRect(0,0,size,size);
  return c.toDataURL('image/png');
}

function hash(str){ let h=0; for(let i=0;i<str.length;i++){h=(h<<5)-h+str.charCodeAt(i); h|=0;} return h; }
function pseudoRandom(n){ const x=Math.sin(n)*10000; return x - Math.floor(x); }
function blend(a,b,t){
  const pa=hexToRgb(a), pb=hexToRgb(b);
  const r=Math.round(pa.r+(pb.r-pa.r)*t);
  const g=Math.round(pa.g+(pb.g-pa.g)*t);
  const bl=Math.round(pa.b+(pb.b-pa.b)*t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(h){
  h=h.replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join('');
  const n=parseInt(h,16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}
function roundRect(ctx,x,y,w,h,r){
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

export function previewTheme(formValues) {
  const live = structuredClone(getSettings());
  Object.assign(live.colors, {
    primary: formValues.primaryColor,
    accent: formValues.accentColor,
    bg: formValues.bgColor,
    elev: formValues.elevColor
  });
  live.mode = formValues.mode;
  live.glass = formValues.glass;
  live.font = formValues.font;
  live.background.mode = formValues.bgStyle;
  live.background.gradient = formValues.gradientValue;
  live.background.imageUrl = formValues.imageUrl;
  live.background.patternSeed = formValues.patternSeed;
  if (formValues.bgStyle === 'pattern') {
    live.background.patternDataUrl = generatePattern(formValues.patternSeed || Date.now().toString(), formValues.primaryColor, formValues.accentColor);
  } else {
    live.background.patternDataUrl = '';
  }
  if (formValues.preset) mergePresetIntoSettings(formValues.preset, live);
  applyTheme(live);
  updatePreviewCard(live);
}

export function updatePreviewCard(settings){
  const preview = document.getElementById('themePreview');
  if (!preview) return;
  const bg = settings.background;
  if (bg.mode === 'gradient') preview.style.setProperty('--preview-bg', bg.gradient);
  else if (bg.mode === 'image') preview.style.setProperty('--preview-bg', `url('${bg.imageUrl||''}')`);
  else if (bg.mode === 'pattern') preview.style.setProperty('--preview-bg', `url('${bg.patternDataUrl||''}')`);
  else preview.style.setProperty('--preview-bg', settings.colors.bg);
  preview.style.setProperty('--preview-overlay', settings.glass==='on' ? 'rgba(255,255,255,0.05)' : 'transparent');
}

export function initThemeApplication() {
  const settings = getSettings();
  applyTheme(settings);
  updatePreviewCard(settings);
}

export function resetThemeToDefault() {
  const def = structuredClone(getPreset('default'));
  const existing = getSettings();
  const merged = {
    storeName: 'SmallBatch',
    tagline: 'Sales • Costs • Ingredients',
    logoEmoji: '🧁',
    logoDataUrl: '',
    ...def,
    preset:'default',
    luxClass:def.luxClass||''
  };
  saveSettings({ ...existing, ...merged });
  applyTheme(merged);
}

export function exportThemeOnly(){
  const s = getSettings();
  const themeSubset = {
    storeName: s.storeName,
    tagline: s.tagline,
    logoEmoji: s.logoEmoji,
    logoDataUrl: s.logoDataUrl,
    colors: s.colors,
    background: s.background,
    glass: s.glass,
    mode: s.mode,
    font: s.font,
    preset: s.preset||'custom',
    luxClass: s.luxClass||''
  };
  return JSON.stringify(themeSubset, null, 2);
}

export function importThemeObject(obj){
  const s = getSettings();
  const merged = { ...s, ...obj };
  saveSettings(merged);
  applyTheme(merged);
  updatePreviewCard(merged);
}

/* Utility to apply preset quickly without saving */
export function tempApplyPreset(name){
  const s = structuredClone(getSettings());
  mergePresetIntoSettings(name, s);
  applyTheme(s);
  updatePreviewCard(s);
  return s;
}