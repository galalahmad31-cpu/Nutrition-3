/* =========================================================
   Diet Planner — Weight Module
   Extracted from patient-stage2.html
   ========================================================= */


/* =========================================================
   Add Weight Entry
   ========================================================= */

async function addWeightEntry() {
    const dateVal =
        document.getElementById('weightLogDate').value;

    const weightVal =
        parseFloat(
            document.getElementById('weightLogVal').value
        );

    if (!dateVal || !weightVal || weightVal <= 0) {
        showToast(
            'أدخل تاريخاً ووزناً صحيحاً',
            'error'
        );
        return;
    }

    const entry = {
        date: dateVal,
        weight: weightVal
    };

    // Save to Supabase when a cloud patient is active.
    if (
        activePatientId &&
        window.DietPlannerPatientDB
    ) {
        try {
            const remote =
                await window.DietPlannerPatientDB.addWeight(
                    activePatientId,
                    entry
                );

            if (!remote) {
                showToast(
                    'تعذر حفظ قياس الوزن في قاعدة البيانات',
                    'error'
                );
                return;
            }

            weightLogs.push(remote);

        } catch (e) {
            console.warn(
                'Weight cloud save failed.',
                e
            );

            showToast(
                'تعذر حفظ قياس الوزن في قاعدة البيانات',
                'error'
            );

            return;
        }

    } else {
        weightLogs.push(entry);
    }

    weightLogs.sort(
        (a, b) =>
            new Date(a.date) - new Date(b.date)
    );

    saveData();

    renderWeightTabUI();

    document.getElementById(
        'weightLogVal'
    ).value = '';

    showToast(
        'تم تسجيل القياس بنجاح'
    );
}


/* =========================================================
   Delete Weight Entry
   ========================================================= */

function deleteWeightEntry(idx) {

    openConfirmModal(
        'حذف القياس',
        'هل أنت متأكد من حذف هذا السجل؟',
        async () => {

            const entry = weightLogs[idx];

            if (
                activePatientId &&
                window.DietPlannerPatientDB &&
                entry?.id
            ) {
                const ok =
                    await window.DietPlannerPatientDB.removeWeight(
                        entry.id,
                        activePatientId
                    );

                if (!ok) {
                    showToast(
                        'تعذر حذف القياس من قاعدة البيانات',
                        'error'
                    );
                    return;
                }
            }

            weightLogs.splice(idx, 1);

            saveData();

            renderWeightTabUI();

            showToast(
                'تم حذف القياس'
            );
        }
    );
}


/* =========================================================
   Render Weight Tab
   ========================================================= */

