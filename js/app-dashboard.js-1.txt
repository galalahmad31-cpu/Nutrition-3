/* =========================================================
   Diet Planner — Dashboard
   app-dashboard.js

   يعتمد على:
   js/auth-access.js

   مسؤوليات هذا الملف:
   1) عرض اسم صاحب الحساب.
   2) إظهار كارت الإدارة للـ admin فقط.
   3) قفل الكروت المرتبطة بـ Features غير المتاحة.
   4) تسجيل الخروج.
   5) لا ينشئ Supabase client جديد ولا يكرر منطق الاشتراك.
   ========================================================= */

(function () {
  "use strict";

  const loadingScreen = document.getElementById("loadingScreen");
  const doctorName = document.getElementById("doctorName");
  const logoutBtn = document.getElementById("logoutBtn");
  const adminCard = document.getElementById("adminCard");

  // ---------------------------------------------------------
  // Feature mapping
  // لا نضع Feature للكروت التي لم نحدد لها Feature في النظام.
  // ---------------------------------------------------------
  const CARD_FEATURES = {
    "nutritionsupport.html": "nutrition_support",
    "diet.html": "diet_builder",
    "quickcalc.html": "quick_calc",
    "article.html": "articles"
  };

  // ---------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------
  function showDashboard() {
    if (loadingScreen) loadingScreen.style.display = "none";
    document.documentElement.style.visibility = "visible";
  }

  function getAccountName(user) {
    return (
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email ||
      "حساب المستخدم"
    );
  }

  function showAccountName(user) {
    if (doctorName && user) {
      doctorName.textContent = getAccountName(user);
    }
  }

  function showAdminCard(isAdmin) {
    if (!adminCard) return;

    // مخفي افتراضيًا، ولا يظهر إلا إذا role === admin.
    adminCard.classList.toggle("hidden", !isAdmin);
  }

  // ---------------------------------------------------------
  // Locked-card UI
  // ---------------------------------------------------------
  function injectLockedCardStyles() {
    if (document.getElementById("dp-locked-card-styles")) return;

    const style = document.createElement("style");
    style.id = "dp-locked-card-styles";
    style.textContent = `
      .dp-feature-locked {
        position: relative;
        cursor: not-allowed !important;
        opacity: .72;
      }

      .dp-feature-locked:hover {
        transform: none !important;
        box-shadow: none !important;
        border-color: rgba(226,232,240,.85) !important;
      }

      .dp-feature-locked .dp-lock-overlay {
        position: absolute;
        inset: 0;
        z-index: 5;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: inherit;
        background: rgba(248,250,252,.68);
        backdrop-filter: blur(2px);
      }

      .dp-lock-badge {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 7px 12px;
        border-radius: 999px;
        background: rgba(255,255,255,.95);
        border: 1px solid rgba(203,213,225,.9);
        color: #64748b;
        font-size: 12px;
        font-weight: 700;
        box-shadow: 0 8px 20px rgba(15,23,42,.08);
      }

      .dp-feature-locked .dp-card-arrow {
        opacity: .35;
      }
    `;
    document.head.appendChild(style);
  }

  function lockCard(card, featureKey) {
    if (!card || card.dataset.featureLocked === "true") return;

    card.dataset.featureLocked = "true";
    card.dataset.lockedFeature = featureKey || "";

    // Prevent navigation without destroying the original href.
    card.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      showLockedMessage();
    });

    // Preserve keyboard accessibility.
    card.setAttribute("aria-disabled", "true");
    card.setAttribute("title", "هذه الخدمة غير متاحة في اشتراكك الحالي");

    const arrow = card.querySelector(".fa-arrow-left");
    if (arrow) arrow.classList.add("dp-card-arrow");

    const overlay = document.createElement("div");
    overlay.className = "dp-lock-overlay";
    overlay.innerHTML = `
      <span class="dp-lock-badge">
        <i class="fa-solid fa-lock"></i>
        <span>مقفول</span>
      </span>
    `;

    card.appendChild(overlay);
    card.classList.add("dp-feature-locked");
  }

  function unlockCard(card) {
    if (!card) return;

    card.classList.remove("dp-feature-locked");
    card.removeAttribute("aria-disabled");
    card.removeAttribute("title");

    const overlay = card.querySelector(".dp-lock-overlay");
    if (overlay) overlay.remove();

    const arrow = card.querySelector(".dp-card-arrow");
    if (arrow) arrow.classList.remove("dp-card-arrow");

    card.dataset.featureLocked = "false";
  }

  function showLockedMessage() {
    let message = document.getElementById("dpLockedMessage");

    if (!message) {
      message = document.createElement("div");
      message.id = "dpLockedMessage";
      message.style.cssText = `
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        z-index: 200;
        max-width: calc(100% - 32px);
        padding: 12px 18px;
        border-radius: 14px;
        background: #17252a;
        color: #fff;
        font-family: Cairo, sans-serif;
        font-size: 13px;
        font-weight: 700;
        text-align: center;
        box-shadow: 0 15px 40px rgba(15,23,42,.18);
      `;
      document.body.appendChild(message);
    }

    message.textContent =
      "هذه الخدمة غير متاحة في اشتراكك الحالي.";

    message.style.display = "block";

    clearTimeout(window.__dpLockedMessageTimer);
    window.__dpLockedMessageTimer = setTimeout(() => {
      message.style.display = "none";
    }, 2600);
  }

  // ---------------------------------------------------------
  // Feature cards
  // ---------------------------------------------------------
  async function applyFeatureLocks(isAdmin) {
    if (isAdmin) return;

    const access = window.DietPlannerAccess;

    if (!access || typeof access.hasFeature !== "function") {
      console.warn("auth-access.js feature API is unavailable.");
      return;
    }

    injectLockedCardStyles();

    const cards = document.querySelectorAll(
      'a.nav-card[href]'
    );

    await Promise.all(
      Array.from(cards).map(async (card) => {
        const href = card.getAttribute("href");
        const featureKey = CARD_FEATURES[href];

        // No feature assigned = leave card unchanged.
        if (!featureKey) return;

        const allowed = await access.hasFeature(featureKey);

        if (allowed) {
          unlockCard(card);
        } else {
          lockCard(card, featureKey);
        }
      })
    );
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
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.replace("index.html");
    }
  }

  // ---------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------
  async function initDashboard() {
    showDashboard();

    const access = window.DietPlannerAccess;

    if (!access || typeof access.getAccessStatus !== "function") {
      console.error(
        "auth-access.js is required before app-dashboard.js."
      );
      return;
    }

    try {
      const status = await access.getAccessStatus();

      if (!status.authenticated || !status.user) {
        // لا نضع redirect هنا.
        // auth-access.js / RLS مسؤولان عن الحماية.
        showAdminCard(false);
        return;
      }

      showAccountName(status.user);

      // الإدارة تظهر فقط للـ role = admin.
      showAdminCard(status.role === "admin");

      // قفل Features غير المتاحة.
      await applyFeatureLocks(status.role === "admin");
    } catch (error) {
      console.error("Dashboard initialization failed:", error);
      showAdminCard(false);
    }
  }

  function bindEvents() {
    if (logoutBtn) {
      logoutBtn.addEventListener("click", logoutUser);
    }
  }

  function start() {
    bindEvents();
    initDashboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.DietPlannerDashboard = {
    init: initDashboard,
    logout: logoutUser
  };
})();
