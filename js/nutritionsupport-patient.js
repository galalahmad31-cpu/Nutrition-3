/* Shared Supabase client is provided by js/auth-access.js.
   This file intentionally remains a classic script because the existing HTML
   uses inline handlers such as onclick/oninput/onchange. */
if (!window.DietPlannerAccess?.supabaseClient) {
  console.error('Nutrition Support Patient: js/auth-access.js must load before this file.');
}
const supabase = window.DietPlannerAccess?.supabaseClient;

/* =========================================================
       IV LINES
       ========================================================= */

    let ivLineCount = 1;

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
                    oninput="calculateQuickGIR()"
                >

            </div>

            <div class="md:col-span-3">

                <label class="block text-[10px] font-bold mb-1 text-gray-600">
                    Glucose Rate Unit
                </label>

                <select
                    id="qc-iv-unit-${index}"
                    class="bg-white"
                    onchange="calculateQuickGIR()"
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
                    oninput="calculateQuickGIR()"
                >

            </div>

            <div class="md:col-span-1 flex items-end justify-center">

                <button
                    onclick="removeIVLine(${index})"
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


    /* =========================================================
       BREASTMILK FORTIFICATION CALCULATOR
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


    /* =========================================================
       ACCORDIONS
       ========================================================= */

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


    /* =========================================================
       SUPPORT PROJECT MODAL
       ========================================================= */

    /* =========================================================
       PATIENT DATA COLLAPSE
       ========================================================= */

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


    /* =========================================================
       GLUCOSE INPUT MODE
       ========================================================= */

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


    /* =========================================================
       GLUCOSE MODE
       ========================================================= */

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


    /* =========================================================
       TPN TYPE
       ========================================================= */

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
                                oninput="calculateTPN()"
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
                                oninput="calculateTPN()"
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


    /* =========================================================
       DEXTROSE MODE
       ========================================================= */

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


    /* =========================================================
       FORMULA CONCENTRATION CALCULATOR
       
       Only modifications:
       - kcal/mL or kcal/oz units
       - conversion to common kcal/mL
       - original % change logic preserved
       - original water/powder calculations preserved
       - volume multiplier preserved
       ========================================================= */

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


    /* =========================================================
       CALORIE BASED
       ========================================================= */

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


    /* =========================================================
       TAB SWITCHING
       ========================================================= */

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


        if (tab === 'en') {

            document
                .querySelector('.monitoring-container-shared-en')
                .appendChild(content);

        }

        else if (tab === 'tpn') {

            document
                .querySelector('.monitoring-container-shared-tpn')
                .appendChild(content);

        }

    }


    /* =========================================================
       REFERENCE TABS
       ========================================================= */

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


    /* =========================================================
       FORTIFIER
       ========================================================= */

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


    /* =========================================================
       ENTERAL CALCULATION
       ========================================================= */

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


    /* =========================================================
       TPN CALCULATION
       ========================================================= */

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


    /* =========================================================
       QUICK GIR
       ========================================================= */

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


    /* =========================================================
       DEXTROSE PREPARATION
       ========================================================= */

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


    /* =========================================================
       PRINT
       ========================================================= */

    const PRINT_SETTINGS_KEY = 'nutritionSupportPrintSettings';

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

    /* =========================================================
       SHARE
       ========================================================= */

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


    /* =========================================================
       GLUCOSE MIXING
       ========================================================= */

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


    /* =========================================================
       INITIALIZATION
       ========================================================= */

    window.onload = () => {

        document.getElementById('report-date').value =
            new Date().toISOString().split('T')[0];


        switchTab('en');


        calculateCalorieBased();

        toggleGlucoseInputMode();

        calculateQuickGIR();

        calculateDextrosePrep();

        toggleDexMode();

        calculateFormulaConcentration();

        calculateBreastmilkFortification();

    };

/* =========================================================
   Nutrition Support Patient — extracted feature script
   ========================================================= */

const supabase = window.DietPlannerAccess?.supabaseClient;
const $=id=>document.getElementById(id);
const fmtDate=v=>{if(!v)return'—';const a=String(v).slice(0,10).split('-');return a.length===3?`${a[2]}/${a[1]}/${a[0]}`:v};
const gender=v=>v==='male'?'ذكر':v==='female'?'أنثى':v||'—';


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
document.getElementById('printCancelBtn')?.addEventListener('click', closePrintSettings);
document.getElementById('printConfirmBtn')?.addEventListener('click', confirmSupportPrint);
document.getElementById('printCompletionBtn')?.addEventListener('click', closePrintCompletion);
document.getElementById('printCompletionOverlay')?.addEventListener('click', (e)=>{ if(e.target.id==='printCompletionOverlay') closePrintCompletion(); });
document.getElementById('printSettingsOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'printSettingsOverlay') closePrintSettings();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePrintSettings();
});

$('addDayBtn')?.addEventListener('click',addSupportDay);
$('editDayBtn')?.addEventListener('click',()=>{if(currentSupportDayId)setDayEditMode(true);});
$('saveDayBtn')?.addEventListener('click',saveCurrentSupportDay);

setDayEditMode(false);

$('patientDataToggle').addEventListener('click',()=>{
  const c=$('patientDataContent'),a=$('patientDataArrow'),open=c.style.display!=='none';
  c.style.display=open?'none':'grid';
  $('patientDataToggle').setAttribute('aria-expanded',String(!open));
  a.className=open?'fa-solid fa-chevron-down':'fa-solid fa-chevron-up';
});


(async()=>{
  try{
    const {data:{session},error}=await supabase.auth.getSession();
    if(error||!session){location.replace('index.html');return;}
    const id=new URLSearchParams(location.search).get('patient');
    if(!id){location.replace('nutritionsupport.html');return;}
    const {data:p,error:pe}=await supabase.from('patients')
      .select('id,name,gender,birth_date,age,height,diagnosis,complaints,clinical_notes')
      .eq('id',id).eq('user_id',session.user.id).maybeSingle();
    if(pe) throw pe;
    if(!p){location.replace('nutritionsupport.html');return;}

    $('selectedPatientName').textContent=p.name||'—';
    $('pName').textContent=p.name||'—';
    $('pGender').textContent=gender(p.gender);
    $('pBirth').textContent=fmtDate(p.birth_date);
    $('pAge').textContent=p.age??'—';
    $('pHeight').textContent=p.height?`${p.height} سم`:'—';
    $('pDiagnosis').textContent=p.diagnosis||'—';
    $('pComplaints').textContent=p.complaints||'—';
    $('pNotes').textContent=p.clinical_notes||'—';

    const set=(id,v)=>{const e=$(id);if(e)e.value=v??''};
    set('patient-name',p.name||'');
    set('patient-id',p.id||'');
    set('report-date',new Date().toISOString().slice(0,10));
    set('clinical-diagnosis',p.diagnosis||'');
    set('nutritional-diagnosis',p.complaints||'');
    await initSupportDays(p.id, session.user.id);
  }catch(e){
    console.error(e);
    document.body.insertAdjacentHTML('afterbegin','<div style="padding:16px;text-align:center;color:#b91c1c;font-family:Cairo,sans-serif">تعذر تحميل بيانات المريض.</div>');
  }
})();
