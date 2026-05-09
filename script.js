// ============================================================
//  NICU Nutrition Dashboard — script.js
//  Google OAuth + Department Workspace + Encounter System
//  Dr. Ahmed Galal | 2026
// ============================================================

// ============================================================
//  1. SUPABASE INIT
// ============================================================
const SUPABASE_URL = "https://pjcposbbgaqbljrsamax.supabase.co";
const SUPABASE_KEY = "sb_publishable_xxZtrsyB46at2eaowuuKhQ_q_1GLHxF";

// ⚠️  db is declared here but ONLY initialized inside DOMContentLoaded
// This prevents "Can't access db before initialization" errors
let db;

// ============================================================
//  2. GLOBAL STATE
// ============================================================
const AppState = {
    user:              null,   // Supabase auth user
    profile:           null,   // profiles row
    department:        null,   // departments row
    currentPatient:    null,   // patients row currently open
    currentEncounterId: null,  // UUID of encounter being edited (null = new)
    hasUnsavedChanges: false,
    allPatients:       [],     // cached for search filter
    activeCalcTab:     'en'
};

// ============================================================
//  3. AUTH — GOOGLE OAUTH
// ============================================================
async function signInWithGoogle() {
    const btn = document.getElementById('btn-google-login');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Redirecting to Google...';

    const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.href.split('?')[0]   // same page, no query params
        }
    });

    if (error) {
        showToast('Sign in failed: ' + error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<svg style="width:20px;height:20px" viewBox="0 0 24 24"><path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/></svg> Continue with Google';
    }
}

async function signOut() {
    await db.auth.signOut();
    AppState.user = AppState.profile = AppState.department = null;
    AppState.currentPatient = null;
    AppState.currentEncounterId = null;
    showScreen('auth');
}

// ============================================================
//  4. AUTH STATE LISTENER  — registered inside DOMContentLoaded
// ============================================================
// (moved to initApp() at the bottom of this file)

async function bootstrapUserSession() {
    // Small delay to let the trigger create the profile row
    await sleep(600);

    const { data: profile, error } = await db
        .from('profiles')
        .select('*, departments(*)')
        .eq('id', AppState.user.id)
        .maybeSingle();

    if (error) {
        console.error('Profile load error:', error);
        showToast('Could not load profile: ' + error.message, 'error');
        return;
    }

    // If profile doesn't exist yet (race condition), retry once
    if (!profile) {
        await sleep(1500);
        return bootstrapUserSession();
    }

    AppState.profile    = profile;
    AppState.department = profile.departments || null;

    if (!profile.department_id) {
        showScreen('setup');
    } else {
        updateHeaderUI();
        showScreen('main');
        navigateTo('home');
    }
}

// ============================================================
//  5. DEPARTMENT SETUP
// ============================================================
function switchSetupTab(tab) {
    document.getElementById('setup-panel-create').style.display = tab === 'create' ? 'block' : 'none';
    document.getElementById('setup-panel-join').style.display   = tab === 'join'   ? 'block' : 'none';
    document.getElementById('setup-btn-create').classList.toggle('active', tab === 'create');
    document.getElementById('setup-btn-join').classList.toggle('active',   tab === 'join');
}

async function createDepartment() {
    const name = document.getElementById('setup-dept-name').value.trim();
    if (!name) { showToast('Please enter a department name', 'error'); return; }

    const btn = document.getElementById('btn-create-dept');
    setButtonLoading(btn, true, 'Creating...');

    try {
        const { data: dept, error: e1 } = await db
            .from('departments')
            .insert({ name, created_by: AppState.user.id })
            .select()
            .single();
        if (e1) throw e1;

        const { error: e2 } = await db
            .from('profiles')
            .update({ department_id: dept.id, role: 'admin' })
            .eq('id', AppState.user.id);
        if (e2) throw e2;

        showToast(`Workspace "${dept.name}" created!`, 'success');
        await bootstrapUserSession();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
        setButtonLoading(btn, false, 'Create Workspace');
    }
}

async function joinDepartment() {
    const code = document.getElementById('setup-join-code').value.trim().toUpperCase();
    if (code.length < 4) { showToast('Enter a valid join code', 'error'); return; }

    const btn = document.getElementById('btn-join-dept');
    setButtonLoading(btn, true, 'Joining...');

    try {
        const { data: dept, error: e1 } = await db
            .from('departments')
            .select()
            .eq('join_code', code)
            .maybeSingle();

        if (e1) throw e1;
        if (!dept) throw new Error('No department found with that code. Ask your admin to verify.');

        const { error: e2 } = await db
            .from('profiles')
            .update({ department_id: dept.id, role: 'member' })
            .eq('id', AppState.user.id);
        if (e2) throw e2;

        showToast(`Joined "${dept.name}"!`, 'success');
        await bootstrapUserSession();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
        setButtonLoading(btn, false, 'Join Workspace');
    }
}

// ============================================================
//  6. SCREEN MANAGEMENT
// ============================================================
function showScreen(screen) {
    document.getElementById('app-auth').style.display  = screen === 'auth'  ? 'flex'  : 'none';
    document.getElementById('app-setup').style.display = screen === 'setup' ? 'flex'  : 'none';
    document.getElementById('app-main').style.display  = screen === 'main'  ? 'block' : 'none';
}

// ============================================================
//  7. PAGE NAVIGATION (SPA Router)
// ============================================================
const PAGE_TITLES = {
    home:             'Home',
    patients:         'Patients',
    'patient-detail': 'Patient Details',
    encounter:        'Encounter',
    reference:        'Information & Reference',
    profile:          'Profile'
};

