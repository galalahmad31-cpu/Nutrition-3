/* =========================================================
   Diet Planner — Index Page
   ---------------------------------------------------------
   Login / registration UI and index-only routing.
   Authentication primitives live in core/auth.js.
   Access checks live in core/access.js.
   No shared access or Supabase logic belongs here.
   ========================================================= */

(() => {
  "use strict";

  const Auth = window.DietPlannerCoreAuth;
  const Access = window.DietPlannerCoreAccess;

  if (!Auth || !Access) {
    console.error("Diet Planner Core is not loaded before index.js.");
    return;
  }

  const $ = (id) => document.getElementById(id);

  function showAuthMessage(message, type = "error") {
    const box = $("authMessage");
    if (!box) return;

    box.textContent = message;
    box.className = "msg " + type;
    box.style.display = "block";
  }

  function setBusy(button, busy, text) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? "جاري التنفيذ..." : text;
  }

  function isStrongPassword(password) {
    return (
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  }

  const STRONG_PASSWORD_MESSAGE =
    "كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل، وحرف كبير، وحرف صغير، ورقم، ورمز.";

  async function routeAfterAuthentication(session) {
    if (!session?.user) return false;

    const userId = session.user.id;
    const role = await Access.getUserRole(userId);

    if (role === null) {
      showAuthMessage(
        "تعذر التحقق من صلاحية الحساب حاليًا. حاول مرة أخرى."
      );
      return false;
    }

    if (role === "admin") {
      window.location.replace("app.html");
      return true;
    }

    const active = await Access.hasActiveSubscription(userId);

    if (active === null) {
      showAuthMessage(
        "تعذر التحقق من حالة الاشتراك حاليًا. حاول مرة أخرى."
      );
      return false;
    }

    window.location.replace(
      active ? "app.html" : "subscription_plans_index.html"
    );

    return active;
  }

  async function loginUser() {
    const email = $("loginEmail")?.value.trim();
    const password = $("loginPassword")?.value;
    const button = $("loginButton");

    if (!email || !password) {
      showAuthMessage(
        "من فضلك أدخل البريد الإلكتروني وكلمة المرور."
      );
      return;
    }

    setBusy(button, true, "تسجيل الدخول");

    const { data, error } = await Auth.signIn(email, password);

    setBusy(button, false, "تسجيل الدخول");

    if (error) {
      showAuthMessage(
        error?.code === "invalid_credentials"
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
          : error?.message || "تعذر تسجيل الدخول حاليًا."
      );
      return;
    }

    await routeAfterAuthentication(data?.session);
  }

  async function registerUser() {
    const name = $("registerName")?.value.trim();
    const email = $("registerEmail")?.value.trim();
    const password = $("registerPassword")?.value;
    const button = $("registerButton");

    if (!name || !email || !password) {
      showAuthMessage("من فضلك أكمل جميع البيانات.");
      return;
    }

    if (!isStrongPassword(password)) {
      showAuthMessage(STRONG_PASSWORD_MESSAGE);
      return;
    }

    setBusy(button, true, "إنشاء الحساب");

    const { data, error } = await Auth.signUp(email, password, name);

    setBusy(button, false, "إنشاء الحساب");

    if (error) {
      showAuthMessage(error.message);
      return;
    }

    if (data?.session) {
      await routeAfterAuthentication(data.session);
      return;
    }

    showAuthMessage(
      "تم إنشاء الحساب بنجاح. إذا كان تأكيد البريد الإلكتروني مفعّلًا، افتح رسالة التأكيد ثم سجل الدخول.",
      "success"
    );
  }

  async function loginWithGoogle() {
    const button = $("googleLoginButton");

    if (button) {
      button.disabled = true;
      button.innerHTML =
        '<i class="fa-brands fa-google"></i><span>جاري فتح Google...</span>';
    }

    try {
      const { error } = await Auth.signInWithGoogle(
        "https://nutrition-3.vercel.app/index.html"
      );

      if (error) throw error;
    } catch (error) {
      showAuthMessage(
        error?.message ||
          "تعذر تسجيل الدخول باستخدام Google."
      );

      if (button) {
        button.disabled = false;
        button.innerHTML =
          '<i class="fa-brands fa-google"></i><span>المتابعة باستخدام Google</span>';
      }
    }
  }

  function bindAuthTabs() {
    document.querySelectorAll("[data-auth-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.authTab;

        document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
          tab.classList.toggle("active", tab === button);
        });

        document.querySelectorAll(".auth-form").forEach((form) => {
          form.style.display = form.id === target ? "block" : "none";
        });

        const box = $("authMessage");
        if (box) box.style.display = "none";
      });
    });
  }

  async function handleAuthCallback() {
    const hasHashTokens =
      window.location.hash.includes("access_token=") ||
      window.location.hash.includes("refresh_token=");

    const hasCode = new URLSearchParams(window.location.search).has("code");

    if (!hasHashTokens && !hasCode) return;

    let handled = false;
    let subscription = null;

    const handleSession = async (session) => {
      if (handled || !session?.user) return;
      handled = true;

      try {
        await routeAfterAuthentication(session);
      } finally {
        subscription?.unsubscribe?.();
      }
    };

    const authState = Auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_IN" ||
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED"
      ) {
        handleSession(session);
      }
    });

    subscription = authState?.data?.subscription || null;

    const session = await Auth.getSession();
    if (session?.user) await handleSession(session);
  }

  function initialize() {
    $("loginButton")?.addEventListener("click", loginUser);
    $("registerButton")?.addEventListener("click", registerUser);
    $("googleLoginButton")?.addEventListener("click", loginWithGoogle);
    bindAuthTabs();
    handleAuthCallback();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
