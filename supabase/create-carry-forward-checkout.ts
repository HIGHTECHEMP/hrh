// Carry-forward checkout endpoint. This is intentionally separate from the existing create-checkout flow.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function semesterDue(annual: number, semester: string) {
  const first = round2(annual / 2);

  return semester === "First Semester"
    ? first
    : round2(annual - first);
}

/*
 * Flutterwave's local testing environment works with localhost,
 * not 127.0.0.1.
 *
 * This also preserves the project folder path, for example:
 *
 * http://127.0.0.1:5500/HOLY-ROSARY-DIGITAL-PLATFORM-PAYMENT-CENTRE-V4
 *
 * becomes:
 *
 * http://localhost:5500/HOLY-ROSARY-DIGITAL-PLATFORM-PAYMENT-CENTRE-V4
 */
function normalizeSiteUrl(value: string) {
  let url = value.trim().replace(/\/+$/, "");

  if (!url) return "";

  try {
    const parsed = new URL(url);

    if (
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "0.0.0.0"
    ) {
      parsed.hostname = "localhost";
    }

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return url.replace(
      /^http:\/\/127\.0\.0\.1/i,
      "http://localhost",
    );
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        ok: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  try {
    // ------------------------------------------------------------
    // ENVIRONMENT
    // ------------------------------------------------------------

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ?? "";

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      "";

    const flutterwaveSecret =
      Deno.env.get("FLW_SECRET_KEY") ?? "";

    const configuredSiteUrl =
      Deno.env.get("SITE_URL") ?? "";

    const siteUrl =
      normalizeSiteUrl(configuredSiteUrl);

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !anonKey
    ) {
      return json(
        {
          ok: false,
          error:
            "Supabase environment variables are not configured.",
        },
        500,
      );
    }

    if (!siteUrl) {
      return json(
        {
          ok: false,
          error:
            "SITE_URL is not configured.",
        },
        500,
      );
    }

    if (!flutterwaveSecret) {
      return json(
        {
          ok: false,
          error:
            "FLW_SECRET_KEY is not configured.",
        },
        500,
      );
    }

    // ------------------------------------------------------------
    // AUTHENTICATION
    // ------------------------------------------------------------

    const authorization =
      req.headers.get("Authorization");

    if (!authorization) {
      return json(
        {
          ok: false,
          error:
            "Authorization required.",
        },
        401,
      );
    }

    const userClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          global: {
            headers: {
              Authorization:
                authorization,
            },
          },
        },
      );

    const {
      data: { user },
      error: userError,
    } =
      await userClient.auth.getUser();

    if (userError || !user) {
      return json(
        {
          ok: false,
          error:
            "Your session is invalid or has expired.",
        },
        401,
      );
    }

    // ------------------------------------------------------------
    // REQUEST BODY
    // ------------------------------------------------------------

    const body =
      await req.json().catch(
        () => ({}),
      );

    const feeId =
      String(
        body.fee_id || "",
      ).trim();

    const reference =
      String(
        body.reference || "",
      ).trim();

    const semesters =
      Array.isArray(body.semesters)
        ? body.semesters
            .map(
              (item: unknown) =>
                String(item).trim(),
            )
            .filter(Boolean)
        : [];

    const requestedAmount =
      body.amount == null
        ? null
        : Number(body.amount);

    const carryForward =
      body.carry_forward &&
      typeof body.carry_forward === "object"
        ? body.carry_forward
        : null;

    const carryForwardLevel =
      carryForward
        ? String(carryForward.level || "").trim()
        : "";

    const isCarryForward =
      Boolean(carryForward && carryForwardLevel);

    if (!feeId) {
      return json(
        {
          ok: false,
          error:
            "A fee must be selected.",
        },
        400,
      );
    }

    // ------------------------------------------------------------
    // ADMIN CLIENT
    // ------------------------------------------------------------

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );

    // ------------------------------------------------------------
    // LOAD STUDENT PROFILE
    // ------------------------------------------------------------

    const {
      data: profile,
      error: profileError,
    } = await admin
      .from("profiles")
      .select(
        "id,full_name,email,matric_no,current_level,school_id",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Profile lookup error:",
        profileError,
      );

      return json(
        {
          ok: false,
          error:
            "Unable to load your student profile.",
        },
        500,
      );
    }

    if (!profile) {
      return json(
        {
          ok: false,
          error:
            "Student profile not found.",
        },
        404,
      );
    }

    if (!profile.current_level) {
      return json(
        {
          ok: false,
          error:
            "Your current academic level has not been assigned yet. Please contact Registry.",
        },
        400,
      );
    }

    const chargeLevel =
      isCarryForward
        ? carryForwardLevel
        : String(profile.current_level).trim();

    if (isCarryForward) {
      if (!carryForwardLevel) {
        return json({ ok: false, error: "A carry-forward source level is required." }, 400);
      }

      if (carryForwardLevel === String(profile.current_level).trim()) {
        return json({ ok: false, error: "The selected fee is already part of your current level." }, 400);
      }

      const { data: historyRows, error: historyError } = await admin
        .from("student_level_history")
        .select("from_level,to_level,created_at")
        .eq("student_id", user.id)
        .order("created_at", { ascending: true });

      if (historyError) {
        return json({ ok: false, error: "Unable to verify your academic progression history." }, 500);
      }

      const historicalLevels = new Set<string>();
      for (const row of historyRows || []) {
        if (row.from_level) historicalLevels.add(String(row.from_level).trim());
      }

      if (!historicalLevels.has(carryForwardLevel)) {
        return json({ ok: false, error: "The selected carry-forward level is not part of your academic history." }, 403);
      }
    }

    // ------------------------------------------------------------
    // LOAD FEE
    // ------------------------------------------------------------

    const {
      data: fee,
      error: feeError,
    } = await admin
      .from("fee_catalog")
      .select(
        "id,code,name,category,description,amount,currency,active,school_id,level,exam_type",
      )
      .eq("id", feeId)
      .maybeSingle();

    if (feeError) {
      console.error(
        "Fee lookup error:",
        feeError,
      );

      return json(
        {
          ok: false,
          error:
            "Unable to load the selected fee.",
        },
        500,
      );
    }

    if (!fee) {
      return json(
        {
          ok: false,
          error:
            "The selected fee does not exist.",
        },
        404,
      );
    }

    if (!fee.active) {
      return json(
        {
          ok: false,
          error:
            "This fee is currently unavailable.",
        },
        400,
      );
    }

    const officialAmount =
      Number(fee.amount);

    if (
      !Number.isFinite(
        officialAmount,
      ) ||
      officialAmount <= 0
    ) {
      return json(
        {
          ok: false,
          error:
            "This fee has an invalid configured amount.",
        },
        400,
      );
    }

    // ------------------------------------------------------------
    // SCHOOL VALIDATION
    // ------------------------------------------------------------

    if (
      fee.school_id &&
      profile.school_id &&
      fee.school_id !==
        profile.school_id
    ) {
      return json(
        {
          ok: false,
          error:
            "This fee is not available for your school.",
        },
        403,
      );
    }

    // ------------------------------------------------------------
    // LEVEL VALIDATION
    // ------------------------------------------------------------

    if (isCarryForward && !fee.level) {
      return json({ ok: false, error: "A carry-forward payment must reference a level-specific fee." }, 400);
    }

    if (fee.level) {
      const feeLevel = String(fee.level).trim();
      if (isCarryForward) {
        if (feeLevel !== chargeLevel) {
          return json({ ok: false, error: "The selected fee does not belong to the carry-forward level." }, 403);
        }
      } else if (feeLevel !== String(profile.current_level).trim()) {
        return json({ ok: false, error: "This fee is not available for your current academic level." }, 403);
      }
    }

    // ------------------------------------------------------------
    // EXAMINATION FEES MUST HAVE A LEVEL
    // ------------------------------------------------------------

    if (
      fee.category ===
        "examination" &&
      !fee.level
    ) {
      return json(
        {
          ok: false,
          error:
            "This examination fee has not been assigned to an academic level.",
        },
        400,
      );
    }

    if (fee.category === "examination") {
      const feeLevel = String(fee.level || "").trim();
      if (feeLevel !== chargeLevel) {
        return json({ ok: false, error: isCarryForward ? "This examination fee does not belong to the selected carry-forward level." : "This examination fee is not available for your current level." }, 403);
      }
    }

    // ------------------------------------------------------------
    // SUCCESSFUL PAYMENTS
    // ------------------------------------------------------------

    const {
      data: successfulPayments,
      error: paymentsError,
    } = await admin
      .from("payments")
      .select(
        "id,amount,status",
      )
      .eq(
        "payer_user_id",
        user.id,
      )
      .eq(
        "status",
        "successful",
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .limit(5000);

    if (paymentsError) {
      console.error(
        "Successful payments lookup error:",
        paymentsError,
      );

      return json(
        {
          ok: false,
          error:
            "Unable to check your previous payments.",
        },
        500,
      );
    }

    const successfulPaymentIds =
      (
        successfulPayments ??
        []
      ).map(
        (
          payment,
        ) => payment.id,
      );

    let allocations: any[] =
      [];

    if (
      successfulPaymentIds.length >
      0
    ) {
      const {
        data: allocationRows,
        error:
          allocationError,
      } = await admin
        .from(
          "payment_allocations",
        )
        .select(
          "id,payment_id,fee_id,allocation_type,semester,level,exam_type,amount",
        )
        .eq(
          "payer_user_id",
          user.id,
        )
        .eq(
          "fee_id",
          fee.id,
        )
        .in(
          "payment_id",
          successfulPaymentIds,
        );

      if (allocationError) {
        console.error(
          "Payment allocations lookup error:",
          allocationError,
        );

        return json(
          {
            ok: false,
            error:
              "Unable to check your payment balance.",
          },
          500,
        );
      }

      allocations =
        allocationRows ?? [];
    }

    // ------------------------------------------------------------
    // CALCULATE PAYMENT
    // ------------------------------------------------------------

    let chargeAmount =
      officialAmount;

    let allocationRows: any[] =
      [];

    // ============================================================
    // SCHOOL FEES
    // ============================================================

    if (
      fee.category ===
      "school_fees"
    ) {
      const allowedSemesters =
        [
          "First Semester",
          "Second Semester",
          "Both Semesters",
        ];

      if (
        semesters.length === 0 ||
        !semesters.every(
          (
            semester,
          ) =>
            allowedSemesters.includes(
              semester,
            ),
        )
      ) {
        return json(
          {
            ok: false,
            error:
              "Select First Semester, Second Semester, or Both Semesters.",
          },
          400,
        );
      }

      let selectedSemesters:
        string[];

      if (
        semesters.includes(
          "Both Semesters",
        )
      ) {
        selectedSemesters = [
          "First Semester",
          "Second Semester",
        ];
      } else {
        selectedSemesters = [
          ...new Set(
            semesters,
          ),
        ];
      }

      if (
        requestedAmount ==
          null ||
        !Number.isFinite(
          requestedAmount,
        ) ||
        requestedAmount <= 0
      ) {
        return json(
          {
            ok: false,
            error:
              "Enter a valid amount for the selected school-fee semester(s).",
          },
          400,
        );
      }

      const paidBySemester:
        Record<
          string,
          number
        > = {
        "First Semester": 0,
        "Second Semester": 0,
      };

      for (
        const allocation of allocations
      ) {
        if (
          allocation.allocation_type ===
            "school_fee" &&
          String(
            allocation.level,
          ).trim() ===
            chargeLevel &&
          allocation.semester &&
          Object.prototype.hasOwnProperty.call(
            paidBySemester,
            allocation.semester,
          )
        ) {
          paidBySemester[
            allocation.semester
          ] =
            round2(
              paidBySemester[
                allocation.semester
              ] +
                Number(
                  allocation.amount ||
                    0,
                ),
            );
        }
      }

      const dueBySemester:
        Record<
          string,
          number
        > = {
        "First Semester":
          Math.max(
            0,
            round2(
              semesterDue(
                officialAmount,
                "First Semester",
              ) -
                paidBySemester[
                  "First Semester"
                ],
            ),
          ),

        "Second Semester":
          Math.max(
            0,
            round2(
              semesterDue(
                officialAmount,
                "Second Semester",
              ) -
                paidBySemester[
                  "Second Semester"
                ],
            ),
          ),
      };

      const maximumForSelection =
        round2(
          selectedSemesters.reduce(
            (
              sum,
              semester,
            ) =>
              sum +
              dueBySemester[
                semester
              ],
            0,
          ),
        );

      if (
        maximumForSelection <=
        0
      ) {
        return json(
          {
            ok: false,
            error:
              "The selected school-fee semester(s) have already been fully paid.",
          },
          400,
        );
      }

      if (
        requestedAmount >
        maximumForSelection
      ) {
        return json(
          {
            ok: false,
            error:
              `The maximum outstanding amount for the selected semester(s) is ${maximumForSelection.toFixed(
                2,
              )} ${
                fee.currency ||
                "NGN"
              }.`,
          },
          400,
        );
      }

      chargeAmount =
        round2(
          requestedAmount,
        );

      let remaining =
        chargeAmount;

      for (
        const semester of selectedSemesters
      ) {
        if (
          remaining <= 0
        )
          break;

        const semesterOutstanding =
          dueBySemester[
            semester
          ];

        if (
          semesterOutstanding <=
          0
        )
          continue;

        const allocationAmount =
          round2(
            Math.min(
              remaining,
              semesterOutstanding,
            ),
          );

        if (
          allocationAmount >
          0
        ) {
          allocationRows.push(
            {
              allocation_type:
                "school_fee",

              semester,

              level:
                chargeLevel,

              amount:
                allocationAmount,
            },
          );

          remaining =
            round2(
              remaining -
                allocationAmount,
            );
        }
      }

      if (
        allocationRows.length ===
          0 ||
        remaining > 0
      ) {
        return json(
          {
            ok: false,
            error:
              "Unable to allocate the requested school-fee payment.",
          },
          400,
        );
      }
    }

    // ============================================================
    // EXAMINATION FEES
    // ============================================================

    else if (
      fee.category ===
      "examination"
    ) {
      const configuredExamType =
        String(
          fee.exam_type ||
            fee.name ||
            "",
        ).trim();

      if (!configuredExamType) {
        return json(
          {
            ok: false,
            error:
              "This examination fee has no configured examination type.",
          },
          400,
        );
      }

      let alreadyPaid = 0;

      for (
        const allocation of allocations
      ) {
        if (
          allocation.allocation_type ===
            "examination" &&
          String(
            allocation.level,
          ).trim() ===
            chargeLevel &&
          String(
            allocation.exam_type ||
              "",
          ).trim() ===
            configuredExamType
        ) {
          alreadyPaid =
            round2(
              alreadyPaid +
                Number(
                  allocation.amount ||
                    0,
                ),
            );
        }
      }

      const outstanding =
        Math.max(
          0,
          round2(
            officialAmount -
              alreadyPaid,
          ),
        );

      if (
        outstanding <= 0
      ) {
        return json(
          {
            ok: false,
            error:
              `Your ${configuredExamType} examination fee has already been fully paid.`,
          },
          400,
        );
      }

      chargeAmount =
        outstanding;

      allocationRows = [
        {
          allocation_type:
            "examination",

          level:
            chargeLevel,

          exam_type:
            configuredExamType,

          amount:
            chargeAmount,
        },
      ];
    }

    // ============================================================
    // RESULT CHECKER PIN
    // ============================================================

    else if (
      fee.category ===
      "result_pin"
    ) {
      chargeAmount =
        officialAmount;

      allocationRows = [
        {
          allocation_type:
            "result_pin",

          amount:
            chargeAmount,
        },
      ];
    }

    // ============================================================
    // OTHER OFFICIAL FEES
    // ============================================================

    else {
      chargeAmount =
        officialAmount;

      allocationRows = [
        {
          allocation_type:
            fee.category ||
            "other",

          level:
            chargeLevel,

          amount:
            chargeAmount,
        },
      ];
    }

    chargeAmount =
      round2(
        chargeAmount,
      );

    if (
      !Number.isFinite(
        chargeAmount,
      ) ||
      chargeAmount <= 0
    ) {
      return json(
        {
          ok: false,
          error:
            "Invalid payment amount.",
        },
        400,
      );
    }

    // ------------------------------------------------------------
    // CUSTOMER DETAILS
    // ------------------------------------------------------------

    const customerEmail =
      user.email ||
      profile.email ||
      "";

    if (!customerEmail) {
      return json(
        {
          ok: false,
          error:
            "Your account does not have a valid email address.",
        },
        400,
      );
    }

    const customerName =
      profile.full_name ||
      "Holy Rosary Student";

    // ------------------------------------------------------------
    // REFERENCES
    // ------------------------------------------------------------

    const txRef =
      `HR-${crypto.randomUUID()}`;

    const receiptNo =
      `HR-${new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "")}-${crypto
        .randomUUID()
        .replace(/-/g, "")
        .slice(0, 8)
        .toUpperCase()}`;

    let purpose =
      fee.code;

    if (
      fee.category ===
      "result_pin"
    ) {
      purpose =
        "result_pin";
    } else if (
      fee.category ===
      "examination"
    ) {
      purpose =
        "examination_fee";
    } else if (
      fee.category ===
      "school_fees"
    ) {
      purpose =
        "school_fees";
    }

    const metadata = {
      reference,

      user_id:
        user.id,

      fee_id:
        fee.id,

      fee_code:
        fee.code,

      fee_name:
        fee.name,

      fee_category:
        fee.category,

      full_name:
        profile.full_name,

      matric_no:
        profile.matric_no,

      current_level:
        profile.current_level,

      school_id:
        profile.school_id,

      carry_forward:
        isCarryForward,

      carry_forward_level:
        isCarryForward ? chargeLevel : null,

      semesters,

      exam_type:
        fee.category ===
        "examination"
          ? String(
              fee.exam_type ||
                fee.name ||
                "",
            ).trim()
          : null,
    };

    // ------------------------------------------------------------
    // CREATE PAYMENT
    // ------------------------------------------------------------

    const {
      data: payment,
      error: paymentError,
    } = await admin
      .from("payments")
      .insert({
        tx_ref: txRef,

        purpose,

        customer_email:
          customerEmail,

        amount:
          chargeAmount,

        currency:
          fee.currency ||
          "NGN",

        payer_user_id:
          user.id,

        fee_id:
          fee.id,

        receipt_no:
          receiptNo,

        metadata,
      })
      .select(
        "id,tx_ref,receipt_no,amount,currency",
      )
      .single();

    if (
      paymentError ||
      !payment
    ) {
      console.error(
        "Payment creation error:",
        paymentError,
      );

      return json(
        {
          ok: false,
          error:
            "Unable to create your payment request.",
        },
        500,
      );
    }

    // ------------------------------------------------------------
    // CREATE ALLOCATIONS
    // ------------------------------------------------------------

    const rowsToInsert =
      allocationRows.map(
        (
          allocation,
        ) => ({
          payment_id:
            payment.id,

          payer_user_id:
            user.id,

          fee_id:
            fee.id,

          allocation_type:
            allocation.allocation_type,

          semester:
            allocation.semester ??
            null,

          level:
            allocation.level ??
            profile.current_level,

          exam_type:
            allocation.exam_type ??
            null,

          amount:
            round2(
              Number(
                allocation.amount,
              ),
            ),
        }),
      );

    const {
      error:
        allocationInsertError,
    } = await admin
      .from(
        "payment_allocations",
      )
      .insert(
        rowsToInsert,
      );

    if (
      allocationInsertError
    ) {
      console.error(
        "Payment allocation error:",
        allocationInsertError,
      );

      await admin
        .from("payments")
        .update({
          status:
            "failed",
        })
        .eq(
          "id",
          payment.id,
        );

      return json(
        {
          ok: false,
          error:
            "Unable to prepare the payment allocation.",
        },
        500,
      );
    }

    // ------------------------------------------------------------
    // FLUTTERWAVE REDIRECT
    // ------------------------------------------------------------

    const redirectUrl =
      `${siteUrl}/payment-return.html?tx_ref=${encodeURIComponent(
        txRef,
      )}&payment_id=${encodeURIComponent(
        payment.id,
      )}`;

    console.log(
      "FLUTTERWAVE REDIRECT URL:",
      redirectUrl,
    );

    const flutterwavePayload =
      {
        tx_ref:
          txRef,

        amount:
          chargeAmount,

        currency:
          fee.currency ||
          "NGN",

        redirect_url:
          redirectUrl,

        customer: {
          email:
            customerEmail,

          name:
            customerName,
        },

        customizations: {
          title:
            "Holy Rosary Hospital Emekuku",

          description:
            fee.name ||
            "Holy Rosary payment",
        },

        meta: {
          payment_id:
            payment.id,

          reference,

          fee_id:
            fee.id,

          fee_code:
            fee.code,

          fee_category:
            fee.category,

          matric_no:
            profile.matric_no,

          current_level:
            chargeLevel,
        },
      };

    // ------------------------------------------------------------
    // CREATE FLUTTERWAVE CHECKOUT
    // ------------------------------------------------------------

    const flutterwaveResponse =
      await fetch(
        "https://api.flutterwave.com/v3/payments",
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${flutterwaveSecret}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              flutterwavePayload,
            ),
        },
      );

    const flutterwaveData =
      await flutterwaveResponse
        .json()
        .catch(
          () => null,
        );

    if (
      !flutterwaveResponse.ok ||
      !flutterwaveData ||
      flutterwaveData.status !==
        "success" ||
      !flutterwaveData.data
        ?.link
    ) {
      console.error(
        "Flutterwave checkout error:",
        flutterwaveData,
      );

      await admin
        .from(
          "payment_allocations",
        )
        .delete()
        .eq(
          "payment_id",
          payment.id,
        );

      await admin
        .from("payments")
        .update({
          status:
            "failed",
        })
        .eq(
          "id",
          payment.id,
        );

      return json(
        {
          ok: false,
          error:
            flutterwaveData?.message ||
            "Unable to start Flutterwave checkout.",
        },
        502,
      );
    }

    // ------------------------------------------------------------
    // RETURN
    // ------------------------------------------------------------

    return json({
      ok: true,

      success: true,

      message:
        "Payment checkout created successfully.",

      link:
        flutterwaveData.data
          .link,

      tx_ref:
        txRef,

      payment_id:
        payment.id,

      receipt_no:
        receiptNo,

      amount:
        chargeAmount,

      currency:
        fee.currency ||
        "NGN",

      redirect_url:
        redirectUrl,
    });
  } catch (error) {
    console.error(
      "create-checkout unexpected error:",
      error,
    );

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      500,
    );
  }
});