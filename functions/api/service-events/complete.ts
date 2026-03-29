import {
  completeServiceEvent,
  getServiceEvent,
  isServiceEventPaymentStatus,
  jsonResponse,
  putServiceEvent,
} from "qtm-core/service-events";
import {
  composeSurfaceRecord,
  composeSurfaceSummary,
} from "qtm-core/runtime-adapters";
import { evaluateAccess, denyResponse } from "qtm-core/access";

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // @ts-ignore
    const bucket: R2Bucket = env.INTAKE_BUCKET;
    if (!bucket) return jsonResponse({ ok: false, error: "missing_r2_binding" }, 500);

    const body = await request.json().catch(() => null);
    if (!body) return jsonResponse({ ok: false, error: "invalid_json" }, 400);

    const service_event_id = String((body as any).service_event_id || "").trim();
    if (!service_event_id) {
      return jsonResponse({ ok: false, error: "missing_service_event_id" }, 400);
    }

    // Access gate: service event mutation requires active operator
    const operatorSlug = request.headers.get("x-operator-slug") || "";
    if (operatorSlug) {
      const accessDecision = evaluateAccess({
        actor: { type: "operator", id: operatorSlug, operator_slug: operatorSlug },
        action: "service_event_mutate",
        resource: { type: "service_event", assigned_to: operatorSlug },
      });
      if (!accessDecision.allow) return denyResponse(accessDecision);
    }

    const b = body as any;

    const payment_status_raw =
      typeof b.payment_status === "string" ? b.payment_status.trim() : "";
    const payment_status = payment_status_raw
      ? isServiceEventPaymentStatus(payment_status_raw)
        ? payment_status_raw
        : null
      : undefined;

    if (payment_status === null) {
      return jsonResponse({ ok: false, error: "invalid_payment_status" }, 400);
    }

    let amount_collected: number | null | undefined = undefined;
    if (b.amount_collected === null || b.amount_collected === "") {
      amount_collected = null;
    } else if (
      typeof b.amount_collected === "number" &&
      Number.isFinite(b.amount_collected)
    ) {
      amount_collected = b.amount_collected;
    } else if (
      typeof b.amount_collected === "string" &&
      b.amount_collected.trim() !== "" &&
      Number.isFinite(Number(b.amount_collected))
    ) {
      amount_collected = Number(b.amount_collected);
    }

    const event = await getServiceEvent(bucket, service_event_id);
    if (!event) return jsonResponse({ ok: false, error: "service_event_not_found" }, 404);

    const updated = completeServiceEvent(event, {
      outcome: {
        status: typeof b.status === "string" ? b.status : undefined,
        issues: Array.isArray(b.issues) ? b.issues.map((v: unknown) => String(v)) : undefined,
        recommendations: Array.isArray(b.recommendations)
          ? b.recommendations.map((v: unknown) => String(v))
          : undefined,
        completion_summary:
          typeof b.completion_summary === "string" ? b.completion_summary : undefined,
      },
      payment_status,
      amount_collected,
    });

    await putServiceEvent(bucket, updated);

    const surface = updated.service.surface || "surface-navigator";

    const record = composeSurfaceRecord({
      surface,
      job: updated,
      events: [updated],
    });

    const summary = composeSurfaceSummary({
      surface,
      job: updated,
      events: [updated],
    });

    return jsonResponse(
      {
        ok: true,
        service_event: updated,
        record,
        summary,
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
