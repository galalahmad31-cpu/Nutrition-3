/* =========================================================
   NUTRITION SUPPORT PATIENT — GENERAL PAGE LOGIC
   Patient loading, support days, tabs, printing and sharing.
   ========================================================= */

const access = window.DietPlannerAccess;
const supabase = access?.supabaseClient;
const $ = id => document.getElementById(id);
const fmtDate = v => { if (!v) return '—'; const a = String(v).slice(0, 10).split('-'); return a.length === 3 ? `${a[2]}/${a[1]}/${a[0]}` : v; };
const gender = v => v === 'male' ? 'ذكر' : v === 'female' ? 'أنثى' : v || '—';


/* =========================================================
   SUPPORT DAYS
   Each selected day has its own EN/TPN data.
   ========================================================= */
let supportPatientId=null;
let supportUserId=null;
let supportDays=[];
let currentSupportDayId=null;
let dayDefaults=null;
let dayEditMode=false;

function dayControls(){
  return document.querySelectorAll('#section-en input,#section-en select,#section-en textarea,#section-tpn input,#section-tpn select,#section-tpn textarea');
}
function activeSupportTab(){
  return document.getElementById('tab-tpn')?.classList.contains('active') ? 'tpn' : 'en';
}
function captureDayState(){
  const state={};
  dayControls().forEach(el=>{
    if(!el.id) return;
    if(el.type==='checkbox'||el.type==='radio') state[el.id]={value:el.value,checked:el.checked};
    else state[el.id]={value:el.value};
  });
  state.__tab=activeSupportTab();
  return state;
}
function restoreDayState(state){
  const st=state||{};
  dayControls().forEach(el=>{
    if(!el.id||!st[el.id]) return;
    if(el.type==='checkbox'||el.type==='radio') el.checked=!!st[el.id].checked;
    else el.value=st[el.id].value??'';
  });
  dayControls().forEach(el=>{
    if(el.type==='checkbox'||el.type==='radio') el.dispatchEvent(new Event('change',{bubbles:true}));
    else {el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
  });
  switchTab(st.__tab==='tpn'?'tpn':'en');
}
function setDayEditMode(editing){
  dayEditMode=!!editing;
  document.body.classList.toggle('support-day-locked',!dayEditMode);
  dayControls().forEach(el=>{
    el.disabled=!dayEditMode;
  });
  const edit=$('editDayBtn'),save=$('saveDayBtn');
  if(edit) edit.disabled=dayEditMode;
  if(save) save.disabled=!dayEditMode || !currentSupportDayId;
}
function formatDayDate(v){
  if(!v)return'—';
  const a=String(v).slice(0,10).split('-');
  return a.length===3?`${a[2]}/${a[1]}/${a[0]}`:v;
}
function renderSupportDays(){
  const list=$('dayList'); if(!list)return;
  list.innerHTML='';
  if(!supportDays.length){list.innerHTML='<div class="day-empty">لا توجد أيام مضافة بعد.</div>';return;}
  [...supportDays].sort((a,b)=>String(a.day_date).localeCompare(String(b.day_date))).forEach(d=>{
    const row=document.createElement('div'); row.className='day-row';
    const b=document.createElement('button');
    b.type='button'; b.className='day-item'+(d.id===currentSupportDayId?' active':'');
    b.textContent=formatDayDate(d.day_date); b.title='فتح هذا اليوم';
    b.addEventListener('click',()=>selectSupportDay(d.id));
    const del=document.createElement('button');
    del.type='button'; del.className='day-delete'; del.title='حذف هذا اليوم'; del.setAttribute('aria-label','حذف هذا اليوم');
    del.innerHTML='🗑️';
    del.addEventListener('click',e=>{e.stopPropagation();deleteSupportDay(d.id);});
    row.appendChild(b); row.appendChild(del); list.appendChild(row);
  });
}
function showDeleteConfirm(dayText){
  return new Promise(resolve=>{
    const overlay=$('deleteConfirmOverlay'), text=$('deleteConfirmText'), ok=$('deleteConfirmOk'), cancel=$('deleteConfirmCancel');
    if(!overlay||!text||!ok||!cancel){
      const wrap=document.createElement('div');
      wrap.innerHTML=`<div class=\"delete-confirm-overlay show\" id=\"deleteConfirmOverlay\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"deleteConfirmTitle\">
        <div class=\"delete-confirm-box\">
          <div class=\"delete-confirm-icon\"><i class=\"fa-solid fa-trash\"></i></div>
          <h3 class=\"delete-confirm-title\" id=\"deleteConfirmTitle\">تأكيد حذف اليوم</h3>
          <p class=\"delete-confirm-text\" id=\"deleteConfirmText\"></p>
          <div class=\"delete-confirm-actions\">
            <button type=\"button\" class=\"delete-confirm-cancel\" id=\"deleteConfirmCancel\">إلغاء</button>
            <button type=\"button\" class=\"delete-confirm-ok\" id=\"deleteConfirmOk\" aria-label=\"حذف اليوم\" title=\"حذف اليوم\"><i class=\"fa-solid fa-trash\"></i></button>
          </div>
        </div>
      </div>`;
      document.body.appendChild(wrap.firstElementChild);
      return showDeleteConfirm(dayText).then(resolve);
    }
    text.innerHTML='هل أنت متأكد من حذف يوم <strong>'+dayText+'</strong>؟<br>سيتم حذف جميع بيانات Enteral و Parenteral المحفوظة لهذا اليوم نهائيًا.';
    overlay.classList.add('show');
    const close=value=>{overlay.classList.remove('show');ok.onclick=null;cancel.onclick=null;overlay.onclick=null;resolve(value);};
    ok.onclick=()=>close(true);
    cancel.onclick=()=>close(false);
    overlay.onclick=e=>{if(e.target===overlay)close(false);};
  });
}
async function deleteSupportDay(id){
  const d=supportDays.find(x=>x.id===id); if(!d)return;
  if(!(await showDeleteConfirm(formatDayDate(d.day_date))))return;
  const {error}=await supabase.from('nutrition_support_days').delete()
    .eq('id',id).eq('patient_id',supportPatientId).eq('user_id',supportUserId);
  if(error){console.error(error);alert('تعذر حذف اليوم: '+(error.message||'تحقق من صلاحيات قاعدة البيانات.'));return;}
  supportDays=supportDays.filter(x=>x.id!==id);
  if(currentSupportDayId===id){
    const next=[...supportDays].sort((a,b)=>String(b.day_date).localeCompare(String(a.day_date)))[0];
    if(next){currentSupportDayId=next.id;restoreDayState(next.state||{});$('report-date').value=next.day_date;}
    else{currentSupportDayId=null;restoreDayState(dayDefaults||{});$('report-date').value='';setDayEditMode(false);}
  }
  renderSupportDays();
}
async function saveCurrentSupportDay(){
  if(!supportPatientId||!supportUserId||!currentSupportDayId){alert('أضف يومًا أولاً ثم اضغط تعديل.');return false;}
  const d=supportDays.find(x=>x.id===currentSupportDayId);if(!d)return false;
  const state=captureDayState();state.__date=d.day_date;
  const {data,error}=await supabase.from('nutrition_support_days')
    .update({state,updated_at:new Date().toISOString()})
    .eq('id',d.id).eq('patient_id',supportPatientId).eq('user_id',supportUserId)
    .select('id,patient_id,user_id,day_date,state,created_at,updated_at').maybeSingle();
  if(error){console.error(error);alert('تعذر حفظ بيانات هذا اليوم: '+(error.message||'تحقق من صلاحيات قاعدة البيانات.'));return false;}
  if(data){const i=supportDays.findIndex(x=>x.id===d.id);if(i>=0)supportDays[i]=data;}
  dayEditMode=false;
  setDayEditMode(false);
  return true;
}
async function selectSupportDay(id){
  if(id===currentSupportDayId)return;
  const d=supportDays.find(x=>x.id===id);if(!d)return;
  currentSupportDayId=id;
  restoreDayState(d.state||{});
  $('report-date').value=d.day_date;
  renderSupportDays();
  setDayEditMode(false);
}
async function addSupportDay(){
  const date=$('newDayDate')?.value;
  if(!date){alert('اختر تاريخ اليوم أولاً.');return;}
  if(!supportPatientId||!supportUserId){alert('لم يتم تحميل المريض بعد.');return;}
  const existing=supportDays.find(x=>String(x.day_date).slice(0,10)===date);
  if(existing){await selectSupportDay(existing.id);return;}
  const blank=dayDefaults?JSON.parse(JSON.stringify(dayDefaults)):captureDayState();
  blank.__date=date;blank.__tab='en';
  const {data,error}=await supabase.from('nutrition_support_days')
    .insert({patient_id:supportPatientId,user_id:supportUserId,day_date:date,state:blank})
    .select('id,patient_id,user_id,day_date,state,created_at,updated_at').single();
  if(error){console.error(error);alert('تعذر إضافة اليوم: '+(error.message||'تحقق من جدول nutrition_support_days وصلاحيات RLS.'));return;}
  supportDays.push(data);currentSupportDayId=data.id;
  restoreDayState(blank);$('report-date').value=date;renderSupportDays();
  setDayEditMode(true);
}
async function initSupportDays(patientId,userId){
  supportPatientId=patientId;supportUserId=userId;
  const dateEl=$('newDayDate');if(dateEl)dateEl.value=new Date().toISOString().slice(0,10);
  dayDefaults=captureDayState();dayDefaults.__tab='en';
  const {data,error}=await supabase.from('nutrition_support_days')
    .select('id,patient_id,user_id,day_date,state,created_at,updated_at')
    .eq('patient_id',patientId).eq('user_id',userId).order('day_date',{ascending:true});
  if(error){console.error('nutrition_support_days load failed:',error);supportDays=[];currentSupportDayId=null;renderSupportDays();setDayEditMode(false);return;}
  supportDays=data||[];
  if(supportDays.length){
    currentSupportDayId=supportDays[supportDays.length-1].id;
    restoreDayState(supportDays[supportDays.length-1].state||{});
    $('report-date').value=supportDays[supportDays.length-1].day_date;
  }
  renderSupportDays();
  setDayEditMode(false);
}

function toggleQuickAccordion(contentId, arrowId) {

        const content =
            document.getElementById(contentId);

        const arrow =
            document.getElementById(arrowId);

        if (content.classList.contains('hidden')) {

            content.classList.remove('hidden');

            arrow.classList.add('rotate-180');

        } else {

            content.classList.add('hidden');

            arrow.classList.remove('rotate-180');

        }

    }

function toggleENAccordion(contentId, arrowId) {

        const content =
            document.getElementById(contentId);

        const arrow =
            document.getElementById(arrowId);

        if (content.classList.contains('hidden')) {

            content.classList.remove('hidden');

            arrow.classList.add('rotate-180');

        } else {

            content.classList.add('hidden');

            arrow.classList.remove('rotate-180');

        }

    }

function togglePatientHeader() {

        const content =
            document.getElementById('patient-info-content');

        const button =
            document.getElementById('patient-collapse-btn');

        if (!content || !button) {
            return;
        }

        const isCollapsed =
            content.classList.toggle('hidden');

        button.setAttribute(
            'aria-expanded',
            String(!isCollapsed)
        );

        button.innerText =
            isCollapsed
                ? 'Show patient data ▼'
                : 'Hide patient data ▲';
    }

function switchTab(tab) {

        document
            .getElementById('section-en')
            .classList.toggle('hidden', tab !== 'en');

        document
            .getElementById('section-tpn')
            .classList.toggle('hidden', tab !== 'tpn');

        document
            .getElementById('section-ref')
            .classList.toggle('hidden', tab !== 'ref');


        document
            .getElementById('tab-en')
            .classList.toggle('active', tab === 'en');

        document
            .getElementById('tab-tpn')
            .classList.toggle('active', tab === 'tpn');

        const tabRef = document.getElementById('tab-ref');
        if (tabRef) tabRef.classList.toggle('active', tab === 'ref');


        const content =
            document.getElementById('monitoring-content-actual');

        if (content) {
            if (tab === 'en') {
                const target = document.querySelector('.monitoring-container-shared-en');
                if (target) target.appendChild(content);
            } else if (tab === 'tpn') {
                const target = document.querySelector('.monitoring-container-shared-tpn');
                if (target) target.appendChild(content);
            }
        }

    }

function switchSubTab(sub) {

        document
            .getElementById('sub-content-enteral')
            .classList.toggle('hidden', sub !== 'enteral');

        document
            .getElementById('sub-content-parenteral')
            .classList.toggle('hidden', sub !== 'parenteral');

        document
            .getElementById('sub-content-quick-calc')
            .classList.toggle('hidden', sub !== 'quick-calc');


        document
            .getElementById('sub-tab-enteral')
            .classList.toggle('active', sub === 'enteral');

        document
            .getElementById('sub-tab-parenteral')
            .classList.toggle('active', sub === 'parenteral');

        document
            .getElementById('sub-tab-quick-calc')
            .classList.toggle('active', sub === 'quick-calc');

    }

function switchEnNested(id) {

        const contents =
            document.querySelectorAll('.en-nested-content');

        contents.forEach(el =>
            el.classList.add('hidden')
        );


        const btns =
            document.querySelectorAll(
                '#sub-content-enteral .nested-tab-btn'
            );

        btns.forEach(btn =>
            btn.classList.remove('active')
        );


        document
            .getElementById('en-nested-' + id)
            .classList.remove('hidden');

        document
            .getElementById('en-btn-' + id)
            .classList.add('active');

    }

function switchPnNested(id) {

        const contents =
            document.querySelectorAll('.pn-nested-content');

        contents.forEach(el =>
            el.classList.add('hidden')
        );


        const btns =
            document.querySelectorAll(
                '#sub-content-parenteral .nested-tab-btn'
            );

        btns.forEach(btn =>
            btn.classList.remove('active')
        );


        document
            .getElementById('pn-nested-' + id)
            .classList.remove('hidden');

        document
            .getElementById('pn-btn-' + id)
            .classList.add('active');

    }


function loadPrintSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(PRINT_SETTINGS_KEY) || '{}');
            document.getElementById('printDoctorName').value = saved.doctor || '';
            document.getElementById('printSpecialty').value = saved.specialty || '';
            document.getElementById('printClinicName').value = saved.clinic || '';
            document.getElementById('printAddress').value = saved.address || '';
        } catch (e) {
            console.warn('Could not load saved print settings.', e);
        }
    }

