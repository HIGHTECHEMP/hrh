let cashierStudents = [];
let cashierFees = [];
let cashierAllocations = [];
let cashierPayments = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadCashierData();

  document.getElementById("cashier-refresh")
    ?.addEventListener("click", loadCashierData);

  document.getElementById("cashier-search")
    ?.addEventListener("input", renderLedger);

  document.getElementById("cashier-school")
    ?.addEventListener("change", renderLedger);

  document.getElementById("cashier-level")
    ?.addEventListener("change", renderLedger);
});


/* =========================================================
   LOAD CASHIER DATA
========================================================= */

async function loadCashierData() {
  const msg = document.getElementById("cashier-message");

  if (msg) {
    msg.textContent = "";
    msg.className = "form-message";
  }

  try {
    const [
      { data: students, error: studentError },
      { data: fees, error: feeError },
      { data: payments, error: paymentError }
    ] = await Promise.all([
      hrSupabase
        .from("profiles")
        .select(`
          id,
          full_name,
          matric_no,
          current_level,
          school_id,
          active,
          schools(name)
        `)
        .eq("role", "student")
        .order("full_name"),

      hrSupabase
        .from("fee_catalog")
        .select(`
          id,
          code,
          name,
          category,
          amount,
          currency,
          school_id,
          level,
          exam_type,
          active
        `)
        .eq("active", true)
        .order("category")
        .order("level")
        .order("name"),

      hrSupabase
        .from("payments")
        .select(`
          id,
          payer_user_id,
          tx_ref,
          purpose,
          amount,
          currency,
          status,
          receipt_no,
          paid_at,
          created_at,
          metadata
        `)
        .eq("status", "successful")
        .order("paid_at", { ascending: false })
        .limit(2000)
    ]);

    if (studentError) throw studentError;
    if (feeError) throw feeError;
    if (paymentError) throw paymentError;

    cashierStudents = students || [];
    cashierFees = fees || [];
    cashierPayments = payments || [];

    const paymentIds = cashierPayments.map(p => p.id);

    if (paymentIds.length) {
      const { data: allocations, error } = await hrSupabase
        .from("payment_allocations")
        .select(`
          id,
          payment_id,
          payer_user_id,
          fee_id,
          allocation_type,
          level,
          semester,
          exam_type,
          amount
        `)
        .in("payment_id", paymentIds);

      if (error) throw error;

      cashierAllocations = allocations || [];
    } else {
      cashierAllocations = [];
    }

    populateFilters();
    updateMetrics();
    renderLedger();
    renderRecent();

  } catch (error) {
    console.error("Cashier ledger error:", error);

    if (msg) {
      msg.textContent =
        error.message ||
        "Unable to load the cashier ledger.";

      msg.className = "form-message error";
    }

    const box = document.getElementById("cashier-levels");

    if (box) {
      box.innerHTML = `
        <div class="empty-state">
          The cashier ledger could not be loaded.
          Confirm that the cashier payment migration and access
          policies have been applied.
        </div>
      `;
    }
  }
}


/* =========================================================
   FILTERS
========================================================= */

function populateFilters() {
  const schoolSelect = document.getElementById("cashier-school");
  const levelSelect = document.getElementById("cashier-level");

  if (schoolSelect) {
    const schools = [
      ...new Map(
        cashierStudents
          .filter(student => student.schools)
          .map(student => [
            student.school_id,
            student.schools.name
          ])
      ).entries()
    ].sort((a, b) =>
      String(a[1]).localeCompare(String(b[1]))
    );

    schoolSelect.innerHTML =
      `<option value="ALL">All schools</option>` +
      schools
        .map(([id, name]) =>
          `<option value="${esc(id)}">${esc(name)}</option>`
        )
        .join("");
  }

  if (levelSelect) {
    const levels = [
      ...new Set(
        cashierStudents
          .map(student => student.current_level)
          .filter(Boolean)
      )
    ].sort(levelSort);

    levelSelect.innerHTML =
      `<option value="ALL">All levels</option>` +
      levels
        .map(level =>
          `<option value="${esc(level)}">${esc(level)}</option>`
        )
        .join("");
  }
}


/* =========================================================
   METRICS
========================================================= */

