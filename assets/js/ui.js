import { getActiveUser, signOut, initGoogleSignIn } from './auth.js';
import { applyTheme } from './theme.js';
import { ensureSettings, getSettings } from './user-settings.js';

let currentView = 'dashboard';

export function initNav(){
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn=>{
    btn.addEventListener('click', ()=>switchView(btn.dataset.view));
  });
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
}

export function switchView(view){
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  render();
}

export function render(){
  // Insert your template handling here – omitted for brevity
  updateAuthBar();
}

export function initTheme(){
  // Light / contrast buttons (simplified)
  document.getElementById('darkModeBtn')?.addEventListener('click', ()=>{
    document.body.classList.toggle('light');
  });
  document.getElementById('contrastBtn')?.addEventListener('click', ()=>{
    document.body.classList.toggle('high-contrast');
  });
}

function updateAuthBar(){
  const user = getActiveUser();
  const span = document.getElementById('authUser');
  const btn = document.getElementById('signOutBtn');
  if (!span || !btn) return;
  if (user){
    span.textContent = user.name || user.email;
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
    if (confirm('Sign out?')) signOut();
  });

  window.addEventListener('smallbatch-user-change', ()=>{
    ensureSettings();
    applyTheme(getSettings());
    render();
  });
}
