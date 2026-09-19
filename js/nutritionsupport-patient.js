/* ============================================================
   DIET PLANNER — NUTRITION SUPPORT PATIENT
   Rebuilt from scratch around the existing nutrition_support_days table.
   One page + one JS file. Calculations are source-derived from the
   previous EN/TPN calculators; database flow is intentionally unchanged.
   ============================================================ */

'use strict';

const access = window.DietPlannerAccess;
const supabase = access?.supabaseClient;
const $ = id => document.getElementById(id);
const PRINT_SETTINGS_KEY = 'dietPlannerNutritionSupportPrintSettings';

const state = {
  user: null,
  patient: null,
  days: [],
  currentDayId: null,
  defaults: null,
  editing: false,
  activeTab: 'assessment',
  enApproach: 'volume',
  busy: {add:false,save:false,delete:false}
};

function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0,10);
}
function fmtDate(value) {
  if (!value) return '—';
  const a = String(value).slice(0,10).split('-');
  return a.length === 3 ? `${a[2]}/${a[1]}/${a[0]}` : String(value);
}
function gender(value) {
  return value === 'male' ? 'ذكر' : value === 'female' ? 'أنثى' : value || '—';
}
function setBusy(button, busy, textBusy, textNormal) {
  if (!button) return;
  button.disabled = busy;
  if (busy) button.dataset.originalText = button.textContent;
  button.textContent = busy ? textBusy : (textNormal || button.dataset.originalText || '');
}

/* ------------------------- DAY STATE ------------------------- */
function dayControls() {
  return document.querySelectorAll(
    '#assessment-pane input:not([readonly]),#assessment-pane select,#assessment-pane textarea,' +
    '#section-en input,#section-en select,#section-en textarea,' +
    '#section-tpn input,#section-tpn select,#section-tpn textarea,' +
    '#quick-tools input,#quick-tools select,#quick-tools textarea'
  );
}
function captureDayState() {
  const data = {};
  dayControls().forEach(el => {
    if (!el.id) return;
    if (el.type === 'checkbox' || el.type === 'radio') data[el.id] = {value: el.value, checked: el.checked};
    else data[el.id] = {value: el.value};
  });
  data.__tab = state.activeTab;
  data.__enApproach = state.enApproach;
  return data;
}
function restoreDayState(saved) {
  const data = saved || {};
  dayControls().forEach(el => {
    if (!el.id || !data[el.id]) return;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!data[el.id].checked;
    else el.value = data[el.id].value ?? '';
  });
  setMainTab(data.__tab || 'assessment', false);
  setENApproach(data.__enApproach || 'volume', false);
  // Create any dynamic controls first (for example the 2-in-1 TPN duration fields).
  ['tpn-type-select','glu-input-mode','dex-mode'].forEach(id => {
    const el = $(id);
    if (el && data[id]) el.dispatchEvent(new Event('change', {bubbles:true}));
  });
  // Re-apply after dynamic controls have been created so saved values are not lost.
  dayControls().forEach(el => {
    if (!el.id || !data[el.id]) return;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!data[el.id].checked;
    else el.value = data[el.id].value ?? '';
  });
  dayControls().forEach(el => {
    el.dispatchEvent(new Event(el.type === 'checkbox' || el.type === 'radio' ? 'change' : 'input', {bubbles:true}));
  });
  dayControls().forEach(el => el.dispatchEvent(new Event('change', {bubbles:true})));
}
function setDayEditMode(editing) {
  state.editing = !!editing;
  document.body.classList.toggle('locked', !state.editing);
  dayControls().forEach(el => el.disabled = !state.editing);
  const edit = $('editDayBtn');
  const save = $('saveDayBtn');
  if (edit) edit.disabled = state.editing || !state.currentDayId;
  if (save) save.disabled = !state.editing || !state.currentDayId;
}
function renderDays() {
  const list = $('dayList');
  if (!list) return;
  list.replaceChildren();
  if (!state.days.length) {
    const empty = document.createElement('div');
    empty.className = 'text-slate-400 text-xs py-1';
    empty.textContent = 'لا توجد أيام متابعة مضافة بعد.';
    list.appendChild(empty);
    return;
  }
  [...state.days].sort((a,b) => String(a.day_date).localeCompare(String(b.day_date))).forEach(day => {
    const row = document.createElement('div');
    row.className = 'day-row';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'day-item' + (day.id === state.currentDayId ? ' active' : '');
    open.textContent = fmtDate(day.day_date);
    open.addEventListener('click', () => selectDay(day.id));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'day-delete';
    del.textContent = '×';
    del.title = 'حذف اليوم';
    del.addEventListener('click', e => { e.stopPropagation(); deleteDay(day.id); });
    row.append(open, del);
    list.appendChild(row);
  });
}
function showDeleteConfirm(dayText) {
  return new Promise(resolve => {
    const overlay = $('deleteConfirmOverlay');
    const text = $('deleteConfirmText');
    const ok = $('deleteConfirmOk');
    const cancel = $('deleteConfirmCancel');
    if (!overlay || !text || !ok || !cancel) { resolve(false); return; }
    text.innerHTML = `هل أنت متأكد من حذف يوم <strong>${dayText}</strong>؟<br>سيتم حذف جميع بيانات الدعم الغذائي المحفوظة لهذا اليوم.`;
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden','false');
    const close = value => {
      overlay.classList.remove('show');
      overlay.setAttribute('aria-hidden','true');
      ok.onclick = null; cancel.onclick = null; overlay.onclick = null;
      resolve(value);
    };
    ok.onclick = () => close(true);
    cancel.onclick = () => close(false);
    overlay.onclick = e => { if (e.target === overlay) close(false); };
  });
}
async function addSupportDay() {
  if (state.busy.add) return;
  const date = $('newDayDate')?.value;
  if (!date) { alert('اختر تاريخ اليوم أولاً.'); return; }
  if (!state.patient || !state.user) { alert('لم يتم تحميل المريض بعد.'); return; }
  const existing = state.days.find(x => String(x.day_date).slice(0,10) === date);
  if (existing) { await selectDay(existing.id); return; }
  const blank = state.defaults ? JSON.parse(JSON.stringify(state.defaults)) : captureDayState();
  blank.__date = date;
  blank.__tab = 'assessment';
  blank.__enApproach = 'volume';
  state.busy.add = true;
  setBusy(document.querySelector('[data-action="add-day"]'), true, 'جاري الإضافة…');
  try {
    const {data,error} = await supabase.from('nutrition_support_days')
      .insert({patient_id:state.patient.id,user_id:state.user.id,day_date:date,state:blank})
      .select('id,patient_id,user_id,day_date,state,created_at,updated_at').single();
    if (error) throw error;
    state.days.push(data);
    state.currentDayId = data.id;
    restoreDayState(blank);
    $('report-date').value = date;
    renderDays();
    setDayEditMode(true);
  } catch (error) {
    console.error('Add nutrition support day failed:', error);
    alert('تعذر إضافة اليوم: ' + (error?.message || 'تحقق من صلاحيات قاعدة البيانات.'));
  } finally {
    state.busy.add = false;
    setBusy(document.querySelector('[data-action="add-day"]'), false, '', 'إضافة يوم');
  }
}
async function selectDay(id) {
  if (id === state.currentDayId) return;
  const day = state.days.find(x => x.id === id);
  if (!day) return;
  state.currentDayId = id;
  restoreDayState(day.state || {});
  $('report-date').value = day.day_date;
  renderDays();
  setDayEditMode(false);
}
async function saveCurrentDay() {
  if (state.busy.save) return false;
  if (!state.currentDayId || !state.patient || !state.user) { alert('أضف يومًا أولاً ثم اضغط تعديل.'); return false; }
  const day = state.days.find(x => x.id === state.currentDayId);
  if (!day) return false;
  const saved = captureDayState();
  saved.__date = day.day_date;
  state.busy.save = true;
  setBusy($('saveDayBtn'), true, 'جاري الحفظ…');
  try {
    const {data,error} = await supabase.from('nutrition_support_days')
      .update({state:saved,updated_at:new Date().toISOString()})
      .eq('id',day.id).eq('patient_id',state.patient.id).eq('user_id',state.user.id)
      .select('id,patient_id,user_id,day_date,state,created_at,updated_at').maybeSingle();
    if (error) throw error;
    if (data) {
      const index = state.days.findIndex(x => x.id === day.id);
      if (index >= 0) state.days[index] = data;
    }
    setDayEditMode(false);
    renderDays();
    return true;
  } catch (error) {
    console.error('Save nutrition support day failed:', error);
    alert('تعذر حفظ بيانات هذا اليوم: ' + (error?.message || 'تحقق من صلاحيات قاعدة البيانات.'));
    return false;
  } finally {
    state.busy.save = false;
    setBusy($('saveDayBtn'), false, '', 'حفظ');
  }
}
async function deleteDay(id) {
  if (state.busy.delete) return;
  const day = state.days.find(x => x.id === id);
  if (!day) return;
  if (!(await showDeleteConfirm(fmtDate(day.day_date)))) return;
  state.busy.delete = true;
  try {
    const {error} = await supabase.from('nutrition_support_days').delete()
      .eq('id',id).eq('patient_id',state.patient.id).eq('user_id',state.user.id);
    if (error) throw error;
    state.days = state.days.filter(x => x.id !== id);
    if (state.currentDayId === id) {
      const next = [...state.days].sort((a,b)=>String(b.day_date).localeCompare(String(a.day_date)))[0];
      if (next) {
        state.currentDayId = next.id;
        restoreDayState(next.state || {});
        $('report-date').value = next.day_date;
        setDayEditMode(false);
      } else {
        state.currentDayId = null;
        restoreDayState(state.defaults || {});
        $('report-date').value = '';
        setDayEditMode(false);
      }
    }
    renderDays();
  } catch (error) {
    console.error('Delete nutrition support day failed:', error);
    alert('تعذر حذف اليوم: ' + (error?.message || 'تحقق من صلاحيات قاعدة البيانات.'));
  } finally { state.busy.delete = false; }
}
async function initSupportDays() {
  state.days = [];
  state.currentDayId = null;
  const date = $('newDayDate');
  if (date) date.value = todayISO();
  state.defaults = captureDayState();
  try {
    const {data,error} = await supabase.from('nutrition_support_days')
      .select('id,patient_id,user_id,day_date,state,created_at,updated_at')
      .eq('patient_id',state.patient.id).eq('user_id',state.user.id)
      .order('day_date',{ascending:true});
    if (error) throw error;
    state.days = data || [];
    if (state.days.length) {
      const latest = state.days[state.days.length - 1];
      state.currentDayId = latest.id;
      restoreDayState(latest.state || {});
      $('report-date').value = latest.day_date;
    }
    renderDays();
    setDayEditMode(false);
  } catch (error) {
    console.error('nutrition_support_days load failed:', error);
    renderDays();
    setDayEditMode(false);
    alert('تعذر تحميل أيام الدعم الغذائي: ' + (error?.message || 'تحقق من صلاحيات قاعدة البيانات.'));
  }
}

