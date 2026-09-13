// =========================================================
// Diet Planner — Supabase Authentication
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
  box.className = "auth-message " + type;
  box.style.display = "block";
}

function setBusy(button, busy, text) {
  if (!button) return;

  button.disabled = busy;
  button.textContent = busy
    ? "جاري التنفيذ..."
    : text;
}

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();

  if (data?.session) {
    window.location.replace("app.html");
  }
}

async function loginUser() {
  const email = document
    .getElementById("loginEmail")
    ?.value.trim();

  const password = document
    .getElementById("loginPassword")
    ?.value;

  const button = document.getElementById("loginButton");

  if (!email || !password) {
    showAuthMessage(
      "من فضلك أدخل البريد الإلكتروني وكلمة المرور."
    );
    return;
  }

  setBusy(button, true, "تسجيل الدخول");

  const { error } =
    await supabaseClient.auth.signInWithPassword({
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

  window.location.replace("app.html");
}

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

  setBusy(button, true, "إنشاء الحساب");

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

  setBusy(button, false, "إنشاء الحساب");

  if (error) {
    showAuthMessage(error.message);
    return;
  }

  if (data?.session) {
    window.location.replace("app.html");
  } else {
    showAuthMessage(
      "تم إنشاء الحساب. إذا كان تأكيد البريد الإلكتروني مفعّلًا، افتح رسالة التأكيد ثم سجل الدخول.",
      "success"
    );
  }
}

async function logoutUser() {
  await supabaseClient.auth.signOut();

  window.location.replace("index.html");
}

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
