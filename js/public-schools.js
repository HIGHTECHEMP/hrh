(() => {
    "use strict";

    const loadSchoolImages = async () => {

        if (!window.hrSupabase) {
            return;
        }

        const {
            data,
            error
        } = await hrSupabase
            .from("schools")
            .select("code,image_url")
            .eq("active", true);

        if (error) {
            console.error(
                "Unable to load school images:",
                error
            );

            return;
        }

        (data || []).forEach(school => {

            if (!school.image_url) {
                return;
            }

            const element =
                document.querySelector(
                    `[data-school-code="${CSS.escape(school.code)}"]`
                );

            if (!element) {
                return;
            }

            element.style.backgroundImage =
                `url("${school.image_url}")`;

            element.classList.add(
                "school-image-loaded"
            );

        });
    };


    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            loadSchoolImages,
            { once: true }
        );

    } else {

        loadSchoolImages();

    }

})();