(() => {
    "use strict";

    const BUCKET = "site-content";
    const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
    const TABLES = [
        "management_team",
        "gallery_items",
        "activity_items",
        "upcoming_events",
        "facility_items"
    ];

    const $ = (s, root = document) => root.querySelector(s);
    const $$ = (s, root = document) => [...root.querySelectorAll(s)];
    const esc = v => String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const message = (text = "", type = "") => {
        const el = $("#content-message");
        if (!el) return;
        el.textContent = text;
        el.className = `form-message content-global-message ${type}`.trim();
    };

    const slug = v => String(v || "image")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "image";

    const ext = file => {
        const x = String(file?.name || "jpg").split(".").pop().toLowerCase();
        return ["jpg", "jpeg", "png", "webp"].includes(x) ? x : "jpg";
    };

    const imageUrl = path => hrSupabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const uploadImage = async (file, folder, label) => {
        if (!file) return null;
        if (!file.type?.startsWith("image/")) throw new Error("Please select an image file.");
        if (file.size > MAX_IMAGE_SIZE) throw new Error("Image must be 8MB or smaller.");

        const path = `${folder}/${slug(label)}-${crypto.randomUUID()}.${ext(file)}`;
        const { error } = await hrSupabase.storage.from(BUCKET).upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });
        if (error) throw error;
        return imageUrl(path);
    };

    const storagePath = url => {
        if (!url) return null;
        const marker = `/storage/v1/object/public/${BUCKET}/`;
        const i = String(url).indexOf(marker);
        return i < 0 ? null : decodeURIComponent(String(url).slice(i + marker.length).split("?")[0]);
    };

    const deleteStorageImage = async url => {
        const path = storagePath(url);
        if (!path) return;
        const { error } = await hrSupabase.storage.from(BUCKET).remove([path]);
        if (error) console.warn("Storage cleanup:", error.message);
    };

    const preview = (url, label) => url
        ? `<img class="content-admin-image" src="${esc(url)}" alt="${esc(label)}">`
        : `<div class="content-admin-placeholder"><span>✚</span><small>${esc(label)}</small></div>`;

    const setButton = (button, busy, text) => {
        if (!button) return;
        if (busy) {
            button.dataset.oldText = button.textContent;
            button.disabled = true;
            button.textContent = text;
        } else {
            button.disabled = false;
            button.textContent = button.dataset.oldText || "Save changes";
        }
    };

    const getFile = form => form.querySelector('input[name="image"]')?.files?.[0] || null;
    const formData = form => Object.fromEntries(new FormData(form).entries());

    const toLocalDateTime = value => {
        if (!value) return "";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        const pad = n => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const currentUrl = form => form.querySelector(".content-admin-image")?.getAttribute("src") || "";

    const genericConfig = {
        management_team: {
            label: "Management member",
            fields: item => `
                <label>Name<input name="name" required value="${esc(item.name)}"></label>
                <label>Position / title<input name="title" required value="${esc(item.title)}"></label>
                <label class="wide-field">Bio / information<textarea name="bio" rows="3">${esc(item.bio || "")}</textarea></label>`
        },
        gallery_items: {
            label: "Gallery image",
            fields: item => `
                <label>Title<input name="title" required value="${esc(item.title)}"></label>
                <label>Display order<input name="sort_order" type="number" value="${Number(item.sort_order || 0)}"></label>
                <label class="wide-field">Information<textarea name="description" rows="3">${esc(item.description || "")}</textarea></label>`
        },
        activity_items: {
            label: "Activity",
            fields: item => `
                <label>Title<input name="title" required value="${esc(item.title)}"></label>
                <label>Category<input name="category" value="${esc(item.category || "Campus Life")}"></label>
                <label>Display order<input name="sort_order" type="number" value="${Number(item.sort_order || 0)}"></label>
                <label class="wide-field">Information<textarea name="description" rows="3">${esc(item.description || "")}</textarea></label>`
        },
        upcoming_events: {
            label: "Upcoming event",
            fields: item => `
                <label>Event title<input name="title" required value="${esc(item.title)}"></label>
                <label>Category<input name="category" value="${esc(item.category || "EVENT")}"></label>
                <label>Date & time<input name="event_date" type="datetime-local" value="${esc(toLocalDateTime(item.event_date))}"></label>
                <label>Location<input name="location" value="${esc(item.location || "")}"></label>
                <label>Display order<input name="sort_order" type="number" value="${Number(item.sort_order || 0)}"></label>
                <label class="wide-field">Information<textarea name="description" rows="3">${esc(item.description || "")}</textarea></label>`
        },
        facility_items: {
            label: "Facility / resource",
            fields: item => `
                <label>Title<input name="title" required value="${esc(item.title)}"></label>
                <label>Icon<input name="icon" maxlength="4" value="${esc(item.icon || "✚")}"></label>
                <label>Display order<input name="sort_order" type="number" value="${Number(item.sort_order || 0)}"></label>
                <label class="wide-field">Information<textarea name="description" rows="3">${esc(item.description || "")}</textarea></label>`
        }
    };

    const genericForm = (table, item) => {
        const cfg = genericConfig[table];
        return `<form class="content-item-form" data-table="${table}" data-id="${esc(item.id)}">
            <div class="content-item-preview">${preview(item.image_url, cfg.label)}</div>
            <div class="content-item-fields">
                <div class="form-grid compact-grid">
                    ${cfg.fields(item)}
                    <label>Replace image<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label>
                    <label class="check-label"><input name="active" type="checkbox" ${item.active !== false ? "checked" : ""}> Show on public site</label>
                </div>
                <div class="content-form-actions">
                    <button class="btn primary" type="submit">Save changes</button>
                    <button class="btn ghost" type="button" data-remove-image>Remove image</button>
                    <button class="btn danger" type="button" data-delete>Delete</button>
                </div>
                <p class="upload-status" aria-live="polite"></p>
            </div>
        </form>`;
    };

    const loadDirector = async () => {
        const { data, error } = await hrSupabase.from("homepage_director")
            .select("id,name,message,quote,image_url,active")
            .order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        const form = $("#director-form");
        if (!form) return;
        form.dataset.id = data?.id || "";
        $("#director-name").value = data?.name || "";
        $("#director-message").value = data?.message || "";
        $("#director-quote").value = data?.quote || "";
        $("#director-active").checked = data?.active !== false;
        $("#director-current-image").innerHTML = preview(data?.image_url, "Director photograph");
        $("#director-current-image").dataset.url = data?.image_url || "";
    };

    const loadSchools = async () => {
        const { data, error } = await hrSupabase.from("schools")
            .select("id,code,name,description,image_url,active").order("name");
        if (error) throw error;
        const list = $("#schools-list");
        if (!data?.length) { list.innerHTML = `<div class="admin-empty">No schools found.</div>`; return; }
        list.innerHTML = data.map(s => `<form class="content-item-form" data-table="schools" data-id="${esc(s.id)}">
            <div class="content-item-preview">${preview(s.image_url, s.name)}</div>
            <div class="content-item-fields">
                <div class="form-grid compact-grid">
                    <label>Code<input name="code" required value="${esc(s.code)}"></label>
                    <label>Name<input name="name" required value="${esc(s.name)}"></label>
                    <label class="wide-field">Description<textarea name="description" rows="3">${esc(s.description || "")}</textarea></label>
                    <label>Replace image<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label>
                    <label class="check-label"><input name="active" type="checkbox" ${s.active !== false ? "checked" : ""}> Show on public site</label>
                </div>
                <div class="content-form-actions">
                    <button class="btn primary" type="submit">Save school</button>
                    <button class="btn ghost" type="button" data-remove-image>Remove image</button>
                    <button class="btn danger" type="button" data-delete>Delete school</button>
                </div>
                <p class="upload-status" aria-live="polite"></p>
            </div>
        </form>`).join("");
    };

    const loadTable = async table => {
        const { data, error } = await hrSupabase.from(table).select("*").order("sort_order", { ascending: true });
        if (error) throw error;
        const list = $(`#${table}-list`);
        if (!list) return;
        list.innerHTML = data?.length ? data.map(item => genericForm(table, item)).join("") : `<div class="admin-empty">No items yet.</div>`;
    };

    const reloadAll = async () => {
        await loadDirector();
        await loadSchools();
        for (const table of TABLES) await loadTable(table);
    };

    const saveDirector = async form => {
        const oldUrl = $("#director-current-image")?.dataset.url || "";
        const data = formData(form);
        let newUrl = oldUrl;
        let uploaded = null;
        try {
            const file = getFile(form);
            if (file) {
                newUrl = await uploadImage(file, "director", data.name || "director");
                uploaded = newUrl;
            }
            const { error } = await hrSupabase.from("homepage_director").update({
                name: String(data.name || "").trim(),
                message: String(data.message || "").trim(),
                quote: String(data.quote || "").trim() || null,
                image_url: newUrl || null,
                active: form.querySelector('[name="active"]').checked,
                updated_at: new Date().toISOString()
            }).eq("id", form.dataset.id);
            if (error) throw error;
            if (uploaded && oldUrl && oldUrl !== uploaded) await deleteStorageImage(oldUrl);
        } catch (e) {
            if (uploaded) await deleteStorageImage(uploaded);
            throw e;
        }
        await loadDirector();
    };

    const saveSchool = async form => {
        const oldUrl = currentUrl(form);
        const data = formData(form);
        let newUrl = oldUrl, uploaded = null;
        try {
            const file = getFile(form);
            if (file) { newUrl = await uploadImage(file, "schools", data.code || data.name); uploaded = newUrl; }
            const { error } = await hrSupabase.from("schools").update({
                code: String(data.code || "").trim(),
                name: String(data.name || "").trim(),
                description: String(data.description || "").trim() || null,
                image_url: newUrl || null,
                active: form.querySelector('[name="active"]').checked,
                updated_at: new Date().toISOString()
            }).eq("id", form.dataset.id);
            if (error) throw error;
            if (uploaded && oldUrl && oldUrl !== uploaded) await deleteStorageImage(oldUrl);
        } catch (e) { if (uploaded) await deleteStorageImage(uploaded); throw e; }
        await loadSchools();
    };

    const saveGeneric = async form => {
        const table = form.dataset.table;
        const oldUrl = currentUrl(form);
        const data = formData(form);
        const payload = {};
        const allowed = {
            management_team: ["name", "title", "bio", "sort_order", "active"],
            gallery_items: ["title", "description", "sort_order", "active"],
            activity_items: ["title", "description", "category", "sort_order", "active"],
            upcoming_events: ["title", "description", "category", "event_date", "location", "sort_order", "active"],
            facility_items: ["title", "description", "icon", "sort_order", "active"]
        }[table] || [];
        for (const key of allowed) {
            if (key === "active") payload[key] = form.querySelector('[name="active"]').checked;
            else if (key === "sort_order") payload[key] = Number(data[key] || 0);
            else if (key === "event_date") payload[key] = data[key] ? new Date(data[key]).toISOString() : null;
            else payload[key] = String(data[key] || "").trim() || null;
        }
        if (table === "management_team") { payload.name = String(data.name || "").trim(); payload.title = String(data.title || "").trim(); }
        if (table === "gallery_items" || table === "activity_items" || table === "upcoming_events" || table === "facility_items") payload.title = String(data.title || "").trim();

        let newUrl = oldUrl, uploaded = null;
        try {
            const file = getFile(form);
            if (file) { newUrl = await uploadImage(file, table.replaceAll("_", "-"), data.title || data.name || table); uploaded = newUrl; }
            payload.image_url = newUrl || null;
            payload.updated_at = new Date().toISOString();
            const { error } = await hrSupabase.from(table).update(payload).eq("id", form.dataset.id);
            if (error) throw error;
            if (uploaded && oldUrl && oldUrl !== uploaded) await deleteStorageImage(oldUrl);
        } catch (e) { if (uploaded) await deleteStorageImage(uploaded); throw e; }
        await loadTable(table);
    };

    const addGeneric = async form => {
        const table = form.dataset.table;
        const data = formData(form);
        const payload = {};
        const file = getFile(form);
        let uploaded = null;
        const allowed = {
            management_team: ["name", "title", "bio", "sort_order"],
            gallery_items: ["title", "description", "sort_order"],
            activity_items: ["title", "description", "category", "sort_order"],
            upcoming_events: ["title", "description", "category", "event_date", "location", "sort_order"],
            facility_items: ["title", "description", "icon", "sort_order"]
        }[table] || [];
        for (const key of allowed) {
            if (key === "sort_order") payload[key] = Number(data[key] || 0);
            else if (key === "event_date") payload[key] = data[key] ? new Date(data[key]).toISOString() : null;
            else payload[key] = String(data[key] || "").trim() || null;
        }
        if (table === "management_team") { if (!payload.name || !payload.title) throw new Error("Name and title are required."); }
        else if (!payload.title) throw new Error("A title is required.");
        payload.active = form.querySelector('[name="active"]')?.checked !== false;
        try {
            if (file) { uploaded = await uploadImage(file, table.replaceAll("_", "-"), data.title || data.name || table); payload.image_url = uploaded; }
            const { error } = await hrSupabase.from(table).insert(payload);
            if (error) throw error;
        } catch (e) { if (uploaded) await deleteStorageImage(uploaded); throw e; }
        form.reset();
        await loadTable(table);
    };

    const addSchool = async form => {
        const data = formData(form), file = getFile(form);
        let uploaded = null;
        const payload = {
            code: String(data.code || "").trim(),
            name: String(data.name || "").trim(),
            description: String(data.description || "").trim() || null,
            active: form.querySelector('[name="active"]')?.checked !== false,
            image_url: null
        };
        if (!payload.code || !payload.name) throw new Error("School code and name are required.");
        try {
            if (file) { uploaded = await uploadImage(file, "schools", payload.code); payload.image_url = uploaded; }
            const { error } = await hrSupabase.from("schools").insert(payload);
            if (error) throw error;
        } catch (e) { if (uploaded) await deleteStorageImage(uploaded); throw e; }
        form.reset();
        await loadSchools();
    };

    const removeImage = async form => {
        const table = form.dataset.table;
        const id = form.dataset.id;
        const oldUrl = currentUrl(form);
        if (!oldUrl) { message("There is no image to remove.", "error"); return; }
        if (!confirm("Remove this image from the public site?")) return;
        const { error } = await hrSupabase.from(table).update({ image_url: null, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        await deleteStorageImage(oldUrl);
        if (table === "schools") await loadSchools(); else await loadTable(table);
    };

    const deleteItem = async form => {
        const table = form.dataset.table, id = form.dataset.id;
        if (!confirm("Delete this item permanently?")) return;
        const oldUrl = currentUrl(form);
        const { error } = await hrSupabase.from(table).delete().eq("id", id);
        if (error) throw error;
        if (oldUrl) await deleteStorageImage(oldUrl);
        if (table === "schools") await loadSchools(); else await loadTable(table);
    };

    const bind = () => {
        $("#director-form")?.addEventListener("submit", async e => {
            e.preventDefault();
            const button = e.submitter;
            try { setButton(button, true, "Saving…"); await saveDirector(e.currentTarget); message("Director content saved.", "success"); }
            catch (err) { console.error(err); message(err.message || "Unable to save Director content.", "error"); }
            finally { setButton(button, false); }
        });

        $("#director-remove-image")?.addEventListener("click", async () => {
            const form = $("#director-form"), oldUrl = $("#director-current-image")?.dataset.url || "";
            if (!form.dataset.id || !oldUrl) { message("There is no Director photograph to remove.", "error"); return; }
            if (!confirm("Remove the Director photograph?")) return;
            try {
                const { error } = await hrSupabase.from("homepage_director").update({ image_url: null, updated_at: new Date().toISOString() }).eq("id", form.dataset.id);
                if (error) throw error;
                await deleteStorageImage(oldUrl); await loadDirector(); message("Director photograph removed.", "success");
            } catch (err) { message(err.message, "error"); }
        });

        $("#school-add-form")?.addEventListener("submit", async e => {
            e.preventDefault(); const button = e.submitter;
            try { setButton(button, true, "Adding…"); await addSchool(e.currentTarget); message("School added successfully.", "success"); }
            catch (err) { console.error(err); message(err.message, "error"); }
            finally { setButton(button, false); }
        });

        $$(".content-add-form[data-table]").forEach(form => form.addEventListener("submit", async e => {
            e.preventDefault(); const button = e.submitter;
            try { setButton(button, true, "Adding…"); await addGeneric(e.currentTarget); message("Content added successfully.", "success"); }
            catch (err) { console.error(err); message(err.message, "error"); }
            finally { setButton(button, false); }
        }));

        document.addEventListener("submit", async e => {
            const form = e.target.closest(".content-item-form");
            if (!form) return;
            e.preventDefault(); const button = e.submitter;
            try {
                setButton(button, true, "Saving…");
                if (form.dataset.table === "schools") await saveSchool(form); else await saveGeneric(form);
                message("Content updated successfully.", "success");
            } catch (err) { console.error(err); message(err.message || "Unable to save content.", "error"); }
            finally { setButton(button, false); }
        });

        document.addEventListener("click", async e => {
            const remove = e.target.closest("[data-remove-image]"), del = e.target.closest("[data-delete]");
            if (!remove && !del) return;
            const form = e.target.closest(".content-item-form");
            if (!form) return;
            const button = e.target.closest("button");
            try {
                setButton(button, true, del ? "Deleting…" : "Removing…");
                if (del) await deleteItem(form); else await removeImage(form);
                message(del ? "Item deleted successfully." : "Image removed successfully.", "success");
            } catch (err) { console.error(err); message(err.message || "Operation failed.", "error"); }
            finally { setButton(button, false); }
        });
    };

    const init = async () => {
        if (!window.hrSupabase) return;
        try {
            await reloadAll();
            message("Content studio ready.", "success");
        } catch (e) {
            console.error(e);
            message(e.message || "Unable to load content management data.", "error");
        }
        bind();
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();