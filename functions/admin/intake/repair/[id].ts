// functions/admin/intake/repair/[id].ts
// POST /admin/intake/repair/:id
//
// Repair tool: if INTAKE_STATE_v0.01 is missing for an intake packet,
// create a minimal sidecar state (default: pending).
//
// Auth: Basic (ADMIN_USER / ADMIN_PASS)
// Storage: env.INTAKE_BUCKET (R2)

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

    const intakeId = String((params as any)?.id || "").trim();
    if (!intakeId) return json({ ok: false, error: "missing_intake_id" }, 400);

    const bucket = env?.INTAKE_BUCKET;
    if (!isR2(bucket)) {
      return json({ ok: false, error: "r2_binding_missing", hint: "Expected env.INTAKE_BUCKET (R2)." }, 500);
    }

    const packetKey = `planck/intake_packets/INTAKE_PACKET_v0.01/${intakeId}.json`;
    const stateKey  = `planck/intake_state/INTAKE_STATE_v0.01/${intakeId}.json`;

    const packet = await r2GetJSON(bucket, packetKey);
    if (!packet) {
      return json({ ok: false, error: "intake_packet_not_found", intakeId, key: packetKey }, 404);
    }

    // If state already exists, report and do nothing
    const existing = await bucket.head(stateKey);
    if (existing) {
      const state = await r2GetJSON(bucket, stateKey);
      return json({ ok: true, note: "state_already_exists", intakeId, key: stateKey, state }, 200);
    }

    const now = new Date().toISOString();

    // Minimal state sidecar (safe default: pending)
    const state: any = {
      schema: "INTAKE_STATE_v0.01",
      intake_id: intakeId,
      status: "pending",
      created_at: now,
      last_updated_at: now,

      // optional fields used by admin UI / later flows
      internal_notes: "",
      queue_position: null,
      scheduled_for: null,

      approved_at: null,
      denied_at: null,
      queued_at: null,
      completed_at: null,

      job_id: null,
    };

    await bucket.put(stateKey, JSON.stringify(state, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    return json({ ok: true, note: "state_created", intakeId, wrote: stateKey, state }, 200);
  } catch (err: any) {
    return json({ ok: false, error: "internal_error", message: String(err?.message || err) }, 500);
  }
};

/* helpers */

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
  return bucket && typeof bucket.get === "function" && typeof bucket.put === "function" && typeof bucket.head === "function";
}

async function r2GetJSON(bucket: any, key: string): Promise<any | null> {
  try {
    const obj = await bucket.get(key);
    if (!obj) return null;
    return JSON.parse(await obj.text());
  } catch {
    return null;
  }
}
