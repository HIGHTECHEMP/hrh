document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.hrSupabase;
  if (!supabase) { window.location.href = "login.html"; return; }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = "login.html"; return; }

  const requiredRole = document.body.dataset.role || "";
  const allowedRoles = (document.body.dataset.roles || requiredRole)
    .split(",").map(role => role.trim()).filter(Boolean);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role,full_name,active")
    .eq("id", session.user.id)
    .single();

  if (error || !profile?.active || !allowedRoles.includes(profile.role)) {
    window.location.href = "login.html";
    return;
  }

  const welcome = document.getElementById("welcome");
  if (welcome) welcome.textContent = `Signed in as ${profile.full_name || session.user.email}.`;

  const logout = document.getElementById("logout");
  if (logout) {
    logout.onclick = async () => {
      await supabase.auth.signOut();
      window.location.href = "login.html";
    };
  }

  // A registry workspace can be opened by an administrator, but it must never
  // turn the administrator's portal into a Registry portal. Build navigation
  // from the authenticated role so the shell stays consistent everywhere.
  setupRoleNavigation(profile.role);
  setupMobileDashboardNav();
});

function setupRoleNavigation(role) {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  const nav = sidebar.querySelector(".side-nav");
  const brandSmall = sidebar.querySelector(".brand small");
  const eyebrow = document.querySelector(".dash-top .eyebrow");
  if (!nav) return;

  const current = location.pathname.split("/").pop() || "index.html";
  let items = [];

  if (role === "admin") {
    if (brandSmall) brandSmall.textContent = "ADMIN PORTAL";
    if (eyebrow) eyebrow.textContent = "ADMIN PORTAL";
    items = [
      ["admin-dashboard.html", "Overview"],
      ["admin-users.html", "Users & roles"],
      ["admin-content.html", "Content"],
      ["registry-students.html", "Student records"],
      ["registry-results.html", "Results"],
      ["registry-applications.html", "Applications"],
      ["registry-pins.html", "Result PINs"],
      ["registry-payments.html", "Payments"],
      ["cashier-dashboard.html", "Cashier"],
      ["admin-fees.html", "Fees & charges"]
    ];
  } else if (role === "registry") {
    if (brandSmall) brandSmall.textContent = "REGISTRY PORTAL";
    if (eyebrow) eyebrow.textContent = "REGISTRY PORTAL";
    items = [
      ["registry-dashboard.html", "Overview"],
      ["registry-students.html", "Students"],
      ["registry-results.html", "Results"],
      ["registry-pins.html", "Result PINs"],
      ["registry-applications.html", "Applications"],
      ["registry-payments.html", "Payments"]
    ];
  } else if (role === "lecturer") {
    if (brandSmall) brandSmall.textContent = "LECTURER PORTAL";
    if (eyebrow) eyebrow.textContent = "LECTURER PORTAL";
    items = [["lecturer-dashboard.html", "Overview"]];
  } else if (role === "cashier") {
    if (brandSmall) brandSmall.textContent = "CASHIER PORTAL";
    if (eyebrow) eyebrow.textContent = "CASHIER PORTAL";
    items = [["cashier-dashboard.html", "Payment collection"]];
  } else if (role === "student") {
    if (brandSmall) brandSmall.textContent = "STUDENT PORTAL";
    if (eyebrow) eyebrow.textContent = "STUDENT PORTAL";
    items = [["student-dashboard.html", "Overview"], ["student-results.html", "Results"], ["student-payments.html", "Payments & fees"], ["#notices", "Notices"], ["#profile", "Profile"]];
  }

  if (!items.length) return;
  nav.innerHTML = items.map(([href, label]) => {
    const active = href === current ? " class=\"active\"" : "";
    return `<a${active} href="${href}">${label}</a>`;
  }).join("");
}

function setupMobileDashboardNav() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar || document.querySelector(".mobile-nav-toggle")) return;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "mobile-nav-toggle";
  toggle.setAttribute("aria-label", "Open dashboard menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = `<span></span><span></span><span></span>`;

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "sidebar-backdrop";
  backdrop.setAttribute("aria-label", "Close dashboard menu");

  document.body.appendChild(toggle);
  document.body.appendChild(backdrop);

  const closeMenu = () => {
    sidebar.classList.remove("mobile-open");
    backdrop.classList.remove("visible");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open dashboard menu");
    document.body.classList.remove("dashboard-menu-open");
  };
  const openMenu = () => {
    sidebar.classList.add("mobile-open");
    backdrop.classList.add("visible");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close dashboard menu");
    document.body.classList.add("dashboard-menu-open");
  };

  toggle.addEventListener("click", () => sidebar.classList.contains("mobile-open") ? closeMenu() : openMenu());
  backdrop.addEventListener("click", closeMenu);
  sidebar.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
  window.addEventListener("resize", () => { if (window.innerWidth > 900) closeMenu(); });
}
