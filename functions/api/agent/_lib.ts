// functions/api/agent/_lib.ts
// Shared primitives for /api/agent/* route handlers.
// CORS is handled upstream by functions/api/_middleware.ts.

// ── Key constants ─────────────────────────────────────────────────────────────
// These match the exact R2 key layout used by admin/job/create/[id].ts
// and admin/state/[id].ts — no deviation.

export const INTAKE_PACKET_PREFIX = "planck/intake_packets/INTAKE_PACKET_v0.01/";
export const INTAKE_STATE_PREFIX  = "planck/intake_state/INTAKE_STATE_v0.01/";
export const JOB_PACKET_PREFIX    = "planck/job_packets/JOB_PACKET_v0.01/";
export const JOB_STATE_PREFIX     = "planck/job_state/JOB_STATE_v0.01/";

export function intakePacketKey(intakeId: string): string {
  return `${INTAKE_PACKET_PREFIX}${intakeId}.json`;
}

export function intakeStateKey(intakeId: string): string {
  return `${INTAKE_STATE_PREFIX}${intakeId}.json`;
}

export function jobPacketKey(jobId: string): string {
  return `${JOB_PACKET_PREFIX}${jobId}.json`;
}

export function jobStateKey(jobId: string): string {
  return `${JOB_STATE_PREFIX}${jobId}.json`;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/** Returns a 401 Response if agent auth fails, null if auth passes. */
export function checkAgentAuth(request: Request, env: any): Response | null {
  const required = String(env?.AGENT_TOKEN || "");
  const provided = String(request.headers.get("x-agent-token") || "");
  if (!required || provided !== required) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  return null;
}

// ── Response helper ───────────────────────────────────────────────────────────

export function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// ── R2 helpers ────────────────────────────────────────────────────────────────

export function isR2(bucket: any): boolean {
  return (
    bucket != null &&
    typeof bucket.get === "function" &&
    typeof bucket.head === "function" &&
    typeof bucket.put === "function"
  );
}

export async function r2GetJSON(bucket: any, key: string): Promise<any | null> {
  try {
    const obj = await bucket.get(key);
    if (!obj) return null;
    return JSON.parse(await obj.text());
  } catch {
    return null;
  }
}

export async function r2Exists(bucket: any, key: string): Promise<boolean> {
  try {
    return Boolean(await bucket.head(key));
  } catch {
    return false;
  }
}

export async function r2PutJSON(bucket: any, key: string, value: any): Promise<void> {
  await bucket.put(key, JSON.stringify(value, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

// ── Crypto ────────────────────────────────────────────────────────────────────
// Identical implementation to admin/job/create/[id].ts to produce the same hashes.

export function stableStringify(value: any): string {
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

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
