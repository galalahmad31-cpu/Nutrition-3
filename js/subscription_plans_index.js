const access = window.DietPlannerAccess;
const sb = access?.supabaseClient;
let currentUser=null,selectedPlanId=null;
let currentSubscription=null;
const state={plans:[],subscriptions:[]};


let confirmResolver=null;function showConfirmPopup(message,title='تأكيد العملية'){return new Promise(resolve=>{confirmResolver=resolve;document.getElementById('confirmTitle').textContent=title;document.getElementById('confirmMessage').innerHTML=message;document.getElementById('confirmOverlay').style.display='flex';});}function resolveConfirm(value){document.getElementById('confirmOverlay').style.display='none';if(confirmResolver){const r=confirmResolver;confirmResolver=null;r(value);}}
async function logoutUser(){
  const {error}=await sb.auth.signOut();
  if(error){ console.error("Logout error:",error); showToast("تعذر تسجيل الخروج"); return; }
  window.location.replace("index.html");
}

function showToast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)}
function escapeHtml(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}

async function checkUser(){
  if(!access?.supabaseClient){
    console.error('Diet Planner access layer is unavailable.');
    return false;
  }

  currentUser = await access.getCurrentUser?.() || null;

  if(!currentUser){
    window.location.replace('index.html');
    return false;
  }

  const accessStatus = await access.getAccessStatus?.();
  if(accessStatus?.isAdmin === true){
    window.location.replace('app.html');
    return false;
  }

  const isActive = await access.hasActiveSubscription?.(currentUser.id);
  if(isActive === true){
    window.location.replace('app.html');
    return false;
  }

  return true;
}

async function loadPlans(){
  const c=document.getElementById('plans');
  const {data,error}=await sb.from('subscription_plans').select('*').eq('is_active',true).order('price',{ascending:true});
  if(error){
    console.error('subscription_plans load error:',error);
    c.innerHTML='<div class="empty"><i class="fa-solid fa-circle-exclamation"></i><div style="margin-top:8px">تعذر تحميل خطط الاشتراك</div></div>';
    return;
  }

  state.plans=data||[];
  state.subscriptions=[];

  if(currentUser){
    const {data:subs,error:subsError}=await sb
      .from('subscriptions')
      .select('id,user_id,start_date,expiry_date,status,notes,created_at,updated_at,full_name,plan_id,payment_proof_path')
      .eq('user_id',currentUser.id)
      .order('created_at',{ascending:false});

    if(subsError){
      console.error('subscriptions load error:',subsError);
    }else{
      state.subscriptions=subs||[];
    }
  }

  const activeSubscription=getActiveSubscription();
  const pendingSubscription=getPendingSubscription();

  if(!state.plans.length){
    c.innerHTML='<div class="empty">لا توجد خطط اشتراك متاحة حاليًا.</div>';
    return;
  }

  c.innerHTML=state.plans.map(p=>{
    const isActive=activeSubscription && activeSubscription.plan_id===p.id;
    const hasPending=pendingSubscription && pendingSubscription.plan_id===p.id;

    let action='';
    const trialUsed=p.is_free_trial===true && hasUsedFreeTrial();
    if(isActive){
      action=`<button class="btn btn-outline" disabled style="cursor:default;opacity:.9"><i class="fa-solid fa-circle-check"></i> الخطة مفعّلة</button>`;
    }else if(hasPending){
      action=`<button class="btn btn-outline" onclick="openPendingSubscription('${pendingSubscription.id}')"><i class="fa-solid fa-clock"></i> الطلب قيد المراجعة</button>`;
    }else if(trialUsed){
      action=`<button class="btn btn-outline" disabled style="cursor:default;opacity:.75"><i class="fa-solid fa-circle-check"></i> تم استخدام التجربة</button>`;
    }else{
      action=`<button class="btn btn-primary" onclick="subscribeToPlan('${p.id}')">${p.is_free_trial?'ابدأ التجربة':'اشتراك'}</button>`;
    }

    return `
    <div class="card">
      <div class="card-top"><h3>${escapeHtml(p.name)}</h3><span class="badge">اشتراك</span></div>
      <div class="price">${Number(p.price).toLocaleString('ar-EG')} <span style="font-size:13px;font-weight:700">جنيه</span></div>
      <div class="duration"><i class="fa-regular fa-calendar"></i> ${Number(p.duration_days)} يوم</div>
      <div class="method"><strong>طريقة التحويل</strong>${escapeHtml(p.payment_method)}</div>
      ${p.description?`<div class="description">${escapeHtml(p.description)}</div>`:''}
      <div class="card-actions">
       ${action}
      </div>
    </div>`;
  }).join('');
}

function getActiveSubscription(){
  if(!currentUser)return null;
  const today=new Date().toISOString().slice(0,10);
  return state.subscriptions.find(s=>
    s.status==='paid' &&
    s.start_date &&
    s.expiry_date &&
    s.start_date<=today &&
    s.expiry_date>=today
  )||null;
}

function getPendingSubscription(){
  if(!currentUser)return null;
  return state.subscriptions.find(s=>s.status==='pending')||null;
}

