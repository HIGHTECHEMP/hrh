(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  async function count(table, filter) {
    let q = hrSupabase.from(table).select("id", { count: "exact", head: true });
    if (filter) q = q.eq(filter[0], filter[1]);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  }
  async function init() {
    if (!window.hrSupabase) return;
    try {
      const [users, staff, students, results, applications] = await Promise.all([
        count("profiles"),
        count("profiles", ["role", "lecturer"]),
        count("profiles", ["role", "student"]),
        count("results", ["status", "submitted"]),
        count("applications", ["status", "submitted"])
      ]);
      $("#admin-users").textContent = users;
      $("#admin-staff").textContent = staff;
      $("#admin-students").textContent = students;
      $("#admin-pending-results").textContent = results;
      $("#admin-applications").textContent = applications;
      $("#admin-message").textContent = "System data loaded successfully.";
    } catch (e) {
      console.error(e);
      $("#admin-message").textContent = e.message || "Some dashboard metrics could not be loaded.";
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