function savePrintSettings(data) {
        try { localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(data)); }
        catch (e) { console.warn('Could not save print settings.', e); }
    }

function showPrintCompletion(message) {
        const overlay = document.getElementById('printCompletionOverlay');
        const msg = document.getElementById('printCompletionMessage');
        if (!overlay) return;
        if (msg) msg.textContent = message;
        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
    }

function closePrintCompletion() {
        const overlay = document.getElementById('printCompletionOverlay');
        if (!overlay) return;
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
    }

function smartPrint() {

        const hasEN =
            (parseFloat(document.getElementById('en-weight')?.value) || 0) > 0 ||
            (parseFloat(document.getElementById('cb-weight')?.value) || 0) > 0;

        const hasTPN =
            (parseFloat(document.getElementById('tpn-weight')?.value) || 0) > 0;

        if (!hasEN && !hasTPN) {
            alert('من فضلك أدخل بيانات التغذية قبل طباعة التقرير.');
            return;
        }

        const overlay = document.getElementById('printSettingsOverlay');
        if (!overlay) return;
        loadPrintSettings();
        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');

        setTimeout(() => {
            document.getElementById('printDoctorName')?.focus();
        }, 50);
    }

function closePrintSettings() {
        const overlay = document.getElementById('printSettingsOverlay');
        if (!overlay) return;
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
    }