function updateMetrics() {
  const paymentCount =
    document.getElementById("cashier-payment-count");

  const totalCollected =
    document.getElementById("cashier-total-collected");

  const studentCount =
    document.getElementById("cashier-student-count");

  const balanceCount =
    document.getElementById("cashier-balance-count");

  if (paymentCount) {
    paymentCount.textContent =
      cashierPayments.length.toLocaleString();
  }

  const total = cashierPayments.reduce(
    (sum, payment) =>
      sum + Number(payment.amount || 0),
    0
  );

  if (totalCollected) {
    totalCollected.textContent = money(total);
  }

  if (studentCount) {
    studentCount.textContent =
      cashierStudents.length.toLocaleString();
  }

  const balances = cashierStudents.filter(
    student => studentHasBalance(student)
  ).length;

  if (balanceCount) {
    balanceCount.textContent =
      balances.toLocaleString();
  }
}


/* =========================================================
   BALANCE CHECK
========================================================= */

function studentHasBalance(student) {
  const level = student.current_level;

  if (!level) return false;

  const schoolFee = getSchoolFee(student);

  if (schoolFee) {
    const annual = Number(schoolFee.amount || 0);

    const firstDue = semesterAmount(
      annual,
      "First Semester"
    );

    const secondDue = semesterAmount(
      annual,
      "Second Semester"
    );

    const firstPaid = schoolPaid(
      student,
      schoolFee,
      "First Semester"
    );

    const secondPaid = schoolPaid(
      student,
      schoolFee,
      "Second Semester"
    );

    if (firstPaid + 0.001 < firstDue) {
      return true;
    }

    if (secondPaid + 0.001 < secondDue) {
      return true;
    }
  }

  const examinationFees = matchingFees(
    "examination",
    student
  );

  return examinationFees.some(fee => {
    const due = Number(fee.amount || 0);
    const paid = examPaid(student, fee);

    return paid + 0.001 < due;
  });
}


/* =========================================================
   MAIN LEDGER
========================================================= */

function renderLedger() {
  const box = document.getElementById("cashier-levels");

  if (!box) return;

  const search =
    document
      .getElementById("cashier-search")
      ?.value
      .trim()
      .toLowerCase() || "";

  const selectedSchool =
    document.getElementById("cashier-school")
      ?.value || "ALL";

  const selectedLevel =
    document.getElementById("cashier-level")
      ?.value || "ALL";

  const filteredStudents =
    cashierStudents.filter(student => {

      const searchText = `
        ${student.full_name || ""}
        ${student.matric_no || ""}
      `.toLowerCase();

      const matchesSearch =
        !search ||
        searchText.includes(search);

      const matchesSchool =
        selectedSchool === "ALL" ||
        student.school_id === selectedSchool;

      const matchesLevel =
        selectedLevel === "ALL" ||
        student.current_level === selectedLevel;

      return (
        matchesSearch &&
        matchesSchool &&
        matchesLevel
      );
    });

  if (!filteredStudents.length) {
    box.innerHTML = `
      <div class="empty-state">
        No registered students match the current filters.
      </div>
    `;
    return;
  }

  const groups = {};

  filteredStudents.forEach(student => {
    const level =
      student.current_level ||
      "Level not assigned";

    if (!groups[level]) {
      groups[level] = [];
    }

    groups[level].push(student);
  });

  box.innerHTML =
    Object.entries(groups)
      .sort(([a], [b]) => levelSort(a, b))
      .map(([level, students]) =>
        renderLevel(level, students)
      )
      .join("");

  box
    .querySelectorAll("[data-cashier-payment]")
    .forEach(button => {

      button.addEventListener("click", () => {

        const payment =
          cashierPayments.find(
            p => p.id === button.dataset.cashierPayment
          );

        if (payment) {
          showCashierReceipt(payment);
        }
      });
    });
}


/* =========================================================
   LEVEL GROUP
========================================================= */

