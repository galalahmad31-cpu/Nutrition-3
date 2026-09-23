/* =========================================================
 * Diet Planner — Visit / Energy & Macro Calculator
 * ---------------------------------------------------------
 * UI + visit persistence only.
 * Clinical calculation primitives live in core/nutrition-calculations.js.
 * ========================================================= */

(() => {
  "use strict";

  const calcDb = window.DietPlannerSupabase?.client || null;
  const Nutrition = window.DietPlannerNutritionCalculations || null;
  const Access = window.DietPlannerCoreAccess || null;
  const urlParams = new URLSearchParams(window.location.search);

  if (!calcDb) console.error("Diet Planner Core Supabase client is unavailable to the calculator.");
  if (!Nutrition) console.error("Diet Planner nutrition calculation core is unavailable.");

  let calcVisitId = urlParams.get("visit_id") || urlParams.get("id") || null;
  let calcPatientId = urlParams.get("patient_id") || null;
  let calcResolvedPatientId = calcPatientId;
  let calcInitialized = false;
  let calcPatient = null;
  let selectedEnergyEquation = "mifflin";
  let pendingSavedTargetCalories = null;
  let calcLoadedPlan = null;
  let calcWriteInProgress = false;

  function calcShowToast(msg, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const bgColor = type === "error" ? "bg-rose-600" : "bg-emerald-600";
    const toast = document.createElement("div");
    toast.className = `${bgColor} text-white font-bold text-xs px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all transform translate-y-2 opacity-0 pointer-events-auto`;
    toast.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove("translate-y-2", "opacity-0"), 10);
    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-2");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function updateSchofieldGroupHint() {
    const age = Number.parseFloat(getEl("energyAge")?.value);
    const hint = getEl("schofieldGroupHint");
    const result = getEl("resSchofieldGroup");
    if (!hint || !result) return;

    if (!Number.isFinite(age) || age < 0) {
      hint.textContent = "الفئات: أقل من 3 سنوات، 3–10، 10–18، 18–30، 30–60، و≥60 سنة.";
      result.textContent = "—";
      return;
    }

    let group;
    if (age < 3) group = "<3 سنوات";
    else if (age < 10) group = "3–10 سنوات";
    else if (age < 18) group = "10–18 سنة";
    else if (age < 30) group = "18–30 سنة";
    else if (age < 60) group = "30–60 سنة";
    else group = "≥60 سنة";

    hint.textContent = `الفئة المختارة: ${group}. المعادلة تستخدم الوزن مع العمر والجنس.`;
    result.textContent = group;
  }

  function selectEnergyEquation(eq) {
    selectedEnergyEquation = eq === "schofield" ? "schofield" : "mifflin";

    const heightField = getEl("heightField");
    const schInfo = getEl("schofieldInfo");
    const mifflinBtn = getEl("eqBtnMifflin");
    const schofieldBtn = getEl("eqBtnSchofield");

    if (heightField) heightField.classList.toggle("hidden", selectedEnergyEquation !== "mifflin");
    if (schInfo) schInfo.classList.toggle("hidden", selectedEnergyEquation !== "schofield");

    const active = "flex-1 lg:flex-none px-5 py-2.5 rounded-lg text-xs font-extrabold transition bg-white text-emerald-700 shadow-sm";
    const inactive = "flex-1 lg:flex-none px-5 py-2.5 rounded-lg text-xs font-extrabold transition text-slate-500";
    if (mifflinBtn) mifflinBtn.className = selectedEnergyEquation === "mifflin" ? active : inactive;
    if (schofieldBtn) schofieldBtn.className = selectedEnergyEquation === "schofield" ? active : inactive;

    const equation = getEl("resEquation");
    if (equation) equation.textContent = selectedEnergyEquation === "mifflin" ? "Mifflin-St Jeor" : "Schofield";
    updateSchofieldGroupHint();
  }

  function calculateSelectedEnergy() {
    if (!Nutrition) {
      calcShowToast("وحدة الحسابات الغذائية غير متاحة", "error");
      return false;
    }

    const gender = getEl("energyGender")?.value || "male";
    const age = Number.parseFloat(getEl("energyAge")?.value);
    const weight = Number.parseFloat(getEl("energyWeight")?.value);
    const activity = Number.parseFloat(getEl("calcActivity")?.value) || 1.2;

    if (!Number.isFinite(age) || age < 0 || !Number.isFinite(weight) || weight <= 0) {
      calcShowToast("أدخل العمر والوزن بشكل صحيح أولاً", "error");
      return false;
    }

    let bmr = null;
    let group = "—";

    if (selectedEnergyEquation === "mifflin") {
      const height = Number.parseFloat(getEl("energyHeight")?.value);
      if (!Number.isFinite(height) || height <= 0) {
        calcShowToast("أدخل الطول لأن معادلة Mifflin-St Jeor تحتاج الطول", "error");
        return false;
      }
      bmr = Nutrition.mifflinStJeor({ gender, age, weightKg: weight, heightCm: height });
    } else {
      const result = Nutrition.schofieldBMR(gender, age, weight);
      if (!result) {
        calcShowToast("تعذر تحديد معادلة Schofield لهذه البيانات", "error");
        return false;
      }
      bmr = result.bmr;
      group = result.group;
    }

    const tdee = Nutrition.tdeeFromBmr(bmr, activity);
    if (!Number.isFinite(tdee)) {
      calcShowToast("تعذر حساب الاحتياج اليومي", "error");
      return false;
    }

    getEl("resBMR").textContent = Math.round(bmr);
    getEl("resTDEE").textContent = tdee;
    getEl("resSchofieldGroup").textContent = group;
    getEl("resEquation").textContent = selectedEnergyEquation === "mifflin" ? "Mifflin-St Jeor" : "Schofield";

    // target_calories stored in DB is absolute; calcAdjustment is relative to TDEE.
    if (pendingSavedTargetCalories != null) {
      getEl("calcAdjustment").value = String(Number(pendingSavedTargetCalories) - tdee);
      pendingSavedTargetCalories = null;
    }

    updateTargetAndMacros();
    return true;
  }

  function updateTargetAndMacros() {
    if (!Nutrition) return;

    const tdee = Number.parseInt(getEl("resTDEE")?.textContent, 10) || 0;
    const rawAdj = getEl("calcAdjustment")?.value ?? "";
    const adj = rawAdj === "" || rawAdj === "-" ? 0 : (Number.parseInt(rawAdj, 10) || 0);
    const targetCal = Math.max(0, tdee > 0 ? tdee + adj : adj > 0 ? adj : 0);

    getEl("finalTargetCal").textContent = targetCal;

    const p = Number.parseFloat(getEl("macroProPercent")?.value) || 0;
    const c = Number.parseFloat(getEl("macroCarbPercent")?.value) || 0;
    const f = Number.parseFloat(getEl("macroFatPercent")?.value) || 0;
    const total = p + c + f;
    const alertEl = getEl("macroTotalAlert");

    if (Math.abs(total - 100) > 0.001) {
      if (alertEl) {
        alertEl.textContent = `المجموع الحالي: ${total}% (يجب أن يكون 100%)`;
        alertEl.className = "mt-2 text-[10px] font-bold text-center p-1 rounded bg-rose-100 text-rose-700 block";
      }
    } else if (alertEl) {
      alertEl.classList.add("hidden");
    }

    const macros = Nutrition.macroGrams(targetCal, p, c, f);
    if (macros) {
      getEl("macroProGrams").textContent = `${macros.protein}g`;
      getEl("macroCarbGrams").textContent = `${macros.carb}g`;
      getEl("macroFatGrams").textContent = `${macros.fat}g`;
    } else {
      getEl("macroProGrams").textContent = "0g";
      getEl("macroCarbGrams").textContent = "0g";
      getEl("macroFatGrams").textContent = "0g";
    }
  }

  // Compatibility aliases retained because the existing visit HTML may call them.
  function calculateTDEE() { return calculateSelectedEnergy(); }
  function calculateSchofield() {
    selectEnergyEquation("schofield");
    return calculateSelectedEnergy();
  }

  async function loadCalculatorPatientData() {
    if (!calcDb || !Access) return false;

    const access = await Access.getAccessStatus();
    if (!access?.authenticated || !access.user) {
      calcShowToast("يجب تسجيل الدخول أولاً", "error");
      return false;
    }

    const pageContext = window.visitContext || {};

    if (pageContext.id && pageContext.patient_id) {
      calcVisitId = pageContext.id;
      calcPatientId = pageContext.patient_id;
      calcResolvedPatientId = pageContext.patient_id;
    } else if (calcVisitId) {
      const { data: visit, error } = await calcDb
        .from("patient_visits")
        .select("id,patient_id,visit_number,visit_date")
        .eq("id", calcVisitId)
        .maybeSingle();

      if (error || !visit) {
        console.error("Calculator visit load error:", error);
        calcShowToast("تعذر تحميل الزيارة", "error");
        return false;
      }

      calcVisitId = visit.id;
      calcPatientId = visit.patient_id;
      calcResolvedPatientId = visit.patient_id;
      window.visitContext = {
        id: visit.id,
        patient_id: visit.patient_id,
        visit_number: visit.visit_number ?? null,
        visit_date: visit.visit_date ?? null
      };
    }

    if (!calcResolvedPatientId) {
      calcShowToast("لم يتم تحديد المريض", "error");
      return false;
    }

    const { data: patient, error: patientError } = await calcDb
      .from("patients")
      .select("id,name,gender,age,height")
      .eq("id", calcResolvedPatientId)
      .maybeSingle();

    if (patientError || !patient) {
      console.error("Calculator patient load error:", patientError);
      calcShowToast("تعذر تحميل بيانات المريض", "error");
      return false;
    }

    calcPatient = patient;
    getEl("energyGender").value = patient.gender || "male";
    getEl("energyAge").value = patient.age ?? "";
    getEl("energyHeight").value = patient.height ?? "";

    const { data: weights, error: weightError } = await calcDb
      .from("weight_logs")
      .select("weight,measurement_date,created_at")
      .eq("patient_id", calcResolvedPatientId)
      .order("measurement_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (weightError) console.warn("Calculator weight load warning:", weightError);
    if (weights?.[0]?.weight != null) getEl("energyWeight").value = Number(weights[0].weight);

    calcLoadedPlan = null;
    pendingSavedTargetCalories = null;

    let query = calcDb
      .from("nutrition_plans")
      .select("id,patient_id,visit_id,target_calories,target_protein,target_carb,target_fat,updated_at,created_at")
      .eq("patient_id", calcResolvedPatientId);

    if (calcVisitId) query = query.eq("visit_id", calcVisitId);

    const { data: plans, error: planError } = await query
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (planError) console.warn("Calculator plan load warning:", planError);

    const plan = plans?.[0] || null;
    if (plan) {
      calcLoadedPlan = plan;
      const target = Number(plan.target_calories);

      if (Number.isFinite(target) && target > 0) {
        pendingSavedTargetCalories = target;

        const p = Number(plan.target_protein);
        const c = Number(plan.target_carb);
        const f = Number(plan.target_fat);
        if (Number.isFinite(p) && p >= 0) getEl("macroProPercent").value = Math.round((p * 4 / target) * 100);
        if (Number.isFinite(c) && c >= 0) getEl("macroCarbPercent").value = Math.round((c * 4 / target) * 100);
        if (Number.isFinite(f) && f >= 0) getEl("macroFatPercent").value = Math.round((f * 9 / target) * 100);
      }
    }

    updateSchofieldGroupHint();

    if (pendingSavedTargetCalories != null) {
      const savedTarget = pendingSavedTargetCalories;
      pendingSavedTargetCalories = null;
      if (!calculateSelectedEnergy()) return false;
      const tdee = Number(getEl("resTDEE")?.textContent) || 0;
      getEl("calcAdjustment").value = String(savedTarget - tdee);
      updateTargetAndMacros();
    } else {
      updateTargetAndMacros();
    }

    return true;
  }

  async function applyCustomTargetToPatient() {
    if (calcWriteInProgress || !calcDb || !Access) return;

    const access = await Access.getAccessStatus();
    if (!access?.authenticated || !access.user) {
      calcShowToast("يجب تسجيل الدخول أولاً", "error");
      return;
    }

    const canWrite = access.isAdmin === true || await Access.canWrite(access.user.id);
    if (!canWrite) {
      calcShowToast("حفظ أهداف المريض متاح أثناء الاشتراك المدفوع فقط", "error");
      return;
    }

    const targetCal = Number.parseInt(getEl("finalTargetCal")?.textContent, 10) || 0;
    const proGrams = Number.parseInt(getEl("macroProGrams")?.textContent, 10) || 0;
    const carbGrams = Number.parseInt(getEl("macroCarbGrams")?.textContent, 10) || 0;
    const fatGrams = Number.parseInt(getEl("macroFatGrams")?.textContent, 10) || 0;
    const totalPercent =
      (Number.parseFloat(getEl("macroProPercent")?.value) || 0) +
      (Number.parseFloat(getEl("macroCarbPercent")?.value) || 0) +
      (Number.parseFloat(getEl("macroFatPercent")?.value) || 0);

    if (Math.abs(totalPercent - 100) > 0.001) {
      calcShowToast("يجب أن يكون مجموع نسب الماكروز 100% بالضبط", "error");
      return;
    }

    if (!calcResolvedPatientId || targetCal <= 0) {
      calcShowToast("أكمل بيانات المريض وحساب السعرات أولاً", "error");
      return;
    }

    calcWriteInProgress = true;
    const button = document.querySelector('[data-action="applyCustomTargetToPatient"]');
    if (button) button.disabled = true;

    try {
      let existingQuery = calcDb
        .from("nutrition_plans")
        .select("id")
        .eq("patient_id", calcResolvedPatientId)
        .limit(1);

      if (calcVisitId) existingQuery = existingQuery.eq("visit_id", calcVisitId);

      const { data: existing, error: findError } = await existingQuery;
      if (findError) {
        console.error("Calculator existing plan lookup error:", findError);
        calcShowToast("تعذر الوصول إلى خطة المريض", "error");
        return;
      }

      const planId = existing?.[0]?.id || crypto.randomUUID();
      const payload = {
        id: planId,
        patient_id: calcResolvedPatientId,
        visit_id: calcVisitId || null,
        plan_name: "الخطة الغذائية",
        start_date: new Date().toISOString().slice(0, 10),
        target_calories: targetCal,
        target_protein: proGrams,
        target_carb: carbGrams,
        target_fat: fatGrams
      };

      const { data: savedPlan, error: saveError } = await calcDb
        .from("nutrition_plans")
        .upsert(payload, { onConflict: "id" })
        .select("id,patient_id,visit_id,target_calories,target_protein,target_carb,target_fat")
        .single();

      if (saveError) {
        console.error("Calculator plan save error:", saveError);
        calcShowToast("تعذر حفظ الهدف في قاعدة البيانات", "error");
        return;
      }

      calcLoadedPlan = savedPlan;
      window.__dietPlannerCalculatorApproved = true;
      window.__dietPlannerApprovedPlan = savedPlan;
      calcShowToast(`تم اعتماد الهدف (${targetCal} سعر) والماكروز بنجاح`);
    } finally {
      calcWriteInProgress = false;
      if (button) button.disabled = false;
    }
  }

  async function initCalculator() {
    if (calcInitialized) return true;
    if (!Access) {
      calcShowToast("وحدة الوصول الأساسية غير متاحة", "error");
      return false;
    }

    selectEnergyEquation("mifflin");

    try {
      const access = await Access.getAccessStatus();
      if (!access?.authenticated) {
        calcShowToast("يجب تسجيل الدخول أولاً", "error");
        return false;
      }

      const hasContext = !!(window.visitContext?.id && window.visitContext?.patient_id);
      const hasFallback = !!(calcVisitId || calcPatientId);
      if (!hasContext && !hasFallback) {
        calcShowToast("لم تكتمل بيانات الزيارة بعد", "error");
        return false;
      }

      const ok = await loadCalculatorPatientData();
      calcInitialized = ok;
      return ok;
    } catch (error) {
      console.error("Calculator initialization error:", error);
      calcInitialized = false;
      calcShowToast("تعذر تحميل بيانات الحاسبة", "error");
      return false;
    }
  }

  // Keep the existing inline/data-action HTML contract intact.
  window.selectEnergyEquation = selectEnergyEquation;
  window.calculateSelectedEnergy = calculateSelectedEnergy;
  window.calculateTDEE = calculateTDEE;
  window.calculateSchofield = calculateSchofield;
  window.updateTargetAndMacros = updateTargetAndMacros;
  window.updateSchofieldGroupHint = updateSchofieldGroupHint;
  window.applyCustomTargetToPatient = applyCustomTargetToPatient;
  window.initCalculator = initCalculator;
})();