function navigateTo(page, skipInit = false) {
    document.querySelectorAll('.page').forEach(p => {
        p.style.display = 'none';
        p.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById('page-' + page);
    if (pageEl) { pageEl.style.display = 'block'; pageEl.classList.add('active'); }

    const navEl = document.getElementById('nav-' + page);
    if (navEl) navEl.classList.add('active');

    document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;

    if (!skipInit) {
        if (page === 'home')      loadHomeStats();
        if (page === 'patients')  loadPatients();
        if (page === 'reference') initReference();
        if (page === 'profile')   loadProfilePage();
    }

    closeSidebar();
}

// ============================================================
//  8. SIDEBAR
// ============================================================
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    sb.classList.toggle('open');
    ov.classList.toggle('show');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
}

// ============================================================
//  9. HEADER UI
// ============================================================
function updateHeaderUI() {
    const p    = AppState.profile;
    const dept = AppState.department;
    const name = p?.full_name
              || AppState.user?.user_metadata?.full_name
              || AppState.user?.email?.split('@')[0]
              || 'User';

    document.getElementById('header-avatar').textContent     = name.charAt(0).toUpperCase();
    document.getElementById('header-user-name').textContent  = name;
    document.getElementById('sidebar-dept-name').textContent = dept?.name || 'No Department';

    const sub = document.getElementById('home-dept-subtitle');
    if (sub) sub.textContent = dept
        ? `${dept.name} — shared team workspace`
        : 'No department assigned';
}

// ============================================================
//  10. HOME DASHBOARD
// ============================================================
async function loadHomeStats() {
    if (!AppState.profile?.department_id) return;

    try {
        const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0];

        const [r1, r2, r3] = await Promise.all([
            db.from('patients').select('id', { count: 'exact', head: true }),
            db.from('encounters').select('id', { count: 'exact', head: true })
              .eq('is_draft', false).gte('encounter_date', since30d),
            db.from('encounters').select('id', { count: 'exact', head: true })
              .eq('is_draft', true)
        ]);

        document.getElementById('stat-patients').textContent   = r1.count ?? 0;
        document.getElementById('stat-encounters').textContent = r2.count ?? 0;
        document.getElementById('stat-drafts').textContent     = r3.count ?? 0;

        // Recent finalized encounters
        const { data: recent } = await db
            .from('encounters')
            .select('id, encounter_date, weight, health_status, enteral_data, parenteral_data, patient_id, patients(full_name)')
            .eq('is_draft', false)
            .order('created_at', { ascending: false })
            .limit(6);

        renderRecentEncounters(recent || []);
    } catch (err) {
        console.error('Home stats error:', err);
    }
}

function renderRecentEncounters(list) {
    const el = document.getElementById('home-recent-encounters');
    if (!list.length) {
        el.innerHTML = `<div style="text-align:center;padding:32px;color:#94a3b8">
            <div style="font-size:2rem;margin-bottom:8px">📋</div>
            <p>No encounters yet. Add a patient and start an encounter.</p>
        </div>`;
        return;
    }
    el.innerHTML = list.map(e => `
        <div class="enc-item" onclick="openEncounterById('${e.id}','${e.patient_id}')">
            <div class="enc-item-left">
                <h4>${e.patients?.full_name || '—'}</h4>
                <p>${formatDate(e.encounter_date)}
                   ${e.weight ? ' · ' + e.weight + ' kg' : ''}
                   ${e.health_status ? ' · ' + e.health_status : ''}
                </p>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
                ${e.enteral_data    ? '<span class="badge badge-blue">EN</span>'  : ''}
                ${e.parenteral_data ? '<span class="badge badge-green">TPN</span>' : ''}
                <span style="color:#cbd5e0;font-size:1.2rem">›</span>
            </div>
        </div>
        <div style="height:6px"></div>`).join('');
}

// ============================================================
//  11. PATIENTS LIST
// ============================================================
async function loadPatients() {
    const tbody = document.getElementById('patients-tbody');
    tbody.innerHTML = loadingRow(5);

    const { data, error } = await db
        .from('patients')
        .select('*')
        .order('full_name');

    if (error) {
        tbody.innerHTML = errorRow(5, error.message);
        return;
    }

    AppState.allPatients = data || [];
    renderPatientsTable(AppState.allPatients);
}

function renderPatientsTable(list) {
    const tbody = document.getElementById('patients-tbody');

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;color:#94a3b8">
            <div style="font-size:2.5rem;margin-bottom:10px">👶</div>
            <p style="font-weight:600;font-size:1rem">No patients yet</p>
            <p style="font-size:.875rem;margin-top:6px">Click "Add Patient" to register the first patient in your department.</p>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(p => `
        <tr>
            <td>
                <span style="font-weight:600;color:#1e293b">${p.full_name}</span>
                ${p.national_id ? `<br><span style="font-size:.72rem;color:#94a3b8">ID: ${p.national_id}</span>` : ''}
            </td>
            <td>${p.gender ? `<span class="badge badge-gray">${p.gender}</span>` : '—'}</td>
            <td style="color:#64748b">${p.phone || '—'}</td>
            <td style="color:#64748b;font-size:.85rem" id="lenc-${p.id}">
                <span class="spinner" style="border-color:#e2e8f0;border-top-color:#2563eb"></span>
            </td>
            <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button onclick="openPatientDetail('${p.id}')" class="btn btn-outline btn-sm">View</button>
                    <button onclick="quickAddEncounter('${p.id}')" class="btn btn-primary btn-sm">+ Encounter</button>
                </div>
            </td>
        </tr>`).join('');

    list.forEach(p => fetchLastEncounter(p.id));
}

async function fetchLastEncounter(patientId) {
    const { data } = await db
        .from('encounters')
        .select('encounter_date')
        .eq('patient_id', patientId)
        .eq('is_draft', false)
        .order('encounter_date', { ascending: false })
        .limit(1)
        .maybeSingle();

    const el = document.getElementById(`lenc-${patientId}`);
    if (el) el.textContent = data ? formatDate(data.encounter_date) : 'None yet';
}

function filterPatients(query) {
    const q = query.toLowerCase();
    renderPatientsTable(q
        ? AppState.allPatients.filter(p => p.full_name.toLowerCase().includes(q))
        : AppState.allPatients);
}

// ============================================================
//  12. ADD PATIENT MODAL
// ============================================================
function openAddPatientModal() {
    ['new-patient-name','new-patient-phone','new-patient-email',
     'new-patient-national-id','new-patient-history'].forEach(id => setVal(id, ''));
    setVal('new-patient-gender', '');
    openModal('modal-add-patient');
}