function confirmSupportPrint() {
        const doctor = (document.getElementById('printDoctorName')?.value || '').trim();
        const specialty = (document.getElementById('printSpecialty')?.value || '').trim();
        const clinic = (document.getElementById('printClinicName')?.value || '').trim();
        const address = (document.getElementById('printAddress')?.value || '').trim();

        if (!doctor || !specialty || !clinic || !address) {
            showPrintCompletion('من فضلك أكمل اسم الطبيب والتخصص واسم العيادة والعنوان قبل الطباعة.');
            return;
        }

        savePrintSettings({doctor, specialty, clinic, address});

        document.getElementById('printHeaderDoctor').textContent = doctor;
        document.getElementById('printHeaderSpecialty').textContent = specialty;
        document.getElementById('printHeaderClinic').textContent = clinic;
        document.getElementById('printHeaderAddress').textContent = address;

        const hasEN =
            (parseFloat(document.getElementById('en-weight')?.value) || 0) > 0 ||
            (parseFloat(document.getElementById('cb-weight')?.value) || 0) > 0;
        const hasTPN =
            (parseFloat(document.getElementById('tpn-weight')?.value) || 0) > 0;

        document.body.classList.remove('print-en', 'print-tpn');
        if (hasEN) document.body.classList.add('print-en');
        if (hasTPN) document.body.classList.add('print-tpn');

        closePrintSettings();
        setTimeout(() => window.print(), 80);
    }

