(() => {
    "use strict";

    const initLoader = () => {
        const loader = document.querySelector(".loader");

        if (!loader) {
            document.body.classList.add("page-ready");
            return;
        }

        const hideLoader = () => {
            loader.classList.add("loader-hidden");
            document.body.classList.add("page-ready");

            window.setTimeout(() => {
                loader.remove();
            }, 700);
        };

        if (document.readyState === "complete") {
            window.setTimeout(hideLoader, 450);
        } else {
            window.addEventListener("load", () => {
                window.setTimeout(hideLoader, 450);
            }, { once: true });
        }
    };

    const initNavigation = () => {
        const toggle = document.querySelector(".nav-toggle");
        const navigation = document.querySelector(".nav");

        if (!toggle || !navigation) {
            return;
        }

        toggle.setAttribute("aria-expanded", "false");

        toggle.addEventListener("click", () => {
            const isOpen = navigation.classList.toggle("open");

            toggle.setAttribute("aria-expanded", String(isOpen));
            toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
        });

        navigation.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                navigation.classList.remove("open");
                toggle.setAttribute("aria-expanded", "false");
                toggle.setAttribute("aria-label", "Open navigation");
            });
        });
    };

    const initRevealAnimations = () => {
        const revealElements = document.querySelectorAll(".reveal");

        if (!revealElements.length) {
            return;
        }

        if (!("IntersectionObserver" in window)) {
            revealElements.forEach((element) => {
                element.classList.add("visible");
            });

            return;
        }

        const observer = new IntersectionObserver((entries, currentObserver) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.add("visible");
                currentObserver.unobserve(entry.target);
            });
        }, {
            threshold: 0.12
        });

        revealElements.forEach((element) => {
            observer.observe(element);
        });
    };

    const initGallery = () => {
        const gallery = document.querySelector(".gallery");
        const windowElement = document.querySelector(".galleryWindow");
        const track = document.querySelector(".gallery .track");
        const slides = Array.from(document.querySelectorAll(".gallery .slide"));
        const previousButton = document.querySelector("#prev");
        const nextButton = document.querySelector("#next");

        if (
            !gallery ||
            !windowElement ||
            !track ||
            !slides.length ||
            !previousButton ||
            !nextButton
        ) {
            return;
        }

        let currentIndex = 0;
        let autoplayTimer = null;
        let isPointerDown = false;
        let startX = 0;
        let currentTranslate = 0;

        const prefersReducedMotion = window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const getStep = () => {
            const firstSlide = slides[0];

            if (!firstSlide) {
                return 0;
            }

            const slideWidth = firstSlide.getBoundingClientRect().width;
            const trackStyles = window.getComputedStyle(track);
            const gap = parseFloat(trackStyles.columnGap || trackStyles.gap || "0");

            return slideWidth + gap;
        };

        const updateButtons = () => {
            previousButton.disabled = currentIndex === 0;
            nextButton.disabled = currentIndex >= slides.length - 1;

            previousButton.setAttribute(
                "aria-label",
                currentIndex === 0 ? "Previous slide unavailable" : "Previous gallery slide"
            );

            nextButton.setAttribute(
                "aria-label",
                currentIndex >= slides.length - 1
                    ? "Next slide unavailable"
                    : "Next gallery slide"
            );
        };

        const updateGallery = (animate = true) => {
            const step = getStep();

            if (!step) {
                return;
            }

            currentTranslate = currentIndex * step;

            track.style.transition = animate
                ? "transform 650ms cubic-bezier(.22,.61,.36,1)"
                : "none";

            track.style.transform = `translate3d(-${currentTranslate}px, 0, 0)`;

            slides.forEach((slide, index) => {
                slide.setAttribute("aria-hidden", String(index !== currentIndex));
            });

            updateButtons();
        };

        const goToSlide = (index) => {
            currentIndex = Math.max(0, Math.min(index, slides.length - 1));
            updateGallery(true);
            restartAutoplay();
        };

        const stopAutoplay = () => {
            if (autoplayTimer !== null) {
                window.clearInterval(autoplayTimer);
                autoplayTimer = null;
            }
        };

        const startAutoplay = () => {
            if (prefersReducedMotion || slides.length < 2) {
                return;
            }

            stopAutoplay();

            autoplayTimer = window.setInterval(() => {
                if (currentIndex >= slides.length - 1) {
                    currentIndex = 0;
                } else {
                    currentIndex += 1;
                }

                updateGallery(true);
            }, 3500);
        };

        const restartAutoplay = () => {
            stopAutoplay();
            startAutoplay();
        };

        previousButton.addEventListener("click", () => {
            goToSlide(currentIndex - 1);
        });

        nextButton.addEventListener("click", () => {
            goToSlide(currentIndex + 1);
        });

        gallery.addEventListener("mouseenter", stopAutoplay);
        gallery.addEventListener("mouseleave", startAutoplay);
        gallery.addEventListener("focusin", stopAutoplay);
        gallery.addEventListener("focusout", startAutoplay);

        windowElement.addEventListener("pointerdown", (event) => {
            if (event.pointerType === "mouse" && event.button !== 0) {
                return;
            }

            isPointerDown = true;
            startX = event.clientX;
            windowElement.setPointerCapture?.(event.pointerId);
            track.style.transition = "none";
        });

        windowElement.addEventListener("pointerup", (event) => {
            if (!isPointerDown) {
                return;
            }

            isPointerDown = false;

            const distance = event.clientX - startX;

            if (Math.abs(distance) > 55) {
                if (distance < 0) {
                    goToSlide(currentIndex + 1);
                } else {
                    goToSlide(currentIndex - 1);
                }
            } else {
                updateGallery(true);
            }
        });

        windowElement.addEventListener("pointercancel", () => {
            isPointerDown = false;
            updateGallery(true);
        });

        window.addEventListener("resize", () => {
            updateGallery(false);
        });

        updateGallery(false);
        startAutoplay();
    };

  const init = () => {
    initLoader();
    initNavigation();
    initRevealAnimations();
    initGallery();
};


/*
 * The public homepage gallery is now loaded dynamically
 * from Admin Content. When Supabase finishes loading
 * the gallery, initialize the gallery controls again.
 */
window.addEventListener(
    "homepage-content-ready",
    () => {
        initGallery();
        initRevealAnimations();
    }
);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    };
})();