/* =========================================================
   Diet Planner — Core / Authentication
   ---------------------------------------------------------
   Authentication primitives only.
   No DOM, page routing, UI messages, or page-specific logic.
   Depends on: core/supabase.js
   ========================================================= */

(() => {
  "use strict";

  if (window.DietPlannerCoreAuth) return;

  const getClient = () => window.DietPlannerSupabase?.client || null;

  async function getSession() {
    const client = getClient();
    if (!client) return null;

    const { data, error } = await client.auth.getSession();

    if (error) {
      console.error("Session lookup failed:", error);
      return null;
    }

    return data?.session || null;
  }

  async function getCurrentUser() {
    const session = await getSession();
    return session?.user || null;
  }

  async function signIn(email, password) {
    const client = getClient();
    if (!client) return { data: null, error: new Error("Supabase client is not available.") };

    return client.auth.signInWithPassword({ email, password });
  }

  async function signUp(email, password, fullName) {
    const client = getClient();
    if (!client) return { data: null, error: new Error("Supabase client is not available.") };

    return client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
  }

  async function signInWithGoogle(redirectTo) {
    const client = getClient();
    if (!client) return { data: null, error: new Error("Supabase client is not available.") };

    return client.auth.signInWithOAuth({
      provider: "google",
      options: redirectTo ? { redirectTo } : undefined
    });
  }

  async function signOut() {
    const client = getClient();
    if (!client) return { error: new Error("Supabase client is not available.") };

    if (window.DietPlannerCoreAccess?.clearCache) {
      window.DietPlannerCoreAccess.clearCache();
    }

    return client.auth.signOut();
  }

  function onAuthStateChange(callback) {
    const client = getClient();
    if (!client) return { data: { subscription: null } };

    return client.auth.onAuthStateChange(callback);
  }

  window.DietPlannerCoreAuth = Object.freeze({
    getSession,
    getCurrentUser,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    onAuthStateChange
  });
})();
