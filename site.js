import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabase = createClient(
  "https://pjcposbbgaqbljrsamax.supabase.co",
  "sb_publishable_xxZtrsyB46at2eaowuuKhQ_q_1GLHxF"
)

const basePath = "/Nutrition-3"

const content = document.getElementById("content-area")

// NAV ELEMENTS
const homeBtn = document.getElementById("home-btn")
const patientsBtn = document.getElementById("patients-btn")
const referenceBtn = document.getElementById("reference-btn")
const profileBtn = document.getElementById("profile-btn")
const logoutBtn = document.getElementById("logout-btn")


// AUTH CHECK
async function init(){

  const { data: { session } } = await supabase.auth.getSession()

  if(!session){
    window.location.href = "/login.html"
    return
  }

}

init()


// NAVIGATION
homeBtn.onclick = () => {
  content.innerHTML = "Home Dashboard"
}

patientsBtn.onclick = () => {
  content.innerHTML = "Patients Module (Coming next)"
}

referenceBtn.onclick = () => {
  content.innerHTML = "Clinical Nutrition Reference"
}

profileBtn.onclick = () => {
  content.innerHTML = "User Profile"
}

logoutBtn.onclick = async () => {

  await supabase.auth.signOut()

  window.location.href = "/index.html"

}