/* ------------------------- TABS ------------------------- */
function setMainTab(tab, persist = true) {
  state.activeTab = ['assessment','enteral','parenteral'].includes(tab) ? tab : 'assessment';
  document.querySelectorAll('.main-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === state.activeTab));
  $('assessment-pane')?.classList.toggle('hidden', state.activeTab !== 'assessment');
  $('enteral-pane')?.classList.toggle('hidden', state.activeTab !== 'enteral');
  $('parenteral-pane')?.classList.toggle('hidden', state.activeTab !== 'parenteral');
}
function setENApproach(approach, persist = true) {
  state.enApproach = approach === 'calories' ? 'calories' : 'volume';
  document.querySelectorAll('[data-en-approach]').forEach(btn => btn.classList.toggle('active', btn.dataset.enApproach === state.enApproach));
  $('en-volume-panel')?.classList.toggle('hidden', state.enApproach !== 'volume');
  $('en-calories-panel')?.classList.toggle('hidden', state.enApproach !== 'calories');
}
function togglePatientData() {
  const content = $('patientDataContent');
  const arrow = $('patientDataArrow');
  if (!content || !arrow) return;
  const hidden = content.classList.toggle('hidden');
  arrow.className = hidden ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
}
function toggleTools() {
  const box = $('quick-tools');
  const arrow = $('tools-arrow');
  if (!box) return;
  const hidden = box.classList.toggle('hidden');
  if (arrow) arrow.className = hidden ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
}

/* ------------------------- PRINT ------------------------- */
function loadPrintSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRINT_SETTINGS_KEY) || '{}');
    $('printDoctorName').value = saved.doctor || '';
    $('printSpecialty').value = saved.specialty || '';
    $('printClinicName').value = saved.clinic || '';
    $('printAddress').value = saved.address || '';
  } catch (e) { console.warn('Print settings load failed', e); }
}
function savePrintSettings(values) {
  try { localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(values)); } catch (e) { console.warn('Print settings save failed', e); }
}
function showPrintCompletion(message) {
  const overlay = $('printCompletionOverlay');
  if (!overlay) return;
  $('printCompletionMessage').textContent = message;
  overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false');
}
function closePrintCompletion() {
  const overlay = $('printCompletionOverlay');
  if (!overlay) return;
  overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true');
}
function smartPrint() {
  const hasEN = (parseFloat($('en-weight')?.value)||0) > 0 || (parseFloat($('cb-weight')?.value)||0) > 0;
  const hasPN = (parseFloat($('tpn-weight')?.value)||0) > 0;
  if (!hasEN && !hasPN) { alert('من فضلك أدخل بيانات التغذية قبل طباعة التقرير.'); return; }
  loadPrintSettings();
  $('printSettingsOverlay')?.classList.add('show');
  $('printSettingsOverlay')?.setAttribute('aria-hidden','false');
  setTimeout(() => $('printDoctorName')?.focus(), 40);
}
function closePrintSettings() {
  $('printSettingsOverlay')?.classList.remove('show');
  $('printSettingsOverlay')?.setAttribute('aria-hidden','true');
}
function confirmSupportPrint() {
  const doctor = ($('printDoctorName')?.value || '').trim();
  const specialty = ($('printSpecialty')?.value || '').trim();
  const clinic = ($('printClinicName')?.value || '').trim();
  const address = ($('printAddress')?.value || '').trim();
  if (!doctor || !specialty || !clinic || !address) {
    showPrintCompletion('من فضلك أكمل اسم الطبيب والتخصص واسم العيادة والعنوان قبل الطباعة.');
    return;
  }
  savePrintSettings({doctor,specialty,clinic,address});
  $('printHeaderDoctor').textContent = doctor;
  $('printHeaderSpecialty').textContent = specialty;
  $('printHeaderClinic').textContent = clinic;
  $('printHeaderAddress').textContent = address;
  const hasEN = (parseFloat($('en-weight')?.value)||0) > 0 || (parseFloat($('cb-weight')?.value)||0) > 0;
  const hasPN = (parseFloat($('tpn-weight')?.value)||0) > 0;
  document.body.classList.add('print-report');
  document.body.classList.toggle('print-en', hasEN);
  document.body.classList.toggle('print-tpn', hasPN);
  closePrintSettings();
  setTimeout(() => window.print(), 80);
}
window.addEventListener('afterprint', () => document.body.classList.remove('print-report','print-en','print-tpn'));