async function saveNewPatient() {
    const name = document.getElementById('new-patient-name').value.trim();
    if (!name) { showToast('Patient name is required', 'error'); return; }

    const btn = document.getElementById('btn-save-patient');
    setButtonLoading(btn, true, 'Saving...');

    try {
        const { data: patient, error } = await db
            .from('patients')
            .insert({
                department_id:   AppState.profile.department_id,
                full_name:       name,
                gender:          gv('new-patient-gender')      || null,
                phone:           gv('new-patient-phone')        || null,
                email:           gv('new-patient-email')        || null,
                national_id:     gv('new-patient-national-id')  || null,
                medical_history: gv('new-patient-history')      || null,
                created_by:      AppState.user.id
            })
            .select()
            .single();

        if (error) throw error;

        closeModal('modal-add-patient');
        showToast('Patient registered!', 'success');
        AppState.currentPatient = patient;
        await openPatientDetail(patient.id);
    } catch (err) {
        showToast('Save error: ' + err.message, 'error');
    } finally {
        setButtonLoading(btn, false, 'Save Patient');
    }
}

// ============================================================
//  13. PATIENT DETAIL PAGE
// ============================================================
async function openPatientDetail(patientId) {
    navigateTo('patient-detail', true);

    const { data: patient, error } = await db
        .from('patients').select('*').eq('id', patientId).single();

    if (error || !patient) { showToast('Patient not found', 'error'); return; }
    AppState.currentPatient = patient;

    document.getElementById('detail-patient-name').textContent       = patient.full_name;
    document.getElementById('detail-patient-id-display').textContent =
        patient.national_id ? 'National ID: ' + patient.national_id
                            : 'Added: ' + formatDate(patient.created_at);
    document.getElementById('detail-gender').textContent      = patient.gender    || '—';
    document.getElementById('detail-phone').textContent       = patient.phone     || '—';
    document.getElementById('detail-national-id').textContent = patient.national_id || '—';
    document.getElementById('detail-email').textContent       = patient.email     || '—';
    document.getElementById('detail-medical-history').textContent = patient.medical_history || 'No history recorded.';

    await loadEncountersList(patientId);
}

async function loadEncountersList(patientId) {
    document.getElementById('encounters-list').innerHTML = loadingBlock();

    const { data: encs, error } = await db
        .from('encounters')
        .select('id, encounter_date, weight, health_status, enteral_data, parenteral_data, is_draft, created_at')
        .eq('patient_id', patientId)
        .order('encounter_date', { ascending: false });

    if (error) {
        document.getElementById('encounters-list').innerHTML = `<p style="color:#ef4444">${error.message}</p>`;
        return;
    }

    const finalized = (encs || []).filter(e => !e.is_draft);
    const drafts    = (encs || []).filter(e =>  e.is_draft);

    document.getElementById('detail-enc-count').textContent = finalized.length;

    if (!encs?.length) {
        document.getElementById('encounters-list').innerHTML = `<p style="color:#94a3b8;text-align:center;padding:28px">
            No encounters yet. Click "+ Add Encounter" to start one.</p>`;
        return;
    }

    let html = '';

    if (drafts.length) {
        html += `<p style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#b45309;margin-bottom:8px">● ${drafts.length} Draft${drafts.length > 1 ? 's' : ''}</p>`;
        html += drafts.map(e => buildEncounterCard(e, patientId)).join('<div style="height:6px"></div>');
        html += '<div style="height:20px"></div>';
    }

    if (finalized.length) {
        html += `<p style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:8px">Finalized Encounters (${finalized.length})</p>`;
        html += finalized.map(e => buildEncounterCard(e, patientId)).join('<div style="height:6px"></div>');
    }

    document.getElementById('encounters-list').innerHTML = html;
}

function buildEncounterCard(enc, patientId) {
    return `
    <div class="enc-item" onclick="openEncounterById('${enc.id}','${patientId}')">
        <div class="enc-item-left">
            <h4>${formatDate(enc.encounter_date)}</h4>
            <p style="color:#64748b;font-size:.8rem">
                ${enc.weight ? enc.weight + ' kg' : 'No weight recorded'}
                ${enc.health_status ? ' · ' + enc.health_status : ''}
            </p>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${enc.enteral_data    ? '<span class="badge badge-blue">EN</span>'   : ''}
            ${enc.parenteral_data ? '<span class="badge badge-green">TPN</span>' : ''}
            ${enc.is_draft        ? '<span class="badge badge-draft">DRAFT</span>' : ''}
            <svg width="16" height="16" fill="none" stroke="#cbd5e0" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
        </div>
    </div>`;
}

// ============================================================
//  14. ENCOUNTERS — OPEN / CREATE
// ============================================================
function startNewEncounter() {
    if (!AppState.currentPatient) return;
    AppState.currentEncounterId = null;
    AppState.hasUnsavedChanges  = false;

    resetCalculatorForm();

    setVal('enc-date',        new Date().toISOString().split('T')[0]);
    setVal('enc-weight-main', '');
    setVal('enc-health-status', '');

    document.getElementById('enc-patient-name-display').textContent = AppState.currentPatient.full_name;
    document.getElementById('enc-encounter-label').textContent      = 'New Encounter';
    document.getElementById('draft-badge').style.display            = 'inline-flex';

    switchCalcTab('en');
    navigateTo('encounter', true);
    trackFormChanges();
}

async function quickAddEncounter(patientId) {
    const { data: patient } = await db.from('patients').select('*').eq('id', patientId).single();
    if (patient) { AppState.currentPatient = patient; startNewEncounter(); }
}

