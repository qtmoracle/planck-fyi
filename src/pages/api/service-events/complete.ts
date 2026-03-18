import type { APIRoute } from "astro";
import {
  completeServiceEvent,
  getServiceEvent,
  isServiceEventPaymentStatus,
  jsonResponse,
  putServiceEvent,
} from "../../../../src/lib/service-events";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime.env;

    // @ts-ignore
    const bucket: R2Bucket = env.INTAKE_BUCKET;
    if (!bucket) return jsonResponse({ ok: false, error: "missing_r2_binding" }, 500);

    const body = await request.json().catch(() => null);
    if (!body) return jsonResponse({ ok: false, error: "invalid_json" }, 400);

    const service_event_id = String(body.service_event_id || "").trim();
    if (!service_event_id) {
      return jsonResponse({ ok: false, error: "missing_service_event_id" }, 400);
    }

    const payment_status_raw =
      typeof body.payment_status === "string" ? body.payment_status.trim() : "";
    const payment_status = payment_status_raw
      ? isServiceEventPaymentStatus(payment_status_raw)
        ? payment_status_raw
        : null
      : undefined;

    if (payment_status === null) {
      return jsonResponse({ ok: false, error: "invalid_payment_status" }, 400);
    }

    let amount_collected: number | null | undefined = undefined;
    if (body.amount_collected === null || body.amount_collected === "") {
      amount_collected = null;
    } else if (typeof body.amount_collected === "number" && Number.isFinite(body.amount_collected)) {
      amount_collected = body.amount_collected;
    } else if (
      typeof body.amount_collected === "string" &&
      body.amount_collected.trim() !== "" &&
      Number.isFinite(Number(body.amount_collected))
    ) {
      amount_collected = Number(body.amount_collected);
    }

    const event = await getServiceEvent(bucket, service_event_id);
    if (!event) return jsonResponse({ ok: false, error: "service_event_not_found" }, 404);

    const updated = completeServiceEvent(event, {
      outcome: {
        status: typeof body.status === "string" ? body.status : undefined,
        issues: Array.isArray(body.issues) ? body.issues.map((v) => String(v)) : undefined,
        recommendations: Array.isArray(body.recommendations)
          ? body.recommendations.map((v) => String(v))
          : undefined,
        completion_summary:
          typeof body.completion_summary === "string"
            ? body.completion_summary
            : undefined,
      },
      payment_status,
      amount_collected,
    });

    await putServiceEvent(bucket, updated);

    return jsonResponse(
      {
        ok: true,
        service_event: updated,
      },
      200
    );
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