/* ------------------------- CALCULATIONS: ENTERAL ------------------------- */
/* =========================================================
   NUTRITION SUPPORT PATIENT — ENTERAL NUTRITION
   All EN calculations and EN-specific UI helpers.
   ========================================================= */

function calculateBreastmilkFortification() {

        const targetKcal =
            parseFloat(
                document.getElementById('bmf-target-kcal').value
            ) || 0;

        const volume =
            parseFloat(
                document.getElementById('bmf-volume').value
            ) || 0;

        const requiredTsp =
            (
                volume / 90
            ) *
            (
                (targetKcal - 20) / 4
            );

        document.getElementById('bmf-res-tsp').innerText =
            `${requiredTsp.toFixed(2)} leveled tsp`;

        document.getElementById('bmf-res-instruction').innerText =
            `Add ${requiredTsp.toFixed(2)} leveled teaspoonful${Math.abs(requiredTsp - 1) < 0.0001 ? '' : 's'} of formula powder to ${volume.toFixed(0)} mL breast milk.`;

    }

function convertDensityToKcalPerMl(value, unit) {

        if (!isFinite(value) || value <= 0) {
            return 0;
        }

        if (unit === 'kcal/oz') {

            /*
             * 1 US fl oz = 29.5735 mL
             *
             * kcal/mL = kcal/oz ÷ 29.5735
             */

            return value / 29.5735;

        }

        return value;

    }

function convertKcalPerMlToUnit(value, unit) {

        if (!isFinite(value) || value <= 0) {
            return 0;
        }

        if (unit === 'kcal/oz') {

            /*
             * kcal/oz = kcal/mL × 29.5735
             */

            return value * 29.5735;

        }

        return value;

    }

function calculateFormulaConcentration() {

        const normalScoops =
            parseFloat(
                document.getElementById('fc-normal-scoops').value
            ) || 0;

        const normalWater =
            parseFloat(
                document.getElementById('fc-normal-water').value
            ) || 0;

        const normalDensityInput =
            parseFloat(
                document.getElementById('fc-normal-density').value
            ) || 0;

        const normalDensityUnit =
            document.getElementById('fc-normal-density-unit').value;

        const requiredDensityInput =
            parseFloat(
                document.getElementById('fc-required-density').value
            ) || 0;

        const requiredDensityUnit =
            document.getElementById('fc-required-density-unit').value;

        const method =
            document.getElementById('fc-method').value;

        const multiplier =
            parseFloat(
                document.getElementById('fc-volume-multiplier').value
            ) || 1;

        const resultEl =
            document.getElementById('fc-res-text');

        const densityEl =
            document.getElementById('fc-res-density');

        const changeEl =
            document.getElementById('fc-res-change');

        const normalDisplayEl =
            document.getElementById('fc-normal-density-display');


        /*
         * Basic validation
         */

        if (
            normalScoops <= 0 ||
            normalWater <= 0 ||
            normalDensityInput <= 0 ||
            requiredDensityInput <= 0 ||
            multiplier <= 0
        ) {

            resultEl.innerText =
                "Enter valid parameters to calculate.";

            densityEl.innerText =
                "Required Caloric Density: —";

            changeEl.innerText = "";

            if (normalDisplayEl) {
                normalDisplayEl.innerText = "—";
            }

            return;

        }


        /*
         * Convert both values to kcal/mL
         * before performing comparison and calculation.
         */

        const normalDensity =
            convertDensityToKcalPerMl(
                normalDensityInput,
                normalDensityUnit
            );

        const requiredDensity =
            convertDensityToKcalPerMl(
                requiredDensityInput,
                requiredDensityUnit
            );


        /*
         * Display normalized normal density.
         */

        if (normalDisplayEl) {

            normalDisplayEl.innerText =
                `${normalDensity.toFixed(3)} kcal/mL`;

        }


        /*
         * The original calculator is intended
         * for concentration increase.
         */

        if (requiredDensity <= normalDensity) {

            resultEl.innerText =
                "Required Caloric Density should be higher than Normal Caloric Density for this adjustment.";

            densityEl.innerText =
                `Required Caloric Density: ${requiredDensityInput.toFixed(2)} ${requiredDensityUnit}`;

            changeEl.innerText = "";

            return;

        }


        /*
         * Original hidden calculation:
         *
         * % change = (Required − Normal) ÷ Normal × 100
         *
         * The calculation is performed using
         * the common kcal/mL unit.
         */

        const percentChange =
            (
                (requiredDensity - normalDensity)
                / normalDensity
            ) * 100;


        /*
         * Original preparation values
         */

        let finalScoops =
            normalScoops;

        let finalWater =
            normalWater;


        /*
         * Reduce Water:
         * decrease water by the same percentage
         */

        if (method === 'water') {

            finalWater =
                normalWater *
                (1 - percentChange / 100);

            finalScoops =
                normalScoops;

        }


        /*
         * Increase Powder:
         * increase scoops by the same percentage
         */

        else {

            finalScoops =
                normalScoops *
                (1 + percentChange / 100);

            finalWater =
                normalWater;

        }


        if (finalWater <= 0) {

            resultEl.innerText =
                "The calculated water volume is not valid. Please review the selected densities.";

            densityEl.innerText =
                `Required Caloric Density: ${requiredDensityInput.toFixed(2)} ${requiredDensityUnit}`;

            changeEl.innerText = "";

            return;

        }


        /*
         * Volume Multiplier:
         * multiply ALL preparation quantities
         * while maintaining the same concentration.
         */

        const scaledScoops =
            finalScoops * multiplier;

        const scaledWater =
            finalWater * multiplier;


        /*
         * Display result.
         */

        if (method === 'water') {

            resultEl.innerHTML =

                `Reduce Water:<br>` +

                `<span class="text-purple-700">` +

                `${scaledScoops.toFixed(2)} scoop(s) + ` +

                `${scaledWater.toFixed(1)} mL water` +

                `</span><br>` +

                `= ${requiredDensityInput.toFixed(2)} ${requiredDensityUnit}`;

        } else {

            resultEl.innerHTML =

                `Increase Powder:<br>` +

                `<span class="text-purple-700">` +

                `${scaledScoops.toFixed(2)} scoop(s) + ` +

                `${scaledWater.toFixed(1)} mL water` +

                `</span><br>` +

                `= ${requiredDensityInput.toFixed(2)} ${requiredDensityUnit}`;

        }


        densityEl.innerText =

            `Required Caloric Density: ` +

            `${requiredDensityInput.toFixed(2)} ${requiredDensityUnit} ` +

            `| Volume Multiplier: ×${multiplier}`;


        changeEl.innerText =

            `Concentration change: ${percentChange.toFixed(1)}%`;

    }

