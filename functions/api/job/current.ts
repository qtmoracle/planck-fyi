// functions/api/job/current.ts
// GET /api/job/current
//
// Single-tech mode. Returns most recent queued job.
// Storage: R2 env.INTAKE_BUCKET
// Auth: TECH_TOKEN via header: x-tech-token: <token>

export const onRequestGet: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // 0) TECH auth
    const required = String(env?.TECH_TOKEN || "");
    const provided = String(request.headers.get("x-tech-token") || "");
    if (!required || provided !== required) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 1) R2 binding
    const bucket = env?.INTAKE_BUCKET;
    if (!isR2(bucket)) {
      return json(
        { ok: false, error: "r2_binding_missing", hint: "Expected env.INTAKE_BUCKET (R2) binding." },
        500
      );
    }

    // 2) List job state objects
    // Canonical prefix per our Step 1.5 normalization:
    const prefix = "planck/job_state/JOB_STATE_v0.01/";
    const listed = await bucket.list({ prefix, limit: 1000 });
    const keys: string[] = (listed?.objects || [])
      .map((o: any) => String(o?.key || ""))
      .filter(Boolean);

    // 3) Find most recent queued job
    // We determine "most recent" by queued_at inside the JSON.
    let best: any = null;

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

    // 4) Load immutable job packet
    const jobPacketKey = `planck/job_packets/JOB_PACKET_v0.01/${jobId}.json`;
    const jobPacket = await r2GetJSON(bucket, jobPacketKey);
    if (!jobPacket) {
      return json({ ok: false, error: "job_packet_not_found", job_id: jobId, key: jobPacketKey }, 404);
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

/* ---------------- helpers ---------------- */

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function isR2(bucket: any): boolean {
  return bucket && typeof bucket.get === "function" && typeof bucket.head === "function" && typeof bucket.list === "function";
}

async function r2GetJSON(bucket: any, key: string): Promise<any | null> {
  try {
    const obj = await bucket.get(key);
    if (!obj) return null;
    const txt = await obj.text();
    return JSON.parse(txt);
  } catch {
    return null;
  }
}
