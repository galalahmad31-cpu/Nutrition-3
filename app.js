/**
 * NICU Nutrition Assistant - Core Logic
 * Developed by Dr. Ahmed Galal
 */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    // Set default date
    document.getElementById('report-date').value = new Date().toISOString().split('T')[0];
    
    // Initial tab load
    switchTab('en');
}

/**
 * Event Listeners Setup
 */
function setupEventListeners() {
    // Main Tabs
    document.getElementById('tab-en').addEventListener('click', () => switchTab('en'));
    document.getElementById('tab-tpn').addEventListener('click', () => switchTab('tpn'));
    document.getElementById('tab-ref').addEventListener('click', () => switchTab('ref'));

    // Sub Tabs (Reference)
    document.getElementById('sub-tab-enteral').addEventListener('click', () => switchSubTab('enteral'));
    document.getElementById('sub-tab-parenteral').addEventListener('click', () => switchSubTab('parenteral'));

    // Enteral (EN) Inputs
    ['en-weight', 'en-hours', 'en-init-rate', 'en-advance', 'en-goal', 'en-fort-instructions'].forEach(id => {
        document.getElementById(id).addEventListener('input', calculateEN);
    });
    document.getElementById('en-option').addEventListener('change', calculateEN);
    document.getElementById('en-fort-choice').addEventListener('change', () => {
        toggleFortifier();
        calculateEN();
    });

    // TPN Inputs
    const tpnInputs = [
        'tpn-weight', 'tpn-fluid-kg', 'tpn-target-energy-kg', 'tpn-enteral-fluid', 
        'tpn-caloric-density', 'tpn-other-input', 'in-gir', 'in-glu-other-rate', 
        'in-glu-other-dur', 'in-glu-other-conc', 'in-prot', 'in-lipid', 'in-nacl', 
        'in-kcl', 'in-ca', 'in-mg', 'in-phos', 'in-trace-vol', 'in-vitalipid-vol', 
        'in-soluvito-vol', 'tpn-infusion-hours'
    ];
    tpnInputs.forEach(id => document.getElementById(id).addEventListener('input', calculateTPN));
    
    ['sel-prot-conc', 'sel-lipid-conc', 'sel-nacl-type', 'sel-trace', 'sel-vitalipid'].forEach(id => {
        document.getElementById(id).addEventListener('change', calculateTPN);
    });

    // Mixing Tool
    ['mix-target-conc', 'mix-target-vol', 'mix-c1', 'mix-c2'].forEach(id => {
        document.getElementById(id).addEventListener('input', runMixing);
    });

    // Action Buttons
    document.getElementById('en-share-btn').addEventListener('click', smartShare);
    document.getElementById('tpn-share-btn').addEventListener('click', smartShare);
    document.getElementById('final-share-btn').addEventListener('click', smartShare);
    
    document.getElementById('en-print-btn').addEventListener('click', smartPrint);
    document.getElementById('tpn-print-btn').addEventListener('click', smartPrint);
    document.getElementById('final-print-btn').addEventListener('click', smartPrint);

    // Reference Nested Tabs
    setupNestedTabs();
}

/**
 * Tab Switching Logic
 */
function switchTab(tab) {
    document.getElementById('section-en').classList.toggle('hidden', tab !== 'en');
    document.getElementById('section-tpn').classList.toggle('hidden', tab !== 'tpn');
    document.getElementById('section-ref').classList.toggle('hidden', tab !== 'ref');
    
    document.getElementById('tab-en').classList.toggle('active', tab === 'en');
    document.getElementById('tab-tpn').classList.toggle('active', tab === 'tpn');
    document.getElementById('tab-ref').classList.toggle('active', tab === 'ref');
    
    const monitorContent = document.getElementById('monitoring-content-actual');
    if (tab === 'en') {
        document.querySelector('.monitoring-container-shared-en').appendChild(monitorContent);
    } else if (tab === 'tpn') {
        document.querySelector('.monitoring-container-shared-tpn').appendChild(monitorContent);
    }
}

