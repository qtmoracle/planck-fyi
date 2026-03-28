// functions/api/job/complete.ts
// POST /api/job/complete
//
// Single-tech mode. Completes the currently active job (most recent active).
// Writes immutable COMPLETION_PACKET_v0.01 (refuse overwrite).
// Updates mutable JOB_STATE_v0.01 -> complete.
// Storage: R2 env.INTAKE_BUCKET
// Auth: TECH_TOKEN via header: x-tech-token: <token>

import {
  checkTechAuth,
  completionPacketKey,
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

    // 2) Require operator identity
    const operatorSlug = String(request.headers.get("x-operator-slug") || "").trim();
    if (!operatorSlug) {
      return json({ ok: false, error: "missing_operator_slug", hint: "x-operator-slug header is required" }, 400);
    }

    // 3) Parse optional body: { notes?: string }
    let body: any = null;
    try {
      const txt = await request.text();
      body = txt ? JSON.parse(txt) : null;
    } catch {
      body = null;
    }
    const notes = body && typeof body.notes === "string" ? body.notes : "";

    // 4) Find most recent active job state assigned to this operator
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

      if (st?.assigned_to !== operatorSlug) continue;

      const t = Date.parse(String(st?.claimed_at || st?.last_updated_at || st?.queued_at || ""));
      if (!Number.isFinite(t)) continue;

      if (!best || t > best._t) best = { _t: t, key, state: st };
    }

    if (!best) {
      return json({ ok: true, job: null, note: "no_active_jobs" }, 200);
    }

    const jobId = String(best.state?.job_id || "");
    const intakeId = String(best.state?.intake_id || "");
    if (!jobId || !intakeId) {
      return json({ ok: false, error: "job_state_missing_ids", key: best.key }, 500);
    }

    // 4) Re-load state (drift guard) and ensure still active
    const currentState = await r2GetJSON(bucket, best.key);
    if (!currentState) return json({ ok: false, error: "job_state_not_found", key: best.key }, 404);

    const curStatus = String(currentState?.status || "").toLowerCase();
    if (curStatus !== "active") {
      return json(
        { ok: false, error: "job_not_active", note: "state_changed_before_complete", job_id: jobId, status: curStatus },
        409
      );
    }

    // 5) Load immutable job packet (needed for hash carry-through)
    const packetKey = jobPacketKey(jobId);
    const jobPacket = await r2GetJSON(bucket, packetKey);
    if (!jobPacket) {
      return json({ ok: false, error: "job_packet_not_found", job_id: jobId, key: packetKey }, 404);
    }

    const jobPacketHashHex = String(jobPacket?.hash?.hex || "");

    // 6) Completion packet immutability check
    const completionKey = completionPacketKey(jobId);
    const existing = await bucket.head(completionKey);
    if (existing) {
      return json({ ok: false, error: "completion_packet_exists", job_id: jobId, key: completionKey }, 409);
    }

    // 7) Build completion packet
    const completedAt = new Date().toISOString();

    const completionPacket: any = {
      schema: "COMPLETION_PACKET_v0.01",
      job_id: jobId,
      intake_id: intakeId,
      completed_at: completedAt,
      job_packet_hash: {
        alg: "sha256",
        hex: jobPacketHashHex,
      },
      notes,
    };

    // Deterministic hash of canonical JSON (uses stable stringify fallback)
    const canonical = stableStringify(completionPacket);
    const hex = await sha256Hex(canonical);

    completionPacket.hash = {
      alg: "sha256",
      hex,
      canonical: "stableStringify:v0.01",
    };

    // 8) Write immutable completion packet
    await bucket.put(completionKey, JSON.stringify(completionPacket, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    // 9) Update mutable job state -> complete
    const now = completedAt;
    const nextState = {
      ...currentState,
      status: "complete",
      completed_at: completedAt,
      last_updated_at: now,
    };

    await bucket.put(best.key, JSON.stringify(nextState, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    return json(
      {
        ok: true,
        job: {
          job_id: jobId,
          packet: jobPacket,
          state: nextState,
          completion: completionPacket,
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

/* ---------------- helpers ---------------- */

// stable stringify for deterministic hashing (objects sorted by key)
function stableStringify(value: any): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(x: any): any {
  if (Array.isArray(x)) return x.map(sortKeys);
  if (x && typeof x === "object") {
    const out: any = {};
    for (const k of Object.keys(x).sort()) out[k] = sortKeys(x[k]);
    return out;
  }
  return x;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