async function openEncounterById(encounterId, patientId) {
    // Load patient context if needed
    if (!AppState.currentPatient || AppState.currentPatient.id !== patientId) {
        const { data: p } = await db.from('patients').select('*').eq('id', patientId).single();
        AppState.currentPatient = p;
    }

    showToast('Loading encounter...', 'loading', 5000);

    const { data: enc, error } = await db
        .from('encounters').select('*').eq('id', encounterId).single();

    if (error || !enc) { showToast('Encounter not found', 'error'); return; }

    AppState.currentEncounterId = encounterId;
    AppState.hasUnsavedChanges  = false;

    resetCalculatorForm();

    // Encounter meta
    setVal('enc-date',          enc.encounter_date || new Date().toISOString().split('T')[0]);
    setVal('enc-weight-main',   enc.weight || '');
    setVal('enc-health-status', enc.health_status || '');

    // Clinical notes
    if (enc.clinical_notes)   fillClinicalNotes(enc.clinical_notes);

    // Nutrition data
    if (enc.enteral_data)    populateEnteralData(enc.enteral_data);
    if (enc.parenteral_data) populateParenteralData(enc.parenteral_data);

    // Monitoring
    if (enc.monitoring_data) {
        setVal('monitoring-labs',     enc.monitoring_data.labs     || '');
        setVal('monitoring-clinical', enc.monitoring_data.clinical || '');
        setVal('monitoring-plan',     enc.monitoring_data.plan     || '');
    }

    // Header
    document.getElementById('enc-patient-name-display').textContent = AppState.currentPatient?.full_name || '—';
    document.getElementById('enc-encounter-label').textContent = `Encounter — ${formatDate(enc.encounter_date)}`;
    document.getElementById('draft-badge').style.display = enc.is_draft ? 'inline-flex' : 'none';

    switchCalcTab(enc.enteral_data ? 'en' : 'tpn');
    navigateTo('encounter', true);
    showToast('Encounter loaded', 'success', 1500);
    trackFormChanges();
}

// ============================================================
//  15. ENCOUNTERS — SAVE  (THE KEY FIX)
//  This correctly uses department_id from profile → bypasses RLS issue
// ============================================================
async function saveEncounterData(saveAsDraft = false) {
    if (!AppState.currentPatient)        { showToast('No patient selected', 'error'); return; }
    if (!AppState.profile?.department_id) { showToast('No department assigned. Please contact admin.', 'error'); return; }

    const label = saveAsDraft ? 'Saving draft...' : 'Finalizing...';
    showToast(label, 'loading', 15000);

    try {
        const payload = {
            patient_id:      AppState.currentPatient.id,
            department_id:   AppState.profile.department_id,   // ← critical for RLS
            encounter_date:  gv('enc-date') || new Date().toISOString().split('T')[0],
            weight:          parseFloat(gv('enc-weight-main')) || null,
            health_status:   gv('enc-health-status') || null,
            enteral_data:    collectEnteralData(),
            parenteral_data: collectParenteralData(),
            clinical_notes:  collectClinicalNotes(),
            monitoring_data: collectMonitoringData(),
            is_draft:        saveAsDraft,
            created_by:      AppState.user.id,
            updated_at:      new Date().toISOString()
        };

        if (AppState.currentEncounterId) {
            // UPDATE existing
            const { error } = await db
                .from('encounters')
                .update(payload)
                .eq('id', AppState.currentEncounterId);
            if (error) throw error;
        } else {
            // INSERT new
            const { data: enc, error } = await db
                .from('encounters')
                .insert(payload)
                .select('id')
                .single();
            if (error) throw error;
            AppState.currentEncounterId = enc.id;
        }

        AppState.hasUnsavedChanges = false;
        document.getElementById('draft-badge').style.display = saveAsDraft ? 'inline-flex' : 'none';
        document.getElementById('enc-encounter-label').textContent = saveAsDraft
            ? `Draft — ${formatDate(payload.encounter_date)}`
            : `Encounter — ${formatDate(payload.encounter_date)}`;

        showToast(saveAsDraft ? '✓ Saved as draft' : '✓ Encounter finalized and saved!', 'success');
    } catch (err) {
        console.error('Save encounter error:', err);
        showToast('Save failed: ' + err.message, 'error', 6000);
    }
}

// ============================================================
//  16. COLLECT FORM DATA → JSON  (for saving)
// ============================================================
function collectEnteralData() {
    const w = parseFloat(gv('en-weight')) || 0;
    if (!w) return null;
    return {
        weight:                    w,
        feedingOption:             gv('en-option'),
        frequencyHours:            parseFloat(gv('en-hours'))     || 3,
        isFortified:               gv('en-fort-choice') === 'yes',
        fortificationInstructions: gv('en-fort-instructions')    || '',
        initiationRate:            parseFloat(gv('en-init-rate')) || 20,
        advancement:               parseFloat(gv('en-advance'))   || 20,
        goalVolume:                parseFloat(gv('en-goal'))       || 150
    };
}

function collectParenteralData() {
    const w = gv('tpn-weight');
    if (!w || parseFloat(w) === 0) return null;
    return {
        weight:               w,
        weightUnit:           gv('tpn-weight-unit'),
        targetEnergyKgD:      parseFloat(gv('tpn-target-energy-kg')) || 110,
        caloricDensity:       parseFloat(gv('tpn-caloric-density'))  || 0.67,
        enteralFluid:         parseFloat(gv('tpn-enteral-fluid'))    || 0,
        targetFluidKgD:       parseFloat(gv('tpn-fluid-kg'))         || 100,
        medicationFluid:      parseFloat(gv('tpn-other-input'))      || 0,
        gir:                  parseFloat(gv('in-gir'))               || 6,
        otherGlucoseRate:     parseFloat(gv('in-glu-other-rate'))    || 0,
        otherGlucoseDuration: parseFloat(gv('in-glu-other-dur'))     || 0,
        otherGlucoseConc:     parseFloat(gv('in-glu-other-conc'))    || 5,
        proteinConc:          parseFloat(gv('sel-prot-conc'))        || 10,
        proteinIntake:        parseFloat(gv('in-prot'))              || 3,
        lipidConc:            parseFloat(gv('sel-lipid-conc'))       || 20,
        lipidIntake:          parseFloat(gv('in-lipid'))             || 1,
        naclType:             gv('sel-nacl-type'),
        sodium:               parseFloat(gv('in-nacl'))              || 3,
        potassium:            parseFloat(gv('in-kcl'))               || 2,
        calcium:              parseFloat(gv('in-ca'))                || 2,
        magnesium:            parseFloat(gv('in-mg'))                || 0.5,
        phosphorus:           parseFloat(gv('in-phos'))              || 1,
        traceProduct:         gv('sel-trace'),
        traceVol:             parseFloat(gv('in-trace-vol'))         || 0,
        vitalipidType:        gv('sel-vitalipid'),
        vitalipidVol:         parseFloat(gv('in-vitalipid-vol'))     || 0,
        solutitoVol:          parseFloat(gv('in-soluvito-vol'))      || 0,
        infusionHours:        parseFloat(gv('tpn-infusion-hours'))   || 24
    };
}

