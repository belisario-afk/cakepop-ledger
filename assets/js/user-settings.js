/* Provided in last update; includes ambientAnimation */
import { loadData, persist } from './storage.js';

export function ensureSettings(){
  const d=loadData();
  if(!d.settings){
    d.settings=defaults();
    persist();
  } else {
    const def=defaults();
    d.settings.colors={...def.colors,(d.settings.colors||{})};
    d.settings.background={...def.background,(d.settings.background||{})};
    if(!('font' in d.settings)) d.settings.font='system';
    if(!('preset' in d.settings)) d.settings.preset='default';
    if(!('luxClass' in d.settings)) d.settings.luxClass='';
    if(!('ambientAnimation' in d.settings)) d.settings.ambientAnimation='off';
  }
  return d.settings;
}

function defaults(){
  return {
    storeName:'SmallBatch',
    tagline:'Sales • Costs • Ingredients',
    logoEmoji:'🧁',
    logoDataUrl:'',
    mode:'system',
    glass:'off',
    font:'system',
    preset:'default',
    luxClass:'',
    ambientAnimation:'off',
    colors:{ primary:'#0d9488', accent:'#10b09f', bg:'#0f1617', elev:'#1d2b2f' },
    background:{
      mode:'solid',
      solid:'#0f1617',
      gradient:'linear-gradient(135deg,#0d9488,#10b09f)',
      imageUrl:'',
      patternSeed:'',
      patternDataUrl:''
    }
  };
}

export function getSettings(){
  const d=loadData();
  return d.settings || ensureSettings();
}
export function saveSettings(s){
  const d=loadData();
  d.settings=s;
  persist();
}