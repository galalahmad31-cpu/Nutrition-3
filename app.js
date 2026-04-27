// --- CONFIGURATION ---
const SUPABASE_URL = 'https://svnqppvwptbhxcurxipa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wXN6nc7ug20Zuh89H-k6DQ_gyIZVsfD';

// إنشاء الكلاينت مع التأكد من وجود المكتبة
let supabaseClient;
try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase Client initialized");
} catch (e) {
    console.error("Failed to initialize Supabase. Make sure the script is loaded.");
}

// --- STATE ---
let state = {
    selectedPatient: null,
    enData: { weight: 0, option: 'Breast milk', hours: 3, initRate: 20, advance: 20, goal: 150 },
    pnData: { weight: 0, fluidKg: 100 }
};

// --- NAVIGATION ENGINE ---
function showView(viewId) {
    console.log("Switching to view:", viewId);
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
    } else {
        console.error("View ID not found:", viewId);
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Navigation Event Listeners (أزرار التنقل)
    document.getElementById('navToAddPatient').onclick = () => showView('addPatientView');
    document.getElementById('navToPatientList').onclick = () => {
        showView('patientListView');
        fetchPatients();
    };
    document.querySelectorAll('.back-to-dash').forEach(btn => {
        btn.onclick = () => showView('dashboardView');
    });
    document.getElementById('homeBtn').onclick = () => showView('dashboardView');
    document.getElementById('backToList').onclick = () => showView('patientListView');
    document.getElementById('backToProfile').onclick = () => showView('patientProfileView');

    // 2. Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        };
    });

    // 3. Forms
    document.getElementById('patientForm').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('p_name').value;
        await savePatient({ name });
    };

    document.getElementById('addVisitBtn').onclick = () => {
        document.getElementById('currentPatientName').innerText = state.selectedPatient.name;
        showView('visitEditorView');
    };

    document.getElementById('saveVisitBtn').onclick = finalizeVisit;

    // 4. Calcs
    document.querySelectorAll('.en-input').forEach(el => {
        el.oninput = (e) => {
            state.enData[e.target.dataset.key] = e.target.value;
            updateEN();
        };
    });

    document.querySelectorAll('.pn-input').forEach(el => {
        el.oninput = (e) => {
            state.pnData[e.target.dataset.key] = e.target.value;
            updatePN();
        };
    });
});

// --- SUPABASE FUNCTIONS ---
async function fetchPatients() {
    const grid = document.getElementById('patientsGrid');
    grid.innerHTML = '<p class="loading-text">جاري تحميل المرضى...</p>';
    
    try {
        const { data, error } = await supabaseClient.from('Patients').select('*');
        if (error) throw error;
        
        grid.innerHTML = data.length ? '' : '<p>لا يوجد مرضى حالياً</p>';
        data.forEach(p => {
            const div = document.createElement('div');
            div.className = 'patient-item shadow';
            div.innerHTML = `<span>${p.name}</span><i class="fas fa-chevron-left"></i>`;
            div.onclick = () => openProfile(p);
            grid.appendChild(div);
        });
    } catch (err) {
        grid.innerHTML = `<p style="color:red">خطأ في الاتصال: ${err.message}</p>`;
    }
}

async function savePatient(patient) {
    try {
        const { error } = await supabaseClient.from('Patients').insert([patient]);
        if (error) throw error;
        alert("تم الحفظ!");
        showView('patientListView');
        fetchPatients();
    } catch (err) {
        alert("فشل الحفظ: " + err.message);
    }
}

function openProfile(patient) {
    state.selectedPatient = patient;
    document.getElementById('patientInfoBanner').innerHTML = `
        <div style="text-align:right">
            <h2>${patient.name}</h2>
            <small>ID: ${patient.id}</small>
        </div>
    `;
    fetchVisits(patient.id);
    showView('patientProfileView');
}

async function fetchVisits(pId) {
    const grid = document.getElementById('visitsGrid');
    try {
        const { data, error } = await supabaseClient.from('Visits').select('*').eq('patient_id', pId);
        if (error) throw error;
        grid.innerHTML = data.length ? '' : '<p>لا توجد زيارات سابقة</p>';
        data.forEach(v => {
            const div = document.createElement('div');
            div.className = 'card shadow';
            div.innerHTML = `زيارة بتاريخ: ${new Date(v.created_at).toLocaleDateString('ar-EG')}`;
            grid.appendChild(div);
        });
    } catch (err) { console.error(err); }
}

async function finalizeVisit() {
    try {
        // إنشاء الزيارة أولاً
        const { data: vData, error: vErr } = await supabaseClient.from('Visits').insert([{
            patient_id: state.selectedPatient.id,
            clinical_diagnosis: "Assessment",
            physician: "Dr. Ahmed Galal"
        }]).select();
        
        if (vErr) throw vErr;
        const vId = vData[0].id;

        // حفظ بيانات PN
        await supabaseClient.from('Pn_records').insert([{
            visit_id: vId,
            fluid_ml_kg_d: parseFloat(state.pnData.fluidKg) || 0
        }]);

        alert("تم حفظ الزيارة بنجاح!");
        openProfile(state.selectedPatient);
    } catch (err) {
        alert("خطأ أثناء الحفظ: " + err.message);
    }
}

function updateEN() {
    const res = document.getElementById('enResults');
    const { weight, hours, initRate } = state.enData;
    if (weight > 0) {
        const val = ((initRate * weight) / (24/hours)).toFixed(1);
        res.innerHTML = `<p>الرضعة: <strong>${val} ml</strong> كل ${hours} ساعة</p>`;
    }
}

function updatePN() {
    const res = document.getElementById('pnResults');
    const { weight, fluidKg } = state.pnData;
    if (weight > 0) {
        res.innerHTML = `<p>إجمالي السوائل: <strong>${(weight * fluidKg).toFixed(1)} ml</strong></p>`;
    }
                                                       }
