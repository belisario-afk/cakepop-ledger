// Theme personalization utilities

import { getSettings, saveSettings } from './user-settings.js';

// Apply settings to document (CSS variables, brand, logo, background, modes)
export function applyTheme(settings) {
  if (!settings) return;
  const {
    storeName, tagline, colors, background, glass, logoEmoji, logoDataUrl
  } = settings;

  // Update brand text
  const nameEl = document.getElementById('brandName');
  const tagEl = document.getElementById('brandTagline');
  const footBrand = document.getElementById('footerBrand');
  if (nameEl) nameEl.textContent = storeName || 'SmallBatch';
  if (footBrand) footBrand.textContent = storeName || 'SmallBatch';
  if (tagEl) tagEl.textContent = tagline || 'Sales • Costs • Ingredients';

  // Logo handling
  const img = document.getElementById('logoImage');
  const emoji = document.getElementById('logoEmoji');
  if (logoDataUrl) {
    img.src = logoDataUrl;
    img.style.display = 'block';
    emoji.style.display = 'none';
  } else {
    img.style.display = 'none';
    emoji.style.display = 'block';
    emoji.textContent = logoEmoji || '🧁';
  }

  // Dynamic color variables
  const root = document.documentElement;
  if (colors) {
    if (colors.primary) root.style.setProperty('--color-accent', colors.primary);
    if (colors.accent) root.style.setProperty('--color-accent-hover', colors.accent);
    if (colors.bg) root.style.setProperty('--color-bg', colors.bg);
    if (colors.elev) root.style.setProperty('--color-elev', colors.elev);
    // Adjust derived soft accent
    root.style.setProperty('--color-accent-soft', hexToRgba(colors.primary || '#0d9488', 0.18));
    // Update meta theme-color
    const meta = document.getElementById('metaThemeColor');
    if (meta) meta.setAttribute('content', colors.primary || '#0d9488');
  }

  // Mode forcing
  document.body.classList.remove('light-forced','dark-forced');
  if (settings.mode === 'light') document.body.classList.add('light');
  else if (settings.mode === 'dark') document.body.classList.remove('light');
  // (system inherits existing class toggles)

  // Glass
  if (glass === 'on') document.body.classList.add('glass-enabled');
  else document.body.classList.remove('glass-enabled');

  // Background
  applyBackground(background);
}

function applyBackground(bg) {
  if (!bg) return;
  const root = document.documentElement;
  if (bg.mode === 'solid') {
    root.style.setProperty('--app-background', bg.solid || 'var(--color-bg)');
  } else if (bg.mode === 'gradient') {
    root.style.setProperty('--app-background', bg.gradient || 'linear-gradient(135deg,#0d9488,#10b09f)');
  } else if (bg.mode === 'image') {
    root.style.setProperty('--app-background', `url('${(bg.imageUrl||'').replace(/'/g,"%27")}')`);
  } else if (bg.mode === 'pattern') {
    if (bg.patternDataUrl) {
      root.style.setProperty('--app-background', `url('${bg.patternDataUrl}')`);
    } else {
      root.style.setProperty('--app-background', 'var(--color-bg)');
    }
  }
}

// Generate pattern data URL (geometric squares)
export function generatePattern(seedStr, primary='#0d9488', accent='#10b09f') {
  const seed = hash(seedStr || (Date.now()+'')) & 0xffffffff;
  const size = 340;
  const cell = 20;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0d0f10';
  ctx.fillRect(0,0,size,size);

  for (let y=0;y<size;y+=cell){
    for (let x=0;x<size;x+=cell){
      const r = pseudoRandom(seed + x*73856093 + y*19349663);
      if (r > 0.62) {
        const grad = ctx.createLinearGradient(x,y,x+cell,y+cell);
        grad.addColorStop(0, blend(primary, accent, r*0.5));
        grad.addColorStop(1, blend(accent, primary, 1-r*0.5));
        ctx.fillStyle = grad;
        const inset = (r*0.6)*cell*0.3;
        const rx = 3 + (r*4);
        roundRect(ctx, x+inset, y+inset, cell - inset*2, cell - inset*2, rx);
        ctx.fill();
      } else if (r < 0.08) {
        ctx.fillStyle = hexToRgba(primary, 0.12);
        ctx.fillRect(x,y,cell,cell);
      }
    }
  }
  // subtle overlay
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(0,0,size,size);

  return c.toDataURL('image/png');
}

// Utility functions
function hash(str){
  let h=0; for (let i=0;i<str.length;i++){h=(h<<5)-h+str.charCodeAt(i); h|=0;} return h;
}
function pseudoRandom(n){
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}
function hexToRgba(hex, alpha=1){
  const h = hex.replace('#','');
  const bigint = parseInt(h.length===3? h.split('').map(c=>c+c).join(''):h,16);
  const r = (bigint>>16)&255;
  const g = (bigint>>8)&255;
  const b = bigint&255;
  return `rgba(${r},${g},${b},${alpha})`;
}
function blend(a,b,t){
  // simple blend between two hex colors
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
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

export function initThemeApplication() {
  // Apply as soon as loaded
  const settings = getSettings();
  applyTheme(settings);
}

// Hook for live preview (without saving)
export function previewTheme(formValues) {
  const clone = structuredClone(getSettings() || {});
  Object.assign(clone.colors, {
    primary: formValues.primaryColor,
    accent: formValues.accentColor,
    bg: formValues.bgColor,
    elev: formValues.elevColor
  });
  clone.mode = formValues.mode;
  clone.glass = formValues.glass;
  clone.background.mode = formValues.bgStyle;
  clone.background.gradient = formValues.gradientValue;
  clone.background.imageUrl = formValues.imageUrl;
  clone.background.patternSeed = formValues.patternSeed;
  if (formValues.bgStyle === 'pattern') {
    clone.background.patternDataUrl = generatePattern(formValues.patternSeed, formValues.primaryColor, formValues.accentColor);
  } else {
    clone.background.patternDataUrl = '';
  }
  applyTheme(clone);
  updatePreviewCard(clone);
}

export function updatePreviewCard(settings){
  const preview = document.getElementById('themePreview');
  if (!preview) return;
  if (settings.background.mode === 'gradient') {
    preview.style.setProperty('--preview-bg', settings.background.gradient || 'linear-gradient(135deg,#0d9488,#10b09f)');
  } else if (settings.background.mode === 'image') {
    preview.style.setProperty('--preview-bg', `url('${settings.background.imageUrl||''}')`);
  } else if (settings.background.mode === 'pattern') {
    preview.style.setProperty('--preview-bg', `url('${settings.background.patternDataUrl||''}')`);
  } else {
    preview.style.setProperty('--preview-bg', settings.colors.bg || 'var(--color-bg)');
  }
  preview.style.setProperty('--preview-overlay', settings.glass==='on' ? 'rgba(255,255,255,0.05)' : 'transparent');
}

export function resetThemeToDefault() {
  const def = {
    storeName: 'SmallBatch',
    tagline: 'Sales • Costs • Ingredients',
    logoEmoji: '🧁',
    logoDataUrl: '',
    mode: 'system',
    glass: 'off',
    colors: {
      primary:'#0d9488',
      accent:'#10b09f',
      bg:'#0f1617',
      elev:'#1d2b2f'
    },
    background:{
      mode:'solid',
      solid:'#0f1617',
      gradient:'linear-gradient(135deg,#0d9488,#10b09f)',
      imageUrl:'',
      patternSeed:''
    }
  };
  saveSettings(def);
  applyTheme(def);
}