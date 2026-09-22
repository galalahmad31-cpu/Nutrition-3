(() => {
'use strict';

const access = window.DietPlannerAccess;
const sb = access?.supabaseClient;

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
  pendingDelete: null
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
  const usedCategoryIds = new Set(
    state.subcategories.filter(s => usedSubcategoryIds.has(s.id)).map(s => s.category_id).filter(Boolean)
  );

  const categories = state.categories.filter(c => state.isAdmin || usedCategoryIds.has(c.id));

  $('categoryFilter').innerHTML =
    option('كل الأقسام','') +
    categories.map(c => option(c.name,c.id,c.id === state.category)).join('');

  const activeSubs = state.subcategories.filter(s =>
    (state.isAdmin || usedSubcategoryIds.has(s.id)) &&
    (!state.category || s.category_id === state.category)
  );

  if (!activeSubs.some(s => s.id === state.subcategory)) state.subcategory = '';

  $('subcategoryFilter').innerHTML =
    option('كل الأقسام الفرعية','') +
    activeSubs.map(s => option(s.name,s.id,s.id === state.subcategory)).join('');
}

function populateFormCategories(selectedCategory = '', selectedSubcategory = '') {
  $('formCategory').innerHTML =
    option('اختر القسم الرئيسي','') +
    state.categories.map(c => option(c.name,c.id,c.id === selectedCategory)).join('');

  const subs = state.subcategories.filter(s => !selectedCategory || s.category_id === selectedCategory);
  $('formSubcategory').innerHTML =
    option('اختر القسم الفرعي','') +
    subs.map(s => option(s.name,s.id,s.id === selectedSubcategory)).join('');

  $('formSubcategory').value = selectedSubcategory || '';
}

function refreshFormSubcategories() {
  const categoryId = $('formCategory').value;
  const current = $('formSubcategory').value;
  const subs = state.subcategories.filter(s => s.category_id === categoryId);
  $('formSubcategory').innerHTML =
    option('اختر القسم الفرعي','') +
    subs.map(s => option(s.name,s.id,s.id === current)).join('');
  if (!subs.some(s => s.id === current)) $('formSubcategory').value = '';
}

function filtered() {
  const q = state.search.toLowerCase();
  return state.products.filter(p => {
    if (state.subcategory && p.subcategory_id !== state.subcategory) return false;
    if (state.category) {
      const sub = state.subcategories.find(x => x.id === p.subcategory_id);
      if (sub?.category_id !== state.category) return false;
    }
    if (q && !([p.product_name,p.usage,p.notes].join(' ').toLowerCase().includes(q))) return false;
    return true;
  });
}

function productFormulaRows(productId) {
  return state.formulas
    .filter(f => f.product_id === productId)
    .sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function render() {
  const rows = filtered();
  $('resultCount').textContent = 'عرض ' + rows.length + ' منتج';

  if (!rows.length) {
    setState('لا توجد منتجات مطابقة للتصفية.');
    return;
  }

  $('productsGrid').innerHTML = rows.map(p => {
    const sub = state.subcategories.find(s => s.id === p.subcategory_id);
    const cat = sub && state.categories.find(c => c.id === sub.category_id);
    const fs = productFormulaRows(p.id);

    const adminActions = state.isAdmin
      ? '<div class="flex shrink-0 gap-2">' +
        '<button type="button" data-action="edit-product" data-id="' + esc(p.id) + '" class="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100" title="تعديل"><i class="fa-solid fa-pen"></i></button>' +
        '<button type="button" data-action="delete-product" data-id="' + esc(p.id) + '" class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100" title="حذف"><i class="fa-solid fa-trash"></i></button>' +
        '</div>'
      : '';

    const formulasHtml = fs.map(f =>
      '<div class="mt-3 rounded-2xl border border-slate-100 bg-white p-3">' +
      '<div class="flex items-start justify-between gap-2">' +
      '<div class="min-w-0"><div class="text-sm font-extrabold text-slate-800">' + esc(f.formula_name) + '</div>' +
      '<div class="mt-1 text-[10px] font-bold text-slate-400">' + esc(f.basis_amount ? fmt(f.basis_amount) + ' ' + (f.basis_unit || '') : 'أساس غير محدد') + (f.is_default ? ' · افتراضية' : '') + '</div></div>' +
      (state.isAdmin
        ? '<div class="flex shrink-0 gap-1.5">' +
          '<button type="button" data-action="edit-formula" data-id="' + esc(f.id) + '" class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100" title="تعديل التركيبة"><i class="fa-solid fa-pen-to-square text-xs"></i></button>' +
          '<button type="button" data-action="delete-formula" data-id="' + esc(f.id) + '" class="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100" title="حذف التركيبة"><i class="fa-solid fa-trash text-xs"></i></button>' +
          '</div>'
        : '') +
      '</div>' +
      '<div class="mt-3 grid grid-cols-4 gap-2 text-center"><div><div class="text-[10px] text-slate-400">السعرات</div><div class="mt-1 text-sm font-extrabold text-amber-600">' + fmt(f.kcal) + '</div></div>' +
      '<div><div class="text-[10px] text-slate-400">كارب</div><div class="mt-1 text-sm font-extrabold text-sky-600">' + fmt(f.carb) + '</div></div>' +
      '<div><div class="text-[10px] text-slate-400">بروتين</div><div class="mt-1 text-sm font-extrabold text-emerald-600">' + fmt(f.protein) + '</div></div>' +
      '<div><div class="text-[10px] text-slate-400">دهون</div><div class="mt-1 text-sm font-extrabold text-rose-600">' + fmt(f.fat) + '</div></div></div>' +
      (f.notes ? '<div class="mt-3 text-[11px] leading-5 text-slate-500">' + esc(f.notes) + '</div>' : '') +
      '</div>'
    ).join('');

    const addFormulaButton = state.isAdmin
      ? '<button type="button" data-action="add-formula" data-id="' + esc(p.id) + '" class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-200 bg-brand-50 px-3 py-2.5 text-xs font-extrabold text-brand-700 hover:bg-brand-100"><i class="fa-solid fa-plus"></i> إضافة تركيبة</button>'
      : '';

    return '<article class="product-card glass rounded-3xl p-5 shadow-sm">' +
      '<div class="flex items-start justify-between gap-3"><div class="min-w-0"><div class="text-xs font-bold text-brand-600">' + esc(cat?.name || 'غير مصنف') + ' · ' + esc(sub?.name || 'غير مصنف') + '</div>' +
      '<h2 class="mt-1 text-lg font-extrabold text-slate-800">' + esc(p.product_name) + '</h2></div>' + adminActions + '</div>' +
      '<div class="mt-4 rounded-2xl bg-slate-50 p-3"><div class="text-xs font-bold text-slate-500">الاستخدام</div><div class="mt-1 text-sm font-semibold leading-6 text-slate-700">' + esc(p.usage || '—') + '</div></div>' +
      formulasHtml + addFormulaButton +
      (p.notes ? '<div class="mt-3 text-[11px] leading-5 text-slate-500">' + esc(p.notes) + '</div>' : '') +
      '</article>';
  }).join('');

  setState('', true);
}

async function loadData() {
  const [c,s,p,f] = await Promise.all([
    sb.from('product_categories').select('*').eq('is_active',true).order('sort_order'),
    sb.from('product_subcategories').select('*').eq('is_active',true).order('sort_order'),
    sb.from('food_products').select('id,product_name,usage,notes,sort_order,subcategory_id,required_feature,is_active').eq('is_active',true).order('sort_order'),
    sb.from('food_product_formulas').select('id,product_id,formula_name,basis_amount,basis_unit,kcal,carb,protein,fat,notes,is_default,is_active,sort_order').eq('is_active',true).order('sort_order')
  ]);
  if (c.error) throw c.error;
  if (s.error) throw s.error;
  if (p.error) throw p.error;
  if (f.error) throw f.error;

  state.categories = c.data || [];
  state.subcategories = s.data || [];
  state.products = p.data || [];
  state.formulas = f.data || [];
}

function resetFormulaFields() {
  $('formFormulaName').value = 'التركيبة الحالية';
  $('formBasisAmount').value = '';
  $('formBasisUnit').value = '';
  $('formKcal').value = '';
  $('formCarb').value = '';
  $('formProtein').value = '';
  $('formFat').value = '';
  $('formFormulaNotes').value = '';
  $('formFormulaSort').value = '0';
  $('formFormulaDefault').checked = false;
  $('formFormulaActive').checked = true;
}

function fillFormulaFields(f) {
  $('formFormulaName').value = f?.formula_name || 'التركيبة الحالية';
  $('formBasisAmount').value = f?.basis_amount ?? '';
  $('formBasisUnit').value = f?.basis_unit || '';
  $('formKcal').value = f?.kcal ?? '';
  $('formCarb').value = f?.carb ?? '';
  $('formProtein').value = f?.protein ?? '';
  $('formFat').value = f?.fat ?? '';
  $('formFormulaNotes').value = f?.notes || '';
  $('formFormulaSort').value = f?.sort_order ?? 0;
  $('formFormulaDefault').checked = !!f?.is_default;
  $('formFormulaActive').checked = f ? !!f.is_active : true;
}

function readFormulaFields() {
  const basisAmount = $('formBasisAmount').value === '' ? null : Number($('formBasisAmount').value);
  const basisUnit = $('formBasisUnit').value || null;
  if ((basisAmount === null) !== (basisUnit === null)) {
    throw new Error('يجب إدخال الكمية الأساسية ووحدة الأساس معًا، أو تركهما فارغين.');
  }
  if (basisAmount !== null && basisAmount <= 0) {
    throw new Error('الكمية الأساسية يجب أن تكون أكبر من صفر.');
  }

  const numOrNull = id => $(id).value === '' ? null : Number($(id).value);
  return {
    formula_name: $('formFormulaName').value.trim(),
    basis_amount: basisAmount,
    basis_unit: basisUnit,
    kcal: numOrNull('formKcal'),
    carb: numOrNull('formCarb'),
    protein: numOrNull('formProtein'),
    fat: numOrNull('formFat'),
    notes: $('formFormulaNotes').value.trim() || null,
    is_default: $('formFormulaDefault').checked,
    is_active: $('formFormulaActive').checked,
    sort_order: Number($('formFormulaSort').value || 0)
  };
}

function setFormulaSelector(productId, selectedId = '') {
  const formulas = productFormulaRows(productId);
  const wrap = $('formulaSelectorWrap');
  const selector = $('formFormulaSelector');

  if (!formulas.length) {
    wrap.classList.add('hidden');
    selector.innerHTML = '';
    return;
  }

  wrap.classList.remove('hidden');
  selector.innerHTML = formulas.map(f => option(f.formula_name, f.id, f.id === selectedId)).join('');
  if (!selector.value && formulas[0]) selector.value = formulas[0].id;
}

function openEditor(mode, productId = null, formulaId = null) {
  if (!state.isAdmin) return;

  state.editor = { mode, productId, formulaId };

  const product = productId ? state.products.find(p => p.id === productId) : null;
  const formula = formulaId ? state.formulas.find(f => f.id === formulaId) : (product ? productFormulaRows(product.id)[0] : null);

  $('editorModal').style.display = 'flex';
  $('editorTitle').textContent =
    mode === 'add-product' ? 'إضافة صنف جديد' :
    mode === 'edit-product' ? 'تعديل بيانات الصنف' :
    mode === 'add-formula' ? 'إضافة تركيبة' : 'تعديل التركيبة';

  $('editorSubtitle').textContent =
    mode === 'add-product' ? 'أدخل بيانات الصنف والتركيبة المرتبطة به.' :
    mode === 'edit-product' ? 'يمكنك تعديل بيانات الصنف واختيار التركيبة المطلوب تعديلها.' :
    mode === 'add-formula' ? 'أضف تركيبة جديدة إلى الصنف المحدد.' : 'عدّل بيانات التركيبة الحالية.';

  const productMode = mode === 'add-product' || mode === 'edit-product';
  $('productFields').style.display = productMode ? 'block' : 'none';

  if (productMode) {
    const sub = product?.subcategory_id ? state.subcategories.find(s => s.id === product.subcategory_id) : null;
    populateFormCategories(sub?.category_id || '', product?.subcategory_id || '');
    $('formProductName').value = product?.product_name || '';
    $('formUsage').value = product?.usage || '';
    $('formProductNotes').value = product?.notes || '';
    $('formProductSort').value = product?.sort_order ?? 0;
    $('formRequiredFeature').value = product?.required_feature || 'product';
    $('formProductActive').checked = product ? !!product.is_active : true;
  } else {
    $('formulaProductInfo').classList.remove('hidden');
    $('formulaProductInfo').textContent = 'الصنف: ' + (product?.product_name || '—');
  }

  $('formulaProductInfo').style.display = mode === 'add-formula' ? 'block' : 'none';

  if (mode === 'add-product') {
    $('formulaSelectorWrap').classList.add('hidden');
    resetFormulaFields();
  } else if (mode === 'edit-product') {
    const formulas = product ? productFormulaRows(product.id) : [];
    setFormulaSelector(product.id, formula?.id || formulas[0]?.id || '');
    fillFormulaFields(formula || null);
    state.editor.formulaId = formula?.id || formulas[0]?.id || null;
  } else {
    $('formulaSelectorWrap').classList.add('hidden');
    fillFormulaFields(formula || null);
  }
}

function closeEditor() {
  $('editorModal').style.display = 'none';
  state.editor = { mode: null, productId: null, formulaId: null };
}

function openConfirm(type, id) {
  if (!state.isAdmin) return;
  state.pendingDelete = { type, id };

  if (type === 'product') {
    const p = state.products.find(x => x.id === id);
    $('confirmTitle').textContent = 'تأكيد حذف الصنف';
    $('confirmMessage').textContent = 'سيتم حذف الصنف «' + (p?.product_name || '') + '» وجميع التركيبات المرتبطة به. لا يمكن التراجع عن هذه العملية.';
  } else {
    const f = state.formulas.find(x => x.id === id);
    $('confirmTitle').textContent = 'تأكيد حذف التركيبة';
    $('confirmMessage').textContent = 'سيتم حذف التركيبة «' + (f?.formula_name || '') + '». لا يمكن التراجع عن هذه العملية.';
  }

  $('confirmModal').style.display = 'flex';
}

function closeConfirm() {
  $('confirmModal').style.display = 'none';
  state.pendingDelete = null;
}

async function deletePending() {
  if (!state.isAdmin || !state.pendingDelete) return;

  const { type, id } = state.pendingDelete;
  $('confirmDeleteBtn').disabled = true;
  $('confirmDeleteBtn').textContent = 'جاري الحذف...';

  try {
    const table = type === 'product' ? 'food_products' : 'food_product_formulas';
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) throw error;

    closeConfirm();
    await loadData();
    populateCategories();
    render();
    showToast(type === 'product' ? 'تم حذف الصنف وجميع تركيباته.' : 'تم حذف التركيبة.');
  } catch (e) {
    console.error(e);
    showToast(e.message || 'تعذر تنفيذ الحذف.', false);
  } finally {
    $('confirmDeleteBtn').disabled = false;
    $('confirmDeleteBtn').textContent = 'حذف';
  }
}

async function saveProduct() {
  const subcategoryId = $('formSubcategory').value;
  const name = $('formProductName').value.trim();

  if (!subcategoryId || !name) throw new Error('القسم الفرعي واسم الصنف حقول مطلوبة.');

  const productPayload = {
    product_name: name,
    usage: $('formUsage').value.trim() || null,
    notes: $('formProductNotes').value.trim() || null,
    sort_order: Number($('formProductSort').value || 0),
    required_feature: $('formRequiredFeature').value.trim() || 'product',
    subcategory_id: subcategoryId,
    is_active: $('formProductActive').checked
  };

  const formulaPayload = readFormulaFields();
  if (!formulaPayload.formula_name) throw new Error('اسم التركيبة حقل مطلوب.');

  const { mode, productId, formulaId } = state.editor;

  if (mode === 'add-product') {
    const { data, error } = await sb.from('food_products').insert(productPayload).select('id').single();
    if (error) throw error;

    const { error: formulaError } = await sb.from('food_product_formulas').insert({
      ...formulaPayload,
      product_id: data.id
    });

    if (formulaError) {
      await sb.from('food_products').delete().eq('id', data.id);
      throw formulaError;
    }

    showToast('تمت إضافة الصنف والتركيبة.');
  } else {
    const { error } = await sb.from('food_products').update(productPayload).eq('id', productId);
    if (error) throw error;

    if (formulaId) {
      const { error: formulaError } = await sb.from('food_product_formulas').update(formulaPayload).eq('id', formulaId);
      if (formulaError) throw formulaError;
    } else {
      const { error: formulaError } = await sb.from('food_product_formulas').insert({
        ...formulaPayload,
        product_id: productId
      });
      if (formulaError) throw formulaError;
    }

    showToast('تم حفظ تعديلات الصنف.');
  }
}

async function saveFormula() {
  const formulaPayload = readFormulaFields();
  if (!formulaPayload.formula_name) throw new Error('اسم التركيبة حقل مطلوب.');

  const { mode, productId, formulaId } = state.editor;

  if (mode === 'add-formula') {
    const { error } = await sb.from('food_product_formulas').insert({
      ...formulaPayload,
      product_id: productId
    });
    if (error) throw error;
    showToast('تمت إضافة التركيبة.');
  } else {
    const { error } = await sb.from('food_product_formulas').update(formulaPayload).eq('id', formulaId);
    if (error) throw error;
    showToast('تم تعديل التركيبة.');
  }
}

async function saveEditor(e) {
  e.preventDefault();
  if (!state.isAdmin) return;

  const btn = $('saveEditorBtn');
  btn.disabled = true;
  btn.textContent = 'جاري الحفظ...';

  try {
    if (state.editor.mode === 'add-product' || state.editor.mode === 'edit-product') {
      await saveProduct();
    } else {
      await saveFormula();
    }

    closeEditor();
    await loadData();
    populateCategories();
    render();
  } catch (e) {
    console.error(e);
    showToast(e.message || 'تعذر حفظ البيانات.', false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'حفظ';
  }
}

async function init() {
  try {
    if (!sb) throw new Error('تعذر الاتصال بقاعدة البيانات.');

    const status = await access.getAccessStatus();
    if (!status?.authenticated || !status.user) {
      location.replace('index.html');
      return;
    }

    state.isAdmin = status.isAdmin === true;

    if (!state.isAdmin) {
      const ok = await access.hasFeature(status.user.id,'product');
      if (ok !== true) {
        setState('هذه الخدمة غير متاحة في اشتراكك الحالي.');
        return;
      }
    } else {
      $('adminToolbar').classList.remove('hidden');
      $('adminToolbar').classList.add('flex');
    }

    await loadData();
    populateCategories();
    render();
  } catch (e) {
    console.error(e);
    setState(e.message || 'حدث خطأ أثناء تحميل المنتجات.');
  }
}

$('categoryFilter').onchange = e => {
  state.category = e.target.value;
  state.subcategory = '';
  populateCategories();
  render();
};

$('subcategoryFilter').onchange = e => {
  state.subcategory = e.target.value;
  render();
};

$('searchInput').oninput = e => {
  state.search = e.target.value.trim();
  render();
};

$('resetBtn').onclick = () => {
  state.category = '';
  state.subcategory = '';
  state.search = '';
  $('searchInput').value = '';
  populateCategories();
  render();
};

$('addProductBtn').onclick = () => openEditor('add-product');
$('closeEditorBtn').onclick = closeEditor;
$('cancelEditorBtn').onclick = closeEditor;
$('cancelConfirmBtn').onclick = closeConfirm;
$('confirmDeleteBtn').onclick = deletePending;
$('editorForm').addEventListener('submit', saveEditor);

$('formCategory').onchange = refreshFormSubcategories;

$('formFormulaSelector').onchange = e => {
  const f = state.formulas.find(x => x.id === e.target.value);
  state.editor.formulaId = f?.id || null;
  fillFormulaFields(f || null);
};

$('productsGrid').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn || !state.isAdmin) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === 'edit-product') openEditor('edit-product', id);
  else if (action === 'delete-product') openConfirm('product', id);
  else if (action === 'edit-formula') {
    const f = state.formulas.find(x => x.id === id);
    openEditor('edit-formula', f?.product_id || null, id);
  } else if (action === 'delete-formula') openConfirm('formula', id);
  else if (action === 'add-formula') openEditor('add-formula', id);
});

$('editorModal').addEventListener('click', e => {
  if (e.target === $('editorModal')) closeEditor();
});

$('confirmModal').addEventListener('click', e => {
  if (e.target === $('confirmModal')) closeConfirm();
});

init();
})();