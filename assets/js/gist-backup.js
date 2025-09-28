import { exportJson, importJson } from './storage.js';

const GIST_CFG_KEY_NEW = 'smallbatch-gist-config';
const GIST_CFG_KEY_OLD = 'cakepop-gist-config';

export function loadGistConfig(){
  try {
    let cfg = JSON.parse(localStorage.getItem(GIST_CFG_KEY_NEW));
    if (!cfg){
      const legacy = localStorage.getItem(GIST_CFG_KEY_OLD);
      if (legacy) {
        cfg = JSON.parse(legacy);
        localStorage.setItem(GIST_CFG_KEY_NEW, JSON.stringify(cfg));
      }
    }
    return cfg || { token:'', gistId:'', interval:0, lastBackup:0 };
  } catch {
    return { token:'', gistId:'', interval:0, lastBackup:0 };
  }
}

export function saveGistConfig(cfg){
  localStorage.setItem(GIST_CFG_KEY_NEW, JSON.stringify(cfg));
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
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function backupToGist(){
  const cfg = loadGistConfig();
  if (!cfg.token) throw new Error('Token missing');
  const content = exportJson();
  const filename = 'smallbatch-ledger.json';
  if (!cfg.gistId){
    const body = {
      description: 'SmallBatch Backup',
      public: false,
      files: { [filename]: { content } }
    };
    const data = await apiRequest(cfg.token, 'POST', 'https://api.github.com/gists', body);
    cfg.gistId = data.id;
    cfg.lastBackup = Date.now();
    saveGistConfig(cfg);
    return { created:true, gistId:cfg.gistId };
  } else {
    const body = { files: { [filename]: { content } } };
    await apiRequest(cfg.token, 'PATCH', `https://api.github.com/gists/${cfg.gistId}`, body);
    cfg.lastBackup = Date.now();
    saveGistConfig(cfg);
    return { created:false, gistId:cfg.gistId };
  }
}

export async function restoreFromGist(){
  const cfg = loadGistConfig();
  if (!cfg.token || !cfg.gistId) throw new Error('Token or gistId missing');
  const data = await apiRequest(cfg.token, 'GET', `https://api.github.com/gists/${cfg.gistId}`);
  const file = data.files['smallbatch-ledger.json'] || data.files['cakepop-ledger.json'];
  if (!file) throw new Error('Backup file not found in gist');
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