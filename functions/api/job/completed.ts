// functions/api/job/completed.ts
// GET /api/job/completed
//
// Returns all completed jobs for the operator, sorted by completed_at descending.
// Each job is enriched with a sparse service_event summary (payment, evidence count)
// loaded from the ServiceEvent index keyed by job_id.
//
// Storage: R2 env.INTAKE_BUCKET
// Auth: TECH_TOKEN via header: x-tech-token: <token>

import {
  checkTechAuth,
  isR2,
  json,
  jobPacketKey,
  JOB_STATE_PREFIX,
  r2GetJSON,
} from "./_lib";
import { getServiceEventByJobId } from "../../../src/lib/service-events";

export const onRequestGet: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // 0) TECH auth
    const authError = checkTechAuth(request, env);
    if (authError) return authError;

    // 1) R2 binding
    const bucket = env?.INTAKE_BUCKET;
    if (!isR2(bucket)) {
      return json(
        { ok: false, error: "r2_binding_missing", hint: "Expected env.INTAKE_BUCKET (R2) binding." },
        500
      );
    }

    // 2) Scan for completed jobs for this operator
    const operatorSlug = String(request.headers.get("x-operator-slug") || "").trim();

    const listed = await bucket.list({ prefix: JOB_STATE_PREFIX, limit: 1000 });
    const keys: string[] = (listed?.objects || [])
      .map((o: any) => String(o?.key || ""))
      .filter(Boolean);

    type Match = {
      _t: number;
      job_id: string;
      state: any;
      packet: any;
      service_event_summary: {
        payment_status: string | null;
        amount_collected: number | null;
        evidence_count: number;
        surface: string | null;
        tier: string | null;
      };
    };

    const matches: Match[] = [];

    for (const key of keys) {
      const st = await r2GetJSON(bucket, key);
      if (!st) continue;

      const status = String(st?.status || "").toLowerCase();
      if (status !== "complete") continue;

      if (operatorSlug && st?.assigned_to !== operatorSlug) continue;

      const jobId = String(st?.job_id || "");
      if (!jobId) continue;

      const t = Date.parse(String(st?.completed_at || st?.last_updated_at || ""));

      const packet = await r2GetJSON(bucket, jobPacketKey(jobId));
      if (!packet) continue;

      // Load ServiceEvent for payment + evidence enrichment — graceful if missing
      const se = await getServiceEventByJobId(bucket as any, jobId);
      const evidenceCount = se
        ? se.evidence.arrival.length + se.evidence.before.length + se.evidence.after.length
        : 0;

      matches.push({
        _t: Number.isFinite(t) ? t : 0,
        job_id: jobId,
        state: st,
        packet,
        service_event_summary: {
          payment_status: se?.meta?.payment_status ?? null,
          amount_collected: se?.meta?.amount_collected ?? null,
          evidence_count: evidenceCount,
          surface: se?.service?.surface ?? null,
          tier: se?.service?.tier ?? null,
        },
      });
    }

    matches.sort((a, b) => b._t - a._t);

    return json(
      {
        ok: true,
        jobs: matches.map(({ job_id, state, packet, service_event_summary }) => ({
          job_id,
          packet,
          state,
          service_event_summary,
        })),
      },
      200
    );
  } catch (err: any) {
    return json(
      { ok: false, error: "internal_error", message: String(err?.message || err), stack: String(err?.stack || "") },
      500
    );
  }
};