function calculateCalorieBased() {

        const weight =
            parseFloat(
                document.getElementById('cb-weight').value
            ) || 0;

        const kcalKg =
            parseFloat(
                document.getElementById('cb-kcal-kg').value
            ) || 0;

        const targetWaterKg =
            parseFloat(
                document.getElementById('cb-target-water').value
            ) || 0;

        const targetProteinKg =
            parseFloat(
                document.getElementById('cb-target-protein').value
            ) || 0;


        const totalCalories =
            weight * kcalKg;

        const totalWater =
            weight * targetWaterKg;

        const totalProtein =
            weight * targetProteinKg;


        document.getElementById('cb-res-total-cal').innerText =
            totalCalories.toFixed(1);

        document.getElementById('cb-res-total-water').innerText =
            totalWater.toFixed(1);

        document.getElementById('cb-res-total-protein').innerText =
            totalProtein.toFixed(1);


        const freeWaterPct =
            parseFloat(
                document.getElementById('cb-free-water-pct').value
            ) || 0;

        const caloricDensity =
            parseFloat(
                document.getElementById('cb-caloric-density').value
            ) || 0;

        const proteinDensity =
            parseFloat(
                document.getElementById('cb-protein-density').value
            ) || 0;


        const feedingVolume =
            caloricDensity > 0
                ? (totalCalories / caloricDensity)
                : 0;


        document.getElementById('cb-res-feeding-volume').innerText =
            feedingVolume.toFixed(2);


        const waterFromFormula =
            (freeWaterPct * 0.01) *
            feedingVolume;

        const waterGap =
            waterFromFormula -
            totalWater;


        document.getElementById('cb-res-water-gap').innerText =
            waterGap.toFixed(2);


        const waterGapMsgEl =
            document.getElementById('cb-water-gap-msg');

        let flushDeficit = 0;


        if (waterGap > 0) {

            const targetCaloricDensityVal =
                totalWater > 0
                    ? ((totalCalories / totalWater) * 1.17).toFixed(2)
                    : "0.8";

            waterGapMsgEl.innerText =
                `Water from formula exceeds requirements, Consider increasing caloric density to >= ${targetCaloricDensityVal} Kcal/ml`;

            document
                .getElementById('cb-res-summary-flush-container')
                .classList.add('hidden');

        }

        else if (waterGap < 0) {

            flushDeficit =
                Math.abs(waterGap);

            waterGapMsgEl.innerText =
                `Provided water is short by ${flushDeficit.toFixed(2)} ml. Administer this deficit as flushing throughout the day.`;

            document
                .getElementById('cb-res-summary-flush-container')
                .classList.remove('hidden');

            document.getElementById('cb-res-summary-flush').innerText =
                flushDeficit.toFixed(2);

        }

        else {

            waterGapMsgEl.innerText =
                `Provided water meets exact requirement.`;

            document
                .getElementById('cb-res-summary-flush-container')
                .classList.add('hidden');

        }


        const providedProteinG =
            proteinDensity *
            feedingVolume *
            0.01;

        const proteinGap =
            providedProteinG -
            totalProtein;


        document.getElementById('cb-res-protein-gap').innerText =
            proteinGap.toFixed(2);


        const proteinGapMsgEl =
            document.getElementById('cb-protein-gap-msg');


        if (proteinGap < 0) {

            proteinGapMsgEl.innerText =
                `provided protein is short by ${Math.abs(proteinGap).toFixed(2)} g`;

        }

        else if (proteinGap > 0) {

            const targetProteinFormulaVal =
                feedingVolume > 0
                    ? (
                        totalProtein /
                        (feedingVolume * 0.01)
                    ).toFixed(2)
                    : "0";

            proteinGapMsgEl.innerText =
                `provided protein exceeds requirements by ${proteinGap.toFixed(2)} g. Consider a formula with a target of ${targetProteinFormulaVal} g / 100 ml`;

        }

        else {

            proteinGapMsgEl.innerText =
                `provided protein meets exact requirement.`;

        }


        const initPct =
            parseFloat(
                document.getElementById('cb-init-pct').value
            ) || 0;

        const advancePct =
            parseFloat(
                document.getElementById('cb-advance-pct').value
            ) || 0;

        const freqHours =
            parseFloat(
                document.getElementById('cb-freq-hours').value
            ) || 1;


        const goalMlD =
            feedingVolume;


        document.getElementById('cb-res-goal-mld').innerText =
            goalMlD.toFixed(2);


        const freqPerDay =
            24 / freqHours;


        const startDoseMl =
            freqPerDay > 0
                ? (
                    goalMlD *
                    (initPct * 0.01)
                ) / freqPerDay
                : 0;


        const incDoseMl =
            freqPerDay > 0
                ? (
                    goalMlD *
                    (advancePct * 0.01)
                ) / freqPerDay
                : 0;


        const maxDoseMl =
            freqPerDay > 0
                ? goalMlD / freqPerDay
                : 0;


        document.getElementById('cb-res-summary-start').innerText =
            startDoseMl.toFixed(2);

        document.getElementById('cb-res-summary-freq1').innerText =
            freqHours;

        document.getElementById('cb-res-summary-inc').innerText =
            incDoseMl.toFixed(2);

        document.getElementById('cb-res-summary-goal').innerText =
            maxDoseMl.toFixed(2);

        document.getElementById('cb-res-summary-freq2').innerText =
            freqHours;

        document.getElementById('cb-res-summary-formula').innerText =
            document.getElementById('cb-formula-name').value || "-";

        document.getElementById('cb-res-summary-fort').innerText =
            document.getElementById('cb-fort-instructions').value || "-";

    }

function toggleFortifier() {

        const isYes =
            document.getElementById('en-fort-choice').value === 'yes';

        document
            .getElementById('fortifier-box')
            .classList.toggle('hidden', !isYes);

        document
            .getElementById('res-en-fort-display')
            .classList.toggle('hidden', !isYes);

    }

function calculateEN() {

        const wStr =
            document.getElementById('en-weight').value;

        const w =
            parseFloat(wStr) || 0;

        const h =
            parseFloat(
                document.getElementById('en-hours').value
            ) || 1;

        const init =
            parseFloat(
                document.getElementById('en-init-rate').value
            ) || 0;

        const adv =
            parseFloat(
                document.getElementById('en-advance').value
            ) || 0;

        const goal =
            parseFloat(
                document.getElementById('en-goal').value
            ) || 0;

        const feedOptVal =
            document.getElementById('en-option').value || "-";


        const freq =
            24 / h;


        document.getElementById('res-en-start').innerText =
            ((init * w) / freq).toFixed(1);

        document.getElementById('res-en-inc').innerText =
            ((adv * w) / freq).toFixed(1);

        document.getElementById('res-en-max').innerText =
            ((goal * w) / freq).toFixed(1);

        document.getElementById('res-en-interval').innerText =
            h;

        document.getElementById('res-en-interval-2').innerText =
            h;

        document.getElementById('res-en-final-option').innerText =
            feedOptVal;

        document.getElementById('res-en-fort-text').innerText =
            document.getElementById('en-fort-instructions').value || "None";


        calculateCalorieBased();

    }

