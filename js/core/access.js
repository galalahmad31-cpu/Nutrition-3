/* =========================================================
   Diet Planner — Core / Access
   ---------------------------------------------------------
   Shared access primitives only.
   No page routing, login UI, DOM manipulation, or page-specific logic.
   ---------------------------------------------------------
   Depends on: core/supabase.js + core/auth.js
   ========================================================= */

(() => {
  "use strict";

  if (window.DietPlannerCoreAccess) return;

  const supabase = () => window.DietPlannerSupabase?.client || null;
  const Auth = () => window.DietPlannerCoreAuth || null;

  const cache = {
    userId: null,
    role: null
  };

  function clearCache() {
    cache.userId = null;
    cache.role = null;
  }

  async function getCurrentUser() {
    const auth = Auth();
    if (!auth?.getCurrentUser) {
      console.error("Diet Planner Core Auth is not loaded.");
      return null;
    }

    return auth.getCurrentUser();
  }

  async function getUserRole(userId) {
    const client = supabase();
    if (!client || !userId) return null;

    if (cache.userId === userId && cache.role !== null) {
      return cache.role;
    }

    const { data, error } = await client
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Role check failed:", error);
      return null;
    }

    const role = data?.role || "user";
    cache.userId = userId;
    cache.role = role;

    return role;
  }

  async function hasActiveSubscription(userId) {
    const client = supabase();
    if (!client || !userId) return null;

    const role = await getUserRole(userId);
    if (role === "admin") return true;

    const { data, error } = await client.rpc(
      "has_active_subscription",
      { p_user_id: userId }
    );

    if (error) {
      console.error("Subscription RPC failed:", error);
      return null;
    }

    return data === true;
  }

  async function canAddPatient(userId) {
    const client = supabase();
    if (!client || !userId) return false;

    const { data, error } = await client.rpc(
      "can_add_patient",
      { p_user_id: userId }
    );

    if (error) {
      console.error("Patient quota check failed:", error);
      return false;
    }

    return data === true;
  }

  async function canWrite(userId) {
    if (!userId) return false;
    return (await hasActiveSubscription(userId)) === true;
  }

  async function hasFeature(userId, featureKey) {
    const client = supabase();
    if (!client || !userId || !featureKey) return false;

    const { data, error } = await client.rpc("has_feature", {
      p_user_id: userId,
      p_feature: featureKey
    });

    if (error) {
      console.error(`Feature check failed (${featureKey}):`, error);
      return false;
    }

    return data === true;
  }

  async function getAccessStatus() {
    const user = await getCurrentUser();

    if (!user) {
      return {
        authenticated: false,
        user: null,
        role: null,
        isAdmin: false
      };
    }

    const role = await getUserRole(user.id);

    return {
      authenticated: true,
      user,
      role,
      isAdmin: role === "admin"
    };
  }

  window.DietPlannerCoreAccess = Object.freeze({
    clearCache,
    getCurrentUser,
    getUserRole,
    hasActiveSubscription,
    canAddPatient,
    canWrite,
    hasFeature,
    getAccessStatus
  });

  // Access owns its cache, so it also owns cache invalidation.
  // This keeps Authentication independent from Access.
  const auth = Auth();
  if (auth?.onAuthStateChange) {
    auth.onAuthStateChange(() => {
      clearCache();
    });
  }
})();
