// functions/api/job/claim.ts
// POST /api/job/claim
//
// Single-tech mode. Claims (acks) the most recent queued job.
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

export const onRequestPost: PagesFunction = async (ctx) => {
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

    // 2) Find most recent queued job state
    const listed = await bucket.list({ prefix: JOB_STATE_PREFIX, limit: 1000 });
    const keys: string[] = (listed?.objects || [])
      .map((o: any) => String(o?.key || ""))
      .filter(Boolean);

    let best: { _t: number; key: string; state: any } | null = null;

    for (const key of keys) {
      const st = await r2GetJSON(bucket, key);
      if (!st) continue;

      const status = String(st?.status || "").toLowerCase();
      if (status !== "queued") continue;

      const t = Date.parse(String(st?.queued_at || st?.last_updated_at || ""));
      if (!Number.isFinite(t)) continue;

      if (!best || t > best._t) {
        best = { _t: t, key, state: st };
      }
    }

    if (!best) {
      return json({ ok: true, job: null, note: "no_queued_jobs" }, 200);
    }

    const jobId = String(best.state?.job_id || "");
    if (!jobId) {
      return json({ ok: false, error: "job_state_missing_job_id", key: best.key }, 500);
    }

    // 3) Re-load state from R2 (drift guard) and ensure still queued
    const currentState = await r2GetJSON(bucket, best.key);
    if (!currentState) {
      return json({ ok: false, error: "job_state_not_found", key: best.key }, 404);
    }

    const curStatus = String(currentState?.status || "").toLowerCase();
    if (curStatus !== "queued") {
      return json(
        {
          ok: false,
          error: "job_not_queued",
          note: "state_changed_before_claim",
          job_id: jobId,
          status: curStatus,
        },
        409
      );
    }

    // 4) Mutate JOB_STATE_v0.01 -> active (single-tech)
    const operatorSlug = String(request.headers.get("x-operator-slug") || "").trim();
    const now = new Date().toISOString();
    const nextState = {
      ...currentState,
      status: "active",
      assigned_to: operatorSlug || currentState.assigned_to || "tech_001",
      claimed_at: now,
      last_updated_at: now,
    };

    await bucket.put(best.key, JSON.stringify(nextState, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    // 5) Load immutable job packet
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
          state: nextState,
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
