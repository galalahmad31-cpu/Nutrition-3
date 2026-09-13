// =========================================================
// Diet Planner — Supabase Authentication + Subscription Gate
// =========================================================

const SUPABASE_URL = "https://zwxnmnfoknfbzvptnpmv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_A6u5kWAdL60bYpz1wRyv6w_J2p896iY";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


// =========================================================
// Messages
// =========================================================

function showAuthMessage(message, type = "error") {
  const box = document.getElementById("authMessage");
  if (!box) return;

  box.textContent = message;
  box.className = "msg " + type;
  box.style.display = "block";
}


// =========================================================
// Button Busy State
// =========================================================

function setBusy(button, busy, text) {
  if (!button) return;

  button.disabled = busy;
  button.textContent = busy
    ? "جاري التنفيذ..."
    : text;
}


// =========================================================
// Subscription Check
// =========================================================

async function hasActiveSubscription(userId) {
  if (!userId) return false;

  const { data, error } = await supabaseClient.rpc(
    "has_active_subscription",
    {
      p_user_id: userId
    }
  );

  if (error) {
    console.error("Subscription check error:", error);
    return false;
  }

  return data === true;
}


// =========================================================
// Handle User Access
// =========================================================

async function checkUserAccess(session) {
  if (!session?.user) {
    return false;
  }

  const active = await hasActiveSubscription(
    session.user.id
  );

  if (active) {
    window.location.replace("app.html");
    return true;
  }

  // No active subscription
  await supabaseClient.auth.signOut();

  showAuthMessage(
    "اشتراكك غير فعال أو انتهت مدة الاشتراك. يرجى التواصل مع إدارة النظام عبر الواتساب 01094199634 لتفعيل أو تجديد الاشتراك."
  );

  return false;
}


// =========================================================
// Check Existing Session
// =========================================================

async function checkSession() {
  const { data, error } =
    await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session check error:", error);
    return;
  }

  if (data?.session) {
    await checkUserAccess(data.session);
  }
}


// =========================================================
// Login
// =========================================================

async function loginUser() {
  const email = document
    .getElementById("loginEmail")
    ?.value.trim();

  const password = document
    .getElementById("loginPassword")
    ?.value;

  const button =
    document.getElementById("loginButton");

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

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
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

  // Check subscription before entering the system
  const allowed =
    await checkUserAccess(data?.session);

  if (!allowed) {
    return;
  }
}


// =========================================================
// Register
// =========================================================

async function registerUser() {
  const name = document
    .getElementById("registerName")
    ?.value.trim();

  const email = document
    .getElementById("registerEmail")
    ?.value.trim();

  const password = document
    .getElementById("registerPassword")
    ?.value;

  const button =
    document.getElementById("registerButton");

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

  const { data, error } =
    await supabaseClient.auth.signUp({
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

  // If Supabase immediately created a session,
  // still require an active subscription.
  if (data?.session) {

    const allowed =
      await checkUserAccess(data.session);

    if (!allowed) {
      return;
    }

    return;
  }

  // Email confirmation may be required
  showAuthMessage(
    "تم إنشاء الحساب بنجاح. إذا كان تأكيد البريد الإلكتروني مفعّلًا، افتح رسالة التأكيد ثم سجل الدخول. بعد تفعيل الاشتراك يمكنك الدخول إلى النظام.",
    "success"
  );
}


// =========================================================
// Logout
// =========================================================

async function logoutUser() {
  await supabaseClient.auth.signOut();

  window.location.replace(
    "index.html"
  );
}


// =========================================================
// Initialize
// =========================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    checkSession();

    // Login
    document
      .getElementById("loginButton")
      ?.addEventListener(
        "click",
        loginUser
      );

    // Register
    document
      .getElementById("registerButton")
      ?.addEventListener(
        "click",
        registerUser
      );

    // Login / Register tabs
    document
      .querySelectorAll("[data-auth-tab]")
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
              .forEach(b =>
                b.classList.toggle(
                  "active",
                  b === btn
                )
              );

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
  }
);
