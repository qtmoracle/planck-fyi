import {
  getServiceEvent,
  startServiceEvent,
  putServiceEvent,
  jsonResponse,
} from "../../../src/lib/service-events";

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

    const event = await getServiceEvent(bucket, service_event_id);
    if (!event) return jsonResponse({ ok: false, error: "service_event_not_found" }, 404);

    let updated;
    try {
      updated = startServiceEvent(event);
    } catch (err) {
      // startServiceEvent throws if event is already completed
      return jsonResponse(
        {
          ok: false,
          error: err instanceof Error ? err.message : "start_failed",
        },
        409
      );
    }

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
