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

function populateCategories() {
  const usedSubcategoryIds = new Set(state.products.map(p => p.subcategory_id).filter(Boolean));
  const usedCategoryIds = new Set(state.subcategories.filter(s => usedSubcategoryIds.has(s.id)).map(s => s.category_id).filter(Boolean));
  const categories = state.categories.filter(c => state.isAdmin || usedCategoryIds.has(c.id));
  $('categoryFilter').innerHTML = option('كل الأقسام','') + categories.map(c => option(c.name,c.id,c.id === state.category)).join('');
  const activeSubs = state.subcategories.filter(s => (state.isAdmin || usedSubcategoryIds.has(s.id)) && (!state.category || s.category_id === state.category));
  if (!activeSubs.some(s => s.id === state.subcategory)) state.subcategory = '';
  $('subcategoryFilter').innerHTML = option('كل الأقسام الفرعية','') + activeSubs.map(s => option(s.name,s.id,s.id === state.subcategory)).join('');
}

function populateFormCategories(selectedCategory = '', selectedSubcategory = '') {
  $('formCategory').innerHTML = option('اختر القسم الرئيسي','') + state.categories.map(c => option(c.name,c.id,c.id === selectedCategory)).join('');
  const subs = state.subcategories.filter(s => !selectedCategory || s.category_id === selectedCategory);
  $('formSubcategory').innerHTML = option('اختر القسم الفرعي','') + subs.map(s => option(s.name,s.id,s.id === selectedSubcategory)).join('');
  $('formSubcategory').value = selectedSubcategory || '';
}

function populateSubcategoryParentSelect(selectedId = '') {
  const select = $('subcategoryParentSelect');
  select.innerHTML = option('اختر القسم الرئيسي','') + state.categories.map(c => option(c.name,c.id,c.id === selectedId)).join('');
}

function openCategoryModal(type) {
  if (!state.isAdmin) return;
  state.categoryManagerType = type;
  const isSub = type === 'subcategory';
  $('categoryModalTitle').textContent = isSub ? 'إضافة قسم فرعي جديد' : 'إضافة قسم رئيسي جديد';
  $('categoryModalHint').textContent = isSub ? 'اختر القسم الرئيسي ثم اكتب اسم القسم الفرعي.' : 'اكتب اسم القسم الرئيسي الجديد.';
  $('subcategoryParentWrap').classList.toggle('hidden', !isSub);
  $('subcategoryParentSelect').required = isSub;
  $('categoryNameInput').value = '';
  populateSubcategoryParentSelect($('formCategory').value || '');
  $('categoryModal').style.display = 'flex';
  $('categoryNameInput').focus();
}

function closeCategoryModal() {
  $('categoryModal').style.display = 'none';
  $('categoryForm').reset();
  state.categoryManagerType = null;
}

async function saveNewCategory(e) {
  e.preventDefault();
  if (!state.isAdmin) return;
  const name = $('categoryNameInput').value.trim();
  const type = state.categoryManagerType;
  if (!name || !type) return;
  const payload = type === 'category' ? { name, sort_order: 0, is_active: true } : { name, category_id: $('subcategoryParentSelect').value, sort_order: 0, is_active: true };
  if (type === 'subcategory' && !payload.category_id) { showToast('اختر القسم الرئيسي أولاً.', false); return; }
  const table = type === 'category' ? 'product_categories' : 'product_subcategories';
  const button = $('saveCategoryBtn'); button.disabled = true; button.textContent = 'جاري الإضافة...';
  try {
    const { data, error } = await sb.from(table).insert(payload).select('id').single();
    if (error) throw error;
    await loadData(); populateCategories();
    if (type === 'category') { populateFormCategories(data.id, ''); $('formCategory').value = data.id; refreshFormSubcategories(); }
    else populateFormCategories(payload.category_id, data.id);
    closeCategoryModal(); showToast(type === 'category' ? 'تمت إضافة القسم الرئيسي.' : 'تمت إضافة القسم الفرعي.');
  } catch (error) { console.error('Category creation failed:', error); showToast(error.message || 'تعذر إضافة القسم.', false); }
  finally { button.disabled = false; button.textContent = 'إضافة'; }
}

