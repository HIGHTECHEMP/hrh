(() => {
  "use strict";

  const supabaseClient = window.hrSupabase || null;

  let currentUser = null;
  let currentProfile = null;
  let feeCatalog = [];
  let successfulPayments = [];
  let allocations = [];

  const money = (amount, currency = "NGN") => {
    return Number(amount || 0).toLocaleString("en-NG", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    });
  };

  const escapeHtml = (value) => {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  function showMessage(message, type = "") {
    const el = document.getElementById("payment-message");
    if (!el) return;

    el.textContent = message || "";
    el.className = `form-message ${type}`.trim();
  }

  function getCategory(fee) {
    return String(fee.category || "").toLowerCase();
  }

  function isExaminationFee(fee) {
    return getCategory(fee) === "examination";
  }

  function isSchoolFee(fee) {
    return getCategory(fee) === "school_fees";
  }

  function isResultPin(fee) {
    return getCategory(fee) === "result_pin";
  }

  function getExamType(fee) {
    return String(
      fee.exam_type ||
      fee.name ||
      ""
    ).trim();
  }

  function feeAllocations(fee) {
    return allocations.filter(
      (row) =>
        row.fee_id === fee.id &&
        row.level === currentProfile?.current_level
    );
  }

  function paidForExam(fee) {
    const configuredType = getExamType(fee);

    return feeAllocations(fee)
      .filter(
        (row) =>
          row.allocation_type === "examination" &&
          String(row.exam_type || "").trim() === configuredType
      )
      .reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0
      );
  }

  function schoolFeeState(fee) {
    const annual = Number(fee.amount || 0);
    const half = Math.round((annual / 2) * 100) / 100;

    const rows = feeAllocations(fee).filter(
      (row) => row.allocation_type === "school_fee"
    );

    const firstPaid = rows
      .filter((row) => row.semester === "First Semester")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const secondPaid = rows
      .filter((row) => row.semester === "Second Semester")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const firstDue = half;
    const secondDue = Math.round((annual - half) * 100) / 100;

    const firstOutstanding = Math.max(
      0,
      Math.round((firstDue - firstPaid) * 100) / 100
    );

    const secondOutstanding = Math.max(
      0,
      Math.round((secondDue - secondPaid) * 100) / 100
    );

    const totalPaid = firstPaid + secondPaid;
    const totalOutstanding = Math.max(
      0,
      Math.round((annual - totalPaid) * 100) / 100
    );

    return {
      annual,
      firstPaid,
      secondPaid,
      firstOutstanding,
      secondOutstanding,
      totalPaid,
      totalOutstanding,
      fullyPaid: totalOutstanding <= 0.01,
    };
  }

  async function loadCurrentUser() {
    if (!supabaseClient) {
      throw new Error("Supabase client is not available.");
    }

    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
      window.location.href = "login.html";
      return null;
    }

    currentUser = user;
    return user;
  }

  async function loadProfile() {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        matric_no,
        current_level,
        school_id,
        role,
        active
      `)
      .eq("id", currentUser.id)
      .single();

    if (error) {
      throw new Error(
        error.message || "Unable to load student profile."
      );
    }

    currentProfile = data;

    const welcome = document.getElementById("welcome");

    if (welcome) {
      welcome.textContent =
        `${data.full_name || "Student"} • ` +
        `${data.matric_no || "No examination number"} • ` +
        `${data.current_level || "Level not assigned"}`;
    }
  }

  async function loadPaymentState() {
    successfulPayments = [];
    allocations = [];

    const {
      data: payments,
      error: paymentError,
    } = await supabaseClient
      .from("payments")
      .select(`
        id,
        tx_ref,
        purpose,
        amount,
        currency,
        status,
        receipt_no,
        paid_at,
        created_at,
        fee_id,
        metadata
      `)
      .eq("payer_user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (paymentError) {
      console.error(
        "Payment history error:",
        paymentError
      );
      return;
    }

    successfulPayments = (payments || []).filter(
      (payment) => payment.status === "successful"
    );

    const successfulIds = successfulPayments.map(
      (payment) => payment.id
    );

    if (!successfulIds.length) {
      return;
    }

    const {
      data: allocationData,
      error: allocationError,
    } = await supabaseClient
      .from("payment_allocations")
      .select(`
        payment_id,
        payer_user_id,
        fee_id,
        allocation_type,
        semester,
        level,
        exam_type,
        amount
      `)
      .eq("payer_user_id", currentUser.id)
      .in("payment_id", successfulIds);

    if (allocationError) {
      console.error(
        "Payment allocation error:",
        allocationError
      );
      return;
    }

    allocations = allocationData || [];
  }

  async function loadFees() {
    const {
      data,
      error,
    } = await supabaseClient
      .from("fee_catalog")
      .select(`
        id,
        code,
        name,
        category,
        description,
        amount,
        currency,
        active,
        school_id,
        level,
        exam_type
      `)
      .eq("active", true)
      .order("name");

    if (error) {
      throw new Error(
        error.message || "Unable to load available fees."
      );
    }

    feeCatalog = (data || []).filter((fee) => {
      const category = getCategory(fee);

      if (
        category === "admission" ||
        category === "acceptance" ||
        String(fee.code || "")
          .toLowerCase()
          .includes("admission")
      ) {
        return false;
      }

      if (
        fee.school_id &&
        currentProfile.school_id &&
        fee.school_id !== currentProfile.school_id
      ) {
        return false;
      }

      if (
        fee.level &&
        currentProfile.current_level &&
        fee.level !== currentProfile.current_level
      ) {
        return false;
      }

      if (
        category === "examination" &&
        !currentProfile.current_level
      ) {
        return false;
      }

      return true;
    });

    renderFees();
  }

  function renderFees() {
    const container = document.getElementById("fee-list");

    if (!container) return;

    const cards = [];

    let visiblePaymentOption = false;

    for (const fee of feeCatalog) {
      if (isSchoolFee(fee)) {
        const state = schoolFeeState(fee);

        if (state.fullyPaid) {
          cards.push(`
            <article class="fee-card fee-card-paid">
              <div class="fee-card-top">
                <div>
                  <span class="eyebrow">SCHOOL FEES</span>
                  <h3>${escapeHtml(fee.name)}</h3>
                </div>
                <span class="payment-status paid">PAID</span>
              </div>

              <div class="fee-paid-message">
                <div class="fee-paid-icon">✓</div>
                <div>
                  <strong>School fees fully paid</strong>
                  <p>
                    Your ${escapeHtml(
                      currentProfile.current_level || ""
                    )} school fees have been fully paid.
                    The payment option will become available again
                    after Registry promotes you to the next level.
                  </p>
                </div>
              </div>
            </article>
          `);

          continue;
        }

        visiblePaymentOption = true;

        const options = [];

        if (state.firstOutstanding > 0.01) {
          options.push(
            `<option value="First Semester">First Semester</option>`
          );
        }

        if (state.secondOutstanding > 0.01) {
          options.push(
            `<option value="Second Semester">Second Semester</option>`
          );
        }

        if (
          state.firstOutstanding > 0.01 &&
          state.secondOutstanding > 0.01
        ) {
          options.push(
            `<option value="Both Semesters">Both Semesters</option>`
          );
        }

        const firstText =
          state.firstOutstanding <= 0.01
            ? "First Semester: Paid"
            : `First Semester: ${money(
                state.firstPaid,
                fee.currency || "NGN"
              )} paid`;

        const secondText =
          state.secondOutstanding <= 0.01
            ? "Second Semester: Paid"
            : `Second Semester: ${money(
                state.secondPaid,
                fee.currency || "NGN"
              )} paid`;

        cards.push(`
          <article class="fee-card fee-card-school">
            <div class="fee-card-top">
              <div>
                <span class="eyebrow">SCHOOL FEES</span>
                <h3>${escapeHtml(fee.name)}</h3>
              </div>

              <span class="fee-level">
                ${escapeHtml(currentProfile.current_level || "")}
              </span>
            </div>

            <p class="fee-description">
              ${escapeHtml(
                fee.description ||
                "School fee payment for your current registered level."
              )}
            </p>

            <div class="fee-progress">
              <div>
                <span>Annual fee</span>
                <strong>${money(
                  state.annual,
                  fee.currency || "NGN"
                )}</strong>
              </div>

              <div>
                <span>Paid so far</span>
                <strong>${money(
                  state.totalPaid,
                  fee.currency || "NGN"
                )}</strong>
              </div>

              <div>
                <span>Outstanding</span>
                <strong>${money(
                  state.totalOutstanding,
                  fee.currency || "NGN"
                )}</strong>
              </div>
            </div>

            <div class="semester-status-row">
              <span>${escapeHtml(firstText)}</span>
              <span>${escapeHtml(secondText)}</span>
            </div>

            <div class="fee-payment-form">
              <label>
                Payment period
                <select
                  class="school-semester"
                  data-fee-id="${fee.id}"
                >
                  ${options.join("")}
                </select>
              </label>

              <label>
                Amount to pay
                <input
                  class="school-amount"
                  data-fee-id="${fee.id}"
                  type="number"
                  min="1"
                  step="0.01"
                  inputmode="decimal"
                  placeholder="Enter amount"
                >
              </label>
            </div>

            <div class="fee-outstanding-note" id="school-note-${fee.id}">
              Select a payment period to see the maximum outstanding amount.
            </div>

            <button
              type="button"
              class="btn primary pay-fee-btn"
              data-fee-id="${fee.id}"
              data-fee-type="school"
            >
              Pay school fees
            </button>
          </article>
        `);

        continue;
      }

      if (isExaminationFee(fee)) {
        const paid = paidForExam(fee);
        const officialAmount = Number(fee.amount || 0);
        const outstanding = Math.max(
          0,
          officialAmount - paid
        );

        const examType = getExamType(fee);

        if (outstanding <= 0.01) {
          cards.push(`
            <article class="fee-card fee-card-paid">
              <div class="fee-card-top">
                <div>
                  <span class="eyebrow">EXAMINATION</span>
                  <h3>${escapeHtml(fee.name)}</h3>
                </div>

                <span class="payment-status paid">PAID</span>
              </div>

              <div class="fee-paid-message">
                <div class="fee-paid-icon">✓</div>
                <div>
                  <strong>
                    Examination fee paid
                  </strong>
                  <p>
                    Your examination fee for
                    <strong>${escapeHtml(examType)}</strong>
                    has already been paid.
                  </p>
                </div>
              </div>
            </article>
          `);

          continue;
        }

        visiblePaymentOption = true;

        cards.push(`
          <article class="fee-card">
            <div class="fee-card-top">
              <div>
                <span class="eyebrow">EXAMINATION</span>
                <h3>${escapeHtml(fee.name)}</h3>
              </div>

              <span class="fee-level">
                ${escapeHtml(currentProfile.current_level || "")}
              </span>
            </div>

            <p class="fee-description">
              ${escapeHtml(
                fee.description ||
                "Official examination fee configured by the school."
              )}
            </p>

            <div class="official-fee-box">
              <span>Official fee</span>
              <strong>
                ${money(
                  officialAmount,
                  fee.currency || "NGN"
                )}
              </strong>
            </div>

            <div class="fee-note">
              This amount is fixed by the school and cannot be changed.
            </div>

            <button
              type="button"
              class="btn primary pay-fee-btn"
              data-fee-id="${fee.id}"
              data-fee-type="examination"
            >
              Pay ${money(
                officialAmount,
                fee.currency || "NGN"
              )}
            </button>
          </article>
        `);

        continue;
      }

      if (isResultPin(fee)) {
        visiblePaymentOption = true;

        cards.push(`
          <article class="fee-card">
            <div class="fee-card-top">
              <div>
                <span class="eyebrow">RESULT CHECKER</span>
                <h3>${escapeHtml(fee.name)}</h3>
              </div>

              <span class="secure-badge">Secure</span>
            </div>

            <p class="fee-description">
              ${escapeHtml(
                fee.description ||
                "Purchase a result checker PIN after successful payment."
              )}
            </p>

            <div class="official-fee-box">
              <span>Official fee</span>
              <strong>
                ${money(
                  Number(fee.amount || 0),
                  fee.currency || "NGN"
                )}
              </strong>
            </div>

            <div class="fee-note">
              After successful payment, present your receipt to Registry
              to receive your result-checker PIN.
            </div>

            <button
              type="button"
              class="btn primary pay-fee-btn"
              data-fee-id="${fee.id}"
              data-fee-type="result_pin"
            >
              Pay ${money(
                Number(fee.amount || 0),
                fee.currency || "NGN"
              )}
            </button>
          </article>
        `);
      }
    }

    if (!cards.length) {
      container.innerHTML = `
        <div class="payment-empty-state">
          <div class="payment-empty-icon">✓</div>
          <h3>No payment is currently due</h3>
          <p>
            Your current fees have been fully settled or no approved
            payment is currently available for your registered level.
          </p>
        </div>
      `;

      return;
    }

    container.innerHTML = cards.join("");

    bindFeeControls();
  }

  function getSchoolOutstanding(feeId, semester) {
    const fee = feeCatalog.find(
      (item) => item.id === feeId
    );

    if (!fee) return 0;

    const state = schoolFeeState(fee);

    if (semester === "First Semester") {
      return state.firstOutstanding;
    }

    if (semester === "Second Semester") {
      return state.secondOutstanding;
    }

    if (semester === "Both Semesters") {
      return state.firstOutstanding +
        state.secondOutstanding;
    }

    return 0;
  }

  function updateSchoolAmount(feeId) {
    const select = document.querySelector(
      `.school-semester[data-fee-id="${CSS.escape(feeId)}"]`
    );

    const input = document.querySelector(
      `.school-amount[data-fee-id="${CSS.escape(feeId)}"]`
    );

    const note = document.getElementById(
      `school-note-${feeId}`
    );

    if (!select || !input) return;

    const outstanding = getSchoolOutstanding(
      feeId,
      select.value
    );

    input.max = String(outstanding);

    if (
      Number(input.value || 0) >
      outstanding
    ) {
      input.value = outstanding;
    }

    if (note) {
      note.textContent =
        `Maximum outstanding for ${select.value}: ` +
        money(outstanding, "NGN");
    }
  }

  function bindFeeControls() {
    document
      .querySelectorAll(".school-semester")
      .forEach((select) => {
        select.addEventListener("change", () => {
          updateSchoolAmount(select.dataset.feeId);
        });

        updateSchoolAmount(select.dataset.feeId);
      });

    document
      .querySelectorAll(".pay-fee-btn")
      .forEach((button) => {
        button.addEventListener("click", () => {
          handlePayment(button);
        });
      });
  }

  async function handlePayment(button) {
    const feeId = button.dataset.feeId;
    const feeType = button.dataset.feeType;

    const fee = feeCatalog.find(
      (item) => item.id === feeId
    );

    if (!fee) {
      showMessage("The selected fee could not be found.", "error");
      return;
    }

    button.disabled = true;
    showMessage("Preparing secure payment…", "");

    try {
      const payload = {
        fee_id: fee.id,
        reference: `STUDENT-${currentProfile.matric_no || currentUser.id}`,
        return_url: new URL(
          "payment-return.html",
          window.location.href
        ).href,
      };

      if (feeType === "school") {
        const select = document.querySelector(
          `.school-semester[data-fee-id="${CSS.escape(fee.id)}"]`
        );

        const amountInput = document.querySelector(
          `.school-amount[data-fee-id="${CSS.escape(fee.id)}"]`
        );

        const semester = select?.value || "";
        const amount = Number(amountInput?.value || 0);

        if (!semester) {
          throw new Error(
            "Select the school-fee payment period."
          );
        }

        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error(
            "Enter the amount you want to pay."
          );
        }

        const maxOutstanding =
          getSchoolOutstanding(
            fee.id,
            semester
          );

        if (amount > maxOutstanding + 0.01) {
          throw new Error(
            `The maximum outstanding amount for this selection is ${money(
              maxOutstanding,
              fee.currency || "NGN"
            )}.`
          );
        }

        payload.semesters =
          semester === "Both Semesters"
            ? [
                "First Semester",
                "Second Semester",
              ]
            : [semester];

        payload.amount = amount;
      }

      if (feeType === "examination") {
        const examType = getExamType(fee);

        payload.exam_type = examType;
        payload.amount = Number(fee.amount);
      }

      if (feeType === "result_pin") {
        payload.amount = Number(fee.amount);
      }

      const {
        data,
        error,
      } = await supabaseClient.functions.invoke(
        "create-checkout",
        {
          body: payload,
        }
      );

      if (error) {
        throw new Error(
          error.message ||
          "Unable to create the payment."
        );
      }

      if (!data?.link) {
        throw new Error(
          data?.error ||
          "Flutterwave did not return a checkout link."
        );
      }

      /*
       * Keep the browser in the same tab.
       * Flutterwave will redirect to the exact payment-return.html
       * path we sent above.
       */
      window.location.assign(data.link);
    } catch (error) {
      console.error(
        "Payment creation error:",
        error
      );

      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to start payment.",
        "error"
      );

      button.disabled = false;
    }
  }

  async function reconcilePendingPayment(payment) {
    if (!payment?.tx_ref) return false;

    try {
      const {
        data,
        error,
      } = await supabaseClient.functions.invoke(
        "payment-status",
        {
          body: {
            tx_ref: payment.tx_ref,
            transaction_id:
              payment.flutterwave_transaction_id ||
              null,
          },
        }
      );

      if (error) {
        console.warn(
          "Payment reconciliation failed:",
          error
        );
        return false;
      }

      return (
        data?.status === "successful" ||
        data?.payment?.status === "successful"
      );
    } catch (error) {
      console.warn(
        "Payment reconciliation exception:",
        error
      );
      return false;
    }
  }

  async function loadPaymentHistory() {
    const container =
      document.getElementById(
        "payment-history"
      );

    if (!container) return;

    const {
      data: payments,
      error,
    } = await supabaseClient
      .from("payments")
      .select(`
        id,
        tx_ref,
        purpose,
        amount,
        currency,
        status,
        receipt_no,
        paid_at,
        created_at,
        fee_id,
        metadata
      `)
      .eq("payer_user_id", currentUser.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(50);

    if (error) {
      container.innerHTML = `
        <div class="payment-history-error">
          Unable to load payment history.
        </div>
      `;
      return;
    }

    /*
     * Reconcile pending records once when the page loads.
     * This means a successful Flutterwave payment won't remain
     * permanently stuck as "Pending" just because the redirect
     * or webhook was missed.
     */
    const pending = (payments || []).filter(
      (payment) =>
        payment.status === "pending"
    );

    if (pending.length) {
      await Promise.all(
        pending.slice(0, 5).map(
          (payment) =>
            reconcilePendingPayment(payment)
        )
      );

      /*
       * Reload after reconciliation so the displayed status is
       * the actual database status.
       */
      const {
        data: refreshed,
      } = await supabaseClient
        .from("payments")
        .select(`
          id,
          tx_ref,
          purpose,
          amount,
          currency,
          status,
          receipt_no,
          paid_at,
          created_at,
          fee_id,
          metadata
        `)
        .eq("payer_user_id", currentUser.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(50);

      if (refreshed) {
        payments.splice(
          0,
          payments.length,
          ...refreshed
        );
      }
    }

    if (!payments?.length) {
      container.innerHTML = `
        <div class="payment-history-empty">
          <div class="payment-empty-icon">₦</div>
          <strong>No payments yet</strong>
          <span>Your payment receipts will appear here.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = payments
      .map((payment) => {
        const status =
          String(payment.status || "pending")
            .toLowerCase();

        const statusLabel =
          status === "successful"
            ? "Successful"
            : status === "failed"
              ? "Failed"
              : "Pending";

        const purpose =
          payment.metadata?.fee_name ||
          payment.purpose ||
          "Payment";

        const date = payment.paid_at ||
          payment.created_at;

        return `
          <div class="payment-history-item">
            <div class="payment-history-icon">
              ${
                status === "successful"
                  ? "✓"
                  : status === "failed"
                    ? "!"
                    : "…"
              }
            </div>

            <div class="payment-history-main">
              <strong>
                ${escapeHtml(purpose)}
              </strong>

              <span>
                ${new Date(date).toLocaleString(
                  "en-NG"
                )}
              </span>

              <small>
                Ref: ${escapeHtml(
                  payment.tx_ref || "—"
                )}
              </small>
            </div>

            <div class="payment-history-amount">
              <strong>
                ${money(
                  payment.amount,
                  payment.currency || "NGN"
                )}
              </strong>

              <span
                class="payment-status ${status}"
              >
                ${statusLabel}
              </span>

              ${
                status === "successful"
                  ? `
                    <button
                      type="button"
                      class="receipt-btn"
                      data-payment-id="${payment.id}"
                    >
                      View receipt
                    </button>
                  `
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");

    container
      .querySelectorAll(".receipt-btn")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            const payment = payments.find(
              (item) =>
                item.id ===
                button.dataset.paymentId
            );

            if (payment) {
              showReceipt(payment);
            }
          }
        );
      });
  }

  function showReceipt(payment) {
    const existing =
      document.getElementById(
        "payment-receipt-modal"
      );

    existing?.remove();

    const purpose =
      payment.metadata?.fee_name ||
      payment.purpose ||
      "Payment";

    const modal =
      document.createElement("div");

    modal.id =
      "payment-receipt-modal";

    modal.className =
      "payment-receipt-modal";

    modal.innerHTML = `
      <div class="payment-receipt-backdrop"></div>

      <div class="payment-receipt-dialog">
        <div class="receipt-header">
          <div>
            <span class="eyebrow">
              HOLY ROSARY
            </span>

            <h2>Payment Receipt</h2>
          </div>

          <button
            type="button"
            class="receipt-close"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div class="receipt-success">
          <div>✓</div>
          <strong>Payment Successful</strong>
          <span>
            This receipt confirms your payment.
          </span>
        </div>

        <div class="receipt-details">
          <div>
            <span>Student</span>
            <strong>
              ${escapeHtml(
                currentProfile.full_name
              )}
            </strong>
          </div>

          <div>
            <span>Examination No.</span>
            <strong>
              ${escapeHtml(
                currentProfile.matric_no ||
                "—"
              )}
            </strong>
          </div>

          <div>
            <span>Payment</span>
            <strong>
              ${escapeHtml(purpose)}
            </strong>
          </div>

          <div>
            <span>Amount</span>
            <strong>
              ${money(
                payment.amount,
                payment.currency || "NGN"
              )}
            </strong>
          </div>

          <div>
            <span>Receipt No.</span>
            <strong>
              ${escapeHtml(
                payment.receipt_no || "—"
              )}
            </strong>
          </div>

          <div>
            <span>Transaction Ref.</span>
            <strong>
              ${escapeHtml(
                payment.tx_ref || "—"
              )}
            </strong>
          </div>

          <div>
            <span>Date</span>
            <strong>
              ${new Date(
                payment.paid_at ||
                payment.created_at
              ).toLocaleString("en-NG")}
            </strong>
          </div>

          <div>
            <span>Status</span>
            <strong class="receipt-paid">
              Successful
            </strong>
          </div>
        </div>

        <div class="receipt-footer">
          Present this receipt to Registry where required.
        </div>

        <div class="receipt-actions">
          <button
            type="button"
            class="btn ghost receipt-close"
          >
            Close
          </button>

          <button
            type="button"
            class="btn primary"
            id="print-payment-receipt"
          >
            Print receipt
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal
      .querySelectorAll(".receipt-close")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => modal.remove()
        );
      });

    modal
      .querySelector(
        ".payment-receipt-backdrop"
      )
      ?.addEventListener(
        "click",
        () => modal.remove()
      );

    modal
      .querySelector(
        "#print-payment-receipt"
      )
      ?.addEventListener(
        "click",
        () => printReceipt(payment)
      );
  }

  function printReceipt(payment) {
    const purpose =
      payment.metadata?.fee_name ||
      payment.purpose ||
      "Payment";

    const receipt = `
      <!doctype html>
      <html>
      <head>
        <title>Holy Rosary Payment Receipt</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #10223d;
          }
          .receipt {
            max-width: 680px;
            margin: auto;
            border: 1px solid #dbe5f1;
            border-radius: 18px;
            padding: 30px;
          }
          h1 { margin: 0 0 5px; }
          .muted { color: #6c7d93; }
          .success {
            margin: 24px 0;
            padding: 15px;
            border-radius: 12px;
            background: #edf9f1;
            color: #17733c;
            font-weight: 700;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding: 12px 0;
            border-bottom: 1px solid #edf1f6;
          }
          .row span {
            color: #718198;
          }
          .row strong {
            text-align: right;
          }
          @media print {
            body { padding: 0; }
            .receipt { border: 0; }
          }
        </style>
      </head>

      <body>
        <div class="receipt">
          <h1>Holy Rosary Hospital Emekuku</h1>
          <div class="muted">Official Student Payment Receipt</div>

          <div class="success">
            PAYMENT SUCCESSFUL
          </div>

          <div class="row">
            <span>Student</span>
            <strong>${escapeHtml(
              currentProfile.full_name
            )}</strong>
          </div>

          <div class="row">
            <span>Examination No.</span>
            <strong>${escapeHtml(
              currentProfile.matric_no || "—"
            )}</strong>
          </div>

          <div class="row">
            <span>Payment</span>
            <strong>${escapeHtml(
              purpose
            )}</strong>
          </div>

          <div class="row">
            <span>Amount</span>
            <strong>${money(
              payment.amount,
              payment.currency || "NGN"
            )}</strong>
          </div>

          <div class="row">
            <span>Receipt No.</span>
            <strong>${escapeHtml(
              payment.receipt_no || "—"
            )}</strong>
          </div>

          <div class="row">
            <span>Transaction Ref.</span>
            <strong>${escapeHtml(
              payment.tx_ref || "—"
            )}</strong>
          </div>

          <div class="row">
            <span>Date</span>
            <strong>${new Date(
              payment.paid_at ||
              payment.created_at
            ).toLocaleString("en-NG")}</strong>
          </div>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        <\/script>
      </body>
      </html>
    `;

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=800,height=900"
      );

    if (!printWindow) {
      showMessage(
        "Please allow pop-ups to print your receipt.",
        "error"
      );
      return;
    }

    printWindow.document.write(receipt);
    printWindow.document.close();
  }

  async function init() {
    try {
      if (!supabaseClient) {
        throw new Error(
          "Supabase client is not available."
        );
      }

      await loadCurrentUser();

      if (!currentUser) return;

      await loadProfile();
      await loadPaymentState();
      await loadFees();
      await loadPaymentHistory();

      document
        .getElementById("refresh-payments")
        ?.addEventListener(
          "click",
          async () => {
            showMessage(
              "Refreshing payment records…"
            );

            try {
              await loadPaymentState();
              await loadFees();
              await loadPaymentHistory();

              showMessage(
                "Payment records updated.",
                "success"
              );
            } catch (error) {
              showMessage(
                error instanceof Error
                  ? error.message
                  : "Unable to refresh payment records.",
                "error"
              );
            }
          }
        );
    } catch (error) {
      console.error(
        "Student payments init error:",
        error
      );

      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to load payment centre.",
        "error"
      );
    }
  }

  init();
})();