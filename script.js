// ============================================================
//  NICU Nutrition Tool — script.js
//  Dr. Ahmed Galal | 2026
// ============================================================

// ============================================================
//  1. SUPABASE CONFIG
// ============================================================
const SUPABASE_URL = "https://svnqppvwptbhxcurxipa.supabase.co";
const SUPABASE_KEY = "sb_publishable_wXN6nc7ug20Zuh89H-k6DQ_gyIZVsfD";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);


// ============================================================
//  2. TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = "success", duration = 3500) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = `show ${type}`;
    setTimeout(() => { toast.className = ""; }, duration);
}


// ============================================================
//  3. TAB NAVIGATION
// ============================================================
function switchTab(tab) {
    document.getElementById("section-en").classList.toggle("hidden", tab !== "en");
    document.getElementById("section-tpn").classList.toggle("hidden", tab !== "tpn");
    document.getElementById("section-ref").classList.toggle("hidden", tab !== "ref");

    document.getElementById("tab-en").classList.toggle("active", tab === "en");
    document.getElementById("tab-tpn").classList.toggle("active", tab === "tpn");
    document.getElementById("tab-ref").classList.toggle("active", tab === "ref");

    const content = document.getElementById("monitoring-content-actual");
    if (tab === "en") {
        document.querySelector(".monitoring-container-shared-en").appendChild(content);
    } else if (tab === "tpn") {
        document.querySelector(".monitoring-container-shared-tpn").appendChild(content);
    }
}

function switchSubTab(sub) {
    document.getElementById("sub-content-enteral").classList.toggle("hidden", sub !== "enteral");
    document.getElementById("sub-content-parenteral").classList.toggle("hidden", sub !== "parenteral");
    document.getElementById("sub-tab-enteral").classList.toggle("active", sub === "enteral");
    document.getElementById("sub-tab-parenteral").classList.toggle("active", sub === "parenteral");
}

