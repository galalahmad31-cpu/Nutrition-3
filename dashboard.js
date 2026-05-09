import { createClient }
from 'https://esm.sh/@supabase/supabase-js'


// =====================================
// SUPABASE
// =====================================

const SUPABASE_URL =
"https://pjcposbbgaqbljrsamax.supabase.co"

const SUPABASE_ANON_KEY =
"sb_publishable_xxZtrsyB46at2eaowuuKhQ_q_1GLHxF"

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)

const basePath = "/Nutrition-3"


// =====================================
// UI
// =====================================

const onboardingCard =
document.getElementById("onboarding-card")

const dashboardView =
document.getElementById("dashboard-view")

const organizationInput =
document.getElementById("organization-name")

const createOrganizationBtn =
document.getElementById("create-organization-btn")

const logoutBtn =
document.getElementById("logout-btn")

const dashboardLogoutBtn =
document.getElementById("dashboard-logout-btn")

const organizationBadge =
document.getElementById("organization-badge")

const userEmail =
document.getElementById("user-email")

const inviteBtn =
document.getElementById("invite-btn")

const inviteEmail =
document.getElementById("invite-email")

const membersList =
document.getElementById("members-list")


// =====================================
// INIT
// =====================================

let currentUser = null
let currentOrganization = null

init()

async function init(){

  const {
    data: { session }
  } = await supabase.auth.getSession()

  if(!session){

    window.location.href =
      window.location.origin +
      basePath +
      "/index.html"

    return
  }

  currentUser = session.user

  userEmail.textContent =
    currentUser.email

  await loadDashboard()

}


// =====================================
// LOAD DASHBOARD
// =====================================

async function loadDashboard(){

  const { data: membership } =
  await supabase
    .from("organization_members")
    .select(`
      role,
      organization_id,
      organizations (
        id,
        name
      )
    `)
    .eq("user_id", currentUser.id)
    .single()


  onboardingCard.style.display = "none"
  dashboardView.style.display = "none"


  if(!membership){

    onboardingCard.style.display = "block"
    return
  }

  currentOrganization =
    membership.organizations

  dashboardView.style.display = "block"

  organizationBadge.textContent =
    currentOrganization.name

  await loadMembers()

}


// =====================================
// CREATE ORGANIZATION
// =====================================

createOrganizationBtn.addEventListener(
  "click",
  async () => {

    const name =
    organizationInput.value.trim()

    if(!name){
      alert("Enter organization name")
      return
    }

    // create org
    const { data: organization, error } =
    await supabase
      .from("organizations")
      .insert({
        name,
        created_by: currentUser.id
      })
      .select()
      .single()

    if(error){
      alert(error.message)
      return
    }

    // create membership
    await supabase
      .from("organization_members")
      .insert({
        organization_id: organization.id,
        user_id: currentUser.id,
        invited_email: currentUser.email,
        role: "admin"
      })

    await loadDashboard()

})


// =====================================
// INVITE MEMBER
// =====================================

inviteBtn.addEventListener(
  "click",
  async () => {

    const email =
    inviteEmail.value.trim()

    if(!email){
      alert("Enter email")
      return
    }

    const { error } =
    await supabase
      .from("organization_invites")
      .insert({
        organization_id:
          currentOrganization.id,

        invited_email: email,

        invited_by:
          currentUser.id
      })

    if(error){
      alert(error.message)
      return
    }

    alert("Invitation sent")

    inviteEmail.value = ""

})


// =====================================
// LOAD MEMBERS
// =====================================

async function loadMembers(){

  membersList.innerHTML = ""

  const { data: members } =
  await supabase
    .from("organization_members")
    .select(`
      invited_email,
      role
    `)
    .eq(
      "organization_id",
      currentOrganization.id
    )


  members.forEach(member => {

    const div =
    document.createElement("div")

    div.style.padding = "10px 0"

    div.innerHTML = `
      <strong>${member.invited_email}</strong>
      <br>
      <small>${member.role}</small>
    `

    membersList.appendChild(div)

  })

}


// =====================================
// LOGOUT
// =====================================

async function logout(){

  await supabase.auth.signOut()

  window.location.href =
    window.location.origin +
    basePath +
    "/index.html"

}

logoutBtn.addEventListener(
  "click",
  logout
)

dashboardLogoutBtn.addEventListener(
  "click",
  logout
)
