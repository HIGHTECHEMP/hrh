(() => {
  "use strict";
  let applications = [];
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const msg = (t, type="") => { const e = $("#application-message"); e.textContent = t; e.className = `form-message ${type}`.trim(); };
  const statuses = ["submitted","under_review","correction_required","approved","rejected","enrolled"];
  async function load() {
    const box = $("#applications-list"); box.innerHTML = `<div class="admin-loading">Loading applications…</div>`;
    const { data, error } = await hrSupabase.from("applications").select("id,application_no,first_name,last_name,email,phone,school_code,programme,status,reviewed_by,created_at,updated_at").order("created_at", { ascending: false });
    if (error) { box.innerHTML = `<div class="admin-error">${esc(error.message)}</div>`; return; }
    applications = data || []; render();
  }
  function render() {
    const term = $("#application-search").value.trim().toLowerCase();
    const filter = $("#application-status").value;
    const list = applications.filter(a => (filter === "ALL" || a.status === filter) && (!term || `${a.application_no} ${a.first_name} ${a.last_name} ${a.email} ${a.school_code} ${a.programme}`.toLowerCase().includes(term)));
    $("#applications-list").innerHTML = list.length ? list.map(a => `<article class="application-card"><div class="application-main"><div><span class="eyebrow">${esc(a.application_no)}</span><h3>${esc(a.first_name)} ${esc(a.last_name)}</h3><p>${esc(a.email)}${a.phone ? ` · ${esc(a.phone)}` : ""}</p></div><div class="application-meta"><span>${esc(a.school_code || "School not specified")}</span><span>${esc(a.programme)}</span><span>${new Date(a.created_at).toLocaleString()}</span></div></div><div class="application-actions"><label>Status<select class="application-status" data-id="${esc(a.id)}">${statuses.map(s => `<option value="${s}" ${s===a.status?"selected":""}>${esc(s.replaceAll("_"," "))}</option>`).join("")}</select></label><button class="btn primary" data-action="save" data-id="${esc(a.id)}">Save status</button></div></article>`).join("") : `<div class="admin-empty">No applications match the current filter.</div>`;
  }
  async function save(id) {
    const select = document.querySelector(`.application-status[data-id="${CSS.escape(id)}"]`);
    if (!select) return;
    const status = select.value;
    const { data: { user } } = await hrSupabase.auth.getUser();
    const { error } = await hrSupabase.from("applications").update({ status, reviewed_by: user?.id || null, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { msg(error.message, "error"); return; }
    msg(`Application updated to ${status.replaceAll("_"," ")}.`, "success"); await load();
  }
  document.addEventListener("click", e => { const b = e.target.closest('[data-action="save"]'); if (!b) return; b.disabled = true; save(b.dataset.id).finally(() => b.disabled = false); });
  $("#application-search")?.addEventListener("input", render);
  $("#application-status")?.addEventListener("change", render);
  $("#refresh-applications")?.addEventListener("click", load);
  if (window.hrSupabase) load();
})();
