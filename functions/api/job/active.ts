// functions/api/job/active.ts
// GET /api/job/active
//
// Single-tech mode. Returns most recent active job (by claimed_at).
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

    // 2) Find most recent active job state
    const operatorSlug = String(request.headers.get("x-operator-slug") || "").trim();

    const listed = await bucket.list({ prefix: JOB_STATE_PREFIX, limit: 1000 });
    const keys: string[] = (listed?.objects || [])
      .map((o: any) => String(o?.key || ""))
      .filter(Boolean);

    let best: { _t: number; key: string; state: any } | null = null;

    for (const key of keys) {
      const st = await r2GetJSON(bucket, key);
      if (!st) continue;

      const status = String(st?.status || "").toLowerCase();
      if (status !== "active") continue;

      if (operatorSlug && st?.assigned_to !== operatorSlug) continue;

      const t = Date.parse(String(st?.claimed_at || st?.last_updated_at || st?.queued_at || ""));
      if (!Number.isFinite(t)) continue;

      if (!best || t > best._t) best = { _t: t, key, state: st };
    }

    if (!best) {
      return json({ ok: true, job: null, note: "no_active_jobs" }, 200);
    }

    const jobId = String(best.state?.job_id || "");
    if (!jobId) {
      return json({ ok: false, error: "job_state_missing_job_id", key: best.key }, 500);
    }

    // 3) Load immutable job packet
    const packetKey = jobPacketKey(jobId);
    const jobPacket = await r2GetJSON(bucket, packetKey);
    if (!jobPacket) {
      return json({ ok: false, error: "job_packet_not_found", job_id: jobId, key: packetKey }, 404);
    }

    return json(
      {
        ok: true,
        job: {
          job_id: jobId,
          packet: jobPacket,
          state: best.state,
        },
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
