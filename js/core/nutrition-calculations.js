/* =========================================================
   Diet Planner — Core / Nutrition Calculations
   ---------------------------------------------------------
   Shared, deterministic clinical nutrition calculations.
   No DOM, Supabase, authentication, routing, or page logic.
   ========================================================= */

(() => {
  "use strict";

  if (window.DietPlannerNutritionCalculations) return;

  function mifflinStJeor({ gender, age, weightKg, heightCm }) {
    if (![age, weightKg, heightCm].every(Number.isFinite) || age < 0 || weightKg <= 0 || heightCm <= 0) {
      return null;
    }

    const sexConstant = gender === "male" ? 5 : -161;
    return (10 * weightKg) + (6.25 * heightCm) - (5 * age) + sexConstant;
  }

  // Schofield 1985 / FAO-WHO-UNU equations; kcal/day from body weight.
  function schofieldBMR(gender, age, weightKg) {
    if (!Number.isFinite(age) || age < 0 || !Number.isFinite(weightKg) || weightKg <= 0) {
      return null;
    }

    let bmr;
    let group;

    if (age < 3) {
      if (gender === "male") {
        bmr = 59.512 * weightKg - 30.4;
        group = "<3 سنوات — ذكر";
      } else {
        bmr = 58.317 * weightKg - 31.1;
        group = "<3 سنوات — أنثى";
      }
    } else if (age < 10) {
      if (gender === "male") {
        bmr = 22.706 * weightKg + 504.3;
        group = "3–10 سنوات — ذكر";
      } else {
        bmr = 20.315 * weightKg + 485.9;
        group = "3–10 سنوات — أنثى";
      }
    } else if (age < 18) {
      if (gender === "male") {
        bmr = 17.686 * weightKg + 658.2;
        group = "10–18 سنة — ذكر";
      } else {
        bmr = 13.384 * weightKg + 692.6;
        group = "10–18 سنة — أنثى";
      }
    } else if (age < 30) {
      if (gender === "male") {
        bmr = 15.057 * weightKg + 692.2;
        group = "18–30 سنة — ذكر";
      } else {
        bmr = 14.818 * weightKg + 486.6;
        group = "18–30 سنة — أنثى";
      }
    } else if (age < 60) {
      if (gender === "male") {
        bmr = 11.472 * weightKg + 873.1;
        group = "30–60 سنة — ذكر";
      } else {
        bmr = 8.126 * weightKg + 845.6;
        group = "30–60 سنة — أنثى";
      }
    } else {
      if (gender === "male") {
        bmr = 11.711 * weightKg + 587.7;
        group = "≥60 سنة — ذكر";
      } else {
        bmr = 9.082 * weightKg + 658.5;
        group = "≥60 سنة — أنثى";
      }
    }

    return { bmr, group };
  }

  function tdeeFromBmr(bmr, activityFactor) {
    if (!Number.isFinite(bmr) || bmr <= 0 || !Number.isFinite(activityFactor) || activityFactor <= 0) {
      return null;
    }
    return Math.round(bmr * activityFactor);
  }

  function macroGrams(targetCalories, proteinPercent, carbPercent, fatPercent) {
    if (!Number.isFinite(targetCalories) || targetCalories <= 0) return null;

    const p = Number(proteinPercent) || 0;
    const c = Number(carbPercent) || 0;
    const f = Number(fatPercent) || 0;

    if (Math.abs((p + c + f) - 100) > 0.001) return null;

    return {
      protein: Math.round((targetCalories * p / 100) / 4),
      carb: Math.round((targetCalories * c / 100) / 4),
      fat: Math.round((targetCalories * f / 100) / 9)
    };
  }

  function macroPercentFromGrams(targetCalories, grams, kcalPerGram) {
    if (!Number.isFinite(targetCalories) || targetCalories <= 0 || !Number.isFinite(grams) || grams < 0) {
      return null;
    }
    return Math.round((grams * kcalPerGram / targetCalories) * 100);
  }

  window.DietPlannerNutritionCalculations = Object.freeze({
    mifflinStJeor,
    schofieldBMR,
    tdeeFromBmr,
    macroGrams,
    macroPercentFromGrams
  });
})();
