import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const SUPABASE_URL = "https://pjcposbbgaqbljrsamax.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_xxZtrsyB46at2eaowuuKhQ_q_1GLHxF"

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)


// =========================================
// CHECK SESSION
// =========================================

const {
  data: { session }
} = await supabase.auth.getSession()

if (!session) {
  window.location.href = "/login.html"
}

const user = session.user


// =========================================
// UI ELEMENTS
// =========================================

const onboardingCard = document.getElementById("onboarding-card")
const dashboardView = document.getElementById("dashboard-view")

const userEmail = document.getElementById("user-email")
const dashboardEmail = document.getElementById("dashboard-email")

const createOrganizationBtn = document.getElementById("create-organization-btn")
const logoutBtn = document.getElementById("logout-btn")
const dashboardLogoutBtn = document.getElementById("dashboard-logout-btn")

const organizationInput = document.getElementById("organization-name")
const organizationBadge = document.getElementById("organization-badge")


// =========================================
// USER EMAIL
// =========================================

userEmail.textContent = user.email

dashboardEmail.textContent = user.email


// =========================================
// CHECK MEMBERSHIP
// =========================================

const { data: memberData, error: memberError } = await supabase
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

  organizationBadge.textContent = `Organization: ${memberData.organizations.name}`

}


// =========================================
// CREATE ORGANIZATION
// =========================================

createOrganizationBtn.addEventListener("click", async () => {

  const organizationName = organizationInput.value.trim()

  if (!organizationName) {
    alert("Please enter organization name")
    return
  }


  // CREATE ORGANIZATION

  const { data: organizationData, error: organizationError } = await supabase
    .from("organizations")
    .insert({
      name: organizationName,
      created_by: user.id
    })
    .select()
    .single()


  if (organizationError) {
    console.error(organizationError)
    alert(organizationError.message)
    return
  }


  // ADD MEMBER

  const { error: memberInsertError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organizationData.id,
      user_id: user.id,
      role: "admin",
      invited_email: user.email
    })


  if (memberInsertError) {
    console.error(memberInsertError)
    alert(memberInsertError.message)
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

  window.location.href = "/login.html"

}

logoutBtn.addEventListener("click", logout)
dashboardLogoutBtn.addEventListener("click", logout)
