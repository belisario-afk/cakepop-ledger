export function registerSW(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js?ver=icons')
      .catch(e=>console.warn('SW registration failed',e));
  }
}