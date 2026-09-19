(function () {
  'use strict';

  const access = window.DietPlannerAccess;
  const supabase = access && access.supabaseClient;

  const state = {
    user: null,
    patient: null,
    days: [],
    currentDayId: null,
    currentDayDate: null,
    activeTab: 'assessment',
    activeEnteral: 'volume',
    statusTimer: null
  };

  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function patientIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('patient') || params.get('id') || params.get('patient_id');
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function parseNumber(id) {
    const el = $(id);
    const value = el ? Number.parseFloat(el.value) : 0;
    return Number.isFinite(value) ? value : 0;
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function showStatus(message, type = 'info') {
    const el = $('status');
    if (!el) return;
    el.textContent = message;
    el.className = `no-print text-sm text-center min-h-6 ${
      type === 'error' ? 'text-red-600' : type === 'success' ? 'text-emerald-600' : 'text-slate-500'
    }`;
    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(() => { el.textContent = ''; }, 3500);
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function patientUrl() {
    const id = patientIdFromUrl();
    return id ? `nutritionsupport-patient.html?patient=${encodeURIComponent(id)}` : 'nutritionsupport-patient.html';
  }

  async function loadPatient() {
    const id = patientIdFromUrl();
    if (!id) throw new Error('لم يتم تحديد المريض.');
    if (!supabase || !state.user) throw new Error('تعذر الاتصال بقاعدة البيانات.');

    const { data, error } = await supabase
      .from('patients')
      .select('id,user_id,name,gender,birth_date,age,height,diagnosis,complaints,clinical_notes')
      .eq('id', id)
      .eq('user_id', state.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('لم يتم العثور على المريض.');

    state.patient = data;
    setText('patient-name', data.name || 'بدون اسم');
    setText('patient-meta', [data.gender, data.age ? `${data.age} سنة` : '', data.diagnosis].filter(Boolean).join(' • ') || '');
    setText('patient-height', data.height ? `${data.height} cm` : '—');
    setText('patient-weight', 'يُحدد في التقييم');
  }

  async function loadDays() {
    const { data, error } = await supabase
      .from('nutrition_support_days')
      .select('id,patient_id,user_id,day_date,state,created_at,updated_at')
      .eq('patient_id', state.patient.id)
      .eq('user_id', state.user.id)
      .order('day_date', { ascending: false });

    if (error) throw error;
    state.days = data || [];

    if (!state.days.length) {
      state.currentDayId = null;
      state.currentDayDate = null;
      clearForm();
      renderDays();
      updateDayLabel();
      return;
    }

    const selected = state.currentDayId ? state.days.find((d) => d.id === state.currentDayId) : null;
    const day = selected || state.days[0];
    selectDay(day, false);
    renderDays();
  }

  function renderDays() {
    const list = $('days-list');
    const empty = $('days-empty');
    if (!list || !empty) return;

    list.innerHTML = '';
    empty.classList.toggle('hidden', state.days.length > 0);

    state.days.forEach((day) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `day shrink-0 border rounded-xl px-4 py-2 text-right ${day.id === state.currentDayId ? 'active' : 'bg-white'}`;
      button.dataset.dayId = day.id;
      button.innerHTML = `<div class="text-xs text-slate-500">يوم متابعة</div><div class="font-bold">${formatDate(day.day_date)}</div>`;
      list.appendChild(button);
    });
  }

  function updateDayLabel() {
    setText('current-day-label', state.currentDayDate ? `متابعة: ${formatDate(state.currentDayDate)}` : 'لا يوجد يوم محفوظ');
  }

  function clearForm() {
    $$('input, select, textarea').forEach((el) => {
      if (el.closest('.no-print') && (el.type === 'button' || el.type === 'submit')) return;
      if (el.id === 'tpn-type-select') el.value = '3in1';
      else if (el.id === 'glu-input-mode') el.value = 'gir';
      else if (el.id === 'sel-nacl-type') el.value = '0.154';
      else if (el.type === 'checkbox') el.checked = true;
      else if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
    ['en-init-rate','en-advance','en-goal','en-hours','cb-kcal-kg','cb-target-water','cb-target-protein','cb-free-water-pct','cb-caloric-density','cb-protein-density','cb-init-pct','cb-advance-pct','cb-freq-hours','tpn-fluid-kg','tpn-enteral-fluid','tpn-other-input','tpn-caloric-density','tpn-target-energy-kg','tpn-infusion-hours','in-prot','in-prot-conc','in-lipid','in-lipid-conc','in-phos','in-nacl','in-kcl','in-ca','in-mg','in-gir','in-glu-conc-manual','in-glu-other-rate','in-glu-other-dur','in-glu-other-conc','in-trace-vol','in-vitalipid-vol','in-soluvito-vol'].forEach((id) => {
      const el = $(id);
      if (el && !el.value) el.value = ['en-hours','cb-freq-hours','tpn-infusion-hours'].includes(id) ? '24' : id === 'in-prot-conc' ? '10' : id === 'in-lipid-conc' ? '20' : id === 'in-glu-conc-manual' ? '10' : '0';
    });
    calculateAll();
  }

  function captureForm() {
    const values = {};
    $$('input[id], select[id], textarea[id]').forEach((el) => {
      if (el.type === 'checkbox') values[el.id] = el.checked;
      else values[el.id] = el.value;
    });
    return values;
  }

  function restoreForm(values) {
    clearForm();
    if (!values || typeof values !== 'object') return;
    Object.entries(values).forEach(([id, value]) => {
      const el = $(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = Boolean(value);
      else el.value = value == null ? '' : String(value);
    });
    calculateAll();
    updateAssessmentBMI();
  }

  function captureState() {
    return {
      version: 1,
      activeTab: state.activeTab,
      activeEnteral: state.activeEnteral,
      values: captureForm()
    };
  }

  function selectDay(day, shouldRender = true) {
    if (!day) return;
    state.currentDayId = day.id;
    state.currentDayDate = day.day_date;
    restoreForm(day.state || {});
    updateDayLabel();
    if (shouldRender) renderDays();
  }

  async function addDay() {
    if (!state.patient || !state.user) return;
    const date = window.prompt('تاريخ يوم المتابعة (YYYY-MM-DD):', todayKey());
    if (!date) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      showStatus('صيغة التاريخ غير صحيحة.', 'error');
      return;
    }

    const exists = state.days.some((d) => d.day_date === date);
    if (exists) {
      showStatus('يوجد يوم متابعة بهذا التاريخ بالفعل.', 'error');
      return;
    }

    const initialValues = {};
    $$('input[id], select[id], textarea[id]').forEach((el) => {
      if (el.type === 'checkbox') initialValues[el.id] = el.checked;
      else initialValues[el.id] = '';
    });
    initialValues['assessment-height'] = state.patient.height || '';
    initialValues['en-hours'] = '3';
    initialValues['cb-freq-hours'] = '3';
    initialValues['tpn-infusion-hours'] = '24';
    initialValues['in-prot-conc'] = '10';
    initialValues['in-lipid-conc'] = '20';
    initialValues['in-glu-conc-manual'] = '10';
    const initialState = {
      version: 1,
      activeTab: 'assessment',
      activeEnteral: 'volume',
      values: initialValues
    };
    const { data, error } = await supabase
      .from('nutrition_support_days')
      .insert({
        patient_id: state.patient.id,
        user_id: state.user.id,
        day_date: date,
        state: initialState
      })
      .select('id,patient_id,user_id,day_date,state,created_at,updated_at')
      .single();

    if (error) {
      showStatus(error.message || 'تعذر إضافة اليوم.', 'error');
      return;
    }

    state.days.unshift(data);
    selectDay(data);
    showStatus('تمت إضافة يوم المتابعة.', 'success');
  }

  async function saveDay() {
    if (!state.currentDayId) {
      showStatus('أضف يوم متابعة أولًا.', 'error');
      return;
    }
    const { data, error } = await supabase
      .from('nutrition_support_days')
      .update({ state: captureState() })
      .eq('id', state.currentDayId)
      .eq('patient_id', state.patient.id)
      .eq('user_id', state.user.id)
      .select('id,patient_id,user_id,day_date,state,created_at,updated_at')
      .single();

    if (error) {
      showStatus(error.message || 'تعذر حفظ اليوم.', 'error');
      return;
    }
    const index = state.days.findIndex((d) => d.id === data.id);
    if (index >= 0) state.days[index] = data;
    state.currentDayDate = data.day_date;
    renderDays();
    showStatus('تم حفظ يوم المتابعة.', 'success');
  }

  async function deleteDay() {
    if (!state.currentDayId) return;
    if (!window.confirm('هل تريد حذف يوم المتابعة الحالي؟')) return;

    const { error } = await supabase
      .from('nutrition_support_days')
      .delete()
      .eq('id', state.currentDayId)
      .eq('patient_id', state.patient.id)
      .eq('user_id', state.user.id);

    if (error) {
      showStatus(error.message || 'تعذر حذف اليوم.', 'error');
      return;
    }

    state.days = state.days.filter((d) => d.id !== state.currentDayId);
    state.currentDayId = null;
    state.currentDayDate = null;
    if (state.days.length) selectDay(state.days[0], false);
    else clearForm();
    renderDays();
    updateDayLabel();
    showStatus('تم حذف يوم المتابعة.', 'success');
  }

  function activateTab(name) {
    state.activeTab = name;
    $$('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === name));
    $$('[data-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.panel !== name));
    if (name === 'enteral') calculateEN();
    if (name === 'parenteral') calculateTPN();
  }

  function activateEnteral(name) {
    state.activeEnteral = name;
    $$('[data-entab]').forEach((button) => {
      const active = button.dataset.entab === name;
      button.classList.toggle('active', active);
      button.classList.toggle('bg-slate-100', !active);
    });
    $$('[data-enpanel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.enpanel !== name));
    if (name === 'volume') calculateEN(); else calculateCalorieBased();
  }

  function updateAssessmentBMI() {
    const weight = parseNumber('assessment-weight');
    const height = parseNumber('assessment-height') / 100;
    const bmi = weight > 0 && height > 0 ? weight / (height * height) : 0;
    setText('assessment-bmi', bmi > 0 ? bmi.toFixed(1) : '—');
  }

  function calculateEN() {
    const w = parseNumber('en-weight');
    const hours = parseNumber('en-hours') || 24;
    const init = parseNumber('en-init-rate');
    const advance = parseNumber('en-advance');
    const goal = parseNumber('en-goal');
    const frequency = 24 / hours;
    setText('res-en-start', frequency > 0 ? ((init * w) / frequency).toFixed(1) : '0');
    setText('res-en-inc', frequency > 0 ? ((advance * w) / frequency).toFixed(1) : '0');
    setText('res-en-max', frequency > 0 ? ((goal * w) / frequency).toFixed(1) : '0');
    setText('res-en-interval', hours);
  }

  function calculateCalorieBased() {
    const weight = parseNumber('cb-weight');
    const kcalKg = parseNumber('cb-kcal-kg');
    const targetWaterKg = parseNumber('cb-target-water');
    const targetProteinKg = parseNumber('cb-target-protein');
    const totalCalories = weight * kcalKg;
    const totalWater = weight * targetWaterKg;
    const totalProtein = weight * targetProteinKg;
    const freeWaterPct = parseNumber('cb-free-water-pct');
    const density = parseNumber('cb-caloric-density');
    const proteinDensity = parseNumber('cb-protein-density');
    const volume = density > 0 ? totalCalories / density : 0;
    const waterFromFormula = freeWaterPct * 0.01 * volume;
    const waterGap = waterFromFormula - totalWater;
    const proteinProvided = proteinDensity * volume * 0.01;
    const proteinGap = proteinProvided - totalProtein;
    const frequencyHours = parseNumber('cb-freq-hours') || 24;
    const frequency = 24 / frequencyHours;
    const start = frequency > 0 ? volume * (parseNumber('cb-init-pct') * 0.01) / frequency : 0;
    const increment = frequency > 0 ? volume * (parseNumber('cb-advance-pct') * 0.01) / frequency : 0;
    const goal = frequency > 0 ? volume / frequency : 0;

    setText('cb-res-total-cal', totalCalories.toFixed(1));
    setText('cb-res-total-water', totalWater.toFixed(1));
    setText('cb-res-total-protein', totalProtein.toFixed(1));
    setText('cb-res-feeding-volume', volume.toFixed(2));
    setText('cb-res-water-gap', waterGap.toFixed(2));
    setText('cb-res-protein-gap', proteinGap.toFixed(2));
    setText('cb-res-summary-start', start.toFixed(2));
    setText('cb-res-summary-goal', goal.toFixed(2));
    setText('cb-water-gap-msg', waterGap < 0 ? `الماء أقل من الاحتياج بمقدار ${Math.abs(waterGap).toFixed(2)} mL.` : waterGap > 0 ? `الماء من التركيبة يتجاوز الاحتياج بمقدار ${waterGap.toFixed(2)} mL.` : 'الماء المقدم يساوي الاحتياج.');
    setText('cb-protein-gap-msg', proteinGap < 0 ? `البروتين أقل من الاحتياج بمقدار ${Math.abs(proteinGap).toFixed(2)} g.` : proteinGap > 0 ? `البروتين أعلى من الاحتياج بمقدار ${proteinGap.toFixed(2)} g.` : 'البروتين المقدم يساوي الاحتياج.');
  }

  function calculateTPN() {
    const w = parseNumber('tpn-weight');
    const fluidTarget = parseNumber('tpn-fluid-kg') * w;
    const entFluid = parseNumber('tpn-enteral-fluid');
    const otherFluid = parseNumber('tpn-other-input');
    const tpnFluid = fluidTarget - entFluid - otherFluid;
    const enteralEnergy = entFluid * parseNumber('tpn-caloric-density');
    const targetEnergyKg = parseNumber('tpn-target-energy-kg');
    const energyNeed = Math.max(0, targetEnergyKg - (w > 0 ? enteralEnergy / w : 0));

    const pG = parseNumber('in-prot') * w;
    const pConc = parseNumber('in-prot-conc');
    const pV = pConc > 0 ? pG / (pConc / 100) : 0;
    const lG = parseNumber('in-lipid') * w;
    const lConc = parseNumber('in-lipid-conc');
    const lV = lConc > 0 ? lG / (lConc / 100) : 0;
    const phos = parseNumber('in-phos') * w;
    const naRaw = parseNumber('in-nacl') * w;
    const na = Math.max(0, naRaw - (2 * phos));
    const naclType = $('sel-nacl-type')?.value || '0.154';
    const naV = naclType === '3' ? na / 0.513 : na / 0.154;
    const k = parseNumber('in-kcl') * w;
    const kV = k / 2;
    const ca = parseNumber('in-ca') * w;
    const caV = ca / 0.23;
    const mg = parseNumber('in-mg') * w;
    const mgV = mg / 0.41;
    const traceV = parseNumber('in-trace-vol') * w;
    const vitaV = parseNumber('in-vitalipid-vol') * w;
    const soluV = parseNumber('in-soluvito-vol') * w;
    const otherG = parseNumber('in-glu-other-rate') * parseNumber('in-glu-other-dur') * parseNumber('in-glu-other-conc') / 100;

    const glucoseVolume = tpnFluid - (pV + lV + naV + kV + caV + mgV + phos + traceV + vitaV + soluV);
    const mode = $('glu-input-mode')?.value || 'gir';
    const auto = $('glu-toggle-auto')?.checked !== false;
    let glucoseConc = 0;
    let tpnGlucoseG = 0;
    let totalGlucoseG = 0;

    if (mode === 'remaining-calories') {
      const totalTpnCalories = Math.max(0, (targetEnergyKg * w) - enteralEnergy);
      const glucoseCalories = Math.max(0, totalTpnCalories - (pG * 4) - (lG * 10) - (otherG * 3.4));
      totalGlucoseG = glucoseCalories / 3.4;
      tpnGlucoseG = Math.max(0, totalGlucoseG - otherG);
    } else if (auto) {
      totalGlucoseG = (parseNumber('in-gir') * w * 1440) / 1000;
      tpnGlucoseG = totalGlucoseG - otherG;
    } else {
      glucoseConc = parseNumber('in-glu-conc-manual');
      tpnGlucoseG = glucoseVolume * glucoseConc / 100;
      totalGlucoseG = tpnGlucoseG + otherG;
    }

    if (mode !== 'gir' || auto) glucoseConc = glucoseVolume > 0 ? (tpnGlucoseG / glucoseVolume) * 100 : 0;
    const tpnEnergy = (pG * 4) + (lG * 10) + (tpnGlucoseG * 3.4);
    const infusionHours = parseNumber('tpn-infusion-hours') || 24;
    const rate = infusionHours > 0 ? tpnFluid / infusionHours : 0;
    const osm = tpnFluid > 0 ? (pG * 10 + tpnGlucoseG * 5 + (na + k + ca + mg) * 2) / (tpnFluid / 1000) : 0;

    setText('res-tpn-remain-fluid', tpnFluid.toFixed(1));
    setText('res-enteral-energy', `${enteralEnergy.toFixed(1)} kcal`);
    setText('res-prot-total', pG.toFixed(1)); setText('res-prot-vol', pV.toFixed(1)); setText('res-prot-kcal', (pG * 4).toFixed(0));
    setText('res-lipid-total', lG.toFixed(1)); setText('res-lipid-vol', lV.toFixed(1)); setText('res-lipid-kcal', (lG * 10).toFixed(0));
    setText('res-glu-total-final', `${totalGlucoseG.toFixed(1)} g`); setText('res-glu-vol-tpn', tpnGlucoseG > 0 ? glucoseVolume.toFixed(1) : '0'); setText('res-glu-conc', `${Number.isFinite(glucoseConc) ? glucoseConc.toFixed(1) : '0'}%`);
    setText('res-tpn-total-vol', tpnFluid.toFixed(1)); setText('res-tpn-total-kcal', tpnEnergy.toFixed(0)); setText('res-osmolarity', Number.isFinite(osm) ? Math.round(osm) : '0'); setText('res-tpn-rate', `${Number.isFinite(rate) ? rate.toFixed(1) : '0'} ml/hr`);
    setText('res-glu-conc-display', `${glucoseConc.toFixed(1)}%`);
    setText('res-tpn-energy-need', `${energyNeed.toFixed(1)} kcal/kg`);
  }

  function calculateAll() {
    updateAssessmentBMI();
    calculateEN();
    calculateCalorieBased();
    calculateTPN();
  }

  function printPage() {
    window.print();
  }

  function handleClick(event) {
    const actionTarget = event.target.closest('[data-action]');
    if (actionTarget) {
      const action = actionTarget.dataset.action;
      if (action === 'add-day') addDay();
      else if (action === 'save-day') saveDay();
      else if (action === 'delete-day') deleteDay();
      else if (action === 'print') printPage();
      return;
    }

    const tab = event.target.closest('[data-tab]');
    if (tab) { activateTab(tab.dataset.tab); return; }
    const entab = event.target.closest('[data-entab]');
    if (entab) { activateEnteral(entab.dataset.entab); return; }
    const day = event.target.closest('[data-day-id]');
    if (day) {
      const found = state.days.find((item) => item.id === day.dataset.dayId);
      if (found) selectDay(found);
    }
  }

  function handleInput(event) {
    const id = event.target.id;
    if (id === 'assessment-weight' || id === 'assessment-height') updateAssessmentBMI();
    if (id.startsWith('en-') || id.startsWith('cb-')) {
      if (state.activeEnteral === 'volume') calculateEN(); else calculateCalorieBased();
    }
    if (id.startsWith('tpn-') || id.startsWith('in-') || id.startsWith('glu-') || id === 'sel-nacl-type') calculateTPN();
  }

  function handleChange(event) {
    const id = event.target.id;
    if (id === 'glu-input-mode' || id === 'glu-toggle-auto' || id === 'tpn-type-select' || id === 'sel-nacl-type') calculateTPN();
  }

  function bindEvents() {
    document.addEventListener('click', handleClick);
    document.addEventListener('input', handleInput);
    document.addEventListener('change', handleChange);
  }

  async function init() {
    bindEvents();
    if (!access || !supabase) {
      showStatus('تعذر تحميل نظام الدخول أو قاعدة البيانات.', 'error');
      return;
    }
    try {
      state.user = await access.getCurrentUser();
      if (!state.user) {
        window.location.href = 'index.html';
        return;
      }
      await loadPatient();
      await loadDays();
      if (!state.days.length) {
        const height = $('assessment-height');
        if (height) height.value = state.patient.height || '';
      }
      calculateAll();
    } catch (error) {
      console.error(error);
      setText('patient-name', 'تعذر تحميل بيانات المريض');
      showStatus(error.message || 'حدث خطأ أثناء تحميل الصفحة.', 'error');
    }
  }

  window.addEventListener('DOMContentLoaded', init, { once: true });
})();
