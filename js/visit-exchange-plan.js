/* =========================================================
 * EXCHANGE-BASED DIET PLAN MODULE
 * Page coordinator for the exchange plan UI, persistence and state.
 * Calculations are delegated to js/core/exchange-calculations.js.
 * ========================================================= */

(function(){
const G=[{k:'fruit',n:'الفاكهة',m:1,kcal:60,carb:15,pro:0,fat:0},{k:'veg',n:'الخضروات غير النشوية',m:1,kcal:25,carb:5,pro:2,fat:0},{k:'milk',n:'اللبن والزبادي',m:1,subs:['خالى الدسم','متوسط الدسم','غني الدسم'],v:{'خالى الدسم':[100,12,8,2],'متوسط الدسم':[120,12,8,5],'غني الدسم':[160,12,8,8]}},{k:'legumes',n:'البقوليات',m:1,kcal:115,carb:15,pro:7,fat:0},{k:'starch',n:'النشويات',m:0,kcal:80,carb:15,pro:2,fat:0},{k:'meat',n:'اللحوم',m:0,subs:['خالية الدهون','متوسطة الدهون','غنية الدهون'],v:{'خالية الدهون':[45,0,7,3],'متوسطة الدهون':[75,0,7,5],'غنية الدهون':[100,0,7,8]}},{k:'fat',n:'الدهون',m:0,kcal:45,carb:0,pro:0,fat:5}];
const S={ready:false,plan:null,saved:false,editing:false,t:{cal:0,pro:0,carb:0,fat:0},r:{},days:[],savedDays:[],dayEditing:{},itemContext:null,confirm:null};
G.forEach(g=>S.r[g.k]={count:0,sub:g.k==='milk'?'خالى الدسم':g.k==='meat'?'خالية الدهون':''});
const dbx=window.DietPlannerSupabase?.client;
if(!dbx)console.error('Diet Planner access layer is unavailable to the exchange-plan module.');
const ExchangeCalc=window.DietPlannerExchangeCalculations;
if(!ExchangeCalc)throw new Error('Diet Planner exchange calculations are unavailable.');
const n=v=>Number.isFinite(Number(v))?Number(v):0,rnd=(v,d=2)=>Number(n(v).toFixed(d)),esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v??''));
async function currentExchangeUser(){return await window.DietPlannerCoreAuth?.getCurrentUser?.()||null;}
async function canWriteExchangePlan(){const user=await currentExchangeUser();if(!user)return false;return(await window.DietPlannerCoreAccess?.canWrite?.(user.id))===true}
function ctx(){return window.visitContext||{}}
function status(s,e=false){const x=document.getElementById('exchangePlanStatus');if(x){x.textContent=s;x.className='text-[10px] font-bold '+(e?'text-rose-600':'text-emerald-600')}}
function vals(g){return ExchangeCalc.values(g,S.r)}
function manual(){return ExchangeCalc.manual(G,S.r)}
function calc(){ExchangeCalc.applyTargets(G,S.r,S.t)}
function total(){return ExchangeCalc.total(G,S.r)}
