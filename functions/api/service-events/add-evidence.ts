// functions/api/service-events/add-evidence.ts
// POST /api/service-events/add-evidence
//
// Appends evidence items to an existing ServiceEvent's evidence[stage] array.
// Idempotent: items whose `key` already exists in the array are skipped.

import {
  appendEvidence,
  getServiceEvent,
  isEvidenceStage,
  jsonResponse,
  putServiceEvent,
} from "../../../src/lib/service-events";
import type {
  EvidenceStage,
  ServiceEventEvidenceItem,
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

    const stage = String(b.stage || "").trim();
    if (!isEvidenceStage(stage)) {
      return jsonResponse(
        { ok: false, error: "invalid_stage", hint: "Expected: arrival | before | after" },
        400
      );
    }

    const rawItems: unknown[] = Array.isArray(b.items) ? b.items : [];
    if (rawItems.length === 0) {
      return jsonResponse({ ok: false, error: "missing_items" }, 400);
    }

    const event = await getServiceEvent(bucket, service_event_id);
    if (!event) {
      return jsonResponse({ ok: false, error: "service_event_not_found" }, 404);
    }

    // Deduplicate by R2 key against items already in the evidence array
    const existingKeys = new Set(
      event.evidence[stage as EvidenceStage]
        .map((item) => item.key)
        .filter(Boolean)
    );

    const newItems: ServiceEventEvidenceItem[] = rawItems
      .filter((raw: any) => {
        const key = String(raw?.key || "").trim();
        return key && !existingKeys.has(key);
      })
      .map((raw: any) => ({
        key: String(raw.key).trim(),
        kind: "photo" as const,
        caption: String(raw.caption || "").trim(),
        created_at: String(raw.created_at || new Date().toISOString()),
      }));

    if (newItems.length === 0) {
      // All items already recorded — idempotent success
      return jsonResponse({ ok: true, service_event: event, appended: 0 }, 200);
    }

    const updated = appendEvidence(event, stage as EvidenceStage, newItems);
    await putServiceEvent(bucket, updated);

    return jsonResponse({ ok: true, service_event: updated, appended: newItems.length }, 200);
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
