// Google Identity (client-only)
// Provides pseudo-auth user object: { sub, email, name }
// Stores active user in session (localStorage)
const AUTH_KEY = 'cakepop-active-user';

let _user = null;

export function getActiveUser(){
  if (_user) return _user;
  try {
    _user = JSON.parse(localStorage.getItem(AUTH_KEY));
  } catch {}
  return _user;
}

export function setActiveUser(u){
  _user = u;
  if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u));
  else localStorage.removeItem(AUTH_KEY);
  // Force reload to switch namespace data
  window.dispatchEvent(new CustomEvent('cakepop-user-change'));
}

export function initGoogleSignIn(clientId){
  if (!window.google || !clientId) return;
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (resp)=>{
      try {
        // decode JWT
        const payload = JSON.parse(atob(resp.credential.split('.')[1]));
        setActiveUser({
          sub: payload.sub,
            email: payload.email,
            name: payload.name || payload.email
        });
      } catch(e){
        console.warn('Failed to parse Google token', e);
      }
    }
  });
  window.google.accounts.id.renderButton(
    document.getElementById('gSignInContainer'),
    { theme:'outline', size:'small', type:'standard' }
  );
}

export function signOut(){
  setActiveUser(null);
}