function switchSubTab(sub) {
    document.getElementById('sub-content-enteral').classList.toggle('hidden', sub !== 'enteral');
    document.getElementById('sub-content-parenteral').classList.toggle('hidden', sub !== 'parenteral');
    
    document.getElementById('sub-tab-enteral').classList.toggle('active', sub === 'enteral');
    document.getElementById('sub-tab-parenteral').classList.toggle('active', sub === 'parenteral');
}

function setupNestedTabs() {
    // EN Nested
    ['energy', 'risk', 'initiation'].forEach(id => {
        document.getElementById(`en-btn-${id}`).addEventListener('click', () => {
            document.querySelectorAll('.en-nested-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('#sub-content-enteral .nested-tab-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`en-nested-${id}`).classList.remove('hidden');
            document.getElementById(`en-btn-${id}`).classList.add('active');
        });
    });

    // PN Nested
    ['energy', 'fluid', 'glucose', 'protein', 'fat', 'electrolytes', 'vitamins'].forEach(id => {
        const btn = document.getElementById(`pn-btn-${id}`);
        if(btn) {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pn-nested-content').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('#sub-content-parenteral .nested-tab-btn').forEach(btn => btn.classList.remove('active'));
                document.getElementById(`pn-nested-${id}`).classList.remove('hidden');
                document.getElementById(`pn-btn-${id}`).classList.add('active');
            });
        }
    });
}

/**
 * Calculation Logic - Enteral (EN)
 */
function calculateEN() {
    const w = parseFloat(document.getElementById('en-weight').value) || 0;
    const h = parseFloat(document.getElementById('en-hours').value) || 1;
    const init = parseFloat(document.getElementById('en-init-rate').value) || 0;
    const adv = parseFloat(document.getElementById('en-advance').value) || 0;
    const goal = parseFloat(document.getElementById('en-goal').value) || 0;
    
    const freq = 24 / h;
    document.getElementById('res-en-start').innerText = ((init * w) / freq).toFixed(1);
    document.getElementById('res-en-inc').innerText = ((adv * w) / freq).toFixed(1);
    document.getElementById('res-en-max').innerText = ((goal * w) / freq).toFixed(1);
    document.getElementById('res-en-interval').innerText = h;
    document.getElementById('res-en-interval-2').innerText = h;
    document.getElementById('res-en-final-option').innerText = document.getElementById('en-option').value;
    document.getElementById('res-en-fort-text').innerText = document.getElementById('en-fort-instructions').value || "None";
}

function toggleFortifier() {
    const isYes = document.getElementById('en-fort-choice').value === 'yes';
    document.getElementById('fortifier-box').classList.toggle('hidden', !isYes);
    document.getElementById('res-en-fort-display').classList.toggle('hidden', !isYes);
}

/**
 * Calculation Logic - Parenteral (TPN)
 */
