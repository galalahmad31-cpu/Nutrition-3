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

  const cache = {
    userId: null,
    role: null
  };

  function clearCache() {
    cache.userId = null;
    cache.role = null;
  }

  async function getCurrentUser() {
    if (window.DietPlannerCoreAuth?.getCurrentUser) {
      return window.DietPlannerCoreAuth.getCurrentUser();
    }

    const client = supabase();
    if (!client) return null;

    const { data, error } = await client.auth.getSession();

    if (error) {
      console.error("Session lookup failed:", error);
      return null;
    }

    return data?.session?.user || null;
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

    if (!error) return data === true;

    console.error("Subscription RPC failed; using read-only fallback:", error);

    const today = new Date().toISOString().slice(0, 10);
    const { data: subscription, error: fallbackError } = await client
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "paid")
      .lte("start_date", today)
      .gte("expiry_date", today)
      .limit(1)
      .maybeSingle();

    if (fallbackError) {
      console.error("Subscription fallback check failed:", fallbackError);
      return null;
    }

    return !!subscription;
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
})();