function renderLevel(levelName, students) {

  const examFees =
    cashierFees.filter(fee =>
      fee.active &&
      fee.category === "examination" &&
      (!fee.level || fee.level === levelName)
    );

  const studentsWithBalance =
    students.filter(student =>
      studentHasBalance(student)
    ).length;

  return `
    <details class="cashier-level-card" open>

      <summary>

        <span>
          <b>${esc(levelName)}</b>
          <small>
            ${students.length}
            registered student${students.length === 1 ? "" : "s"}
          </small>
        </span>

        <span class="cashier-summary-chip">
          ${studentsWithBalance}
          with balance
        </span>

      </summary>

      <div class="cashier-student-list">

        ${students
          .map(student =>
            renderStudent(
              student,
              levelName,
              examFees
            )
          )
          .join("")}

      </div>

    </details>
  `;
}


/* =========================================================
   STUDENT LEDGER
========================================================= */

function renderStudent(
  student,
  levelName,
  examFees
) {

  const schoolFee =
    getSchoolFee(student);

  let firstPaid = 0;
  let secondPaid = 0;
  let firstDue = 0;
  let secondDue = 0;

  if (schoolFee) {

    const annual =
      Number(schoolFee.amount || 0);

    firstPaid =
      schoolPaid(
        student,
        schoolFee,
        "First Semester"
      );

    secondPaid =
      schoolPaid(
        student,
        schoolFee,
        "Second Semester"
      );

    firstDue =
      semesterAmount(
        annual,
        "First Semester"
      );

    secondDue =
      semesterAmount(
        annual,
        "Second Semester"
      );
  }

  const annualPaid =
    firstPaid + secondPaid;

  const annualAmount =
    schoolFee
      ? Number(schoolFee.amount || 0)
      : 0;

  const annualPercentage =
    annualAmount > 0
      ? Math.min(
          100,
          (annualPaid / annualAmount) * 100
        )
      : 0;

  return `
    <article class="cashier-student-card">

      <div class="cashier-student-head">

        <div>
          <span class="eyebrow">
            ${esc(
              student.matric_no ||
              "NO EXAM NUMBER"
            )}
          </span>

          <h3>
            ${esc(
              student.full_name ||
              "Unnamed student"
            )}
          </h3>

          <p>
            ${esc(
              student.schools?.name ||
              "School not assigned"
            )}
            ·
            ${esc(levelName)}
          </p>
        </div>

        <span class="status-pill ${
          student.active
            ? "successful"
            : "failed"
        }">
          ${student.active ? "Active" : "Inactive"}
        </span>

      </div>


      <div class="cashier-section-label">
        SCHOOL FEES
      </div>

      <div class="cashier-fee-grid">

        ${
          schoolFee
            ? `

              ${semesterLedger(
                "First Semester",
                firstPaid,
                firstDue
              )}

              ${semesterLedger(
                "Second Semester",
                secondPaid,
                secondDue
              )}

              <div class="cashier-ledger-total">

                <span>Annual</span>

                <b>
                  ${money(annualPaid)}
                  /
                  ${money(annualAmount)}
                </b>

                <small>
                  ${annualPercentage.toFixed(0)}% paid
                </small>

              </div>

            `
            : `
              <div class="cashier-unconfigured">
                No school-fee configuration
                for this level.
              </div>
            `
        }

      </div>


      <div class="cashier-section-label">
        EXAMINATION FEES
      </div>

      <div class="cashier-exam-list">

        ${
          examFees.length
            ? examFees
                .map(fee =>
                  examLedger(
                    student,
                    fee
                  )
                )
                .join("")
            : `
              <div class="cashier-unconfigured">
                No examination charges
                configured for this level.
              </div>
            `
        }

      </div>

    </article>
  `;
}


/* =========================================================
   SCHOOL FEE LEDGER
========================================================= */

function semesterLedger(
  label,
  paid,
  due
) {

  const percentage =
    due > 0
      ? Math.min(
          100,
          (paid / due) * 100
        )
      : 0;

  const status =
    due > 0 &&
    paid + 0.001 >= due
      ? "Paid"
      : paid > 0
        ? "Part payment"
        : "Unpaid";

  const statusClass =
    status === "Paid"
      ? "paid"
      : status === "Part payment"
        ? "part"
        : "unpaid";

  return `
    <div class="cashier-semester-ledger">

      <div>
        <span>${esc(label)}</span>

        <b>
          ${money(paid)}
          /
          ${money(due)}
        </b>
      </div>

      <div class="cashier-progress">
        <span style="width:${percentage}%"></span>
      </div>

      <small class="${statusClass}">
        ${status}
      </small>

    </div>
  `;
}


