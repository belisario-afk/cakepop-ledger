export function registerSW(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js?v=5')
      .catch(e=>console.warn('SW registration failed',e));
  }
}