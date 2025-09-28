let active=false,ticking=false,pointerX=0,pointerY=0;
export function initParallax(){
  if(active) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  active=true;
  window.addEventListener('pointermove',onMove,{passive:true});
  window.addEventListener('scroll',schedule,{passive:true});
  schedule();
}
function onMove(e){
  const w=window.innerWidth,h=window.innerHeight;
  pointerX=(e.clientX/w - .5);
  pointerY=(e.clientY/h - .5);
  schedule();
}
function schedule(){
  if(!ticking){
    ticking=true;
    requestAnimationFrame(update);
  }
}
function update(){
  ticking=false;
  const cards=document.querySelectorAll('.card');
  const depth=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--parallax-strength'))||14;
  cards.forEach(card=>{
    card.setAttribute('data-parallax','');
    const rect=card.getBoundingClientRect();
    const midY=rect.top+rect.height/2;
    const scrollFactor=(midY/window.innerHeight - .5);
    const x=(pointerX)*depth*0.6;
    const y=(pointerY+scrollFactor*0.35)*depth*0.6;
    card.style.setProperty('--px',x.toFixed(2)+'px');
    card.style.setProperty('--py',y.toFixed(2)+'px');
  });
  const layer=document.getElementById('parallaxLayer');
  if(layer){
    const lx=(-pointerX*10).toFixed(2);
    const ly=(-pointerY*10).toFixed(2);
    layer.style.transform=`translate3d(${lx}px,${ly}px,0)`;
  }
}