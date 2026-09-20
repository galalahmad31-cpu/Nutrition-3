/* =========================================================
   Diet Planner — feedback.js
   User feedback only.

   Depends on:
   - js/auth-access.js
   - public.app_feedback

   Authentication and the Supabase client are provided by
   DietPlannerAccess. This file does not duplicate auth logic.
   ========================================================= */

(() => {
  "use strict";

  const state = {
    user: null,
    feedback: null,
    saving: false,
    deleting: false
  };

  const elements = {};

  function cacheElements() {
    elements.loading = document.getElementById("loadingScreen");
    elements.page = document.getElementById("feedbackPage");
    elements.form = document.getElementById("feedbackForm");
    elements.rating = document.getElementById("feedbackRating");
    elements.comment = document.getElementById("feedbackComment");
    elements.name = document.getElementById("feedbackName");
    elements.saveBtn = document.getElementById("saveFeedbackBtn");
    elements.deleteBtn = document.getElementById("deleteFeedbackBtn");
    elements.status = document.getElementById("feedbackStatus");
    elements.stars = document.querySelectorAll("[data-rating]");
  }

  function hideLoading() {
    if (elements.loading) elements.loading.style.display = "none";
  }

  function showStatus(message, type = "info") {
    if (!elements.status) return;

    const styles = {
      info: "border-slate-200 bg-slate-50 text-slate-600",
      success: "border-emerald-200 bg-emerald-50 text-emerald-700",
      error: "border-red-200 bg-red-50 text-red-700"
    };

    elements.status.className = `mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${styles[type] || styles.info}`;
    elements.status.textContent = message;
    elements.status.classList.remove("hidden");
  }

  function clearStatus() {
    elements.status?.classList.add("hidden");
  }

  function setBusy(button, busy, busyText, normalText) {
    if (!button) return;
    button.disabled = busy;
    button.innerHTML = busy
      ? `<i class="fa-solid fa-spinner fa-spin"></i><span>${busyText}</span>`
      : `<i class="fa-solid ${button.id === "deleteFeedbackBtn" ? "fa-trash" : "fa-paper-plane"}"></i><span>${normalText}</span>`;
  }

  function normalizeName(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  async function getDisplayName(user) {
    const access = window.DietPlannerAccess;
    const supabase = access?.supabaseClient;

    if (!supabase || !user?.id) return "حساب المستخدم";

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Feedback profile lookup failed:", error);
      }

      return (
        normalizeName(profile?.full_name) ||
        normalizeName(user?.user_metadata?.full_name) ||
        normalizeName(user?.user_metadata?.name) ||
        normalizeName(user?.email) ||
        "حساب المستخدم"
      );
    } catch (error) {
      console.error("Feedback profile lookup failed:", error);
      return (
        normalizeName(user?.user_metadata?.full_name) ||
        normalizeName(user?.user_metadata?.name) ||
        normalizeName(user?.email) ||
        "حساب المستخدم"
      );
    }
  }

  function setRating(value) {
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;

    elements.rating.value = String(rating);

    elements.stars.forEach((star) => {
      const starValue = Number(star.dataset.rating);
      const active = starValue <= rating;
      star.classList.toggle("text-yellow-400", active);
      star.classList.toggle("text-slate-300", !active);
      star.setAttribute("aria-checked", active && starValue === rating ? "true" : "false");
    });
  }

  function resetRating() {
    elements.rating.value = "";
    elements.stars.forEach((star) => {
      star.classList.remove("text-yellow-400");
      star.classList.add("text-slate-300");
      star.setAttribute("aria-checked", "false");
    });
  }

  function renderFeedback(feedback) {
    state.feedback = feedback || null;

    if (!feedback) {
      resetRating();
      elements.comment.value = "";
      elements.deleteBtn?.classList.add("hidden");
      elements.saveBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i><span>إرسال التقييم</span>';
      return;
    }

    setRating(feedback.rating);
    elements.comment.value = feedback.comment || "";
    elements.deleteBtn?.classList.remove("hidden");
    elements.saveBtn.innerHTML = '<i class="fa-solid fa-pen"></i><span>تحديث التقييم</span>';
  }

  async function loadFeedback() {
    const supabase = window.DietPlannerAccess?.supabaseClient;
    if (!supabase || !state.user?.id) return;

    const { data, error } = await supabase
      .from("app_feedback")
      .select("id,user_id,rating,comment,display_name,created_at,updated_at")
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (error) {
      console.error("Feedback load failed:", error);
      showStatus("تعذر تحميل تقييمك حاليًا. حاول مرة أخرى.", "error");
      return;
    }

    renderFeedback(data);
  }

  async function saveFeedback(event) {
    event?.preventDefault();
    if (state.saving || !state.user?.id) return;

    clearStatus();

    const rating = Number(elements.rating.value);
    const comment = elements.comment.value.trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      showStatus("من فضلك اختر تقييمًا من نجمة إلى 5 نجوم.", "error");
      return;
    }

    if (comment.length > 2000) {
      showStatus("الرأي يجب ألا يتجاوز 2000 حرف.", "error");
      return;
    }

    const supabase = window.DietPlannerAccess?.supabaseClient;
    if (!supabase) {
      showStatus("تعذر الاتصال بقاعدة البيانات حاليًا.", "error");
      return;
    }

    state.saving = true;
    setBusy(elements.saveBtn, true, "جاري الحفظ...", "إرسال التقييم");
    if (elements.deleteBtn) elements.deleteBtn.disabled = true;

    try {
      const displayName = await getDisplayName(state.user);

      const { data, error } = await supabase
        .from("app_feedback")
        .upsert(
          {
            user_id: state.user.id,
            rating,
            comment,
            display_name: displayName
          },
          { onConflict: "user_id" }
        )
        .select("id,user_id,rating,comment,display_name,created_at,updated_at")
        .single();

      if (error) throw error;

      renderFeedback(data);
      showStatus("تم حفظ تقييمك بنجاح.", "success");
    } catch (error) {
      console.error("Feedback save failed:", error);
      showStatus("تعذر حفظ التقييم حاليًا. حاول مرة أخرى.", "error");
    } finally {
      state.saving = false;
      setBusy(elements.saveBtn, false, "", state.feedback ? "تحديث التقييم" : "إرسال التقييم");
      if (elements.deleteBtn) elements.deleteBtn.disabled = false;
    }
  }

  function showDeleteConfirmation() {
    return new Promise((resolve) => {
      const existing = document.getElementById("feedbackDeleteModal");
      if (existing) existing.remove();

      const modal = document.createElement("div");
      modal.id = "feedbackDeleteModal";
      modal.className =
        "fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-[2px]";

      modal.innerHTML = `
        <div class="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-right shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="feedbackDeleteTitle">
          <div class="flex items-start gap-4">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <i class="fa-solid fa-trash"></i>
            </div>
            <div class="min-w-0">
              <h2 id="feedbackDeleteTitle" class="text-lg font-extrabold text-slate-800">حذف التقييم</h2>
              <p class="mt-2 text-sm leading-6 text-slate-500">هل أنت متأكد أنك تريد حذف تقييمك؟ لا يمكن التراجع عن هذا الإجراء.</p>
            </div>
          </div>
          <div class="mt-6 grid grid-cols-2 gap-3">
            <button type="button" data-feedback-confirm="cancel" class="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50">إلغاء</button>
            <button type="button" data-feedback-confirm="delete" class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-extrabold text-white transition hover:bg-red-700"><i class="fa-solid fa-trash"></i>حذف التقييم</button>
          </div>
        </div>`;

      const close = (result) => {
        modal.remove();
        document.removeEventListener("keydown", onKeyDown);
        resolve(result);
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") close(false);
      };
      modal.addEventListener("click", (event) => {
        if (event.target === modal) close(false);
      });
      modal.querySelector('[data-feedback-confirm="cancel"]')?.addEventListener("click", () => close(false));
      modal.querySelector('[data-feedback-confirm="delete"]')?.addEventListener("click", () => close(true));
      document.addEventListener("keydown", onKeyDown);
      document.body.appendChild(modal);
      requestAnimationFrame(() => modal.querySelector('[data-feedback-confirm="delete"]')?.focus());
    });
  }

  async function deleteFeedback() {
    if (state.deleting || state.saving || !state.feedback?.id || !state.user?.id) return;

    const confirmed = await showDeleteConfirmation();
    if (!confirmed) return;

    clearStatus();
    state.deleting = true;
    setBusy(elements.deleteBtn, true, "جاري الحذف...", "حذف التقييم");
    if (elements.saveBtn) elements.saveBtn.disabled = true;

    try {
      const supabase = window.DietPlannerAccess?.supabaseClient;
      if (!supabase) throw new Error("Supabase client is unavailable.");

      const { error } = await supabase
        .from("app_feedback")
        .delete()
        .eq("id", state.feedback.id)
        .eq("user_id", state.user.id);

      if (error) throw error;

      renderFeedback(null);
      showStatus("تم حذف تقييمك بنجاح.", "success");
    } catch (error) {
      console.error("Feedback delete failed:", error);
      showStatus("تعذر حذف التقييم حاليًا. حاول مرة أخرى.", "error");
    } finally {
      state.deleting = false;
      setBusy(elements.deleteBtn, false, "", "حذف التقييم");
      if (elements.saveBtn) elements.saveBtn.disabled = false;
    }
  }

  function bindEvents() {
    elements.form?.addEventListener("submit", saveFeedback);
    elements.deleteBtn?.addEventListener("click", deleteFeedback);

    elements.stars.forEach((star) => {
      star.addEventListener("click", () => setRating(star.dataset.rating));
    });
  }

  async function initialize() {
    cacheElements();
    bindEvents();

    const access = window.DietPlannerAccess;
    if (!access?.getCurrentUser || !access?.supabaseClient) {
      hideLoading();
      showStatus("تعذر تحميل خدمة الحساب حاليًا.", "error");
      return;
    }

    try {
      state.user = await access.getCurrentUser();

      if (!state.user) {
        hideLoading();
        showStatus("يجب تسجيل الدخول لاستخدام هذه الصفحة.", "error");
        return;
      }

      const displayName = await getDisplayName(state.user);
      if (elements.name) elements.name.textContent = displayName;

      await loadFeedback();
    } catch (error) {
      console.error("Feedback initialization failed:", error);
      showStatus("تعذر تحميل صفحة التقييم حاليًا.", "error");
    } finally {
      hideLoading();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  window.DietPlannerFeedback = {
    init: initialize
  };
})();