function refreshFormSubcategories() {
  const categoryId = $('formCategory').value; const current = $('formSubcategory').value;
  const subs = state.subcategories.filter(s => s.category_id === categoryId);
  $('formSubcategory').innerHTML = option('اختر القسم الفرعي','') + subs.map(s => option(s.name,s.id,s.id === current)).join('');
  if (!subs.some(s => s.id === current)) $('formSubcategory').value = '';
}

function filtered() {
  const q = state.search.toLowerCase();
  return state.products.filter(p => {
    if (state.subcategory && p.subcategory_id !== state.subcategory) return false;
    if (state.category) { const sub = state.subcategories.find(x => x.id === p.subcategory_id); if (sub?.category_id !== state.category) return false; }
    return !q || [p.product_name,p.usage,p.notes].join(' ').toLowerCase().includes(q);
  });
}

function productFormulaRows(productId) { return state.formulas.filter(f => f.product_id === productId).sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0)); }

function render() {
  const rows = filtered(); $('resultCount').textContent = 'عرض ' + rows.length + ' منتج';
  if (!rows.length) { setState('لا توجد منتجات مطابقة للتصفية.'); return; }
  $('productsGrid').innerHTML = rows.map(p => {
    const sub = state.subcategories.find(s => s.id === p.subcategory_id); const cat = sub && state.categories.find(c => c.id === sub.category_id); const formula = productFormulaRows(p.id)[0];
    const adminActions = state.isAdmin ? '<div class="flex shrink-0 gap-2"><button type="button" data-action="edit-product" data-id="' + esc(p.id) + '" class="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100" title="تعديل"><i class="fa-solid fa-pen"></i></button><button type="button" data-action="delete-product" data-id="' + esc(p.id) + '" class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100" title="حذف"><i class="fa-solid fa-trash"></i></button></div>' : '';
    const formulaHtml = formula ? '<div class="mt-3 rounded-2xl border border-slate-100 bg-white p-3"><div class="text-sm font-extrabold text-slate-800">' + esc(formula.formula_name) + '</div><div class="mt-1 text-[10px] font-bold text-slate-400">' + esc(formula.basis_amount ? fmt(formula.basis_amount) + ' ' + (formula.basis_unit || '') : 'أساس غير محدد') + '</div><div class="mt-3 grid grid-cols-4 gap-2 text-center"><div><div class="text-[10px] text-slate-400">السعرات</div><div class="mt-1 text-sm font-extrabold text-amber-600">' + fmt(formula.kcal) + '</div></div><div><div class="text-[10px] text-slate-400">كارب</div><div class="mt-1 text-sm font-extrabold text-sky-600">' + fmt(formula.carb) + '</div></div><div><div class="text-[10px] text-slate-400">بروتين</div><div class="mt-1 text-sm font-extrabold text-emerald-600">' + fmt(formula.protein) + '</div></div><div><div class="text-[10px] text-slate-400">دهون</div><div class="mt-1 text-sm font-extrabold text-rose-600">' + fmt(formula.fat) + '</div></div></div>' + (formula.notes ? '<div class="mt-3 text-[11px] leading-5 text-slate-500">' + esc(formula.notes) + '</div>' : '') + '</div>' : '<div class="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-400">لا توجد بيانات تركيبة لهذا المنتج.</div>';
    return '<article class="product-card glass rounded-3xl p-5 shadow-sm"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><div class="text-xs font-bold text-brand-600">' + esc(cat?.name || 'غير مصنف') + ' · ' + esc(sub?.name || 'غير مصنف') + '</div><h2 class="mt-1 text-lg font-extrabold text-slate-800">' + esc(p.product_name) + '</h2></div>' + adminActions + '</div><div class="mt-4 rounded-2xl bg-slate-50 p-3"><div class="text-xs font-bold text-slate-500">الاستخدام</div><div class="mt-1 text-sm font-semibold leading-6 text-slate-700">' + esc(p.usage || '—') + '</div></div>' + formulaHtml + (p.notes ? '<div class="mt-3 text-[11px] leading-5 text-slate-500">' + esc(p.notes) + '</div>' : '') + '</article>';
  }).join('');
  setState('', true);
}