function collectClinicalNotes() {
    return {
        gestationalAge:       gv('gestational-age')       || '',
        birthWeight:          gv('birth-weight')          || '',
        clinicalDiagnosis:    gv('clinical-diagnosis')    || '',
        nutritionalDiagnosis: gv('nutritional-diagnosis') || '',
        physicianName:        gv('physician-name')        || '',
        pharmacistName:       gv('pharmacist-name')       || ''
    };
}

function collectMonitoringData() {
    return {
        labs:     gv('monitoring-labs')     || '',
        clinical: gv('monitoring-clinical') || '',
        plan:     gv('monitoring-plan')     || ''
    };
}

// ============================================================
//  17. POPULATE FORM FROM JSON  (for loading)
// ============================================================
function populateEnteralData(d) {
    if (!d) return;
    setVal('en-weight',              d.weight        || '');
    setVal('en-option',              d.feedingOption  || 'Breast milk');
    setVal('en-hours',               d.frequencyHours || 3);
    setVal('en-fort-choice',         d.isFortified ? 'yes' : 'no');
    setVal('en-fort-instructions',   d.fortificationInstructions || '');
    setVal('en-init-rate',           d.initiationRate || 20);
    setVal('en-advance',             d.advancement    || 20);
    setVal('en-goal',                d.goalVolume     || 150);
    toggleFortifier();
    calculateEN();
}

function populateParenteralData(d) {
    if (!d) return;
    setVal('tpn-weight',          d.weight         || '');
    setVal('tpn-weight-unit',     d.weightUnit      || 'kg');
    setVal('tpn-target-energy-kg', d.targetEnergyKgD || 110);
    setVal('tpn-caloric-density', d.caloricDensity  || 0.67);
    setVal('tpn-enteral-fluid',   d.enteralFluid    || 0);
    setVal('tpn-fluid-kg',        d.targetFluidKgD  || 100);
    setVal('tpn-other-input',     d.medicationFluid || 0);
    setVal('in-gir',              d.gir             || 6);
    setVal('in-glu-other-rate',   d.otherGlucoseRate     || 0);
    setVal('in-glu-other-dur',    d.otherGlucoseDuration || 0);
    setVal('in-glu-other-conc',   d.otherGlucoseConc     || 5);
    setVal('sel-prot-conc',       String(d.proteinConc  || 10));
    setVal('in-prot',             d.proteinIntake  || 3);
    setVal('sel-lipid-conc',      String(d.lipidConc    || 20));
    setVal('in-lipid',            d.lipidIntake    || 1);
    setVal('sel-nacl-type',       String(d.naclType    || '3'));
    setVal('in-nacl',             d.sodium         || 3);
    setVal('in-kcl',              d.potassium      || 2);
    setVal('in-ca',               d.calcium        || 2);
    setVal('in-mg',               d.magnesium      || 0.5);
    setVal('in-phos',             d.phosphorus     || 1);
    setVal('sel-trace',           d.traceProduct    || 'Pediatrace');
    setVal('in-trace-vol',        d.traceVol        || 0);
    setVal('sel-vitalipid',       d.vitalipidType   || 'Infant');
    setVal('in-vitalipid-vol',    d.vitalipidVol    || 0);
    setVal('in-soluvito-vol',     d.solutitoVol     || 0);
    setVal('tpn-infusion-hours',  d.infusionHours   || 24);
    calculateTPN();
}

function fillClinicalNotes(d) {
    if (!d) return;
    setVal('gestational-age',    d.gestationalAge       || '');
    setVal('birth-weight',       d.birthWeight          || '');
    setVal('clinical-diagnosis', d.clinicalDiagnosis    || '');
    setVal('nutritional-diagnosis', d.nutritionalDiagnosis || '');
    setVal('physician-name',     d.physicianName        || '');
    setVal('pharmacist-name',    d.pharmacistName       || '');
}

function resetCalculatorForm() {
    // EN defaults
    ['en-weight','en-fort-instructions'].forEach(id => setVal(id, ''));
    setVal('en-hours', 3); setVal('en-option', 'Breast milk');
    setVal('en-fort-choice', 'no');
    setVal('en-init-rate', 20); setVal('en-advance', 20); setVal('en-goal', 150);
    document.getElementById('fortifier-box').style.display     = 'none';
    document.getElementById('res-en-fort-display').style.display = 'none';

    // TPN defaults
    setVal('tpn-weight', ''); setVal('tpn-weight-unit', 'kg');
    setVal('tpn-target-energy-kg', 110); setVal('tpn-caloric-density', 0.67);
    setVal('tpn-enteral-fluid', 0); setVal('tpn-fluid-kg', 100); setVal('tpn-other-input', 0);
    setVal('in-gir', 6); setVal('in-glu-other-rate', 0); setVal('in-glu-other-dur', 0); setVal('in-glu-other-conc', 5);
    setVal('sel-prot-conc', '10'); setVal('in-prot', 3);
    setVal('sel-lipid-conc', '20'); setVal('in-lipid', 1);
    setVal('sel-nacl-type', '3'); setVal('in-nacl', 3);
    setVal('in-kcl', 2); setVal('in-ca', 2); setVal('in-mg', 0.5); setVal('in-phos', 1);
    setVal('sel-trace', 'Pediatrace'); setVal('in-trace-vol', 0);
    setVal('sel-vitalipid', 'Infant'); setVal('in-vitalipid-vol', 0); setVal('in-soluvito-vol', 0);
    setVal('tpn-infusion-hours', 24);

    // Clinical notes
    ['gestational-age','birth-weight','clinical-diagnosis','nutritional-diagnosis','physician-name','pharmacist-name'].forEach(id => setVal(id, ''));

    // Monitoring
    setVal('monitoring-labs', ''); setVal('monitoring-clinical', ''); setVal('monitoring-plan', '');

    calculateEN();
    calculateTPN();
}

