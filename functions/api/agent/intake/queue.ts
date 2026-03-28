// functions/api/agent/intake/queue.ts
// POST /api/agent/intake/queue
//
// Agent-safe intake approval gate.
// Advances intake state from pending → approved, which is the prerequisite
// for job creation via POST /api/agent/job/create/:intakeId.
//
// Auth:    AGENT_TOKEN via header x-agent-token (not Basic Auth)
// Storage: R2 env.INTAKE_BUCKET
//
// Body (JSON):
//   intake_id  string  required
//   notes      string  optional — written to state.notes if provided
//
// State machine:
//   pending  → approved   (normal path)
//   approved → 200 no-op  (idempotent)
//   queued   → 200 no-op  (job already exists, still ok)
//   denied | archived | completed → 409 (terminal, cannot approve)
//
// Does NOT create a job — call POST /api/agent/job/create/:intakeId next.

import {
  checkAgentAuth,
  intakePacketKey,
  intakeStateKey,
  isR2,
  json,
  r2GetJSON,
  r2PutJSON,
} from "../_lib";

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // 0) Agent auth
    const authError = checkAgentAuth(request, env);
    if (authError) return authError;

    // 1) R2 binding
    const bucket = env?.INTAKE_BUCKET;
    if (!isR2(bucket)) {
      return json({ ok: false, error: "r2_binding_missing", hint: "Expected env.INTAKE_BUCKET (R2)." }, 500);
    }

    // 2) Parse body
    let body: any = null;
    try {
      const txt = await request.text();
      body = txt ? JSON.parse(txt) : null;
    } catch {
      body = null;
    }

    const intakeId = String(body?.intake_id || "").trim();
    if (!intakeId) {
      return json({ ok: false, error: "missing_intake_id", hint: "body.intake_id is required" }, 400);
    }

    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

    // 3) Verify intake packet exists (ownership + existence check)
    const pktKey = intakePacketKey(intakeId);
    const intakePacket = await r2GetJSON(bucket, pktKey);
    if (!intakePacket) {
      return json({ ok: false, error: "intake_packet_not_found", intake_id: intakeId, key: pktKey }, 404);
    }

    // 4) Load intake state
    const stKey = intakeStateKey(intakeId);
    const intakeState = await r2GetJSON(bucket, stKey);
    if (!intakeState) {
      return json({ ok: false, error: "intake_state_not_found", intake_id: intakeId, key: stKey }, 404);
    }

    const currentStatus = String(intakeState?.status || "").toLowerCase();

    // 5) Idempotency — already approved or past approval, no write needed
    if (currentStatus === "approved" || currentStatus === "queued") {
      return json({
        ok: true,
        note: "already_approved",
        intake_id: intakeId,
        status: currentStatus,
        next: currentStatus === "approved"
          ? `POST /api/agent/job/create/${intakeId}`
          : "job_already_created",
      }, 200);
    }

    // 6) Terminal states — cannot approve
    if (currentStatus === "denied" || currentStatus === "archived" || currentStatus === "completed") {
      return json({
        ok: false,
        error: "intake_not_approvable",
        intake_id: intakeId,
        status: currentStatus,
        hint: `Intake with status "${currentStatus}" cannot be approved.`,
      }, 409);
    }

    // 7) Approve: pending → approved
    // State shape mirrors admin/state/[id].ts write format (camelCase keys, updatedBy).
    const now = new Date().toISOString();
    const nextState: any = {
      ...intakeState,
      status: "approved",
      updatedAt: now,
      updatedBy: "agent",
    };

    // Preserve notes if provided; otherwise keep existing notes field
    if (notes) {
      nextState.notes = notes;
    }

    await r2PutJSON(bucket, stKey, nextState);

    return json({
      ok: true,
      intake_id: intakeId,
      status: "approved",
      approved_at: now,
      next: `POST /api/agent/job/create/${intakeId}`,
    }, 200);

  } catch (err: any) {
    return json(
      { ok: false, error: "internal_error", message: String(err?.message || err) },
      500
    );
  }
};