function hasUsedFreeTrial(){
  return state.subscriptions.some(s=>{
    const plan=state.plans.find(p=>p.id===s.plan_id);
    return plan?.is_free_trial===true;
  });
}

function setTrialModalMode(isTrial){
  const proofGroup=document.getElementById('paymentProof')?.closest('.form-group');
  const noteGroup=document.getElementById('paymentNote')?.closest('.form-group');
  if(proofGroup)proofGroup.style.display=isTrial?'none':'';
  if(noteGroup)noteGroup.style.display=isTrial?'none':'';
  const button=document.getElementById('submitSubscriptionBtn');
  if(button)button.textContent=isTrial?'بدء التجربة المجانية':'إرسال طلب الاشتراك';
}

function openPendingSubscription(subscriptionId){
  const subscription=state.subscriptions.find(s=>s.id===subscriptionId);
  if(!subscription)return;

  const plan=state.plans.find(p=>p.id===subscription.plan_id);
  currentSubscription=subscription;
  selectedPlanId=subscription.plan_id;

  document.getElementById('selectedPlanInfo').innerHTML=`
    <strong>${escapeHtml(plan?.name||'الخطة')}</strong><br>
    الحالة: <strong>قيد المراجعة</strong><br>
    ${plan?`المدة: ${Number(plan.duration_days)} يوم<br>السعر: ${Number(plan.price).toLocaleString('ar-EG')} جنيه<br>`:''}
    ${subscription.notes?`الملاحظات: ${escapeHtml(subscription.notes)}`:''}
  `;

  document.getElementById('paymentProof').value='';
  document.getElementById('paymentNote').value=subscription.notes||'';
  document.getElementById('submitSubscriptionBtn').style.display='none';
  document.getElementById('pendingActions').style.display='flex';
  document.getElementById('subscribeModal').style.display='flex';
}

function resetSubscriptionModal(){
  document.getElementById('submitSubscriptionBtn').style.display='inline-block';
  document.getElementById('pendingActions').style.display='none';
  document.getElementById('paymentProof').value='';
  document.getElementById('paymentNote').value='';
  setTrialModalMode(false);
}

function closeSubscribeModal(){
  document.getElementById('subscribeModal').style.display='none';
  selectedPlanId=null;
  currentSubscription=null;
  resetSubscriptionModal();
}
async function subscribeToPlan(id){
    resetSubscriptionModal();
    if(!currentUser){
        showToast('من فضلك سجل الدخول أولًا لإرسال الطلب');
        return;
    }

    const plan = state.plans.find(x => x.id === id);
    if(!plan) return;

    if(plan.is_free_trial && hasUsedFreeTrial()){
        showToast('لقد تم استخدام التجربة المجانية لهذا الحساب من قبل');
        return;
    }

    selectedPlanId = id;
    const isTrial=plan.is_free_trial===true;

    document.getElementById('selectedPlanInfo').innerHTML = `
        <strong>${escapeHtml(plan.name)}</strong><br>
        المدة: ${Number(plan.duration_days)} يوم<br>
        السعر: ${Number(plan.price).toLocaleString('ar-EG')} جنيه
        <br>طريقة التحويل: ${escapeHtml(plan.payment_method)}
    `;

    document.getElementById('paymentProof').value = '';
    document.getElementById('paymentNote').value = '';
    document.getElementById('submitSubscriptionBtn').disabled = false;
    setTrialModalMode(isTrial);
    document.getElementById('subscribeModal').style.display = 'flex';
}


async function submitSubscription(){
    if(!currentUser || !selectedPlanId) return;

    const plan = state.plans.find(x => x.id === selectedPlanId);
    if(!plan) return;

    const isTrial=plan.is_free_trial===true;
    const file = document.getElementById('paymentProof').files[0];
    const note = document.getElementById('paymentNote').value.trim();
    const button = document.getElementById('submitSubscriptionBtn');

    if(isTrial){
        if(hasUsedFreeTrial()){
            showToast('لقد تم استخدام التجربة المجانية لهذا الحساب من قبل');
            return;
        }
    }else{
        if(!file){
            showToast('من فضلك أرفق صورة التحويل');
            return;
        }

        if(!file.type.startsWith('image/')){
            showToast('يرجى اختيار صورة صحيحة');
            return;
        }

        if(file.size > 5 * 1024 * 1024){
            showToast('حجم الصورة يجب ألا يتجاوز 5 ميجابايت');
            return;
        }
    }

    button.disabled = true;
    button.textContent = isTrial ? 'جاري بدء التجربة...' : 'جاري إرسال الطلب...';

    let filePath=null;

    if(!isTrial){
        const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
        filePath = `${currentUser.id}/transfer-${Date.now()}.${extension}`;

        const { error: uploadError } = await sb.storage
            .from('subscription-proofs')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if(uploadError){
            console.error('UPLOAD ERROR:', uploadError);
            button.disabled = false;
            button.textContent = 'إرسال طلب الاشتراك';
            showDetailedError('خطأ رفع صورة التحويل', uploadError);
            return;
        }
    }

    const { data: createdSubscription, error: insertError } = await sb.rpc(
        'create_subscription',
        {
            p_plan_id: plan.id,
            p_full_name:
                currentUser.user_metadata?.full_name ||
                currentUser.user_metadata?.name ||
                currentUser.email ||
                null,
            p_notes: isTrial ? null : (note || null),
            p_payment_proof_path: filePath
        }
    );

    if(insertError){
        console.error(insertError);
        if(filePath){
            await sb.storage.from('subscription-proofs').remove([filePath]);
        }
        button.disabled = false;
        button.textContent = isTrial ? 'بدء التجربة المجانية' : 'إرسال طلب الاشتراك';
        showDetailedError(isTrial ? 'تعذر بدء التجربة المجانية' : 'خطأ إنشاء طلب الاشتراك', insertError);
        return;
    }

    closeSubscribeModal();
    button.disabled = false;
    button.textContent = 'إرسال طلب الاشتراك';
    showToast(isTrial ? 'تم بدء التجربة المجانية بنجاح' : 'تم إرسال طلب الاشتراك بنجاح، وسيتم مراجعته وتفعيله يدويًا');
    await loadPlans();
}