async function loadData() {
  const [c,s,p,f] = await Promise.all([
    sb.from('product_categories').select('*').eq('is_active',true).order('sort_order'),
    sb.from('product_subcategories').select('*').eq('is_active',true).order('sort_order'),
    sb.from('food_products').select('id,product_name,usage,notes,sort_order,subcategory_id,required_feature,is_active').eq('is_active',true).order('sort_order'),
    sb.from('food_product_formulas').select('id,product_id,formula_name,basis_amount,basis_unit,kcal,carb,protein,fat,notes,sort_order').order('sort_order')
  ]);
  if (c.error) throw c.error; if (s.error) throw s.error; if (p.error) throw p.error; if (f.error) throw f.error;
  state.categories=c.data||[]; state.subcategories=s.data||[]; state.products=p.data||[]; state.formulas=f.data||[];
}

function resetFormulaFields() { ['formBasisAmount','formBasisUnit','formKcal','formCarb','formProtein','formFat','formFormulaNotes'].forEach(id => { if ($(id)) $(id).value=''; }); if ($('formFormulaName')) $('formFormulaName').value='التركيبة الحالية'; if ($('formFormulaSort')) $('formFormulaSort').value='0'; }
function fillFormulaFields(f) { $('formFormulaName').value=f?.formula_name||'التركيبة الحالية'; $('formBasisAmount').value=f?.basis_amount??''; $('formBasisUnit').value=f?.basis_unit||''; $('formKcal').value=f?.kcal??''; $('formCarb').value=f?.carb??''; $('formProtein').value=f?.protein??''; $('formFat').value=f?.fat??''; $('formFormulaNotes').value=f?.notes||''; $('formFormulaSort').value=f?.sort_order??0; }

function readFormulaFields() {
  const basisAmount=$('formBasisAmount').value===''?null:Number($('formBasisAmount').value); const basisUnit=$('formBasisUnit').value||null;
  if ((basisAmount===null)!==(basisUnit===null)) throw new Error('يجب إدخال الكمية الأساسية ووحدة الأساس معًا، أو تركهما فارغين.');
  if (basisAmount!==null && basisAmount<=0) throw new Error('الكمية الأساسية يجب أن تكون أكبر من صفر.');
  const numOrNull=id=>$(id).value===''?null:Number($(id).value);
  return {formula_name:$('formFormulaName').value.trim()||'التركيبة الحالية',basis_amount:basisAmount,basis_unit:basisUnit,kcal:numOrNull('formKcal'),carb:numOrNull('formCarb'),protein:numOrNull('formProtein'),fat:numOrNull('formFat'),notes:$('formFormulaNotes').value.trim()||null,sort_order:numOrNull('formFormulaSort')??0};
}

async function init() {
  try {
    const status=await CoreAccess.getAccessStatus(); state.isAdmin=status?.isAdmin===true;
    await loadData(); populateCategories(); render();
  } catch(error) { console.error('Products initialization failed:',error); setState(error.message||'تعذر تحميل المنتجات.'); }
}

// Event wiring for the page remains below the Core boundary.
$('searchInput')?.addEventListener('input',e=>{state.search=e.target.value;render();});
$('categoryFilter')?.addEventListener('change',e=>{state.category=e.target.value;populateCategories();render();});
$('subcategoryFilter')?.addEventListener('change',e=>{state.subcategory=e.target.value;render();});
$('formCategory')?.addEventListener('change',refreshFormSubcategories);
$('categoryForm')?.addEventListener('submit',saveNewCategory);
init();
})();