/* ------------------------- CALCULATIONS: PARENTERAL ------------------------- */
/* =========================================================
   NUTRITION SUPPORT PATIENT — PARENTERAL NUTRITION
   TPN calculations, glucose calculations and related calculators.
   ========================================================= */

let ivLineCount = 1;

function toggleGlucoseInputMode() {

        const modeEl =
            document.getElementById('glu-input-mode');

        const girContainer =
            document.getElementById('glu-gir-input-container');

        const remainingInfo =
            document.getElementById('glu-remaining-info');

        const autoToggle =
            document.getElementById('glu-toggle-auto');

        if (!modeEl || !girContainer || !remainingInfo) {
            return;
        }

        if (modeEl.value === 'remaining-calories') {

            if (autoToggle) {

                if (
                    autoToggle.dataset.previousState === undefined
                ) {
                    autoToggle.dataset.previousState =
                        autoToggle.checked
                            ? 'true'
                            : 'false';
                }

                autoToggle.checked = true;
                autoToggle.disabled = true;

            }

            girContainer.classList.add('hidden');
            remainingInfo.classList.remove('hidden');

        }

        else {

            girContainer.classList.remove('hidden');
            remainingInfo.classList.add('hidden');

            if (autoToggle) {

                if (
                    autoToggle.dataset.previousState !== undefined
                ) {

                    autoToggle.checked =
                        autoToggle.dataset.previousState === 'true';

                    delete autoToggle.dataset.previousState;
                }

                autoToggle.disabled = false;
            }

        }

        toggleGlucoseMode();
    }

function toggleGlucoseMode() {

        const isAuto =
            document.getElementById('glu-toggle-auto').checked;

        const autoDisplay =
            document.getElementById('res-glu-conc-display');

        const manualInput =
            document.getElementById('in-glu-conc-manual');

        if (isAuto) {

            autoDisplay.classList.remove('hidden');

            manualInput.classList.add('hidden');

        } else {

            autoDisplay.classList.add('hidden');

            manualInput.classList.remove('hidden');

        }

        calculateTPN();

    }

function toggleTpnTypeMode() {

        const tpnType =
            document.getElementById('tpn-type-select').value;

        const dynamicRow =
            document.getElementById('tpn-rate-display-row');

        if (tpnType === '2in1') {

            dynamicRow.innerHTML = `

                <td colspan="6" class="p-3 bg-blue-100 text-blue-950">

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">

                        <div class="flex flex-col gap-1 bg-white p-2 rounded border border-blue-300">

                            <label>
                                Lipid Infusion Duration (h):
                            </label>

                            <input
                                type="number"
                                id="tpn-lipid-hours"
                                value="24"
                                class="bg-gray-50 border text-center"
                            >

                            <span
                                id="res-lipid-rate"
                                class="text-blue-700 text-sm mt-1"
                            >
                                Lipid Rate: 0 ml/h
                            </span>

                        </div>

                        <div class="flex flex-col gap-1 bg-white p-2 rounded border border-blue-300">

                            <label>
                                Aqueous Solution Duration (h):
                            </label>

                            <input
                                type="number"
                                id="tpn-aqueous-hours"
                                value="24"
                                class="bg-gray-50 border text-center"
                            >

                            <span
                                id="res-aqueous-rate"
                                class="text-blue-700 text-sm mt-1"
                            >
                                Aqueous Rate: 0 ml/h
                            </span>

                        </div>

                    </div>

                </td>

            `;

        } else {

            dynamicRow.innerHTML = `

                <td colspan="3" class="text-sm">
                    TPN Rate:
                </td>

                <td
                    colspan="3"
                    id="res-tpn-rate"
                    class="text-lg"
                >
                    0 ml/hr
                </td>

            `;

        }

        calculateTPN();

    }

function toggleDexMode() {

        const mode =
            document.getElementById('dex-mode').value;

        const concContainer =
            document.getElementById('dex-input-conc-container');

        const weightContainer =
            document.getElementById('dex-input-weight-container');

        const girContainer =
            document.getElementById('dex-input-gir-container');

        if (mode === 'conc') {

            concContainer.classList.remove('hidden');

            weightContainer.classList.add('hidden');

            girContainer.classList.add('hidden');

        } else {

            concContainer.classList.add('hidden');

            weightContainer.classList.remove('hidden');

            girContainer.classList.remove('hidden');

        }

    }