function calculateTPN() {
    const w = parseFloat(document.getElementById('tpn-weight').value) || 0;
    const fluidTarget = (parseFloat(document.getElementById('tpn-fluid-kg').value) || 0) * w;
    const entFluid = parseFloat(document.getElementById('tpn-enteral-fluid').value) || 0;
    const otherFluid = parseFloat(document.getElementById('tpn-other-input').value) || 0;
    
    const tpnFluid = fluidTarget - entFluid - otherFluid;
    document.getElementById('res-tpn-remain-fluid').innerText = tpnFluid.toFixed(1);

    const caloricDensity = parseFloat(document.getElementById('tpn-caloric-density').value) || 0;
    const enteralEnergyTotal = entFluid * caloricDensity;
    document.getElementById('res-enteral-energy').innerText = enteralEnergyTotal.toFixed(1) + " kcal";
    
    const targetEnergyKg = parseFloat(document.getElementById('tpn-target-energy-kg').value) || 0;
    const remainingNeed = Math.max(0, targetEnergyKg - (w > 0 ? enteralEnergyTotal/w : 0));
    document.getElementById('res-tpn-energy-need').innerText = remainingNeed.toFixed(1) + " kcal/kg";

    // Protein
    const pG = (parseFloat(document.getElementById('in-prot').value) || 0) * w;
    const pV = pG / (parseFloat(document.getElementById('sel-prot-conc').value) / 100);
    updateResult('res-prot-total', pG.toFixed(1));
    updateResult('res-prot-vol', pV.toFixed(1));
    updateResult('res-prot-kcal', (pG * 4).toFixed(0));

    // Lipid
    const lG = (parseFloat(document.getElementById('in-lipid').value) || 0) * w;
    const lV = lG / (parseFloat(document.getElementById('sel-lipid-conc').value) / 100);
    updateResult('res-lipid-total', lG.toFixed(1));
    updateResult('res-lipid-vol', lV.toFixed(1));
    updateResult('res-lipid-kcal', (lG * 10).toFixed(0));

    // Electrolytes
    const phosTotal = (parseFloat(document.getElementById('in-phos').value) || 0) * w;
    const naIntakeRaw = (parseFloat(document.getElementById('in-nacl').value) || 0) * w;
    const naAdjusted = Math.max(0, naIntakeRaw - (2 * phosTotal));
    const naclType = document.getElementById('sel-nacl-type').value;
    const naVol = (naclType === "3") ? (naAdjusted / 0.513) : (naAdjusted / 0.154);
    
    updateResult('res-nacl-total', naAdjusted.toFixed(1));
    updateResult('res-nacl-vol', naVol.toFixed(1));

    const kTotal = (parseFloat(document.getElementById('in-kcl').value) || 0) * w;
    updateResult('res-kcl-vol', (kTotal / 2).toFixed(1));
    updateResult('res-kcl-total', kTotal.toFixed(1));

    const caTotal = (parseFloat(document.getElementById('in-ca').value) || 0) * w;
    updateResult('res-ca-vol', (caTotal / 0.23).toFixed(1));
    updateResult('res-ca-total', caTotal.toFixed(1));

    const mgTotal = (parseFloat(document.getElementById('in-mg').value) || 0) * w;
    updateResult('res-mg-vol', (mgTotal / 0.812).toFixed(1));
    updateResult('res-mg-total', mgTotal.toFixed(1));

    updateResult('res-phos-total', phosTotal.toFixed(1));
    updateResult('res-phos-vol', phosTotal.toFixed(1));

    const additivesVol = (parseFloat(document.getElementById('in-trace-vol').value) || 0) +
                         (parseFloat(document.getElementById('in-vitalipid-vol').value) || 0) +
                         (parseFloat(document.getElementById('in-soluvito-vol').value) || 0);

    // Glucose (GIR based)
    const gir = parseFloat(document.getElementById('in-gir').value) || 0;
    const totalG_gram = (gir * w * 1440) / 1000;
    const otherG_gram = (parseFloat(document.getElementById('in-glu-other-rate').value) || 0) * (parseFloat(document.getElementById('in-glu-other-dur').value) || 0) * (parseFloat(document.getElementById('in-glu-other-conc').value) || 0) / 100;
    
    const tpnG_gram = totalG_gram - otherG_gram;
    const tpnG_vol = tpnFluid - (pV + lV + naVol + (kTotal/2) + (caTotal/0.23) + (mgTotal/0.812) + phosTotal + additivesVol);
    
    updateResult('res-glu-total-final', totalG_gram.toFixed(1));
    updateResult('res-glu-total-tpn', tpnG_gram.toFixed(1));
    updateResult('res-glu-vol-tpn', tpnG_vol.toFixed(1));
    updateResult('res-glu-kcal-tpn', (tpnG_gram * 3.4).toFixed(0));

    // Summary Metrics
    const gluConc = (tpnG_gram / tpnG_vol) * 100;
    updateResult('res-glu-conc', isFinite(gluConc) ? gluConc.toFixed(1) + "%" : "0%");

    const tpnEnergy = (pG * 4) + (lG * 10) + (tpnG_gram * 3.4);
    updateResult('res-tpn-total-vol', tpnFluid.toFixed(1));
    updateResult('res-tpn-total-kcal', tpnEnergy.toFixed(0));

    const infusionHours = parseFloat(document.getElementById('tpn-infusion-hours').value) || 24;
    const tpnRate = tpnFluid / infusionHours;
    updateResult('res-tpn-rate', isFinite(tpnRate) ? tpnRate.toFixed(1) + " ml/hr" : "0 ml/hr");

    const osm = (pG * 10 + tpnG_gram * 5 + (naAdjusted + kTotal + caTotal + mgTotal) * 2) / (tpnFluid / 1000);
    updateResult('res-osmolarity', isFinite(osm) ? Math.round(osm) : "0");
    
    runMixing();
}