async function shareText(text, title = 'Nutrition Support Calculator') {

        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: text
                });
                return;
            }
            catch (error) {
                if (error && error.name === 'AbortError') {
                    return;
                }
            }
        }

        copyToClipboard(text);
        alert("Copied to clipboard.");
    }

async function shareVolumeSummary() {

        const val = (id, fallback = "N/A") => {
            const el = document.getElementById(id);
            if (!el) return fallback;
            const value = (el.value !== undefined ? el.value : el.innerText).trim();
            return value || fallback;
        };

        const text =
            `Nutrition Support Calculator — FEEDING SUMMARY (VOLUME-BASED)\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `👤 Patient: ${val('patient-name')}\n` +
            `📅 Date: ${val('report-date')} | ID: ${val('patient-id')}\n` +
            `👶 GA: ${val('gestational-age')} | Birth Wt: ${val('birth-weight')} kg\n` +
            `📝 Clinical Diagnosis: ${val('clinical-diagnosis')}\n` +
            `🍎 Nutritional Diagnosis: ${val('nutritional-diagnosis')}\n` +
            `👨‍⚕️ Physician: ${val('physician-name')}\n` +
            `💊 Pharmacist: ${val('pharmacist-name')}\n\n` +
            `🟣 FEEDING SUMMARY\n` +
            `• Weight: ${val('en-weight')} kg\n` +
            `• Feeding Option: ${val('en-option')}\n` +
            `• Start: ${val('res-en-start')} ml every ${val('res-en-interval')} h\n` +
            `• Increase by: ${val('res-en-inc')} ml every day\n` +
            `• Goal: ${val('res-en-max')} ml every ${val('res-en-interval-2')} h\n` +
            `• Fortification: ${val('en-fort-choice') === 'yes' ? val('en-fort-instructions') : 'No'}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `Generated by Nutrition Support Calculator — Dr. Ahmed Galal`;

        await shareText(text, 'Nutrition Support Calculator - Feeding Summary - Volume-based');
    }

