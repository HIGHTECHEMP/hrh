(() => {
  "use strict";
  let students=[];
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const msg=(t,type="")=>{const e=$("#student-message");if(e){e.textContent=t;e.className=`form-message ${type}`.trim();}};
  const levels=["100 Level","200 Level","300 Level","400 Level","500 Level"];
  async function loadSchools(){
    const {data,error}=await hrSupabase.from("schools").select("id,name,code").eq("active",true).order("name");
    if(error){console.warn("Unable to load schools",error);return;}
    $("#invite-school").innerHTML=`<option value="">Select school</option>`+(data||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name||s.code)}</option>`).join("");
  }
  async function generateCode(){
    const full_name=$("#invite-full-name").value.trim(), email=$("#invite-email").value.trim().toLowerCase(), matric_no=$("#invite-matric-no").value.trim(), school_id=$("#invite-school").value||null;
    if(!full_name||!matric_no){msg("Student name and exam number are required.","error");return;}
    const button=$("#generate-registration-code");button.disabled=true;button.textContent="Generating…";msg("Generating secure registration code…");
    try{
      const {data:{session}}=await hrSupabase.auth.getSession();if(!session)throw Error("Your Registry session has expired. Please sign in again.");
      const response=await fetch(`${HR_CONFIG.SUPABASE_URL}/functions/v1/create-student-invite`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`,"apikey":HR_CONFIG.SUPABASE_ANON_KEY},body:JSON.stringify({full_name,email,matric_no,school_id})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||"Unable to create registration code.");
      $("#registration-code-output").hidden=false;$("#registration-code-output").innerHTML=`<div><span class="eyebrow">REGISTRATION CODE</span><strong id="generated-registration-code">${esc(data.registration_code)}</strong><p>Expires ${new Date(data.expires_at).toLocaleString()} · Give this code and the registered email to the student.</p></div><button type="button" class="btn ghost" id="copy-registration-code">Copy code</button>`;
      $("#copy-registration-code").onclick=async()=>{await navigator.clipboard.writeText(data.registration_code);$("#copy-registration-code").textContent="Copied";setTimeout(()=>$("#copy-registration-code").textContent="Copy code",1500);};
      $("#invite-full-name").value="";$("#invite-email").value="";$("#invite-matric-no").value="";$("#invite-school").value="";msg("Registration code created successfully.","success");
    }catch(e){console.error(e);msg(e.message||"Unable to create registration code.","error");}finally{button.disabled=false;button.textContent="Generate registration code";}
  }
  async function load(){
    $("#students-list").innerHTML=`<div class="admin-loading">Loading students…</div>`;
    const {data,error}=await hrSupabase.from("profiles").select("id,full_name,email,matric_no,current_level,active,school_id,schools(name)").eq("role","student").order("full_name");
    if(error){$("#students-list").innerHTML=`<div class="admin-error">${esc(error.message)}</div>`;return;}students=data||[];render();
  }
  function render(){
    const term=$("#student-search").value.trim().toLowerCase(),filter=$("#level-filter").value;
    const list=students.filter(s=>(filter==="ALL"||String(s.current_level||"")===filter)&&(!term||`${s.full_name||""} ${s.matric_no||""} ${s.email||""}`.toLowerCase().includes(term)));
    $("#students-list").innerHTML=list.length?list.map(s=>`<article class="registry-student-card" data-id="${esc(s.id)}"><div><span class="eyebrow">${esc(s.matric_no||"NO EXAM NUMBER")}</span><h3>${esc(s.full_name||"Student")}</h3><p>${esc(s.schools?.name||"School not assigned")} · ${esc(s.email||"")}</p></div><div class="registry-student-level"><label>Current level<select class="student-level">${levels.map(l=>`<option ${s.current_level===l?"selected":""}>${l}</option>`).join("")}<option ${s.current_level==="Graduated"?"selected":""}>Graduated</option></select></label><button class="btn ghost" data-action="set">Set level</button>${s.current_level&&s.current_level!=="Graduated"?`<button class="btn primary" data-action="promote">Promote →</button>`:""}</div></article>`).join(""):`<div class="admin-empty">No students match this filter.</div>`;
  }
  async function setLevel(card){const id=card.dataset.id,level=card.querySelector(".student-level").value;const {error}=await hrSupabase.rpc("set_student_level",{p_student_id:id,p_level:level,p_academic_year:`${new Date().getFullYear()}/${new Date().getFullYear()+1}`});if(error)throw error;msg(`Student level set to ${level}.`,"success");await load();}
  async function promote(card){const id=card.dataset.id;const academicYear=prompt("Academic year for this promotion (e.g. 2026/2027):",`${new Date().getFullYear()}/${new Date().getFullYear()+1}`);if(academicYear===null)return;const {data,error}=await hrSupabase.rpc("promote_student",{p_student_id:id,p_academic_year:academicYear});if(error)throw error;const r=data?.[0];msg(r?`Student promoted: ${r.old_level} → ${r.new_level}.`:"Student promoted.","success");await load();}
  document.addEventListener("click",async e=>{const b=e.target.closest("[data-action]");if(!b)return;const card=b.closest(".registry-student-card");b.disabled=true;try{if(b.dataset.action==="set")await setLevel(card);else await promote(card);}catch(err){console.error(err);msg(err.message||"Unable to update student.","error");}finally{b.disabled=false;}});
  $("#student-search")?.addEventListener("input",render);$("#level-filter")?.addEventListener("change",render);$("#refresh-students")?.addEventListener("click",load);$("#generate-registration-code")?.addEventListener("click",generateCode);
  async function init(){if(!window.hrSupabase)return;try{await loadSchools();await load();}catch(e){console.error(e);msg(e.message,"error");}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
