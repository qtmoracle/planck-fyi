function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Planck Admin"' },
  });
}

function checkAuth(req: Request, user: string, pass: string) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Basic ")) return false;
  const raw = h.slice(6).trim();
  let decoded = "";
  try { decoded = atob(raw); } catch { return false; }
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);
  return u === user && p === pass;
}

type IntakeStateStatus = "pending" | "approved" | "denied" | "queued" | "completed";
type IntakeState = {
  id: string;
  status: IntakeStateStatus;
  updatedAt: string;
  updatedBy: string;
  notes?: string;
  queue?: { position: number | null; scheduledFor: string | null };
};

const STATE_PREFIX  = "planck/intake_state/INTAKE_STATE_v0.01/";

function defaultState(id: string): IntakeState {
  return {
    id,
    status: "pending",
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
    notes: "",
    queue: { position: null, scheduledFor: null },
  };
}

async function readState(bucket: R2Bucket, id: string): Promise<IntakeState> {
  const key = `${STATE_PREFIX}${id}.json`;
  const obj = await bucket.get(key);
  if (!obj) return defaultState(id);
  try {
    const txt = await obj.text();
    const s = JSON.parse(txt);
    const status = String(s.status || "pending") as IntakeStateStatus;
    if (!["pending","approved","denied","queued","completed"].includes(status)) return defaultState(id);
    return {
      id,
      status,
      updatedAt: String(s.updatedAt || new Date().toISOString()),
      updatedBy: String(s.updatedBy || "admin"),
      notes: typeof s.notes === "string" ? s.notes : "",
      queue: {
        position: (s.queue && typeof s.queue.position === "number") ? s.queue.position : null,
        scheduledFor: (s.queue && typeof s.queue.scheduledFor === "string") ? s.queue.scheduledFor : null,
      },
    };
  } catch {
    return defaultState(id);
  }
}

function toIntOrNull(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

function toIsoOrNullFromDatetimeLocal(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null; // expected "YYYY-MM-DDTHH:MM"
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export const onRequestPost: PagesFunction = async (ctx) => {
  const { request, env, params } = ctx;

  const ADMIN_USER = String(env.ADMIN_USER || "");
  const ADMIN_PASS = String(env.ADMIN_PASS || "");
  if (!ADMIN_USER || !ADMIN_PASS) return unauthorized();
  if (!checkAuth(request, ADMIN_USER, ADMIN_PASS)) return unauthorized();

  const id = String(params?.id || "").trim();
  if (!id) return new Response("Missing id", { status: 400 });

  // @ts-ignore
  const bucket: R2Bucket = env.INTAKE_BUCKET;
  if (!bucket) return new Response("missing INTAKE_BUCKET binding", { status: 500 });

  const form = await request.formData();

  const action = String(form.get("action") || "").trim();
  const notes = String(form.get("notes") || "").trim();
  const queuePos = toIntOrNull(form.get("queue_position"));
  const scheduledFor = toIsoOrNullFromDatetimeLocal(form.get("scheduled_for"));

  const prev = await readState(bucket, id);

  let nextStatus: IntakeStateStatus = prev.status;
  if (action === "approve") nextStatus = "approved";
  else if (action === "deny") nextStatus = "denied";
  else if (action === "queue") nextStatus = "queued";
  else if (action === "complete") nextStatus = "completed";
  else return new Response("Invalid action", { status: 400 });

  const next: IntakeState = {
    id,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    updatedBy: ADMIN_USER || "admin",
    notes,
    queue: {
      position: (nextStatus === "queued" || nextStatus === "approved") ? queuePos : null,
      scheduledFor: (nextStatus === "queued" || nextStatus === "approved") ? scheduledFor : null,
    },
  };

  // If denied/completed, clear queue fields
  if (nextStatus === "denied" || nextStatus === "completed") {
    next.queue = { position: null, scheduledFor: null };
  }

  const key = `${STATE_PREFIX}${id}.json`;
  await bucket.put(key, JSON.stringify(next, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });

  // back to the intake detail page
  return new Response(null, {
    status: 303,
    headers: { Location: `/admin/intake/${encodeURIComponent(id)}` },
  });
};