async function shareCaloriesSummary() {

        const val = (id, fallback = "N/A") => {
            const el = document.getElementById(id);
            if (!el) return fallback;
            const value = (el.value !== undefined ? el.value : el.innerText).trim();
            return value || fallback;
        };

        let text =
            `Nutrition Support Calculator — FEEDING SUMMARY (CALORIES-BASED)\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `👤 Patient: ${val('patient-name')}\n` +
            `📅 Date: ${val('report-date')} | ID: ${val('patient-id')}\n` +
            `👶 GA: ${val('gestational-age')} | Birth Wt: ${val('birth-weight')} kg\n` +
            `📝 Clinical Diagnosis: ${val('clinical-diagnosis')}\n` +
            `🍎 Nutritional Diagnosis: ${val('nutritional-diagnosis')}\n` +
            `👨‍⚕️ Physician: ${val('physician-name')}\n` +
            `💊 Pharmacist: ${val('pharmacist-name')}\n\n` +
            `🟣 FEEDING SUMMARY\n` +
            `• Weight: ${val('cb-weight')} kg\n` +
            `• Start: ${val('cb-res-summary-start')} ml every ${val('cb-res-summary-freq1')} h\n` +
            `• Increase by: ${val('cb-res-summary-inc')} ml every day\n` +
            `• Goal: ${val('cb-res-summary-goal')} ml every ${val('cb-res-summary-freq2')} h\n` +
            `• Using: ${val('cb-res-summary-formula')}\n` +
            `• Fortification Instructions: ${val('cb-res-summary-fort')}\n`;

        const flushContainer = document.getElementById('cb-res-summary-flush-container');
        if (flushContainer && !flushContainer.classList.contains('hidden')) {
            text += `• Water flushing: ${val('cb-res-summary-flush')} ml/day\n`;
        }

        text +=
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `Generated by Nutrition Support Calculator — Dr. Ahmed Galal`;

        await shareText(text, 'Nutrition Support Calculator - Feeding Summary - Calories-based');
    }

async function shareTPN() {

        const val = (id, fallback = "N/A") => {
            const el = document.getElementById(id);
            if (!el) return fallback;
            const value = (el.value !== undefined ? el.value : el.innerText).trim();
            return value || fallback;
        };

        const w = parseFloat(val('tpn-weight', '0')) || 0;

        if (w <= 0) {
            alert("Please enter TPN weight before sharing.");
            return;
        }

        const tpnType = val('tpn-type-select');

        let text =
            `Nutrition Support Calculator\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `Patient: ${val('patient-name')}\n` +
            `Date: ${val('report-date')} | ID: ${val('patient-id')}\n` +
            `Gestational Age: ${val('gestational-age')} | Birth Wt: ${val('birth-weight')} kg\n` +
            `Clinical Diagnosis: ${val('clinical-diagnosis')}\n` +
            `Nutritional Diagnosis: ${val('nutritional-diagnosis')}\n` +
            `Physician: ${val('physician-name')}\n` +
            `Pharmacist: ${val('pharmacist-name')}\n\n`;

        text += `TPN COMPONENTS — CALCULATED VOLUMES\n` +
                `━━━━━━━━━━━━━━━━━━━━\n`;

        text += `• Protein (${val('in-prot-conc')}%): ${val('res-prot-vol')} ml\n`;
        text += `• Lipid (${val('in-lipid-conc')}%): ${val('res-lipid-vol')} ml\n`;

        const glucoseMix = val('res-glu-mix-breakdown', '');
        if (glucoseMix && glucoseMix !== 'N/A') {
            text += `• Glucose (${val('res-glu-conc-display')}): ${val('res-glu-vol-tpn')} ml\n`;
            text += `${glucoseMix}\n`;
        } else {
            text += `• Glucose (${val('res-glu-conc-display')}): ${val('res-glu-vol-tpn')} ml\n`;
        }

        text += `• Nacl (${val('sel-nacl-type')}): ${val('res-nacl-vol')} ml\n`;
        text += `• KCl 15%: ${val('res-kcl-vol')} ml\n`;
        text += `• Ca Gluconate 10%: ${val('res-ca-vol')} ml\n`;
        text += `• Mg 10%: ${val('res-mg-vol')} ml\n`;
        text += `• Phosphorus: ${val('res-phos-vol')} ml\n`;
        text += `• Pediatrace: ${val('in-trace-vol')} ml\n`;
        text += `• Vitalipid N (${val('sel-vitalipid')}): ${val('in-vitalipid-vol')} ml\n`;
        text += `• Soluvito N: ${val('in-soluvito-vol')} ml\n\n`;

        text += `• TPN Volume Sum: ${val('res-tpn-total-vol')} ml\n`;
        text += `• TPN Type: ${tpnType}\n`;

        if (tpnType === '3in1') {
            text += `• Infusion Duration: ${val('tpn-infusion-hours')} h\n`;
        } else {
            text += `• Lipid infusion duration ( h ): ${val('tpn-lipid-hours')}\n`;
            text += `• Aqueous Solution Duration ( h ): ${val('tpn-aqueous-hours')}\n`;
        }

        const glucoseMode =
            val('glu-input-mode', 'gir');

        if (glucoseMode === 'remaining-calories') {
            text += `• Glucose Calculation Method: Remaining calories\n`;
            text += `• Glucose Total: ${val('res-glu-total-final')}\n`;
        } else {
            text += `• GIR: ${val('in-gir')} mg/kg/min\n`;
        }

        if (tpnType === '3in1') {
            text += `• TPN Rate: ${val('res-tpn-rate')}\n`;
        } else {
            text += `• Lipid Rate: ${val('res-lipid-rate')}\n`;
            text += `• Aqueous Rate: ${val('res-aqueous-rate')}\n`;
        }

        text += `━━━━━━━━━━━━━━━━━━━━\n`;
        text += `Nutrition Support Calculator — Dr. Ahmed Galal`;

        await shareText(text, 'Nutrition Support Calculator - TPN');
    }