// ============================================================
//  18. ENCOUNTER NAVIGATION GUARD
// ============================================================
function confirmLeaveEncounter() {
    if (AppState.hasUnsavedChanges) {
        openModal('modal-confirm-leave');
    } else {
        forceLeaveEncounter();
    }
}

function forceLeaveEncounter() {
    closeModal('modal-confirm-leave');
    AppState.hasUnsavedChanges = false;
    if (AppState.currentPatient) {
        openPatientDetail(AppState.currentPatient.id);
    } else {
        navigateTo('patients');
    }
}

function trackFormChanges() {
    setTimeout(() => {
        document.querySelectorAll('#page-encounter input, #page-encounter select, #page-encounter textarea')
            .forEach(el => {
                el.addEventListener('input',  () => { AppState.hasUnsavedChanges = true; }, { passive: true });
                el.addEventListener('change', () => { AppState.hasUnsavedChanges = true; }, { passive: true });
            });
    }, 300);
}

function syncWeightToCalc(val) {
    const numVal = parseFloat(val) || 0;
    if (numVal <= 0) return;
    if (!parseFloat(gv('en-weight')))  { setVal('en-weight',  val); calculateEN();  }
    if (!parseFloat(gv('tpn-weight'))) { setVal('tpn-weight', val); calculateTPN(); }
    AppState.hasUnsavedChanges = true;
}

// ============================================================
//  19. CALCULATOR TAB SWITCH
// ============================================================
function switchCalcTab(tab) {
    AppState.activeCalcTab = tab;
    document.getElementById('section-en').style.display  = tab === 'en'  ? 'block' : 'none';
    document.getElementById('section-tpn').style.display = tab === 'tpn' ? 'block' : 'none';
    document.getElementById('calc-tab-en').classList.toggle('active',  tab === 'en');
    document.getElementById('calc-tab-tpn').classList.toggle('active', tab === 'tpn');

    // Move monitoring section to active tab
    const monNode = document.getElementById('monitoring-content-actual');
    const target  = tab === 'en'
        ? document.querySelector('.monitoring-container-shared-en')
        : document.querySelector('.monitoring-container-shared-tpn');
    if (target && monNode) target.appendChild(monNode);
}

// ============================================================
//  20. REFERENCE SUB-TABS
// ============================================================
function initReference() {
    switchSubTab('enteral');
    switchEnNested('energy');
}

function switchSubTab(sub) {
    document.getElementById('sub-content-enteral').style.display    = sub === 'enteral'    ? 'block' : 'none';
    document.getElementById('sub-content-parenteral').style.display = sub === 'parenteral' ? 'block' : 'none';
    document.getElementById('sub-tab-enteral').classList.toggle('active',    sub === 'enteral');
    document.getElementById('sub-tab-parenteral').classList.toggle('active', sub === 'parenteral');
}

