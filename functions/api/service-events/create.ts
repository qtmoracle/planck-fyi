import {
  createServiceEvent,
  getServiceEventByJobId,
  putServiceEvent,
  jsonResponse,
} from "qtm-core/service-events";
import type { CreateServiceEventInput } from "qtm-core/service-events";
import { evaluateAccess, denyResponse } from "qtm-core/access";

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // @ts-ignore
    const bucket: R2Bucket = env.INTAKE_BUCKET;
    if (!bucket) return jsonResponse({ ok: false, error: "missing_r2_binding" }, 500);

    const body = await request.json().catch(() => null);
    if (!body) return jsonResponse({ ok: false, error: "invalid_json" }, 400);

    const b = body as any;

    const job_id = String(b.job_id || "").trim();
    if (!job_id) return jsonResponse({ ok: false, error: "missing_job_id" }, 400);

    const request_id = String(b.request_id || "").trim();
    const operator_id = String(b.operator_id || "").trim();

    if (!request_id || !operator_id) {
      return jsonResponse({ ok: false, error: "missing_required_fields" }, 400);
    }

    // Access gate: service event creation requires active operator only
    const accessDecision = evaluateAccess({
      actor: { type: "operator", id: operator_id, operator_slug: operator_id },
      action: "service_event_mutate",
      resource: { type: "service_event", owner_operator_slug: operator_id, assigned_to: operator_id },
    });
    if (!accessDecision.allow) return denyResponse(accessDecision);

    // Idempotent: return existing service event for this job if one already exists.
    const existing = await getServiceEventByJobId(bucket, job_id);
    if (existing) {
      return jsonResponse({ ok: true, service_event: existing }, 200);
    }

    const input: CreateServiceEventInput = {
      job_id,
      request_id,
      operator_id,
      customer_id: String(b.customer_id || "").trim(),
      asset_id: String(b.asset_id || "").trim(),
      location: {
        type: String(b.location?.type || "onsite"),
        address: String(b.location?.address || ""),
        geo: {
          lat: typeof b.location?.geo?.lat === "number" ? b.location.geo.lat : null,
          lng: typeof b.location?.geo?.lng === "number" ? b.location.geo.lng : null,
        },
      },
      service: {
        surface: String(b.service?.surface || "").trim(),
        tier: String(b.service?.tier || "").trim(),
        scope_notes: String(b.service?.scope_notes || "").trim(),
      },
    };

    const event = createServiceEvent(input);
    await putServiceEvent(bucket, event);

    return jsonResponse({ ok: true, service_event: event }, 200);
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
