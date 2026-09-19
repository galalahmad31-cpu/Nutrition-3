/* =========================================================
   NUTRITION SUPPORT PATIENT — ENTERAL NUTRITION
   All EN calculations and EN-specific UI helpers.
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

// Public EN API — preserves the existing HTML handlers without changing calculation logic.
Object.assign(window, {
  calculateBreastmilkFortification,
  convertDensityToKcalPerMl,
  convertKcalPerMlToUnit,
  calculateFormulaConcentration,
  calculateCalorieBased,
  toggleFortifier,
  calculateEN
});
