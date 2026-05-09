import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const SUPABASE_URL = "https://pjcposbbgaqbljrsamax.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_xxZtrsyB46at2eaowuuKhQ_q_1GLHxF"

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)


// =========================================
// GOOGLE LOGIN
// =========================================

const googleBtn = document.getElementById("google-login")

googleBtn.addEventListener("click", async () => {

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "http://127.0.0.1:5500/dashboard.html"
    }
  })

  if(error){
    alert(error.message)
  }

})


// =========================================
// CHECK SESSION
// =========================================

const { data: { session } } = await supabase.auth.getSession()

if(session){
  window.location.href = "/dashboard.html"
}
