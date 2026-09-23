/* =========================================================
 * DIET PLANNER — EXCHANGE CALCULATIONS CORE
 * Pure calculation layer. No DOM, Supabase, auth, or page state.
 * ========================================================= */
(function (global) {
  'use strict';

  const GROUPS = Object.freeze([
    { key: 'fruit', name: 'الفاكهة', kcal: 60, carb: 15, protein: 0, fat: 0, manual: true },
    { key: 'veg', name: 'الخضروات غير النشوية', kcal: 25, carb: 5, protein: 2, fat: 0, manual: true },
    { key: 'milk', name: 'اللبن والزبادي', manual: true, variants: {
      'خالى الدسم': [100, 12, 8, 2],
      'متوسط الدسم': [120, 12, 8, 5],
      'غني الدسم': [160, 12, 8, 8]
    }},
    { key: 'legumes', name: 'البقوليات', kcal: 115, carb: 15, protein: 7, fat: 0, manual: true },
    { key: 'starch', name: 'النشويات', kcal: 80, carb: 15, protein: 2, fat: 0 },
    { key: 'meat', name: 'اللحوم', variants: {
      'خالية الدهون': [45, 0, 7, 3],
      'متوسطة الدهون': [75, 0, 7, 5],
      'غنية الدهون': [100, 0, 7, 8]
    }},
    { key: 'fat', name: 'الدهون', kcal: 45, carb: 0, protein: 0, fat: 5 }
  ]);

  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = (value, decimals = 2) => Number(number(value).toFixed(decimals));

  function group(key) {
    return GROUPS.find((item) => item.key === key) || null;
  }

  function values(groupDefinition, subgroup) {
    if (!groupDefinition) return { kcal: 0, carb: 0, protein: 0, fat: 0 };
    if (groupDefinition.variants) {
      const selected = groupDefinition.variants[subgroup] || Object.values(groupDefinition.variants)[0];
      return { kcal: selected[0], carb: selected[1], protein: selected[2], fat: selected[3] };
    }
    return {
      kcal: groupDefinition.kcal,
      carb: groupDefinition.carb,
      protein: groupDefinition.protein,
      fat: groupDefinition.fat
    };
  }

  function totals(exchanges) {
    return GROUPS.reduce((total, definition) => {
      const row = exchanges?.[definition.key] || {};
      const count = number(row.count);
      const value = values(definition, row.sub);
      total.kcal += count * value.kcal;
      total.carb += count * value.carb;
      total.protein += count * value.protein;
      total.fat += count * value.fat;
      return total;
    }, { kcal: 0, carb: 0, protein: 0, fat: 0 });
  }

  function calculateTargets(targets, exchanges) {
    const result = Object.fromEntries(GROUPS.map((definition) => [definition.key, {
      count: number(exchanges?.[definition.key]?.count),
      sub: exchanges?.[definition.key]?.sub || ''
    }]));

    const manualTotals = ['fruit', 'veg', 'milk', 'legumes'].reduce((total, key) => {
      const definition = group(key);
      const row = result[key];
      const value = values(definition, row.sub);
      const count = number(row.count);
      total.carb += count * value.carb;
      total.protein += count * value.protein;
      total.fat += count * value.fat;
      total.kcal += count * value.kcal;
      return total;
    }, { kcal: 0, carb: 0, protein: 0, fat: 0 });

    result.starch.count = Math.max(0, round((number(targets?.carb) - manualTotals.carb) / 15));

    const starchProtein = result.starch.count * 2;
    const meat = group('meat');
    const meatValue = values(meat, result.meat.sub);
    result.meat.count = Math.max(0, round((number(targets?.protein) - manualTotals.protein - starchProtein) / 7));

    result.fat.count = Math.max(0, round(
      (number(targets?.fat) - manualTotals.fat - result.meat.count * meatValue.fat) / 5
    ));

    return result;
  }

  global.DietPlannerExchangeCalculations = Object.freeze({
    GROUPS,
    number,
    round,
    group,
    values,
    totals,
    calculateTargets
  });
})(window);
