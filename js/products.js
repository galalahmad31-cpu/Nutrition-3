(() => {
'use strict';

const CoreAccess = window.DietPlannerCoreAccess;
const sb = window.DietPlannerSupabase?.client || null;

if (!CoreAccess || !sb) {
  console.error('Diet Planner Core is unavailable on products page.');
  return;
}

const state = {
  categories: [],
  subcategories: [],
  products: [],
  formulas: [],
  category: '',
  subcategory: '',
  search: '',
  isAdmin: false,
  editor: { mode: null, productId: null, formulaId: null },
  pendingDelete: null,
  categoryManagerType: null
};

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const fmt = v => v == null || v === '' ? '—' : Number(v).toLocaleString('ar-EG',{maximumFractionDigits:2});

function setState(msg, show = false) {
  $('state').textContent = msg;
  $('state').style.display = show ? 'none' : 'block';
  $('productsGrid').style.display = show ? 'grid' : 'none';
}

function option(label, value, selected = false) {
  return '<option value="' + esc(value) + '" ' + (selected ? 'selected' : '') + '>' + esc(label) + '</option>';
}

function showToast(message, ok = true) {
  const el = $('toast');
  el.textContent = message;
  el.className = 'fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold text-white shadow-xl ' + (ok ? 'bg-emerald-600' : 'bg-rose-600');
  el.style.display = 'block';
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { el.style.display = 'none'; }, 3200);
}