async function smartShare() {

        const val = (id, fallback = "N/A") => {
            const el = document.getElementById(id);
            if (!el) return fallback;
            const value = (el.value !== undefined ? el.value : el.innerText).trim();
            return value || fallback;
        };

        const line = (label, value) => `• ${label}: ${value}\n`;

        const name = val('patient-name');
        const date = val('report-date');
        const id = val('patient-id');
        const ga = val('gestational-age');
        const bw = val('birth-weight');
        const cDiag = val('clinical-diagnosis');
        const nDiag = val('nutritional-diagnosis');
        const dr = val('physician-name');
        const ph = val('pharmacist-name');

        const w_en = parseFloat(val('en-weight', '0')) || 0;
        const w_cb = parseFloat(val('cb-weight', '0')) || 0;
        const w_tpn = parseFloat(val('tpn-weight', '0')) || 0;

        if (w_en <= 0 && w_cb <= 0 && w_tpn <= 0) {
            alert("Please enter a patient weight before sharing the nutrition plan.");
            return;
        }

        let text = `Nutrition Support Calculator\n━━━━━━━━━━━━━━━━━━━━\n`;
        text += `👤 Patient: ${name}\n📅 Date: ${date} | ID: ${id}\n`;
        text += `👶 GA: ${ga} | Birth Wt: ${bw} kg\n`;
        text += `📝 Clinical Diagnosis: ${cDiag}\n🍎 Nutritional Diagnosis: ${nDiag}\n`;
        text += `👨‍⚕️ Physician: ${dr}\n💊 Pharmacist: ${ph}\n\n`;

        if (w_en > 0) {
            text += `🟣 ENTERAL NUTRITION — VOLUME-BASED APPROACH\n━━━━━━━━━━━━━━━━━━━━\n`;
            text += line('Weight', `${w_en} kg`);
            text += line('Feeding Option', val('en-option'));
            text += line('Frequency', `Every ${val('en-hours')} h`);
            text += line('Initiation', `${val('en-init-rate')} ml/kg/d`);
            text += line('Advancement', `${val('en-advance')} ml/kg/d`);
            text += line('Goal Volume', `${val('en-goal')} ml/kg/d`);
            text += line('Start Feed', `${val('res-en-start')} ml every ${val('res-en-interval')} h`);
            text += line('Daily Increase', `${val('res-en-inc')} ml/day`);
            text += line('Goal Feed', `${val('res-en-max')} ml every ${val('res-en-interval-2')} h`);
            text += line('Fortification', val('en-fort-choice') === 'yes' ? val('en-fort-instructions') : 'No');
            text += `\n`;
        }

        if (w_cb > 0) {
            text += `🟣 ENTERAL NUTRITION — CALORIES-BASED APPROACH\n━━━━━━━━━━━━━━━━━━━━\n`;
            text += line('Weight', `${w_cb} kg`);
            text += line('Energy Target', `${val('cb-kcal-kg')} kcal/kg/d`);
            text += line('Total Calories', `${val('cb-res-total-cal')} kcal/d`);
            text += line('Water Target', `${val('cb-target-water')} ml/kg/d`);
            text += line('Total Water', `${val('cb-res-total-water')} ml/d`);
            text += line('Protein Target', `${val('cb-target-protein')} g/kg/d`);
            text += line('Total Protein', `${val('cb-res-total-protein')} g/d`);
            text += line('Formula', val('cb-formula-name'));
            text += line('Free Water', `${val('cb-free-water-pct')}%`);
            text += line('Caloric Density', `${val('cb-caloric-density')} kcal/ml`);
            text += line('Protein Density', `${val('cb-protein-density')} g/100 ml`);
            text += line('Feeding Volume', `${val('cb-res-feeding-volume')} ml/d`);
            text += line('Water Gap', `${val('cb-res-water-gap')} ml`);
            text += line('Protein Gap', `${val('cb-res-protein-gap')} g`);
            text += line('Initiation', `${val('cb-init-pct')}%`);
            text += line('Advancement', `${val('cb-advance-pct')}%`);
            text += line('Frequency', `Every ${val('cb-freq-hours')} h`);
            text += line('Start Feed', `${val('cb-res-summary-start')} ml every ${val('cb-res-summary-freq1')} h`);
            text += line('Daily Increase', `${val('cb-res-summary-inc')} ml/day`);
            text += line('Goal Feed', `${val('cb-res-summary-goal')} ml every ${val('cb-res-summary-freq2')} h`);
            text += line('Fortification Instructions', val('cb-fort-instructions'));
            if (!document.getElementById('cb-res-summary-flush-container').classList.contains('hidden')) text += line('Water Flushing', `${val('cb-res-summary-flush')} ml/day`);
            text += `\n`;
        }

        if (w_tpn > 0) {
            text += `🔵 PARENTERAL NUTRITION — TPN\n━━━━━━━━━━━━━━━━━━━━\n`;
            text += line('Weight', `${w_tpn} kg`);
            text += line('Fluid Target', `${val('tpn-fluid-kg')} ml/kg/d`);
            text += line('Target Energy', `${val('tpn-target-energy-kg')} kcal/kg/d`);
            text += line('Enteral Fluid', `${val('tpn-enteral-fluid')} ml`);
            text += line('Other Fluid', `${val('tpn-other-input')} ml`);
            text += line('Remaining TPN Fluid', `${val('res-tpn-remain-fluid')} ml`);
            text += line('Enteral Energy', val('res-enteral-energy'));
            text += line('Remaining TPN Energy', val('res-tpn-energy-need'));
            text += line('GIR', `${val('in-gir')} mg/kg/min`);
            text += line('TPN Type', val('tpn-type-select'));
            text += line('Infusion Duration', `${val('tpn-infusion-hours')} h`);
            text += `\nCOMPONENTS\n`;
            text += line('Protein', `${val('in-prot')} g/kg/d | ${val('in-prot-conc')}% | Total ${val('res-prot-total')} | Volume ${val('res-prot-vol')} ml | ${val('res-prot-kcal')} kcal`);
            text += line('Lipid', `${val('in-lipid')} g/kg/d | ${val('in-lipid-conc')}% | Total ${val('res-lipid-total')} | Volume ${val('res-lipid-vol')} ml | ${val('res-lipid-kcal')} kcal`);
            text += line('Glucose', `${val('res-glu-conc-display')} | ${val('res-glu-intake-cell')} | Total ${val('res-glu-total-tpn')} | Volume ${val('res-glu-vol-tpn')} ml | ${val('res-glu-kcal-tpn')} kcal`);
            text += line('NaCl', `${val('sel-nacl-type')} | ${val('in-nacl')} mEq/kg/d | Total ${val('res-nacl-total')} | Volume ${val('res-nacl-vol')} ml`);
            text += line('KCl', `${val('in-kcl')} mmol/kg/d | Total ${val('res-kcl-total')} | Volume ${val('res-kcl-vol')} ml`);
            text += line('Ca Gluconate', `${val('in-ca')} mmol/kg/d | Total ${val('res-ca-total')} | Volume ${val('res-ca-vol')} ml`);
            text += line('Mg', `${val('in-mg')} mmol/kg/d | Total ${val('res-mg-total')} | Volume ${val('res-mg-vol')} ml`);
            text += line('Phosphorus', `${val('in-phos')} mmol/kg/d | Total ${val('res-phos-total')} | Volume ${val('res-phos-vol')} ml`);
            text += line('Trace Elements', `${val('sel-trace')} | ${val('in-trace-vol')} ml`);
            text += line('Vitalipid', `${val('sel-vitalipid')} | ${val('in-vitalipid-vol')} ml`);
            text += line('Soluvito N', `${val('in-soluvito-vol')} ml`);
            text += line('Total TPN Volume', `${val('res-tpn-total-vol')} ml`);
            text += line('Total TPN Calories', `${val('res-tpn-total-kcal')} kcal`);
            text += `\n`;
        }

        text += `━━━━━━━━━━━━━━━━━━━━\nGenerated by Nutrition Support Calculator — Dr. Ahmed Galal`;

        if (navigator.share) {
            try {
                await navigator.share({ title: 'Nutrition Support Calculator', text: text });
            }
            catch (error) {
                if (error && error.name !== 'AbortError') {
                    copyToClipboard(text);
                    alert("Nutrition plan copied to clipboard.");
                }
            }
        }
        else {
            copyToClipboard(text);
            alert("Nutrition plan copied to clipboard.");
        }
    }

