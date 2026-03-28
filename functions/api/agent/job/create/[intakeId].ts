// functions/api/agent/job/create/[intakeId].ts
// POST /api/agent/job/create/:intakeId
//
// Agent-safe job bridge.
// Creates JOB_PACKET_v0.01 (immutable, hashed) + JOB_STATE_v0.01 (queued)
// from an approved intake. Mirrors admin/job/create/[id].ts logic exactly —
// same key layout, same packet schema, same hash algorithm.
//
// Auth:       AGENT_TOKEN via header x-agent-token (not Basic Auth)
// Storage:    R2 env.INTAKE_BUCKET
// Path param: intakeId
//
// Body (JSON):
//   operator_slug  string  required — no default, no fallback
//
// Guards:
//   - intake must exist
//   - intake state must be "approved" (call /api/agent/intake/queue first)
//   - job packet must not already exist (immutability — refuse overwrite)
//
// R2 writes:
//   planck/job_packets/JOB_PACKET_v0.01/<jobId>.json      (immutable)
//   planck/job_state/JOB_STATE_v0.01/<jobId>.json         (mutable, status: queued)
//   planck/intake_state/INTAKE_STATE_v0.01/<intakeId>.json (status → queued)
//
// After this call, the job is visible to operators via POST /api/job/claim.

import {
  checkAgentAuth,
  intakePacketKey,
  intakeStateKey,
  isR2,
  jobPacketKey,
  jobStateKey,
  json,
  r2Exists,
  r2GetJSON,
  r2PutJSON,
  sha256Hex,
  stableStringify,
} from "../../_lib";

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, params, env } = ctx;

    // 0) Agent auth
    const authError = checkAgentAuth(request, env);
    if (authError) return authError;

    // 1) R2 binding
    const bucket = env?.INTAKE_BUCKET;
    if (!isR2(bucket)) {
      return json({ ok: false, error: "r2_binding_missing", hint: "Expected env.INTAKE_BUCKET (R2)." }, 500);
    }

    // 2) Path param
    const intakeId = String((params as any)?.intakeId || "").trim();
    if (!intakeId) {
      return json({ ok: false, error: "missing_intake_id" }, 400);
    }

    // 3) Body: operator_slug required — no default applied
    let body: any = null;
    try {
      const txt = await request.text();
      body = txt ? JSON.parse(txt) : null;
    } catch {
      body = null;
    }

    const operatorSlug = String(body?.operator_slug || "").trim();
    if (!operatorSlug) {
      return json({
        ok: false,
        error: "missing_operator_slug",
        hint: "body.operator_slug is required. No default is applied.",
      }, 400);
    }

    // 4) Load intake packet
    const pktKey = intakePacketKey(intakeId);
    const intakePacket = await r2GetJSON(bucket, pktKey);
    if (!intakePacket) {
      return json({ ok: false, error: "intake_packet_not_found", intake_id: intakeId, key: pktKey }, 404);
    }

    // 5) Load intake state
    const stKey = intakeStateKey(intakeId);
    const intakeState = await r2GetJSON(bucket, stKey);
    if (!intakeState) {
      return json({ ok: false, error: "intake_state_not_found", intake_id: intakeId, key: stKey }, 404);
    }

    // 6) Guard: intake must be approved
    const currentStatus = String(intakeState?.status || "").toLowerCase();
    if (currentStatus !== "approved") {
      return json({
        ok: false,
        error: "intake_not_approved",
        intake_id: intakeId,
        status: currentStatus,
        required: "approved",
        hint: currentStatus === "pending"
          ? "Call POST /api/agent/intake/queue first."
          : currentStatus === "queued"
          ? "A job has already been created for this intake."
          : undefined,
      }, 409);
    }

    // 7) Deterministic job ID — mirrors admin/job/create convention
    const jobId = `job_${intakeId}`;
    const now = new Date().toISOString();

    // 8) Immutability guard — refuse to overwrite existing job packet
    const jpKey = jobPacketKey(jobId);
    if (await r2Exists(bucket, jpKey)) {
      return json({
        ok: false,
        error: "job_packet_already_exists",
        job_id: jobId,
        key: jpKey,
        note: "Immutable JOB_PACKET_v0.01 will not be overwritten.",
      }, 409);
    }

    // 9) Build JOB_PACKET_v0.01 (immutable)
    // Schema and hash algorithm match admin/job/create/[id].ts exactly.
    const jobPacket: any = {
      schema: "JOB_PACKET_v0.01",
      job_id: jobId,
      intake_id: intakeId,
      created_at: now,
      intake_snapshot: intakePacket,
    };

    const canonical = stableStringify(jobPacket);
    const hex = await sha256Hex(canonical);
    jobPacket.hash = { alg: "sha256", hex, canonical: "stableStringify:v0.01" };

    // 10) Build JOB_STATE_v0.01 (mutable)
    // operator_slug is required; assigned_to has no fallback.
    const jsKey = jobStateKey(jobId);
    const jobState: any = {
      schema: "JOB_STATE_v0.01",
      job_id: jobId,
      intake_id: intakeId,
      status: "queued",
      queued_at: now,
      assigned_to: operatorSlug,
      last_updated_at: now,
    };

    // 11) Write job packet (immutable) then job state (mutable)
    await r2PutJSON(bucket, jpKey, jobPacket);
    await r2PutJSON(bucket, jsKey, jobState);

    // 12) Advance intake state → queued (mirrors admin/job/create behavior)
    const updatedIntakeState: any = {
      ...intakeState,
      status: "queued",
      updatedAt: now,
      updatedBy: "agent",
      job_id: jobId,
    };
    await r2PutJSON(bucket, stKey, updatedIntakeState);

    return json({
      ok: true,
      intake_id: intakeId,
      job_id: jobId,
      operator_slug: operatorSlug,
      wrote: {
        job_packet: jpKey,
        job_state: jsKey,
        intake_state_updated: stKey,
      },
      next: `POST /api/job/claim  (headers: x-tech-token, x-operator-slug: ${operatorSlug})`,
    }, 200);

  } catch (err: any) {
    return json(
      { ok: false, error: "internal_error", message: String(err?.message || err) },
      500
    );
  }
};
