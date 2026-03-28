// functions/api/orchestration/execute.ts
// POST /api/orchestration/execute
//
// Action Surface Execution v0.01
//
// Accepts an approved intent ID, loads the reviewed intent from the review log,
// validates approved state, executes through the Action Surface executor,
// and persists an append-only execution log entry.
//
// Constraints:
//   - only approved intents may be executed
//   - only Action Surface registry actions are allowed
//   - Access Layer is re-checked inside the executor
//   - no batch execution in v0.01
//   - each call produces one append-only execution log entry
//
// Auth:    x-agent-token (human initiates from dashboard; agent token used for API auth)
// Mutates: append-only R2 writes only — no execution spine state modified
// Version: orchestration-execute-v0.01

import { checkAgentAuth, isR2, json, r2GetJSON } from "../agent/_lib";
import { executeApprovedIntent } from "../../../src/lib/orchestration/execute-approved";
import type { OrchestrationIntent } from "../../../src/lib/orchestration/types";
import { REVIEW_LOG_PREFIX } from "./review";

const EXECUTE_LOG_PREFIX = "planck/orchestration_logs/ORCHESTRATION_EXECUTE_v0.01/";

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // Auth
    const authError = checkAgentAuth(request, env);
    if (authError) return authError;

    // R2
    const bucket = env?.INTAKE_BUCKET;
    if (!isR2(bucket)) {
      return json({ ok: false, error: "r2_binding_missing" }, 500);
    }

    // Parse body
    let body: any = null;
    try {
      const txt = await request.text();
      body = txt ? JSON.parse(txt) : null;
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    if (!body || typeof body !== "object") {
      return json({ ok: false, error: "missing_body" }, 400);
    }

    const intentId = String(body.intent_id || "").trim();
    if (!intentId) {
      return json({ ok: false, error: "missing_intent_id" }, 400);
    }

    // Find the most recent approved review entry for this intent ID
    // Scan REVIEW log (not proposal log) — approved state is authoritative there
    const reviewListed = await bucket.list({ prefix: REVIEW_LOG_PREFIX, limit: 1000 });
    const reviewKeys: string[] = (reviewListed?.objects || [])
      .map((o: any) => String(o?.key || ""))
      .filter(Boolean)
      .sort((a: string, b: string) => b.localeCompare(a)); // newest first

    let approvedIntent: OrchestrationIntent | null = null;

    for (const key of reviewKeys) {
      const entry = await r2GetJSON(bucket, key);
      if (!entry || entry.schema !== "ORCHESTRATION_REVIEW_LOG_v0.01") continue;
      if (String(entry.intent_id || "") !== intentId) continue;
      if (String(entry.decision || "") !== "approved") continue;

      // Found most recent approved review for this intent — use intent_after
      if (entry.intent_after && typeof entry.intent_after === "object") {
        approvedIntent = entry.intent_after as OrchestrationIntent;
        break;
      }
    }

    if (!approvedIntent) {
      return json({
        ok:        false,
        error:     "approved_intent_not_found",
        detail:    "No approved review found for this intent ID.",
        intent_id: intentId,
      }, 404);
    }

    // Validate approved state on the intent itself (belt-and-suspenders)
    if (approvedIntent.mode !== "approved") {
      return json({
        ok:        false,
        error:     "intent_not_approved",
        intent_id: intentId,
        mode:      approvedIntent.mode,
      }, 409);
    }

    // Execute through the Action Surface bridge
    const bridgeResult = await executeApprovedIntent(approvedIntent, bucket);

    const now    = new Date().toISOString();
    const ts     = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const logKey = `${EXECUTE_LOG_PREFIX}${ts}_${random}.json`;

    // Persist append-only execution log entry regardless of success/failure
    const executeEntry = {
      schema:     "ORCHESTRATION_EXECUTE_LOG_v0.01",
      logged_at:  now,
      intent_id:  intentId,
      action:     approvedIntent.action,
      target:     approvedIntent.target,
      bridged:    bridgeResult.bridged,
      result:     bridgeResult.bridged ? bridgeResult.result : null,
      refusal:    bridgeResult.bridged ? null : { reason: bridgeResult.reason },
      intent:     approvedIntent,
    };

    await bucket.put(logKey, JSON.stringify(executeEntry, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    console.log(
      `[orchestration-execute] intent="${intentId}" action="${approvedIntent.action}" bridged=${bridgeResult.bridged} log="${logKey}"`
    );

    if (!bridgeResult.bridged) {
      return json({
        ok:        false,
        error:     "execution_refused",
        reason:    bridgeResult.reason,
        intent_id: intentId,
        action:    approvedIntent.action,
        log_key:   logKey,
      }, 409);
    }

    const { result } = bridgeResult;

    return json({
      ok:          result.ok,
      intent_id:   intentId,
      action:      result.action,
      executed_at: result.executed_at,
      target:      result.target,
      ...(result.metadata  ? { metadata:  result.metadata  } : {}),
      ...(result.reason    ? { reason:    result.reason    } : {}),
      log_key:     logKey,
    }, result.ok ? 200 : 422);

  } catch (err: any) {
    return json(
      { ok: false, error: "internal_error", message: String(err?.message || err) },
      500
    );
  }
};
