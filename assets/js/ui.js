/***** QUICK MODAL SECTION (REPLACE YOUR EXISTING QUICK MODAL FUNCTIONS WITH ALL OF THIS) *****/

/* State */
let quickModalBound = false;
let quickEscListener = null;

/* Initialize or re-bind the quick modal */
function initQuickModal(){
  const btn  = document.getElementById('quickAddBtn');
  const modal = document.getElementById('quickModal');
  if(!btn || !modal) return;

  // Toggle open on button click
  btn.addEventListener('click', ()=>{
    if (!modal.hidden) {
      closeQuickModal();
    } else {
      openQuickModal('sale');
    }
  });

  // Bind once
  if (!quickModalBound) {
    quickModalBound = true;

    // Delegate clicks for close elements / backdrop
    modal.addEventListener('click', e=>{
      if (
        e.target.hasAttribute('data-close') ||
        e.target.classList.contains('qm-backdrop')
      ){
        closeQuickModal();
      }
    });

    // Tab switching
    modal.querySelectorAll('.qm-tab').forEach(tab=>{
      tab.addEventListener('click', ()=>{
        switchQuickTab(tab.getAttribute('data-tab'));
      });
    });
  }

  // Ensure products + dates & preferences each time
  populateQuickSaleProducts();
  seedQuickDates();
  restoreQuickPrefs();
  rebuildRecentChips();
  wireQuickForms();
}

/* Switch pane */
function switchQuickTab(name){
  const modal=document.getElementById('quickModal');
  if(!modal) return;
  modal.querySelectorAll('.qm-tab').forEach(t=>{
    const active = t.getAttribute('data-tab')===name;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active?'true':'false');
  });
  modal.querySelectorAll('.qm-form').forEach(f=>{
    f.hidden = f.getAttribute('data-pane')!==name;
  });
  // Focus first field
  modal.querySelector(`[data-pane="${name}"]`)?.querySelector('input,select')?.focus();
}

/* Open quick modal (tab = 'sale'|'expense') */
function openQuickModal(tab='sale'){
  const modal=document.getElementById('quickModal');
  const btn=document.getElementById('quickAddBtn');
  if(!modal) return;

  populateQuickSaleProducts();
  seedQuickDates();
  restoreQuickPrefs();
  rebuildRecentChips();
  switchQuickTab(tab);

  modal.hidden=false;
  document.body.style.overflow='hidden';
  btn?.setAttribute('aria-expanded','true');

  // ESC / ALT+Q / ALT+W / CTRL+W close (without interfering w/ browser if focused inside)
  if(!quickEscListener){
    quickEscListener = (e)=>{
      if(
        e.key==='Escape' ||
        (e.altKey && (e.key.toLowerCase()==='q' || e.key.toLowerCase()==='w')) ||
        (e.ctrlKey && e.key.toLowerCase()==='w')
      ){
        if(!modal.hidden){
          e.preventDefault();
          closeQuickModal();
        }
      }
    };
    window.addEventListener('keydown', quickEscListener, { capture:true });
  }
}

/* Close quick modal */
function closeQuickModal(){
  const modal=document.getElementById('quickModal');
  const btn=document.getElementById('quickAddBtn');
  if(!modal || modal.hidden) return;
  modal.hidden=true;
  document.body.style.overflow='';
  btn?.setAttribute('aria-expanded','false');

  // Keep ESC listener if you want multiple reopens quickly;
  // If you prefer to remove each time, uncomment:
  // if(quickEscListener){
  //   window.removeEventListener('keydown', quickEscListener, { capture:true });
  //   quickEscListener=null;
  // }
}

/* Populate product select each open */
function populateQuickSaleProducts(){
  const sel=document.querySelector('#quickSaleForm select[name="productId"]');
  if(!sel) return;
  const currentValue = sel.value;
  sel.innerHTML='';
  getProducts().forEach(p=>{
    const o=document.createElement('option');
    o.value=p.id;
    o.textContent=p.name;
    sel.appendChild(o);
  });
  // Try to preserve selected product if still exists
  if(currentValue && [...sel.options].some(o=>o.value===currentValue)){
    sel.value=currentValue;
  }
}

/* Ensure date fields set */
function seedQuickDates(){
  document.querySelectorAll('#quickModal input[type="date"]').forEach(d=>{
    if(!d.value) d.value = todayISO();
  });
}

/* Restore toggle prefs for lock date & auto-close */
function restoreQuickPrefs(){
  const saleLock=document.querySelector('#quickSaleForm input[name="lockDate"]');
  const saleAuto=document.querySelector('#quickSaleForm input[name="autoClose"]');
  const expAuto =document.querySelector('#quickExpenseForm input[name="autoClose"]');

  if(saleLock) saleLock.checked = !!uiPrefs.lockDate;
  if(saleAuto) saleAuto.checked = (uiPrefs.autoCloseQuick!==false);
  if(expAuto)  expAuto.checked = (uiPrefs.autoCloseQuick!==false);

  saleLock?.addEventListener('change', e=>{
    uiPrefs.lockDate = e.target.checked;
    saveUIPrefs();
  });

  [saleAuto, expAuto].forEach(ch=>{
    ch?.addEventListener('change', e=>{
      uiPrefs.autoCloseQuick = e.target.checked;
      saveUIPrefs();
    });
  });
}

/* Wire sale & expense forms (no duplication on re-open) */
function wireQuickForms(){
  const saleForm=document.getElementById('quickSaleForm');
  const expForm =document.getElementById('quickExpenseForm');

  if(saleForm && !saleForm.dataset.bound){
    saleForm.dataset.bound='1';
    saleForm.addEventListener('submit', e=>{
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
      if(!sale.productId || sale.quantity<=0) return;
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
  }

  if(expForm && !expForm.dataset.bound){
    expForm.dataset.bound='1';
    expForm.addEventListener('submit', e=>{
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
}

/* Build recent product chips */
function rebuildRecentChips(){
  const cont=document.getElementById('recentProducts');
  if(!cont) return;
  cont.innerHTML='';
  if(!recentProducts.length) return;
  const prodLookup=Object.fromEntries(getProducts().map(p=>[p.id,p.name]));
  recentProducts.slice(0,3).forEach(pid=>{
    const chip=document.createElement('button');
    chip.type='button';
    chip.className='recent-chip';
    chip.textContent=prodLookup[pid]||pid;
    chip.setAttribute('title','Use '+(prodLookup[pid]||pid));
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

/* Export public functions (keep at bottom of file if needed elsewhere) */
export { openQuickModal, closeQuickModal };
/***** END QUICK MODAL PATCH *****/