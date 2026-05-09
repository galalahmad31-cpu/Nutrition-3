import { createClient } from 'https://esm.sh/@supabase/supabase-js'


// =========================================
// SUPABASE CONFIG
// =========================================

const SUPABASE_URL = "https://pjcposbbgaqbljrsamax.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_xxZtrsyB46at2eaowuuKhQ_q_1GLHxF"

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)


// =========================================
// BASE PATH
// =========================================

const basePath = "/Nutrition-3"


// =========================================
// UI ELEMENTS
// =========================================

const onboardingCard = document.getElementById("onboarding-card")
const dashboardView = document.getElementById("dashboard-view")

const organizationInput = document.getElementById("organization-name")
const createOrganizationBtn = document.getElementById("create-organization-btn")

const logoutBtn = document.getElementById("logout-btn")
const dashboardLogoutBtn = document.getElementById("dashboard-logout-btn")

const organizationBadge = document.getElementById("organization-badge")
const userEmail = document.getElementById("user-email")


// =========================================
// INIT
// =========================================

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


// =========================================
// LOAD DASHBOARD
// =========================================

async function loadDashboard(user) {

  userEmail.textContent = user.email

  const { data: memberData } = await supabase
    .from("organization_members")
    .select(`
      id,
      role,
      organizations (
        id,
        name
      )
    `)
    .eq("user_id", user.id)
    .single()


  onboardingCard.style.display = "none"
  dashboardView.style.display = "none"


  if (memberData) {

    dashboardView.style.display = "block"

    organizationBadge.textContent =
      "Organization: " + memberData.organizations.name

  } else {

    onboardingCard.style.display = "block"

  }
}


// =========================================
// CREATE ORGANIZATION
// =========================================

createOrganizationBtn.addEventListener("click", async () => {

  const name = organizationInput.value.trim()

  if (!name) {
    alert("Enter organization name")
    return
  }


  const {
    data: { session }
  } = await supabase.auth.getSession()


  const user = session.user


  // CREATE ORGANIZATION
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .insert({
      name,
      created_by: user.id
    })
    .select()
    .single()


  if (organizationError) {
    console.error(organizationError)
    alert(organizationError.message)
    return
  }


  // CREATE MEMBERSHIP
  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organization.id,
      user_id: user.id,
      role: "admin",
      invited_email: user.email
    })


  if (memberError) {
    console.error(memberError)
    alert(memberError.message)
    return
  }


  alert("Organization created successfully")

  window.location.reload()

})


// =========================================
// LOGOUT
// =========================================

async function logout() {

  await supabase.auth.signOut()

  window.location.href =
    window.location.origin +
    basePath +
    "/index.html"
}

logoutBtn.addEventListener("click", logout)
dashboardLogoutBtn.addEventListener("click", logout)


// =========================================
// AUTH LISTENER
// =========================================

supabase.auth.onAuthStateChange((event) => {

  if (event === "SIGNED_OUT") {

    window.location.href =
      window.location.origin +
      basePath +
      "/index.html"
  }

})


// =========================================
// START APP
// =========================================

init()
