const AUTH_KEY = 'smallbatch-active-user';
let _user = null;

export function getActiveUser(){
  if (_user) return _user;
  try { _user = JSON.parse(localStorage.getItem(AUTH_KEY)); } catch {}
  return _user;
}

export function setActiveUser(u){
  _user = u;
  if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u));
  else localStorage.removeItem(AUTH_KEY);
  window.dispatchEvent(new CustomEvent('smallbatch-user-change'));
}

export function initGoogleSignIn(clientId){
  if (!window.google || !clientId) return;
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (resp)=>{
      try {
        const payload = JSON.parse(atob(resp.credential.split('.')[1]));
        setActiveUser({
          sub: payload.sub,
          email: payload.email,
          name: payload.name || payload.email,
          picture: payload.picture
        });
      } catch(e){
        console.warn('Google token parse failed', e);
      }
    }
  });
  window.google.accounts.id.renderButton(
    document.getElementById('gSignInContainer'),
    { theme:'outline', size:'medium', type:'standard' }
  );
}

export function signOut(){
  setActiveUser(null);
}