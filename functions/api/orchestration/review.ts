// functions/api/orchestration/review.ts
// POST /api/orchestration/review
//
// Human Approval Layer v0.01 — append-only review log.
//
// Accepts a human review decision (approved | denied) for a proposed intent.
// Finds the intent by ID across log entries, validates it is still "proposed",
// applies review metadata, and persists a new log entry. Never mutates history.
//
// Auth:    x-agent-token (dashboard uses same token; agents cannot self-approve —
//          reviewed_by must be a human identifier and is logged verbatim)
// Mutates: append-only R2 write only
// Version: orchestration-review-v0.01

import { checkAgentAuth, isR2, json, r2GetJSON } from "../agent/_lib";
import {
  ORCHESTRATION_LOG_PREFIX,
  reviewOrchestrationIntent,
  isHumanExecutableAction,
} from "qtm-core/orchestration";
import type { OrchestrationIntent } from "qtm-core/orchestration";

export const REVIEW_LOG_PREFIX =
  "planck/orchestration_logs/ORCHESTRATION_REVIEW_v0.01/";

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    const authError = checkAgentAuth(request, env);
    if (authError) return authError;

    const bucket = env?.INTAKE_BUCKET;
    if (!isR2(bucket)) {
      return json({ ok: false, error: "r2_binding_missing" }, 500);
    }

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
    const decision = String(body.decision || "").trim() as "approved" | "denied";
    const reviewedBy = String(body.reviewed_by || "").trim();
    const note = typeof body.note === "string" ? body.note.trim() : undefined;

    if (!intentId) {
      return json({ ok: false, error: "missing_intent_id" }, 400);
    }
    if (decision !== "approved" && decision !== "denied") {
      return json(
        { ok: false, error: "invalid_decision", detail: 'must be "approved" or "denied"' },
        400
      );
    }
    if (!reviewedBy) {
      return json({ ok: false, error: "missing_reviewed_by" }, 400);
    }

    const listed = await bucket.list({ prefix: ORCHESTRATION_LOG_PREFIX, limit: 1000 });
    const allKeys: string[] = (listed?.objects || [])
      .map((o: any) => String(o?.key || ""))
      .filter(Boolean)
      .sort((a: string, b: string) => b.localeCompare(a));

    let foundIntent: OrchestrationIntent | null = null;

    for (const key of allKeys) {
      const entry = await r2GetJSON(bucket, key);
      if (!entry || entry.schema !== "ORCHESTRATION_INTENT_LOG_v0.01") continue;

      const intents: OrchestrationIntent[] = Array.isArray(entry.intents) ? entry.intents : [];
      const match = intents.find((i) => i.id === intentId);
      if (match) {
        foundIntent = match;
        break;
      }
    }

    if (!foundIntent) {
      return json({ ok: false, error: "intent_not_found", intent_id: intentId }, 404);
    }

    if (foundIntent.mode !== "proposed") {
      return json(
        {
          ok: false,
          error: "intent_not_reviewable",
          detail: `intent is already "${foundIntent.mode}"`,
          intent_id: intentId,
        },
        409
      );
    }

    let reviewed: OrchestrationIntent;
    try {
      reviewed = reviewOrchestrationIntent({
        intent: foundIntent,
        decision,
        reviewed_by: reviewedBy,
        note,
      });
    } catch (err: any) {
      return json(
        { ok: false, error: "review_failed", detail: String(err?.message || err) },
        400
      );
    }

    const executable = isHumanExecutableAction(reviewed.action);

    const now = new Date().toISOString();
    const ts = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const key = `${REVIEW_LOG_PREFIX}${ts}_${random}.json`;

    const reviewEntry = {
      schema: "ORCHESTRATION_REVIEW_LOG_v0.01",
      logged_at: now,
      intent_id: intentId,
      decision,
      reviewed_by: reviewedBy,
      ...(note ? { note } : {}),
      executable,
      execution_note: executable
        ? "Action is in human-executable subset. POST /api/orchestration/execute with this intent_id to execute."
        : "Action is not in human-executable subset. Approval logged only.",
      intent_before: foundIntent,
      intent_after: reviewed,
    };

    await bucket.put(key, JSON.stringify(reviewEntry, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    console.log(
      `[orchestration-review] intent="${intentId}" decision="${decision}" by="${reviewedBy}" key="${key}"`
    );

    return json(
      {
        ok: true,
        intent_id: intentId,
        decision,
        reviewed_by: reviewedBy,
        executable,
        execution_note: reviewEntry.execution_note,
        intent: reviewed,
        log_key: key,
      },
      200
    );
  } catch (err: any) {
    return json(
      { ok: false, error: "internal_error", message: String(err?.message || err) },
      500
    );
  }
};
