import { exportJson, importJson } from './storage.js';

const CFG_KEY = 'smallbatch-gist-config';

export function loadGistConfig(){
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {token:'',gistId:'',interval:0,lastBackup:0}; }
  catch { return {token:'',gistId:'',interval:0,lastBackup:0}; }
}
export function saveGistConfig(cfg){
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

async function api(token, method, url, body){
  const res = await fetch(url,{
    method,
    headers:{
      'Authorization':`token ${token}`,
      'Accept':'application/vnd.github+json'
    },
    body: body? JSON.stringify(body):undefined
  });
  if (!res.ok){
    throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function backupToGist(){
  const cfg = loadGistConfig();
  if (!cfg.token) throw new Error('Missing token');
  const content = exportJson();
  const filename = 'smallbatch-ledger.json';
  if (!cfg.gistId){
    const data = await api(cfg.token,'POST','https://api.github.com/gists',{
      description:'SmallBatch Backup',
      public:false,
      files:{ [filename]:{content} }
    });
    cfg.gistId = data.id;
  } else {
    await api(cfg.token,'PATCH',`https://api.github.com/gists/${cfg.gistId}`,{
      files:{ [filename]:{content} }
    });
  }
  cfg.lastBackup = Date.now();
  saveGistConfig(cfg);
  return { gistId:cfg.gistId };
}

export async function restoreFromGist(){
  const cfg = loadGistConfig();
  if (!cfg.token || !cfg.gistId) throw new Error('Missing token or gistId');
  const data = await api(cfg.token,'GET',`https://api.github.com/gists/${cfg.gistId}`);
  const file = data.files['smallbatch-ledger.json'] || data.files['cakepop-ledger.json'];
  if (!file) throw new Error('Backup file not found');
  importJson(JSON.parse(file.content));
  return true;
}

let timer = null;
export function startAutoBackup(){
  const cfg = loadGistConfig();
  stopAutoBackup();
  if (!cfg.interval || cfg.interval <=0) return;
  timer = setInterval(()=>backupToGist().catch(e=>console.warn('Auto backup fail',e)), cfg.interval*60000);
}
export function stopAutoBackup(){
  if (timer){ clearInterval(timer); timer=null; }
}