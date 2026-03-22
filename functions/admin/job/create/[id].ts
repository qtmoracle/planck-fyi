// functions/admin/job/create/[id].ts
// Planck Surface Engineers — Job Bridge (UI→Writer) v0.01
//
// Route: POST /admin/job/create/:id
//
// Storage: R2 (binding: env.INTAKE_BUCKET)
// - Reads:  planck/intake_packets/INTAKE_PACKET_v0.01/<intakeId>.json
//           planck/intake_state/INTAKE_STATE_v0.01/<intakeId>.json
// - Writes: planck/job_packets/JOB_PACKET_v0.01/<jobId>.json
//           planck/job_state/JOB_STATE_v0.01/<jobId>.json
// - Updates intake state -> queued
//
// Rules: no refactors, do not mutate immutable packets, deterministic IDs.

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, params, env } = ctx;

    // 0) Admin auth
    if (!basicAuthOk(request, env)) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Planck Admin"' },
      });
    }

    // 1) Intake id
    const intakeId = String((params as any)?.id || "").trim();
    if (!intakeId) return json({ ok: false, error: "missing_intake_id" }, 400);

    // 2) R2 binding
    const bucket = env?.INTAKE_BUCKET;
    if (!isR2(bucket)) {
      return json(
        {
          ok: false,
          error: "r2_binding_missing",
          hint: "Expected env.INTAKE_BUCKET (R2) from wrangler.toml [[r2_buckets]].",
          env_keys: env && typeof env === "object" ? Object.keys(env) : [],
        },
        500
      );
    }

    // 3) Load intake packet + intake state (R2)
    const intakePacketKey = intakePacketKeys(intakeId)[0];
    const intakeStateKey = intakeStateKeys(intakeId)[0];

    const intakePacket = await r2GetJSON(bucket, intakePacketKey);
    if (!intakePacket) {
      return json({ ok: false, error: "intake_packet_not_found", intakeId, key: intakePacketKey }, 404);
    }

    const intakeState = await r2GetJSON(bucket, intakeStateKey);
    if (!intakeState) {
      return json({ ok: false, error: "intake_state_not_found", intakeId, key: intakeStateKey }, 404);
    }

    // 4) Guard: intake must be approved
    const status = String((intakeState as any)?.status || "").toLowerCase();
    if (status !== "approved") {
      return json(
        {
          ok: false,
          error: "intake_not_approved",
          intakeId,
          status: (intakeState as any)?.status ?? null,
          required: "approved",
        },
        409
      );
    }

    // 5) Build job packet/state
    const jobId = `job_${intakeId}`;
    const now = new Date().toISOString();

    const jobPacket: any = {
      schema: "JOB_PACKET_v0.01",
      job_id: jobId,
      intake_id: intakeId,
      created_at: now,
      intake_snapshot: intakePacket,
    };

    const jobPacketCanonical = stableStringify(jobPacket);
    const jobPacketHash = await sha256Hex(jobPacketCanonical);
    jobPacket.hash = { alg: "sha256", hex: jobPacketHash, canonical: "stableStringify:v0.01" };

    const jobState: any = {
      schema: "JOB_STATE_v0.01",
      job_id: jobId,
      intake_id: intakeId,
      status: "queued",
      queued_at: now,
      assigned_to: "qtm-detailing",
      last_updated_at: now,
    };

    // 6) Persist (immutable job packet: no overwrite)
    const jobPacketKey = jobPacketKeys(jobId)[0];
    const jobStateKey = jobStateKeys(jobId)[0];

    if (await r2Exists(bucket, jobPacketKey)) {
      return json(
        {
          ok: false,
          error: "job_packet_already_exists",
          job_id: jobId,
          key: jobPacketKey,
          note: "Immutable JOB_PACKET_v0.01 will not be overwritten.",
        },
        409
      );
    }

    await r2PutJSON(bucket, jobPacketKey, jobPacket);
    await r2PutJSON(bucket, jobStateKey, jobState);

    // 7) Update intake sidecar -> queued
    const updatedIntakeState = {
      ...(intakeState as any),
      status: "queued",
      queued_at: now,
      last_updated_at: now,
      job_id: jobId,
    };
    await r2PutJSON(bucket, intakeStateKey, updatedIntakeState);

    return json(
      {
        ok: true,
        intake_id: intakeId,
        job_id: jobId,
        wrote: {
          job_packet: jobPacketKey,
          job_state: jobStateKey,
          intake_state_updated: intakeStateKey,
        },
        admin_return: `/admin/intake/${intakeId}`,
      },
      200
    );
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: "internal_error",
        message: String(err?.message || err),
        stack: String(err?.stack || ""),
      },
      500
    );
  }
};

/* ----------------------- helpers ----------------------- */

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function basicAuthOk(req: Request, env: any): boolean {
  const user = String(env?.ADMIN_USER || "");
  const pass = String(env?.ADMIN_PASS || "");
  if (!user || !pass) return false;

  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Basic ")) return false;

  try {
    const b64 = h.slice("Basic ".length).trim();
    const decoded = atob(b64);
    const idx = decoded.indexOf(":");
    if (idx < 0) return false;
    const u = decoded.slice(0, idx);
    const p = decoded.slice(idx + 1);
    return u === user && p === pass;
  } catch {
    return false;
  }
}

function isR2(bucket: any): boolean {
  return (
    bucket &&
    typeof bucket.get === "function" &&
    typeof bucket.put === "function" &&
    typeof bucket.head === "function"
  );
}

async function r2Exists(bucket: any, key: string): Promise<boolean> {
  try {
    const head = await bucket.head(key);
    return Boolean(head);
  } catch {
    return false;
  }
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

async function r2PutJSON(bucket: any, key: string, value: any): Promise<void> {
  await bucket.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

// Locked to observed R2 layout
function intakePacketKeys(intakeId: string): string[] {
  return [`planck/intake_packets/INTAKE_PACKET_v0.01/${intakeId}.json`];
}

function intakeStateKeys(intakeId: string): string[] {
  return [`planck/intake_state/INTAKE_STATE_v0.01/${intakeId}.json`];
}

// Normalized job storage under planck/
function jobPacketKeys(jobId: string): string[] {
  return [`planck/job_packets/JOB_PACKET_v0.01/${jobId}.json`];
}

function jobStateKeys(jobId: string): string[] {
  return [`planck/job_state/JOB_STATE_v0.01/${jobId}.json`];
}

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
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
