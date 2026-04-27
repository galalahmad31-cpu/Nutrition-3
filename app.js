// --- CONFIGURATION ---
const SUPABASE_URL = 'https://svnqppvwptbhxcurxipa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wXN6nc7ug20Zuh89H-k6DQ_gyIZVsfD';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- STATE MANAGEMENT ---
let state = {
    currentView: 'dashboardView',
    patients: [],
    selectedPatient: null,
    visits: [],
    // بيانات الزيارة الحالية
    visitDetails: {
        clinical_diagnosis: '',
        nutritional_diagnosis: '',
        physician: '',
        pharmacist: ''
    },
    enData: { weight: 0, option: 'Breast milk', hours: 3, initRate: 20, advance: 20, goal: 150 },
    pnData: { weight: 0, fluidKg: 100, gir: 6 }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initEventListeners();
    fetchPatients();
});

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.tab);
            if (target) target.classList.add('active');
        });
    });
}

function initEventListeners() {
    // تسجيل مريض جديد
    const patientForm = document.getElementById('patientForm');
    if (patientForm) {
        patientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const patient = {
                name: document.getElementById('p_name').value,
                // ملاحظة: العمود في داتابيز هو 'name' كما ذكرت
            };
            await savePatient(patient);
        });
    }

    document.getElementById('homeBtn').addEventListener('click', () => showView('dashboardView'));
    document.getElementById('addVisitBtn').addEventListener('click', () => startNewVisit());
    document.getElementById('saveVisitBtn').addEventListener('click', finalizeVisit);

    // تحديث الحسابات تلقائياً
    document.querySelectorAll('.en-input').forEach(el => {
        el.addEventListener('input', (e) => {
            state.enData[e.target.dataset.key] = e.target.value;
            updateENCalculations();
        });
    });

    document.querySelectorAll('.pn-input').forEach(el => {
        el.addEventListener('input', (e) => {
            state.pnData[e.target.dataset.key] = e.target.value;
            updatePNCalculations();
        });
    });
}

// --- NAVIGATION ---
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
}

// --- SUPABASE ACTIONS ---
async function fetchPatients() {
    try {
        const { data, error } = await supabaseClient.from('Patients').select('*');
        if (error) throw error;
        state.patients = data || [];
        renderPatients();
    } catch (err) {
        console.error("Error fetching patients:", err.message);
    }
}

async function savePatient(patient) {
    try {
        const { error } = await supabaseClient.from('Patients').insert([patient]);
        if (error) throw error;
        alert("تم تسجيل المريض");
        document.getElementById('patientForm').reset();
        await fetchPatients();
        showView('patientListView');
    } catch (err) {
        alert("خطأ في الاتصال بقاعدة البيانات");
    }
}

function renderPatients() {
    const grid = document.getElementById('patientsGrid');
    grid.innerHTML = state.patients.length ? '' : '<p>لا يوجد مرضى</p>';
    state.patients.forEach(p => {
        const div = document.createElement('div');
        div.className = 'patient-item shadow';
        div.innerHTML = `<div><strong>${p.name}</strong></div><i class="fas fa-chevron-left"></i>`;
        div.onclick = () => openPatientProfile(p);
        grid.appendChild(div);
    });
}

async function openPatientProfile(patient) {
    state.selectedPatient = patient;
    document.getElementById('patientInfoBanner').innerHTML = `
        <div style="text-align:right">
            <h2>${patient.name}</h2>
            <small>ID: ${patient.id}</small>
        </div>
    `;
    await fetchVisits(patient.id);
    showView('patientProfileView');
}

async function fetchVisits(patientId) {
    try {
        const { data, error } = await supabaseClient.from('Visits').select('*').eq('patient_id', patientId);
        if (error) throw error;
        state.visits = data || [];
        renderVisits();
    } catch (err) { console.error(err); }
}

function renderVisits() {
    const grid = document.getElementById('visitsGrid');
    grid.innerHTML = state.visits.length ? '' : '<p>لا توجد زيارات</p>';
    state.visits.forEach(v => {
        const div = document.createElement('div');
        div.className = 'card shadow';
        div.innerHTML = `<p>زيارة بتاريخ: ${new Date(v.created_at).toLocaleDateString('ar-EG')}</p>`;
        grid.appendChild(div);
    });
}

function startNewVisit() {
    state.selectedVisit = null;
    document.getElementById('currentPatientName').innerText = state.selectedPatient.name;
    showView('visitEditorView');
}

// --- الحفظ النهائي للزيارة (ربط الجداول الـ 4) ---
async function finalizeVisit() {
    try {
        // 1. حفظ في جدول Visits
        const visitObj = {
            patient_id: state.selectedPatient.id,
            clinical_diagnosis: "N/A", // يمكن إضافة input له في HTML
            nutritional_diagnosis: "N/A",
            physician: "Dr. Ahmed Galal",
            pharmacist: "Nutrition Specialist"
        };
        
        const { data: vData, error: vErr } = await supabaseClient.from('Visits').insert([visitObj]).select();
        if (vErr) throw vErr;
        const vId = vData[0].id;

        // 2. حفظ في جدول en_records
        await supabaseClient.from('en_records').insert([{
            visit_id: vId,
            weight: parseFloat(state.enData.weight),
            formula: state.enData.option
        }]);

        // 3. حفظ في جدول Pn_records
        await supabaseClient.from('Pn_records').insert([{
            visit_id: vId,
            fluid_ml_kg_d: parseFloat(state.pnData.fluidKg)
        }]);

        alert("تم حفظ الزيارة والبيانات بنجاح");
        openPatientProfile(state.selectedPatient);
    } catch (err) {
        alert("فشل الحفظ: تأكد من إعدادات RLS في Supabase");
        console.error(err);
    }
}

// --- CALCULATIONS ---
function updateENCalculations() {
    const { weight, hours, initRate, advance, goal } = state.enData;
    const w = parseFloat(weight) || 0;
    const freq = 24 / (parseFloat(hours) || 1);
    if(w > 0) {
        document.getElementById('enResults').innerHTML = `
            <p>الجرعة: <strong>${((initRate * w) / freq).toFixed(1)} ml</strong> كل ${hours} ساعة</p>
        `;
    }
}

function updatePNCalculations() {
    const { weight, fluidKg, gir } = state.pnData;
    const w = parseFloat(weight) || 0;
    if(w > 0) {
        document.getElementById('pnResults').innerHTML = `
            <p>إجمالي السوائل: <strong>${(fluidKg * w).toFixed(1)} ml</strong></p>
        `;
    }
}
