// functions/api/service-events/update-payment.ts
// POST /api/service-events/update-payment
//
// Updates payment fields on an existing ServiceEvent without changing its lifecycle status.
// Safe to call before, during, or after service completion.

import {
  getServiceEvent,
  isServiceEventPaymentStatus,
  jsonResponse,
  putServiceEvent,
} from "../../../src/lib/service-events";

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // @ts-ignore
    const bucket: R2Bucket = env.INTAKE_BUCKET;
    if (!bucket) return jsonResponse({ ok: false, error: "missing_r2_binding" }, 500);

    const body = await request.json().catch(() => null);
    if (!body) return jsonResponse({ ok: false, error: "invalid_json" }, 400);

    const b = body as any;

    const service_event_id = String(b.service_event_id || "").trim();
    if (!service_event_id) {
      return jsonResponse({ ok: false, error: "missing_service_event_id" }, 400);
    }

    const payment_status_raw =
      typeof b.payment_status === "string" ? b.payment_status.trim() : null;
    if (payment_status_raw !== null && !isServiceEventPaymentStatus(payment_status_raw)) {
      return jsonResponse(
        { ok: false, error: "invalid_payment_status", hint: "Expected: unpaid | paid | partial | waived" },
        400
      );
    }

    const event = await getServiceEvent(bucket, service_event_id);
    if (!event) {
      return jsonResponse({ ok: false, error: "service_event_not_found" }, 404);
    }

    // Overlay only the provided payment fields; preserve everything else in meta.
    const updatedMeta = { ...event.meta };

    if (payment_status_raw !== null) {
      updatedMeta.payment_status = payment_status_raw as typeof event.meta.payment_status;
    }

    if (b.amount_collected === null || b.amount_collected === "") {
      updatedMeta.amount_collected = null;
    } else if (
      typeof b.amount_collected === "number" &&
      Number.isFinite(b.amount_collected)
    ) {
      updatedMeta.amount_collected = b.amount_collected;
    } else if (
      typeof b.amount_collected === "string" &&
      b.amount_collected.trim() !== "" &&
      Number.isFinite(Number(b.amount_collected))
    ) {
      updatedMeta.amount_collected = Number(b.amount_collected);
    }

    if (typeof b.payment_method === "string") {
      updatedMeta.payment_method = b.payment_method.trim();
    }

    if (typeof b.payment_note === "string") {
      updatedMeta.payment_note = b.payment_note.trim();
    }

    const updated = { ...event, meta: updatedMeta };
    await putServiceEvent(bucket, updated);

    return jsonResponse({ ok: true, service_event: updated }, 200);
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: "server_error",
        detail: err instanceof Error ? err.message : "unknown_error",
      },
      500
    );
  }
};
