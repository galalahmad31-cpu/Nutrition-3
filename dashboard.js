import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const SUPABASE_URL = "https://pjcposbbgaqbljrsamax.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_xxZtrsyB46at2eaowuuKhQ_q_1GLHxF"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const basePath = "/Nutrition-3"


// UI
const onboardingCard = document.getElementById("onboarding-card")
const dashboardView = document.getElementById("dashboard-view")

onboardingCard.style.display = "none"
dashboardView.style.display = "none"


// =========================================
// AUTH LISTENER (IMPORTANT FIX)
// =========================================

supabase.auth.onAuthStateChange(async (event, session) => {

  if (!session) {
    window.location.href =
      window.location.origin +
      basePath +
      "/index.html"
    return
  }

  const user = session.user


  // show email
  document.getElementById("user-email").textContent = user.email


  // check membership
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


  // UI decision AFTER DATA READY
  if (memberData) {

    dashboardView.style.display = "block"

    document.getElementById("organization-badge").textContent =
      memberData.organizations.name

  } else {

    onboardingCard.style.display = "block"

  }

})
