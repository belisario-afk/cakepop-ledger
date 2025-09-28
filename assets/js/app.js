import { initNav, render, switchView, initTheme } from './ui.js';
import { registerSW } from './pwa.js';
import './storage.js';

window.addEventListener('DOMContentLoaded', ()=>{
  initNav();
  initTheme();
  switchView('dashboard');
  registerSW();
});