/* =========================================================
   Diet Planner — Core / Supabase
   ---------------------------------------------------------
   Single Supabase client for the application core.
   This file contains no page logic, auth UI, routing, or DOM code.
   ========================================================= */

(() => {
  "use strict";

  if (window.DietPlannerSupabase) return;

  const SUPABASE_URL = "https://zwxnmnfoknfbzvptnpmv.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_A6u5kWAdL60bYpz1wRyv6w_J2p896iY";

  if (!window.supabase) {
    console.error("Supabase JS library is not loaded.");
    return;
  }

  const client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  window.DietPlannerSupabase = Object.freeze({
    client
  });
})();
