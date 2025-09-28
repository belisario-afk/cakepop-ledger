import { initNav, render, switchView, initTheme, initAuth } from './ui.js';
import { registerSW } from './pwa.js';
import './storage.js';
import { startAutoBackup } from './gist-backup.js';
import { initThemeApplication } from './theme.js';
import { ensureSettings, getSettings } from './user-settings.js';

window.addEventListener('DOMContentLoaded', ()=>{
  ensureSettings();
  initThemeApplication();
  initNav();
  initTheme();
  initAuth();
  // Re-apply after auth if user has custom settings
  switchView('dashboard');
  startAutoBackup();
  registerSW();
  // Ensure theme reapplied when returning from other views
  applyOnVisibility();
});

function applyOnVisibility(){
  document.addEventListener('visibilitychange', ()=>{
    if (!document.hidden) {
      // Re-apply theme in case user changed settings in another tab
      const { applyTheme } = awaitTheme();
    }
  });
}

function awaitTheme(){
  return {
    applyTheme: (settings = getSettings()) => import('./theme.js').then(m=>m.applyTheme(settings))
  };
}