/**
 * Utility: Update UI element
 */
function updateResult(id, val) {
    const el = document.getElementById(id);
    if(el) el.innerText = val;
}

/**
 * Utility: Mixing Tool
 */
function runMixing() {
    const targetC = parseFloat(document.getElementById('mix-target-conc').value);
    const targetV = parseFloat(document.getElementById('mix-target-vol').value);
    const c1 = parseFloat(document.getElementById('mix-c1').value);
    const c2 = parseFloat(document.getElementById('mix-c2').value);
    
    if (targetC && targetV && c1 && c2) {
        const v1 = (targetV * (targetC - c2)) / (c1 - c2);
        const v2 = targetV - v1;
        if (v1 >= 0 && v2 >= 0) {
            const txt = `D${c1}%: ${v1.toFixed(1)}ml | D${c2}%: ${v2.toFixed(1)}ml`;
            updateResult('mix-result', txt);
            updateResult('res-glu-mix-breakdown', `(${txt})`);
        }
    }
}

/**
 * Printing & Sharing
 */
function smartPrint() {
    const hasEN = (parseFloat(document.getElementById('en-weight').value) || 0) > 0;
    const hasTPN = (parseFloat(document.getElementById('tpn-weight').value) || 0) > 0;
    
    if (!hasEN && !hasTPN) return;
    
    document.body.classList.remove('print-en', 'print-tpn');
    if (hasEN) document.body.classList.add('print-en');
    if (hasTPN) document.body.classList.add('print-tpn');
    
    window.print();
}

async function smartShare() {
    const patient = {
        name: document.getElementById('patient-name').value || "N/A",
        date: document.getElementById('report-date').value || "N/A",
        id: document.getElementById('patient-id').value || "N/A",
        ga: document.getElementById('gestational-age').value || "N/A",
        bw: document.getElementById('birth-weight').value || "N/A",
        cDiag: document.getElementById('clinical-diagnosis').value || "N/A",
        nDiag: document.getElementById('nutritional-diagnosis').value || "N/A"
    };

    const w_en = parseFloat(document.getElementById('en-weight').value) || 0;
    const w_tpn = parseFloat(document.getElementById('tpn-weight').value) || 0;
    
    if (w_en <= 0 && w_tpn <= 0) return;

    let text = `🏥 NICU Nutrition Report\n`;
    text += `👤 Patient: ${patient.name}\n`;
    text += `📅 Date: ${patient.date} | ID: ${patient.id}\n`;
    text += `👶 GA: ${patient.ga} | Birth Wt: ${patient.bw} kg\n`;
    text += `📝 Clinical Diag: ${patient.cDiag}\n`;
    text += `🍎 Nutrition Diag: ${patient.nDiag}\n\n`;
    
    if (w_en > 0) {
        text += `🟣 ENTERAL\n• Weight: ${w_en} kg\n• Start: ${document.getElementById('res-en-start').innerText} ml every ${document.getElementById('res-en-interval').innerText}h\n\n`;
    }
    if (w_tpn > 0) {
        text += `🔵 TPN\n• Weight: ${w_tpn} kg\n• GIR: ${document.getElementById('in-gir').value}\n• TPN Rate: ${document.getElementById('res-tpn-rate').innerText}\n\n`;
    }
    
    if (navigator.share) {
        try { await navigator.share({ text: text }); } catch (err) { console.error(err); }
    } else {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        // Using custom logic instead of alert as requested by system prompt
        console.log("Report copied to clipboard.");
    }
}
