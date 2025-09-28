/* Only the new/modified SETTINGS-related parts appended & parallax init integration shown.
   Keep all existing logic from previous ui.js version, then apply these changes:
*/
import { tempApplyPreset, getPreset, exportThemeOnly, importThemeObject, generatePattern, previewTheme } from './theme.js';
import { downloadBlob } from './utils.js';
import { getSettings, saveSettings, ensureSettings } from './user-settings.js';
import { initParallax } from './parallax.js';
import { mergePresetIntoSettings } from './theme.js';

// (Within render(), AFTER building the DOM)
export function render(){
  // ... existing render logic ...
  if (currentView==='settings') { bindSettings(); }
  // ...
  initParallax();
}

// Add / replace the bindSettings function with this extended version:
function bindSettings(){
  const settings = ensureSettings();

  // PROFILE
  const profileForm = document.getElementById('storeProfileForm');
  if (profileForm){
    profileForm.storeName.value = settings.storeName || '';
    profileForm.tagline.value = settings.tagline || '';
    profileForm.logoEmoji.value = settings.logoEmoji || '🧁';
    profileForm.addEventListener('submit', e=>{
      e.preventDefault();
      const fd = new FormData(profileForm);
      settings.storeName = fd.get('storeName').trim() || 'SmallBatch';
      settings.tagline = fd.get('tagline').trim() || 'Sales • Costs • Ingredients';
      settings.logoEmoji = fd.get('logoEmoji').trim() || '🧁';
      const file = fd.get('logoFile');
      if (file && file.size){
        const reader = new FileReader();
        reader.onload = () => {
          settings.logoDataUrl = reader.result;
          saveSettings(settings);
          import('./theme.js').then(m=>m.applyTheme(settings));
          alert('Profile saved.');
        };
        reader.readAsDataURL(file);
      } else {
        saveSettings(settings);
        import('./theme.js').then(m=>m.applyTheme(settings));
        alert('Profile saved.');
      }
    });
  }

  // THEME
  const tForm = document.getElementById('themeForm');
  if (!tForm) return;
  tForm.primaryColor.value = settings.colors.primary;
  tForm.accentColor.value = settings.colors.accent;
  tForm.bgColor.value = settings.colors.bg;
  tForm.elevColor.value = settings.colors.elev;
  tForm.mode.value = settings.mode || 'system';
  tForm.glass.value = settings.glass || 'off';
  tForm.bgStyle.value = settings.background.mode;
  tForm.gradientValue.value = settings.background.gradient || '';
  tForm.imageUrl.value = settings.background.imageUrl || '';
  tForm.patternSeed.value = settings.background.patternSeed || '';
  tForm.font.value = settings.font || 'system';
  tForm.preset.value = settings.preset || '';

  const collect = () => ({
    preset: tForm.preset.value,
    primaryColor: tForm.primaryColor.value,
    accentColor: tForm.accentColor.value,
    bgColor: tForm.bgColor.value,
    elevColor: tForm.elevColor.value,
    mode: tForm.mode.value,
    glass: tForm.glass.value,
    font: tForm.font.value,
    bgStyle: tForm.bgStyle.value,
    gradientValue: tForm.gradientValue.value,
    imageUrl: tForm.imageUrl.value,
    patternSeed: tForm.patternSeed.value
  });

  document.getElementById('applyPresetBtn')?.addEventListener('click', ()=>{
    const name = tForm.preset.value;
    if (!name){ alert('Select a preset first.'); return; }
    const preset = getPreset(name);
    if (!preset){ alert('Preset not found.'); return; }
    // Merge preset into current settings
    mergePresetIntoSettings(name, settings);
    saveSettings(settings);
    import('./theme.js').then(m=>{
      m.applyTheme(settings);
      m.updatePreviewCard(settings);
    });
    // Refresh form fields
    tForm.primaryColor.value = settings.colors.primary;
    tForm.accentColor.value = settings.colors.accent;
    tForm.bgColor.value = settings.colors.bg;
    tForm.elevColor.value = settings.colors.elev;
    tForm.bgStyle.value = settings.background.mode;
    tForm.gradientValue.value = settings.background.gradient;
    tForm.imageUrl.value = settings.background.imageUrl;
    tForm.patternSeed.value = settings.background.patternSeed;
    tForm.font.value = settings.font;
    alert('Preset applied (remember to Save Theme if you tweak further).');
  });

  document.getElementById('previewPresetBtn')?.addEventListener('click', ()=>{
    const name = tForm.preset.value;
    if (!name){ alert('Select a preset.'); return; }
    tempApplyPreset(name);
    alert('Preset previewed (not saved).');
  });

  document.getElementById('previewThemeBtn')?.addEventListener('click', ()=>{
    previewTheme(collect());
    alert('Theme preview applied (not saved).');
  });

  document.getElementById('genPatternBtn')?.addEventListener('click', ()=>{
    const vals = collect();
    const { generatePattern, updatePreviewCard } = requireTheme();
    const dataUrl = generatePattern(vals.patternSeed || Date.now().toString(), vals.primaryColor, vals.accentColor);
    settings.background.patternDataUrl = dataUrl;
    const previewClone = structuredClone(settings);
    previewClone.background.mode = 'pattern';
    previewClone.background.patternDataUrl = dataUrl;
    updatePreviewCard(previewClone);
    import('./theme.js').then(m=>m.applyTheme(previewClone));
    alert('Pattern generated (Preview). Save Theme to persist or export theme.');
  });

  tForm.addEventListener('submit', e=>{
    e.preventDefault();
    const vals = collect();
    settings.colors.primary = vals.primaryColor;
    settings.colors.accent = vals.accentColor;
    settings.colors.bg = vals.bgColor;
    settings.colors.elev = vals.elevColor;
    settings.mode = vals.mode;
    settings.glass = vals.glass;
    settings.font = vals.font;
    settings.preset = vals.preset || 'custom';
    settings.background.mode = vals.bgStyle;
    settings.background.gradient = vals.gradientValue;
    settings.background.imageUrl = vals.imageUrl;
    settings.background.patternSeed = vals.patternSeed;
    if (vals.bgStyle === 'pattern'){
      settings.background.patternDataUrl = settings.background.patternDataUrl
        || generatePattern(vals.patternSeed || Date.now().toString(), vals.primaryColor, vals.accentColor);
    } else {
      settings.background.patternDataUrl = '';
    }
    saveSettings(settings);
    import('./theme.js').then(m=>{
      m.applyTheme(settings);
      m.updatePreviewCard(settings);
    });
    alert('Theme saved.');
  });

  document.getElementById('resetThemeBtn')?.addEventListener('click', ()=>{
    if (confirm('Reset theme & profile to default?')){
      import('./theme.js').then(m=>{
        m.resetThemeToDefault();
        location.reload();
      });
    }
  });

  // Export theme only
  document.getElementById('exportThemeBtn')?.addEventListener('click', ()=>{
    import('./theme.js').then(m=>{
      const json = m.exportThemeOnly();
      downloadBlob(json, 'smallbatch-theme.json');
    });
  });

  // Import theme only
  document.getElementById('importThemeInput')?.addEventListener('change', e=>{
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try {
        const obj = JSON.parse(reader.result);
        importThemeObject(obj);
        // Re-sync form fields
        tForm.primaryColor.value = obj.colors.primary;
        tForm.accentColor.value = obj.colors.accent;
        tForm.bgColor.value = obj.colors.bg;
        tForm.elevColor.value = obj.colors.elev;
        tForm.bgStyle.value = obj.background.mode;
        tForm.gradientValue.value = obj.background.gradient;
        tForm.imageUrl.value = obj.background.imageUrl;
        tForm.patternSeed.value = obj.background.patternSeed;
        tForm.font.value = obj.font || 'system';
        tForm.preset.value = obj.preset || '';
        alert('Theme imported & applied.');
      } catch(err){
        alert('Invalid theme preset file.');
      }
    };
    reader.readAsText(file);
  });
}

function requireTheme(){
  return {
    generatePattern:(...a)=>import('./theme.js').then(m=>m.generatePattern(...a)),
    updatePreviewCard:(...a)=>import('./theme.js').then(m=>m.updatePreviewCard(...a))
  };
}