function switchEnNested(id) {
    document.querySelectorAll(".en-nested-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll("#sub-content-enteral .nested-tab-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById("en-nested-" + id).classList.remove("hidden");
    document.getElementById("en-btn-" + id).classList.add("active");
}

function switchPnNested(id) {
    document.querySelectorAll(".pn-nested-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll("#sub-content-parenteral .nested-tab-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById("pn-nested-" + id).classList.remove("hidden");
    document.getElementById("pn-btn-" + id).classList.add("active");
}

function toggleFortifier() {
    const isYes = document.getElementById("en-fort-choice").value === "yes";
    document.getElementById("fortifier-box").classList.toggle("hidden", !isYes);
    document.getElementById("res-en-fort-display").classList.toggle("hidden", !isYes);
}


// ============================================================
//  4. ENTERAL NUTRITION CALCULATIONS
// ============================================================
function calculateEN() {
    const w    = parseFloat(document.getElementById("en-weight").value) || 0;
    const h    = parseFloat(document.getElementById("en-hours").value) || 1;
    const init = parseFloat(document.getElementById("en-init-rate").value) || 0;
    const adv  = parseFloat(document.getElementById("en-advance").value) || 0;
    const goal = parseFloat(document.getElementById("en-goal").value) || 0;

    const freq = 24 / h;

    document.getElementById("res-en-start").innerText    = ((init * w) / freq).toFixed(1);
    document.getElementById("res-en-inc").innerText      = ((adv * w) / freq).toFixed(1);
    document.getElementById("res-en-max").innerText      = ((goal * w) / freq).toFixed(1);
    document.getElementById("res-en-interval").innerText  = h;
    document.getElementById("res-en-interval-2").innerText = h;
    document.getElementById("res-en-final-option").innerText = document.getElementById("en-option").value;
    document.getElementById("res-en-fort-text").innerText = document.getElementById("en-fort-instructions").value || "None";
}


// ============================================================
//  5. TPN CALCULATIONS
// ============================================================
function calculateTPN() {
    const rawW  = parseFloat(document.getElementById("tpn-weight").value) || 0;
    const wUnit = document.getElementById("tpn-weight-unit").value;
    const w     = wUnit === "g" ? rawW / 1000 : rawW;

    // --- Fluid ---
    const targetFluidKg = parseFloat(document.getElementById("tpn-fluid-kg").value) || 0;
    const totalFluid    = targetFluidKg * w;
    document.getElementById("res-tpn-total-fluid-calc").innerText = totalFluid.toFixed(1);

    const entFluid = parseFloat(document.getElementById("tpn-enteral-fluid").value) || 0;
    const medFluid = parseFloat(document.getElementById("tpn-other-input").value)   || 0;
    const tpnFluid = totalFluid - entFluid - medFluid;
    document.getElementById("res-tpn-remain-fluid").innerText = tpnFluid.toFixed(1);

    // --- Energy ---
    const targetEnergyKg   = parseFloat(document.getElementById("tpn-target-energy-kg").value) || 0;
    const totalEnergy       = targetEnergyKg * w;
    document.getElementById("res-tpn-total-energy-calc").innerText = totalEnergy.toFixed(1);

    const caloricDensity      = parseFloat(document.getElementById("tpn-caloric-density").value) || 0;
    const enteralEnergyTotal  = entFluid * caloricDensity;
    document.getElementById("res-enteral-energy").innerText = enteralEnergyTotal.toFixed(1) + " kcal";

    const remainingEnergy = Math.max(0, totalEnergy - enteralEnergyTotal);
    document.getElementById("res-tpn-energy-need").innerText = remainingEnergy.toFixed(1) + " kcal";

    // --- Protein ---
    const pG = (parseFloat(document.getElementById("in-prot").value)   || 0) * w;
    const pV = pG / (parseFloat(document.getElementById("sel-prot-conc").value) / 100);
    document.getElementById("res-prot-total").innerText = pG.toFixed(1);
    document.getElementById("res-prot-vol").innerText   = pV.toFixed(1);
    document.getElementById("res-prot-kcal").innerText  = (pG * 4).toFixed(0);

    // --- Lipid ---
    const lG = (parseFloat(document.getElementById("in-lipid").value)  || 0) * w;
    const lV = lG / (parseFloat(document.getElementById("sel-lipid-conc").value) / 100);
    document.getElementById("res-lipid-total").innerText = lG.toFixed(1);
    document.getElementById("res-lipid-vol").innerText   = lV.toFixed(1);
    document.getElementById("res-lipid-kcal").innerText  = (lG * 10).toFixed(0);

    // --- Phosphorus (first — needed for Na correction) ---
    const phosTotal = (parseFloat(document.getElementById("in-phos").value) || 0) * w;

    // --- Sodium ---
    const naIntakeRaw  = (parseFloat(document.getElementById("in-nacl").value) || 0) * w;
    const naAdjusted   = Math.max(0, naIntakeRaw - (2 * phosTotal));
    const naclType     = document.getElementById("sel-nacl-type").value;
    const naVol        = naclType === "3" ? (naAdjusted / 0.513) : (naAdjusted / 0.154);
    document.getElementById("res-nacl-total").innerText = naAdjusted.toFixed(1);
    document.getElementById("res-nacl-vol").innerText   = naVol.toFixed(1);

    // --- Potassium ---
    const kTotal = (parseFloat(document.getElementById("in-kcl").value) || 0) * w;
    const kVol   = kTotal / 2;
    document.getElementById("res-kcl-total").innerText = kTotal.toFixed(1);
    document.getElementById("res-kcl-vol").innerText   = kVol.toFixed(1);

    // --- Calcium ---
    const caTotal = (parseFloat(document.getElementById("in-ca").value) || 0) * w;
    const caVol   = caTotal / 0.23;
    document.getElementById("res-ca-total").innerText = caTotal.toFixed(1);
    document.getElementById("res-ca-vol").innerText   = caVol.toFixed(1);

    // --- Magnesium ---
    const mgTotal = (parseFloat(document.getElementById("in-mg").value) || 0) * w;
    const mgVol   = mgTotal / 0.812;
    document.getElementById("res-mg-total").innerText = mgTotal.toFixed(1);
    document.getElementById("res-mg-vol").innerText   = mgVol.toFixed(1);

    // --- Phosphorus vol ---
    document.getElementById("res-phos-total").innerText = phosTotal.toFixed(1);
    document.getElementById("res-phos-vol").innerText   = phosTotal.toFixed(1);

    // --- Additives ---
    const traceVol = parseFloat(document.getElementById("in-trace-vol").value)     || 0;
    const vitaVol  = parseFloat(document.getElementById("in-vitalipid-vol").value) || 0;
    const soluVol  = parseFloat(document.getElementById("in-soluvito-vol").value)  || 0;

    // --- Glucose ---
    const gir        = parseFloat(document.getElementById("in-gir").value) || 0;
    const totalGGram = (gir * w * 1440) / 1000;
    const otherGGram = (parseFloat(document.getElementById("in-glu-other-rate").value) || 0)
                     * (parseFloat(document.getElementById("in-glu-other-dur").value)  || 0)
                     * (parseFloat(document.getElementById("in-glu-other-conc").value) || 0) / 100;
    const tpnGGram   = totalGGram - otherGGram;
    const tpnGVol    = tpnFluid - (pV + lV + naVol + kVol + caVol + mgVol + phosTotal + traceVol + vitaVol + soluVol);

    document.getElementById("res-glu-total-final").innerText = totalGGram.toFixed(1);
    document.getElementById("res-glu-total-tpn").innerText   = tpnGGram.toFixed(1);
    document.getElementById("res-glu-vol-tpn").innerText     = tpnGVol.toFixed(1);
    document.getElementById("res-glu-kcal-tpn").innerText    = (tpnGGram * 3.4).toFixed(0);

    const gluConc = (tpnGGram / tpnGVol) * 100;
    document.getElementById("res-glu-conc").innerText = isFinite(gluConc) ? gluConc.toFixed(1) + "%" : "0%";

    // --- Totals ---
    const tpnKcalTable = (pG * 4) + (lG * 10) + (tpnGGram * 3.4);
    document.getElementById("res-tpn-total-vol").innerText        = tpnFluid.toFixed(1);
    document.getElementById("res-tpn-total-kcal-table").innerText = tpnKcalTable.toFixed(0);

    const infusionHours = parseFloat(document.getElementById("tpn-infusion-hours").value) || 24;
    const tpnRate       = tpnFluid / infusionHours;
    document.getElementById("res-tpn-rate").innerText = isFinite(tpnRate) ? tpnRate.toFixed(1) + " ml/hr" : "0 ml/hr";

    // --- Osmolarity ---
    const osm = (pG * 10 + tpnGGram * 5 + (naAdjusted + kTotal + caTotal + mgTotal) * 2) / (tpnFluid / 1000);
    document.getElementById("res-osmolarity").innerText = isFinite(osm) ? Math.round(osm) : "0";

    runMixing();
}


// ============================================================
//  6. GLUCOSE MIXING TOOL
// ============================================================
function runMixing() {
    const targetC = parseFloat(document.getElementById("mix-target-conc").value);
    const targetV = parseFloat(document.getElementById("mix-target-vol").value);
    const c1      = parseFloat(document.getElementById("mix-c1").value);
    const c2      = parseFloat(document.getElementById("mix-c2").value);

    if (targetC && targetV && c1 && c2) {
        const v1 = (targetV * (targetC - c2)) / (c1 - c2);
        const v2 = targetV - v1;
        if (v1 >= 0 && v2 >= 0) {
            const txt = `D${c1}%: ${v1.toFixed(1)}ml | D${c2}%: ${v2.toFixed(1)}ml`;
            document.getElementById("mix-result").innerText = txt;
            document.getElementById("res-glu-mix-breakdown").innerText = `(${txt})`;
        }
    }
}


// ============================================================
//  7. PRINT & SHARE
// ============================================================
function smartPrint() {
    const hasEN  = (parseFloat(document.getElementById("en-weight").value)  || 0) > 0;
    const hasTPN = (parseFloat(document.getElementById("tpn-weight").value) || 0) > 0;
    if (!hasEN && !hasTPN) return;
    document.body.classList.remove("print-en", "print-tpn");
    if (hasEN)  document.body.classList.add("print-en");
    if (hasTPN) document.body.classList.add("print-tpn");
    window.print();
}

async function smartShare() {
    const name  = document.getElementById("patient-name").value  || "N/A";
    const date  = document.getElementById("report-date").value   || "N/A";
    const id    = document.getElementById("patient-id").value    || "N/A";
    const ga    = document.getElementById("gestational-age").value || "N/A";
    const bw    = document.getElementById("birth-weight").value  || "N/A";
    const cDiag = document.getElementById("clinical-diagnosis").value    || "N/A";
    const nDiag = document.getElementById("nutritional-diagnosis").value || "N/A";

    const w_en  = parseFloat(document.getElementById("en-weight").value)  || 0;
    const rawW  = parseFloat(document.getElementById("tpn-weight").value) || 0;
    const wUnit = document.getElementById("tpn-weight-unit").value;
    const w_tpn = wUnit === "g" ? rawW / 1000 : rawW;

    if (w_en <= 0 && w_tpn <= 0) return;

    let text = `🏥 NICU Nutrition Report\n`;
    text += `👤 Patient: ${name}\n`;
    text += `📅 Date: ${date} | ID: ${id}\n`;
    text += `👶 GA: ${ga} | Birth Wt: ${bw} kg\n`;
    text += `📝 Clinical Diag: ${cDiag}\n`;
    text += `🍎 Nutrition Diag: ${nDiag}\n\n`;

    if (w_en > 0) {
        text += `🟣 ENTERAL\n• Weight: ${w_en} kg\n`;
        text += `• Start: ${document.getElementById("res-en-start").innerText} ml every ${document.getElementById("res-en-interval").innerText}h\n\n`;
    }
    if (w_tpn > 0) {
        text += `🔵 TPN\n• Weight: ${w_tpn} kg\n`;
        text += `• GIR: ${document.getElementById("in-gir").value}\n`;
        text += `• TPN Rate: ${document.getElementById("res-tpn-rate").innerText}\n\n`;
    }

    if (navigator.share) {
        await navigator.share({ text });
    } else {
        copyToClipboard(text);
        showToast("تم نسخ التقرير! ✅", "success");
    }
}

function copyToClipboard(text) {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
}


// ============================================================
//  8. SAVE TO SUPABASE
// ============================================================
async function saveToSupabase() {
    const btn = document.getElementById("btn-save-db");

    // --- Validation ---
    const patientName = document.getElementById("patient-name").value.trim();
    if (!patientName) {
        showToast("⚠️ الرجاء إدخال اسم المريض أولاً", "error");
        return;
    }

    const w_en  = parseFloat(document.getElementById("en-weight").value)  || 0;
    const rawW  = parseFloat(document.getElementById("tpn-weight").value) || 0;
    const wUnit = document.getElementById("tpn-weight-unit").value;
    const w_tpn = wUnit === "g" ? rawW / 1000 : rawW;

    if (w_en <= 0 && w_tpn <= 0) {
        showToast("⚠️ أدخل وزن المريض في EN أو TPN", "error");
        return;
    }

    // --- UI feedback ---
    btn.classList.add("saving");
    btn.disabled = true;
    showToast("⏳ جاري الحفظ...", "loading", 10000);

    try {

        // ── Step 1: Upsert Patient ──────────────────────────────
        const patientCode = document.getElementById("patient-id").value.trim() || null;

        const { data: patientData, error: patientError } = await db
            .from("patients")
            .upsert(
                {
                    patient_name:            patientName,
                    patient_code:            patientCode,
                    gestational_age_weeks:   parseFloat(document.getElementById("gestational-age").value) || null,
                    birth_weight_kg:         parseFloat(document.getElementById("birth-weight").value)    || null,
                    updated_at:              new Date().toISOString()
                },
                { onConflict: "patient_code", ignoreDuplicates: false }
            )
            .select("id")
            .single();

        if (patientError) throw new Error("Patients: " + patientError.message);
        const patientId = patientData.id;


        // ── Step 2: Create Nutrition Session ───────────────────
        const { data: sessionData, error: sessionError } = await db
            .from("nutrition_sessions")
            .insert({
                patient_id:             patientId,
                session_date:           document.getElementById("report-date").value || new Date().toISOString().split("T")[0],
                clinical_diagnosis:     document.getElementById("clinical-diagnosis").value.trim()    || null,
                nutritional_diagnosis:  document.getElementById("nutritional-diagnosis").value.trim() || null,
                physician_name:         document.getElementById("physician-name").value.trim()        || null,
                pharmacist_name:        document.getElementById("pharmacist-name").value.trim()       || null
            })
            .select("id")
            .single();

        if (sessionError) throw new Error("Session: " + sessionError.message);
        const sessionId = sessionData.id;


        // ── Step 3: Enteral Nutrition Order ────────────────────
        if (w_en > 0) {
            const h      = parseFloat(document.getElementById("en-hours").value) || 1;
            const freq   = 24 / h;
            const init   = parseFloat(document.getElementById("en-init-rate").value) || 0;
            const adv    = parseFloat(document.getElementById("en-advance").value)   || 0;
            const goal   = parseFloat(document.getElementById("en-goal").value)       || 0;

            const { error: enError } = await db
                .from("enteral_nutrition_orders")
                .insert({
                    session_id:                sessionId,
                    weight_kg:                 w_en,
                    feeding_option:            document.getElementById("en-option").value,
                    frequency_hours:           h,
                    is_fortified:              document.getElementById("en-fort-choice").value === "yes",
                    fortification_instructions: document.getElementById("en-fort-instructions").value.trim() || null,
                    initiation_rate_ml_kg_d:   init,
                    advancement_ml_kg_d:       adv,
                    goal_volume_ml_kg_d:       goal,
                    calc_start_volume_ml:      parseFloat(((init * w_en) / freq).toFixed(1)),
                    calc_increase_per_feed_ml: parseFloat(((adv  * w_en) / freq).toFixed(1)),
                    calc_max_volume_ml:        parseFloat(((goal  * w_en) / freq).toFixed(1))
                });

            if (enError) throw new Error("EN Order: " + enError.message);
        }


        // ── Step 4: TPN Order + Components ────────────────────
        if (w_tpn > 0) {

            // Grab all TPN calc values from DOM
            const tpnFluid       = parseFloat(document.getElementById("res-tpn-remain-fluid").innerText)       || 0;
            const tpnRate        = parseFloat(document.getElementById("res-tpn-rate").innerText)               || 0;
            const gluConc        = parseFloat(document.getElementById("res-glu-conc").innerText)               || 0;
            const osmolarity     = parseFloat(document.getElementById("res-osmolarity").innerText)             || 0;
            const totalKcal      = parseFloat(document.getElementById("res-tpn-total-kcal-table").innerText)   || 0;
            const totalFluidCalc = parseFloat(document.getElementById("res-tpn-total-fluid-calc").innerText)   || 0;

            const { data: tpnData, error: tpnError } = await db
                .from("tpn_orders")
                .insert({
                    session_id:                      sessionId,
                    weight_kg:                       w_tpn,
                    target_energy_kcal_kg_d:         parseFloat(document.getElementById("tpn-target-energy-kg").value)  || null,
                    enteral_caloric_density_kcal_ml: parseFloat(document.getElementById("tpn-caloric-density").value)   || null,
                    enteral_fluid_ml:                parseFloat(document.getElementById("tpn-enteral-fluid").value)     || 0,
                    target_fluid_ml_kg_d:            parseFloat(document.getElementById("tpn-fluid-kg").value)          || null,
                    medication_fluid_ml:             parseFloat(document.getElementById("tpn-other-input").value)       || 0,
                    target_gir_mg_kg_min:            parseFloat(document.getElementById("in-gir").value)                || null,
                    other_glucose_rate_ml_h:         parseFloat(document.getElementById("in-glu-other-rate").value)     || 0,
                    other_glucose_duration_h:        parseFloat(document.getElementById("in-glu-other-dur").value)      || 0,
                    other_glucose_concentration_pct: parseFloat(document.getElementById("in-glu-other-conc").value)     || 5,
                    infusion_duration_hours:         parseFloat(document.getElementById("tpn-infusion-hours").value)    || 24,
                    // Calculated
                    calc_total_fluid_ml:             totalFluidCalc,
                    calc_tpn_fluid_ml:               tpnFluid,
                    calc_tpn_rate_ml_hr:             tpnRate,
                    calc_glucose_concentration_pct:  gluConc,
                    calc_osmolarity_mosm_l:          osmolarity,
                    calc_total_kcal:                 totalKcal
                })
                .select("id")
                .single();

            if (tpnError) throw new Error("TPN Order: " + tpnError.message);
            const tpnOrderId = tpnData.id;


            // ── Step 4b: TPN Components ───────────────────────
            const { error: compError } = await db
                .from("tpn_components")
                .insert({
                    tpn_order_id:              tpnOrderId,
                    // Macros
                    protein_concentration_pct: parseFloat(document.getElementById("sel-prot-conc").value),
                    protein_intake_g_kg_d:     parseFloat(document.getElementById("in-prot").value)   || 0,
                    lipid_concentration_pct:   parseFloat(document.getElementById("sel-lipid-conc").value),
                    lipid_intake_g_kg_d:       parseFloat(document.getElementById("in-lipid").value)  || 0,
                    // Electrolytes
                    nacl_type_pct:             parseFloat(document.getElementById("sel-nacl-type").value),
                    sodium_meq_kg_d:           parseFloat(document.getElementById("in-nacl").value)   || 0,
                    potassium_meq_kg_d:        parseFloat(document.getElementById("in-kcl").value)    || 0,
                    calcium_gluconate_meq_kg_d: parseFloat(document.getElementById("in-ca").value)   || 0,
                    magnesium_meq_kg_d:        parseFloat(document.getElementById("in-mg").value)    || 0,
                    phosphorus_mmol_kg_d:      parseFloat(document.getElementById("in-phos").value)  || 0,
                    // Additives
                    trace_element_product:     document.getElementById("sel-trace").value,
                    trace_element_volume_ml:   parseFloat(document.getElementById("in-trace-vol").value)     || 0,
                    vitalipid_type:            document.getElementById("sel-vitalipid").value,
                    vitalipid_volume_ml:       parseFloat(document.getElementById("in-vitalipid-vol").value) || 0,
                    soluvito_volume_ml:        parseFloat(document.getElementById("in-soluvito-vol").value)  || 0,
                    // Calculated volumes
                    calc_protein_volume_ml:    parseFloat(document.getElementById("res-prot-vol").innerText)  || 0,
                    calc_lipid_volume_ml:      parseFloat(document.getElementById("res-lipid-vol").innerText) || 0,
                    calc_glucose_volume_ml:    parseFloat(document.getElementById("res-glu-vol-tpn").innerText) || 0,
                    calc_nacl_volume_ml:       parseFloat(document.getElementById("res-nacl-vol").innerText)  || 0,
                    calc_kcl_volume_ml:        parseFloat(document.getElementById("res-kcl-vol").innerText)   || 0,
                    calc_calcium_volume_ml:    parseFloat(document.getElementById("res-ca-vol").innerText)    || 0,
                    calc_magnesium_volume_ml:  parseFloat(document.getElementById("res-mg-vol").innerText)   || 0,
                    calc_phosphorus_volume_ml: parseFloat(document.getElementById("res-phos-vol").innerText) || 0
                });

            if (compError) throw new Error("TPN Components: " + compError.message);
        }


        // ── Step 5: Monitoring Notes ───────────────────────────
        const labs     = document.getElementById("monitoring-labs").value.trim();
        const clinical = document.getElementById("monitoring-clinical").value.trim();
        const plan     = document.getElementById("monitoring-plan").value.trim();

        if (labs || clinical || plan) {
            const { error: monError } = await db
                .from("monitoring_notes")
                .insert({
                    session_id:              sessionId,
                    lab_values:              labs     || null,
                    clinical_observations:   clinical || null,
                    recommendations_plan:    plan     || null
                });

            if (monError) throw new Error("Monitoring: " + monError.message);
        }


        // ── Success ────────────────────────────────────────────
        showToast("✅ تم الحفظ في قاعدة البيانات بنجاح!", "success");

    } catch (err) {
        console.error("Supabase Save Error:", err);
        showToast("❌ خطأ: " + err.message, "error", 5000);
    } finally {
        btn.classList.remove("saving");
        btn.disabled = false;
    }
}


// ============================================================
//  9. INIT ON LOAD
// ============================================================
window.onload = () => {
    document.getElementById("report-date").value = new Date().toISOString().split("T")[0];
    switchTab("en");
};

