(() => {
    "use strict";

    const BUCKET = "school-images";

    const escapeHtml = (value) =>
        String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");


    const setMessage = (text, type = "") => {
        const box = document.querySelector("#school-message");

        if (!box) return;

        box.textContent = text;
        box.className = `form-message ${type}`.trim();
    };


    const loadSchools = async () => {

        const container = document.querySelector("#schools-list");

        if (!container) return;

        const {
            data,
            error
        } = await hrSupabase
            .from("schools")
            .select("id,code,name,description,image_url,active")
            .order("name");

        if (error) {
            container.innerHTML = `
                <div class="admin-error">
                    Unable to load schools.<br>
                    ${escapeHtml(error.message)}
                </div>
            `;

            return;
        }


        const schools = (data || []).filter(
            school => school.active !== false
        );


        if (!schools.length) {

            container.innerHTML = `
                <div class="admin-empty">
                    No schools found.
                </div>
            `;

            return;
        }


        container.innerHTML = schools.map(school => {

            const image = school.image_url
                ? `
                    <img
                        src="${escapeHtml(school.image_url)}"
                        alt="${escapeHtml(school.name)}"
                        class="school-admin-preview"
                    >
                `
                : `
                    <div class="school-admin-placeholder">
                        <span>✚</span>
                        <small>No image uploaded</small>
                    </div>
                `;


            return `
                <article
                    class="admin-school-card"
                    data-school-id="${escapeHtml(school.id)}"
                    data-school-code="${escapeHtml(school.code)}"
                >

                    <div class="admin-school-image">
                        ${image}
                    </div>

                    <div class="admin-school-body">

                        <span class="eyebrow">
                            ${escapeHtml(school.code)}
                        </span>

                        <h3>
                            ${escapeHtml(school.name)}
                        </h3>

                        <p class="muted">
                            ${escapeHtml(
                                school.description ||
                                "School information"
                            )}
                        </p>


                        <label class="upload-label">

                            <span>
                                Choose photograph
                            </span>

                            <input
                                type="file"
                                class="school-image-input"
                                accept="image/jpeg,image/png,image/webp"
                                data-school-id="${escapeHtml(school.id)}"
                            >

                        </label>


                        <button
                            type="button"
                            class="btn primary upload-school-image"
                            data-school-id="${escapeHtml(school.id)}"
                        >
                            Upload photograph
                        </button>

                        <p
                            class="upload-status"
                            data-status-for="${escapeHtml(school.id)}"
                        ></p>

                    </div>

                </article>
            `;

        }).join("");


        bindUploadButtons();
    };


    const bindUploadButtons = () => {

        document
            .querySelectorAll(".upload-school-image")
            .forEach(button => {

                button.addEventListener("click", async () => {

                    const schoolId = button.dataset.schoolId;

                    const input = document.querySelector(
                        `.school-image-input[data-school-id="${CSS.escape(schoolId)}"]`
                    );

                    const status = document.querySelector(
                        `[data-status-for="${CSS.escape(schoolId)}"]`
                    );


                    if (!input?.files?.length) {

                        status.textContent =
                            "Please choose an image first.";

                        status.className =
                            "upload-status error";

                        return;
                    }


                    const file = input.files[0];


                    if (!file.type.startsWith("image/")) {

                        status.textContent =
                            "Please select an image file.";

                        status.className =
                            "upload-status error";

                        return;
                    }


                    if (file.size > 5 * 1024 * 1024) {

                        status.textContent =
                            "Image must be 5MB or smaller.";

                        status.className =
                            "upload-status error";

                        return;
                    }


                    button.disabled = true;
                    button.textContent = "Uploading…";

                    status.textContent =
                        "Uploading photograph…";

                    status.className =
                        "upload-status";


                    try {

                        const extension =
                            file.name
                                .split(".")
                                .pop()
                                .toLowerCase();


                        const safeExtension =
                            ["jpg", "jpeg", "png", "webp"]
                                .includes(extension)
                                ? extension
                                : "jpg";


                        const filePath =
                            `schools/${schoolId}-${Date.now()}.${safeExtension}`;


                        const {
                            error: uploadError
                        } = await hrSupabase.storage
                            .from(BUCKET)
                            .upload(
                                filePath,
                                file,
                                {
                                    cacheControl: "3600",
                                    upsert: false,
                                    contentType: file.type
                                }
                            );


                        if (uploadError) {
                            throw uploadError;
                        }


                        const {
                            data: publicData
                        } = hrSupabase.storage
                            .from(BUCKET)
                            .getPublicUrl(filePath);


                        const imageUrl =
                            publicData.publicUrl;


                        const {
                            error: updateError
                        } = await hrSupabase
                            .from("schools")
                            .update({
                                image_url: imageUrl,
                                // updated_at: new Date().toISOString()
                            })
                            .eq("id", schoolId);


                        /*
                         * If your schools table does not yet have
                         * updated_at, remove the updated_at line above.
                         */

                        if (updateError) {
                            throw updateError;
                        }


                        status.textContent =
                            "Photograph uploaded successfully.";

                        status.className =
                            "upload-status success";


                        await loadSchools();

                        setMessage(
                            "School photograph updated successfully.",
                            "success"
                        );

                    } catch (error) {

                        console.error(error);

                        status.textContent =
                            error.message ||
                            "Upload failed.";

                        status.className =
                            "upload-status error";

                    } finally {

                        button.disabled = false;
                        button.textContent =
                            "Upload photograph";
                    }

                });

            });

    };


    const init = async () => {

        if (!window.hrSupabase) {
            return;
        }

        await loadSchools();
    };


    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );

    } else {

        init();

    }

})();