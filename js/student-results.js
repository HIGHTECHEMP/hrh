(() => {
  "use strict";
  let user = null, profile = null, rows = [];
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  async function init() {
    if (!window.hrSupabase) return;
    const { data: { session } } = await hrSupabase.auth.getSession();
    if (!session) { location.href = "login.html"; return; }
    user = session.user;
    const p = await hrSupabase.from("profiles").select("id,full_name,email,role,active,matric_no,current_level,schools(name)").eq("id", user.id).single();
    if (p.error || !p.data || p.data.role !== "student" || !p.data.active) { location.href = "login.html"; return; }
    profile = p.data;
    $("#welcome").textContent = `Signed in as ${profile.full_name || user.email}.`;
    $("#chip").textContent = "Active";
    const r = await hrSupabase.from("results").select("id,semester,examination,academic_year,ca_score,exam_score,total_score,grade,gp,gpa,cgpa,published_at,courses(code,name,level)").eq("student_id", user.id).eq("status", "published").order("published_at", { ascending: false });
    if (r.error) { $("#results").innerHTML = `<div class="admin-error">${esc(r.error.message)}</div>`; return; }
    rows = r.data || [];
    render();
  }
  function render() {
    if (!rows.length) {
      $("#results").innerHTML = `<div class="student-empty"><strong>No published results yet.</strong><p>Once Registry publishes your results, they will appear here.</p></div>`;
      return;
    }
    const latest = rows[0];
    $("#result-summary").innerHTML = `<div class="metric"><span>Current level</span><b>${esc(profile.current_level || "Not assigned")}</b></div><div class="metric"><span>Latest GPA</span><b>${esc(latest.gpa ?? "—")}</b></div><div class="metric"><span>Latest CGPA</span><b>${esc(latest.cgpa ?? "—")}</b></div>`;
    $("#results").innerHTML = `<div class="table-wrap"><table class="data-table student-results-table"><thead><tr><th>Course</th><th>Semester</th><th>Examination</th><th>Academic Year</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>GP</th></tr></thead><tbody>${rows.map(r => `<tr><td><strong>${esc(r.courses?.code || "—")}</strong><small class="table-sub">${esc(r.courses?.name || "")}</small></td><td>${esc(r.semester)}</td><td>${esc(r.examination)}</td><td>${esc(r.academic_year)}</td><td>${esc(r.ca_score)}</td><td>${esc(r.exam_score)}</td><td><strong>${esc(r.total_score)}</strong></td><td><strong>${esc(r.grade)}</strong></td><td>${esc(r.gp)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  init();
})();