async function replacePendingProof(){
  if(!currentSubscription || currentSubscription.status!=='pending'){
    showToast('لا يمكن تعديل إثبات الدفع الآن');
    return;
  }

  const file=document.getElementById('paymentProof').files[0];
  if(!file){
    showToast('اختر صورة الإثبات الجديدة أولًا');
    return;
  }
  if(!file.type.startsWith('image/')){
    showToast('يرجى اختيار صورة صحيحة');
    return;
  }
  if(file.size>5*1024*1024){
    showToast('حجم الصورة يجب ألا يتجاوز 5 ميجابايت');
    return;
  }

  const oldPath=currentSubscription.payment_proof_path;
  const extension=(file.name.split('.').pop()||'jpg').toLowerCase();
  const newPath=`${currentUser.id}/transfer-${Date.now()}.${extension}`;

  try{
    const {error:uploadError}=await sb.storage.from('subscription-proofs').upload(newPath,file,{
      cacheControl:'3600',
      upsert:false
    });
    if(uploadError)throw uploadError;

    const {error:updateError}=await sb.from('subscriptions')
      .update({payment_proof_path:newPath})
      .eq('id',currentSubscription.id)
      .eq('user_id',currentUser.id)
      .eq('status','pending');

    if(updateError){
      await sb.storage.from('subscription-proofs').remove([newPath]);
      throw updateError;
    }

    if(oldPath)await sb.storage.from('subscription-proofs').remove([oldPath]);

    showToast('تم تعديل إثبات الدفع بنجاح');
    closeSubscribeModal();
    await loadPlans();
  }catch(error){
    showDetailedError('تعذر تعديل إثبات الدفع',error);
  }
}

async function cancelPendingSubscription(){
  if(!currentSubscription || currentSubscription.status!=='pending'){
    showToast('لا يمكن إلغاء هذا الطلب');
    return;
  }

  const confirmed=confirm('هل أنت متأكد من إلغاء طلب الاشتراك؟\\nسيتم حذف طلب الاشتراك.');
  if(!confirmed)return;

  const {error}=await sb.from('subscriptions')
    .delete()
    .eq('id',currentSubscription.id)
    .eq('user_id',currentUser.id)
    .eq('status','pending');

  if(error){
    showDetailedError('تعذر إلغاء طلب الاشتراك',error);
    return;
  }

  showToast('تم إلغاء طلب الاشتراك');
  closeSubscribeModal();
  await loadPlans();
}

function showDetailedError(title, error){
    const message = error?.message || error?.error_description || 'خطأ غير معروف';
    const details = error?.details || '';
    const hint = error?.hint || '';
    const code = error?.code || '';

    const html = `
        <div id="errorOverlay" style="position:fixed;inset:0;background:rgba(14,40,37,.58);z-index:1000;display:flex;align-items:center;justify-content:center;padding:18px">
            <div style="width:100%;max-width:560px;background:#fff;border-radius:18px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.25);direction:rtl">
                <h2 style="margin:0 0 14px;font-size:19px;color:#b42318">${escapeHtml(title)}</h2>
                <div style="background:#fff5f5;border:1px solid #f1caca;border-radius:10px;padding:13px;line-height:1.8;font-size:13px;word-break:break-word">
                    <strong>الخطأ:</strong><br>${escapeHtml(message)}
                    ${code ? `<br><br><strong>Code:</strong> ${escapeHtml(code)}` : ''}
                    ${details ? `<br><br><strong>Details:</strong><br>${escapeHtml(details)}` : ''}
                    ${hint ? `<br><br><strong>Hint:</strong><br>${escapeHtml(hint)}` : ''}
                </div>
                <button class="btn btn-primary" style="width:100%;margin-top:15px" onclick="document.getElementById('errorOverlay')?.remove()">إغلاق</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

document.getElementById('subscribeModal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeSubscribeModal()});
document.getElementById('logoutBtn')?.addEventListener('click',logoutUser);
document.addEventListener('DOMContentLoaded',async()=>{if(await checkUser())await loadPlans()});
