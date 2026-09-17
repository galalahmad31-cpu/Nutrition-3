/* =========================================================
   DIET PLANNER
   Central Authentication + Access Control
   ========================================================= */

const SUPABASE_URL =
  "https://zwxnmnfoknfbzvptnpmv.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_A6u5kWAdL60bYpz1wRyv6w_J2p896iY";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


/* =========================================================
   GLOBAL ACCESS STATE
   ========================================================= */

window.DietPlannerAccess = {
  initialized: false,
  user: null,
  role: null,
  subscription: null,
  plan: null,
  activeSubscription: false,
  features: {},
  maxPatients: null,
  currentPatientCount: 0,
  loading: true
};


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function getToday() {
  const now = new Date();

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function isActiveSubscription(subscription) {
  if (!subscription) return false;

  return (
    subscription.status === "paid" &&
    subscription.start_date &&
    subscription.expiry_date &&
    subscription.start_date <= getToday() &&
    subscription.expiry_date >= getToday()
  );
}


/* =========================================================
   AUTH MESSAGE
   ========================================================= */

function showAuthMessage(message, type = "error") {
  const box = document.getElementById("authMessage");
  if (!box) return;

  box.textContent = message;
  box.className = "msg " + type;
  box.style.display = "block";
}


/* =========================================================
   BUTTON BUSY STATE
   ========================================================= */

function setBusy(button, busy, text) {
  if (!button) return;

  button.disabled = busy;
  button.textContent = busy ? "جاري التنفيذ..." : text;
}


/* =========================================================
   GET USER ROLE
   ========================================================= */

async function getUserRole(userId) {
  if (!userId) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Role check error:", error);
    return null;
  }

  return data?.role || "user";
}


/* =========================================================
   GET CURRENT SUBSCRIPTION
   ========================================================= */

