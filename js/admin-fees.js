let feeRows = [];
let editingFeeId = null;

document.addEventListener("DOMContentLoaded", async () => {
  bind();
  await loadSchools();
  toggleScopeFields();
  await loadFees();
});

function bind() {
  document.getElementById("save-fee")?.addEventListener("click", saveFee);
  document.getElementById("cancel-fee")?.addEventListener("click", resetForm);
  document.getElementById("refresh-fees")?.addEventListener("click", loadFees);
  document.getElementById("fee-category")?.addEventListener("change", toggleScopeFields);
}

async function loadSchools() {
  const select = document.getElementById("fee-school");
  if (!select) return;
  const { data, error } = await hrSupabase.from("schools").select("id,name").eq("active",true).order("name");
  if (error) return;
  select.innerHTML = `<option value="">All schools</option>` + (data||[]).map(s =>
    `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
}

function toggleScopeFields() {
  const category = document.getElementById("fee-category")?.value;
  const level = document.getElementById("fee-level");
  const examWrap = document.getElementById("exam-type-wrap");
  const levelLabel = level?.closest("label");
  if (levelLabel) levelLabel.style.display = ["school_fees","examination"].includes(category) ? "" : "none";
  if (examWrap) examWrap.style.display = category === "examination" ? "" : "none";
}

async function loadFees() {
  const box = document.getElementById("fee-admin-list");
  if (!box) return;
  box.innerHTML = `<div class="admin-loading">Loading fees…</div>`;
  const { data, error } = await hrSupabase
    .from("fee_catalog")
    .select("id,code,name,category,description,amount,currency,active,school_id,level,exam_type,schools(name)")
    .order("category").order("level").order("name");

  if (error) {
    box.innerHTML = `<div class="admin-empty">${esc(error.message)}</div>`;
    return;
  }
  feeRows = data || [];
  render();
}

function render() {
  const box = document.getElementById("fee-admin-list");
  if (!feeRows.length) {
    box.innerHTML = `<div class="empty-state">No fees configured.</div>`;
    return;
  }

  box.innerHTML = feeRows.map(f => {
    const scope = [
      f.schools?.name || "All schools",
      f.level || "All levels",
      f.exam_type || ""
    ].filter(Boolean).join(" · ");

    const annualNote = f.category === "school_fees" ? "Annual amount" : "Official amount";

    return `
      <article class="fee-admin-row fee-admin-row-rich">
        <div class="fee-admin-main">
          <span class="eyebrow">${esc(labelFor(f.category))}</span>
          <h3>${esc(f.name)}</h3>
          <p>${esc(f.code)} · ${esc(scope)}</p>
          <small>${esc(f.description || "")}</small>
        </div>
        <div class="fee-admin-actions">
          <strong>${money(f.amount,f.currency)}</strong>
          <small>${annualNote}</small>
          <span class="status-pill ${f.active ? "successful" : "failed"}">${f.active ? "Active" : "Hidden"}</span>
          <button class="btn ghost" type="button" data-edit="${esc(f.id)}">Edit</button>
        </div>
      </article>
    `;
  }).join("");

  box.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => editFee(btn.dataset.edit)));
}

function editFee(id) {
  const f = feeRows.find(x => x.id === id);
  if (!f) return;
  editingFeeId = id;
  setValue("fee-code",f.code); setValue("fee-name",f.name); setValue("fee-category",f.category);
  setValue("fee-school",f.school_id || ""); setValue("fee-level",f.level || "");
  setValue("fee-exam-type",f.exam_type || ""); setValue("fee-amount",f.amount);
  setValue("fee-description",f.description || "");
  document.getElementById("fee-active").checked = !!f.active;
  toggleScopeFields();
  document.getElementById("cancel-fee").style.display = "inline-flex";
  document.getElementById("save-fee").textContent = "Update fee";
  window.scrollTo({top:0,behavior:"smooth"});
}

async function saveFee() {
  const category = value("fee-category");
  const payload = {
    code: value("fee-code"),
    name: value("fee-name"),
    category,
    school_id: ["school_fees","examination"].includes(category) ? (value("fee-school") || null) : null,
    level: ["school_fees","examination"].includes(category) ? (value("fee-level") || null) : null,
    exam_type: category === "examination" ? (value("fee-exam-type") || null) : null,
    amount: Number(value("fee-amount")),
    currency: "NGN",
    description: value("fee-description"),
    active: document.getElementById("fee-active").checked,
    updated_at: new Date().toISOString()
  };

  if (!payload.code || !payload.name || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    msg("Enter a code, name and official amount greater than zero.",true);
    return;
  }
  if (category === "school_fees" && !payload.level) {
    msg("Select the level for a school-fee charge.",true); return;
  }
  if (category === "examination" && (!payload.level || !payload.exam_type)) {
    msg("Select the level and exam type for an examination charge.",true); return;
  }

  const button = document.getElementById("save-fee");
  button.disabled = true;
  button.textContent = editingFeeId ? "Updating…" : "Saving…";

  try {
    const query = editingFeeId
      ? hrSupabase.from("fee_catalog").update(payload).eq("id",editingFeeId)
      : hrSupabase.from("fee_catalog").insert(payload);
    const { error } = await query;
    if (error) throw error;
    msg(editingFeeId ? "Fee updated successfully." : "Fee created successfully.");
    resetForm();
    await loadFees();
  } catch (e) {
    msg(e.message || "Unable to save fee.",true);
  } finally {
    button.disabled = false;
    button.textContent = editingFeeId ? "Update fee" : "Save fee";
  }
}

function resetForm() {
  editingFeeId = null;
  ["fee-code","fee-name","fee-amount","fee-description"].forEach(id => setValue(id,""));
  setValue("fee-category","school_fees");
  setValue("fee-school","");
  setValue("fee-level","");
  setValue("fee-exam-type","");
  document.getElementById("fee-active").checked = false;
  document.getElementById("cancel-fee").style.display = "none";
  document.getElementById("save-fee").textContent = "Save fee";
  toggleScopeFields();
}

function msg(text,error=false) {
  const el = document.getElementById("fee-message");
  el.textContent = text;
  el.className = `form-message ${error ? "error" : ""}`;
}
const value=id=>document.getElementById(id)?.value.trim() || "";
const setValue=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??"";};
const labelFor=c=>({result_pin:"RESULT PIN",application:"ADMISSIONS",examination:"EXAMINATION",school_fees:"SCHOOL FEES"}[c]||"PAYMENT");
const money=(a,c="NGN")=>new Intl.NumberFormat("en-NG",{style:"currency",currency:c||"NGN"}).format(Number(a||0));
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
