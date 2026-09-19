(function () {
  'use strict';

  const access = window.DietPlannerAccess;
  const supabase = access?.supabaseClient;

  const $ = (id) => document.getElementById(id);

  if (!supabase) {
    console.error('DietPlannerAccess is not available.');
    const plansContainer = $('plans');
    if (plansContainer) {
      plansContainer.innerHTML = `
        <div class="empty">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div style="margin-top:8px">تعذر تهيئة الصفحة. يرجى إعادة تحميل الصفحة.</div>
          <button class="btn btn-primary" style="margin-top:14px" data-action="reload">إعادة المحاولة</button>
        </div>`;
    }
    return;
  }

  const SUBSCRIPTION_STATUS = Object.freeze({
    PENDING: 'pending',
    PAID: 'paid',
    CANCELED: 'canceled'
  });

  const state = {
    user: null,
    plans: [],
    subscriptions: [],
    selectedPlanId: null,
    currentSubscription: null,
    subscriptionsLoaded: false,
    subscriptionsError: false,
    confirmResolver: null,
    toastTimer: null,
    authSubscription: null,
    userSyncToken: 0
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char]));
  }

  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function goDashboard() {
    window.location.href = 'app.html';
  }

  function goProfile() {
    window.location.href = 'profile.html';
  }

  function showConfirmPopup(message, title = 'تأكيد العملية') {
    return new Promise((resolve) => {
      state.confirmResolver = resolve;
      $('confirmTitle').textContent = title;
      $('confirmMessage').innerHTML = escapeHtml(message).replace(/\n/g, '<br>');
      $('confirmOverlay').style.display = 'flex';
    });
  }

  function resolveConfirm(value) {
    $('confirmOverlay').style.display = 'none';
    if (!state.confirmResolver) return;
    const resolver = state.confirmResolver;
    state.confirmResolver = null;
    resolver(value);
  }

  function getTodayDateKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getActiveSubscription() {
    if (!state.user || !state.subscriptionsLoaded) return null;

    const today = getTodayDateKey();
    return state.subscriptions.find((subscription) =>
      subscription.status === SUBSCRIPTION_STATUS.PAID &&
      subscription.start_date &&
      subscription.expiry_date &&
      subscription.start_date <= today &&
      subscription.expiry_date >= today
    ) || null;
  }

  function getPendingSubscription() {
    if (!state.user || !state.subscriptionsLoaded) return null;
    return state.subscriptions.find((subscription) => subscription.status === SUBSCRIPTION_STATUS.PENDING) || null;
  }

  function hasUsedFreeTrial() {
    if (!state.user || !state.subscriptionsLoaded) return false;
    return state.subscriptions.some((subscription) => {
      const plan = state.plans.find((item) => item.id === subscription.plan_id);
      return plan?.is_free_trial === true;
    });
  }

  function setTrialModalMode(isTrial) {
    const proofGroup = $('paymentProof')?.closest('.form-group');
    const noteGroup = $('paymentNote')?.closest('.form-group');
    const submitButton = $('submitSubscriptionBtn');

    if (proofGroup) proofGroup.style.display = isTrial ? 'none' : '';
    if (noteGroup) noteGroup.style.display = isTrial ? 'none' : '';
    if (submitButton) {
      submitButton.textContent = isTrial ? 'بدء التجربة المجانية' : 'إرسال طلب الاشتراك';
    }
  }

  function resetSubscriptionModal() {
    $('submitSubscriptionBtn').style.display = 'inline-block';
    $('submitSubscriptionBtn').disabled = false;
    $('pendingActions').style.display = 'none';
    $('paymentProof').value = '';
    $('paymentNote').value = '';
    setTrialModalMode(false);
  }

  function closeSubscribeModal() {
    $('subscribeModal').style.display = 'none';
    state.selectedPlanId = null;
    state.currentSubscription = null;
    resetSubscriptionModal();
  }

  function openPendingSubscription(subscriptionId) {
    const subscription = state.subscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) return;

    const plan = state.plans.find((item) => item.id === subscription.plan_id);
    state.currentSubscription = subscription;
    state.selectedPlanId = subscription.plan_id;

    $('selectedPlanInfo').innerHTML = `
      <strong>${escapeHtml(plan?.name || 'الخطة')}</strong><br>
      الحالة: <strong>قيد المراجعة</strong><br>
      ${plan ? `المدة: ${Number(plan.duration_days)} يوم<br>السعر: ${Number(plan.price).toLocaleString('ar-EG')} جنيه<br>` : ''}
      ${subscription.notes ? `الملاحظات: ${escapeHtml(subscription.notes)}` : ''}
    `;

    $('paymentProof').value = '';
    $('paymentNote').value = subscription.notes || '';
    $('submitSubscriptionBtn').style.display = 'none';
    $('pendingActions').style.display = 'flex';
    $('subscribeModal').style.display = 'flex';
  }

  async function loadPlans(showLoading = false) {
    const container = $('plans');
    if (!container) {
      console.error('subscription_plans: #plans element is not available.');
      return false;
    }

    if (showLoading) {
      container.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i><div class="loading-text">جاري تحميل الخطط…</div></div>';
    }

    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      console.error('subscription_plans load error:', error);
      if (showLoading || !state.plans.length) {
        renderPlansError();
      }
      return false;
    }

    state.plans = Array.isArray(plans) ? plans : [];
    renderPlans();
    return true;
  }

  async function loadUserSubscriptions() {
    const requestedUserId = state.user?.id || null;
    const requestToken = ++state.userSyncToken;

    state.subscriptionsLoaded = false;
    state.subscriptionsError = false;
    state.subscriptions = [];
    renderPlans();

    if (!requestedUserId) {
      if (requestToken !== state.userSyncToken) return false;
      state.subscriptionsLoaded = true;
      renderPlans();
      return true;
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('id,user_id,start_date,expiry_date,status,notes,created_at,updated_at,full_name,plan_id,payment_proof_path')
      .eq('user_id', requestedUserId)
      .order('created_at', { ascending: false });

    if (requestToken !== state.userSyncToken || state.user?.id !== requestedUserId) {
      return false;
    }

    if (error) {
      console.error('subscriptions load error:', error);
      state.subscriptions = [];
      state.subscriptionsError = true;
      renderPlans();
      return false;
    }

    state.subscriptions = Array.isArray(data) ? data : [];
    state.subscriptionsLoaded = true;
    state.subscriptionsError = false;
    renderPlans();
    return true;
  }

  function renderPlansError() {
    const container = $('plans');
    if (!container) return;
    container.innerHTML = `
      <div class="empty">
        <i class="fa-solid fa-circle-exclamation"></i>
        <div class="empty-title">تعذر تحميل خطط الاشتراك</div>
        <div class="empty-text">تحقق من الاتصال ثم حاول مرة أخرى.</div>
        <button class="btn btn-primary retry-btn" data-action="reload-plans">إعادة المحاولة</button>
      </div>`;
  }

  function renderPlans() {
    const container = $('plans');
    const activeSubscription = getActiveSubscription();
    const pendingSubscription = getPendingSubscription();

    if (!state.plans.length) {
      container.innerHTML = '<div class="empty">لا توجد خطط اشتراك متاحة حاليًا.</div>';
      return;
    }

    container.innerHTML = state.plans.map((plan) => {
      const isActive = activeSubscription?.plan_id === plan.id;
      const hasPending = pendingSubscription?.plan_id === plan.id;
      const subscriptionsUnavailable = state.user && (!state.subscriptionsLoaded || state.subscriptionsError);
      const trialUsed = plan.is_free_trial === true && hasUsedFreeTrial();

      let action;
      if (isActive) {
        action = '<button class="btn btn-outline" disabled style="cursor:default;opacity:.9"><i class="fa-solid fa-circle-check"></i> الخطة مفعّلة</button>';
      } else if (hasPending) {
        action = `<button class="btn btn-outline" data-action="open-pending" data-id="${escapeHtml(pendingSubscription.id)}"><i class="fa-solid fa-clock"></i> الطلب قيد المراجعة</button>`;
      } else if (state.user && state.subscriptionsError) {
        action = '<button class="btn btn-outline" data-action="retry-user"><i class="fa-solid fa-rotate"></i> إعادة التحقق</button>';
      } else if (subscriptionsUnavailable) {
        action = '<button class="btn btn-outline" disabled><i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق</button>';
      } else if (trialUsed) {
        action = '<button class="btn btn-outline" disabled><i class="fa-solid fa-circle-check"></i> تم استخدام التجربة</button>';
      } else {
        action = `<button class="btn btn-primary" data-action="subscribe" data-id="${escapeHtml(plan.id)}">${plan.is_free_trial ? 'ابدأ التجربة' : 'اشتراك'}</button>`;
      }

      return `
        <div class="card">
          <div class="card-top"><h3>${escapeHtml(plan.name)}</h3><span class="badge">اشتراك</span></div>
          <div class="price">${Number(plan.price).toLocaleString('ar-EG')} <span style="font-size:13px;font-weight:700">جنيه</span></div>
          <div class="duration"><i class="fa-regular fa-calendar"></i> ${Number(plan.duration_days)} يوم</div>
          <div class="method"><strong>طريقة التحويل</strong>${escapeHtml(plan.payment_method)}</div>
          ${plan.description ? `<div class="description">${escapeHtml(plan.description)}</div>` : ''}
          <div class="card-actions">${action}</div>
        </div>`;
    }).join('');
  }

  function openSubscribeModal(planId) {
    resetSubscriptionModal();

    if (!state.user) {
      showToast('من فضلك سجل الدخول أولًا لإرسال الطلب');
      return;
    }

    if (state.subscriptionsError) {
      showToast('تعذر التحقق من حالة الاشتراك. أعد المحاولة أولًا');
      return;
    }

    if (!state.subscriptionsLoaded) {
      showToast('جاري التحقق من حالة اشتراكك، حاول بعد لحظات');
      return;
    }

    const plan = state.plans.find((item) => item.id === planId);
    if (!plan) return;

    if (plan.is_free_trial && hasUsedFreeTrial()) {
      showToast('لقد تم استخدام التجربة المجانية لهذا الحساب من قبل');
      return;
    }

    state.selectedPlanId = planId;
    const isTrial = plan.is_free_trial === true;

    $('selectedPlanInfo').innerHTML = `
      <strong>${escapeHtml(plan.name)}</strong><br>
      المدة: ${Number(plan.duration_days)} يوم<br>
      السعر: ${Number(plan.price).toLocaleString('ar-EG')} جنيه<br>
      طريقة التحويل: ${escapeHtml(plan.payment_method)}
    `;

    $('paymentProof').value = '';
    $('paymentNote').value = '';
    $('submitSubscriptionBtn').disabled = false;
    setTrialModalMode(isTrial);
    $('subscribeModal').style.display = 'flex';
  }

  async function submitSubscription() {
    if (!state.user || !state.selectedPlanId) return;

    const plan = state.plans.find((item) => item.id === state.selectedPlanId);
    if (!plan) return;

    const isTrial = plan.is_free_trial === true;
    const file = $('paymentProof').files[0];
    const note = $('paymentNote').value.trim();
    const button = $('submitSubscriptionBtn');

    if (isTrial) {
      if (hasUsedFreeTrial()) {
        showToast('لقد تم استخدام التجربة المجانية لهذا الحساب من قبل');
        return;
      }
    } else {
      if (!file) {
        showToast('من فضلك أرفق صورة التحويل');
        return;
      }
      if (!file.type.startsWith('image/')) {
        showToast('يرجى اختيار صورة صحيحة');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('حجم الصورة يجب ألا يتجاوز 5 ميجابايت');
        return;
      }
    }

    button.disabled = true;
    button.textContent = isTrial ? 'جاري بدء التجربة...' : 'جاري إرسال الطلب...';

    let filePath = null;

    try {
      if (!isTrial) {
        const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
        filePath = `${state.user.id}/transfer-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('subscription-proofs')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;
      }

      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: state.user.id,
          full_name: state.user.user_metadata?.full_name || state.user.user_metadata?.name || state.user.email || null,
          plan_id: plan.id,
          status: SUBSCRIPTION_STATUS.PENDING,
          notes: isTrial ? null : (note || null),
          payment_proof_path: filePath
        });

      if (insertError) throw insertError;

      closeSubscribeModal();
      button.disabled = false;
      button.textContent = 'إرسال طلب الاشتراك';
      showToast(isTrial ? 'تم إرسال طلب التجربة المجانية بنجاح' : 'تم إرسال طلب الاشتراك بنجاح، وسيتم مراجعته وتفعيله يدويًا');
      await refreshData(false);
    } catch (error) {
      console.error(error);
      if (filePath) await supabase.storage.from('subscription-proofs').remove([filePath]);
      button.disabled = false;
      button.textContent = isTrial ? 'بدء التجربة المجانية' : 'إرسال طلب الاشتراك';
      showDetailedError(isTrial ? 'تعذر بدء التجربة المجانية' : 'خطأ إنشاء طلب الاشتراك', error);
    }
  }

  async function replacePendingProof() {
    const subscription = state.currentSubscription;
    if (!subscription || subscription.status !== SUBSCRIPTION_STATUS.PENDING) {
      showToast('لا يمكن تعديل إثبات الدفع الآن');
      return;
    }

    const file = $('paymentProof').files[0];
    if (!file) {
      showToast('اختر صورة الإثبات الجديدة أولًا');
      return;
    }
    if (!file.type.startsWith('image/')) {
      showToast('يرجى اختيار صورة صحيحة');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('حجم الصورة يجب ألا يتجاوز 5 ميجابايت');
      return;
    }

    const oldPath = subscription.payment_proof_path;
    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const newPath = `${state.user.id}/transfer-${Date.now()}.${extension}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('subscription-proofs')
        .upload(newPath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const note = $('paymentNote').value.trim();
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ payment_proof_path: newPath, notes: note || null })
        .eq('id', subscription.id)
        .eq('user_id', state.user.id)
        .eq('status', 'pending');

      if (updateError) {
        await supabase.storage.from('subscription-proofs').remove([newPath]);
        throw updateError;
      }

      if (oldPath) await supabase.storage.from('subscription-proofs').remove([oldPath]);

      showToast('تم تعديل إثبات الدفع بنجاح');
      closeSubscribeModal();
      await refreshData(false);
    } catch (error) {
      console.error(error);
      showDetailedError('تعذر تعديل إثبات الدفع', error);
    }
  }

  async function cancelPendingSubscription() {
    const subscription = state.currentSubscription;
    if (!subscription || subscription.status !== SUBSCRIPTION_STATUS.PENDING) {
      showToast('لا يمكن إلغاء هذا الطلب');
      return;
    }

    const confirmed = await showConfirmPopup(
      'هل أنت متأكد من إلغاء طلب الاشتراك؟\nسيتم تغيير حالة الطلب إلى "canceled".'
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from('subscriptions')
      .update({ status: SUBSCRIPTION_STATUS.CANCELED })
      .eq('id', subscription.id)
      .eq('user_id', state.user.id)
      .eq('status', 'pending');

    if (error) {
      showDetailedError('تعذر إلغاء طلب الاشتراك', error);
      return;
    }

    showToast('تم إلغاء طلب الاشتراك');
    closeSubscribeModal();
    await refreshData(false);
  }

  function showDetailedError(title, error) {
    $('errorOverlay')?.remove();

    const message = error?.message || error?.error_description || 'خطأ غير معروف';
    const details = error?.details || '';
    const hint = error?.hint || '';
    const code = error?.code || '';

    document.body.insertAdjacentHTML('beforeend', `
      <div id="errorOverlay" class="error-overlay">
        <div class="error-modal">
          <h2 class="error-title">${escapeHtml(title)}</h2>
          <div class="error-details">
            <strong>الخطأ:</strong><br>${escapeHtml(message)}
            ${code ? `<br><br><strong>Code:</strong> ${escapeHtml(code)}` : ''}
            ${details ? `<br><br><strong>Details:</strong><br>${escapeHtml(details)}` : ''}
            ${hint ? `<br><br><strong>Hint:</strong><br>${escapeHtml(hint)}` : ''}
          </div>
          <button class="btn btn-primary error-close" data-action="close-error">إغلاق</button>
        </div>
      </div>`);
  }

  async function refreshData(showLoading = false) {
    const plansLoaded = await loadPlans(showLoading);
    if (!plansLoaded) return false;
    await loadUserSubscriptions();
    return true;
  }

  async function syncUser(user) {
    const nextUserId = user?.id || null;
    const currentUserId = state.user?.id || null;
    state.user = user || null;
    state.userSyncToken += 1;

    if (nextUserId !== currentUserId) {
      await loadUserSubscriptions();
    } else {
      renderPlans();
    }
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;

      switch (button.dataset.action) {
        case 'dashboard': goDashboard(); break;
        case 'profile': goProfile(); break;
        case 'close-modal': closeSubscribeModal(); break;
        case 'submit-subscription': submitSubscription(); break;
        case 'replace-proof': replacePendingProof(); break;
        case 'cancel-pending': cancelPendingSubscription(); break;
        case 'confirm-no': resolveConfirm(false); break;
        case 'confirm-yes': resolveConfirm(true); break;
        case 'subscribe': openSubscribeModal(button.dataset.id); break;
        case 'open-pending': openPendingSubscription(button.dataset.id); break;
        case 'close-error': $('errorOverlay')?.remove(); break;
        case 'reload': window.location.reload(); break;
        case 'reload-plans': refreshData(true); break;
        case 'retry-user': loadUserSubscriptions(); break;
      }
    });

    $('subscribeModal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeSubscribeModal();
    });

    $('confirmOverlay')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) resolveConfirm(false);
    });
  }

  function bindAuthChanges() {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        syncUser(session?.user || null).catch((error) => {
          console.error('Auth state sync failed:', error);
        });
      }, 0);
    });
    state.authSubscription = data?.subscription || null;
  }

  async function init() {
    bindEvents();
    bindAuthChanges();

    const plansLoaded = await loadPlans(true);
    if (!plansLoaded) return;

    try {
      if (typeof access.getCurrentUser !== 'function') {
        console.error('DietPlannerAccess.getCurrentUser is unavailable.');
        return;
      }
      await syncUser(await access.getCurrentUser());
    } catch (error) {
      console.error('Session lookup failed on subscription plans page:', error);
      state.user = null;
      state.subscriptions = [];
      state.subscriptionsLoaded = true;
      state.subscriptionsError = false;
      renderPlans();
    }
  }

  window.addEventListener('beforeunload', () => {
    try {
      state.authSubscription?.unsubscribe?.();
    } catch (error) {
      console.error('Auth listener cleanup failed:', error);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init().catch((error) => {
        console.error('Subscription plans initialization failed:', error);
        renderPlansError();
      });
    }, { once: true });
  } else {
    init().catch((error) => {
      console.error('Subscription plans initialization failed:', error);
      renderPlansError();
    });
  }
})();
