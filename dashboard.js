import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabase = createClient(
  "https://pjcposbbgaqbljrsamax.supabase.co",
  "sb_publishable_xxZtrsyB46at2eaowuuKhQ_q_1GLHxF"
)

const basePath = "/Nutrition-3"


// ===============================
// UI ELEMENTS
// ===============================
const onboardingCard = document.getElementById("onboarding-card")
const dashboardView = document.getElementById("dashboard-view")

// 👇 مهم: سيبهم ظاهرين لحد ما نتحقق
onboardingCard.style.display = "none"
dashboardView.style.display = "none"


// ===============================
// LOAD USER
// ===============================
async function init() {

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    window.location.href =
      window.location.origin +
      basePath +
      "/index.html"
    return
  }

  await loadDashboard(session.user)
}


// ===============================
// LISTEN AUTH CHANGES
// ===============================
supabase.auth.onAuthStateChange((event, session) => {

  if (event === "SIGNED_OUT") {
    window.location.href =
      window.location.origin +
      basePath +
      "/login.html"
  }

  if (event === "SIGNED_IN" && session) {
    loadDashboard(session.user)
  }

})


// ===============================
// LOAD DASHBOARD DATA
// ===============================
async function loadDashboard(user) {

  document.getElementById("user-email").textContent = user.email

  const { data: memberData } = await supabase
    .from("organization_members")
    .select(`
      organizations (
        name
      )
    `)
    .eq("user_id", user.id)
    .single()

  // reset UI
  onboardingCard.style.display = "none"
  dashboardView.style.display = "none"

  if (memberData) {

    dashboardView.style.display = "block"

    document.getElementById("organization-badge").textContent =
      memberData.organizations.name

  } else {

    onboardingCard.style.display = "block"

  }
}


// ===============================
// START APP
// ===============================
init()