function calculateTPN() {

        const wStr =
            document.getElementById('tpn-weight').value;

        const w =
            parseFloat(wStr) || 0;


        const fluidTarget =
            (
                parseFloat(
                    document.getElementById('tpn-fluid-kg').value
                ) || 0
            ) * w;


        const entFluid =
            parseFloat(
                document.getElementById('tpn-enteral-fluid').value
            ) || 0;

        const otherFluid =
            parseFloat(
                document.getElementById('tpn-other-input').value
            ) || 0;


        const tpnFluid =
            fluidTarget -
            entFluid -
            otherFluid;


        document.getElementById('res-tpn-remain-fluid').innerText =
            tpnFluid.toFixed(1);


        const caloricDensity =
            parseFloat(
                document.getElementById('tpn-caloric-density').value
            ) || 0;


        const enteralEnergyTotal =
            entFluid *
            caloricDensity;


        document.getElementById('res-enteral-energy').innerText =
            enteralEnergyTotal.toFixed(1) + " kcal";


        const targetEnergyKg =
            parseFloat(
                document.getElementById('tpn-target-energy-kg').value
            ) || 0;


        document.getElementById('res-tpn-energy-need').innerText =
            Math.max(
                0,
                targetEnergyKg -
                (
                    w > 0
                        ? enteralEnergyTotal / w
                        : 0
                )
            ).toFixed(1) +
            " kcal/kg";


        const pG =
            (
                parseFloat(
                    document.getElementById('in-prot').value
                ) || 0
            ) * w;


        const pConc =
            parseFloat(
                document.getElementById('in-prot-conc').value
            ) || 0;


        const pV =
            pConc > 0
                ? pG / (pConc / 100)
                : 0;


        document.getElementById('res-prot-total').innerText =
            pG.toFixed(1);

        document.getElementById('res-prot-vol').innerText =
            pV.toFixed(1);

        document.getElementById('res-prot-kcal').innerText =
            (pG * 4).toFixed(0);


        const lG =
            (
                parseFloat(
                    document.getElementById('in-lipid').value
                ) || 0
            ) * w;


        const lConc =
            parseFloat(
                document.getElementById('in-lipid-conc').value
            ) || 0;


        const lV =
            lConc > 0
                ? lG / (lConc / 100)
                : 0;


        document.getElementById('res-lipid-total').innerText =
            lG.toFixed(1);

        document.getElementById('res-lipid-vol').innerText =
            lV.toFixed(1);

        document.getElementById('res-lipid-kcal').innerText =
            (lG * 10).toFixed(0);


        const phosTotal =
            (
                parseFloat(
                    document.getElementById('in-phos').value
                ) || 0
            ) * w;


        const naIntakeRaw =
            (
                parseFloat(
                    document.getElementById('in-nacl').value
                ) || 0
            ) * w;


        const naAdjusted =
            Math.max(
                0,
                naIntakeRaw -
                (2 * phosTotal)
            );


        const naclType =
            document.getElementById('sel-nacl-type').value;


        const naVol =
            naclType === "3"
                ? naAdjusted / 0.513
                : naAdjusted / 0.154;


        document.getElementById('res-nacl-total').innerText =
            naAdjusted.toFixed(1);

        document.getElementById('res-nacl-vol').innerText =
            naVol.toFixed(1);


        const kTotal =
            (
                parseFloat(
                    document.getElementById('in-kcl').value
                ) || 0
            ) * w;


        const kVol =
            kTotal / 2;


        document.getElementById('res-kcl-total').innerText =
            kTotal.toFixed(1);

        document.getElementById('res-kcl-vol').innerText =
            kVol.toFixed(1);


        const caTotal =
            (
                parseFloat(
                    document.getElementById('in-ca').value
                ) || 0
            ) * w;


        const caVol =
            caTotal / 0.23;


        document.getElementById('res-ca-total').innerText =
            caTotal.toFixed(1);

        document.getElementById('res-ca-vol').innerText =
            caVol.toFixed(1);


        const mgTotal =
            (
                parseFloat(
                    document.getElementById('in-mg').value
                ) || 0
            ) * w;


        const mgVol =
            mgTotal / 0.41;


        document.getElementById('res-mg-total').innerText =
            mgTotal.toFixed(1);

        document.getElementById('res-mg-vol').innerText =
            mgVol.toFixed(1);


        document.getElementById('res-phos-total').innerText =
            phosTotal.toFixed(1);

        document.getElementById('res-phos-vol').innerText =
            phosTotal.toFixed(1);


        // Vitamins / trace elements: Intake is entered as ml/kg/day.
        // Volume is calculated automatically as Intake × weight.
        const traceIntake =
            parseFloat(document.getElementById('in-trace-vol').value) || 0;
        const vitaIntake =
            parseFloat(document.getElementById('in-vitalipid-vol').value) || 0;
        const soluIntake =
            parseFloat(document.getElementById('in-soluvito-vol').value) || 0;

        const traceVol = traceIntake * w;
        const vitaVol = vitaIntake * w;
        const soluVol = soluIntake * w;

        document.getElementById('res-trace-total').innerText = traceVol.toFixed(1);
        document.getElementById('res-trace-vol').innerText = traceVol.toFixed(1);
        document.getElementById('res-vitalipid-total').innerText = vitaVol.toFixed(1);
        document.getElementById('res-vitalipid-vol').innerText = vitaVol.toFixed(1);
        document.getElementById('res-soluvito-total').innerText = soluVol.toFixed(1);
        document.getElementById('res-soluvito-vol').innerText = soluVol.toFixed(1);


        const isAutoGlucose =
            document.getElementById('glu-toggle-auto').checked;

        const glucoseModeEl =
            document.getElementById('glu-input-mode');

        const glucoseMode =
            glucoseModeEl
                ? glucoseModeEl.value
                : 'gir';


        const intakeCell =
            document.getElementById('res-glu-intake-cell');

        let tpnG_vol = 0;
        let gluConc = 0;
        let totalG_gram = 0;
        let tpnG_gram = 0;


        const otherG_gram =
            (
                parseFloat(
                    document.getElementById('in-glu-other-rate').value
                ) || 0
            ) *
            (
                parseFloat(
                    document.getElementById('in-glu-other-dur').value
                ) || 0
            ) *
            (
                parseFloat(
                    document.getElementById('in-glu-other-conc').value
                ) || 0
            ) / 100;


        /*
         * Remaining glucose volume is the same regardless of
         * the selected glucose calculation method.
         */
        tpnG_vol =
            tpnFluid -
            (
                pV +
                lV +
                naVol +
                kVol +
                caVol +
                mgVol +
                phosTotal +
                traceVol +
                vitaVol +
                soluVol
            );


        if (glucoseMode === 'remaining-calories') {

            /*
             * Glucose grams =
             * (Total TPN calories
             *  - Protein calories
             *  - Lipid calories
             *  - Other glucose calories) / 3.4
             */
            const totalTpnCalories =
                Math.max(
                    0,
                    (targetEnergyKg * w) -
                    enteralEnergyTotal
                );

            const proteinCalories =
                pG * 4;

            const lipidCalories =
                lG * 10;

            const otherGlucoseCalories =
                otherG_gram * 3.4;

            const glucoseCalories =
                Math.max(
                    0,
                    totalTpnCalories -
                    proteinCalories -
                    lipidCalories -
                    otherGlucoseCalories
                );

            totalG_gram =
                glucoseCalories / 3.4;

            tpnG_gram =
                Math.max(
                    0,
                    totalG_gram - otherG_gram
                );

            gluConc =
                tpnG_vol > 0
                    ? (
                        tpnG_gram /
                        tpnG_vol
                    ) * 100
                    : 0;

            if (intakeCell) {
                intakeCell.innerText =
                    "Remaining calories";
            }

            document.getElementById('res-glu-conc-display').innerText =
                isFinite(gluConc)
                    ? gluConc.toFixed(1) + "%"
                    : "0%";

        }

        else if (isAutoGlucose) {

            intakeCell.innerText =
                "Auto (GIR)";

            const gir =
                parseFloat(
                    document.getElementById('in-gir').value
                ) || 0;

            totalG_gram =
                (
                    gir *
                    w *
                    1440
                ) / 1000;

            tpnG_gram =
                totalG_gram -
                otherG_gram;

            gluConc =
                tpnG_vol > 0
                    ? (
                        tpnG_gram /
                        tpnG_vol
                    ) * 100
                    : 0;

            document.getElementById('res-glu-conc-display').innerText =
                isFinite(gluConc)
                    ? gluConc.toFixed(1) + "%"
                    : "0%";

        }

        else {

            gluConc =
                parseFloat(
                    document.getElementById('in-glu-conc-manual').value
                ) || 0;

            const calcGir =
                w > 0
                    ? (
                        tpnG_vol *
                        gluConc
                    ) / (
                        w *
                        144
                    )
                    : 0;

            if (intakeCell) {
                intakeCell.innerText =
                    isFinite(calcGir)
                        ? calcGir.toFixed(2) + " (GIR)"
                        : "0 (GIR)";
            }

            tpnG_gram =
                tpnG_vol *
                (gluConc / 100);

            totalG_gram =
                tpnG_gram +
                otherG_gram;

        }


        document.getElementById('res-glu-total-final').innerText =
            totalG_gram.toFixed(1) + " g";

        document.getElementById('res-glu-total-tpn').innerText =
            tpnG_gram.toFixed(1);

        document.getElementById('res-glu-vol-tpn').innerText =
            tpnG_vol.toFixed(1);

        document.getElementById('res-glu-kcal-tpn').innerText =
            (tpnG_gram * 3.4).toFixed(0);


        document.getElementById('res-glu-conc').innerText =
            isFinite(gluConc)
                ? gluConc.toFixed(1) + "%"
                : "0%";


        const tpnEnergy =
            (pG * 4) +
            (lG * 10) +
            (tpnG_gram * 3.4);


        document.getElementById('res-tpn-total-vol').innerText =
            tpnFluid.toFixed(1);

        document.getElementById('res-tpn-total-kcal').innerText =
            tpnEnergy.toFixed(0);


        const tpnType =
            document.getElementById('tpn-type-select').value;


        const infusionHours =
            parseFloat(
                document.getElementById('tpn-infusion-hours').value
            ) || 24;


        if (tpnType === '3in1') {

            const tpnRate =
                tpnFluid / infusionHours;


            const rateEl =
                document.getElementById('res-tpn-rate');


            if (rateEl) {

                rateEl.innerText =
                    isFinite(tpnRate)
                        ? tpnRate.toFixed(1) + " ml/hr"
                        : "0 ml/hr";

            }

        }

        else {

            const lipidHours =
                parseFloat(
                    document.getElementById('tpn-lipid-hours').value
                ) || 24;


            const aqueousHours =
                parseFloat(
                    document.getElementById('tpn-aqueous-hours').value
                ) || 24;


            const lipidRate =
                lipidHours > 0
                    ? lV / lipidHours
                    : 0;


            const aqueousVolume =
                tpnFluid -
                lV;


            const aqueousRate =
                aqueousHours > 0
                    ? aqueousVolume / aqueousHours
                    : 0;


            const lipidRateEl =
                document.getElementById('res-lipid-rate');


            const aqueousRateEl =
                document.getElementById('res-aqueous-rate');


            if (lipidRateEl) {

                lipidRateEl.innerText =
                    `Lipid Rate: ${
                        isFinite(lipidRate)
                            ? lipidRate.toFixed(1)
                            : "0"
                    } ml/h`;

            }


            if (aqueousRateEl) {

                aqueousRateEl.innerText =
                    `Aqueous Rate: ${
                        isFinite(aqueousRate)
                            ? aqueousRate.toFixed(1)
                            : "0"
                    } ml/h`;

            }

        }


        const osm =
            (
                pG * 10 +
                tpnG_gram * 5 +
                (
                    naAdjusted +
                    kTotal +
                    caTotal +
                    mgTotal
                ) * 2
            ) /
            (tpnFluid / 1000);


        document.getElementById('res-osmolarity').innerText =
            isFinite(osm)
                ? Math.round(osm)
                : "0";


        runMixing();

    }

