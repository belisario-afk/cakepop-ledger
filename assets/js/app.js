import { initNav, render, switchView, initTheme, initAuth } from './ui.js';
import { registerSW } from './pwa.js';
import './storage.js';
import { startAutoBackup } from './gist-backup.js';
import { initThemeApplication } from './theme.js';
import { ensureSettings } from './user-settings.js';

window.addEventListener('DOMContentLoaded', ()=>{
  ensureSettings();
  initThemeApplication();
  initNav();
  initTheme();
  initAuth();  // must exist in ui.js
  switchView('dashboard');
  startAutoBackup();
  registerSW();
});