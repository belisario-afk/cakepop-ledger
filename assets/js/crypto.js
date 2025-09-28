const ITER=150000;
const KEY_LEN=256;

async function deriveKey(password,salt){
  const base=await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password),
    {name:'PBKDF2'}, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {name:'PBKDF2',salt,iterations:ITER,hash:'SHA-256'},
    base,{name:'AES-GCM',length:KEY_LEN},false,['encrypt','decrypt']
  );
}

export async function encryptJSON(plain,password){
  const enc=new TextEncoder();
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(password,salt);
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(plain));
  return {
    type:'smallbatch-encrypted',
    v:1,
    kdf:'PBKDF2-SHA256',
    iter:ITER,
    alg:'AES-GCM',
    salt:btoa(String.fromCharCode(...salt)),
    iv:btoa(String.fromCharCode(...iv)),
    data:btoa(String.fromCharCode(...new Uint8Array(ct)))
  };
}

export async function decryptJSON(obj,password){
  if(!obj || (obj.type!=='smallbatch-encrypted' && obj.type!=='cakepop-encrypted'))
    throw new Error('Invalid encrypted file');
  const salt=Uint8Array.from(atob(obj.salt),c=>c.charCodeAt(0));
  const iv=Uint8Array.from(atob(obj.iv),c=>c.charCodeAt(0));
  const data=Uint8Array.from(atob(obj.data),c=>c.charCodeAt(0));
  const key=await deriveKey(password,salt);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,data);
  return new TextDecoder().decode(pt);
}