(() => {
    "use strict";

    const $ = s => document.querySelector(s);
    const esc = v => String(v ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

    const showOrHide = (selector, hasItems) => {
        const el = $(selector);
        const section = el?.closest("section");
        if (section) section.style.display = hasItems ? "" : "none";
        return el;
    };

    const dateInfo = value => {
        if (!value) return { day: "—", month: "DATE", full: "Date to be announced" };
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return { day: "—", month: "DATE", full: "Date to be announced" };
        return {
            day: String(d.getDate()).padStart(2, "0"),
            month: d.toLocaleString("en-NG", { month: "short" }).toUpperCase(),
            full: d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })
        };
    };

    const initials = name => String(name || "HR").trim().split(/\s+/).filter(Boolean).slice(0, 2)
        .map(x => x[0]).join("").toUpperCase();

    const renderDirector = items => {
        const section = $(".welcome-section"), item = items[0];
        if (!section) return;
        section.style.display = item?.active === false || !item ? "none" : "";
        if (!item) return;
        const portrait = $(".welcome-portrait", section);
        if (portrait) portrait.innerHTML = item.image_url
            ? `<img class="public-director-image" src="${esc(item.image_url)}" alt="${esc(item.name || "Director")}">`
            : `<div class="image-placeholder-mark">✚</div><span>Director's photograph</span>`;
        $("#director-public-message", section)?.replaceChildren(document.createTextNode(item.message || ""));
        const quote = $("#director-public-quote", section);
        if (quote) { quote.textContent = item.quote || ""; quote.closest("blockquote")?.style.setProperty("display", item.quote ? "block" : "none"); }
        $("#director-public-name", section).textContent = item.name || "";
    };

    const renderSchools = schools => {
        const grid = showOrHide("#public-schools-grid", schools.length);
        if (!grid) return;
        grid.innerHTML = schools.map((s, i) => `
            <a class="school-card school-card-image" href="apply.html?school=${encodeURIComponent(s.code || "")}">
                <div class="school-media" data-school-code="${esc(s.code)}">
                    ${s.image_url ? `<img src="${esc(s.image_url)}" alt="${esc(s.name)}" loading="lazy">` : `<div class="school-image-fallback">✚</div>`}
                    <span class="school-number">${String(i + 1).padStart(2, "0")}</span>
                </div>
                <div class="school-content">
                    <span class="school-tag">${esc(String(s.code || "SCHOOL").replaceAll("-", " ").toUpperCase())}</span>
                    <h3>${esc(s.name)}</h3>
                    <p>${esc(s.description || "Professional health education, student services and practical learning.")}</p>
                    <span class="school-link">Explore school →</span>
                </div>
            </a>`).join("");
    };

    const renderManagement = items => {
        const grid = showOrHide("#public-management-grid", items.length);
        if (!grid) return;
        grid.innerHTML = items.map(item => `
            <article class="leader-card">
                <div class="leader-avatar ${item.image_url ? "has-leader-image" : ""}">
                    ${item.image_url ? `<img src="${esc(item.image_url)}" alt="${esc(item.name)}" loading="lazy">` : esc(initials(item.name))}
                </div>
                <h3>${esc(item.name)}</h3>
                <p>${esc(item.title)}</p>
                ${item.bio ? `<div class="leader-bio">${esc(item.bio)}</div>` : ""}
            </article>`).join("");
    };

    const renderGallery = items => {
        const track = $("#public-gallery-track"), section = track?.closest("section");
        if (!track) return;
        if (!items.length) { if (section) section.style.display = "none"; return; }
        if (section) section.style.display = "";
        track.innerHTML = items.map((item, i) => `
            <article class="slide public-gallery-slide gallery-image-slide g${i + 1}">
                ${item.image_url ? `<img class="gallery-photo" src="${esc(item.image_url)}" alt="${esc(item.title)}" loading="lazy">` : `<div class="gallery-photo-fallback">Holy Rosary</div>`}
                <div class="gallery-photo-overlay"></div>
                <div class="gallery-slide-copy">
                    <b>${esc(item.title)}</b>
                    <small>${esc(item.description || "Holy Rosary · Emekuku")}</small>
                </div>
            </article>`).join("");
    };

    const renderActivities = items => {
        const grid = showOrHide("#public-activities-grid", items.length);
        if (!grid) return;
        grid.innerHTML = items.map((item, i) => `
            <article class="campus-card campus-dynamic-card ${item.image_url ? "has-activity-image" : ""}">
                ${item.image_url ? `<img class="campus-photo" src="${esc(item.image_url)}" alt="${esc(item.title)}" loading="lazy">` : ""}
                <div class="campus-photo-overlay"></div>
                <span>${String(i + 1).padStart(2, "0")}</span>
                <div class="campus-card-copy">
                    <small>${esc(item.category || "Campus Life")}</small>
                    <h3>${esc(item.title)}</h3>
                    <p>${esc(item.description || "")}</p>
                </div>
            </article>`).join("");
    };

    const renderFacilities = items => {
        const grid = showOrHide("#public-facilities-grid", items.length);
        if (!grid) return;
        grid.innerHTML = items.map(item => `
            <article class="dynamic-facility-card">
                ${item.image_url ? `<div class="facility-image"><img src="${esc(item.image_url)}" alt="${esc(item.title)}" loading="lazy"></div>` : `<div class="facility-icon">${esc(item.icon || "✚")}</div>`}
                <h3>${esc(item.title)}</h3><p>${esc(item.description || "")}</p>
            </article>`).join("");
    };

    const renderEvents = items => {
        const grid = showOrHide("#public-events-grid", items.length);
        if (!grid) return;
        grid.innerHTML = items.map((item, i) => {
            const d = dateInfo(item.event_date);
            return `<article class="event-card ${item.image_url ? "event-has-image" : ""}">
                ${item.image_url ? `<img class="event-photo" src="${esc(item.image_url)}" alt="${esc(item.title)}" loading="lazy">` : ""}
                ${item.image_url ? `<div class="event-photo-overlay"></div>` : ""}
                <div class="event-date"><strong>${esc(d.day)}</strong><span>${esc(d.month)}</span></div>
                <div class="event-body"><span class="event-type">${esc(item.category || "EVENT")}</span><h3>${esc(item.title)}</h3><p>${esc(item.description || "")}</p><div class="event-meta"><span>● ${esc(d.full)}</span>${item.location ? `<span>● ${esc(item.location)}</span>` : ""}</div></div>
                <span class="event-arrow">↗</span>
            </article>`;
        }).join("");
    };

    const load = async () => {
        if (!window.hrSupabase) return;
        try {
            const results = await Promise.all([
                hrSupabase.from("homepage_director").select("id,name,message,quote,image_url,active").eq("active", true).order("updated_at", { ascending: false }).limit(1),
                hrSupabase.from("schools").select("id,code,name,description,image_url,active").eq("active", true).order("name"),
                hrSupabase.from("management_team").select("id,name,title,bio,image_url,sort_order,active").eq("active", true).order("sort_order"),
                hrSupabase.from("gallery_items").select("id,title,description,image_url,sort_order,active").eq("active", true).order("sort_order"),
                hrSupabase.from("activity_items").select("id,title,description,category,image_url,sort_order,active").eq("active", true).order("sort_order"),
                hrSupabase.from("upcoming_events").select("id,title,description,category,event_date,location,image_url,sort_order,active").eq("active", true).order("event_date", { ascending: true, nullsFirst: false }).order("sort_order"),
                hrSupabase.from("facility_items").select("id,title,description,icon,image_url,sort_order,active").eq("active", true).order("sort_order")
            ]);
            for (const r of results) if (r.error) throw r.error;
            renderDirector(results[0].data || []);
            renderSchools(results[1].data || []);
            renderManagement(results[2].data || []);
            renderGallery(results[3].data || []);
            renderActivities(results[4].data || []);
            renderEvents(results[5].data || []);
            renderFacilities(results[6].data || []);
            window.dispatchEvent(new CustomEvent("homepage-content-ready"));
        } catch (e) { console.error("Homepage content load failed:", e); }
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true });
    else load();
})();