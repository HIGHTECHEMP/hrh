document.addEventListener(
    "DOMContentLoaded",
    () => {

        const button =
            document.getElementById(
                "issue"
            );

        const quantityInput =
            document.getElementById(
                "quantity"
            );

        const expiryInput =
            document.getElementById(
                "expiry"
            );

        const message =
            document.getElementById(
                "msg"
            );

        const output =
            document.getElementById(
                "pin-output"
            );


        if (!button) return;


        button.addEventListener(
            "click",
            async () => {

                const quantity =
                    Number(
                        quantityInput.value
                    );


                if (
                    !Number.isInteger(
                        quantity
                    ) ||
                    quantity < 1 ||
                    quantity > 500
                ) {

                    message.textContent =
                        "Enter a whole number between 1 and 500.";

                    message.className =
                        "form-message error";

                    return;

                }


                button.disabled =
                    true;

                button.textContent =
                    "Generating PINs…";


                message.textContent =
                    "";


                output.style.display =
                    "none";

                output.innerHTML =
                    "";


                try {

                    const {
                        data: {
                            session
                        }
                    } =
                        await hrSupabase
                            .auth
                            .getSession();


                    if (!session) {

                        throw new Error(
                            "Your session has expired. Please log in again."
                        );

                    }


                    let expiresAt =
                        null;


                    const expiryDays =
                        Number(
                            expiryInput.value
                        );


                    if (
                        expiryDays > 0
                    ) {

                        expiresAt =
                            new Date(
                                Date.now() +
                                expiryDays *
                                24 *
                                60 *
                                60 *
                                1000
                            ).toISOString();

                    }


                    const response =
                        await fetch(
                            `${HR_CONFIG.SUPABASE_URL}/functions/v1/issue-pins`,
                            {

                                method:
                                    "POST",

                                headers: {

                                    "Content-Type":
                                        "application/json",

                                    "Authorization":
                                        `Bearer ${session.access_token}`,

                                    "apikey":
                                        HR_CONFIG.SUPABASE_ANON_KEY

                                },

                                body:
                                    JSON.stringify({

                                        quantity,

                                        expires_at:
                                            expiresAt

                                    })

                            }
                        );


                    const data =
                        await response
                            .json();


                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            data.error ||
                            "Unable to generate PINs."
                        );

                    }


                    if (
                        !Array.isArray(
                            data.pins
                        )
                    ) {

                        throw new Error(
                            "The server did not return the generated PINs."
                        );

                    }


                    /*
                     * Display the raw PINs.
                     *
                     * This is the only time they
                     * are available in the browser.
                     */
                    output.style.display =
                        "block";


                    output.innerHTML = `

                        <div
                            class="pin-output"
                            style="
                                margin-top:24px;
                                padding:24px;
                                border-radius:18px;
                                background:#f5f9ff;
                            "
                        >

                            <div
                                style="
                                    display:flex;
                                    justify-content:space-between;
                                    align-items:center;
                                    gap:16px;
                                    flex-wrap:wrap;
                                "
                            >

                                <div>

                                    <span class="eyebrow">
                                        GENERATED PIN BATCH
                                    </span>

                                    <h3>
                                        ${data.quantity} PINs
                                    </h3>

                                    <p>
                                        Each PIN can be used once only.
                                    </p>

                                </div>


                                <button
                                    type="button"
                                    class="btn ghost"
                                    id="print-pins"
                                >
                                    Print PINs
                                </button>

                            </div>


                            <div
                                class="pin-list"
                                style="
                                    display:grid;
                                    grid-template-columns:
                                        repeat(
                                            auto-fill,
                                            minmax(
                                                110px,
                                                1fr
                                            )
                                        );
                                    gap:10px;
                                    margin-top:20px;
                                "
                            >

                                ${data.pins
                                    .map(
                                        pin =>
                                            `
                                            <code
                                                style="
                                                    display:block;
                                                    padding:12px;
                                                    text-align:center;
                                                    font-size:1.1rem;
                                                    font-weight:800;
                                                    letter-spacing:.12em;
                                                    background:white;
                                                    border-radius:10px;
                                                "
                                            >
                                                ${pin}
                                            </code>
                                            `
                                    )
                                    .join("")}

                            </div>


                            <p
                                style="
                                    margin-top:18px;
                                    font-size:.9rem;
                                "
                            >
                                <strong>
                                    Important:
                                </strong>

                                Save or print these PINs now.
                                The raw PINs are not stored in the database
                                and cannot be recovered later.
                            </p>

                        </div>

                    `;


                    message.textContent =
                        `${data.quantity} unique 6-digit PINs generated successfully.`;

                    message.className =
                        "form-message success";


                    document
                        .getElementById(
                            "print-pins"
                        )
                        ?.addEventListener(
                            "click",
                            () => {

                                window.print();

                            }
                        );


                } catch (
                    error
                ) {

                    console.error(
                        error
                    );


                    message.textContent =
                        error.message ||
                        "Unable to generate PINs.";

                    message.className =
                        "form-message error";


                } finally {

                    button.disabled =
                        false;

                    button.textContent =
                        "Generate PINs";

                }

            }
        );

    }
);