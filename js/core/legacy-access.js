/*
 * Diet Planner - Legacy Access Compatibility Layer
 *
 * This file is intentionally small. New code should use js/core/auth.js,
 * js/core/access.js and js/core/supabase.js directly.
 *
 * Existing pages can continue using DietPlannerAccess while migration is
 * performed gradually. No page-specific UI or routing logic belongs here.
 */
(function () {
  'use strict';

  const Access = window.DietPlannerAccessCore;
  const Auth = window.DietPlannerAuth;

  if (!Access || !Auth) {
    console.error('Diet Planner Core is not loaded before legacy-access.js');
    return;
  }

  window.DietPlannerAccess = Object.freeze({
    getCurrentUser: Auth.getCurrentUser,
    getUserRole: Access.getUserRole,
    hasActiveSubscription: Access.hasActiveSubscription,
    canAddPatient: Access.canAddPatient,
    canWrite: Access.canWrite,
    hasFeature: Access.hasFeature,
    getAccessStatus: Access.getAccessStatus,
    signOut: Auth.signOut
  });
})();
