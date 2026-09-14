/* =========================================================
   Diet Planner — UI Helpers
   Extracted from patient.html
   ========================================================= */

function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');

    const bgColor =
        type === 'error'
            ? 'bg-rose-600'
            : 'bg-emerald-600';

    toast.className =
        `${bgColor} text-white font-bold text-xs px-4 py-3 rounded-xl shadow-lg ` +
        `flex items-center gap-2 transition-all transform translate-y-2 ` +
        `opacity-0 pointer-events-auto`;

    toast.innerHTML = `
        <i class="fa-solid ${
            type === 'error'
                ? 'fa-circle-exclamation'
                : 'fa-circle-check'
        }"></i>
        <span>${msg}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove(
            'translate-y-2',
            'opacity-0'
        );
    }, 10);

    setTimeout(() => {
        toast.classList.add(
            'opacity-0',
            'translate-y-2'
        );

        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


/* =========================================================
   Confirmation Modal
   ========================================================= */

function openConfirmModal(title, text, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = text;

    confirmCallback = callback;

    document
        .getElementById('confirmModal')
        .classList
        .remove('hidden');
}


function closeConfirmModal() {
    document
        .getElementById('confirmModal')
        .classList
        .add('hidden');

    confirmCallback = null;
}


/* =========================================================
   Number Helper
   ========================================================= */

function num(v) {
    if (v === undefined || v === null || v === '') {
        return 0;
    }

    return Number.isFinite(Number(v))
        ? Number(v)
        : v;
}


/* =========================================================
   HTML Escape Helper
   ========================================================= */

function escapeHtml(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch])
    );
      }
