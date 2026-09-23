(() => {
    "use strict";

    let currentUser = null, profile = null, courses = [], students = [], results = [];
    const $ = s => document.querySelector(s);
    const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    const msg = (text, type="") => { const e=$("#result-message"); if(e){e.textContent=text;e.className=`form-message ${type}`.trim();} };
    const grade = n => { n=Number(n); if(!Number.isFinite(n)) return {grade:"",gp:""}; if(n>=70)return{grade:"A",gp:5}; if(n>=60)return{grade:"B",gp:4}; if(n>=50)return{grade:"C",gp:3}; if(n>=45)return{grade:"D",gp:2}; if(n>=40)return{grade:"E",gp:1}; return{grade:"F",gp:0}; };
    const normLevel = v => { const s=String(v||"").trim().toLowerCase(); const m=s.match(/(100|200|300|400|500)/); return m ? `${m[1]} Level` : ""; };

    async function loadProfile(){
        const {data:{session}}=await hrSupabase.auth.getSession();
        if(!session){location.href="login.html";return false;}
        currentUser=session.user;
        const {data,error}=await hrSupabase.from("profiles").select("id,full_name,email,role,school_id,active").eq("id",currentUser.id).single();
        if(error||!data||data.role!=="lecturer"||!data.active){location.href="login.html";return false;}
        profile=data; $("#welcome").textContent=`Signed in as ${data.full_name||currentUser.email}.`; return true;
    }

    async function loadCourses(){
        const {data,error}=await hrSupabase.from("courses").select("id,code,name,level,semester,school_id,lecturer_id,active").eq("lecturer_id",currentUser.id).eq("active",true).order("code");
        if(error) throw error; courses=data||[]; $("#course-count").textContent=courses.length;
        $("#course-select").innerHTML=`<option value="">Select assigned course</option>`+courses.map(c=>`<option value="${esc(c.id)}">${esc(c.code)} — ${esc(c.name)}</option>`).join("");
        $("#course-list").innerHTML=courses.length?courses.map(c=>`<button type="button" class="lecturer-course-card" data-course-id="${esc(c.id)}"><span class="eyebrow">${esc(c.code)}</span><strong>${esc(c.name)}</strong><small>${esc(normLevel(c.level)||"Level not set")} · ${esc(c.semester||"Semester not set")}</small></button>`).join(""):`<div class="lecturer-empty"><strong>No courses assigned yet.</strong><p>Admin can assign a course and lecturer from Users & roles.</p></div>`;
        document.querySelectorAll("[data-course-id]").forEach(b=>b.addEventListener("click",()=>{ $("#course-select").value=b.dataset.courseId; applyCourseDefaults(); loadStudents(); }));
    }

    function applyCourseDefaults(){
        const c=courses.find(x=>x.id===$("#course-select").value); if(!c)return;
        const lv=normLevel(c.level); if(lv) $("#level-select").value=lv;
        if(c.semester && ["First Semester","Second Semester"].includes(c.semester)) $("#semester").value=c.semester;
    }

    async function loadStudents(){
        const course=courses.find(c=>c.id===$("#course-select").value), selected=$("#level-select").value;
        if(!course||!selected){$("#students-area").innerHTML=`<div class="lecturer-empty">Select a course and level to load students.</div>`;$("#lecturer-actions").style.display="none";return;}
        msg("Loading students…");
        const {data,error}=await hrSupabase.from("profiles").select("id,full_name,email,matric_no,school_id,current_level,active").eq("role","student").eq("active",true).eq("school_id",course.school_id).order("matric_no");
        if(error){msg(error.message,"error");return;}
        const wanted=selected==="ALL"?null:selected;
        students=(data||[]).filter(s=>!wanted||normLevel(s.current_level)===wanted);
        $("#student-count").textContent=students.length;
        await loadResults(course.id);
        render();
        $("#lecturer-actions").style.display=students.length?"flex":"none";
        msg(`${students.length} student(s) loaded for ${selected==="ALL"?"all levels":selected}.`,"success");
    }

    async function loadResults(courseId){
        const {data,error}=await hrSupabase.from("results").select("id,student_id,course_id,semester,examination,academic_year,ca_score,exam_score,total_score,grade,gp,gpa,cgpa,status").eq("course_id",courseId);
        if(error){console.error(error);results=[];return;} results=data||[];
        $("#submitted-count").textContent=results.filter(r=>r.status==="submitted").length;
    }

    function settings(){
        const courseId=$("#course-select").value, level=$("#level-select").value, semester=$("#semester").value, examination=$("#examination").value.trim(), academicYear=$("#academic-year").value.trim();
        if(!courseId)throw Error("Select a course first."); if(!level)throw Error("Select a level first."); if(!semester)throw Error("Select a semester."); if(!examination)throw Error("Enter the examination name."); if(!academicYear)throw Error("Enter the academic year."); return {courseId,level,semester,examination,academicYear};
    }

    function findExisting(studentId,s){ return results.find(r=>r.student_id===studentId&&r.course_id===s.courseId&&r.semester===s.semester&&r.examination===s.examination&&r.academic_year===s.academicYear); }

    function render(){
        const s={semester:$("#semester").value,examination:$("#examination").value.trim(),academicYear:$("#academic-year").value.trim(),courseId:$("#course-select").value};
        $("#students-area").innerHTML=students.length?`<div class="table-wrap"><table class="data-table lecturer-result-table"><thead><tr><th>Student / Exam No.</th><th>CA / 40</th><th>Exam / 60</th><th>Total</th><th>Grade</th><th>GP</th><th>Status</th></tr></thead><tbody>${students.map(st=>{const r=results.find(x=>x.student_id===st.id&&x.course_id===s.courseId&&(!s.semester||x.semester===s.semester)&&(!s.examination||x.examination===s.examination)&&(!s.academicYear||x.academic_year===s.academicYear));const total=r?.total_score??"";const g=grade(total);const locked=["submitted","approved","published"].includes(r?.status);return `<tr data-student-id="${esc(st.id)}"><td><strong>${esc(st.matric_no||"No exam number")}</strong><small class="table-sub">${esc(st.full_name)}</small><small class="table-sub">${esc(normLevel(st.current_level)||"Level not set")}</small></td><td><input class="score-input ca-input" type="number" min="0" max="40" step="0.01" value="${esc(r?.ca_score??"")}" ${locked?"disabled":""}></td><td><input class="score-input exam-input" type="number" min="0" max="60" step="0.01" value="${esc(r?.exam_score??"")}" ${locked?"disabled":""}></td><td><strong class="total-value">${esc(total)}</strong></td><td><strong class="grade-value">${esc(r?.grade||g.grade)}</strong></td><td><strong class="gp-value">${esc(r?.gp??g.gp)}</strong></td><td><span class="status result-status">${esc(r?.status||"Not saved")}</span></td></tr>`;}).join("")}</tbody></table></div>`:`<div class="lecturer-empty"><strong>No students found.</strong><p>Registry must assign students to a current level before results can be entered.</p></div>`;
        bindCalculations();
    }

    function bindCalculations(){document.querySelectorAll(".lecturer-result-table tbody tr").forEach(row=>{const ca=row.querySelector(".ca-input"),ex=row.querySelector(".exam-input");const calc=()=>{const total=Math.min(40,Math.max(0,Number(ca.value||0)))+Math.min(60,Math.max(0,Number(ex.value||0)));const g=grade(total);row.querySelector(".total-value").textContent=total.toFixed(2);row.querySelector(".grade-value").textContent=g.grade;row.querySelector(".gp-value").textContent=g.gp;};ca?.addEventListener("input",calc);ex?.addEventListener("input",calc);});}

    async function save(submit){
        let s; try{s=settings();}catch(e){msg(e.message,"error");return;}
        const rows=[...document.querySelectorAll(".lecturer-result-table tbody tr")]; if(!rows.length){msg("There are no students to save.","error");return;}
        const btn=$(submit?"#submit-all":"#save-all"); btn.disabled=true; const old=btn.textContent; btn.textContent=submit?"Submitting…":"Saving…"; msg(submit?"Submitting results…":"Saving drafts…");
        try{
            for(const row of rows){const caInput=row.querySelector(".ca-input"),exInput=row.querySelector(".exam-input"); if(caInput.disabled||exInput.disabled)continue; const ca=Number(caInput.value||0),ex=Number(exInput.value||0); if(ca<0||ca>40||ex<0||ex>60)throw Error("CA must be 0–40 and Exam must be 0–60."); const total=Number((ca+ex).toFixed(2)),g=grade(total); const existing=findExisting(row.dataset.studentId,s); const payload={student_id:row.dataset.studentId,course_id:s.courseId,semester:s.semester,examination:s.examination,academic_year:s.academicYear,ca_score:ca,exam_score:ex,total_score:total,grade:g.grade,gp:g.gp,status:submit?"submitted":"draft",submitted_by:currentUser.id,updated_at:new Date().toISOString()}; let q;if(existing?.id)q=await hrSupabase.from("results").update(payload).eq("id",existing.id);else q=await hrSupabase.from("results").insert(payload);if(q.error)throw q.error;}
            await loadResults(s.courseId);render();msg(submit?"Results submitted to Registry successfully.":"Result drafts saved successfully.","success");
        }catch(e){console.error(e);msg(e.message||"Unable to save results.","error");}finally{btn.disabled=false;btn.textContent=old;}
    }

    async function init(){if(!window.hrSupabase)return;if(!await loadProfile())return;try{await loadCourses();}catch(e){console.error(e);msg(e.message,"error");}
        $("#course-select").addEventListener("change",()=>{applyCourseDefaults();loadStudents();}); $("#level-select").addEventListener("change",loadStudents); ["#semester","#examination","#academic-year"].forEach(s=>$(s).addEventListener("change",()=>{if($("#course-select").value&&$("#level-select").value)render();})); $("#save-all").addEventListener("click",()=>save(false)); $("#submit-all").addEventListener("click",()=>save(true));
    }
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
