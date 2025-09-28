// Separate module to handle user personalization settings
import { loadData, persist } from './storage.js';

export function ensureSettings() {
  const d = loadData();
  if (!d.settings) {
    d.settings = {
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
        patternSeed:'',
        patternDataUrl:''
      }
    };
    persist();
  }
  return d.settings;
}

export function getSettings() {
  const d = loadData();
  return d.settings || ensureSettings();
}

export function saveSettings(newSettings){
  const d = loadData();
  d.settings = newSettings;
  persist();
}