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
// BASE PATH (IMPORTANT FOR GITHUB PAGES)
// =========================================

const basePath = "/Nutrition-3"


// =========================================
// CHECK SESSION
// =========================================

const { data: { session } } = await supabase.auth.getSession()

if (session) {
  window.location.href =
    window.location.origin +
    basePath +
    "/dashboard.html"
}


// =========================================
// GOOGLE LOGIN
// =========================================

const googleBtn = document.getElementById("google-login")

googleBtn.addEventListener("click", async () => {

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo:
        window.location.origin +
        "/Nutrition-3/auth-callback.html"
    }
  })

  if (error) {
    console.error(error)
    alert(error.message)
  }

})