async function getCurrentSubscription(userId) {
  if (!userId) return null;

  const { data, error } = await supabaseClient
    .from("subscriptions")
    .select(`
      id,
      user_id,
      plan_id,
      status,
      start_date,
      expiry_date,
      created_at,
      payment_proof,
      notes
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Subscription check error:", error);
    return null;
  }

  return data?.[0] || null;
}


/* =========================================================
   GET PLAN
   ========================================================= */

async function getPlan(planId) {
  if (!planId) return null;

  const { data, error } = await supabaseClient
    .from("subscription_plans")
    .select(`
      id,
      name,
      duration_days,
      price,
      payment_method,
      description,
      is_active,
      features,
      is_free_trial,
      max_patients
    `)
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    console.error("Plan check error:", error);
    return null;
  }

  return data || null;
}


/* =========================================================
   GET CURRENT PATIENT COUNT
   ========================================================= */

async function getCurrentPatientCount(userId, subscriptionId) {
  if (!userId || !subscriptionId) return 0;

  const { count, error } = await supabaseClient
    .from("patients")
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("user_id", userId)
    .eq("subscription_id", subscriptionId);

  if (error) {
    console.error("Patient count error:", error);
    return 0;
  }

  return count || 0;
}


/* =========================================================
   LOAD ACCESS DATA
   ========================================================= */

async function loadAccessData(session) {
  const access = window.DietPlannerAccess;

  access.loading = true;

  if (!session?.user) {
    access.user = null;
    access.role = null;
    access.subscription = null;
    access.plan = null;
    access.activeSubscription = false;
    access.features = {};
    access.maxPatients = null;
    access.currentPatientCount = 0;
    access.loading = false;
    return access;
  }

  const userId = session.user.id;
  access.user = session.user;

  const role = await getUserRole(userId);

  if (role === null) {
    access.loading = false;
    throw new Error("تعذر التحقق من صلاحية الحساب.");
  }

  access.role = role;

  /* Admin = everything */
  if (role === "admin") {
    access.activeSubscription = true;
    access.subscription = null;
    access.plan = null;
    access.features = { "*": true };
    access.maxPatients = null;
    access.currentPatientCount = 0;
    access.loading = false;
    return access;
  }

  const subscription = await getCurrentSubscription(userId);
  access.subscription = subscription;

  if (!subscription) {
    access.activeSubscription = false;
    access.plan = null;
    access.features = {};
    access.maxPatients = null;
    access.currentPatientCount = 0;
    access.loading = false;
    return access;
  }

  const plan = await getPlan(subscription.plan_id);
  access.plan = plan;

  access.activeSubscription =
    isActiveSubscription(subscription);

  /*
    Features are available only when the
    subscription and plan are active.
  */
  if (
    access.activeSubscription &&
    plan?.is_active
  ) {
    access.features = plan.features || {};
  } else {
    access.features = {};
  }

  access.maxPatients =
    plan?.max_patients ?? null;

  access.currentPatientCount =
    await getCurrentPatientCount(
      userId,
      subscription.id
    );

  access.loading = false;

  return access;
}


/* =========================================================
   FEATURE CHECK
   ========================================================= */

function hasFeature(featureKey) {
  const access = window.DietPlannerAccess;

  if (access.role === "admin") {
    return true;
  }

  if (!access.activeSubscription) {
    return false;
  }

  if (!access.plan?.is_active) {
    return false;
  }

  return access.features?.[featureKey] === true;
}


/* =========================================================
   PATIENT LIMIT CHECK
   ========================================================= */

function canAddPatientFrontend() {
  const access = window.DietPlannerAccess;

  if (access.role === "admin") {
    return true;
  }

  if (!access.activeSubscription) {
    return false;
  }

  if (access.maxPatients === null) {
    return true;
  }

  return (
    access.currentPatientCount <
    access.maxPatients
  );
}


/* =========================================================
   ACCESS STATUS
   ========================================================= */

function getAccessStatus() {
  const access = window.DietPlannerAccess;

  return {
    authenticated: !!access.user,
    role: access.role,
    activeSubscription: access.activeSubscription,
    subscription: access.subscription,
    plan: access.plan,
    features: access.features,
    maxPatients: access.maxPatients,
    currentPatientCount: access.currentPatientCount,
    canAddPatient: canAddPatientFrontend()
  };
}


/* =========================================================
   REQUIRE LOGIN
   ========================================================= */

async function requireLogin() {
  const { data, error } =
    await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    return false;
  }

  if (!data?.session) {
    window.location.replace("index.html");
    return false;
  }

  return true;
}


/* =========================================================
   REQUIRE FEATURE
   ========================================================= */

async function requireFeature(
  featureKey,
  options = {}
) {
  const {
    redirect = "app.html"
  } = options;

  const loggedIn = await requireLogin();

  if (!loggedIn) {
    return false;
  }

  if (
    window.DietPlannerAccess.loading ||
    !window.DietPlannerAccess.initialized
  ) {
    const { data } =
      await supabaseClient.auth.getSession();

    await loadAccessData(data?.session);

    window.DietPlannerAccess.initialized = true;
  }

  if (
    window.DietPlannerAccess.role === "admin"
  ) {
    return true;
  }

  if (hasFeature(featureKey)) {
    return true;
  }

  window.location.replace(redirect);
  return false;
}


/* =========================================================
   PROTECT PAGE
   ========================================================= */

async function protectPage(options = {}) {
  const {
    feature = null
  } = options;

  const loggedIn = await requireLogin();

  if (!loggedIn) {
    return false;
  }

  const { data } =
    await supabaseClient.auth.getSession();

  await loadAccessData(data?.session);

  window.DietPlannerAccess.initialized = true;

  if (feature) {
    if (!hasFeature(feature)) {
      showLockedPage(feature);
      return false;
    }
  }

  return true;
}


/* =========================================================
   LOCKED PAGE
   ========================================================= */

function showLockedPage(featureKey) {
  const locked =
    document.getElementById("accessLocked");

  if (locked) {
    locked.style.display = "block";

    const featureName =
      locked.querySelector(
        "[data-feature-name]"
      );

    if (featureName) {
      featureName.textContent =
        getFeatureName(featureKey);
    }

    return;
  }

  console.warn(
    "Feature locked:",
    featureKey
  );
}


/* =========================================================
   FEATURE NAMES
   ========================================================= */

function getFeatureName(featureKey) {
  const names = {
    nutrition_support: "Nutrition Support",
    diet_builder: "Diet Builder",
    articles: "المقالات",
    quick_calc: "الحسابات السريعة"
  };

  return names[featureKey] || featureKey;
}


/* =========================================================
   LOCK FEATURE ELEMENTS
   ========================================================= */

function applyFeatureLocks() {
  const elements =
    document.querySelectorAll(
      "[data-feature]"
    );

  elements.forEach(element => {
    const feature =
      element.dataset.feature;

    const allowed =
      hasFeature(feature);

    if (allowed) {
      element.classList.remove(
        "feature-locked"
      );

      element.removeAttribute(
        "aria-disabled"
      );

      element.removeAttribute(
        "data-locked"
      );

      return;
    }

    element.classList.add(
      "feature-locked"
    );

    element.setAttribute(
      "aria-disabled",
      "true"
    );

    element.setAttribute(
      "data-locked",
      "true"
    );

    if (
      element.tagName === "BUTTON" ||
      element.tagName === "A"
    ) {
      element.addEventListener(
        "click",
        blockLockedFeature,
        true
      );
    }

    if (
      !element.querySelector(
        ".feature-lock-icon"
      )
    ) {
      const lock =
        document.createElement("span");

      lock.className =
        "feature-lock-icon";

      lock.textContent = " 🔒";

      element.appendChild(lock);
    }
  });
}


/* =========================================================
   BLOCK LOCKED FEATURE
   ========================================================= */

function blockLockedFeature(event) {
  const element = event.currentTarget;

  if (
    element.dataset.locked === "true"
  ) {
    event.preventDefault();
    event.stopPropagation();

    showLockedMessage(
      element.dataset.feature
    );

    return false;
  }
}


/* =========================================================
   LOCKED MESSAGE
   ========================================================= */

function showLockedMessage(featureKey) {
  const name =
    getFeatureName(featureKey);

  alert(
    `🔒 ${name}\n\n` +
    `هذه الخدمة غير متاحة في خطتك الحالية.\n` +
    `يمكنك مراجعة خطتك أو تجديد الاشتراك.`
  );
}


/* =========================================================
   SUBSCRIPTION STATUS UI
   ========================================================= */

function applySubscriptionUI() {
  const access =
    window.DietPlannerAccess;

  const elements =
    document.querySelectorAll(
      "[data-subscription-status]"
    );

  elements.forEach(element => {
    const status =
      element.dataset.subscriptionStatus;

    if (status === "active") {
      element.style.display =
        access.activeSubscription
          ? ""
          : "none";

      return;
    }

    if (status === "expired") {
      element.style.display =
        access.activeSubscription
          ? "none"
          : "";

      return;
    }

    if (status === "admin") {
      element.style.display =
        access.role === "admin"
          ? ""
          : "none";
    }
  });
}


/* =========================================================
   PATIENT LIMIT UI
   ========================================================= */

function applyPatientLimitUI() {
  const access =
    window.DietPlannerAccess;

  const elements =
    document.querySelectorAll(
      "[data-patient-limit]"
    );

  elements.forEach(element => {
    if (access.role === "admin") {
      element.textContent = "غير محدود";
      return;
    }

    if (access.maxPatients === null) {
      element.textContent =
        `${access.currentPatientCount} / غير محدود`;
      return;
    }

    element.textContent =
      `${access.currentPatientCount} / ${access.maxPatients}`;
  });
}


/* =========================================================
   GLOBAL UI INITIALIZATION
   ========================================================= */

async function initializeAccessUI() {
  try {
    const { data } =
      await supabaseClient.auth.getSession();

    await loadAccessData(data?.session);

    window.DietPlannerAccess.initialized = true;

    applyFeatureLocks();
    applySubscriptionUI();
    applyPatientLimitUI();

  } catch (error) {
    console.error(
      "Access initialization error:",
      error
    );
  } finally {
    window.DietPlannerAccess.loading = false;
  }
}


/* =========================================================
   CHECK SESSION ON LOGIN PAGE
   ========================================================= */

async function checkSession() {
  const { data, error } =
    await supabaseClient.auth.getSession();

  if (error) {
    console.error(
      "Session check error:",
      error
    );
    return;
  }

  if (!data?.session) {
    return;
  }

  const {
    data: userData,
    error: userError
  } =
    await supabaseClient.auth.getUser();

  if (
    userError ||
    !userData?.user
  ) {
    console.warn(
      "No valid authenticated user."
    );
    return;
  }

  window.location.replace("app.html");
}


/* =========================================================
   LOGIN
   ========================================================= */

async function loginUser() {
  const email =
    document.getElementById(
      "loginEmail"
    )?.value.trim();

  const password =
    document.getElementById(
      "loginPassword"
    )?.value;

  const button =
    document.getElementById(
      "loginButton"
    );

  if (!email || !password) {
    showAuthMessage(
      "من فضلك أدخل البريد الإلكتروني وكلمة المرور."
    );
    return;
  }

  setBusy(
    button,
    true,
    "تسجيل الدخول"
  );

  const {
    data,
    error
  } =
    await supabaseClient.auth
      .signInWithPassword({
        email,
        password
      });

  setBusy(
    button,
    false,
    "تسجيل الدخول"
  );

  if (error) {
    showAuthMessage(
      error.message.includes(
        "Invalid login credentials"
      )
        ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
        : error.message
    );
    return;
  }

  window.location.replace("app.html");
}


/* =========================================================
   REGISTER
   ========================================================= */

async function registerUser() {
  const name =
    document.getElementById(
      "registerName"
    )?.value.trim();

  const email =
    document.getElementById(
      "registerEmail"
    )?.value.trim();

  const password =
    document.getElementById(
      "registerPassword"
    )?.value;

  const button =
    document.getElementById(
      "registerButton"
    );

  if (!name || !email || !password) {
    showAuthMessage(
      "من فضلك أكمل جميع البيانات."
    );
    return;
  }

  if (password.length < 6) {
    showAuthMessage(
      "كلمة المرور يجب ألا تقل عن 6 أحرف."
    );
    return;
  }

  setBusy(
    button,
    true,
    "إنشاء الحساب"
  );

  const {
    data,
    error
  } =
    await supabaseClient.auth
      .signUp({
        email,
        password,
        options: {
          data: {
            full_name: name
          }
        }
      });

  setBusy(
    button,
    false,
    "إنشاء الحساب"
  );

  if (error) {
    showAuthMessage(
      error.message
    );
    return;
  }

  if (data?.session) {
    window.location.replace(
      "app.html"
    );
    return;
  }

  showAuthMessage(
    "تم إنشاء الحساب بنجاح. إذا كان تأكيد البريد الإلكتروني مفعّلًا، افتح رسالة التأكيد ثم سجل الدخول.",
    "success"
  );
}


/* =========================================================
   GOOGLE LOGIN
   ========================================================= */

async function loginWithGoogle() {
  const button =
    document.getElementById(
      "googleLoginButton"
    );

  if (button) {
    button.disabled = true;

    button.innerHTML =
      '<i class="fa-brands fa-google"></i>' +
      '<span>جاري فتح Google...</span>';
  }

  try {
    const { error } =
      await supabaseClient.auth
        .signInWithOAuth({
          provider: "google",
          options: {
            redirectTo:
              "https://nutrition-3.vercel.app/index.html"
          }
        });

    if (error) {
      throw error;
    }

  } catch (error) {
    showAuthMessage(
      error?.message ||
      "تعذر تسجيل الدخول باستخدام Google."
    );

    if (button) {
      button.disabled = false;

      button.innerHTML =
        '<i class="fa-brands fa-google"></i>' +
        '<span>المتابعة باستخدام Google</span>';
    }
  }
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutUser() {
  const { error } =
    await supabaseClient.auth.signOut();

  if (error) {
    console.error(
      "Logout error:",
      error
    );
    return;
  }

  window.location.replace(
    "index.html"
  );
}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

supabaseClient.auth.onAuthStateChange(
  async (event, session) => {

    console.log(
      "Auth event:",
      event
    );

    if (event === "SIGNED_OUT") {
      window.DietPlannerAccess = {
        initialized: false,
        user: null,
        role: null,
        subscription: null,
        plan: null,
        activeSubscription: false,
        features: {},
        maxPatients: null,
        currentPatientCount: 0,
        loading: false
      };
    }
  }
);


/* =========================================================
   INDEX PAGE INITIALIZATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    checkSession();

    document
      .getElementById("loginButton")
      ?.addEventListener(
        "click",
        loginUser
      );

    document
      .getElementById("registerButton")
      ?.addEventListener(
        "click",
        registerUser
      );

    document
      .getElementById("googleLoginButton")
      ?.addEventListener(
        "click",
        loginWithGoogle
      );

    document
      .querySelectorAll(
        "[data-auth-tab]"
      )
      .forEach(btn => {

        btn.addEventListener(
          "click",
          () => {

            const target =
              btn.dataset.authTab;

            document
              .querySelectorAll(
                "[data-auth-tab]"
              )
              .forEach(b => {
                b.classList.toggle(
                  "active",
                  b === btn
                );
              });

            document
              .querySelectorAll(
                ".auth-form"
              )
              .forEach(form => {
                form.style.display =
                  form.id === target
                    ? "block"
                    : "none";
              });

            const box =
              document.getElementById(
                "authMessage"
              );

            if (box) {
              box.style.display = "none";
            }
          }
        );
      });

    /*
      Load access data on application pages.
    */
    if (
      window.location.pathname
        .split("/")
        .pop()
        .toLowerCase() !== "index.html"
    ) {
      initializeAccessUI();
    }
  }
);


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.requireLogin =
  requireLogin;

window.requireFeature =
  requireFeature;

window.protectPage =
  protectPage;

window.hasFeature =
  hasFeature;

window.getAccessStatus =
  getAccessStatus;

window.canAddPatientFrontend =
  canAddPatientFrontend;

window.logoutUser =
  logoutUser;

window.showLockedMessage =
  showLockedMessage;

window.getFeatureName =
  getFeatureName;
