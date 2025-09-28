export const uuid = () =>
  crypto.randomUUID ? crypto.randomUUID() :
  'xxxxxxxyxxxx'.replace(/[xy]/g,c=>{
    const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);
  });

export const fmtMoney = (n, digits=2) =>
  '$' + (Number(n||0).toLocaleString(undefined,{minimumFractionDigits:digits,maximumFractionDigits:digits}));

export const todayISO = () => new Date().toISOString().slice(0,10);

export const parseNum = v => {
  const n = parseFloat(v);
  return isNaN(n)?0:n;
};

export const betweenDates = (d, from, to) => {
  if (!from && !to) return true;
  const t = new Date(d).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime()) return false;
  return true;
};

export const downloadBlob = (data, filename, type='application/json') => {
  const blob = new Blob([data], {type});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const groupBy = (arr, keyFn) => arr.reduce((acc,item)=>{
  const k = keyFn(item);
  (acc[k] ||= []).push(item);
  return acc;
}, {});

export const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0,10);
};