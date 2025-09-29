export function lineChart(canvas, data){
  if (!canvas || !data.length) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const values = data.map(d=>d[1]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 10;
  const cw = w/devicePixelRatio;
  const ch = h/devicePixelRatio;
  const innerH = ch - pad*2;
  const innerW = cw - pad*2;

  ctx.clearRect(0,0,w,h);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#0d9488';
  ctx.beginPath();
  data.forEach((d,i)=>{
    const x = pad + (i/(data.length-1))*innerW;
    const y = pad + innerH - ((d[1]-min)/range)*innerH;
    i===0? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.stroke();

  const grad = ctx.createLinearGradient(0,pad,0,ch);
  grad.addColorStop(0,'rgba(13,148,136,.35)');
  grad.addColorStop(1,'rgba(13,148,136,0)');
  ctx.lineTo(pad + innerW, ch - pad);
  ctx.lineTo(pad, ch - pad);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.fillStyle = '#6aa7a3';
  ctx.font = '10px system-ui';
  ctx.fillText(max.toFixed(0), pad, pad+10);
  ctx.fillText(min.toFixed(0), pad, ch - 6);
  ctx.textAlign='right';
  ctx.fillText(data[0][0].slice(5), cw - pad, ch - 6);
  ctx.textAlign='left';
  ctx.fillText(data[data.length-1][0].slice(5), pad, ch - 6);
}