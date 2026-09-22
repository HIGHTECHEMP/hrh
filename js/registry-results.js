(() => {
    "use strict";
    let rows=[];
    const $=s=>document.querySelector(s);
    const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    const msg=(t,type="")=>{const e=$("#registry-result-message");if(e){e.textContent=t;e.className=`form-message ${type}`.trim();}};
    async function load(){
        const list=$("#registry-results-list"); list.innerHTML=`<div class="admin-loading">Loading results…</div>`;
        const status=$("#status-filter").value;
        let q=hrSupabase.from("results").select("id,student_id,course_id,semester,examination,academic_year,ca_score,exam_score,total_score,grade,gp,gpa,cgpa,status,submitted_by,reviewed_by,published_at,updated_at").order("updated_at",{ascending:false});
        if(status!=="ALL")q=q.eq("status",status);
        const {data,error}=await q;
        if(error){list.innerHTML=`<div class="admin-error">${esc(error.message)}</div>`;return;}
        const resultRows=data||[];
        const studentIds=[...new Set(resultRows.map(r=>r.student_id).filter(Boolean))], courseIds=[...new Set(resultRows.map(r=>r.course_id).filter(Boolean))];
        const [sr,cr]=await Promise.all([
            studentIds.length?hrSupabase.from("profiles").select("id,full_name,matric_no,current_level,school_id").in("id",studentIds):{data:[]},
            courseIds.length?hrSupabase.from("courses").select("id,code,name,level,semester").in("id",courseIds):{data:[]}
        ]);
        if(sr.error)throw sr.error;if(cr.error)throw cr.error;
        const students=Object.fromEntries((sr.data||[]).map(x=>[x.id,x])),courses=Object.fromEntries((cr.data||[]).map(x=>[x.id,x]));
        rows=resultRows.map(r=>({...r,student:students[r.student_id]||{},course:courses[r.course_id]||{}})); render();
    }
    function render(){
        const term=$("#result-search").value.trim().toLowerCase(); const list=$("#registry-results-list");
        const filtered=rows.filter(r=>{if(!term)return true;const hay=[r.student.full_name,r.student.matric_no,r.course.code,r.course.name,r.examination,r.academic_year].join(" ").toLowerCase();return hay.includes(term);});
        if(!filtered.length){list.innerHTML=`<div class="admin-empty">No results match the current filter.</div>`;return;}
        list.innerHTML=filtered.map(r=>{const action=r.status==="submitted"?`<button class="btn primary" data-action="approve" data-id="${esc(r.id)}">Approve</button><button class="btn danger" data-action="return" data-id="${esc(r.id)}">Return</button>`:r.status==="approved"?`<button class="btn primary" data-action="publish" data-id="${esc(r.id)}">Publish</button>`:`<span class="badge">${esc(r.status)}</span>`;return `<article class="registry-result-card"><div class="registry-result-main"><div><span class="eyebrow">${esc(r.course.code||"COURSE")}</span><h3>${esc(r.course.name||"Course")}</h3><strong>${esc(r.student.matric_no||"No exam number")}</strong><p>${esc(r.student.full_name||"Student")} · ${esc(r.student.current_level||"Level not assigned")}</p></div><div class="registry-result-meta"><span>${esc(r.semester)}</span><span>${esc(r.examination)}</span><span>${esc(r.academic_year)}</span><span>CA ${esc(r.ca_score)} / Exam ${esc(r.exam_score)} / Total ${esc(r.total_score)}</span><strong>${esc(r.grade||"—")} · GP ${esc(r.gp??"—")}</strong></div></div><div class="registry-result-actions">${action}</div></article>`;}).join("");
    }
    async function action(id,type){const r=rows.find(x=>x.id===id);if(!r)return;let status=type==="approve"?"approved":type==="publish"?"published":"returned";if(type==="publish"&&r.status!=="approved"){msg("Only approved results can be published.","error");return;}const patch={status,reviewed_by:(await hrSupabase.auth.getUser()).data.user?.id||null,updated_at:new Date().toISOString()};if(status==="published")patch.published_at=new Date().toISOString();const {error}=await hrSupabase.from("results").update(patch).eq("id",id);if(error){msg(error.message,"error");return;}msg(`Result ${status}.`,"success");await load();}
    document.addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(b){b.disabled=true;action(b.dataset.id,b.dataset.action).finally(()=>b.disabled=false);}});
    $("#status-filter")?.addEventListener("change",load);$("#refresh-results")?.addEventListener("click",load);$("#result-search")?.addEventListener("input",render);
    async function init(){if(!window.hrSupabase)return;try{await load();}catch(e){console.error(e);$("#registry-results-list").innerHTML=`<div class="admin-error">${esc(e.message)}</div>`;}}
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();