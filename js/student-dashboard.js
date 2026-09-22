(() => {
    "use strict";
    let currentUser=null, profile=null;
    const $=s=>document.querySelector(s);
    const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");

    async function loadStudent(){
        const {data:{session}}=await hrSupabase.auth.getSession();
        if(!session){location.href="login.html";return false;} currentUser=session.user;
        const {data,error}=await hrSupabase.from("profiles").select("id,full_name,email,role,active,matric_no,school_id,current_level,schools(code,name)").eq("id",currentUser.id).single();
        if(error||!data||data.role!=="student"){location.href="login.html";return false;} profile=data;
        const name=data.full_name||currentUser.email||"Student";
        $("#welcome").textContent=`Welcome back, ${name}.`; $("#student-name").textContent=name; $("#student-exam-number").textContent=data.matric_no||"Not assigned"; $("#student-school").textContent=data.schools?.name||"School not assigned"; $("#student-status").textContent=data.active?"Active":"Inactive"; $("#chip").textContent=data.active?"Active":"Inactive"; $("#student-initial").textContent=name.trim().charAt(0).toUpperCase(); $("#student-level").textContent=data.current_level||"Level not assigned"; return true;
    }

    async function loadResults(){
        const {data,error}=await hrSupabase.from("results").select("id,semester,examination,academic_year,total_score,grade,gp,gpa,cgpa,published_at,courses(code,name)").eq("student_id",currentUser.id).eq("status","published").order("published_at",{ascending:false}).limit(10);
        if(error){console.error(error);$("#recent-results").innerHTML=`<p class="muted">Unable to load results.</p>`;return;}
        const rows=data||[]; $("#latest-gpa").textContent=rows[0]?.gpa??rows[0]?.cgpa??"—";
        $("#recent-results").innerHTML=rows.length?`<div class="table-wrap"><table class="data-table student-results-table"><thead><tr><th>Course</th><th>Semester</th><th>Academic Year</th><th>Total</th><th>Grade</th><th>GP</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.courses?.code||"Course")}</strong><small class="table-sub">${esc(r.courses?.name||"")}</small></td><td>${esc(r.semester)}</td><td>${esc(r.academic_year)}</td><td>${esc(r.total_score)}</td><td><strong>${esc(r.grade)}</strong></td><td>${esc(r.gp)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="student-empty"><strong>No published results yet.</strong><p>Approved and published academic results will appear here.</p></div>`;
    }

    async function loadHistory(){
        const {data,error}=await hrSupabase.from("student_level_history").select("id,from_level,to_level,academic_year,created_at").eq("student_id",currentUser.id).order("created_at",{ascending:true});
        if(error){console.error(error);$("#level-history").innerHTML=`<p class="muted">Progression history is not available yet.</p>`;return;}
        const rows=data||[]; $("#progress-count").textContent=rows.length?`${rows.length} progression record${rows.length===1?"":"s"}`:"Starting level";
        $("#level-history").innerHTML=rows.length?rows.map((r,i)=>`<div class="level-history-item"><div class="level-dot">${i+1}</div><div><strong>${esc(r.from_level||"Admission")} → ${esc(r.to_level)}</strong><p>${esc(r.academic_year||"Academic progression")}</p></div></div>`).join(""):`<div class="student-empty"><strong>${esc(profile.current_level||"Level not assigned")}</strong><p>Your promotion history will appear here when Registry records your academic progression.</p></div>`;
    }

    async function loadApplication(){
        if(!profile?.email)return; const {data,error}=await hrSupabase.from("applications").select("status,application_no,created_at").eq("email",profile.email).order("created_at",{ascending:false}).limit(1); if(error)return; $("#application-status").textContent=data?.length?String(data[0].status||"").replaceAll("_"," "):"No application";
    }

    async function loadNotices(){
        const {data,error}=await hrSupabase.from("notices").select("id,title,body,published_at").eq("published",true).order("published_at",{ascending:false}).limit(3); if(error)return; $("#student-notices").innerHTML=data?.length?data.map(n=>`<div class="student-notice"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p></div>`).join(""):`<p class="muted">No official notices at the moment.</p>`;
    }

    async function init(){if(!window.hrSupabase)return;if(!await loadStudent())return;await Promise.all([loadResults(),loadHistory(),loadApplication(),loadNotices()]);}
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
