export function registerSW(){
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js')
      .catch(err=>console.warn('SW registration failed', err));
  }
}