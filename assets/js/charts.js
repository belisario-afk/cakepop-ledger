export function lineChart(canvas, data, opts={}){
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const values = data.map(d=>d[1]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 8;
  const innerH = (h/devicePixelRatio) - pad*2;
  const innerW = (w/devicePixelRatio) - pad*2;

  ctx.clearRect(0,0,w,h);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#8146ff';
  ctx.beginPath();
  data.forEach((d,i)=>{
    const x = pad + (i/(data.length-1))*innerW;
    const y = pad + innerH - ((d[1]-min)/range)*innerH;
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // Fill
  const grad = ctx.createLinearGradient(0,pad,0,h);
  grad.addColorStop(0,'rgba(129,70,255,.35)');
  grad.addColorStop(1,'rgba(129,70,255,0)');
  ctx.lineTo(pad + innerW, h - pad);
  ctx.lineTo(pad, h - pad);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Y labels (2)
  ctx.fillStyle = '#888';
  ctx.font = '10px system-ui';
  ctx.fillText(max.toFixed(0), pad, pad+10);
  ctx.fillText(min.toFixed(0), pad, h/devicePixelRatio - 4);

  // X first & last
  ctx.textAlign='right';
  ctx.fillText(data[0][0].slice(5), w/devicePixelRatio - pad, h/devicePixelRatio - 4);
  ctx.textAlign='left';
  ctx.fillText(data[data.length-1][0].slice(5), pad, h/devicePixelRatio - 4);
}