const access = window.DietPlannerAccess;
const supabase = access?.supabaseClient;
let patients=[];
let currentUser=null;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function renderPatients(){
  const grid=$('patientGrid'), q=($('patientSearch').value||'').trim().toLowerCase();
  const list=patients.filter(p=>!q||String(p.name||'').toLowerCase().includes(q)||String(p.diagnosis||'').toLowerCase().includes(q));
  grid.innerHTML='';
  $('patientEmpty').textContent=q&&!list.length?'لا توجد نتائج مطابقة.':patients.length?'':'لا يوجد مرضى حاليًا.';
  $('patientEmpty').style.display=list.length?'none':'block';
  list.forEach(p=>{
    const card=document.createElement('div');
    card.className='patient-card'; card.dataset.id=p.id;
    card.innerHTML=`<button type="button" class="patient-card-main" data-open="${esc(p.id)}"><div class="pc-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6"></path></svg></div><div><strong>${esc(p.name||'بدون اسم')}</strong><span>${esc(p.diagnosis||'بدون تشخيص')}</span></div></button><div class="patient-card-actions"><button type="button" class="patient-action patient-edit" data-edit="${esc(p.id)}" title="تعديل" aria-label="تعديل"><i class="fa-solid fa-pen"></i><span>تعديل</span></button><button type="button" class="patient-action patient-delete" data-delete="${esc(p.id)}" title="حذف" aria-label="حذف"><i class="fa-solid fa-trash"></i><span>حذف</span></button></div>`;
    grid.appendChild(card);
  });
}

function openPatientModal(patient=null){
  $('patientForm').reset();
  $('patientId').value=patient?.id||'';
  $('patientName').value=patient?.name||'';
  $('patientGender').value=patient?.gender||'';
  $('patientBirthDate').value=patient?.birth_date||'';
  $('patientAge').value=patient?.age??'';
  $('patientHeight').value=patient?.height??'';
  $('patientDiagnosis').value=patient?.diagnosis||'';
  $('patientComplaints').value=patient?.complaints||'';
  $('patientClinicalNotes').value=patient?.clinical_notes||'';
  $('patientModalTitle').textContent=patient?'تعديل بيانات المريض':'إضافة مريض';
  $('patientModalOverlay').classList.add('show');
  $('patientModalOverlay').setAttribute('aria-hidden','false');
  setTimeout(()=>$('patientName').focus(),30);
}
function closePatientModal(){
  $('patientModalOverlay').classList.remove('show');
  $('patientModalOverlay').setAttribute('aria-hidden','true');
}
async function savePatient(e){
  e.preventDefault();
  const user = currentUser || await access?.getCurrentUser();
  if(!user){location.replace('index.html');return;}
  const id=$('patientId').value.trim();
  const payload={
    name:$('patientName').value.trim(),
    gender:$('patientGender').value||null,
    birth_date:$('patientBirthDate').value||null,
    age:$('patientAge').value===''?null:Number($('patientAge').value),
    height:$('patientHeight').value===''?null:Number($('patientHeight').value),
    diagnosis:$('patientDiagnosis').value.trim()||null,
    complaints:$('patientComplaints').value.trim()||null,
    clinical_notes:$('patientClinicalNotes').value.trim()||null,
    updated_at:new Date().toISOString()
  };
  if(!payload.name){alert('من فضلك أدخل اسم المريض.');return;}
  const btn=$('patientSaveBtn'); btn.disabled=true;
  try{
    let data,error;
    if(id){
      ({data,error}=await supabase.from('patients').update(payload).eq('id',id).eq('user_id',user.id).select('id,name,gender,birth_date,age,height,diagnosis,complaints,clinical_notes').single());
    }else{
      ({data,error}=await supabase.from('patients').insert({...payload,user_id:user.id}).select('id,name,gender,birth_date,age,height,diagnosis,complaints,clinical_notes').single());
    }
    if(error)throw error;
    if(id){
      const i=patients.findIndex(p=>p.id===id); if(i>=0)patients[i]=data;
    }else{patients.push(data);}
    patients.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ar'));
    renderPatients(); closePatientModal();
  }catch(err){
    console.error(err);
    alert('تعذر حفظ بيانات المريض: '+(err.message||'تحقق من صلاحيات قاعدة البيانات.'));
  }finally{btn.disabled=false;}
}

function confirmDeletePatient(name){
  return new Promise(resolve=>{
    const overlay=$('patientDeleteConfirm');
    const text=$('patientDeleteText');
    const ok=$('patientDeleteConfirmBtn');
    const cancel=$('patientDeleteCancel');
    text.textContent='هل أنت متأكد من حذف المريض '+name+'؟ سيتم حذف بيانات المريض وأيام الدعم الغذائي المرتبطة به نهائيًا.';
    overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false');
    const close=result=>{overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');ok.removeEventListener('click',onOk);cancel.removeEventListener('click',onCancel);overlay.removeEventListener('click',onOverlay);resolve(result);};
    const onOk=()=>close(true);
    const onCancel=()=>close(false);
    const onOverlay=e=>{if(e.target===overlay)close(false);};
    ok.addEventListener('click',onOk); cancel.addEventListener('click',onCancel); overlay.addEventListener('click',onOverlay);
  });
}

async function deletePatient(id){
  const patient=patients.find(p=>p.id===id); if(!patient)return;
  const confirmed=await confirmDeletePatient(patient.name||'بدون اسم');
  if(!confirmed)return;
  const user = currentUser || await access?.getCurrentUser();
  if(!user){location.replace('index.html');return;}
  try{
    const {error}=await supabase.from('patients').delete().eq('id',id).eq('user_id',user.id);
    if(error)throw error;
    patients=patients.filter(p=>p.id!==id);
    renderPatients();
  }catch(err){
    console.error(err);
    alert('تعذر حذف المريض: '+(err.message||'تحقق من صلاحيات قاعدة البيانات.'));
  }
}

$('patientGrid').addEventListener('click',e=>{
  const open=e.target.closest('[data-open]');
  if(open){location.href='nutritionsupport-patient.html?patient='+encodeURIComponent(open.dataset.open);return;}
  const edit=e.target.closest('[data-edit]');
  if(edit){e.stopPropagation();const p=patients.find(x=>x.id===edit.dataset.edit);if(p)openPatientModal(p);return;}
  const del=e.target.closest('[data-delete]');
  if(del){e.stopPropagation();deletePatient(del.dataset.delete);return;}
});
$('patientSearch').addEventListener('input',renderPatients);
$('addPatientBtn').addEventListener('click',()=>openPatientModal());
$('patientForm').addEventListener('submit',savePatient);
$('patientModalClose').addEventListener('click',closePatientModal);
$('patientCancelBtn').addEventListener('click',closePatientModal);
$('patientModalOverlay').addEventListener('click',e=>{if(e.target===$('patientModalOverlay'))closePatientModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePatientModal();});

async function init(){
  try{
    if(!supabase || !access?.getCurrentUser){location.replace('index.html');return;}
    currentUser = await access.getCurrentUser();
    if(!currentUser){location.replace('index.html');return;}
    const {data,error}=await supabase.from('patients')
      .select('id,name,gender,birth_date,age,height,diagnosis,complaints,clinical_notes')
      .eq('user_id',currentUser.id).order('name');
    if(error) throw error;
    patients=data||[]; renderPatients();
  }catch(e){
    console.error(e); $('patientEmpty').textContent='تعذر تحميل قائمة المرضى'; $('patientEmpty').style.display='block';
  }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