/* =========================================================
   EXAMINATION FEE LEDGER
========================================================= */

function examLedger(student, fee) {

  const due =
    Number(fee.amount || 0);

  const paid =
    examPaid(
      student,
      fee
    );

  const percentage =
    due > 0
      ? Math.min(
          100,
          (paid / due) * 100
        )
      : 0;

  const status =
    due > 0 &&
    paid + 0.001 >= due
      ? "Paid"
      : paid > 0
        ? "Part payment"
        : "Unpaid";

  const statusClass =
    status === "Paid"
      ? "paid"
      : status === "Part payment"
        ? "part"
        : "unpaid";

  const examName =
    fee.exam_type ||
    fee.name ||
    "Examination Fee";

  return `
    <div class="cashier-exam-row">

      <div>
        <span>${esc(examName)}</span>

        <small>
          ${money(paid)}
          /
          ${money(due)}
        </small>
      </div>

      <div class="cashier-progress">
        <span style="width:${percentage}%"></span>
      </div>

      <b class="${statusClass}">
        ${status}
      </b>

    </div>
  `;
}


/* =========================================================
   FEE MATCHING
========================================================= */

function matchingFees(
  category,
  student
) {

  return cashierFees.filter(fee => {

    if (!fee.active) {
      return false;
    }

    if (fee.category !== category) {
      return false;
    }

    if (
      fee.school_id &&
      fee.school_id !== student.school_id
    ) {
      return false;
    }

    if (
      fee.level &&
      fee.level !== student.current_level
    ) {
      return false;
    }

    return true;
  });
}


function getSchoolFee(student) {

  const fees =
    matchingFees(
      "school_fees",
      student
    );

  if (!fees.length) {
    return null;
  }

  /*
    A level-specific fee takes priority.
    Otherwise use the first applicable
    school-fee configuration.
  */

  return (
    fees.find(
      fee =>
        fee.level &&
        fee.level === student.current_level
    ) ||
    fees.find(
      fee => !fee.level
    ) ||
    fees[0]
  );
}


/* =========================================================
   PAYMENT ALLOCATIONS
========================================================= */

function allocationsFor(
  student,
  fee
) {

  return cashierAllocations.filter(
    allocation =>
      allocation.payer_user_id === student.id &&
      allocation.fee_id === fee.id
  );
}


function schoolPaid(
  student,
  fee,
  semester
) {

  return allocationsFor(
    student,
    fee
  )
    .filter(
      allocation =>
        allocation.semester === semester
    )
    .reduce(
      (sum, allocation) =>
        sum +
        Number(
          allocation.amount || 0
        ),
      0
    );
}


function examPaid(
  student,
  fee
) {

  const examType =
    fee.exam_type ||
    fee.name;

  return allocationsFor(
    student,
    fee
  )
    .filter(
      allocation =>
        allocation.exam_type === examType
    )
    .reduce(
      (sum, allocation) =>
        sum +
        Number(
          allocation.amount || 0
        ),
      0
    );
}


/* =========================================================
   SEMESTER SPLIT
========================================================= */

function semesterAmount(
  annual,
  semester
) {

  const total =
    Number(annual || 0);

  /*
    Split the annual amount equally,
    while preserving every kobo/naira when
    the annual amount is odd.
  */

  const first =
    Math.round(
      (total / 2) * 100
    ) / 100;

  const second =
    Math.round(
      (total - first) * 100
    ) / 100;

  return semester === "First Semester"
    ? first
    : second;
}


/* =========================================================
   RECENT TRANSACTIONS
========================================================= */

