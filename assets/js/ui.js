/* PATCHED: Quick Entry modal robust closing, auto-close toggle, CSP unaffected here */
... (KEEP ALL YOUR EXISTING CONTENT FROM PREVIOUS ui.js UNTIL THE QUICK MODAL SECTION) ...

/* Replace ONLY the Quick Modal related functions with the versions below.
   If easier, you can fully replace the entire ui.js with the most recent version you had plus these updated functions.
   For brevity, only the changed parts are shown here. Ensure helper imports remain unchanged. */

/* ---------- QUICK MODAL (UPDATED) ---------- */
function initQuickModal(){
  const btn=document.getElementById('quickAddBtn');
  const modal=document.getElementById('quickModal');
  if(!btn||!modal) return;

  if(!modal.dataset.bound){
    modal.dataset.bound='1';
    modal.addEventListener('click',e=>{
      if(e.target.hasAttribute('data-close')) closeQuickModal();
    });
    modal.querySelector('.qm-close')?.addEventListener('click', closeQuickModal);
  }
  btn.addEventListener('click',()=>openQuickModal('sale'));

  // Tabs
  modal.querySelectorAll('.qm-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      switchQuickTab(tab.getAttribute('data-tab'));
    });
  });

  populateQuickSaleProducts();
  seedQuickDates();
  restoreQuickPrefs();
  rebuildRecentChips();
  wireQuickForms();
}

function switchQuickTab(name){
  const modal=document.getElementById('quickModal');
  modal.querySelectorAll('.qm-tab').forEach(t=>{
    const active=t.getAttribute('data-tab')===name;
    t.classList.toggle('active',active);
    t.setAttribute('aria-selected',active?'true':'false');
  });
  modal.querySelectorAll('.qm-form').forEach(f=>{
    f.hidden = f.getAttribute('data-pane')!==name;
  });
  modal.querySelector(`[data-pane="${name}"]`)?.querySelector('input,select')?.focus();
}

function populateQuickSaleProducts(){
  const saleSel=document.querySelector('#quickSaleForm select[name="productId"]');
  if(!saleSel) return;
  saleSel.innerHTML='';
  getProducts().forEach(p=>{
    const o=document.createElement('option');
    o.value=p.id; o.textContent=p.name;
    saleSel.appendChild(o);
  });
}

function seedQuickDates(){
  document.querySelectorAll('#quickModal input[type="date"]').forEach(d=>{
    if(!d.value) d.value = todayISO();
  });
}

function restoreQuickPrefs(){
  const saleLock=document.querySelector('#quickSaleForm input[name="lockDate"]');
  const saleAuto=document.querySelector('#quickSaleForm input[name="autoClose"]');
  const expAuto=document.querySelector('#quickExpenseForm input[name="autoClose"]');
  if(saleLock) saleLock.checked = !!uiPrefs.lockDate;
  if(saleAuto) saleAuto.checked = (uiPrefs.autoCloseQuick!==false); // default true
  if(expAuto) expAuto.checked = (uiPrefs.autoCloseQuick!==false);
  saleLock?.addEventListener('change',e=>{
    uiPrefs.lockDate=e.target.checked; saveUIPrefs();
  });
  [saleAuto, expAuto].forEach(ch=>{
    ch?.addEventListener('change', e=>{
      uiPrefs.autoCloseQuick = e.target.checked;
      saveUIPrefs();
    });
  });
}

function wireQuickForms(){
  const saleForm=document.getElementById('quickSaleForm');
  const expForm=document.getElementById('quickExpenseForm');

  saleForm?.addEventListener('submit', e=>{
    e.preventDefault();
    const fd=new FormData(saleForm);
    const date=fd.get('date');
    const sale={
      id:'s-'+uuid(),
      date,
      productId:fd.get('productId'),
      quantity:parseInt(fd.get('quantity'))||0,
      unitPrice:parseNum(fd.get('unitPrice')),
      discount:parseNum(fd.get('discount'))||0,
      notes:fd.get('notes')?.trim()
    };
    if(!sale.productId||sale.quantity<=0) return;
    addSale(sale);
    trackRecentProduct(sale.productId);
    markSaved();
    if(!uiPrefs.lockDate) saleForm.reset();
    if(uiPrefs.lockDate) saleForm.date.value=date;
    saleForm.productId.focus();
    rebuildRecentChips();
    if(currentView==='dashboard') fillDashboard();
    if(currentView==='sales') fillSales();
    if(uiPrefs.autoCloseQuick) closeQuickModal();
  });

  expForm?.addEventListener('submit', e=>{
    e.preventDefault();
    const fd=new FormData(expForm);
    const exp={
      id:'e-'+uuid(),
      date:fd.get('date'),
      category:fd.get('category'),
      amount:parseNum(fd.get('amount')),
      notes:fd.get('notes')?.trim()
    };
    if(exp.amount<=0) return;
    addExpense(exp);
    markSaved();
    expForm.reset();
    expForm.date.value=todayISO();
    if(currentView==='dashboard') fillDashboard();
    if(currentView==='expenses') fillExpenses();
    if(uiPrefs.autoCloseQuick) closeQuickModal();
  });
}

function openQuickModal(tab='sale'){
  const modal=document.getElementById('quickModal');
  if(!modal) return;
  populateQuickSaleProducts();
  seedQuickDates();
  restoreQuickPrefs();
  rebuildRecentChips();
  modal.hidden=false;
  document.body.style.overflow='hidden';
  switchQuickTab(tab);
  if(!modal.dataset.escBound){
    modal.dataset.escBound='1';
    window.addEventListener('keydown', escCloser, {capture:true});
  }
}

function escCloser(e){
  if(e.key==='Escape'){
    const modal=document.getElementById('quickModal');
    if(modal && !modal.hidden){
      e.stopPropagation();
      closeQuickModal();
    }
  }
}

function closeQuickModal(){
  const modal=document.getElementById('quickModal');
  if(!modal) return;
  modal.hidden=true;
  document.body.style.overflow='';
}

function rebuildRecentChips(){
  const cont=document.getElementById('recentProducts');
  if(!cont) return;
  cont.innerHTML='';
  if(!recentProducts.length) return;
  const prodLookup=Object.fromEntries(getProducts().map(p=>[p.id,p.name]));
  recentProducts.slice(0,3).forEach(pid=>{
    const chip=document.createElement('div');
    chip.className='recent-chip';
    chip.textContent=prodLookup[pid]||pid;
    chip.addEventListener('click',()=>{
      const sel=document.querySelector('#quickSaleForm select[name="productId"]');
      if(sel){
        sel.value=pid;
        sel.dispatchEvent(new Event('change'));
      }
    });
    cont.appendChild(chip);
  });
}

/* Replace existing initQuickModal, openQuickModal, closeQuickModal, rebuildRecentChips
   in your file with the above updated versions. Keep other functions unchanged. */

export { openQuickModal, closeQuickModal };