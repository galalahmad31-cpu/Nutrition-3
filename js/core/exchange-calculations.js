/* =========================================================
 * DIET PLANNER CORE — EXCHANGE CALCULATIONS
 * Pure exchange calculations. No DOM, Supabase, auth, or UI logic.
 * ========================================================= */
(function (root) {
  'use strict';

  const GROUPS = Object.freeze([
    { key:'fruit', name:'الفاكهة', manual:true, values:{default:{kcal:60,carb:15,pro:0,fat:0}} },
    { key:'veg', name:'الخضروات غير النشوية', manual:true, values:{default:{kcal:25,carb:5,pro:2,fat:0}} },
    { key:'milk', name:'اللبن والزبادي', manual:true, subgroups:['خالى الدسم','متوسط الدسم','غني الدسم'], values:{
      'خالى الدسم':{kcal:100,carb:12,pro:8,fat:2},
      'متوسط الدسم':{kcal:120,carb:12,pro:8,fat:5},
      'غني الدسم':{kcal:160,carb:12,pro:8,fat:8}
    }},
    { key:'legumes', name:'البقوليات', manual:true, values:{default:{kcal:115,carb:15,pro:7,fat:0}} },
    { key:'starch', name:'النشويات', manual:false, values:{default:{kcal:80,carb:15,pro:2,fat:0}} },
    { key:'meat', name:'اللحوم', manual:false, subgroups:['خالية الدهون','متوسطة الدهون','غنية الدهون'], values:{
      'خالية الدهون':{kcal:45,carb:0,pro:7,fat:3},
      'متوسطة الدهون':{kcal:75,carb:0,pro:7,fat:5},
      'غنية الدهون':{kcal:100,carb:0,pro:7,fat:8}
    }},
    { key:'fat', name:'الدهون', manual:false, values:{default:{kcal:45,carb:0,pro:0,fat:5}} }
  ]);

  function number(value){
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function round(value, digits){
    const d = Number.isInteger(digits) ? digits : 2;
    return Number(number(value).toFixed(d));
  }

  function createState(){
    const exchanges = {};
    GROUPS.forEach(group => {
      exchanges[group.key] = {
        count: 0,
        sub: group.key === 'milk' ? 'خالى الدسم' : group.key === 'meat' ? 'خالية الدهون' : ''
      };
    });
    return {target:{cal:0,pro:0,carb:0,fat:0}, exchanges};
  }

  function group(key){
    return GROUPS.find(item => item.key === key) || null;
  }

  function values(key, state){
    const g = group(key);
    if (!g) return {kcal:0,carb:0,pro:0,fat:0};
    const selected = state?.exchanges?.[key]?.sub;
    return g.values[selected] || g.values.default || Object.values(g.values)[0];
  }

  function manualTotals(state){
    return ['fruit','veg','milk','legumes'].reduce((total,key) => {
      const count = number(state.exchanges[key]?.count);
      const value = values(key,state);
      total.kcal += count * value.kcal;
      total.carb += count * value.carb;
      total.pro += count * value.pro;
      total.fat += count * value.fat;
      return total;
    }, {kcal:0,carb:0,pro:0,fat:0});
  }

  function calculate(state){
    const manual = manualTotals(state);
    state.exchanges.starch.count = Math.max(0, round((number(state.target.carb) - manual.carb) / 15, 2));

    const proteinBeforeMeat = manual.pro + state.exchanges.starch.count * values('starch',state).pro;
    state.exchanges.meat.count = Math.max(0, round((number(state.target.pro) - proteinBeforeMeat) / 7, 2));

    const meat = values('meat',state);
    state.exchanges.fat.count = Math.max(0, round(
      (number(state.target.fat) - manual.fat - state.exchanges.meat.count * meat.fat) / 5,
      2
    ));
    return state;
  }

  function totals(state){
    return GROUPS.reduce((total,g) => {
      const count = number(state.exchanges[g.key]?.count);
      const value = values(g.key,state);
      total.kcal += count * value.kcal;
      total.carb += count * value.carb;
      total.pro += count * value.pro;
      total.fat += count * value.fat;
      return total;
    }, {kcal:0,carb:0,pro:0,fat:0});
  }

  root.DietPlannerExchangeCore = Object.freeze({
    GROUPS,
    number,
    round,
    createState,
    values,
    manualTotals,
    calculate,
    totals
  });
})(window);