function copyToClipboard(text) {

        const el =
            document.createElement('textarea');

        el.value =
            text;

        document.body.appendChild(el);

        el.select();

        document.execCommand('copy');

        document.body.removeChild(el);

    }

function initNutritionSupportPatientPage() {
  const reportDate = $('report-date');
  if (reportDate) reportDate.value = new Date().toISOString().split('T')[0];

  $('printCancelBtn')?.addEventListener('click', closePrintSettings);
  $('printConfirmBtn')?.addEventListener('click', confirmSupportPrint);
  $('printCompletionBtn')?.addEventListener('click', closePrintCompletion);

  $('printCompletionOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'printCompletionOverlay') closePrintCompletion();
  });

  $('printSettingsOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'printSettingsOverlay') closePrintSettings();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closePrintSettings();
      closePrintCompletion();
    }
  });

  $('addDayBtn')?.addEventListener('click', addSupportDay);
  $('editDayBtn')?.addEventListener('click', () => {
    if (currentSupportDayId) setDayEditMode(true);
  });
  $('saveDayBtn')?.addEventListener('click', saveCurrentSupportDay);

  $('patientDataToggle')?.addEventListener('click', () => {
    const content = $('patientDataContent');
    const arrow = $('patientDataArrow');
    if (!content || !arrow) return;
    const open = content.style.display !== 'none';
    content.style.display = open ? 'none' : 'grid';
    $('patientDataToggle').setAttribute('aria-expanded', String(!open));
    arrow.className = open ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
  });

  setDayEditMode(false);

  calculateCalorieBased();
  toggleGlucoseInputMode();
  calculateQuickGIR();
  calculateDextrosePrep();
  toggleDexMode();
  calculateFormulaConcentration();
  calculateBreastmilkFortification();

  initPatientAndSupportDays();
}

