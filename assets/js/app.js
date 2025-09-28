import { initNav, render, switchView, initTheme, initAuth } from './ui.js';
import { registerSW } from './pwa.js';
import './storage.js'; // ensures load
import { startAutoBackup } from './gist-backup.js';

window.addEventListener('DOMContentLoaded', ()=>{
  initNav();
  initTheme();
  initAuth();
  switchView('dashboard');
  startAutoBackup();
  registerSW();
});