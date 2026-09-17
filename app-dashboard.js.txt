/* =========================================================
   Diet Planner — Dashboard
   app-dashboard.js

   مسؤولية هذا الملف:
   - وظائف واجهة Dashboard فقط.
   - الاعتماد على auth-access.js للمصادقة والصلاحيات.
   - لا يحتوي على Supabase client مستقل.
   - لا يحتوي على منطق الاشتراك أو Feature Access.
   ========================================================= */

(function () {
  "use strict";

  // ---------------------------------------------------------
  // DOM Elements
  // ---------------------------------------------------------
  const loadingScreen = document.getElementById("loadingScreen");
  const doctorName = document.getElementById("doctorName");
  const logoutBtn = document.getElementById("logoutBtn");
  const adminCard = document.getElementById("adminCard");

  // ---------------------------------------------------------
  // UI Helpers
  // ---------------------------------------------------------
  function showDashboard() {
    if (loadingScreen) {
      loadingScreen.style.display = "none";
    }

    document.documentElement.style.visibility = "visible";
  }

  function showDoctorName(user) {
    if (!doctorName || !user) return;

    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      "المستخدم";

    doctorName.textContent = name;
  }

  function showAdminCard(isAdmin) {
    if (!adminCard) return;

    adminCard.classList.toggle("hidden", !isAdmin);
  }

  // ---------------------------------------------------------
  // Authentication
  // يعتمد على auth-access.js
  // ---------------------------------------------------------
  async function getCurrentUser() {
    try {
      if (
        window.DietPlannerAccess &&
        typeof window.DietPlannerAccess.getCurrentUser === "function"
      ) {
        return await window.DietPlannerAccess.getCurrentUser();
      }

      // Fallback آمن إذا كانت النسخة الحالية من auth-access.js
      // لا تعرض getCurrentUser بشكل مباشر.
      if (window.DietPlannerAccess?.supabaseClient) {
        const { data, error } =
          await window.DietPlannerAccess.supabaseClient.auth.getSession();

        if (error) {
          console.error("Session lookup failed:", error);
          return null;
        }

        return data?.session?.user || null;
      }

      return null;
    } catch (error) {
      console.error("Failed to get current user:", error);
      return null;
    }
  }

  async function getUserRole(user) {
    try {
      if (!user) return null;

      if (
        window.DietPlannerAccess &&
        typeof window.DietPlannerAccess.getUserRole === "function"
      ) {
        return await window.DietPlannerAccess.getUserRole(user.id);
      }

      // لا ننشئ Supabase client جديد هنا.
      // إذا كان auth-access.js لا يوفر getUserRole،
      // يتم الاعتماد على الـ UI الافتراضي بدون كسر الصفحة.
      return null;
    } catch (error) {
      console.error("Role lookup failed:", error);
      return null;
    }
  }

  // ---------------------------------------------------------
  // Logout
  // ---------------------------------------------------------
  async function logoutUser() {
    if (!logoutBtn) return;

    logoutBtn.disabled = true;

    try {
      if (
        window.DietPlannerAccess &&
        typeof window.DietPlannerAccess.logout === "function"
      ) {
        await window.DietPlannerAccess.logout();
        return;
      }

      // Fallback: استخدام Supabase client الموجود في auth-access.js
      if (window.DietPlannerAccess?.supabaseClient) {
        const { error } =
          await window.DietPlannerAccess.supabaseClient.auth.signOut();

        if (error) {
          console.error("Logout failed:", error);
        }
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.replace("index.html");
    }
  }

  // ---------------------------------------------------------
  // Dashboard Initialization
  // ---------------------------------------------------------
  async function initDashboard() {
    // إظهار الواجهة أولاً وعدم حجب Dashboard بسبب فشل
    // معلومات اختيارية.
    showDashboard();

    try {
      const user = await getCurrentUser();

      if (!user) {
        // auth-access.js هو المسؤول الأساسي عن حماية الصفحة.
        // لا نكرر redirect logic هنا.
        return;
      }

      showDoctorName(user);

      const role = await getUserRole(user);

      if (role === "admin") {
        showAdminCard(true);
      } else {
        showAdminCard(false);
      }
    } catch (error) {
      console.error("Dashboard initialization failed:", error);
    }
  }

  // ---------------------------------------------------------
  // Events
  // ---------------------------------------------------------
  function bindEvents() {
    if (logoutBtn) {
      logoutBtn.addEventListener("click", logoutUser);
    }
  }

  // ---------------------------------------------------------
  // Start
  // ---------------------------------------------------------
  function start() {
    bindEvents();
    initDashboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  // ---------------------------------------------------------
  // Optional public API
  // ---------------------------------------------------------
  window.DietPlannerDashboard = {
    init: initDashboard,
    logout: logoutUser
  };
})();
