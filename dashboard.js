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
// SESSION CHECK
// =========================================

const { data: { session } } = await supabase.auth.getSession()

if (!session) {
  window.location.href =
    window.location.origin +
    basePath +
    "/login.html"
}

const user = session.user


// =========================================
// UI ELEMENTS
// =========================================

const onboardingCard = document.getElementById("onboarding-card")
const dashboardView = document.getElementById("dashboard-view")

const userEmail = document.getElementById("user-email")
const dashboardEmail = document.getElementById("dashboard-email")

const organizationInput = document.getElementById("organization-name")
const createOrganizationBtn = document.getElementById("create-organization-btn")

const organizationBadge = document.getElementById("organization-badge")

const logoutBtn = document.getElementById("logout-btn")
const dashboardLogoutBtn = document.getElementById("dashboard-logout-btn")


// =========================================
// USER INFO
// =========================================

userEmail.textContent = user.email
dashboardEmail.textContent = user.email


// =========================================
// CHECK MEMBERSHIP
// =========================================

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


// =========================================
// IF USER HAS ORGANIZATION
// =========================================

if (memberData) {

  onboardingCard.style.display = "none"
  dashboardView.style.display = "block"

  organizationBadge.textContent =
    "Organization: " + memberData.organizations.name
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

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name,
      created_by: user.id
    })
    .select()
    .single()

  if (orgError) {
    console.error(orgError)
    alert(orgError.message)
    return
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: "admin",
      invited_email: user.email
    })

  if (memberError) {
    console.error(memberError)
    alert(memberError.message)
    return
  }

  alert("Organization created")
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
