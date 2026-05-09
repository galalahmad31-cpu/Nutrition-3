import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const SUPABASE_URL = "YOUR_SUPABASE_URL"
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"

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
