(() => {
'use strict';
const access=window.DietPlannerAccess;
const sb=access?.supabaseClient;
const state={categories:[],subcategories:[],products:[],formulas:[],category:'',subcategory:'',search:''};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const fmt=v=>v==null||v===''?'—':Number(v).toLocaleString('ar-EG',{maximumFractionDigits:2});
function setState(msg,show=false){$('state').textContent=msg;$('state').style.display=show?'none':'block';$('productsGrid').style.display=show?'grid':'none'}
function option(label,value,selected=false){return '<option value="'+esc(value)+'" '+(selected?'selected':'')+'>'+esc(label)+'</option>'}
function populateCategories(){
 $('categoryFilter').innerHTML=option('كل الأقسام','')+state.categories.map(c=>option(c.name,c.id,c.id===state.category)).join('');
 const subs=state.subcategories.filter(s=>!state.category||s.category_id===state.category);
 if(!subs.some(s=>s.id===state.subcategory))state.subcategory='';
 $('subcategoryFilter').innerHTML=option('كل الأقسام الفرعية','')+subs.map(s=>option(s.name,s.id,s.id===state.subcategory)).join('');
}
function filtered(){
 const q=state.search.toLowerCase();
 return state.products.filter(p=>{
  if(state.subcategory&&p.subcategory_id!==state.subcategory)return false;
  if(state.category){const s=state.subcategories.find(x=>x.id===p.subcategory_id);if(s?.category_id!==state.category)return false}
  if(q&&!([p.product_name,p.usage,p.notes].join(' ').toLowerCase().includes(q)))return false;
  return true;
 });
}
function render(){
 const rows=filtered();$('resultCount').textContent='عرض '+rows.length+' منتج';
 if(!rows.length){setState('لا توجد منتجات مطابقة للتصفية.');return}
 $('productsGrid').innerHTML=rows.map(p=>{
  const sub=state.subcategories.find(s=>s.id===p.subcategory_id);
  const cat=sub&&state.categories.find(c=>c.id===sub.category_id);
  const fs=state.formulas.filter(f=>f.product_id===p.id).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  return '<article class="product-card glass rounded-3xl p-5 shadow-sm">'+
   '<div class="flex items-start justify-between gap-3"><div><div class="text-xs font-bold text-brand-600">'+esc(cat?.name||'غير مصنف')+' · '+esc(sub?.name||'غير مصنف')+'</div><h2 class="mt-1 text-lg font-extrabold text-slate-800">'+esc(p.product_name)+'</h2></div><span class="rounded-xl bg-brand-50 px-2.5 py-1 text-[10px] font-extrabold text-brand-700">'+fs.length+' تركيبة</span></div>'+
   '<div class="mt-4 rounded-2xl bg-slate-50 p-3"><div class="text-xs font-bold text-slate-500">الاستخدام</div><div class="mt-1 text-sm font-semibold leading-6 text-slate-700">'+esc(p.usage||'—')+'</div></div>'+
   fs.map(f=>'<div class="mt-3 rounded-2xl border border-slate-100 bg-white p-3"><div class="flex items-center justify-between gap-2"><div class="text-sm font-extrabold text-slate-800">'+esc(f.formula_name)+'</div><div class="text-[10px] font-bold text-slate-400">'+esc(f.basis_amount?fmt(f.basis_amount)+' '+(f.basis_unit||''): 'أساس غير محدد')+'</div></div><div class="mt-3 grid grid-cols-4 gap-2 text-center"><div><div class="text-[10px] text-slate-400">السعرات</div><div class="mt-1 text-sm font-extrabold text-amber-600">'+fmt(f.kcal)+'</div></div><div><div class="text-[10px] text-slate-400">كارب</div><div class="mt-1 text-sm font-extrabold text-sky-600">'+fmt(f.carb)+'</div></div><div><div class="text-[10px] text-slate-400">بروتين</div><div class="mt-1 text-sm font-extrabold text-emerald-600">'+fmt(f.protein)+'</div></div><div><div class="text-[10px] text-slate-400">دهون</div><div class="mt-1 text-sm font-extrabold text-rose-600">'+fmt(f.fat)+'</div></div></div>'+ (f.notes?'<div class="mt-3 text-[11px] leading-5 text-slate-500">'+esc(f.notes)+'</div>':'')+'</div>').join('')+
   '</article>';
 }).join('');
 setState('',true);
}
async function init(){
 try{
  if(!sb)throw new Error('تعذر الاتصال بقاعدة البيانات');
  const status=await access.getAccessStatus();
  if(!status?.authenticated||!status.user){location.replace('index.html');return}
  if(status.isAdmin===false){
   const ok=await access.hasFeature(status.user.id,'product');
   if(ok!==true){setState('هذه الخدمة غير متاحة في اشتراكك الحالي.');return}
  }
  const [c,s,p,f]=await Promise.all([
   sb.from('product_categories').select('*').eq('is_active',true).order('sort_order'),
   sb.from('product_subcategories').select('*').eq('is_active',true).order('sort_order'),
   sb.from('food_products').select('id,product_name,usage,notes,sort_order,subcategory_id,required_feature').eq('is_active',true).order('sort_order'),
   sb.from('food_product_formulas').select('id,product_id,formula_name,basis_amount,basis_unit,kcal,carb,protein,fat,notes,is_default,is_active,sort_order').eq('is_active',true).order('sort_order')
  ]);
  if(c.error)throw c.error;if(s.error)throw s.error;if(p.error)throw p.error;if(f.error)throw f.error;
  state.categories=c.data||[];state.subcategories=s.data||[];state.products=p.data||[];state.formulas=f.data||[];
  populateCategories();render();
 }catch(e){console.error(e);setState(e.message||'حدث خطأ أثناء تحميل المنتجات.')}
}
$('categoryFilter').onchange=e=>{state.category=e.target.value;state.subcategory='';populateCategories();render()};
$('subcategoryFilter').onchange=e=>{state.subcategory=e.target.value;render()};
$('searchInput').oninput=e=>{state.search=e.target.value.trim();render()};
$('resetBtn').onclick=()=>{state.category='';state.subcategory='';state.search='';$('searchInput').value='';populateCategories();render()};
init();
})();