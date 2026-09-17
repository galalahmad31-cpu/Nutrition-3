// =========================================================
// Diet Planner — Authentication + Access Control
// Single-file version: index.html
// =========================================================

const SUPABASE_URL = "https://zwxnmnfoknfbzvptnpmv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_A6u5kWAdL60bYpz1wRyv6w_J2p896iY";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

function showAuthMessage(message, type = "error") {
  const box = document.getElementById("authMessage");
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

function getToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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

async function hasActiveSubscription(userId) {
  if (!userId) return null;

  const { data, error } = await supabaseClient
    .from("subscriptions")
    .select("id,status,expiry_date")
    .eq("user_id", userId)
    .eq("status", "paid")
    .gte("expiry_date", getToday())
    .order("expiry_date", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Subscription check error:", error);
    return null;
  }

  return Array.isArray(data) && data.length > 0;
}

let accessCheckPromise = null;

function checkUserAccess(session) {
  if (!session?.user) return Promise.resolve(false);
  if (accessCheckPromise) return accessCheckPromise;

  accessCheckPromise = (async () => {
    const userId = session.user.id;
    const role = await getUserRole(userId);

    // If the access data could not be read, stay on index.
    // Never send the user to the subscription page because of a database/RLS error.
    if (role === null) {
      showAuthMessage("تعذر التحقق من صلاحية الحساب حاليًا. حاول مرة أخرى.");
      return false;
    }

    // Admin: always allowed.
    if (role === "admin") {
      window.location.replace("app.html");
      return true;
    }

    // Regular user: active/paid subscription and valid expiry required.
    const active = await hasActiveSubscription(userId);

    if (active === null) {
      showAuthMessage("تعذر التحقق من حالة الاشتراك حاليًا. حاول مرة أخرى.");
      return false;
    }

    if (active) {
      window.location.replace("app.html");
      return true;
    }

    // Authenticated user with no active subscription.
    window.location.replace("subscription_plans_index.html");
    return false;
  })();

  return accessCheckPromise.finally(() => {
    accessCheckPromise = null;
  });
}

async function checkSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session check error:", error);
    return;
  }

  // No session = normal login page. Do not redirect anywhere.
  if (!data?.session) return;

  // Confirm that the session still represents a real authenticated user.
  // This prevents stale/invalid session state from causing redirect loops.
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();

  if (userError || !userData?.user) {
    console.warn("No valid authenticated user found; staying on index.");
    return;
  }

  await checkUserAccess(data.session);
}

async function loginUser() {
  const email = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value;
  const button = document.getElementById("loginButton");

  if (!email || !password) {
    showAuthMessage("من فضلك أدخل البريد الإلكتروني وكلمة المرور.");
    return;
  }

  setBusy(button, true, "تسجيل الدخول");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  setBusy(button, false, "تسجيل الدخول");

  if (error) {
    showAuthMessage(
      error.message.includes("Invalid login credentials")
        ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
        : error.message
    );
    return;
  }

  await checkUserAccess(data?.session);
}

async function registerUser() {
  const name = document.getElementById("registerName")?.value.trim();
  const email = document.getElementById("registerEmail")?.value.trim();
  const password = document.getElementById("registerPassword")?.value;
  const button = document.getElementById("registerButton");

  if (!name || !email || !password) {
    showAuthMessage("من فضلك أكمل جميع البيانات.");
    return;
  }

  if (password.length < 6) {
    showAuthMessage("كلمة المرور يجب ألا تقل عن 6 أحرف.");
    return;
  }

  setBusy(button, true, "إنشاء الحساب");

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name }
    }
  });

  setBusy(button, false, "إنشاء الحساب");

  if (error) {
    showAuthMessage(error.message);
    return;
  }

  if (data?.session) {
    await checkUserAccess(data.session);
    return;
  }

  showAuthMessage(
    "تم إنشاء الحساب بنجاح. إذا كان تأكيد البريد الإلكتروني مفعّلًا، افتح رسالة التأكيد ثم سجل الدخول. بعد ذلك سيتم توجيهك تلقائيًا حسب نوع حسابك واشتراكك.",
    "success"
  );
}

async function loginWithGoogle() {
  const button = document.getElementById("googleLoginButton");

  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fa-brands fa-google"></i><span>جاري فتح Google...</span>';
  }

  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://nutrition-3.vercel.app/index.html"
      }
    });

    if (error) throw error;
  } catch (error) {
    showAuthMessage(error?.message || "تعذر تسجيل الدخول باستخدام Google.");

    if (button) {
      button.disabled = false;
      button.innerHTML = '<i class="fa-brands fa-google"></i><span>المتابعة باستخدام Google</span>';
    }
  }
}

async function logoutUser() {
  await supabaseClient.auth.signOut();
  window.location.replace("index.html");
}

document.addEventListener("DOMContentLoaded", () => {
  // Check an already-existing session first.
  checkSession();

  document.getElementById("loginButton")?.addEventListener("click", loginUser);
  document.getElementById("registerButton")?.addEventListener("click", registerUser);
  document.getElementById("googleLoginButton")?.addEventListener("click", loginWithGoogle);

  document.querySelectorAll("[data-auth-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.authTab;

      document.querySelectorAll("[data-auth-tab]").forEach(b => {
        b.classList.toggle("active", b === btn);
      });

      document.querySelectorAll(".auth-form").forEach(form => {
        form.style.display = form.id === target ? "block" : "none";
      });

      const box = document.getElementById("authMessage");
      if (box) box.style.display = "none";
    });
  });
});

// =========================================================
// Public API for other pages
// =========================================================

async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Current user lookup error:", error);
    return null;
  }

  return data?.session?.user || null;
}

async function hasFeature(featureKey) {
  if (!featureKey) return true;

  const user = await getCurrentUser();
  if (!user) return false;

  const role = await getUserRole(user.id);

  // Admin has access to all application features.
  if (role === "admin") return true;

  const { data, error } = await supabaseClient.rpc("has_feature", {
    p_user_id: user.id,
    p_feature: featureKey
  });

  if (error) {
    console.error(`Feature check failed (${featureKey}):`, error);
    return false;
  }

  return data === true;
}

async function getAccessStatus() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      authenticated: false,
      user: null,
      role: null
    };
  }

  const role = await getUserRole(user.id);

  return {
    authenticated: true,
    user,
    role,
    isAdmin: role === "admin"
  };
}

// Make the shared client/functions available to page-specific scripts.
window.DietPlannerAccess = {
  supabaseClient,
  getCurrentUser,
  getUserRole,
  hasActiveSubscription,
  hasFeature,
  getAccessStatus,
  logout: logoutUser
};
