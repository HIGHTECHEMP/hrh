document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("create");
  const msg = document.getElementById("msg");
  const staffList = document.getElementById("staff-list");
  const staffMessage = document.getElementById("staff-message");
  const staffSearch = document.getElementById("staff-search");
  const staffRoleFilter = document.getElementById("staff-role-filter");
  const refreshStaff = document.getElementById("refresh-staff");

  let staff = [];

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const roleLabel = role => ({
    lecturer: "Lecturer",
    registry: "Registry",
    cashier: "Cashier",
    admin: "Administrator"
  }[role] || role || "Staff");

  const renderStaff = () => {
    if (!staffList) return;

    const search = (staffSearch?.value || "").trim().toLowerCase();
    const role = staffRoleFilter?.value || "ALL";

    const filtered = staff.filter(person => {
      const matchesRole = role === "ALL" || person.role === role;
      const haystack = [person.full_name, person.email, person.staff_no]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesRole && (!search || haystack.includes(search));
    });

    if (!filtered.length) {
      staffList.innerHTML = `
        <div class="admin-empty">
          No staff members match the current filter.
        </div>
      `;
      return;
    }

    staffList.innerHTML = filtered.map(person => `
      <article class="staff-row">
        <div class="staff-avatar">${esc((person.full_name || person.email || "S").trim().charAt(0).toUpperCase())}</div>
        <div class="staff-main">
          <strong>${esc(person.full_name || "Unnamed staff")}</strong>
          <span>${esc(person.email || "No email")}</span>
          <small>${person.staff_no ? `Staff No. ${esc(person.staff_no)}` : "No staff number"}</small>
        </div>
        <div class="staff-role-wrap">
          <span class="staff-role staff-role-${esc(person.role)}">${esc(roleLabel(person.role))}</span>
          <span class="staff-status ${person.active ? "is-active" : "is-inactive"}">${person.active ? "Active" : "Inactive"}</span>
        </div>
      </article>
    `).join("");
  };

  const loadStaff = async () => {
    if (!hrSupabase || !staffList) return;

    staffList.innerHTML = `<div class="admin-loading">Loading staff…</div>`;
    if (staffMessage) staffMessage.textContent = "";

    const { data, error } = await hrSupabase
      .from("profiles")
      .select("id,full_name,email,staff_no,role,active,created_at")
      .in("role", ["lecturer", "registry", "cashier", "admin"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      staff = [];
      staffList.innerHTML = `<div class="admin-empty">Unable to load staff records.</div>`;
      if (staffMessage) staffMessage.textContent = error.message || "Unable to load staff records.";
      return;
    }

    staff = data || [];
    renderStaff();
  };

  if (staffSearch) staffSearch.addEventListener("input", renderStaff);
  if (staffRoleFilter) staffRoleFilter.addEventListener("change", renderStaff);
  if (refreshStaff) refreshStaff.addEventListener("click", loadStaff);

  // Load the directory immediately, then refresh after successful account creation.
  loadStaff();

  if (!button) return;

  button.addEventListener("click", async () => {
    if (!hrSupabase) {
      msg.textContent = "Supabase is not configured.";
      return;
    }

    const fullName = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const role = document.getElementById("role").value;
    const staffNo = document.getElementById("staff").value.trim();
    const method = document.getElementById("account-method")?.value || "invite";
    const password = document.getElementById("temporary-password")?.value || "";

    if (!fullName || !email || !role) {
      msg.textContent = "Please complete the required fields.";
      return;
    }

    if (method === "temporary" && password.length < 8) {
      msg.textContent = "Temporary password must contain at least 8 characters.";
      return;
    }

    button.disabled = true;
    button.textContent = "Creating…";
    msg.textContent = "";

    try {
      const { data: { session } } = await hrSupabase.auth.getSession();

      if (!session) {
        throw new Error("Your admin session has expired. Please log in again.");
      }

      const response = await fetch(
        `${HR_CONFIG.SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": HR_CONFIG.SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            full_name: fullName,
            email,
            role,
            staff_no: staffNo || null,
            temporary_password: method === "temporary" ? password : "",
            redirect_to: `${window.location.origin}/accept-invite.html`
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create staff account.");
      }

      msg.textContent = data.message || "Staff account created successfully.";

      document.getElementById("name").value = "";
      document.getElementById("email").value = "";
      document.getElementById("staff").value = "";

      if (document.getElementById("temporary-password")) {
        document.getElementById("temporary-password").value = "";
      }

      await loadStaff();
    } catch (error) {
      console.error(error);
      msg.textContent = error.message || "Something went wrong.";
    } finally {
      button.disabled = false;
      button.textContent = "Create / Invite Staff";
    }
  });
});
