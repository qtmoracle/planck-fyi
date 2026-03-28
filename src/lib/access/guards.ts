import type { AccessDecision } from "./types";

/**
 * Throws a structured JSON error if the access decision denies the request.
 * Use this at enforcement points inside Pages Functions.
 */
export function requireAccess(decision: AccessDecision): void {
  if (!decision.allow) {
    throw new Error(
      JSON.stringify({
        code: "ACCESS_DENIED",
        reasons: decision.reasons,
      })
    );
  }
}

/**
 * Returns a standardized Response for access denials.
 * Use this when you want to return early rather than throw.
 */
export function denyResponse(decision: AccessDecision): Response {
  const primaryReason = decision.reasons[0] ?? "access_denied";

  // suspended → 403, limited → 402, everything else → 403
  const status =
    primaryReason === "operator_suspended" ? 403
    : primaryReason === "operator_limited_execution_blocked" ? 402
    : 403;

  const body =
    primaryReason === "operator_suspended"
      ? { ok: false, error: "operator_suspended" }
      : primaryReason === "operator_limited_execution_blocked"
      ? { ok: false, error: "operator_limited" }
      : { ok: false, error: primaryReason };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