function renderRecent() {

  const box =
    document.getElementById(
      "cashier-recent"
    );

  if (!box) return;

  const rows =
    cashierPayments.slice(0, 12);

  if (!rows.length) {

    box.innerHTML = `
      <div class="empty-state">
        No successful payments yet.
      </div>
    `;

    return;
  }

  box.innerHTML =
    rows.map(payment => {

      const metadata =
        payment.metadata &&
        typeof payment.metadata === "object"
          ? payment.metadata
          : {};

      const student =
        cashierStudents.find(
          student =>
            student.id ===
            payment.payer_user_id
        );

      let context = "";

      if (
        Array.isArray(
          metadata.semesters
        ) &&
        metadata.semesters.length
      ) {
        context =
          metadata.semesters.join(" + ");
      } else if (
        metadata.exam_type
      ) {
        context =
          metadata.exam_type;
      } else if (
        metadata.level
      ) {
        context =
          metadata.level;
      }

      return `
        <article class="payment-row">

          <div>

            <span class="eyebrow">
              ${esc(
                payment.receipt_no ||
                payment.tx_ref
              )}
            </span>

            <h3>
              ${esc(
                student?.full_name ||
                metadata.full_name ||
                "Student payment"
              )}
            </h3>

            <p>
              ${esc(
                purposeLabel(
                  payment.purpose
                )
              )}

              ${
                context
                  ? " · " + esc(context)
                  : ""
              }

              ·
              ${money(
                payment.amount,
                payment.currency
              )}

              ·
              ${date(
                payment.paid_at ||
                payment.created_at
              )}
            </p>

          </div>

          <div class="payment-row-actions">

            <span class="status-pill successful">
              successful
            </span>

            <button
              class="btn ghost"
              type="button"
              data-cashier-payment="${esc(payment.id)}"
            >
              View receipt
            </button>

          </div>

        </article>
      `;
    }).join("");

  box
    .querySelectorAll(
      "[data-cashier-payment]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const payment =
            cashierPayments.find(
              p =>
                p.id ===
                button.dataset.cashierPayment
            );

          if (payment) {
            showCashierReceipt(payment);
          }
        }
      );
    });
}


/* =========================================================
   CASHIER RECEIPT
========================================================= */

function showCashierReceipt(payment) {

  const metadata =
    payment.metadata &&
    typeof payment.metadata === "object"
      ? payment.metadata
      : {};

  const student =
    cashierStudents.find(
      s =>
        s.id ===
        payment.payer_user_id
    );

  const overlay =
    document.createElement("div");

  overlay.className =
    "cashier-receipt-backdrop";

  overlay.innerHTML = `
    <section class="cashier-receipt-card">

      <button
        class="payment-composer-close"
        type="button"
        aria-label="Close"
      >
        ×
      </button>

      <span class="eyebrow">
        OFFICIAL PAYMENT RECEIPT
      </span>

      <div class="cashier-receipt-brand">

        <span>HR</span>

        <div>
          <strong>
            Holy Rosary Hospital Emekuku
          </strong>

          <small>
            Cashier verification copy
          </small>
        </div>

      </div>

      <div class="cashier-receipt-grid">

        <div>
          <span>Student</span>
          <b>
            ${esc(
              student?.full_name ||
              metadata.full_name ||
              "—"
            )}
          </b>
        </div>

        <div>
          <span>Exam number</span>
          <b>
            ${esc(
              student?.matric_no ||
              metadata.matric_no ||
              "—"
            )}
          </b>
        </div>

        <div>
          <span>Payment</span>
          <b>
            ${esc(
              purposeLabel(
                payment.purpose
              )
            )}
          </b>
        </div>

        <div>
          <span>Amount</span>
          <b>
            ${money(
              payment.amount,
              payment.currency
            )}
          </b>
        </div>

        <div>
          <span>Receipt</span>
          <b>
            ${esc(
              payment.receipt_no ||
              "—"
            )}
          </b>
        </div>

        <div>
          <span>Transaction</span>
          <b>
            ${esc(
              payment.tx_ref ||
              "—"
            )}
          </b>
        </div>

        <div>
          <span>Date</span>
          <b>
            ${date(
              payment.paid_at ||
              payment.created_at
            )}
          </b>
        </div>

        <div>
          <span>Level</span>
          <b>
            ${esc(
              metadata.level ||
              student?.current_level ||
              "—"
            )}
          </b>
        </div>

        ${
          Array.isArray(
            metadata.semesters
          ) &&
          metadata.semesters.length
            ? `
              <div>
                <span>Semester(s)</span>
                <b>
                  ${esc(
                    metadata.semesters.join(
                      " + "
                    )
                  )}
                </b>
              </div>
            `
            : ""
        }

        ${
          metadata.exam_type
            ? `
              <div>
                <span>Exam type</span>
                <b>
                  ${esc(
                    metadata.exam_type
                  )}
                </b>
              </div>
            `
            : ""
        }

      </div>

      <button
        class="btn primary full"
        type="button"
        data-print-receipt
      >
        Print receipt
      </button>

    </section>
  `;

  document.body.appendChild(overlay);

  overlay
    .querySelector(
      ".payment-composer-close"
    )
    ?.addEventListener(
      "click",
      () => overlay.remove()
    );

  overlay.addEventListener(
    "click",
    event => {
      if (event.target === overlay) {
        overlay.remove();
      }
    }
  );

  overlay
    .querySelector(
      "[data-print-receipt]"
    )
    ?.addEventListener(
      "click",
      () => printReceipt()
    );
}


