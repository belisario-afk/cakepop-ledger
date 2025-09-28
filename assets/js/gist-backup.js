// GitHub Gist backup/restore utilities
// Requires user to supply PAT with "gist" scope.
// Stored in localStorage (risk accepted by user).

import { exportJson, importJson } from './storage.js';

const GIST_CFG_KEY = 'cakepop-gist-config';

export function loadGistConfig(){
  try {
    return JSON.parse(localStorage.getItem(GIST_CFG_KEY)) || { token:'', gistId:'', interval:0, lastBackup:0 };
  } catch {
    return { token:'', gistId:'', interval:0, lastBackup:0 };
  }
}

export function saveGistConfig(cfg){
  localStorage.setItem(GIST_CFG_KEY, JSON.stringify(cfg));
}

async function apiRequest(token, method, url, body){
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok){
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function backupToGist(){
  const cfg = loadGistConfig();
  if (!cfg.token) throw new Error('Token missing');
  const content = exportJson();
  const filename = 'cakepop-ledger.json';
  if (!cfg.gistId){
    // Create
    const body = {
      description: 'Cake Pop Ledger Backup',
      public: false,
      files: {
        [filename]: { content }
      }
    };
    const data = await apiRequest(cfg.token, 'POST', 'https://api.github.com/gists', body);
    cfg.gistId = data.id;
    cfg.lastBackup = Date.now();
    saveGistConfig(cfg);
    return { created:true, gistId:cfg.gistId };
  } else {
    // Update
    const body = {
      files: {
        [filename]: { content }
      }
    };
    const url = `https://api.github.com/gists/${cfg.gistId}`;
    await apiRequest(cfg.token, 'PATCH', url, body);
    cfg.lastBackup = Date.now();
    saveGistConfig(cfg);
    return { created:false, gistId:cfg.gistId };
  }
}

export async function restoreFromGist(){
  const cfg = loadGistConfig();
  if (!cfg.token || !cfg.gistId) throw new Error('Token or gistId missing');
  const url = `https://api.github.com/gists/${cfg.gistId}`;
  const data = await apiRequest(cfg.token, 'GET', url);
  const file = data.files['cakepop-ledger.json'];
  if (!file) throw new Error('File cakepop-ledger.json not found in gist');
  importJson(JSON.parse(file.content));
  return true;
}

let autoTimer = null;

export function startAutoBackup(){
  const cfg = loadGistConfig();
  stopAutoBackup();
  if (!cfg.interval || cfg.interval <= 0) return;
  autoTimer = setInterval(()=>{
    backupToGist().catch(e=>console.warn('Auto backup failed', e));
  }, cfg.interval * 60000);
}

export function stopAutoBackup(){
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}