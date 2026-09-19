/* =========================================================
   DIET PLANNER — VISIT PAGE
   Centralized page logic. Existing module APIs are preserved.
   ========================================================= */


/* ================= MODULE 1 ================= */
(function(){

const db = window.DietPlannerAccess?.supabaseClient;
if (!db) console.error('Diet Planner access layer is unavailable.');

async function getAuthenticatedUser(){
  return await window.DietPlannerAccess?.getCurrentUser?.() || null;
}

  const visitId = new URLSearchParams(window.location.search).get('id');

  let visit = null;

  function showError(message) {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('visitContent').classList.add('hidden');
    document.getElementById('errorState').classList.remove('hidden');
    document.getElementById('errorText').textContent = message;
  }

  function formatVisitDate(date) {
    if (!date) return 'بدون تاريخ';
    const d = new Date(date + 'T00:00:00');
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(d);
  }

  async function loadVisit() {
    if (!visitId) {
      showError('لم يتم تحديد الزيارة.');
      return;
    }

    const user = await getAuthenticatedUser();

    if (!user) {
      showError('يجب تسجيل الدخول أولاً.');
      return;
    }

    const { data, error } = await db
      .from('patient_visits')
      .select(`
        id,
        patient_id,
        visit_number,
        visit_date,
        patients (
          id,
          name
        )
      `)
      .eq('id', visitId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error(error);
      showError('تعذر تحميل بيانات الزيارة.');
      return;
    }

    if (!data) {
      showError('الزيارة غير موجودة أو لا تملك صلاحية الوصول إليها.');
      return;
    }

    visit = data;

    document.getElementById('patientName').textContent =
      data.patients?.name || 'بدون اسم';

    document.getElementById('visitNumber').textContent =
      data.visit_number ?? '—';

    document.getElementById('visitDate').textContent =
      formatVisitDate(data.visit_date);

    window.visitContext = { id: data.id, patient_id: data.patient_id };

    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('visitContent').classList.remove('hidden');
  }

  function toggleModule(module) {
    const contents = {
      assessment: document.getElementById('assessmentContent'),
      calculator: document.getElementById('calculatorContent'),
      dietPlan: document.getElementById('dietPlanContent'),
      exchangePlan: document.getElementById('exchangePlanContent')
    };

    const content = contents[module];
    if (!content) return;

    const isOpen = !content.classList.contains('hidden');
    Object.values(contents).forEach(el => el.classList.add('hidden'));
    const moduleCardIds = {assessment:'assessmentCard',calculator:'calculatorCard',dietPlan:'dietPlanCard',exchangePlan:'exchangePlanCard'};
    Object.entries(moduleCardIds).forEach(([key, cardId]) => {
      const card = document.getElementById(cardId);
      if (card) card.classList.toggle('module-active', key === module && !isOpen);
    });

    if (isOpen) return;

    content.classList.remove('hidden');
    if (module === 'assessment') loadAssessment();
    if (module === 'calculator' && typeof initCalculator === 'function') initCalculator();
    if (module === 'dietPlan' && window.dietPlan?.init) window.dietPlan.init();
    if (module === 'exchangePlan' && window.exchangePlan?.init) window.exchangePlan.init();
    content.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  let assessmentId = null;
  let labs = [];

  let assessmentEditing = false;

  function setAssessmentEditMode(editing){
    assessmentEditing=!!editing;
    const box=document.getElementById('assessmentContent');
    if(!box)return;
    box.classList.toggle('assessment-locked',!assessmentEditing);
    box.querySelectorAll('#heightCm,#weightKg,#medicalHistory,#currentDiagnosis,#currentMedications,#nfpeGeneral,#nfpeFat,#nfpeMuscle,#nfpeFluid,#nfpeMicronutrients,#dietaryHistory').forEach(el=>el.disabled=!assessmentEditing);
    const addLabBtn=box.querySelector('[data-action="window.visitPage.addLab"]'); if(addLabBtn)addLabBtn.disabled=!assessmentEditing;
    box.querySelectorAll('#labsList button').forEach(btn=>btn.disabled=!assessmentEditing);
    const save=document.getElementById('saveAssessmentBtn'),edit=document.getElementById('editAssessmentBtn'),del=document.getElementById('deleteAssessmentBtn');
    if(save)save.disabled=!assessmentEditing;
    if(edit)edit.disabled=assessmentEditing||!assessmentId;
    if(del)del.disabled=assessmentEditing||!assessmentId;
  }

  function editAssessment(){if(!assessmentId)return;setAssessmentEditMode(true);document.getElementById('assessmentStatus').textContent='وضع التعديل';}
  function deleteAssessment(){if(!assessmentId)return;const m=document.getElementById('deleteAssessmentModal');if(m){m.classList.remove('hidden');m.classList.add('flex');document.body.classList.add('overflow-hidden');}}
  function closeDeleteAssessmentModal(){const m=document.getElementById('deleteAssessmentModal');if(m){m.classList.add('hidden');m.classList.remove('flex');document.body.classList.remove('overflow-hidden');}}
  async function confirmDeleteAssessment(){
    const user=await getAuthenticatedUser();if(!user||!assessmentId)return;
    const btn=document.getElementById('confirmDeleteAssessmentBtn');if(btn){btn.disabled=true;btn.textContent='جاري الحذف...';}
    const {error}=await db.from('assessment').delete().eq('id',assessmentId).eq('user_id',user.id);
    if(btn){btn.disabled=false;btn.textContent='نعم، حذف التقييم';}
    if(error){console.error(error);document.getElementById('assessmentStatus').textContent='تعذر حذف التقييم';return;}
    assessmentId=null;labs=[];assessmentLoaded=true;
    ['heightCm','weightKg','medicalHistory','currentDiagnosis','currentMedications','nfpeFat','nfpeMuscle','nfpeFluid','nfpeMicronutrients','dietaryHistory'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    document.getElementById('nfpeGeneral').value='';document.getElementById('bmi').value='';document.getElementById('bmiCategory').value='';
    renderLabs();setAssessmentEditMode(true);document.getElementById('assessmentStatus').textContent='تقييم جديد';closeDeleteAssessmentModal();
  }

  function calculateBMI() {
    const h = parseFloat(document.getElementById('heightCm').value);
    const w = parseFloat(document.getElementById('weightKg').value);
    const bmiEl = document.getElementById('bmi');
    const catEl = document.getElementById('bmiCategory');
    if (!h || !w || h <= 0 || w <= 0) { bmiEl.value = ''; catEl.value = ''; return; }
    const value = w / Math.pow(h / 100, 2);
    bmiEl.value = value.toFixed(2);
    catEl.value = value < 18.5 ? 'نقص الوزن' : value < 25 ? 'وزن طبيعي' : value < 30 ? 'زيادة الوزن' : value < 35 ? 'سمنة درجة أولى' : value < 40 ? 'سمنة درجة ثانية' : 'سمنة درجة ثالثة';
  }

  let deletingLabIndex = -1;

  function renderLabs() {
    const list = document.getElementById('labsList');
    const empty = document.getElementById('noLabs');

    list.innerHTML = '';
    empty.classList.toggle('hidden', labs.length > 0);

    labs.forEach((lab, index) => {
      const row = document.createElement('div');
      row.className =
        'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 border border-slate-100 bg-slate-50 rounded-xl p-2';

      if (lab._draft) {
        row.innerHTML = `
          <input data-lab-field="name" data-index="${index}"
            value="${escapeHtml(lab.name || '')}"
            class="w-full min-w-0 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold outline-none focus:border-sky-400"
            placeholder="اسم التحليل">
          <input data-lab-field="value" data-index="${index}"
            value="${escapeHtml(lab.value || '')}"
            class="w-full min-w-0 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold outline-none focus:border-sky-400"
            placeholder="القيمة + الوحدة">
          <div class="flex items-center gap-1">
            <button type="button" data-action="window.visitPage.deleteLab" data-action-args="${index}"
              class="w-8 h-8 rounded-lg bg-white text-red-600 border border-slate-200 text-xs" title="حذف">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>`;
      } else {
        row.innerHTML = `
          <div class="min-w-0 text-xs font-extrabold text-slate-700 truncate">
            ${escapeHtml(lab.name || 'تحليل بدون اسم')}
          </div>
          <div class="min-w-0 text-xs text-slate-500 truncate">
            ${escapeHtml(lab.value || '—')}
          </div>
          <div class="flex items-center gap-1">
            <button type="button" data-action="window.visitPage.deleteLab" data-action-args="${index}"
              ${assessmentEditing ? '' : 'disabled'}
              class="w-8 h-8 rounded-lg bg-white text-red-600 border border-slate-200 text-xs disabled:opacity-40"
              title="حذف">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>`;
      }

      list.appendChild(row);
    });

  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function addLab() {
    if (!assessmentEditing) return;
    labs.push({ id: crypto.randomUUID(), name: '', value: '', _draft: true });
    renderLabs();
    requestAnimationFrame(() => {
      const index = labs.length - 1;
      document.querySelector(`#labsList [data-lab-field="name"][data-index="${index}"]`)?.focus();
    });
  }


  function deleteLab(index) {
    const lab = labs[index];
    if (!lab || !assessmentEditing) return;

    deletingLabIndex = index;
    document.getElementById('deleteLabText').innerHTML =
      `سيتم حذف <span class="font-extrabold text-slate-700">${escapeHtml(lab.name || 'هذا التحليل')}</span> من تقييم هذه الزيارة.`;

    const modal = document.getElementById('deleteLabModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
  }

  function closeDeleteLabModal() {
    const modal = document.getElementById('deleteLabModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
    deletingLabIndex = -1;
  }

  function handleDeleteModalBackdrop(event) {
    if (event.target.id === 'deleteLabModal') closeDeleteLabModal();
  }

  function confirmDeleteLab() {
    if (deletingLabIndex < 0 || !labs[deletingLabIndex]) {
      closeDeleteLabModal();
      return;
    }

    labs.splice(deletingLabIndex, 1);
    renderLabs();
    closeDeleteLabModal();
  }

  function handleLabModalKeydown(event) {
    if (event.key !== 'Escape') return;

    const deleteModal = document.getElementById('deleteLabModal');
    const assessmentDeleteModal = document.getElementById('deleteAssessmentModal');

    if (deleteModal && !deleteModal.classList.contains('hidden')) closeDeleteLabModal();
    if (assessmentDeleteModal && !assessmentDeleteModal.classList.contains('hidden')) closeDeleteAssessmentModal();
  }

  function setAssessmentForm(data) {
    assessmentId = data?.id || null;
    document.getElementById('heightCm').value = data?.height_cm ?? '';
    document.getElementById('weightKg').value = data?.weight_kg ?? '';
    document.getElementById('medicalHistory').value = data?.medical_history ?? '';
    document.getElementById('currentDiagnosis').value = data?.current_diagnosis ?? '';
    document.getElementById('currentMedications').value = data?.current_medications ?? '';
    document.getElementById('nfpeGeneral').value = data?.nfpe_general ?? '';
    document.getElementById('nfpeFat').value = data?.nfpe_fat ?? '';
    document.getElementById('nfpeMuscle').value = data?.nfpe_muscle ?? '';
    document.getElementById('nfpeFluid').value = data?.nfpe_fluid ?? '';
    document.getElementById('nfpeMicronutrients').value = data?.nfpe_micronutrients ?? '';
    document.getElementById('dietaryHistory').value = data?.dietary_history ?? '';
    labs = Array.isArray(data?.labs) ? data.labs : [];
    renderLabs();
    calculateBMI();
    setAssessmentEditMode(!data);
  }

  async function loadAssessment() {
    if (!visitId) return;
    document.getElementById('assessmentStatus').textContent = 'جاري التحميل...';
    const { data, error } = await db.from('assessment').select('*').eq('visit_id', visitId).eq('user_id', visit.user_id || (await getAuthenticatedUser()).id).maybeSingle();
    if (error) {
      console.error(error);
      document.getElementById('assessmentStatus').textContent = 'تعذر تحميل التقييم';
      return;
    }
    setAssessmentForm(data);
    document.getElementById('assessmentStatus').textContent = data ? 'تم تحميل التقييم' : 'تقييم جديد';
  }

  async function saveAssessment() {
    const user = await getAuthenticatedUser();
    if (!user || !visit) return;
    calculateBMI();
    const payload = {
      user_id: user.id, visit_id: visit.id,
      height_cm: parseFloat(document.getElementById('heightCm').value) || null,
      weight_kg: parseFloat(document.getElementById('weightKg').value) || null,
      bmi: parseFloat(document.getElementById('bmi').value) || null,
      bmi_category: document.getElementById('bmiCategory').value || null,
      labs, medical_history: document.getElementById('medicalHistory').value.trim() || null,
      current_diagnosis: document.getElementById('currentDiagnosis').value.trim() || null,
      current_medications: document.getElementById('currentMedications').value.trim() || null,
      nfpe_general: document.getElementById('nfpeGeneral').value || null,
      nfpe_fat: document.getElementById('nfpeFat').value.trim() || null,
      nfpe_muscle: document.getElementById('nfpeMuscle').value.trim() || null,
      nfpe_fluid: document.getElementById('nfpeFluid').value.trim() || null,
      nfpe_micronutrients: document.getElementById('nfpeMicronutrients').value.trim() || null,
      dietary_history: document.getElementById('dietaryHistory').value.trim() || null
    };
    const btn = document.getElementById('saveAssessmentBtn');
    btn.disabled = true; btn.textContent = 'جاري الحفظ...';
    let result;
    if (assessmentId) {
      result = await db.from('assessment').update(payload).eq('id', assessmentId).eq('user_id', user.id).select().single();
    } else {
      result = await db.from('assessment').insert(payload).select().single();
    }
    btn.disabled = false; btn.textContent = 'حفظ التقييم الغذائي';
    if (result.error) {
      console.error(result.error);
      alert('تعذر حفظ التقييم الغذائي.');
      return;
    }
    assessmentId = result.data.id;
    setAssessmentEditMode(false);
    document.getElementById('assessmentStatus').textContent = 'تم الحفظ بنجاح';
  }

  function backToPatient() {
    if (visit?.patient_id) {
      window.location.href =
        'patient-profile.html?id=' + encodeURIComponent(visit.patient_id);
      return;
    }

    window.history.back();
  }



/* ================= MODULE 2 ================= */

const urlParams = new URLSearchParams(window.location.search);
let calcVisitId = urlParams.get('visit_id');
let calcPatientId = urlParams.get('patient_id');
let calcResolvedPatientId = calcPatientId;
let calcInitialized = false;

let calcPatient = null;
let selectedEnergyEquation = 'mifflin';

function calcShowToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const bgColor = type === 'error' ? 'bg-rose-600' : 'bg-emerald-600';
    const toast = document.createElement('div');
    toast.className = `${bgColor} text-white font-bold text-xs px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all transform translate-y-2 opacity-0 pointer-events-auto`;
    toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

        function selectEnergyEquation(eq) {
            selectedEnergyEquation = eq === 'schofield' ? 'schofield' : 'mifflin';

            const heightField = document.getElementById('heightField');
            const schInfo = document.getElementById('schofieldInfo');
            const mifflinBtn = document.getElementById('eqBtnMifflin');
            const schofieldBtn = document.getElementById('eqBtnSchofield');

            heightField.classList.toggle('hidden', selectedEnergyEquation !== 'mifflin');
            schInfo.classList.toggle('hidden', selectedEnergyEquation !== 'schofield');

            const active = 'flex-1 lg:flex-none px-5 py-2.5 rounded-lg text-xs font-extrabold transition bg-white text-emerald-700 shadow-sm';
            const inactive = 'flex-1 lg:flex-none px-5 py-2.5 rounded-lg text-xs font-extrabold transition text-slate-500';
            mifflinBtn.className = selectedEnergyEquation === 'mifflin' ? active : inactive;
            schofieldBtn.className = selectedEnergyEquation === 'schofield' ? active : inactive;

            document.getElementById('resEquation').textContent =
                selectedEnergyEquation === 'mifflin' ? 'Mifflin-St Jeor' : 'Schofield';

            updateSchofieldGroupHint();
        }

        function updateSchofieldGroupHint() {
            const age = parseFloat(document.getElementById('energyAge').value);
            const hint = document.getElementById('schofieldGroupHint');
            const result = document.getElementById('resSchofieldGroup');

            if (!Number.isFinite(age)) {
                hint.textContent = 'الفئات: أقل من 3 سنوات، 3–10، 10–18، 18–30، 30–60، وأكثر من 60 سنة.';
                result.textContent = '—';
                return;
            }

            let group = '';
            if (age < 3) group = '<3 سنوات';
            else if (age < 10) group = '3–10 سنوات';
            else if (age < 18) group = '10–18 سنة';
            else if (age < 30) group = '18–30 سنة';
            else if (age < 60) group = '30–60 سنة';
            else group = '≥60 سنة';

            hint.textContent = `الفئة المختارة: ${group}. المعادلة تستخدم الوزن فقط مع العمر والجنس.`;
            result.textContent = group;
        }

        function calculateSelectedEnergy() {
            const gender = document.getElementById('energyGender').value;
            const age = parseFloat(document.getElementById('energyAge').value);
            const weight = parseFloat(document.getElementById('energyWeight').value);
            const activity = parseFloat(document.getElementById('calcActivity').value) || 1.2;

            if (!Number.isFinite(age) || age < 0 || !Number.isFinite(weight) || weight <= 0) {
                calcShowToast('أدخل العمر والوزن بشكل صحيح أولاً', 'error');
                return;
            }

            let bmr;
            let group;

            if (selectedEnergyEquation === 'mifflin') {
                const height = parseFloat(document.getElementById('energyHeight').value);
                if (!Number.isFinite(height) || height <= 0) {
                    calcShowToast('أدخل الطول لأن معادلة Mifflin-St Jeor تحتاج الطول', 'error');
                    return;
                }
                bmr = (10 * weight) + (6.25 * height) - (5 * age) + (gender === 'male' ? 5 : -161);
                group = '—';
            } else {
                const s = schofieldBMR(gender, age, weight);
                if (!s) {
                    calcShowToast('تعذر تحديد معادلة Schofield لهذه البيانات', 'error');
                    return;
                }
                bmr = s.bmr;
                group = s.group;
            }

            const tdee = Math.round(bmr * activity);

            document.getElementById('resBMR').textContent = Math.round(bmr);
            document.getElementById('resTDEE').textContent = tdee;
            document.getElementById('resSchofieldGroup').textContent = group;
            document.getElementById('resEquation').textContent =
                selectedEnergyEquation === 'mifflin' ? 'Mifflin-St Jeor' : 'Schofield';

            updateTargetAndMacros();
        }

        // Schofield 1985 / FAO-WHO-UNU equations, BMR from body weight.
        // kcal/day; W = body weight in kg.
        function schofieldBMR(gender, age, weight) {
            let bmr = 0;
            let group = '';

            if (age < 3) {
                if (gender === 'male') {
                    bmr = 59.512 * weight - 30.4;
                    group = '<3 سنوات — ذكر';
                } else {
                    bmr = 58.317 * weight - 31.1;
                    group = '<3 سنوات — أنثى';
                }
            } else if (age < 10) {
                if (gender === 'male') {
                    bmr = 22.706 * weight + 504.3;
                    group = '3–10 سنوات — ذكر';
                } else {
                    bmr = 20.315 * weight + 485.9;
                    group = '3–10 سنوات — أنثى';
                }
            } else if (age < 18) {
                if (gender === 'male') {
                    bmr = 17.686 * weight + 658.2;
                    group = '10–18 سنة — ذكر';
                } else {
                    bmr = 13.384 * weight + 692.6;
                    group = '10–18 سنة — أنثى';
                }
            } else if (age < 30) {
                if (gender === 'male') {
                    bmr = 15.057 * weight + 692.2;
                    group = '18–30 سنة — ذكر';
                } else {
                    bmr = 14.818 * weight + 486.6;
                    group = '18–30 سنة — أنثى';
                }
            } else if (age < 60) {
                if (gender === 'male') {
                    bmr = 11.472 * weight + 873.1;
                    group = '30–60 سنة — ذكر';
                } else {
                    bmr = 8.126 * weight + 845.6;
                    group = '30–60 سنة — أنثى';
                }
            } else {
                if (gender === 'male') {
                    bmr = 11.711 * weight + 587.7;
                    group = '≥60 سنة — ذكر';
                } else {
                    bmr = 9.082 * weight + 658.5;
                    group = '≥60 سنة — أنثى';
                }
            }

            return { bmr, group };
        }

        // Compatibility aliases for old saved UI references.
        function calculateTDEE() { calculateSelectedEnergy(); }
        function calculateSchofield() { selectEnergyEquation('schofield'); calculateSelectedEnergy(); }

        function updateTargetAndMacros() {
            const tdee = parseInt(document.getElementById('resTDEE').textContent) || 0;
            const rawAdj = document.getElementById('calcAdjustment').value;
            const adj = (rawAdj === '' || rawAdj === '-' || isNaN(parseInt(rawAdj, 10))) ? 0 : parseInt(rawAdj, 10);
            
            const targetCal = tdee > 0 ? (tdee + adj) : (adj > 0 ? adj : 0);
            document.getElementById('finalTargetCal').textContent = Math.max(0, targetCal);

            const pPercent = parseFloat(document.getElementById('macroProPercent').value) || 0;
            const cPercent = parseFloat(document.getElementById('macroCarbPercent').value) || 0;
            const fPercent = parseFloat(document.getElementById('macroFatPercent').value) || 0;
            const totalPercent = pPercent + cPercent + fPercent;

            const alertEl = document.getElementById('macroTotalAlert');
            if (totalPercent !== 100) {
                alertEl.textContent = `المجموع الحالي: ${totalPercent}% (يجب أن يكون 100%)`;
                alertEl.className = "mt-2 text-[10px] font-bold text-center p-1 rounded bg-rose-100 text-rose-700 block";
            } else {
                alertEl.classList.add('hidden');
            }

            if (targetCal > 0 && totalPercent === 100) {
                document.getElementById('macroProGrams').textContent = Math.round((targetCal * (pPercent/100)) / 4) + 'g';
                document.getElementById('macroCarbGrams').textContent = Math.round((targetCal * (cPercent/100)) / 4) + 'g';
                document.getElementById('macroFatGrams').textContent = Math.round((targetCal * (fPercent/100)) / 9) + 'g';
            } else {
                document.getElementById('macroProGrams').textContent = '0g';
                document.getElementById('macroCarbGrams').textContent = '0g';
                document.getElementById('macroFatGrams').textContent = '0g';
            }
        }


async function loadCalculatorPatientData() {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
        calcShowToast('يجب تسجيل الدخول أولاً', 'error');
        return;
    }

    if (calcVisitId) {
        const { data: visit, error: visitError } = await db
            .from('patient_visits')
            .select('id,patient_id,visit_number,visit_date')
            .eq('id', calcVisitId)
            .eq('user_id', authUser.id)
            .maybeSingle();

        if (visitError || !visit) {
            calcShowToast('تعذر تحميل الزيارة', 'error');
            return;
        }

        calcResolvedPatientId = visit.patient_id;
        window.currentVisit = visit;
    }

    if (!calcResolvedPatientId) {
        calcShowToast('لم يتم تحديد المريض', 'error');
        return;
    }

    const { data, error } = await db
        .from('patients')
        .select('id,name,gender,age,height')
        .eq('id', calcResolvedPatientId)
        .eq('user_id', authUser.id)
        .maybeSingle();

    if (error || !data) {
        calcShowToast('تعذر تحميل بيانات المريض', 'error');
        return;
    }

    calcPatient = data;
    document.getElementById('energyGender').value = calcPatient.gender || 'male';
    document.getElementById('energyAge').value = calcPatient.age ?? '';
    document.getElementById('energyHeight').value = calcPatient.height ?? '';

    const { data: weights } = await db
        .from('weight_logs')
        .select('weight,measurement_date,created_at')
        .eq('patient_id', calcResolvedPatientId)
        .order('measurement_date', { ascending:false })
        .order('created_at', { ascending:false })
        .limit(1);

    if (weights?.[0]?.weight != null) {
        document.getElementById('energyWeight').value = Number(weights[0].weight);
    }

    let plansQuery = db
        .from('nutrition_plans')
        .select('target_calories,target_protein,target_carb,target_fat')
        .eq('patient_id', calcResolvedPatientId);

    if (calcVisitId) plansQuery = plansQuery.eq('visit_id', calcVisitId);

    const { data: plans } = await plansQuery
        .order('updated_at', { ascending:false })
        .order('created_at', { ascending:false })
        .limit(1);

    const plan = plans?.[0];
    if (plan) {
        if (plan.target_calories != null) {
            document.getElementById('calcAdjustment').value = Number(plan.target_calories);
        }
        if (plan.target_protein && plan.target_calories) {
            document.getElementById('macroProPercent').value = Math.round(Number(plan.target_protein) * 4 / Number(plan.target_calories) * 100);
        }
        if (plan.target_carb && plan.target_calories) {
            document.getElementById('macroCarbPercent').value = Math.round(Number(plan.target_carb) * 4 / Number(plan.target_calories) * 100);
        }
        if (plan.target_fat && plan.target_calories) {
            document.getElementById('macroFatPercent').value = Math.round(Number(plan.target_fat) * 9 / Number(plan.target_calories) * 100);
        }
    }

    updateSchofieldGroupHint();
    updateTargetAndMacros();
}

async function applyCustomTargetToPatient() {
    const targetCal = parseInt(document.getElementById('finalTargetCal').textContent, 10) || 0;
    const proGrams = parseInt(document.getElementById('macroProGrams').textContent, 10) || 0;
    const carbGrams = parseInt(document.getElementById('macroCarbGrams').textContent, 10) || 0;
    const fatGrams = parseInt(document.getElementById('macroFatGrams').textContent, 10) || 0;

    const totalPercent =
        (parseFloat(document.getElementById('macroProPercent').value) || 0) +
        (parseFloat(document.getElementById('macroCarbPercent').value) || 0) +
        (parseFloat(document.getElementById('macroFatPercent').value) || 0);

    if (totalPercent !== 100) {
        calcShowToast('يجب أن يكون مجموع نسب الماكروز 100% بالضبط', 'error');
        return;
    }

    if (!calcResolvedPatientId || targetCal <= 0) return;

    const authUser = await getAuthenticatedUser();
    if (!authUser) {
        calcShowToast('يجب تسجيل الدخول أولاً', 'error');
        return;
    }

    let existingQuery = db
        .from('nutrition_plans')
        .select('id')
        .eq('patient_id', calcResolvedPatientId);

    if (calcVisitId) existingQuery = existingQuery.eq('visit_id', calcVisitId);

    const { data: existing, error: findError } = await existingQuery
        .order('updated_at', { ascending:false })
        .order('created_at', { ascending:false })
        .limit(1);

    if (findError) {
        calcShowToast('تعذر الوصول إلى خطة المريض', 'error');
        return;
    }

    const planId = existing?.[0]?.id || crypto.randomUUID();

    const { error } = await db
        .from('nutrition_plans')
        .upsert({
            id: planId,
            patient_id: calcResolvedPatientId,
            visit_id: calcVisitId || null,
            plan_name: 'الخطة الغذائية',
            start_date: new Date().toISOString().slice(0,10),
            target_calories: targetCal,
            target_protein: proGrams,
            target_carb: carbGrams,
            target_fat: fatGrams
        }, { onConflict:'id' });

    if (error) {
        calcShowToast('تعذر حفظ الهدف في قاعدة البيانات', 'error');
        return;
    }

    window.__dietPlannerCalculatorApproved = true;
    window.__dietPlannerApprovedPlan = {
        id: planId,
        patient_id: calcResolvedPatientId,
        visit_id: calcVisitId || null,
        target_calories: targetCal,
        target_protein: proGrams,
        target_carb: carbGrams,
        target_fat: fatGrams
    };

    calcShowToast(`تم اعتماد الهدف (${targetCal} سعر) والماكروز بنجاح`);
}

async function initCalculator(){
    if (calcInitialized) return true;

    const ctx = window.visitContext || {};
    calcVisitId = ctx.id || urlParams.get('visit_id') || null;
    calcPatientId = ctx.patient_id || urlParams.get('patient_id') || null;
    calcResolvedPatientId = calcPatientId;

    selectEnergyEquation('mifflin');
    calcInitialized = true;

    try {
        await loadCalculatorPatientData();
        return true;
    } catch (error) {
        console.error('Calculator initialization error:', error);
        calcInitialized = false;
        calcShowToast('تعذر تحميل بيانات الحاسبة', 'error');
        return false;
    }
}


window.visitPage = {
  loadVisit, showError, formatVisitDate, toggleModule,
  setAssessmentEditMode, editAssessment, deleteAssessment, closeDeleteAssessmentModal,
  confirmDeleteAssessment, calculateBMI, addLab, deleteLab, closeDeleteLabModal,
  confirmDeleteLab, handleDeleteModalBackdrop, saveAssessment, backToPatient,
  updateLabField(index, field, value) {
    if (!labs[index]) return;
    labs[index][field] = value;
  },
  updateTargetAndMacros, selectEnergyEquation, calculateSelectedEnergy,
  applyCustomTargetToPatient, initCalculator, filterFoodList, updateFoodModalHousehold,
  confirmActiveModal() {
    if (window.dietPlan?.hasPendingConfirmation?.()) return window.dietPlan.confirmActiveModal();
    if (window.exchangePlan?.hasPendingConfirmation?.()) return window.exchangePlan.confirmActiveModal();
  }
};
})();

/* ================= MODULE 3 ================= */

/* Embedded diet-plan module. Kept isolated in an IIFE to avoid global/spaghetti collisions. */
(function(){

if (!db) return;
const params=new URLSearchParams(location.search);
const initialUrlVisitId=params.get('visit_id') || params.get('id');
const initialUrlPatientId=params.get('patient_id');
let visitId=initialUrlVisitId;
let patientId=initialUrlPatientId;

let activeCloudPlanId=null, patientInfo={}, foodDatabase=[], daysData=[], savedDaysData=[], dayEditModes={};
let fixedMealsDatabase=[], fixedMealsTargetDayId=null, currentModalContext={dayId:null,mealId:null}, targetMealDayId=null, confirmCallback=null;

function num(v){return Number.isFinite(Number(v))?Number(v):0;}
function cloneDays(v){try{return JSON.parse(JSON.stringify(v||[]));}catch{return[];}}
function showToast(msg,type='success'){
 const c=document.getElementById('toastContainer'); if(!c)return;
 const t=document.createElement('div'); t.className=(type==='error'?'bg-rose-600':'bg-emerald-600')+' text-white font-bold text-xs px-4 py-3 rounded-xl shadow-lg';
 t.innerHTML='<i class="fa-solid '+(type==='error'?'fa-circle-exclamation':'fa-circle-check')+'"></i> <span class="mr-2">'+escapeHtml(msg)+'</span>';
 c.appendChild(t); setTimeout(()=>t.remove(),3000);
}
function openConfirmModal(title,text,callback){
 document.getElementById('confirmTitle').textContent=title; document.getElementById('confirmText').textContent=text;
 confirmCallback=callback; document.getElementById('confirmModal').classList.remove('hidden');
}
function closeConfirmModal(){document.getElementById('confirmModal').classList.add('hidden');confirmCallback=null;}
function scaleHouseholdMeasure(measure,grams){
 if(!measure)return'—'; const g=Number(grams); if(!Number.isFinite(g)||g<0)return measure;
 const factor=g/100, arabic={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
 const fractions={'½':.5,'⅓':1/3,'⅔':2/3,'¼':.25,'¾':.75,'⅕':.2,'⅖':.4,'⅗':.6,'⅘':.8,'⅙':1/6,'⅚':5/6,'⅛':.125,'⅜':.375,'⅝':.625,'⅞':.875};
 let text=String(measure).replace(/[٠-٩]/g,d=>arabic[d]);
 Object.keys(fractions).forEach(ch=>text=text.replaceAll(ch,formatHouseholdNumber(fractions[ch]*factor)));
 text=text.replace(/(^|[^\d.])(\d+(?:\.\d+)?)(?=\s|$|[^\d.])/g,(m,b,n)=>b+formatHouseholdNumber(parseFloat(n)*factor));
 return text===String(measure).replace(/[٠-٩]/g,d=>arabic[d])?`${formatHouseholdNumber(factor)} × ${text}`:text;
}
function formatHouseholdNumber(v){if(!Number.isFinite(v))return'—';if(Math.abs(v-Math.round(v))<.0001)return String(Math.round(v));return String(Math.round(v*100)/100).replace(/\.0+$/,'').replace(/(\.\d*?)0+$/,'$1');}

async function loadPatient(){
 const user=await getAuthenticatedUser(); if(!user){location.href='index.html';return false;}

 let resolvedPatientId=patientId;

 if(visitId){
  const {data:v,error:ve}=await db.from('patient_visits')
   .select('id,patient_id,visit_number,visit_date')
   .eq('id',visitId).eq('user_id',user.id).maybeSingle();
  if(ve||!v){showToast('تعذر تحميل الزيارة','error');return false;}
  resolvedPatientId=v.patient_id;
 }

 if(!resolvedPatientId){location.href='patient.html';return false;}

 const {data:p,error}=await db.from('patients').select('*')
  .eq('id',resolvedPatientId).eq('user_id',user.id).maybeSingle();

 if(error||!p){showToast('تعذر تحميل ملف المريض','error');return false;}

 window.currentPatientId=resolvedPatientId;
 patientInfo={...p,targetCal:'',targetPro:'',targetCarb:'',targetFat:'',goal:'loss'};
 return true;
}

async function loadFoods(){
 const {data,error}=await db.from('foods').select('*').order('name_ar',{ascending:true});
 if(error){showToast('تعذر تحميل مكتبة الأغذية','error');return false;}
 foodDatabase=(data||[]).map(f=>({id:String(f.id),name:f.name_ar||'',household:f.household||'',calories:Number(f.kcal||0),protein:Number(f.protein||0),carbs:Number(f.carb||0),fat:Number(f.fat||0),sodium:Number(f.sodium||0),potassium:Number(f.potassium||0),phosphorus:Number(f.phosphorus||0)}));
 return true;
}

async function loadPlan(){
 let query=db.from('nutrition_plans').select('*').eq('patient_id',window.currentPatientId||patientId);
 if(visitId) query=query.eq('visit_id',visitId);
 const {data:plans,error}=await query.order('updated_at',{ascending:false}).order('created_at',{ascending:false}).limit(1);
 if(error){showToast('تعذر تحميل الخطة الغذائية','error');return;}
 const plan=plans?.[0];
 if(!plan){daysData=[];savedDaysData=[];updateTargets();renderDays();return;}
 activeCloudPlanId=plan.id;
 patientInfo.targetCal=plan.target_calories??''; patientInfo.targetPro=plan.target_protein??''; patientInfo.targetCarb=plan.target_carb??''; patientInfo.targetFat=plan.target_fat??''; patientInfo.goal=plan.goal||'loss';
 const {data:dayRows}=await db.from('plan_days').select('*').eq('plan_id',plan.id).order('day_number',{ascending:true});
 const ids=(dayRows||[]).map(x=>x.id);
 let meals=[]; if(ids.length){const r=await db.from('plan_meals').select('*').in('day_id',ids).order('meal_order',{ascending:true});meals=r.data||[];}
 const mids=meals.map(x=>x.id); let items=[]; if(mids.length){const r=await db.from('plan_items').select('*').in('meal_id',mids);items=r.data||[];}
 daysData=(dayRows||[]).map(d=>({id:d.id,title:d.day_name||`اليوم ${d.day_number}`,notes:'',isCollapsed:false,meals:meals.filter(m=>m.day_id===d.id).map(m=>({id:m.id,name:m.meal_name||'وجبة',description:'',items:items.filter(i=>i.meal_id===m.id).map(i=>({itemId:i.id,foodId:String(i.food_id),grams:Number(i.quantity_g)||0,includeInCalculation:true,...(i.frequency!=null?{repeat:i.frequency}:{})}))}))}));
 savedDaysData=cloneDays(daysData); dayEditModes={}; updateTargets(); renderDays();
}
function updateTargets(){
 document.getElementById('targetCal').textContent=patientInfo.targetCal?`${patientInfo.targetCal} kcal`:'—';
 document.getElementById('targetPro').textContent=patientInfo.targetPro?`${patientInfo.targetPro} g`:'—';
 document.getElementById('targetCarb').textContent=patientInfo.targetCarb?`${patientInfo.targetCarb} g`:'—';
 document.getElementById('targetFat').textContent=patientInfo.targetFat?`${patientInfo.targetFat} g`:'—';
}

function isDayEditing(id){return!!dayEditModes[String(id)];}
function setDayEditMode(id,editing){
 dayEditModes[String(id)]=!!editing; const card=document.querySelector(`[data-day-id="${CSS.escape(String(id))}"]`); if(!card)return;
 card.classList.toggle('day-locked',!editing);
 card.querySelectorAll('input,select,textarea').forEach(e=>e.disabled=!editing);
 card.querySelectorAll('button').forEach(b=>{if(b.classList.contains('day-action-always'))return;b.disabled=!editing;});
 const e=card.querySelector('.day-edit-btn'),s=card.querySelector('.day-save-btn'); if(e)e.disabled=editing;if(s)s.disabled=!editing;
}
function editDay(id){if(daysData.find(d=>String(d.id)===String(id)))setDayEditMode(id,true);}
async function saveDay(id){
 if(!(window.currentPatientId||patientId))return;
 if(!isDayEditing(id))return; const committed=cloneDays(savedDaysData),idx=committed.findIndex(d=>String(d.id)===String(id)),day=daysData.find(d=>String(d.id)===String(id)); if(!day)return;
 if(idx>=0)committed[idx]=cloneDays([day])[0];else committed.push(cloneDays([day])[0]);
 const old=cloneDays(savedDaysData);savedDaysData=committed;daysData=cloneDays(committed);
 const ok=await savePlan();
 if(!ok){savedDaysData=old;showToast('تعذر حفظ اليوم في قاعدة البيانات','error');daysData=cloneDays(old);renderDays();return;}
 dayEditModes[String(id)]=false;renderDays();showToast('تم حفظ بيانات اليوم بنجاح');
}
function addNewDay(){
 const n=daysData.length+1,stamp=Date.now();
 daysData.push({id:'d_'+stamp,title:`اليوم ${n}`,notes:'',isCollapsed:false,meals:[
  {id:'m_'+stamp+'_1',name:'وجبة الإفطار',items:[]},{id:'m_'+stamp+'_2',name:'وجبة الغداء',items:[]},{id:'m_'+stamp+'_3',name:'وجبة العشاء',items:[]}
 ]});
 renderDays();setDayEditMode(daysData[daysData.length-1].id,true);showToast(`تمت إضافة اليوم ${n} — اضغط حفظ لتخزينه`);
}
function toggleDayCollapse(id){const d=daysData.find(x=>x.id===id);if(d){d.isCollapsed=!d.isCollapsed;renderDays();}}
function updateDayTitle(id,v){const d=daysData.find(x=>x.id===id);if(d&&isDayEditing(id))d.title=v;}
function updateDayNotes(id,v){const d=daysData.find(x=>x.id===id);if(d&&isDayEditing(id))d.notes=v;}
function updateMealName(did,mid,v){const d=daysData.find(x=>x.id===did),m=d?.meals.find(x=>x.id===mid);if(!m||!isDayEditing(did))return;if(!String(v).trim()){showToast('اسم الوجبة لا يمكن أن يكون فارغًا','error');renderDays();return}m.name=String(v).trim();}
function moveMeal(did,mid,dir){const d=daysData.find(x=>x.id===did);if(!d||!isDayEditing(did))return;const i=d.meals.findIndex(x=>x.id===mid),n=i+Number(dir);if(i<0||n<0||n>=d.meals.length)return;const [m]=d.meals.splice(i,1);d.meals.splice(n,0,m);renderDays();}
function deleteDay(id){openConfirmModal('حذف اليوم','هل أنت متأكد من حذف هذا اليوم بالكامل؟',async()=>{const old=cloneDays(savedDaysData);savedDaysData=savedDaysData.filter(d=>String(d.id)!==String(id));daysData=cloneDays(savedDaysData);const ok=await savePlan();if(!ok){savedDaysData=old;daysData=cloneDays(old);showToast('تعذر حذف اليوم من قاعدة البيانات','error')}else{delete dayEditModes[String(id)];showToast('تم حذف اليوم بنجاح')}renderDays();});}

function openAddMealModal(id){targetMealDayId=id;document.getElementById('newMealNameInput').value='';document.getElementById('addMealModal').classList.remove('hidden');}
function closeAddMealModal(){document.getElementById('addMealModal').classList.add('hidden');targetMealDayId=null;}
function confirmCreateMeal(){const n=document.getElementById('newMealNameInput').value.trim();if(!n){showToast('يرجى كتابة اسم الوجبة','error');return}const d=daysData.find(x=>x.id===targetMealDayId);if(d&&isDayEditing(d.id)){d.meals.push({id:'m_'+Date.now()+'_'+Math.random().toString(36).slice(2),name:n,items:[]});renderDays();closeAddMealModal();showToast(`تمت إضافة ${n} بنجاح`);}}
function deleteMeal(did,mid){openConfirmModal('حذف الوجبة','هل أنت متأكد من حذف هذه الوجبة بجميع عناصرها؟',()=>{const d=daysData.find(x=>x.id===did);if(d&&isDayEditing(did)){d.meals=d.meals.filter(m=>m.id!==mid);renderDays();showToast('تم حذف الوجبة بنجاح')}});}

function openFoodModal(did,mid){
 currentModalContext={dayId:did,mealId:mid};const d=daysData.find(x=>x.id===did),m=d?.meals.find(x=>x.id===mid);
 document.getElementById('modalMealTitle').textContent=m?`إضافة صنف لـ (${m.name})`:'إضافة صنف للوجبة';
 document.getElementById('foodSearchInput').value='';document.getElementById('selectedFoodId').value='';document.getElementById('foodGramsInput').value='100';document.getElementById('foodModalHouseholdBox').classList.add('hidden');
 filterFoodList();document.getElementById('foodModal').classList.remove('hidden');
}
function closeFoodModal(){document.getElementById('foodModal').classList.add('hidden');currentModalContext={dayId:null,mealId:null};}
function updateFoodModalHousehold(){const f=foodDatabase.find(x=>x.id===document.getElementById('selectedFoodId').value),g=parseFloat(document.getElementById('foodGramsInput').value),box=document.getElementById('foodModalHouseholdBox');if(f?.household&&Number.isFinite(g)){document.getElementById('foodModalHousehold').textContent=scaleHouseholdMeasure(f.household,g);box.classList.remove('hidden')}else box.classList.add('hidden');}
function filterFoodList(){
 const q=document.getElementById('foodSearchInput').value.toLowerCase(),sel=document.getElementById('selectedFoodId').value,drop=document.getElementById('foodDropdownList');
 const list=foodDatabase.filter(f=>f.name.toLowerCase().includes(q)).slice(0,150);
 drop.innerHTML=list.length?list.map(f=>`<div data-action="window.dietPlan.selectFoodForMeal" data-action-args="${escapeHtml(f.id)}" class="p-2.5 hover:bg-emerald-50 cursor-pointer flex justify-between items-center text-xs ${f.id===sel?'bg-emerald-100/70 border-r-4 border-emerald-600':''}"><div><span class="font-extrabold text-slate-800 block">${escapeHtml(f.name)}</span><span class="text-[10px] text-slate-500 font-semibold">${num(f.calories)} kcal | بروتين ${num(f.protein)}g | كارب ${num(f.carbs)}g | دهون ${num(f.fat)}g | Na ${num(f.sodium)}mg | K ${num(f.potassium)}mg | P ${num(f.phosphorus)}mg</span>${f.household?`<span class="text-[10px] text-emerald-700 font-bold block mt-0.5">100 جم ≈ ${escapeHtml(f.household)}</span>`:''}</div>${f.id===sel?'<i class="fa-solid fa-circle-check text-emerald-600"></i>':'<i class="fa-solid fa-plus text-slate-300"></i>'}</div>`).join(''):'<div class="p-3 text-xs text-slate-400 text-center font-bold">لا توجد نتائج مطابقة</div>';
}
function selectFoodForMeal(id){const f=foodDatabase.find(x=>x.id===id);if(f){document.getElementById('selectedFoodId').value=f.id;document.getElementById('foodSearchInput').value=f.name;filterFoodList();updateFoodModalHousehold();}}
function confirmAddFoodItem(){
 const id=document.getElementById('selectedFoodId').value,g=parseFloat(document.getElementById('foodGramsInput').value);
 if(!id){showToast('يرجى اختيار صنف من القائمة أولاً','error');return}if(!g||g<=0){showToast('يرجى تحديد كمية صحيحة بالجرام','error');return}
 const {dayId,mealId}=currentModalContext,d=daysData.find(x=>x.id===dayId),m=d?.meals.find(x=>x.id===mealId);
 if(m&&isDayEditing(dayId)){m.items.push({itemId:'it_'+Date.now()+'_'+Math.random().toString(36).slice(2),foodId:id,grams:g,includeInCalculation:true});renderDays();closeFoodModal();showToast('تم إضافة الصنف إلى الوجبة بنجاح');}
}
function updateMealItemGrams(did,mid,iid,v){const d=daysData.find(x=>x.id===did),m=d?.meals.find(x=>x.id===mid),it=m?.items.find(x=>x.itemId===iid);if(it&&isDayEditing(did)){it.grams=Math.max(0,Number(v)||0);renderDays();}}
function updateMealItemRepeat(did,mid,iid,v){const d=daysData.find(x=>x.id===did),m=d?.meals.find(x=>x.id===mid),it=m?.items.find(x=>x.itemId===iid);if(it&&isDayEditing(did)){it.repeat=String(v??'').trim();renderDays();}}
function deleteFoodItemFromMeal(did,mid,iid){openConfirmModal('حذف الصنف','هل أنت متأكد من حذف هذا الصنف من الوجبة؟',()=>{const d=daysData.find(x=>x.id===did),m=d?.meals.find(x=>x.id===mid);if(m&&isDayEditing(did)){m.items=m.items.filter(x=>x.itemId!==iid);renderDays();showToast('تم إزالة الصنف من الوجبة')}});}
function updateMealItemCalculation(did,mid,iid,checked){const d=daysData.find(x=>x.id===did),m=d?.meals.find(x=>x.id===mid),it=m?.items.find(x=>x.itemId===iid);if(it&&isDayEditing(did)){it.includeInCalculation=!!checked;renderDays();}}

function renderDays(){
 const c=document.getElementById('daysContainer'),empty=document.getElementById('emptyState');
 if(!daysData.length){c.innerHTML='';empty.classList.remove('hidden');return}empty.classList.add('hidden');
 const tc=num(patientInfo.targetCal),tp=num(patientInfo.targetPro),tcarb=num(patientInfo.targetCarb),tf=num(patientInfo.targetFat);
 c.innerHTML=daysData.map((d,di)=>{
  let cal=0,pro=0,carb=0,fat=0,sod=0,pot=0,pho=0;
  (d.meals||[]).forEach(m=>(m.items||[]).forEach(it=>{if(it.includeInCalculation===false)return;const f=foodDatabase.find(x=>String(x.id)===String(it.foodId));if(!f)return;const k=num(it.grams)/100;cal+=f.calories*k;pro+=f.protein*k;carb+=f.carbs*k;fat+=f.fat*k;sod+=f.sodium*k;pot+=f.potassium*k;pho+=f.phosphorus*k;}));
  const pct=(v,t)=>t?Math.min(Math.round(v/t*100),100):0,cc=pct(cal,tc),pp=pct(pro,tp),cp=pct(carb,tcarb),fp=pct(fat,tf),col=d.isCollapsed;
  return `<div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden page-break day-card day-locked" data-day-id="${escapeHtml(d.id)}">
   <div class="p-4 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-3 meal-header">
    <div class="flex items-center gap-3 w-full md:w-auto justify-between">
     <div class="flex items-center gap-2">
      <button class="day-action-always w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center" data-action="window.dietPlan.toggleDayCollapse" data-action-args="${escapeHtml(d.id)}"><i class="fa-solid fa-chevron-down ${col?'':'rotate-180'}"></i></button>
      <span class="w-7 h-7 rounded-lg bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center font-black text-xs">${di+1}</span>
      <input type="text" value="${escapeHtml(d.title)}" data-event-action="window.dietPlan.updateDayTitle" data-event-args="${escapeHtml(d.id)}" class="font-black text-base sm:text-lg text-white bg-transparent border-b border-transparent focus:border-emerald-500 focus:outline-none w-36 sm:w-auto">
     </div>
    </div>
    <div class="flex items-center gap-1.5 no-print flex-wrap justify-end">
     <button type="button" data-action="window.dietPlan.editDay" data-action-args="${escapeHtml(d.id)}" class="day-action-always day-edit-btn text-white bg-sky-600 hover:bg-sky-500 px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5"><i class="fa-solid fa-pen"></i><span>تعديل</span></button>
     <button type="button" data-action="window.dietPlan.saveDay" data-action-args="${escapeHtml(d.id)}" class="day-action-always day-save-btn text-white bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5"><i class="fa-solid fa-floppy-disk"></i><span>حفظ</span></button>
     <button type="button" data-action="window.dietPlan.deleteDay" data-action-args="${escapeHtml(d.id)}" class="day-action-always text-white bg-rose-600 hover:bg-rose-500 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"><i class="fa-solid fa-trash"></i><span class="mr-1">حذف</span></button>
    </div>
   </div>
   <div class="p-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200 collapsible-body ${col?'hidden':''}">
    <div class="flex items-center justify-between mb-3"><h3 class="font-black text-slate-800 text-sm"><i class="fa-solid fa-chart-pie text-emerald-600 ml-1"></i>ملخص إجمالي اليوم</h3>${tc?`<span class="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">${cc}% من المستهدف</span>`:''}</div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
     ${metricCard('🔥 السعرات',cal.toFixed(0),'kcal',tc,cc,'amber')}
     ${metricCard('🥩 البروتين',pro.toFixed(1),'جرام',tp,pp,'slate')}
     ${metricCard('🍞 الكارب',carb.toFixed(1),'جرام',tcarb,cp,'sky')}
     ${metricCard('🥑 الدهون',fat.toFixed(1),'جرام',tf,fp,'emerald')}
    </div>
    <div class="mt-3 bg-white border border-slate-200 rounded-xl p-2.5 flex flex-wrap justify-between gap-2 text-[11px] font-bold">
     <span>🧂 الصوديوم: <b>${sod.toFixed(0)}</b> mg</span><span>🍌 البوتاسيوم: <b>${pot.toFixed(0)}</b> mg</span><span>🦴 الفسفور: <b>${pho.toFixed(0)}</b> mg</span>
    </div>
   </div>
   <div class="p-4 space-y-4 collapsible-body ${col?'hidden':''}">
    <div class="text-xs"><label class="block font-bold text-slate-600 mb-1">ملاحظات اليوم:</label><input type="text" value="${escapeHtml(d.notes||'')}" data-event-action="window.dietPlan.updateDayNotes" data-event-args="${escapeHtml(d.id)}" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2"></div>
    ${(d.meals||[]).map(m=>`<div class="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
     <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-slate-100 pb-2">
      <input type="text" value="${escapeHtml(m.name||'')}" data-event-action="window.dietPlan.updateMealName" data-event-args="${escapeHtml(d.id)}|${escapeHtml(m.id)}" class="w-full max-w-md bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-black text-sm">
      <div class="flex items-center gap-1 no-print">
       <button data-action="window.dietPlan.moveMeal" data-action-args="${escapeHtml(d.id)}|${escapeHtml(m.id)}|-1" class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600"><i class="fa-solid fa-chevron-up text-xs"></i></button>
       <button data-action="window.dietPlan.moveMeal" data-action-args="${escapeHtml(d.id)}|${escapeHtml(m.id)}|1" class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600"><i class="fa-solid fa-chevron-down text-xs"></i></button>
       <button data-action="window.dietPlan.deleteMeal" data-action-args="${escapeHtml(d.id)}|${escapeHtml(m.id)}" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-500"><i class="fa-solid fa-xmark"></i></button>
      </div>
     </div>
     <div class="overflow-x-auto custom-scrollbar"><table class="w-full min-w-[760px] table-fixed text-right text-[11px] sm:text-xs">
      <thead><tr class="text-slate-500 font-bold border-b border-slate-100"><th class="py-1.5 px-2 w-[30%]">اسم الصنف</th><th class="py-1.5 px-2 text-center w-[14%]">الكمية بالجم</th><th class="py-1.5 px-2 text-center w-[27%]">المقياس المنزلي</th><th class="py-1.5 px-2 text-center w-[17%]">التكرار</th><th class="py-1.5 px-2 text-center no-print w-[12%]">إجراء</th></tr></thead>
      <tbody>${m.items?.length?m.items.map(it=>{const f=foodDatabase.find(x=>String(x.id)===String(it.foodId));if(!f)return'';return `<tr class="border-b border-slate-50 last:border-0"><td class="py-1.5 px-2 font-bold text-slate-800">${escapeHtml(f.name)}</td><td class="py-1.5 px-2 text-center"><input type="number" min="0" step="1" value="${num(it.grams)}" data-event-action="window.dietPlan.updateMealItemGrams" data-event-args="${escapeHtml(d.id)}|${escapeHtml(m.id)}|${escapeHtml(it.itemId)}" class="w-24 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-center font-extrabold text-emerald-700"><span class="text-[9px] text-slate-400 mr-1">جم</span></td><td class="py-1.5 px-2 text-center text-emerald-700 font-bold">${f.household?escapeHtml(scaleHouseholdMeasure(f.household,num(it.grams))):'—'}</td><td class="py-1.5 px-2 text-center"><input type="text" value="${escapeHtml(it.repeat??'')}" data-event-action="window.dietPlan.updateMealItemRepeat" data-event-args="${escapeHtml(d.id)}|${escapeHtml(m.id)}|${escapeHtml(it.itemId)}" placeholder="7/7" class="w-20 bg-sky-50 border border-sky-200 rounded-lg px-2 py-1 text-center font-extrabold text-sky-700"></td><td class="py-1.5 px-2 text-center no-print"><input type="checkbox" ${it.includeInCalculation!==false?'checked':''} data-event-action="window.dietPlan.updateMealItemCalculation" data-event-args="${escapeHtml(d.id)}|${escapeHtml(m.id)}|${escapeHtml(it.itemId)}" data-event-value="checked" class="w-4 h-4 cursor-pointer"><button data-action="window.dietPlan.deleteFoodItemFromMeal" data-action-args="${escapeHtml(d.id)}|${escapeHtml(m.id)}|${escapeHtml(it.itemId)}" class="text-rose-400 mr-2"><i class="fa-solid fa-trash"></i></button></td></tr>`}).join(''):'<tr><td colspan="5" class="py-3 text-center text-slate-400 font-semibold">لا توجد أصناف مضافة لهذه الوجبة بعد</td></tr>'}</tbody>
     </table></div>
     <div class="mt-2 no-print"><button data-action="window.dietPlan.openFoodModal" data-action-args="${escapeHtml(d.id)}|${escapeHtml(m.id)}" class="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1.5 rounded-lg">+ إضافة صنف للوجبة</button></div>
    </div>`).join('')}
    <div class="no-print mt-3 p-3 rounded-xl border border-sky-200 bg-sky-50/60 flex flex-wrap gap-2">
     <button data-action="window.dietPlan.openFixedMeals" data-action-args="${escapeHtml(d.id)}" class="text-xs bg-sky-600 text-white px-3 py-2 rounded-lg font-extrabold"><i class="fa-solid fa-utensils ml-1"></i>الوجبات الثابتة لهذا اليوم</button>
     <button data-action="window.dietPlan.openAddMealModal" data-action-args="${escapeHtml(d.id)}" class="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-bold"><i class="fa-solid fa-plus ml-1"></i>إضافة وجبة جديدة</button>
    </div>
   </div>
  </div>`;
 }).join('');
 daysData.forEach(d=>setDayEditMode(d.id,!!dayEditModes[String(d.id)]));
}
function metricCard(label,value,unit,target,pctv,kind){
 const bg={amber:'bg-amber-50 border-amber-200 text-amber-900',slate:'bg-slate-50 border-slate-200 text-slate-800',sky:'bg-sky-50 border-sky-200 text-sky-900',emerald:'bg-emerald-50 border-emerald-200 text-emerald-900'}[kind];
 return `<div class="${bg} border rounded-xl p-3"><div class="flex justify-between items-center mb-1"><span class="text-[11px] font-black">${label}</span>${target?`<span class="text-[10px] font-bold opacity-70">الهدف: ${target}g</span>`:''}</div><div class="flex items-baseline gap-1"><span class="text-xl font-black">${value}</span><span class="text-[10px] font-extrabold">${unit}</span></div>${target?`<div class="w-full bg-white/60 h-1.5 rounded-full mt-2 overflow-hidden"><div class="bg-current h-full rounded-full" style="width:${pctv}%"></div></div>`:''}</div>`;
}

async function syncFixedMeals(){
 const user=await getAuthenticatedUser();if(!user)return;
 const [pub,own]=await Promise.all([
  db.from('diet_templates').select('*').eq('visibility','public').eq('is_active',true).order('created_at',{ascending:false}),
  db.from('diet_templates').select('*').eq('created_by',user.id).order('created_at',{ascending:false})
 ]);
 if(pub.error||own.error){fixedMealsDatabase=[];return}
 const map=new Map();[...(pub.data||[]),...(own.data||[])].forEach(d=>map.set(d.id,d));const diets=[...map.values()];
 const ids=diets.map(d=>d.id);if(!ids.length){fixedMealsDatabase=[];return}
 const dr=await db.from('diet_template_days').select('*').in('diet_id',ids).order('day_number',{ascending:true});if(dr.error)return;
 const days=dr.data||[],dayIds=days.map(x=>x.id);let meals=[];
 if(dayIds.length){const r=await db.from('diet_template_meals').select('*').in('day_id',dayIds).order('meal_order',{ascending:true});meals=r.data||[]}
 const mids=meals.map(x=>x.id);let items=[];if(mids.length){const r=await db.from('diet_template_items').select('*').in('meal_id',mids).order('item_order',{ascending:true});items=r.data||[]}
 fixedMealsDatabase=diets.map(d=>{const day=days.find(x=>x.diet_id===d.id);return{id:d.id,name:d.name||'دايت ثابت',description:d.description||'',created_by:d.created_by,target_calories:d.target_calories,target_protein:d.target_protein,target_carb:d.target_carb,target_fat:d.target_fat,meals:day?meals.filter(m=>m.day_id===day.id).map(m=>({name:m.meal_name||'وجبة',frequency:m.frequency||'',items:items.filter(i=>i.meal_id===m.id).map(i=>({foodId:String(i.food_id),grams:Number(i.quantity_g)||0,repeat:i.frequency??'',household_measure:i.household_measure||''}))})):[]}}).filter(d=>d.meals.length);
 fixedMealsDatabase.sort((a,b)=>(a.created_by===user.id?0:1)-(b.created_by===user.id?0:1));
}
async function openFixedMeals(dayId){
 fixedMealsTargetDayId=dayId;document.getElementById('fixedMealsList').innerHTML='<div class="text-center py-8 text-slate-400 font-bold">جاري تحميل مكتبة الدايت...</div>';document.getElementById('fixedMealsModal').classList.remove('hidden');
 await syncFixedMeals();const list=document.getElementById('fixedMealsList');
 if(!fixedMealsDatabase.length){list.innerHTML='<div class="text-center py-8 text-slate-400 font-bold">لا توجد دايتات منشورة أو دايتات خاصة بك في مكتبة الدايت</div>';return}
 list.innerHTML=fixedMealsDatabase.map((d,i)=>`<div class="border border-slate-200 rounded-2xl p-4 bg-white"><div class="flex items-start justify-between gap-3"><div><h4 class="font-black text-slate-800">${escapeHtml(d.name)}</h4>${d.description?`<p class="text-xs text-slate-500 mt-1">${escapeHtml(d.description)}</p>`:''}</div><button data-action="window.dietPlan.applyFixedDiet" data-action-args="${i}" class="bg-sky-600 text-white text-xs font-extrabold px-3 py-2 rounded-xl">تطبيق اليوم</button></div><div class="mt-3 space-y-2">${d.meals.map((m,mi)=>`<div class="rounded-xl bg-slate-50 border border-slate-100 p-3"><h5 class="font-black text-slate-700 text-xs">${mi+1}. ${escapeHtml(m.name)}</h5><div class="mt-2 overflow-x-auto"><table class="w-full text-[11px]"><tbody>${m.items.map(it=>{const f=foodDatabase.find(x=>String(x.id)===String(it.foodId));return`<tr class="border-b border-slate-100"><td class="py-1.5 font-bold">${f?escapeHtml(f.name):escapeHtml(it.foodId)}</td><td class="py-1.5 text-center">${num(it.grams)} جم</td><td class="py-1.5 text-center">${f?.household?escapeHtml(scaleHouseholdMeasure(f.household,num(it.grams))):'—'}</td><td class="py-1.5 text-center">${escapeHtml(it.repeat||'')}</td></tr>`}).join('')}</tbody></table></div></div>`).join('')}</div></div>`).join('');
}
function closeFixedMeals(){document.getElementById('fixedMealsModal').classList.add('hidden');fixedMealsTargetDayId=null;}
function applyFixedDiet(i){
 const diet=fixedMealsDatabase[i],day=daysData.find(d=>d.id===fixedMealsTargetDayId);if(!diet||!day||!isDayEditing(day.id)){showToast('افتح اليوم بوضع التعديل أولاً','error');return}
 const install=()=>{day.meals=diet.meals.map((m,mi)=>({id:'m_'+Date.now()+'_'+mi+'_'+Math.random().toString(36).slice(2),name:m.name||`وجبة ${mi+1}`,description:'',items:m.items.map((it,ii)=>({itemId:'it_'+Date.now()+'_'+mi+'_'+ii+'_'+Math.random().toString(36).slice(2),foodId:String(it.foodId),grams:num(it.grams),includeInCalculation:true,repeat:it.repeat||''}))}));day.appliedFixedDietKey=diet.id;day.appliedFixedDietName=diet.name;renderDays();closeFixedMeals();showToast(`تم تطبيق «${diet.name}» على اليوم بالكامل`)}
 const has=day.meals.some(m=>m.items?.length);has?openConfirmModal('استبدال محتوى اليوم',`هذا اليوم يحتوي بالفعل على أصناف. تطبيق «${diet.name}» سيستبدل وجبات اليوم الحالية بالكامل. هل تريد المتابعة؟`,install):install();
}

function newCloudUuid(){
 return (window.crypto && typeof window.crypto.randomUUID === 'function')
   ? window.crypto.randomUUID()
   : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
       const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);
       return v.toString(16);
     });
}

async function savePlan(){
 const user=await getAuthenticatedUser();
 if(!user||!(window.currentPatientId||patientId)){showToast('لم يتم تحديد المريض أو المستخدم','error');return false;}

 try{
  const localDays=Array.isArray(savedDaysData)?savedDaysData:(Array.isArray(daysData)?daysData:[]);

  // التأكد من أن كل صنف موجود فعلاً في مكتبة الأغذية قبل لمس قاعدة البيانات.
  const missingFoods=[];
  localDays.forEach(day=>(day.meals||[]).forEach(meal=>(meal.items||[]).forEach(item=>{
   if(!item.foodId)return;
   if(!foodDatabase.some(f=>String(f.id)===String(item.foodId))) missingFoods.push(String(item.foodId));
  })));
  if(missingFoods.length) throw new Error('الصنف غير موجود في مكتبة الأغذية: '+[...new Set(missingFoods)].join(', '));

  let planId=activeCloudPlanId;

  if(!planId){
   let existingQuery=db.from('nutrition_plans')
    .select('id')
    .eq('patient_id',window.currentPatientId||patientId);
   if(visitId) existingQuery=existingQuery.eq('visit_id',visitId);
   const existing=await existingQuery
    .order('updated_at',{ascending:false})
    .order('created_at',{ascending:false})
    .limit(1);
   if(existing.error) throw new Error('فشل البحث عن الخطة: '+existing.error.message);
   planId=existing.data?.[0]?.id||newCloudUuid();
  }

  const planData={
   id:planId,
   patient_id:window.currentPatientId||patientId,
   visit_id:visitId||null,
   plan_name:'الخطة الغذائية',
   start_date:new Date().toISOString().slice(0,10),
   target_calories:Number(patientInfo.targetCal)||null,
   target_protein:Number(patientInfo.targetPro)||null,
   target_carb:Number(patientInfo.targetCarb)||null,
   target_fat:Number(patientInfo.targetFat)||null,
   target_fluid:null,
   goal:patientInfo.goal||null,
   notes:null
  };

  let r=await db.from('nutrition_plans').upsert(planData,{onConflict:'id'});
  if(r.error) throw new Error('فشل حفظ الخطة: '+r.error.message);
  activeCloudPlanId=planId;

  // حذف الأبناء بالترتيب الصحيح بسبب العلاقات Foreign Keys.
  const oldDaysRes=await db.from('plan_days').select('id').eq('plan_id',planId);
  if(oldDaysRes.error) throw new Error('فشل قراءة أيام الخطة القديمة: '+oldDaysRes.error.message);

  const oldDayIds=(oldDaysRes.data||[]).map(x=>x.id);

  if(oldDayIds.length){
   const oldMealsRes=await db.from('plan_meals').select('id').in('day_id',oldDayIds);
   if(oldMealsRes.error) throw new Error('فشل قراءة وجبات الخطة القديمة: '+oldMealsRes.error.message);

   const oldMealIds=(oldMealsRes.data||[]).map(x=>x.id);

   if(oldMealIds.length){
    r=await db.from('plan_items').delete().in('meal_id',oldMealIds);
    if(r.error) throw new Error('فشل حذف أصناف الخطة القديمة: '+r.error.message);

    r=await db.from('plan_meals').delete().in('day_id',oldDayIds);
    if(r.error) throw new Error('فشل حذف وجبات الخطة القديمة: '+r.error.message);
   }

   r=await db.from('plan_days').delete().eq('plan_id',planId);
   if(r.error) throw new Error('فشل حذف أيام الخطة القديمة: '+r.error.message);
  }

  if(!localDays.length)return true;

  const dayRows=localDays.map((d,i)=>({
   id:newCloudUuid(),
   plan_id:planId,
   day_number:i+1,
   day_name:d.title||`اليوم ${i+1}`
  }));

  r=await db.from('plan_days').insert(dayRows);
  if(r.error) throw new Error('فشل حفظ الأيام: '+r.error.message);

  const mealRows=[];
  localDays.forEach((day,di)=>(day.meals||[]).forEach((meal,mi)=>{
   mealRows.push({
    id:newCloudUuid(),
    day_id:dayRows[di].id,
    meal_name:meal.name||`وجبة ${mi+1}`,
    meal_order:mi+1
   });
  }));

  if(mealRows.length){
   r=await db.from('plan_meals').insert(mealRows);
   if(r.error) throw new Error('فشل حفظ الوجبات: '+r.error.message);
  }

  const itemRows=[];
  localDays.forEach((day,di)=>(day.meals||[]).forEach((meal,mi)=>{
   const cloudMeal=mealRows.find(x=>x.day_id===dayRows[di].id&&x.meal_order===mi+1);
   if(!cloudMeal)return;
   (meal.items||[]).forEach(item=>{
    if(!item.foodId)return;
    const food=foodDatabase.find(f=>String(f.id)===String(item.foodId));
    itemRows.push({
     id:newCloudUuid(),
     meal_id:cloudMeal.id,
     food_id:String(item.foodId),
     quantity_g:num(item.grams),
     household_measure:food?.household?scaleHouseholdMeasure(food.household,num(item.grams)):null,
     frequency:item.repeat??null
    });
   });
  }));

  if(itemRows.length){
   r=await db.from('plan_items').insert(itemRows);
   if(r.error) throw new Error('فشل حفظ أصناف الخطة: '+r.error.message);
  }

  return true;
 }catch(e){
  console.error('Nutrition plan save failed:',e);
  window.__lastNutritionPlanSaveError=e?.message||String(e);
  showToast(window.__lastNutritionPlanSaveError,'error');
  return false;
 }
}

function openPrintSettingsModal(){
 const pb=document.getElementById('executePrintBtn');
 if(pb){ pb.dataset.action='window.dietPlan.executePrint'; pb.dataset.actionArgs=''; }
 document.getElementById('printSettingsModal').classList.remove('hidden');
}
function closePrintSettingsModal(){document.getElementById('printSettingsModal').classList.add('hidden')}
function buildPrintPlan(){
 const container=document.getElementById('printPlanContent');if(!container)return;
 const rows=daysData||[];
 container.innerHTML=rows.length?rows.map((day,di)=>{
   const meals=(day.meals||[]).filter(m=>(m.items||[]).some(it=>foodDatabase.some(f=>String(f.id)===String(it.foodId))));
   return `<section class="print-day"><h2 class="print-day-title">${escapeHtml(day.title||`اليوم ${di+1}`)}</h2>
   ${meals.length?meals.map(meal=>`<div class="print-meal"><h3 class="print-meal-title">${escapeHtml(meal.name||'وجبة')}</h3><table><thead><tr><th>الصنف</th><th style="width:18%;text-align:center">الكمية</th><th style="width:28%;text-align:center">المقياس المنزلي</th><th style="width:18%;text-align:center">التكرار</th></tr></thead><tbody>${(meal.items||[]).map(it=>{const f=foodDatabase.find(x=>String(x.id)===String(it.foodId));if(!f)return'';return `<tr><td>${escapeHtml(f.name)}</td><td style="text-align:center">${num(it.grams)} جم</td><td style="text-align:center">${f.household?escapeHtml(scaleHouseholdMeasure(f.household,num(it.grams))):'—'}</td><td style="text-align:center">${escapeHtml(it.repeat||'—')}</td></tr>`}).join('')}</tbody></table></div>`).join(''):`<p class="print-note">لا توجد أصناف مسجلة لهذا اليوم.</p>`}
   ${day.notes?`<p class="print-note">ملاحظات اليوم: ${escapeHtml(day.notes)}</p>`:''}</section>`;
 }).join(''):`<p class="print-note">لا توجد أيام غذائية مسجلة.</p>`;
}
function executePrint(){
 const docName=document.getElementById('settingDocName')?.value?.trim()||'';
 const docSpec=document.getElementById('settingDocSpec')?.value?.trim()||'';
 const hospitalName=document.getElementById('settingClinicName')?.value?.trim()||'';
 const address=document.getElementById('settingAddress')?.value?.trim()||'';
 document.getElementById('printHospitalName').textContent=hospitalName;document.getElementById('printDoctorName').textContent=docName;document.getElementById('printDoctorSpecialty').textContent=docSpec;document.getElementById('printClinicAddress').textContent=address;document.getElementById('printReportDate').textContent='تاريخ التقرير: '+new Date().toLocaleDateString('ar-EG');const visitPatientName = (document.getElementById('patientName')?.textContent || '').trim();
 document.getElementById('printPatientName').textContent = visitPatientName && visitPatientName !== '—' ? 'لـ : ' + visitPatientName : '';
 buildPrintPlan();closePrintSettingsModal();setTimeout(()=>window.print(),200);
}

function goBack(){
 if(visitId){location.href=`visit.html?id=${encodeURIComponent(visitId)}`;return;}
 location.href=`patient-profile.html?id=${encodeURIComponent(window.currentPatientId||patientId)}`
}

let dietInitialized=false;
async function init(){
 if(dietInitialized)return;
 const ctx=window.visitContext||{};
 visitId=ctx.id || params.get('visit_id') || params.get('id') || null;
 patientId=ctx.patient_id || params.get('patient_id') || null;
 dietInitialized=true;
 const ok=await loadPatient();
 if(!ok){dietInitialized=false;return;}
 await loadFoods();
 await loadPlan();
}

window.dietPlan = {confirmActiveModal:()=>{if(confirmCallback){confirmCallback();closeConfirmModal();}}, hasPendingConfirmation:()=>typeof confirmCallback==='function', escapeHtml, num, cloneDays, showToast, openConfirmModal, closeConfirmModal, scaleHouseholdMeasure, formatHouseholdNumber, getAuthenticatedUser, loadPatient, loadFoods, loadPlan, updateTargets, isDayEditing, setDayEditMode, editDay, saveDay, addNewDay, toggleDayCollapse, updateDayTitle, updateDayNotes, updateMealName, moveMeal, deleteDay, openAddMealModal, closeAddMealModal, confirmCreateMeal, deleteMeal, openFoodModal, closeFoodModal, updateFoodModalHousehold, filterFoodList, selectFoodForMeal, confirmAddFoodItem, updateMealItemGrams, updateMealItemRepeat, deleteFoodItemFromMeal, updateMealItemCalculation, renderDays, metricCard, syncFixedMeals, openFixedMeals, closeFixedMeals, applyFixedDiet, newCloudUuid, savePlan, openPrintSettingsModal, closePrintSettingsModal, executePrint, goBack, init};
})();


/* ================= MODULE 4 ================= */

(function(){
const G=[{k:'fruit',n:'الفاكهة',m:1,kcal:60,carb:15,pro:0,fat:0},{k:'veg',n:'الخضروات غير النشوية',m:1,kcal:25,carb:5,pro:2,fat:0},{k:'milk',n:'اللبن والزبادي',m:1,subs:['خالى الدسم','متوسط الدسم','غني الدسم'],v:{'خالى الدسم':[100,12,8,2],'متوسط الدسم':[120,12,8,5],'غني الدسم':[160,12,8,8]}},{k:'legumes',n:'البقوليات',m:1,kcal:115,carb:15,pro:7,fat:0},{k:'starch',n:'النشويات',m:0,kcal:80,carb:15,pro:2,fat:0},{k:'meat',n:'اللحوم',m:0,subs:['خالية الدهون','متوسطة الدهون','غنية الدهون'],v:{'خالية الدهون':[45,0,7,3],'متوسطة الدهون':[75,0,7,5],'غنية الدهون':[100,0,7,8]}},{k:'fat',n:'الدهون',m:0,kcal:45,carb:0,pro:0,fat:5}];
const S={ready:false,plan:null,saved:false,editing:false,t:{cal:0,pro:0,carb:0,fat:0},r:{},days:[],savedDays:[],dayEditing:{},itemContext:null,confirm:null};
G.forEach(g=>S.r[g.k]={count:0,sub:g.k==='milk'?'خالى الدسم':g.k==='meat'?'خالية الدهون':''});
if (!db) console.error('Diet Planner access layer is unavailable to the exchange-plan module.');
const n=v=>Number.isFinite(Number(v))?Number(v):0,rnd=(v,d=2)=>Number(n(v).toFixed(d)),esc=escapeHtml;
const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v??''));
function ctx(){return window.visitContext||{}}
function status(s,e=false){const x=document.getElementById('exchangePlanStatus');if(x){x.textContent=s;x.className='text-[10px] font-bold '+(e?'text-rose-600':'text-emerald-600')}}
function vals(g){const a=S.r[g.k];if(g.v){const x=g.v[a.sub]||Object.values(g.v)[0];return{kcal:x[0],carb:x[1],pro:x[2],fat:x[3]}}return{kcal:g.kcal,carb:g.carb,pro:g.pro,fat:g.fat}}
function manual(){return ['fruit','veg','milk','legumes'].reduce((a,k)=>{const g=G.find(x=>x.k===k),r=S.r[k],v=vals(g),c=n(r.count);a.carb+=c*v.carb;a.pro+=c*v.pro;a.fat+=c*v.fat;a.kcal+=c*v.kcal;return a},{kcal:0,carb:0,pro:0,fat:0})}
function calc(){const m=manual();S.r.starch.count=Math.max(0,rnd((S.t.carb-m.carb)/15,2));const mp=m.pro+S.r.starch.count*2;const mv=vals(G.find(g=>g.k==='meat'));S.r.meat.count=Math.max(0,rnd((S.t.pro-mp)/7,2));S.r.fat.count=Math.max(0,rnd((S.t.fat-m.fat-S.r.meat.count*mv.fat)/5,2))}
function total(){return G.reduce((a,g)=>{const r=S.r[g.k],v=vals(g),c=n(r.count);a.kcal+=c*v.kcal;a.carb+=c*v.carb;a.pro+=c*v.pro;a.fat+=c*v.fat;return a},{kcal:0,carb:0,pro:0,fat:0})}
function setButtons(){const has=!!S.plan;document.getElementById('exchangeSaveBtn').disabled=!S.editing;document.getElementById('exchangeEditBtn').disabled=!has||S.editing;document.getElementById('exchangeDeleteBtn').disabled=!has||S.editing}
function setExchangeCount(key,value){if(!S.r[key])return;S.r[key].count=Math.max(0,n(value));updateDisplay()}
function setExchangeSub(key,value){if(!S.r[key])return;S.r[key].sub=String(value??'');updateDisplay()}
function updateDisplay(){calc();const t=total();document.getElementById('exchangeTotalCal').textContent=rnd(t.kcal,0);document.getElementById('exchangeTotalPro').textContent=rnd(t.pro,1);document.getElementById('exchangeTotalCarb').textContent=rnd(t.carb,1);document.getElementById('exchangeTotalFat').textContent=rnd(t.fat,1);G.forEach(g=>{const row=document.querySelector('[data-ex-row="'+g.k+'"]');if(!row)return;const r=S.r[g.k],v=vals(g),c=n(r.count),els=row.querySelectorAll('[data-val]');[c*v.kcal,c*v.carb,c*v.pro,c*v.fat].forEach((v,i)=>{if(els[i])els[i].textContent=rnd(v,1)});const inp=row.querySelector('[data-count]');if(inp&&document.activeElement!==inp)inp.value=r.count})}
function render(){calc();document.getElementById('exchangeTargetCal').textContent=S.t.cal?rnd(S.t.cal,0)+' kcal':'—';document.getElementById('exchangeTargetPro').textContent=S.t.pro?rnd(S.t.pro,1)+' g':'—';document.getElementById('exchangeTargetCarb').textContent=S.t.carb?rnd(S.t.carb,1)+' g':'—';document.getElementById('exchangeTargetFat').textContent=S.t.fat?rnd(S.t.fat,1)+' g':'—';const b=document.getElementById('exchangeValuesBody');b.innerHTML=G.map(g=>{const r=S.r[g.k],v=vals(g),c=n(r.count);let sub='—';if(g.subs)sub='<select data-sub="'+g.k+'" data-event-action="window.exchangePlan.setExchangeSub" '+(S.editing?'':'disabled')+' class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-bold">'+g.subs.map(s=>'<option value="'+esc(s)+'" '+(r.sub===s?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select>';const cnt=g.m?'<input data-count="'+g.k+'" data-event-action="window.exchangePlan.setExchangeCount" '+(S.editing?'':'disabled')+' type="number" min="0" step="0.5" inputmode="decimal" value="'+r.count+'" class="w-20 mx-auto block text-center bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-extrabold text-violet-700">':'<span class="font-black text-violet-700">'+rnd(r.count,2)+'</span>';return '<tr data-ex-row="'+g.k+'" class="border-b border-slate-100 last:border-0"><td class="py-2.5 px-3 font-black">'+esc(g.n)+'</td><td class="py-2.5 px-3">'+sub+'</td><td class="py-2.5 px-3 text-center">'+cnt+'</td><td data-val class="py-2.5 px-3 text-center font-bold">'+rnd(c*v.kcal,1)+'</td><td data-val class="py-2.5 px-3 text-center font-bold">'+rnd(c*v.carb,1)+'</td><td data-val class="py-2.5 px-3 text-center font-bold">'+rnd(c*v.pro,1)+'</td><td data-val class="py-2.5 px-3 text-center font-bold">'+rnd(c*v.fat,1)+'</td></tr>'}).join('');updateDisplay();setButtons()}
async function findPlans(){const c=ctx();if(!c.patient_id)return[];let q=db.from('nutrition_plans').select('*').eq('patient_id',c.patient_id);if(c.id)q=q.eq('visit_id',c.id);const {data,error}=await q.order('updated_at',{ascending:false}).order('created_at',{ascending:false});return error?[]:(data||[])}
async function loadExchangeValues(){if(!S.plan)return;const r=await db.from('exchange_values').select('group_name,subgroup_name,exchange_count').eq('plan_id',S.plan);if(!r.error)(r.data||[]).forEach(x=>{const g=G.find(y=>y.n===x.group_name);if(g){S.r[g.k].count=n(x.exchange_count);if(x.subgroup_name)S.r[g.k].sub=x.subgroup_name}});S.saved=(r.data||[]).length>0}
async function ensureExchangePlan(){
 if(S.plan && isUuid(S.plan))return S.plan;
 S.plan=null;
 const plans=await findPlans(),base=plans.find(p=>p.plan_name==='الخطة الغذائية')||plans.find(p=>n(p.target_calories)>0);if(!base)return null;S.t={cal:n(base.target_calories),pro:n(base.target_protein),carb:n(base.target_carb),fat:n(base.target_fat)};const id=crypto.randomUUID();const payload={id,patient_id:base.patient_id,visit_id:base.visit_id||ctx().id||null,plan_name:'الخطة الغذائية باستخدام البدائل',start_date:new Date().toISOString().slice(0,10),target_calories:S.t.cal,target_protein:S.t.pro,target_carb:S.t.carb,target_fat:S.t.fat,target_fluid:base.target_fluid??null,goal:base.goal??null,notes:base.notes??null};const r=await db.from('nutrition_plans').insert(payload).select('id').single();if(r.error){status('تعذر إنشاء خطة البدائل: '+r.error.message,true);return null}S.plan=r.data.id;return S.plan}
async function loadDays(){if(!S.plan){S.days=[];S.savedDays=[];renderDays();return}const {data:dr,error:de}=await db.from('plan_days').select('*').eq('plan_id',S.plan).order('day_number',{ascending:true});if(de){status('تعذر تحميل أيام خطة البدائل: '+de.message,true);return}const ids=(dr||[]).map(x=>x.id);let ms=[];if(ids.length){const r=await db.from('plan_meals').select('*').in('day_id',ids).order('meal_order',{ascending:true});if(r.error){status('تعذر تحميل وجبات الخطة: '+r.error.message,true);return}ms=r.data||[]}const mids=ms.map(x=>x.id);let its=[];if(mids.length){const r=await db.from('plan_items').select('id,meal_id,food_id,quantity_g,household_measure,frequency,item_name').in('meal_id',mids);if(r.error){status('تعذر تحميل أصناف الخطة: '+r.error.message,true);return}its=r.data||[]}S.days=(dr||[]).map(d=>({id:d.id,title:d.day_name||'اليوم',meals:ms.filter(m=>m.day_id===d.id).map(m=>({id:m.id,name:m.meal_name||'وجبة',items:its.filter(i=>i.meal_id===m.id).map(i=>({id:i.id,name:i.item_name||'',measure:i.household_measure||'',repeat:i.frequency||''}))}))}));S.savedDays=clone(S.days);S.dayEditing={};renderDays()}
function clone(v){return JSON.parse(JSON.stringify(v||[]))}
function dayEditing(id){return!!S.dayEditing[String(id)]}
function renderDays(){
 const c=document.getElementById('exchangeDaysContainer'),e=document.getElementById('exchangeDaysEmpty');
 if(!S.days.length){c.innerHTML='';e.classList.remove('hidden');return}
 e.classList.add('hidden');
 c.innerHTML=S.days.map((d,di)=>`<div data-xday="${esc(d.id)}" class="border border-slate-200 rounded-2xl overflow-hidden bg-white">
  <div class="p-3 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
   <div class="flex items-center gap-2 flex-1 min-w-0">
    <span class="text-[10px] text-slate-400 font-bold shrink-0">اليوم ${di+1}</span>
    <input value="${esc(d.title)}" ${dayEditing(d.id)?'':'disabled'} data-event-action="window.exchangePlan.setDayTitle" data-event-args="${esc(d.id)}" class="bg-transparent border-b border-slate-600 focus:border-violet-400 outline-none font-black text-sm w-full sm:w-48">
   </div>
   <div class="flex items-center gap-1.5 no-print">
    <button data-action="window.exchangePlan.editDay" data-action-args="${esc(d.id)}" class="px-2.5 py-1.5 rounded-lg bg-sky-600 text-white text-[10px] font-bold"><i class="fa-solid fa-pen ml-1"></i>تعديل</button>
    <button data-action="window.exchangePlan.saveDay" data-action-args="${esc(d.id)}" ${dayEditing(d.id)?'':'disabled'} class="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold disabled:opacity-40"><i class="fa-solid fa-floppy-disk ml-1"></i>حفظ</button>
    <button data-action="window.exchangePlan.deleteDay" data-action-args="${esc(d.id)}" class="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-[10px] font-bold"><i class="fa-solid fa-trash ml-1"></i>حذف</button>
   </div>
  </div>
  <div class="p-3 space-y-3">
   ${(d.meals||[]).map((m,mi)=>`<div class="border border-slate-200 rounded-xl p-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
     <input value="${esc(m.name)}" ${dayEditing(d.id)?'':'disabled'} data-event-action="window.exchangePlan.setMealName" data-event-args="${esc(d.id)}|${esc(m.id)}" class="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-black text-xs w-full sm:w-56">
     <div class="flex gap-1 no-print flex-wrap">
      <button data-action="window.exchangePlan.moveMeal" data-action-args="${esc(d.id)}|${esc(m.id)}|-1" ${dayEditing(d.id)||mi===0?'':'disabled'} class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-40" title="تحريك لأعلى"><i class="fa-solid fa-arrow-up"></i></button>
      <button data-action="window.exchangePlan.moveMeal" data-action-args="${esc(d.id)}|${esc(m.id)}|1" ${dayEditing(d.id)||mi===(d.meals.length-1)?'':'disabled'} class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-40" title="تحريك لأسفل"><i class="fa-solid fa-arrow-down"></i></button>
      <button data-action="window.exchangePlan.addItem" data-action-args="${esc(d.id)}|${esc(m.id)}" ${dayEditing(d.id)?'':'disabled'} class="px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-[10px] font-bold disabled:opacity-40"><i class="fa-solid fa-plus ml-1"></i>إضافة صنف</button>
      <button data-action="window.exchangePlan.deleteMeal" data-action-args="${esc(d.id)}|${esc(m.id)}" ${dayEditing(d.id)?'':'disabled'} class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 disabled:opacity-40" title="حذف الوجبة"><i class="fa-solid fa-trash"></i></button>
     </div>
    </div>
    <div class="overflow-x-auto mt-2">
     <table class="w-full min-w-[720px] text-[10px]">
      <thead><tr class="text-slate-500 border-b border-slate-100"><th class="py-2 text-right">اسم الصنف</th><th class="py-2 text-center">المقياس المنزلي</th><th class="py-2 text-center">التكرار</th><th class="py-2 text-center no-print w-20">إجراء</th></tr></thead>
      <tbody>${(m.items||[]).length?(m.items||[]).map(it=>`<tr class="border-b border-slate-50 last:border-0">
       <td class="py-2 px-1"><input data-xitem-name="${esc(it.id)}" value="${esc(it.name)}" ${dayEditing(d.id)?'':'disabled'} data-event-action="window.exchangePlan.setItemField" data-event-args="${esc(d.id)}|${esc(m.id)}|${esc(it.id)}|name" class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold outline-none focus:border-violet-400"></td>
       <td class="py-2 px-1"><input value="${esc(it.measure)}" ${dayEditing(d.id)?'':'disabled'} data-event-action="window.exchangePlan.setItemField" data-event-args="${esc(d.id)}|${esc(m.id)}|${esc(it.id)}|measure" placeholder="مثال: كوب / ½ رغيف" class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-center outline-none focus:border-violet-400"></td>
       <td class="py-2 px-1"><input value="${esc(it.repeat||'')}" ${dayEditing(d.id)?'':'disabled'} data-event-action="window.exchangePlan.setItemField" data-event-args="${esc(d.id)}|${esc(m.id)}|${esc(it.id)}|repeat" placeholder="يوميًا / 3 مرات أسبوعيًا" class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-center outline-none focus:border-violet-400"></td>
       <td class="py-2 text-center no-print"><button data-action="window.exchangePlan.deleteItem" data-action-args="${esc(d.id)}|${esc(m.id)}|${esc(it.id)}" ${dayEditing(d.id)?'':'disabled'} class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 disabled:opacity-40" title="حذف الصنف"><i class="fa-solid fa-trash"></i></button></td>
      </tr>`).join(''):'<tr><td colspan="4" class="py-5 text-center text-slate-400 font-bold">لا توجد أصناف مضافة. اضغط «إضافة صنف» لإضافة صف جديد.</td></tr>'}</tbody>
     </table>
    </div>

   </div>`).join('')}
   <button data-action="window.exchangePlan.addMeal" data-action-args="${esc(d.id)}" ${dayEditing(d.id)?'':'disabled'} class="w-full border border-dashed border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl py-2 text-xs font-extrabold disabled:opacity-40 no-print"><i class="fa-solid fa-plus ml-1"></i>إضافة وجبة</button>
  </div>
 </div>`).join('');
}
async function addDay(){
 if(!S.plan){const idp=await ensureExchangePlan();if(!idp){status('تعذر إنشاء خطة البدائل لهذا المريض',true);return}}
 const id='local-day-'+Date.now();S.days.push({id,title:`اليوم ${S.days.length+1}`,meals:[{id:'local-meal-'+Date.now()+'-1',name:'وجبة الإفطار',items:[]},{id:'local-meal-'+Date.now()+'-2',name:'وجبة الغداء',items:[]},{id:'local-meal-'+Date.now()+'-3',name:'وجبة العشاء',items:[]}]});S.dayEditing[id]=true;renderDays();status('تمت إضافة اليوم — اضغط حفظ لتخزينه')}
function editDay(id){S.dayEditing[String(id)]=true;renderDays()}
function setDayTitle(id,v){const d=S.days.find(x=>String(x.id)===String(id));if(d&&dayEditing(id))d.title=String(v).trim()||d.title}
function setMealName(did,mid,v){const d=S.days.find(x=>String(x.id)===String(did)),m=d?.meals.find(x=>String(x.id)===String(mid));if(m&&dayEditing(did))m.name=String(v).trim()||m.name}
function moveMeal(did,mid,dir){const d=S.days.find(x=>String(x.id)===String(did));if(!d||!dayEditing(did))return;const i=d.meals.findIndex(m=>String(m.id)===String(mid)),n=i+Number(dir);if(i<0||n<0||n>=d.meals.length)return;const [m]=d.meals.splice(i,1);d.meals.splice(n,0,m);renderDays()}
function addMeal(did){const d=S.days.find(x=>String(x.id)===String(did));if(d&&dayEditing(did)){d.meals.push({id:'local-meal-'+Date.now()+'-'+Math.random().toString(36).slice(2),name:`وجبة ${d.meals.length+1}`,items:[]});renderDays()}}
function deleteMeal(did,mid){openConfirm('حذف الوجبة','هل أنت متأكد من حذف الوجبة بكل أصنافها؟',()=>{const d=S.days.find(x=>String(x.id)===String(did));if(d&&dayEditing(did)){d.meals=d.meals.filter(m=>String(m.id)!==String(mid));renderDays()}})}
function openConfirm(title,text,cb){document.getElementById('confirmTitle').textContent=title;document.getElementById('confirmText').textContent=text;S.confirm=cb;document.getElementById('confirmModal').classList.remove('hidden')}
function closeConfirm(){document.getElementById('confirmModal').classList.add('hidden');S.confirm=null}
async function saveDay(id){if(!dayEditing(id))return;const ok=await saveDaysToDb();if(ok){S.savedDays=clone(S.days);S.dayEditing[String(id)]=false;renderDays();status('تم حفظ اليوم بنجاح')}}
async function saveDaysToDb(){if(!S.plan)return false;try{const oldIds=S.savedDays.filter(d=>!String(d.id).startsWith('local-day-')).map(d=>d.id),curIds=S.days.filter(d=>!String(d.id).startsWith('local-day-')).map(d=>d.id),removed=oldIds.filter(id=>!curIds.includes(id));if(removed.length){const mr=await db.from('plan_meals').select('id').in('day_id',removed);if(mr.error)throw mr.error;const mids=(mr.data||[]).map(x=>x.id);if(mids.length){let r=await db.from('plan_items').delete().in('meal_id',mids);if(r.error)throw r.error;r=await db.from('plan_meals').delete().in('day_id',removed);if(r.error)throw r.error}let r=await db.from('plan_days').delete().in('id',removed);if(r.error)throw r.error}for(let i=0;i<S.days.length;i++){const d=S.days[i];let did=String(d.id).startsWith('local-day-')?null:d.id;if(!did){const r=await db.from('plan_days').insert({plan_id:S.plan,day_number:i+1,day_name:d.title}).select('id').single();if(r.error)throw r.error;did=r.data.id;d.id=did}else{const r=await db.from('plan_days').update({day_number:i+1,day_name:d.title}).eq('id',did);if(r.error)throw r.error}const oldM=await db.from('plan_meals').select('id').eq('day_id',did);if(oldM.error)throw oldM.error;const mids=(oldM.data||[]).map(x=>x.id);if(mids.length){let r=await db.from('plan_items').delete().in('meal_id',mids);if(r.error)throw r.error;r=await db.from('plan_meals').delete().in('day_id',did);if(r.error)throw r.error}const mealRows=(d.meals||[]).map((m,mi)=>({id:crypto.randomUUID(),day_id:did,meal_name:m.name||`وجبة ${mi+1}`,meal_order:mi+1}));if(mealRows.length){const r=await db.from('plan_meals').insert(mealRows);if(r.error)throw r.error}const itemRows=[];(d.meals||[]).forEach((m,mi)=>(m.items||[]).forEach(it=>{if(String(it.name||'').trim())itemRows.push({id:crypto.randomUUID(),meal_id:mealRows[mi].id,food_id:null,item_name:String(it.name).trim(),quantity_g:0,household_measure:String(it.measure||'').trim()||null,frequency:String(it.repeat||'').trim()||null})}));if(itemRows.length){const r=await db.from('plan_items').insert(itemRows);if(r.error)throw r.error}}return true}catch(e){status('تعذر حفظ أيام الخطة: '+(e.message||e),true);return false}}
function deleteDay(id){openConfirm('حذف اليوم','هل أنت متأكد من حذف هذا اليوم بكل وجباته وأصنافه؟',async()=>{const old=clone(S.days),idx=S.days.findIndex(x=>String(x.id)===String(id));if(idx<0)return;S.days.splice(idx,1);if(await saveDaysToDb()){S.savedDays=clone(S.days);renderDays();status('تم حذف اليوم بنجاح')}else{S.days=old;renderDays()}})}
function addItem(did,mid){
 const d=S.days.find(x=>String(x.id)===String(did)),m=d?.meals.find(x=>String(x.id)===String(mid));
 if(!m||!dayEditing(did))return;
 const id='local-item-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 m.items.push({id,name:'',measure:'',repeat:''});
 renderDays();
 requestAnimationFrame(()=>{const el=document.querySelector(`[data-xday="${CSS.escape(String(did))}"] [data-xitem-name="${CSS.escape(String(id))}"]`);if(el){el.focus();el.scrollIntoView({block:'nearest',inline:'nearest'});}});
}
function setItemField(did,mid,iid,field,value){
 const d=S.days.find(x=>String(x.id)===String(did)),m=d?.meals.find(x=>String(x.id)===String(mid)),it=m?.items.find(x=>String(x.id)===String(iid));
 if(it&&dayEditing(did))it[field]=String(value??'');
}
function deleteItem(did,mid,iid){openConfirm('حذف الصنف','هل أنت متأكد من حذف هذا الصنف؟',()=>{const d=S.days.find(x=>String(x.id)===String(did)),m=d?.meals.find(x=>String(x.id)===String(mid));if(m&&dayEditing(did)){m.items=m.items.filter(x=>String(x.id)!==String(iid));renderDays()}})}
function openPrintSettings(){
 const modal=document.getElementById('printSettingsModal');
 const pb=document.getElementById('executePrintBtn');
 if(!modal||!pb)return;
 pb.dataset.action='window.exchangePlan.saveAndPrintFromSettings'; pb.dataset.actionArgs='';
 modal.classList.remove('hidden');
}
function printAll(){
 if(!S.days.length){status('لا توجد أيام غذائية للطباعة',true);return;}
 openPrintSettings();
}
function buildPrintAll(){
 const container=document.getElementById('printPlanContent');
 if(!container)return;
 if(!S.days.length){container.innerHTML='<p class="print-note">لا توجد أيام غذائية مسجلة.</p>';return;}
 container.innerHTML=S.days.map((d,di)=>`<section class="print-day"><h2 class="print-day-title">${esc(d.title||`اليوم ${di+1}`)}</h2>${(d.meals||[]).length?(d.meals||[]).map(m=>`<div class="print-meal"><h3 class="print-meal-title">${esc(m.name||'وجبة')}</h3><table><thead><tr><th>الصنف</th><th style="width:28%;text-align:center">المقياس المنزلي</th><th style="width:24%;text-align:center">التكرار</th></tr></thead><tbody>${(m.items||[]).length?(m.items||[]).map(it=>`<tr><td>${esc(it.name||'—')}</td><td style="text-align:center">${esc(it.measure||'—')}</td><td style="text-align:center">${esc(it.repeat||'—')}</td></tr>`).join(''):'<tr><td colspan="3" style="text-align:center">لا توجد أصناف مسجلة.</td></tr>'}</tbody></table></div>`).join(''):'<p class="print-note">لا توجد وجبات مسجلة.</p>'}</section>`).join('');
}
function executePrintAll(){
 const docName=document.getElementById('settingDocName')?.value?.trim()||'';
 const docSpec=document.getElementById('settingDocSpec')?.value?.trim()||'';
 const hospitalName=document.getElementById('settingClinicName')?.value?.trim()||'';
 const address=document.getElementById('settingAddress')?.value?.trim()||'';
 document.getElementById('printHospitalName').textContent=hospitalName;
 document.getElementById('printDoctorName').textContent=docName;
 document.getElementById('printDoctorSpecialty').textContent=docSpec;
 document.getElementById('printClinicAddress').textContent=address;
 document.getElementById('printReportDate').textContent='تاريخ التقرير: '+new Date().toLocaleDateString('ar-EG');
 const patientName=document.getElementById('patientName')?.textContent?.trim()||'';
 document.getElementById('printPatientName').textContent=patientName&&patientName!=='—'?'لـ : '+patientName:'';
 buildPrintAll();
 document.getElementById('printSettingsModal').classList.add('hidden');
 setTimeout(()=>window.print(),200);
}

async function save(){
 if(!S.editing)return true;
 const planId=await ensureExchangePlan();
 if(!planId){status('اعتمد السعرات والماكروز أولاً من الحاسبة',true);return false}
 render();
 const rows=G.map(g=>{
  const r=S.r[g.k],v=vals(g),c=n(r.count);
  return {plan_id:planId,group_name:g.n,subgroup_name:g.subs?(r.sub||null):null,exchange_count:c,kcal:rnd(c*v.kcal),carb:rnd(c*v.carb),protein:rnd(c*v.pro),fat:rnd(c*v.fat)};
 });
 const del=await db.from('exchange_values').delete().eq('plan_id',planId);
 if(del.error){status('تعذر تحديث خطة البدائل: '+del.error.message,true);return false}
 const ins=await db.from('exchange_values').insert(rows);
 if(ins.error){status('تعذر حفظ خطة البدائل: '+ins.error.message,true);return false}
 S.plan=planId;S.saved=true;S.editing=false;render();await loadDays();setButtons();status('تم حفظ خطة البدائل بنجاح');return true;
}
async function saveAndPrintFromSettings(){
 const pb=document.getElementById('executePrintBtn');
 if(pb)pb.disabled=true;
 try{
  const planId=await ensureExchangePlan();
  if(!planId){status('اعتمد السعرات والماكروز أولاً من الحاسبة',true);return false}

  const hasDayChanges=S.days.some(d=>String(d.id).startsWith('local-day-'))||Object.values(S.dayEditing).some(Boolean);
  if(hasDayChanges){
   if(!(await saveDaysToDb()))return false;
   S.savedDays=clone(S.days);
   Object.keys(S.dayEditing).forEach(k=>S.dayEditing[k]=false);
   renderDays();
  }

  if(S.editing){
   if(!(await save()))return false;
  }

  executePrintAll();
  return true;
 }catch(error){
  console.error('Exchange print error:',error);
  status('تعذر حفظ وطباعة خطة البدائل: '+(error?.message||error),true);
  return false;
 }finally{
  if(pb)pb.disabled=false;
 }
}
function edit(){if(!S.plan)return;S.editing=true;render();status('وضع التعديل')}
function deletePlan(){if(!S.plan)return;openConfirm('حذف خطة البدائل','هل أنت متأكد من حذف خطة البدائل بالكامل؟',async()=>{try{const dr=await db.from('plan_days').select('id').eq('plan_id',S.plan);if(dr.error)throw dr.error;const dids=(dr.data||[]).map(x=>x.id);if(dids.length){const mr=await db.from('plan_meals').select('id').in('day_id',dids);if(mr.error)throw mr.error;const mids=(mr.data||[]).map(x=>x.id);if(mids.length){let r=await db.from('plan_items').delete().in('meal_id',mids);if(r.error)throw r.error;r=await db.from('plan_meals').delete().in('day_id',dids);if(r.error)throw r.error}let r=await db.from('plan_days').delete().in('id',dids);if(r.error)throw r.error}let r=await db.from('exchange_values').delete().eq('plan_id',S.plan);if(r.error)throw r.error;r=await db.from('nutrition_plans').delete().eq('id',S.plan);if(r.error)throw r.error;S.plan=null;S.saved=false;S.editing=true;S.days=[];S.savedDays=[];S.r={};G.forEach(g=>S.r[g.k]={count:0,sub:g.k==='milk'?'خالى الدسم':g.k==='meat'?'خالية الدهون':''});render();renderDays();setButtons();status('تم حذف خطة البدائل بنجاح')}catch(e){status('تعذر حذف خطة البدائل: '+(e.message||e),true)}})}
async function init(){
 if(S.ready)return;
 S.ready=true;
 const approved=window.__dietPlannerApprovedPlan;
 const plans=await findPlans();
 const ex=plans.find(p=>p.plan_name==='الخطة الغذائية باستخدام البدائل');
 const base=(approved&&plans.find(p=>String(p.id)===String(approved.id)))||plans.find(p=>p.plan_name==='الخطة الغذائية');
 if(!base){
   status('اعتمد السعرات والماكروز أولاً من الحاسبة',true);
   S.editing=false;
 }else{
   S.t={cal:n(base.target_calories),pro:n(base.target_protein),carb:n(base.target_carb),fat:n(base.target_fat)};
   window.__dietPlannerCalculatorApproved=true;
   window.__dietPlannerApprovedPlan={id:base.id,patient_id:base.patient_id,visit_id:base.visit_id||null,target_calories:S.t.cal,target_protein:S.t.pro,target_carb:S.t.carb,target_fat:S.t.fat};
   if(ex && isUuid(ex.id)){S.plan=ex.id;S.editing=false;await loadExchangeValues();await loadDays()}
   else {S.plan=null;S.editing=true;}
 }
 render();renderDays();setButtons();
}
window.exchangePlan={confirmActiveModal:()=>{const cb=S.confirm;closeConfirm();if(cb)cb();}, hasPendingConfirmation:()=>typeof S.confirm==='function', init,save,saveAndPrintFromSettings,edit,deletePlan,addDay,editDay,saveDay,deleteDay,setDayTitle,setMealName,addMeal,deleteMeal,moveMeal,addItem,setItemField,deleteItem,setExchangeCount,setExchangeSub,printAll,openPrintSettings,buildPrintAll,executePrintAll,renderDays,closeConfirmModal:closeConfirm};
})();


/* =========================================================
   VISIT EVENT DELEGATION
   One centralized event layer for static and dynamic controls.
   ========================================================= */
(function setupVisitEventDelegation(){
  if(window.__visitEventDelegationBound) return;
  window.__visitEventDelegationBound = true;

  function resolveAction(path){
    return path.split('.').reduce((obj,key)=>obj?.[key], window);
  }

  function parseArgs(element){
    const raw=element.dataset.eventArgs||'';
    return raw ? raw.split('|') : [];
  }

  function invoke(element,event){
    const action=element.dataset.eventAction;
    if(!action) return;
    const fn=resolveAction(action);
    if(typeof fn!=='function'){
      console.error('Visit event action not found:',action);
      return;
    }
    const args=parseArgs(element);
    const valueMode=element.dataset.eventValue;
    if(valueMode==='checked') args.push(!!element.checked);
    else if(valueMode==='value' || element.matches('input,select,textarea')) args.push(element.value);
    try{ fn(...args); }
    catch(error){ console.error('Visit event action failed:',action,error); }
  }

  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-action]');
    if(!el) return;
    const action=el.dataset.action;
    const fn=resolveAction(action);
    if(typeof fn!=='function'){
      console.error('Visit action not found:',action);
      return;
    }
    const args=el.dataset.actionArgs ? el.dataset.actionArgs.split('|') : [];
    try{ fn(...args); }
    catch(error){ console.error('Visit action failed:',action,error); }
  });

  document.addEventListener('input',event=>{
    const el=event.target.closest('[data-event-action],[data-lab-field]');
    if(!el) return;

    if(el.matches('[data-lab-field]')){
      const index=Number(el.dataset.index);
      window.visitPage?.updateLabField(index, el.dataset.labField, el.value);
      return;
    }

    invoke(el,event);
  });

  document.addEventListener('change',event=>{
    const el=event.target.closest('[data-event-action]');
    if(el) invoke(el,event);
  });

  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape') return;
    const deleteLabModal=document.getElementById('deleteLabModal');
    const deleteAssessmentModal=document.getElementById('deleteAssessmentModal');
    if(deleteLabModal && !deleteLabModal.classList.contains('hidden')) window.visitPage?.closeDeleteLabModal();
    if(deleteAssessmentModal && !deleteAssessmentModal.classList.contains('hidden')) window.visitPage?.closeDeleteAssessmentModal();
  });

  const confirmBtn=document.getElementById('confirmOkBtn');
  if(confirmBtn) confirmBtn.dataset.action='window.visitPage.confirmActiveModal';

})();

// Single page bootstrap: DOM is already parsed because this script is deferred.
if (window.visitPage?.loadVisit) window.visitPage.loadVisit();
