// AES-GCM encryption for SmallBatch exports
const PBKDF2_ITER = 150000;
const KEY_LENGTH = 256;
const ENC_VERSION = 1;

async function deriveKey(password, salt){
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name:'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', salt, iterations:PBKDF2_ITER, hash:'SHA-256' },
    baseKey,
    { name:'AES-GCM', length:KEY_LENGTH },
    false,
    ['encrypt','decrypt']
  );
}

export async function encryptJSON(jsonString, password){
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipherBuf = await crypto.subtle.encrypt(
    { name:'AES-GCM', iv }, key, enc.encode(jsonString)
  );
  return {
    type:'smallbatch-encrypted',
    v: ENC_VERSION,
    alg:'AES-GCM',
    kdf:'PBKDF2-SHA256',
    iter: PBKDF2_ITER,
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(cipherBuf)))
  };
}

export async function decryptJSON(encryptedObj, password){
  if (encryptedObj.type !== 'smallbatch-encrypted' && encryptedObj.type !== 'cakepop-encrypted')
    throw new Error('Invalid encrypted file');
  const salt = Uint8Array.from(atob(encryptedObj.salt), c=>c.charCodeAt(0));
  const iv = Uint8Array.from(atob(encryptedObj.iv), c=>c.charCodeAt(0));
  const data = Uint8Array.from(atob(encryptedObj.data), c=>c.charCodeAt(0));
  const key = await deriveKey(password, salt);
  const plainBuf = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plainBuf);
}