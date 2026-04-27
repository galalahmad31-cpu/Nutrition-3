// --- CONFIGURATION ---
const SUPABASE_URL = 'https://svnqppvwptbhxcurxipa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wXN6nc7ug20Zuh89H-k6DQ_gyIZVsfD';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- STATE MANAGEMENT ---
let state = {
    currentView: 'dashboardView',
    patients: [],
    selectedPatient: null,
    selectedVisit: null,
    visits: [],
    enData: { weight: 0, option: 'Breast milk', hours: 3, initRate: 20, advance: 20, goal: 150 },
    pnData: { weight: 0, fluidKg: 100, gir: 6, protIntake: 3, lipidIntake: 1 }
};

// --- DOM ELEMENTS ---
const views = document.querySelectorAll('.view');
const patientsGrid = document.getElementById('patientsGrid');
const visitsGrid = document.getElementById('visitsGrid');
const patientForm = document.getElementById('patientForm');

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
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });
}

function initEventListeners() {
    // Patient Registration
    patientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const patient = {
            name: document.getElementById('p_name').value,
            medical_id: document.getElementById('p_id').value,
            dob: document.getElementById('p_dob').value
        };
        await savePatient(patient);
    });

    // Home button
    document.getElementById('homeBtn').addEventListener('click', () => showView('dashboardView'));

    // Visit Creation
    document.getElementById('addVisitBtn').addEventListener('click', () => startNewVisit());

    // Calc inputs
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

    document.getElementById('saveVisitBtn').addEventListener('click', finalizeVisit);
}

// --- NAVIGATION ---
function showView(viewId) {
    views.forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    state.currentView = viewId;
}

// --- DATA FETCHING (SUPABASE) ---
async function fetchPatients() {
    const { data, error } = await supabase.from('Patients').select('*');
    if (error) return console.error(error);
    state.patients = data;
    renderPatients();
}

async function savePatient(patient) {
    const { data, error } = await supabase.from('Patients').insert([patient]);
    if (error) return alert("Error saving patient");
    patientForm.reset();
    fetchPatients();
    showView('patientListView');
}

async function fetchVisits(patientId) {
    const { data, error } = await supabase.from('Visits').select('*').eq('patient_id', patientId);
    if (error) return console.error(error);
    state.visits = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    renderVisits();
}

// --- RENDERING ---
function renderPatients() {
    patientsGrid.innerHTML = state.patients.length ? '' : '<p>No patients found.</p>';
    state.patients.forEach(p => {
        const div = document.createElement('div');
        div.className = 'patient-item shadow';
        div.innerHTML = `
            <div><strong>${p.name}</strong><br><small>ID: ${p.medical_id}</small></div>
            <i class="fas fa-chevron-left"></i>
        `;
        div.onclick = () => openPatientProfile(p);
        patientsGrid.appendChild(div);
    });
}

function openPatientProfile(patient) {
    state.selectedPatient = patient;
    const banner = document.getElementById('patientInfoBanner');
    banner.innerHTML = `
        <div style="display:flex; gap:1rem; align-items:center;">
            <div style="background:var(--primary); color:white; padding:1rem; border-radius:0.5rem; font-weight:700;">${patient.name[0]}</div>
            <div>
                <h2>${patient.name}</h2>
                <small>ID: ${patient.medical_id} | DOB: ${patient.dob}</small>
            </div>
        </div>
    `;
    fetchVisits(patient.id);
    showView('patientProfileView');
}

function renderVisits() {
    visitsGrid.innerHTML = state.visits.length ? '' : '<div class="card">No visits yet.</div>';
    state.visits.forEach(v => {
        const div = document.createElement('div');
        div.className = 'card shadow';
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <div style="color:var(--primary); font-weight:bold;"><i class="fas fa-calendar"></i> ${new Date(v.created_at).toLocaleDateString()}</div>
            <p>Visit Summary for ${state.selectedPatient.name}</p>
        `;
        visitsGrid.appendChild(div);
    });
}

// --- CALCULATION LOGIC ---
function updateENCalculations() {
    const { weight, hours, initRate, advance, goal } = state.enData;
    const w = parseFloat(weight) || 0;
    const h = parseFloat(hours) || 1;
    const freq = 24 / h;
    
    if(w > 0) {
        const start = ((initRate * w) / freq).toFixed(1);
        const inc = ((advance * w) / freq).toFixed(1);
        const max = ((goal * w) / freq).toFixed(1);
        
        document.getElementById('enResults').innerHTML = `
            <p><strong>Start:</strong> ${start} ml every ${h} hours</p>
            <p><strong>Daily Increment:</strong> ${inc} ml/feed</p>
            <p><strong>Goal:</strong> ${max} ml every ${h} hours</p>
        `;
    }
}

function updatePNCalculations() {
    const { weight, fluidKg, gir } = state.pnData;
    const w = parseFloat(weight) || 0;
    if(w > 0) {
        const totalFluid = (fluidKg * w).toFixed(1);
        const glucoseDaily = (gir * w * 1440 / 1000).toFixed(1);
        document.getElementById('pnResults').innerHTML = `
            <p><strong>Total Daily Fluid:</strong> ${totalFluid} ml</p>
            <p><strong>Glucose Required:</strong> ${glucoseDaily} g/day</p>
        `;
    }
}

// --- VISIT PERSISTENCE ---
function startNewVisit() {
    state.selectedVisit = null;
    document.getElementById('currentPatientName').innerText = state.selectedPatient.name;
    showView('visitEditorView');
}

async function finalizeVisit() {
    const visit = {
        patient_id: state.selectedPatient.id,
        notes: "Automated Nutrition Summary"
    };
    
    const { data: vData, error: vErr } = await supabase.from('Visits').insert([visit]).select();
    if(vErr) return alert("Failed to save visit");
    
    const visitId = vData[0].id;
    
    // Save EN record
    await supabase.from('en_records').insert([{
        visit_id: visitId,
        weight: state.enData.weight,
        formula: state.enData.option
    }]);

    // Save PN record
    await supabase.from('Pn_rocords').insert([{
        visit_id: visitId,
        weight: state.pnData.weight,
        gir: state.pnData.gir
    }]);

    alert("Visit Saved Successfully");
    openPatientProfile(state.selectedPatient);
        }