/* =========================================================
   PRINT RECEIPT
========================================================= */

function printReceipt() {

  const receipt =
    document.querySelector(
      ".cashier-receipt-card"
    );

  if (!receipt) return;

  const printWindow =
    window.open(
      "",
      "_blank",
      "width=800,height=900"
    );

  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`
    <!doctype html>

    <html>
    <head>

      <meta charset="utf-8">

      <title>
        Holy Rosary Payment Receipt
      </title>

      <style>

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 30px;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          background: #fff;
          color: #111827;
        }

        .cashier-receipt-card {
          max-width: 720px;
          margin: 0 auto;
          padding: 30px;
          border: 1px solid #d1d5db;
          border-radius: 14px;
        }

        .payment-composer-close,
        [data-print-receipt] {
          display: none !important;
        }

        .eyebrow {
          display: block;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 14px;
        }

        .cashier-receipt-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 28px;
        }

        .cashier-receipt-brand > span {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #0f4c81;
          color: #fff;
          font-weight: 800;
        }

        .cashier-receipt-brand strong {
          display: block;
          font-size: 18px;
        }

        .cashier-receipt-brand small {
          display: block;
          margin-top: 4px;
          color: #64748b;
        }

        .cashier-receipt-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .cashier-receipt-grid div {
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
        }

        .cashier-receipt-grid span {
          display: block;
          font-size: 12px;
          color: #64748b;
          margin-bottom: 5px;
        }

        .cashier-receipt-grid b {
          display: block;
          word-break: break-word;
        }

        @media print {
          body {
            padding: 0;
          }

          .cashier-receipt-card {
            border: 0;
            border-radius: 0;
            max-width: none;
          }
        }

      </style>

    </head>

    <body>

      ${receipt.outerHTML}

    </body>

    </html>
  `);

  printWindow.document.close();

  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 250);
}


/* =========================================================
   HELPERS
========================================================= */

function purposeLabel(purpose) {

  return {
    result_pin: "Result Checker PIN",
    school_fees: "School Fees",
    examination_fee: "Examination Fee"
  }[purpose] ||
    String(
      purpose || "Payment"
    ).replaceAll("_", " ");
}


function money(
  amount,
  currency = "NGN"
) {

  let safeCurrency =
    currency || "NGN";

  try {

    return new Intl.NumberFormat(
      "en-NG",
      {
        style: "currency",
        currency: safeCurrency
      }
    ).format(
      Number(amount || 0)
    );

  } catch {

    return new Intl.NumberFormat(
      "en-NG",
      {
        style: "currency",
        currency: "NGN"
      }
    ).format(
      Number(amount || 0)
    );
  }
}


function date(value) {

  if (!value) {
    return "—";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "—";
  }

  return parsed.toLocaleString(
    "en-NG",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}


function levelSort(a, b) {

  const numberA =
    parseInt(
      String(a)
        .match(/\d+/)?.[0] ||
      999,
      10
    );

  const numberB =
    parseInt(
      String(b)
        .match(/\d+/)?.[0] ||
      999,
      10
    );

  return (
    numberA - numberB ||
    String(a).localeCompare(
      String(b)
    )
  );
}


function esc(value) {

  return String(
    value ?? ""
  ).replace(
    /[&<>'"]/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[character])
  );
}