function switchEnNested(id) {
    document.querySelectorAll('.en-nested-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('#sub-content-enteral .nested-tab-btn').forEach(b => b.classList.remove('active'));
    const el = document.getElementById('en-nested-' + id);
    const bt = document.getElementById('en-btn-' + id);
    if (el) el.style.display = 'block';
    if (bt) bt.classList.add('active');
}

function switchPnNested(id) {
    document.querySelectorAll('.pn-nested-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('#sub-content-parenteral .nested-tab-btn').forEach(b => b.classList.remove('active'));
    const el = document.getElementById('pn-nested-' + id);
    const bt = document.getElementById('pn-btn-' + id);
    if (el) el.style.display = 'block';
    if (bt) bt.classList.add('active');
}

// ============================================================
//  21. FORTIFIER TOGGLE
// ============================================================
function toggleFortifier() {
    const yes = gv('en-fort-choice') === 'yes';
    document.getElementById('fortifier-box').style.display      = yes ? 'block' : 'none';
    document.getElementById('res-en-fort-display').style.display = yes ? 'block' : 'none';
}

// ============================================================
//  22. ENTERAL NUTRITION CALCULATIONS  ← UNCHANGED
// ============================================================
function calculateEN() {
    const w    = parseFloat(gv('en-weight'))    || 0;
    const h    = parseFloat(gv('en-hours'))     || 1;
    const init = parseFloat(gv('en-init-rate')) || 0;
    const adv  = parseFloat(gv('en-advance'))   || 0;
    const goal = parseFloat(gv('en-goal'))       || 0;
    const freq = 24 / h;

    setText('res-en-start',      ((init * w) / freq).toFixed(1));
    setText('res-en-inc',        ((adv  * w) / freq).toFixed(1));
    setText('res-en-max',        ((goal * w) / freq).toFixed(1));
    setText('res-en-interval',   h);
    setText('res-en-interval-2', h);
    setText('res-en-final-option', gv('en-option'));
    setText('res-en-fort-text',    gv('en-fort-instructions') || 'None');
}

// ============================================================
//  23. TPN CALCULATIONS  ← UNCHANGED
// ============================================================
function calculateTPN() {
    const rawW  = parseFloat(gv('tpn-weight')) || 0;
    const wUnit = gv('tpn-weight-unit');
    const w     = wUnit === 'g' ? rawW / 1000 : rawW;

    const targetFluidKg = parseFloat(gv('tpn-fluid-kg')) || 0;
    const totalFluid    = targetFluidKg * w;
    setText('res-tpn-total-fluid-calc', totalFluid.toFixed(1));

    const entFluid = parseFloat(gv('tpn-enteral-fluid')) || 0;
    const medFluid = parseFloat(gv('tpn-other-input'))   || 0;
    const tpnFluid = totalFluid - entFluid - medFluid;
    setText('res-tpn-remain-fluid', tpnFluid.toFixed(1));

    const targetEnergyKg   = parseFloat(gv('tpn-target-energy-kg')) || 0;
    const totalEnergy       = targetEnergyKg * w;
    setText('res-tpn-total-energy-calc', totalEnergy.toFixed(1));

    const caloricDensity     = parseFloat(gv('tpn-caloric-density')) || 0;
    const enteralEnergyTotal = entFluid * caloricDensity;
    setText('res-enteral-energy', enteralEnergyTotal.toFixed(1) + ' kcal');
    setText('res-tpn-energy-need', Math.max(0, totalEnergy - enteralEnergyTotal).toFixed(1) + ' kcal');

    const pG = (parseFloat(gv('in-prot'))  || 0) * w;
    const pV = pG / (parseFloat(gv('sel-prot-conc')) / 100);
    setText('res-prot-total', pG.toFixed(1));
    setText('res-prot-vol',   pV.toFixed(1));
    setText('res-prot-kcal',  (pG * 4).toFixed(0));

    const lG = (parseFloat(gv('in-lipid')) || 0) * w;
    const lV = lG / (parseFloat(gv('sel-lipid-conc')) / 100);
    setText('res-lipid-total', lG.toFixed(1));
    setText('res-lipid-vol',   lV.toFixed(1));
    setText('res-lipid-kcal',  (lG * 10).toFixed(0));

    const phosTotal   = (parseFloat(gv('in-phos')) || 0) * w;
    const naIntakeRaw = (parseFloat(gv('in-nacl')) || 0) * w;
    const naAdjusted  = Math.max(0, naIntakeRaw - (2 * phosTotal));
    const naclType    = gv('sel-nacl-type');
    const naVol       = naclType === '3' ? naAdjusted / 0.513 : naAdjusted / 0.154;
    setText('res-nacl-total', naAdjusted.toFixed(1));
    setText('res-nacl-vol',   naVol.toFixed(1));

    const kTotal = (parseFloat(gv('in-kcl')) || 0) * w;
    const kVol   = kTotal / 2;
    setText('res-kcl-total', kTotal.toFixed(1));
    setText('res-kcl-vol',   kVol.toFixed(1));

    const caTotal = (parseFloat(gv('in-ca')) || 0) * w;
    const caVol   = caTotal / 0.23;
    setText('res-ca-total', caTotal.toFixed(1));
    setText('res-ca-vol',   caVol.toFixed(1));

    const mgTotal = (parseFloat(gv('in-mg')) || 0) * w;
    const mgVol   = mgTotal / 0.812;
    setText('res-mg-total', mgTotal.toFixed(1));
    setText('res-mg-vol',   mgVol.toFixed(1));

    setText('res-phos-total', phosTotal.toFixed(1));
    setText('res-phos-vol',   phosTotal.toFixed(1));

    const traceVol = parseFloat(gv('in-trace-vol'))     || 0;
    const vitaVol  = parseFloat(gv('in-vitalipid-vol')) || 0;
    const soluVol  = parseFloat(gv('in-soluvito-vol'))  || 0;

    const gir        = parseFloat(gv('in-gir')) || 0;
    const totalGGram = (gir * w * 1440) / 1000;
    const otherGGram = (parseFloat(gv('in-glu-other-rate')) || 0)
                     * (parseFloat(gv('in-glu-other-dur'))  || 0)
                     * (parseFloat(gv('in-glu-other-conc')) || 0) / 100;
    const tpnGGram = totalGGram - otherGGram;
    // Correct: use pre-computed volume variables
    const tpnGVol  = tpnFluid - (pV + lV + naVol + kVol + caVol + mgVol + phosTotal + traceVol + vitaVol + soluVol);

    setText('res-glu-total-final', totalGGram.toFixed(1));
    setText('res-glu-total-tpn',   tpnGGram.toFixed(1));
    setText('res-glu-vol-tpn',     tpnGVol.toFixed(1));
    setText('res-glu-kcal-tpn',    (tpnGGram * 3.4).toFixed(0));

    const gluConc = (tpnGGram / tpnGVol) * 100;
    setText('res-glu-conc', isFinite(gluConc) ? gluConc.toFixed(1) + '%' : '0%');

    const tpnKcal = (pG * 4) + (lG * 10) + (tpnGGram * 3.4);
    setText('res-tpn-total-vol',        tpnFluid.toFixed(1));
    setText('res-tpn-total-kcal-table', tpnKcal.toFixed(0));

    const hrs = parseFloat(gv('tpn-infusion-hours')) || 24;
    const rate = tpnFluid / hrs;
    setText('res-tpn-rate', isFinite(rate) ? rate.toFixed(1) + ' ml/hr' : '0 ml/hr');

    const osm = (pG * 10 + tpnGGram * 5 + (naAdjusted + kTotal + caTotal + mgTotal) * 2) / (tpnFluid / 1000);
    setText('res-osmolarity', isFinite(osm) ? Math.round(osm) + ' mOsm/L' : '0 mOsm/L');

    runMixing();
}

// ============================================================
//  24. GLUCOSE MIXING TOOL  ← UNCHANGED
// ============================================================
function runMixing() {
    const tC = parseFloat(gv('mix-target-conc'));
    const tV = parseFloat(gv('mix-target-vol'));
    const c1 = parseFloat(gv('mix-c1'));
    const c2 = parseFloat(gv('mix-c2'));
    if (tC && tV && c1 && c2 && c1 !== c2) {
        const v1 = (tV * (tC - c2)) / (c1 - c2);
        const v2 = tV - v1;
        if (v1 >= 0 && v2 >= 0) {
            const txt = `D${c1}%: ${v1.toFixed(1)} ml  |  D${c2}%: ${v2.toFixed(1)} ml`;
            const el1 = document.getElementById('mix-result');
            const el2 = document.getElementById('res-glu-mix-breakdown');
            if (el1) el1.innerText = txt;
            if (el2) el2.innerText = `(${txt})`;
        }
    }
}

// ============================================================
//  25. PRINT & SHARE
// ============================================================
function smartPrint() { window.print(); }

async function smartShare() {
    const p = AppState.currentPatient;
    let text = `🏥 NICU Nutrition Report\n`;
    text += `👤 Patient: ${p?.full_name || '—'}\n`;
    text += `📅 Date: ${gv('enc-date') || '—'}  ·  ⚖️ Weight: ${gv('enc-weight-main') || '—'} kg\n`;
    text += `💊 Status: ${gv('enc-health-status') || '—'}\n\n`;

    const enW = gv('en-weight');
    if (enW) {
        text += `🟣 ENTERAL\n`;
        text += `• Weight: ${enW} kg\n`;
        text += `• Start: ${document.getElementById('res-en-start').innerText} ml every ${document.getElementById('res-en-interval').innerText}h\n`;
        text += `• Feeding: ${gv('en-option')}\n\n`;
    }
    const tpnW = gv('tpn-weight');
    if (tpnW) {
        text += `🔵 TPN\n`;
        text += `• Weight: ${tpnW} ${gv('tpn-weight-unit')}\n`;
        text += `• GIR: ${gv('in-gir')} mg/kg/min\n`;
        text += `• Rate: ${document.getElementById('res-tpn-rate').innerText}\n`;
        text += `• Osmolarity: ${document.getElementById('res-osmolarity').innerText}\n\n`;
    }

    try {
        if (navigator.share) { await navigator.share({ text }); }
        else {
            await navigator.clipboard.writeText(text);
            showToast('Report copied to clipboard!', 'success');
        }
    } catch { showToast('Could not share', 'error'); }
}

// ============================================================
//  26. PROFILE PAGE
// ============================================================
function loadProfilePage() {
    const p = AppState.profile;
    const d = AppState.department;
    const role = p?.role ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : '—';

    setText2('prof-name',      p?.full_name || AppState.user?.user_metadata?.full_name || '—');
    setText2('prof-email',     p?.email     || AppState.user?.email || '—');
    setText2('prof-role',      role);
    setText2('prof-joined',    p?.created_at ? formatDate(p.created_at) : '—');
    setText2('prof-dept-name', d?.name      || '—');
    setText2('prof-join-code', d?.join_code || '——');
}

function copyJoinCode() {
    const code = AppState.department?.join_code;
    if (!code) return;
    navigator.clipboard?.writeText(code)
        .then(() => showToast(`Join code "${code}" copied!`, 'success'))
        .catch(() => showToast('Could not copy', 'error'));
}

// ============================================================
//  27. UI UTILITY FUNCTIONS
// ============================================================
function showToast(msg, type = 'success', duration = 3500) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className   = `show ${type}`;
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.className = ''; }, duration);
}

