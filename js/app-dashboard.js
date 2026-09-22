/* =========================================================
   Diet Planner — app-dashboard.js
   Dashboard UI only

   Depends on:
   js/core/supabase.js
   js/core/auth.js
   js/core/access.js
   ========================================================= */

(() => {
  "use strict";

  const elements = {
    loading: document.getElementById("loadingScreen"),
    accountName: document.getElementById("doctorName"),
    logout: document.getElementById("logoutBtn"),
    adminCard: document.getElementById("adminCard"),
    featureCards: document.querySelectorAll("a.nav-card[data-feature]")
  };

  const Auth = () => window.DietPlannerCoreAuth;
  const Access = () => window.DietPlannerCoreAccess;
  const Supabase = () => window.DietPlannerSupabase?.client || null;

  function hideLoading() {
    if (elements.loading) elements.loading.style.display = "none";
    document.documentElement.style.visibility = "visible";
  }

  async function renderAccountName(user) {
    if (!elements.accountName || !user?.id) return;

    const client = Supabase();
    if (!client) {
      console.error("Supabase client is unavailable.");
      elements.accountName.textContent = "حساب المستخدم";
      return;
    }

    try {
      const { data: profile, error } = await client
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Profile name lookup failed:", error);
        elements.accountName.textContent = "حساب المستخدم";
        return;
      }

      elements.accountName.textContent =
        profile?.full_name?.trim() ||
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email ||
        "حساب المستخدم";
    } catch (error) {
      console.error("Profile name lookup failed:", error);
      elements.accountName.textContent = "حساب المستخدم";
    }
  }

  function renderAdminCard(isAdmin) {
    if (!elements.adminCard) return;
    elements.adminCard.classList.toggle("hidden", isAdmin !== true);
  }

  function addLockStyles() {
    if (document.getElementById("dp-feature-lock-style")) return;

    const style = document.createElement("style");
    style.id = "dp-feature-lock-style";
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
      .dp-lock-overlay {
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
        background: rgba(255,255,255,.96);
        border: 1px solid rgba(203,213,225,.9);
        color: #64748b;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.5;
        text-align: center;
        white-space: nowrap;
        box-shadow: 0 8px 20px rgba(15,23,42,.08);
      }
    `;
    document.head.appendChild(style);
  }

  function lockCard(card) {
    if (!card) return;

    card.classList.add("dp-feature-locked");
    card.setAttribute("aria-disabled", "true");
    card.setAttribute("title", "هذه الخدمة غير متاحة في اشتراكك الحالي");

    if (!card.querySelector(".dp-lock-overlay")) {
      const overlay = document.createElement("div");
      overlay.className = "dp-lock-overlay";
      overlay.innerHTML = `
        <span class="dp-lock-badge">
          <i class="fa-solid fa-lock"></i>
          <span>غير متاح في خطتك الحالية</span>
        </span>
      `;
      card.appendChild(overlay);
    }
  }

  function bindLockedCard(card) {
    if (card.dataset.lockHandlerBound === "true") return;
    card.dataset.lockHandlerBound = "true";

    card.addEventListener("click", (event) => {
      if (!card.classList.contains("dp-feature-locked")) return;
      event.preventDefault();
      event.stopPropagation();
      showLockedMessage();
    });
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

    message.textContent = "هذه الخدمة غير متاحة في اشتراكك الحالي.";
    message.style.display = "block";
    clearTimeout(window.__dpLockedMessageTimer);
    window.__dpLockedMessageTimer = setTimeout(() => {
      message.style.display = "none";
    }, 2600);
  }

  async function renderFeatureCards(userId, isAdmin) {
    if (isAdmin || !elements.featureCards.length) return;

    const access = Access();
    if (!access?.hasFeature) {
      console.error("Core access feature API is unavailable.");
      return;
    }

    addLockStyles();
    const featureCache = new Map();

    const featureResults = await Promise.all(
      Array.from(elements.featureCards).map(async (card) => {
        const feature = card.dataset.feature;
        if (!feature) return { card, allowed: true };

        if (!featureCache.has(feature)) {
          featureCache.set(
            feature,
            access.hasFeature(userId, feature).then(value => value === true)
          );
        }

        return { card, allowed: await featureCache.get(feature) };
      })
    );

    featureResults.forEach(({ card, allowed }) => {
      bindLockedCard(card);
      if (!allowed) lockCard(card);
    });
  }

  async function logoutUser() {
    if (!elements.logout) return;
    elements.logout.disabled = true;

    try {
      const auth = Auth();
      if (!auth?.signOut) throw new Error("Authentication core is unavailable.");
      await auth.signOut();
      window.location.replace("index.html");
    } catch (error) {
      console.error("Logout failed:", error);
      window.location.replace("index.html");
    }
  }

  async function initializeDashboard() {
    hideLoading();

    const access = Access();
    if (!access?.getAccessStatus) {
      console.error("Core access must load before app-dashboard.js.");
      return;
    }

    try {
      const status = await access.getAccessStatus();

      if (!status.authenticated || !status.user) {
        renderAdminCard(false);
        return;
      }

      await renderAccountName(status.user);
      renderAdminCard(status.isAdmin);
      await renderFeatureCards(status.user.id, status.isAdmin);
    } catch (error) {
      console.error("Dashboard initialization failed:", error);
      renderAdminCard(false);
    }
  }

  function start() {
    elements.logout?.addEventListener("click", logoutUser);
    initializeDashboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.DietPlannerDashboard = Object.freeze({
    init: initializeDashboard,
    logout: logoutUser
  });
})();
