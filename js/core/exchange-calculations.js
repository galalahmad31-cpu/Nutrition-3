/* =========================================================
 * EXCHANGE CALCULATIONS
 * Pure calculation layer: no DOM, Supabase, auth or page state.
 * ========================================================= */
(function(){
  'use strict';

  function num(value){
    const n=Number(value);
    return Number.isFinite(n)?n:0;
  }

  function round(value,digits=2){
    return Number(num(value).toFixed(digits));
  }

  function values(group,records){
    const record=records?.[group.k]||{count:0,sub:''};
    if(group.v){
      const selected=group.v[record.sub]||Object.values(group.v)[0];
      return {kcal:selected[0],carb:selected[1],pro:selected[2],fat:selected[3]};
    }
    return {kcal:group.kcal,carb:group.carb,pro:group.pro,fat:group.fat};
  }

  function manual(groups,records){
    return ['fruit','veg','milk','legumes'].reduce((total,key)=>{
      const group=groups.find(item=>item.k===key);
      if(!group)return total;
      const record=records[key]||{count:0};
      const v=values(group,records);
      const count=num(record.count);
      total.carb+=count*v.carb;
      total.pro+=count*v.pro;
      total.fat+=count*v.fat;
      total.kcal+=count*v.kcal;
      return total;
    },{kcal:0,carb:0,pro:0,fat:0});
  }

  function applyTargets(groups,records,target){
    const manualTotals=manual(groups,records);
    records.starch.count=Math.max(0,round((num(target.carb)-manualTotals.carb)/15,2));

    const proteinBeforeMeat=manualTotals.pro+num(records.starch.count)*2;
    const meat=groups.find(group=>group.k==='meat');
    const meatValues=values(meat,records);
    records.meat.count=Math.max(0,round((num(target.pro)-proteinBeforeMeat)/7,2));

    records.fat.count=Math.max(0,round(
      (num(target.fat)-manualTotals.fat-num(records.meat.count)*meatValues.fat)/5,
      2
    ));
  }

  function total(groups,records){
    return groups.reduce((result,group)=>{
      const record=records[group.k]||{count:0};
      const v=values(group,records);
      const count=num(record.count);
      result.kcal+=count*v.kcal;
      result.carb+=count*v.carb;
      result.pro+=count*v.pro;
      result.fat+=count*v.fat;
      return result;
    },{kcal:0,carb:0,pro:0,fat:0});
  }

  window.DietPlannerExchangeCalculations={values,manual,applyTargets,total};
})();
