/* =========================================================
   Diet Planner — Core / Legacy Access Compatibility
   ---------------------------------------------------------
   Keeps the existing DietPlannerAccess API available while pages are
   migrated gradually to the core modules.

   This file contains no page UI, routing, or duplicated Supabase logic.
   Load order:
     1) core/supabase.js
     2) core/auth.js
     3) core/access.js
     4) core/legacy-access.js
   ========================================================= */

(() => {
  "use strict";

  if (window.DietPlannerAccess) return;

  const Auth = window.DietPlannerCoreAuth;
  const Access = window.DietPlannerCoreAccess;
  const Supabase = window.DietPlannerSupabase;

  if (!Auth || !Access || !Supabase) {
    console.error(
      "Diet Planner Core is not loaded before legacy-access.js."
    );
    return;
  }

  window.DietPlannerAccess = Object.freeze({
    supabaseClient: Supabase.client,
    getCurrentUser: Auth.getCurrentUser,
    getUserRole: Access.getUserRole,
    hasActiveSubscription: Access.hasActiveSubscription,
    canAddPatient: Access.canAddPatient,
    canWrite: Access.canWrite,
    hasFeature: Access.hasFeature,
    getAccessStatus: Access.getAccessStatus,
    logout: Auth.signOut
  });
})();