function openModal(id)  { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden');    }

function formatDate(str) {
    if (!str) return '—';
    const d = new Date(str + (str.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function gv(id)            { return document.getElementById(id)?.value ?? ''; }
function setVal(id, val)   { const el = document.getElementById(id); if (el) el.value = val; }
function setText(id, val)  { const el = document.getElementById(id); if (el) el.innerText = val; }
function setText2(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function sleep(ms)         { return new Promise(r => setTimeout(r, ms)); }

function setButtonLoading(btn, loading, label) {
    btn.disabled = loading;
    btn.innerHTML = loading ? `<div class="spinner"></div> ${label}` : label;
}

function loadingRow(cols) {
    return `<tr><td colspan="${cols}" style="text-align:center;padding:40px;color:#94a3b8">
        <div style="display:flex;align-items:center;justify-content:center;gap:10px">
            <div style="width:18px;height:18px;border:2px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .6s linear infinite"></div>
            Loading...
        </div></td></tr>`;
}

function errorRow(cols, msg) {
    return `<tr><td colspan="${cols}" style="text-align:center;padding:40px;color:#ef4444">⚠️ ${msg}</td></tr>`;
}

function loadingBlock() {
    return `<div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:32px;color:#94a3b8">
        <div style="width:18px;height:18px;border:2px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .6s linear infinite"></div>
        Loading...
    </div>`;
}

// ============================================================
//  28. INIT — everything starts here after DOM + CDN are ready
// ============================================================
window.addEventListener('DOMContentLoaded', () => {

    // ── Guard: make sure Supabase CDN loaded ──────────────────
    if (typeof supabase === 'undefined') {
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#ef4444;font-size:1.1rem">⚠️ Failed to load Supabase SDK. Check your internet connection and reload.</div>';
        return;
    }

    // ── Initialize db client ──────────────────────────────────
    const { createClient } = supabase;
    db = createClient(SUPABASE_URL, SUPABASE_KEY);

    // ── Auth state listener (Google OAuth redirect handled here)
    db.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
            AppState.user = session.user;
            await bootstrapUserSession();
        } else {
            AppState.user   = null;
            AppState.profile    = null;
            AppState.department = null;
            showScreen('auth');
        }
    });

    // ── Show login screen by default ─────────────────────────
    showScreen('auth');

    // ── Check for existing/returning session ──────────────────
    db.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
            AppState.user = session.user;
            bootstrapUserSession();
        }
    });
});

// ============================================================
//  29. EXTRA: DELETE ENCOUNTER
// ============================================================
async function deleteEncounter(encId, patientId, e) {
    e.stopPropagation();
    if (!confirm('Delete this encounter permanently?')) return;
    const { error } = await db.from('encounters').delete().eq('id', encId);
    if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
    showToast('Encounter deleted', 'success');
    loadEncountersList(patientId);
    loadHomeStats();
}

// ============================================================
//  30. EXTRA: UPDATE HOME SUBTITLE (called after dept loads)
// ============================================================
function refreshHomeSubtitle() {
    const dept = AppState.department;
    const el   = document.getElementById('home-dept-subtitle');
    if (el && dept) el.textContent = `${dept.name} — shared workspace`;
}

// ============================================================
//  31. EXTRA: WINDOW BEFOREUNLOAD GUARD
// ============================================================
window.addEventListener('beforeunload', e => {
    if (AppState.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});
