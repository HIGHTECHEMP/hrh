(() => {
    "use strict";


    const $ =
        selector =>
            document.querySelector(selector);


    const esc =
        value =>
            String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");


    let courses = [];
    let schools = [];
    let lecturers = [];


    const message =
        (
            text,
            type = ""
        ) => {

            const box =
                $("#course-message");


            if (!box) {
                return;
            }


            box.textContent =
                text;


            box.className =
                `form-message ${type}`.trim();

        };


    const loadReferenceData =
        async () => {

            const [
                schoolResult,
                lecturerResult
            ] = await Promise.all([

                hrSupabase
                    .from("schools")
                    .select(
                        "id,code,name"
                    )
                    .eq(
                        "active",
                        true
                    )
                    .order("name"),


                hrSupabase
                    .from("profiles")
                    .select(
                        "id,full_name,email,staff_no,active"
                    )
                    .eq(
                        "role",
                        "lecturer"
                    )
                    .eq(
                        "active",
                        true
                    )
                    .order(
                        "full_name"
                    )

            ]);


            if (schoolResult.error) {
                throw schoolResult.error;
            }


            if (lecturerResult.error) {
                throw lecturerResult.error;
            }


            schools =
                schoolResult.data ||
                [];


            lecturers =
                lecturerResult.data ||
                [];


            $("#course-school").innerHTML =

                `
                    <option value="">
                        Select school
                    </option>
                `

                +

                schools
                    .map(
                        school => `

                            <option
                                value="${esc(school.id)}"
                            >

                                ${esc(
                                    school.name
                                )}

                            </option>

                        `
                    )
                    .join("");


            $("#course-lecturer").innerHTML =

                `
                    <option value="">
                        Unassigned
                    </option>
                `

                +

                lecturers
                    .map(
                        lecturer => `

                            <option
                                value="${esc(
                                    lecturer.id
                                )}"
                            >

                                ${esc(
                                    lecturer.full_name ||
                                    lecturer.email
                                )}

                                ${
                                    lecturer.staff_no
                                        ? ` — ${esc(
                                            lecturer.staff_no
                                        )}`
                                        : ""
                                }

                            </option>

                        `
                    )
                    .join("");

        };


    const loadCourses =
        async () => {

            const {
                data,
                error
            } = await hrSupabase
                .from("courses")
                .select(
                    "id,code,name,school_id,level,semester,lecturer_id,active"
                )
                .order("code");


            if (error) {
                throw error;
            }


            courses =
                data ||
                [];


            const list =
                $("#admin-course-list");


            if (!courses.length) {

                list.innerHTML = `
                    <div class="admin-empty">
                        No courses created yet.
                    </div>
                `;

                return;

            }


            list.innerHTML =
                courses
                    .map(
                        course => {

                            const school =
                                schools.find(
                                    item =>
                                        item.id ===
                                        course.school_id
                                );


                            const lecturer =
                                lecturers.find(
                                    item =>
                                        item.id ===
                                        course.lecturer_id
                                );


                            return `

                                <article
                                    class="admin-course-row"
                                >

                                    <div>

                                        <span class="eyebrow">
                                            ${esc(
                                                course.code
                                            )}
                                        </span>


                                        <h3>
                                            ${esc(
                                                course.name
                                            )}
                                        </h3>


                                        <p>

                                            ${esc(
                                                school?.name ||
                                                "No school"
                                            )}

                                            ·

                                            ${esc(
                                                course.level ||
                                                "Level not set"
                                            )}

                                            ·

                                            ${esc(
                                                course.semester ||
                                                "Semester not set"
                                            )}

                                        </p>

                                    </div>


                                    <div
                                        class="admin-course-assignee"
                                    >

                                        <span>
                                            Assigned lecturer
                                        </span>


                                        <strong>
                                            ${esc(
                                                lecturer?.full_name ||
                                                "Unassigned"
                                            )}
                                        </strong>

                                    </div>


                                    <div
                                        class="content-form-actions"
                                    >

                                        <button
                                            class="btn ghost"
                                            type="button"
                                            data-edit-course="${esc(
                                                course.id
                                            )}"
                                        >
                                            Edit / assign
                                        </button>


                                        <button
                                            class="btn danger"
                                            type="button"
                                            data-delete-course="${esc(
                                                course.id
                                            )}"
                                        >
                                            Delete
                                        </button>

                                    </div>

                                </article>

                            `;

                        }
                    )
                    .join("");

        };


    const resetForm =
        () => {

            $("#course-id").value =
                "";

            $("#course-code").value =
                "";

            $("#course-name").value =
                "";

            $("#course-school").value =
                "";

            $("#course-level").value =
                "";

            $("#course-semester").value =
                "";

            $("#course-lecturer").value =
                "";


            $("#save-course").textContent =
                "Create course & assign";


            $("#cancel-course").style.display =
                "none";

        };


    const editCourse =
        id => {

            const course =
                courses.find(
                    item =>
                        item.id === id
                );


            if (!course) {
                return;
            }


            $("#course-id").value =
                course.id;


            $("#course-code").value =
                course.code ||
                "";


            $("#course-name").value =
                course.name ||
                "";


            $("#course-school").value =
                course.school_id ||
                "";


            $("#course-level").value =
                course.level ||
                "";


            $("#course-semester").value =
                course.semester ||
                "";


            $("#course-lecturer").value =
                course.lecturer_id ||
                "";


            $("#save-course").textContent =
                "Save course & assignment";


            $("#cancel-course").style.display =
                "inline-flex";


            $("#course-form").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        };


    const saveCourse =
        async event => {

            event.preventDefault();


            const id =
                $("#course-id").value;


            const payload = {

                code:
                    $("#course-code")
                        .value
                        .trim(),

                name:
                    $("#course-name")
                        .value
                        .trim(),

                school_id:
                    $("#course-school")
                        .value ||
                    null,

                level:
                    $("#course-level")
                        .value
                        .trim() ||
                    null,

                semester:
                    $("#course-semester")
                        .value ||
                    null,

                lecturer_id:
                    $("#course-lecturer")
                        .value ||
                    null,

                active:
                    true

            };


            if (
                !payload.code ||
                !payload.name ||
                !payload.school_id
            ) {

                message(
                    "Course code, name and school are required.",
                    "error"
                );

                return;

            }


            const button =
                $("#save-course");


            button.disabled =
                true;


            button.textContent =
                "Saving…";


            try {

                let result;


                if (id) {

                    result =
                        await hrSupabase
                            .from("courses")
                            .update(payload)
                            .eq(
                                "id",
                                id
                            );

                } else {

                    result =
                        await hrSupabase
                            .from("courses")
                            .insert(
                                payload
                            );

                }


                if (result.error) {
                    throw result.error;
                }


                await loadCourses();


                resetForm();


                message(

                    payload.lecturer_id

                        ? "Course saved and lecturer assigned successfully."

                        : "Course saved without a lecturer assignment.",

                    "success"

                );

            } catch (error) {

                console.error(error);

                message(
                    error.message ||
                    "Unable to save course.",
                    "error"
                );

            } finally {

                button.disabled =
                    false;


                button.textContent =
                    id

                        ? "Save course & assignment"

                        : "Create course & assign";

            }

        };


    const init =
        async () => {

            if (!window.hrSupabase) {
                return;
            }


            try {

                await loadReferenceData();

                await loadCourses();

            } catch (error) {

                console.error(error);

                message(
                    error.message ||
                    "Unable to load course assignment data.",
                    "error"
                );

            }


            $("#course-form")
                ?.addEventListener(
                    "submit",
                    saveCourse
                );


            $("#cancel-course")
                ?.addEventListener(
                    "click",
                    resetForm
                );


            document.addEventListener(
                "click",
                async event => {

                    const edit =
                        event.target.closest(
                            "[data-edit-course]"
                        );


                    const del =
                        event.target.closest(
                            "[data-delete-course]"
                        );


                    try {

                        if (edit) {

                            editCourse(
                                edit.dataset
                                    .editCourse
                            );

                        }


                        if (del) {

                            const id =
                                del.dataset
                                    .deleteCourse;


                            if (
                                !confirm(
                                    "Delete this course? Existing result records may prevent deletion."
                                )
                            ) {
                                return;
                            }


                            const {
                                error
                            } = await hrSupabase
                                .from("courses")
                                .delete()
                                .eq(
                                    "id",
                                    id
                                );


                            if (error) {
                                throw error;
                            }


                            await loadCourses();


                            message(
                                "Course deleted.",
                                "success"
                            );

                        }

                    } catch (error) {

                        console.error(error);

                        message(
                            error.message ||
                            "Unable to complete course action.",
                            "error"
                        );

                    }

                }
            );

        };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );

    } else {

        init();

    }

})();