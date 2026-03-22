// functions/api/job/_lib.ts
//
// Shared primitives for job route handlers.
// CORS is handled upstream by functions/api/_middleware.ts — do not add it here.

// ── Storage key constants ────────────────────────────────────────────────────

export const JOB_STATE_PREFIX = "planck/job_state/JOB_STATE_v0.01/";
export const JOB_PACKET_PREFIX = "planck/job_packets/JOB_PACKET_v0.01/";
export const COMPLETION_PACKET_PREFIX =
  "planck/completion_packets/COMPLETION_PACKET_v0.01/";

export function jobPacketKey(jobId: string): string {
  return `${JOB_PACKET_PREFIX}${jobId}.json`;
}

export function completionPacketKey(jobId: string): string {
  return `${COMPLETION_PACKET_PREFIX}${jobId}.json`;
}

// ── Response helpers ─────────────────────────────────────────────────────────

export function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/** Returns a 401 Response if auth fails, null if auth passes. */
export function checkTechAuth(request: Request, env: any): Response | null {
  const required = String(env?.TECH_TOKEN || "");
  const provided = String(request.headers.get("x-tech-token") || "");
  if (!required || provided !== required) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

// ── R2 helpers ───────────────────────────────────────────────────────────────

export function isR2(bucket: any): boolean {
  return (
    bucket != null &&
    typeof bucket.get === "function" &&
    typeof bucket.head === "function" &&
    typeof bucket.list === "function" &&
    typeof bucket.put === "function"
  );
}

export async function r2GetJSON(
  bucket: any,
  key: string
): Promise<any | null> {
  try {
    const obj = await bucket.get(key);
    if (!obj) return null;
    const txt = await obj.text();
    return JSON.parse(txt);
  } catch {
    return null;
  }
}