function addIVLine() {

        const container =
            document.getElementById('iv-lines-container');

        const index = ivLineCount++;

        const row = document.createElement('div');

        row.className =
            'iv-line-row grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-white p-3 rounded-lg border border-blue-100 shadow-sm';

        row.id = `iv-line-${index}`;

        row.innerHTML = `

            <div class="md:col-span-3">

                <label class="block text-[10px] font-bold mb-1 text-gray-600">
                    Glucose conc%
                </label>

                <input
                    type="number"
                    id="qc-iv-conc-${index}"
                    value="10"
                    step="0.1"
                    class="bg-white"
                >

            </div>

            <div class="md:col-span-3">

                <label class="block text-[10px] font-bold mb-1 text-gray-600">
                    Glucose Rate Unit
                </label>

                <select
                    id="qc-iv-unit-${index}"
                    class="bg-white"
                >

                    <option value="h">
                        ml / h
                    </option>

                    <option value="d">
                        ml / d
                    </option>

                </select>

            </div>

            <div class="md:col-span-5">

                <label class="block text-[10px] font-bold mb-1 text-gray-600">
                    Glucose Rate Value
                </label>

                <input
                    type="number"
                    id="qc-iv-rate-${index}"
                    value="0"
                    step="0.1"
                    class="bg-white"
                >

            </div>

            <div class="md:col-span-1 flex items-end justify-center">

                <button data-remove-iv="${index}"
                    class="bg-red-500 hover:bg-red-600 text-white font-bold px-2 py-1.5 rounded text-xs transition-all"
                >
                    ✕
                </button>

            </div>

        `;

        container.appendChild(row);

        calculateQuickGIR();
    }

function removeIVLine(index) {

        const row =
            document.getElementById(`iv-line-${index}`);

        if (row) {

            row.remove();

            calculateQuickGIR();

        }

    }

function calculateQuickGIR() {

        const w =
            parseFloat(
                document.getElementById('qc-weight').value
            ) || 0;


        let totalIvGIR = 0;


        const rows =
            document.querySelectorAll('.iv-line-row');


        rows.forEach(row => {

            const concInput =
                row.querySelector(
                    'input[id*="qc-iv-conc"]'
                );

            const unitSelect =
                row.querySelector(
                    'select[id*="qc-iv-unit"]'
                );

            const rateInput =
                row.querySelector(
                    'input[id*="qc-iv-rate"]'
                );


            if (
                concInput &&
                unitSelect &&
                rateInput
            ) {

                const conc =
                    parseFloat(concInput.value) || 0;

                const unit =
                    unitSelect.value;

                const rate =
                    parseFloat(rateInput.value) || 0;


                if (w > 0) {

                    if (unit === 'h') {

                        totalIvGIR +=
                            (rate * conc) /
                            (w * 6);

                    }

                    else {

                        totalIvGIR +=
                            (rate * conc) /
                            (w * 144);

                    }

                }

            }

        });


        const milkType =
            document.getElementById('qc-milk-type').value;


        const entVol =
            parseFloat(
                document.getElementById('qc-ent-vol').value
            ) || 0;


        const entFreq =
            parseFloat(
                document.getElementById('qc-ent-freq').value
            ) || 1;


        const addedCarb =
            parseFloat(
                document.getElementById('qc-ent-carb').value
            ) || 0;


        let baseCarb =
            7.1;


        if (milkType === 'preterm') {

            baseCarb =
                8.5;

        }

        if (milkType === 'custom') {

            baseCarb =
                parseFloat(
                    document.getElementById('qc-custom-base-carb').value
                ) || 0;
        }

        document
            .getElementById('qc-custom-carb-box')
            .classList.toggle('hidden', milkType !== 'custom');


        let entGIR =
            0;


        if (
            w > 0 &&
            entFreq > 0
        ) {

            entGIR =
                (
                    (
                        entVol *
                        24 /
                        entFreq
                    ) *
                    (baseCarb * 0.01) +
                    addedCarb
                ) /
                (w * 1.44);

        }


        const totalGIR =
            totalIvGIR +
            entGIR;


        document.getElementById('qc-res-iv-gir').innerText =
            totalIvGIR.toFixed(2);

        document.getElementById('qc-res-ent-gir').innerText =
            entGIR.toFixed(2);

        document.getElementById('qc-res-total-gir').innerHTML =
            `${totalGIR.toFixed(2)}
             <span class="text-sm font-normal">
                mg/kg/min
             </span>`;

    }

function calculateDextrosePrep() {

        const mode =
            document.getElementById('dex-mode').value;


        const vt =
            parseFloat(
                document.getElementById('dex-volume').value
            ) || 0;


        const c1 =
            parseFloat(
                document.getElementById('dex-c1').value
            ) || 0;


        const c2 =
            parseFloat(
                document.getElementById('dex-c2').value
            ) || 0;


        let dPct =
            0;


        if (mode === 'conc') {

            dPct =
                parseFloat(
                    document.getElementById('dex-req-conc').value
                ) || 0;

        }

        else {

            const weight =
                parseFloat(
                    document.getElementById('dex-weight').value
                ) || 0;


            const targetGir =
                parseFloat(
                    document.getElementById('dex-target-gir').value
                ) || 0;


            if (vt > 0) {

                dPct =
                    (
                        targetGir *
                        weight *
                        1.44
                    ) /
                    vt *
                    100;

            }

        }


        if (
            c1 === c2 ||
            c1 <= c2
        ) {

            document.getElementById('dex-res-text').innerText =
                "C₁ must be greater than C₂";

            return;

        }


        const v1 =
            vt *
            (dPct - c2) /
            (c1 - c2);


        const v2 =
            vt -
            v1;


        if (
            v1 < 0 ||
            v2 < 0
        ) {

            document.getElementById('dex-res-text').innerText =
                "Target concentration out of bounds for given concentrations";

            return;

        }


        const nameC1 =
            `D${c1}%`;

        const nameC2 =
            `D${c2}%`;


        document.getElementById('dex-res-text').innerText =
            `Making ${vt} mL of glucose ${dPct.toFixed(1)}% → ${v1.toFixed(1)} mL ${nameC1} + ${v2.toFixed(1)} mL ${nameC2}`;

    }