function renderWeightTabUI() {

    const startEl =
        document.getElementById(
            'kpiStartWeight'
        );

    const currEl =
        document.getElementById(
            'kpiCurrentWeight'
        );

    const diffEl =
        document.getElementById(
            'kpiTotalDiff'
        );

    const bmiEl =
        document.getElementById(
            'kpiBMI'
        );

    const bmiStatus =
        document.getElementById(
            'kpiBMIStatus'
        );


    /* -----------------------------------------------------
       No Weight Records
       ----------------------------------------------------- */

    if (
        !weightLogs ||
        weightLogs.length === 0
    ) {

        startEl.textContent = '--';
        currEl.textContent = '--';
        diffEl.textContent = '--';
        bmiEl.textContent = '--';

        bmiStatus.textContent =
            'غير محدد';

        document.getElementById(
            'weightTableBody'
        ).innerHTML =
            '<tr>' +
            '<td colspan="4" class="text-center py-4 text-slate-400 font-bold">' +
            'لا توجد قياسات مسجلة' +
            '</td>' +
            '</tr>';

        renderWeightChart([]);

        return;
    }


    /* -----------------------------------------------------
       Start / Current / Difference
       ----------------------------------------------------- */

    const startW =
        weightLogs[0].weight;

    const currW =
        weightLogs[
            weightLogs.length - 1
        ].weight;

    const diff =
        currW - startW;


    startEl.textContent =
        startW.toFixed(1);

    currEl.textContent =
        currW.toFixed(1);

    diffEl.textContent =
        (diff > 0 ? '+' : '') +
        diff.toFixed(1);


    diffEl.className =
        diff < 0
            ? 'text-2xl font-black text-emerald-600'
            : (
                diff > 0
                    ? 'text-2xl font-black text-rose-600'
                    : 'text-2xl font-black text-slate-800'
            );


    /* -----------------------------------------------------
       BMI
       ----------------------------------------------------- */

    const hMet =
        (parseFloat(patientInfo.height) || 0) /
        100;


    if (hMet > 0) {

        const bmi =
            (
                currW /
                (hMet * hMet)
            ).toFixed(1);

        bmiEl.textContent =
            bmi;


        if (bmi < 18.5) {

            bmiStatus.textContent =
                'نقص وزن';

            bmiStatus.className =
                'text-xs block font-bold text-amber-500';

        } else if (bmi < 25) {

            bmiStatus.textContent =
                'وزن طبيعي';

            bmiStatus.className =
                'text-xs block font-bold text-emerald-600';

        } else if (bmi < 30) {

            bmiStatus.textContent =
                'زيادة وزن';

            bmiStatus.className =
                'text-xs block font-bold text-amber-600';

        } else {

            bmiStatus.textContent =
                'سمنة';

            bmiStatus.className =
                'text-xs block font-bold text-rose-600';
        }

    } else {

        bmiEl.textContent =
            '--';

        bmiStatus.textContent =
            'أدخل الطول لحسابه';
    }


    /* -----------------------------------------------------
       Weight History Table
       ----------------------------------------------------- */

    const tbody =
        document.getElementById(
            'weightTableBody'
        );


    tbody.innerHTML =
        weightLogs.map(
            (log, idx) => {

                const prevW =
                    idx > 0
                        ? weightLogs[idx - 1].weight
                        : log.weight;

                const d =
                    log.weight - prevW;

                const dStr =
                    d === 0
                        ? '-'
                        : (
                            d > 0
                                ? `+${d.toFixed(1)}`
                                : `${d.toFixed(1)}`
                        );


                return `
                    <tr class="hover:bg-slate-50 border-b border-slate-100 last:border-0">

                        <td class="py-2.5 px-3 font-bold">
                            ${log.date}
                        </td>

                        <td class="py-2.5 px-3 text-center font-black text-emerald-700">
                            ${log.weight} كجم
                        </td>

                        <td class="py-2.5 px-3 text-center font-bold ${
                            d < 0
                                ? 'text-emerald-600'
                                : (
                                    d > 0
                                        ? 'text-rose-500'
                                        : 'text-slate-400'
                                )
                        }">
                            ${dStr}
                        </td>

                        <td class="py-2.5 px-2 text-center no-print">

                            <button
                                onclick="deleteWeightEntry(${idx})"
                                class="text-rose-400 hover:text-rose-600 p-1 cursor-pointer"
                            >
                                <i class="fa-solid fa-trash"></i>
                            </button>

                        </td>

                    </tr>
                `;
            }
        ).join('');


    renderWeightChart(weightLogs);
}


/* =========================================================
   Weight Chart
   ========================================================= */

function renderWeightChart(logs) {

    const chartBox =
        document.getElementById(
            'weightChartContainer'
        );


    if (
        !logs ||
        logs.length < 2
    ) {

        chartBox.innerHTML =
            '<span class="text-xs text-slate-400 font-bold">' +
            'سجّل قياسين على الأقل لعرض المنحنى البياني' +
            '</span>';

        return;
    }


    const weights =
        logs.map(
            l => l.weight
        );


    const minW =
        Math.min(...weights) - 1;

    const maxW =
        Math.max(...weights) + 1;

    const wRange =
        maxW - minW || 1;


    const svgWidth = 500;
    const svgHeight = 160;
    const padding = 20;


    /* -----------------------------------------------------
       Polyline Points
       ----------------------------------------------------- */

    const pts =
        logs.map(
            (l, i) => {

                const x =
                    padding +
                    (
                        i /
                        (logs.length - 1)
                    ) *
                    (
                        svgWidth -
                        padding * 2
                    );


                const y =
                    svgHeight -
                    padding -
                    (
                        (l.weight - minW) /
                        wRange
                    ) *
                    (
                        svgHeight -
                        padding * 2
                    );


                return `${x},${y}`;
            }
        ).join(' ');


    /* -----------------------------------------------------
       Chart Points
       ----------------------------------------------------- */

    const circles =
        logs.map(
            (l, i) => {

                const x =
                    padding +
                    (
                        i /
                        (logs.length - 1)
                    ) *
                    (
                        svgWidth -
                        padding * 2
                    );


                const y =
                    svgHeight -
                    padding -
                    (
                        (l.weight - minW) /
                        wRange
                    ) *
                    (
                        svgHeight -
                        padding * 2
                    );


                return `
                    <circle
                        cx="${x}"
                        cy="${y}"
                        r="4"
                        class="fill-emerald-600 stroke-white stroke-2"
                    >
                        <title>
                            ${l.date}: ${l.weight}kg
                        </title>
                    </circle>
                `;
            }
        ).join('');


    /* -----------------------------------------------------
       Render SVG
       ----------------------------------------------------- */

    chartBox.innerHTML = `
        <svg
            viewBox="0 0 ${svgWidth} ${svgHeight}"
            class="w-full h-full overflow-visible"
        >

            <polyline
                fill="none"
                stroke="#059669"
                stroke-width="3"
                points="${pts}"
                stroke-linecap="round"
                stroke-linejoin="round"
            />

            ${circles}

        </svg>
    `;
}
