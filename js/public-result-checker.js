(() => {
    "use strict";

    const escapeHtml = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const formatValue = (value) => {
        if (value === null || value === undefined || value === "") {
            return "—";
        }

        return escapeHtml(value);
    };

    const initPublicResultChecker = () => {
        const form = document.querySelector("#public-result-form");
        const message = document.querySelector("#result-message");
        const output = document.querySelector("#result-output");
        const button = document.querySelector("#check-result-button");

        if (!form || !message || !output || !button) {
            return;
        }

        const setMessage = (text, type = "") => {
            message.textContent = text;
            message.className = `result-message ${type}`.trim();
        };

        const renderResults = (data) => {
            const student = data.student || {};
            const results = Array.isArray(data.results)
                ? data.results
                : [];

            const rows = results.map((result) => {
                const course = Array.isArray(result.courses)
                    ? (result.courses[0] || {})
                    : (result.courses || {});

                return `
                    <tr>
                        <td>
                            ${formatValue(
                                course.code ||
                                course.name ||
                                "Course"
                            )}
                        </td>

                        <td>
                            ${formatValue(result.semester)}
                        </td>

                        <td>
                            ${formatValue(result.examination)}
                        </td>

                        <td>
                            ${formatValue(result.academic_year)}
                        </td>

                        <td>
                            ${formatValue(result.ca_score)}
                        </td>

                        <td>
                            ${formatValue(result.exam_score)}
                        </td>

                        <td>
                            ${formatValue(result.total_score)}
                        </td>

                        <td>
                            <strong>
                                ${formatValue(result.grade)}
                            </strong>
                        </td>

                        <td>
                            ${formatValue(result.gp)}
                        </td>
                    </tr>
                `;
            }).join("");

            const first = results[0] || {};

            output.innerHTML = `
                <div class="result-student">

                    <div>
                        <small>Student</small>

                        <strong>
                            ${formatValue(student.full_name)}
                        </strong>
                    </div>

                    <div>
                        <small>
                            Matriculation number
                        </small>

                        <strong>
                            ${formatValue(student.matric_no)}
                        </strong>
                    </div>

                </div>

                <div class="result-table-wrap">

                    <table class="result-table">

                        <thead>
                            <tr>
                                <th>Course</th>
                                <th>Semester</th>
                                <th>Examination</th>
                                <th>Academic Year</th>
                                <th>CA</th>
                                <th>Exam</th>
                                <th>Total</th>
                                <th>Grade</th>
                                <th>GP</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${rows}
                        </tbody>

                    </table>

                </div>

                <div class="result-summary">

                    <div>
                        <span>GPA</span>
                        <b>
                            ${formatValue(first.gpa)}
                        </b>
                    </div>

                    <div>
                        <span>CGPA</span>
                        <b>
                            ${formatValue(first.cgpa)}
                        </b>
                    </div>

                    <div>
                        <span>Grade</span>
                        <b>
                            ${formatValue(first.grade)}
                        </b>
                    </div>

                </div>
            `;

            output.classList.add("visible");
        };

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            output.classList.remove("visible");
            output.innerHTML = "";

            setMessage("");

            const pin =
                document
                    .querySelector("#result-pin")
                    .value
                    .trim();

            const matricNo =
                document
                    .querySelector("#result-matric-no")
                    .value
                    .trim();

            const semester =
                document
                    .querySelector("#result-semester")
                    .value
                    .trim();

            const examination =
                document
                    .querySelector("#result-examination")
                    .value
                    .trim();

            const academicYear =
                document
                    .querySelector("#result-academic-year")
                    .value
                    .trim();

            /*
             * Result PIN must be exactly
             * 6 numeric digits.
             */
            if (!/^\d{6}$/.test(pin)) {
                setMessage(
                    "Enter the 6-digit result PIN.",
                    "error"
                );

                return;
            }

            /*
             * Make sure all required fields
             * have been completed.
             */
            if (
                !matricNo ||
                !semester ||
                !examination ||
                !academicYear
            ) {
                setMessage(
                    "Please complete all result-checker fields.",
                    "error"
                );

                return;
            }

            button.disabled = true;
            button.textContent = "Checking…";

            setMessage(
                "Checking the published result…"
            );

            try {
                const response = await fetch(
                    `${HR_CONFIG.SUPABASE_URL}/functions/v1/check-result`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json",

                            "apikey":
                                HR_CONFIG.SUPABASE_ANON_KEY
                        },

                        body: JSON.stringify({
                            pin: pin,

                            matric_no:
                                matricNo,

                            semester:
                                semester,

                            examination:
                                examination,

                            academic_year:
                                academicYear
                        })
                    }
                );

                const data =
                    await response
                        .json()
                        .catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        data.error ||
                        "Unable to check this result."
                    );
                }

                renderResults(data);

                setMessage(
                    "Result verified successfully.",
                    "success"
                );

            } catch (error) {

                setMessage(
                    error instanceof Error
                        ? error.message
                        : "Unable to check this result.",
                    "error"
                );

            } finally {

                button.disabled = false;

                button.textContent =
                    "Check Result →";
            }
        });
    };

    /*
     * Start after the page has loaded.
     */
    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initPublicResultChecker,
            { once: true }
        );

    } else {

        initPublicResultChecker();

    }

})();