function runMixing() {

        const targetC =
            parseFloat(
                document.getElementById('mix-target-conc').value
            );

        const targetV =
            parseFloat(
                document.getElementById('mix-target-vol').value
            );

        const c1 =
            parseFloat(
                document.getElementById('mix-c1').value
            );

        const c2 =
            parseFloat(
                document.getElementById('mix-c2').value
            );


        if (
            targetC &&
            targetV &&
            c1 &&
            c2
        ) {

            const v1 =
                (
                    targetV *
                    (targetC - c2)
                ) /
                (c1 - c2);


            const v2 =
                targetV -
                v1;


            if (
                v1 >= 0 &&
                v2 >= 0
            ) {

                const txt =
                    `D${c1}%: ${v1.toFixed(1)}ml | D${c2}%: ${v2.toFixed(1)}ml`;


                document.getElementById('mix-result').innerText =
                    txt;


                document.getElementById('res-glu-mix-breakdown').innerText =
                    `(${txt})`;

            }

        }

    }

/* ------------------------- EVENTS ------------------------- */
function handleCalculationEvent(target) {
  if (!target || !target.id) return;
  const id = target.id;
  if (id === 'en-fort-choice') { toggleFortifier(); calculateEN(); return; }
  if (id === 'tpn-type-select') { toggleTpnTypeMode(); calculateTPN(); return; }
  if (id === 'glu-input-mode') { toggleGlucoseInputMode(); calculateTPN(); return; }
  if (id === 'glu-toggle-auto') { toggleGlucoseMode(); return; }
  if (id === 'dex-mode') { toggleDexMode(); calculateDextrosePrep(); return; }
  if (id.startsWith('en-')) { calculateEN(); return; }
  if (id.startsWith('cb-')) { calculateCalorieBased(); return; }
  if (id.startsWith('tpn-') || id.startsWith('in-') || id.startsWith('sel-') || id.startsWith('glu-')) { calculateTPN(); return; }
  if (id.startsWith('qc-')) { calculateQuickGIR(); return; }
  if (id.startsWith('dex-')) { calculateDextrosePrep(); return; }
  if (id.startsWith('fc-')) { calculateFormulaConcentration(); return; }
  if (id.startsWith('bmf-')) { calculateBreastmilkFortification(); return; }
  if (id.startsWith('mix-')) { runMixing(); return; }
}
function bindEvents() {
  document.addEventListener('click', async e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { setMainTab(tab.dataset.tab); return; }
    const approach = e.target.closest('[data-en-approach]');
    if (approach) { setENApproach(approach.dataset.enApproach); return; }
    const remove = e.target.closest('[data-remove-iv]');
    if (remove) { removeIVLine(Number(remove.dataset.removeIv)); return; }
    const toggle = e.target.closest('[data-toggle-content]');
    if (toggle) {
      const box = $(toggle.dataset.toggleContent);
      const arrow = $(toggle.dataset.toggleArrow);
      if (box) {
        const hidden = box.classList.toggle('hidden');
        if (arrow) arrow.classList.toggle('rotate-180', !hidden);
      }
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'print') smartPrint();
    else if (action === 'toggle-patient') togglePatientData();
    else if (action === 'add-day') await addSupportDay();
    else if (action === 'edit-day') { if (state.currentDayId) setDayEditMode(true); }
    else if (action === 'save-day') await saveCurrentDay();
    else if (action === 'toggle-tools') toggleTools();
    else if (action === 'add-iv') addIVLine();
  });
  document.addEventListener('input', e => handleCalculationEvent(e.target));
  document.addEventListener('change', e => handleCalculationEvent(e.target));
  $('printCancelBtn')?.addEventListener('click', closePrintSettings);
  $('printConfirmBtn')?.addEventListener('click', confirmSupportPrint);
  $('printCompletionBtn')?.addEventListener('click', closePrintCompletion);
  $('printSettingsOverlay')?.addEventListener('click', e => { if (e.target.id === 'printSettingsOverlay') closePrintSettings(); });
  $('printCompletionOverlay')?.addEventListener('click', e => { if (e.target.id === 'printCompletionOverlay') closePrintCompletion(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePrintSettings(); closePrintCompletion(); }
  });
}

/* ------------------------- PATIENT LOADING ------------------------- */
async function loadPatient() {
  if (!access?.supabaseClient || !access?.getCurrentUser) throw new Error('DietPlannerAccess is not available.');
  const user = await access.getCurrentUser();
  if (!user) { location.replace('index.html'); return false; }
  state.user = user;
  const patientId = new URLSearchParams(location.search).get('patient');
  if (!patientId) { location.replace('nutritionsupport.html'); return false; }
  const {data,error} = await supabase.from('patients')
    .select('id,name,gender,birth_date,age,height,diagnosis,complaints,clinical_notes')
    .eq('id',patientId).eq('user_id',user.id).maybeSingle();
  if (error) throw error;
  if (!data) { location.replace('nutritionsupport.html'); return false; }
  state.patient = data;
  $('selectedPatientName').textContent = data.name || '—';
  $('pGender').textContent = gender(data.gender);
  $('pBirth').textContent = fmtDate(data.birth_date);
  $('pAge').textContent = data.age ?? '—';
  $('pHeight').textContent = data.height ? `${data.height} سم` : '—';
  $('pDiagnosis').textContent = data.diagnosis || '—';
  $('pComplaints').textContent = data.complaints || '—';
  $('pNotes').textContent = data.clinical_notes || '—';
  $('patient-name').value = data.name || '';
  $('patient-id').value = data.id || '';
  $('report-date').value = todayISO();
  $('clinical-diagnosis').value = data.diagnosis || '';
  return true;
}
async function initPage() {
  if (!supabase) { console.error('Supabase client is unavailable.'); return; }
  bindEvents();
  setMainTab('assessment');
  setENApproach('volume');
  setDayEditMode(false);
  try {
    const ok = await loadPatient();
    if (!ok) return;
    // Initial calculation state only; no database write happens here.
    toggleFortifier();
    calculateEN();
    calculateCalorieBased();
    toggleGlucoseInputMode();
    calculateTPN();
    calculateQuickGIR();
    toggleDexMode();
    calculateDextrosePrep();
    calculateFormulaConcentration();
    calculateBreastmilkFortification();
    await initSupportDays();
  } catch (error) {
    console.error('Nutrition Support patient initialization failed:', error);
    const message = document.createElement('div');
    message.className = 'card p-4 mt-4 text-center text-red-700 font-bold';
    message.textContent = 'تعذر تحميل بيانات المريض.';
    document.querySelector('.app-shell')?.prepend(message);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPage, {once:true});
else initPage();
