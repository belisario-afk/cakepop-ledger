// Subtle parallax for cards & background layer.
// Performance-conscious: throttled via rAF; disabled if prefers-reduced-motion.
let active = false;
let ticking = false;
let pointerX = 0;
let pointerY = 0;

export function initParallax(){
  if (active) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  active = true;
  window.addEventListener('pointermove', onMove, { passive:true });
  window.addEventListener('scroll', scheduleFrame, { passive:true });
  scheduleFrame();
}

function onMove(e){
  const w = window.innerWidth;
  const h = window.innerHeight;
  pointerX = (e.clientX / w - 0.5);
  pointerY = (e.clientY / h - 0.5);
  scheduleFrame();
}

function scheduleFrame(){
  if (!ticking){
    ticking = true;
    requestAnimationFrame(update);
  }
}

function update(){
  ticking = false;
  const cards = document.querySelectorAll('.card');
  const depth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--parallax-strength')) || 14;
  cards.forEach((card,i)=>{
    card.setAttribute('data-parallax','');
    const rect = card.getBoundingClientRect();
    const midY = rect.top + rect.height/2;
    const scrollFactor = (midY / window.innerHeight - 0.5);
    const x = ((pointerX) * depth) * 0.6;
    const y = ((pointerY + scrollFactor*0.35) * depth) * 0.6;
    card.style.setProperty('--px', x.toFixed(2)+'px');
    card.style.setProperty('--py', y.toFixed(2)+'px');
  });

  // background layer slight counter movement
  const layer = document.getElementById('parallaxLayer');
  if (layer){
    const lx = (-pointerX * 10).toFixed(2);
    const ly = (-pointerY * 10).toFixed(2);
    layer.style.transform = `translate3d(${lx}px,${ly}px,0)`;
  }
}