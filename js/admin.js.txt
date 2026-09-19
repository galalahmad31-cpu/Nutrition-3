(function(){
'use strict';

const access = window.DietPlannerAccess;
const sb = access?.supabaseClient;

const state={subscriptions:[],plans:new Map()};
let currentUser=null;

const $=id=>document.getElementById(id);
function escapeHtml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function showToast(message){const t=$('toast');t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)}
function formatDate(value){if(!value)return '—';return new Date(value+'T00:00:00').toLocaleDateString('ar-EG',{year:'numeric',month:'2-digit',day:'2-digit'})}
function formatDateTime(value){if(!value)return '—';return new Date(value).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'})}
function statusLabel(status){return status==='paid'?'مفعّلة':status==='canceled'?'ملغاة':'قيد المراجعة'}
function statusIcon(status){return status==='paid'?'fa-circle-check':status==='canceled'?'fa-circle-xmark':'fa-clock'}

async function requireAdmin(){
  if(!sb||!access){
    console.error('DietPlannerAccess is not available.');
    location.replace('index.html');
    return false;
  }

  currentUser=await access.getCurrentUser();
  if(!currentUser){
    location.replace('index.html');
    return false;
  }

  const role=await access.getUserRole(currentUser.id);
  if(role!=='admin'){
    location.replace('index.html');
    return false;
  }

  $('adminContent').style.display='block';
  return true;
}

async function loadData(){
  setTableState('loading','جاري تحميل طلبات الاشتراك...');

  const [plansResult,subsResult]=await Promise.all([
    sb.from('subscription_plans').select('id,name'),
    sb.from('subscriptions').select('id,user_id,start_date,expiry_date,status,notes,created_at,updated_at,full_name,plan_id,payment_proof_path').order('created_at',{ascending:false})
  ]);

  if(plansResult.error){console.error('plans load error:',plansResult.error);showTableError('تعذر تحميل خطط الاشتراك');return}
  if(subsResult.error){console.error('subscriptions load error:',subsResult.error);showTableError('تعذر تحميل طلبات الاشتراك');return}

  state.plans=new Map((plansResult.data||[]).map(plan=>[plan.id,plan.name]));
  state.subscriptions=subsResult.data||[];
  renderSummary();
  renderTable();
}

function setTableState(type,message){
  $('tableWrap').style.display='none';
  const el=$('tableState');el.style.display='block';el.className=type==='error'?'error':type==='empty'?'empty':'loading';el.textContent=message;
}
function showTableError(message){setTableState('error',message)}

function renderSummary(){
  $('totalCount').textContent=state.subscriptions.length;
  $('pendingCount').textContent=state.subscriptions.filter(s=>s.status==='pending').length;
  $('paidCount').textContent=state.subscriptions.filter(s=>s.status==='paid').length;
  $('canceledCount').textContent=state.subscriptions.filter(s=>s.status==='canceled').length;
}

function renderTable(){
  const body=$('subscriptionsBody');
  if(!state.subscriptions.length){setTableState('empty','لا توجد طلبات اشتراك حاليًا.');renderSummary();return}

  body.innerHTML=state.subscriptions.map(subscription=>{
    const planName=state.plans.get(subscription.plan_id)||'خطة غير معروفة';
    const proof=subscription.payment_proof_path
      ? `<button class="proof-btn" data-action="proof" data-id="${escapeHtml(subscription.id)}"><i class="fa-solid fa-image"></i> عرض الصورة</button>`
      : '<span style="color:#9aa9a6;font-size:12px">لا توجد صورة</span>';

    return `<tr>
      <td><span class="doctor">${escapeHtml(subscription.full_name||'بدون اسم')}</span><span class="meta">ID: ${escapeHtml(subscription.user_id)}</span></td>
      <td><span class="plan">${escapeHtml(planName)}</span></td>
      <td class="date">${formatDateTime(subscription.created_at)}</td>
      <td class="date">${formatDate(subscription.start_date)}<br>${formatDate(subscription.expiry_date)}</td>
      <td><span class="status ${escapeHtml(subscription.status)}"><i class="fa-solid ${statusIcon(subscription.status)}"></i>${statusLabel(subscription.status)}</span></td>
      <td>${proof}</td>
      <td><select class="status-select" data-action="status" data-id="${escapeHtml(subscription.id)}" aria-label="تغيير حالة الاشتراك">
        <option value="pending" ${subscription.status==='pending'?'selected':''}>pending</option>
        <option value="paid" ${subscription.status==='paid'?'selected':''}>paid</option>
        <option value="canceled" ${subscription.status==='canceled'?'selected':''}>canceled</option>
      </select></td>
      <td><span class="note" title="${escapeHtml(subscription.notes||'')}">${escapeHtml(subscription.notes||'—')}</span></td>
    </tr>`;
  }).join('');

  $('tableState').style.display='none';
  $('tableWrap').style.display='block';
}

async function changeStatus(id,newStatus,select){
  const subscription=state.subscriptions.find(s=>s.id===id);
  if(!subscription||subscription.status===newStatus)return;

  const oldStatus=subscription.status;
  select.disabled=true;

  const {data,error}=await sb.from('subscriptions').update({status:newStatus}).eq('id',id);

  if(error){
    console.error('subscription status update error:',error);
    select.value=oldStatus;
    select.disabled=false;
    showToast(error.message||'تعذر تحديث حالة الاشتراك');
    return;
  }

  subscription.status=newStatus;
  if(newStatus==='paid'){
    // The database trigger is responsible for start_date/expiry_date.
    await loadData();
  }else{
    subscription.start_date=null;
    subscription.expiry_date=null;
    renderSummary();
    renderTable();
  }
  showToast('تم تحديث حالة الاشتراك بنجاح');
}

async function openProof(id){
  const subscription=state.subscriptions.find(s=>s.id===id);
  if(!subscription?.payment_proof_path)return;

  $('proofDetails').innerHTML=`
    <div class="detail"><span>الطبيب</span>${escapeHtml(subscription.full_name||'بدون اسم')}</div>
    <div class="detail"><span>الخطة</span>${escapeHtml(state.plans.get(subscription.plan_id)||'خطة غير معروفة')}</div>
  `;
  $('proofContent').textContent='جاري تحميل الصورة...';
  $('proofModal').style.display='flex';

  const {data,error}=await sb.storage.from('subscription-proofs').createSignedUrl(subscription.payment_proof_path,300);
  if(error||!data?.signedUrl){
    console.error('proof signed URL error:',error);
    $('proofContent').innerHTML='<div style="padding:25px;color:#b42318">تعذر عرض صورة إثبات الدفع. تأكد من صلاحيات Storage.</div>';
    return;
  }

  $('proofContent').innerHTML=`<img class="proof-image" src="${escapeHtml(data.signedUrl)}" alt="إثبات الدفع">`;
}

function closeProof(){$('proofModal').style.display='none';$('proofContent').textContent='';$('proofDetails').innerHTML=''}

$('subscriptionsBody').addEventListener('change',event=>{
  const select=event.target.closest('[data-action="status"]');
  if(!select)return;
  changeStatus(select.dataset.id,select.value,select);
});
$('subscriptionsBody').addEventListener('click',event=>{
  const button=event.target.closest('[data-action="proof"]');
  if(button)openProof(button.dataset.id);
});
$('refreshBtn').addEventListener('click',loadData);
$('dashboardBtn').addEventListener('click',()=>location.href='app.html');
$('logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();location.replace('index.html')});
$('closeProofBtn').addEventListener('click',closeProof);
$('proofModal').addEventListener('click',event=>{if(event.target===event.currentTarget)closeProof()});

async function init(){
  try{
    if(await requireAdmin()) await loadData();
  }catch(error){
    console.error('Admin initialization error:',error);
    showTableError(error?.message||'تعذر تحميل إدارة الاشتراكات');
  }
}

init();
})();