async function initPatientAndSupportDays() {
  try {
    if (!access?.supabaseClient || !access?.getCurrentUser) {
      throw new Error('DietPlannerAccess is not available.');
    }

    const user = await access.getCurrentUser();
    if (!user) {
      location.replace('index.html');
      return;
    }

    const id = new URLSearchParams(location.search).get('patient');
    if (!id) {
      location.replace('nutritionsupport.html');
      return;
    }

    const { data: p, error: patientError } = await supabase
      .from('patients')
      .select('id,name,gender,birth_date,age,height,diagnosis,complaints,clinical_notes')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (patientError) throw patientError;
    if (!p) {
      location.replace('nutritionsupport.html');
      return;
    }

    $('selectedPatientName').textContent = p.name || '—';
    $('pName').textContent = p.name || '—';
    $('pGender').textContent = gender(p.gender);
    $('pBirth').textContent = fmtDate(p.birth_date);
    $('pAge').textContent = p.age ?? '—';
    $('pHeight').textContent = p.height ? `${p.height} سم` : '—';
    $('pDiagnosis').textContent = p.diagnosis || '—';
    $('pComplaints').textContent = p.complaints || '—';
    $('pNotes').textContent = p.clinical_notes || '—';

    const setValue = (fieldId, value) => {
      const el = $(fieldId);
      if (el) el.value = value ?? '';
    };

    setValue('patient-name', p.name || '');
    setValue('patient-id', p.id || '');
    setValue('report-date', new Date().toISOString().slice(0, 10));
    setValue('clinical-diagnosis', p.diagnosis || '');
    setValue('nutritional-diagnosis', p.complaints || '');

    await initSupportDays(p.id, user.id);
  } catch (error) {
    console.error('Nutrition Support patient initialization failed:', error);
    const message = document.createElement('div');
    message.style.cssText = 'padding:16px;text-align:center;color:#b91c1c;font-family:Cairo,sans-serif';
    message.textContent = 'تعذر تحميل بيانات المريض.';
    document.body.prepend(message);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNutritionSupportPatientPage, { once: true });
} else {
  initNutritionSupportPatientPage();
}

// Explicit public API: keeps existing inline handlers in the HTML working
// even if the page is hosted in an environment with unusual script scoping.
Object.assign(window, {
  toggleQuickAccordion,
  toggleENAccordion,
  togglePatientHeader,
  switchTab,
  switchSubTab,
  switchEnNested,
  switchPnNested,
  smartPrint,
  closePrintSettings,
  confirmSupportPrint,
  closePrintCompletion,
  addSupportDay,
  saveCurrentSupportDay,
  selectSupportDay,
  deleteSupportDay,
  setDayEditMode,
  shareText,
  shareVolumeSummary,
  shareCaloriesSummary
});
