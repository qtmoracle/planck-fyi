// src/lib/actions/execute.ts
// Action Surface Executor — v0.01
//
// Narrow executor that maps approved orchestration intents to concrete
// append-only R2 writes. No execution spine state is mutated.
//
// Rules enforced here (in order):
//   1. Intent must be approved
//   2. Intent must have requires_human: true
//   3. Action must be in the Action Surface registry
//   4. Access Layer must pass for the target operator
//   5. R2 write is append-only under action-specific prefix
//   6. Result is returned explicitly — no silent success

import type { OrchestrationIntent } from "../orchestration/types";
import type { ActionSurfaceAction, ActionExecutionResult } from "./types";
import { isRegisteredAction, getActionDescriptor } from "./registry";
import { evaluateAccess } from "../access/index";

type ExecuteInput = {
  intent: OrchestrationIntent;
  bucket: any;  // R2Bucket — typed as any to avoid CF worker type dependency at lib level
};

/**
 * Execute an approved orchestration intent through the Action Surface.
 *
 * All successful executions produce an append-only R2 log entry.
 * No execution spine state (jobs, service events, records) is ever mutated.
 */
export async function executeActionSurfaceIntent(
  input: ExecuteInput
): Promise<ActionExecutionResult> {
  const { intent, bucket } = input;
  const now = new Date().toISOString();

  // 1. Intent must be approved
  if (intent.mode !== "approved") {
    return {
      ok:          false,
      action:      intent.action as ActionSurfaceAction,
      executed_at: now,
      target:      intent.target,
      reason:      "intent_not_approved",
    };
  }

  // 2. Intent must require human
  if (intent.requires_human !== true) {
    return {
      ok:          false,
      action:      intent.action as ActionSurfaceAction,
      executed_at: now,
      target:      intent.target,
      reason:      "requires_human_not_set",
    };
  }

  // 3. Action must be in registry
  if (!isRegisteredAction(intent.action)) {
    return {
      ok:          false,
      action:      intent.action as ActionSurfaceAction,
      executed_at: now,
      target:      intent.target,
      reason:      "action_not_in_surface",
    };
  }

  const action = intent.action as ActionSurfaceAction;

  // 4. Access Layer check for target operator
  const operatorSlug = intent.target.operator_slug || "";
  if (operatorSlug) {
    const accessDecision = evaluateAccess({
      actor:    { type: "system", id: "action-surface" },
      action:   `action_surface_${action}`,
      resource: { type: intent.target.type, owner_operator_slug: operatorSlug },
    });
    if (!accessDecision.allow) {
      return {
        ok:          false,
        action,
        executed_at: now,
        target:      intent.target,
        reason:      `access_denied:${accessDecision.reasons[0] ?? "unknown"}`,
      };
    }
  }

  // 5. Execute via action-specific handler
  try {
    return await dispatchAction({ action, intent, bucket, now });
  } catch (err: any) {
    return {
      ok:          false,
      action,
      executed_at: now,
      target:      intent.target,
      reason:      `execution_error:${String(err?.message || err)}`,
    };
  }
}

// ── Action dispatchers ────────────────────────────────────────────────────────

type DispatchInput = {
  action:  ActionSurfaceAction;
  intent:  OrchestrationIntent;
  bucket:  any;
  now:     string;
};

async function dispatchAction(input: DispatchInput): Promise<ActionExecutionResult> {
  const { action, intent, bucket, now } = input;

  switch (action) {
    case "create_admin_followup":
    case "create_operator_followup":
      return writeFollowup({ intent, bucket, now, audience: action === "create_admin_followup" ? "admin" : "operator" });

    case "flag_job_for_review":
      return writeFlagEntry({ intent, bucket, now });

    case "attach_advisory_note":
      return writeAdvisoryNote({ intent, bucket, now });

    case "queue_assignment_review":
      return writeAssignmentReview({ intent, bucket, now });

    default:
      return {
        ok:          false,
        action,
        executed_at: now,
        target:      intent.target,
        reason:      "no_handler",
      };
  }
}

// ── A. create_admin_followup / create_operator_followup ──────────────────────

async function writeFollowup(input: {
  intent:   OrchestrationIntent;
  bucket:   any;
  now:      string;
  audience: "admin" | "operator";
}): Promise<ActionExecutionResult> {
  const { intent, bucket, now, audience } = input;
  const descriptor = getActionDescriptor(
    audience === "admin" ? "create_admin_followup" : "create_operator_followup"
  );

  const ts     = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const key    = `${descriptor.r2_prefix}${ts}_${random}.json`;

  const entry = {
    schema:       descriptor.schema,
    created_at:   now,
    audience,
    intent_id:    intent.id,
    source_event: intent.source_event,
    action:       intent.action,
    agent_id:     intent.agent_id,
    target:       intent.target,
    reasons:      intent.reasons,
    reviewed_by:  intent.review?.reviewed_by ?? null,
    reviewed_at:  intent.review?.reviewed_at ?? null,
    note:         intent.review?.note ?? null,
  };

  await r2PutJSON(bucket, key, entry);

  return {
    ok:          true,
    action:      descriptor.action,
    executed_at: now,
    target:      intent.target,
    metadata:    { log_key: key, audience },
  };
}

// ── B. flag_job_for_review ───────────────────────────────────────────────────

async function writeFlagEntry(input: {
  intent: OrchestrationIntent;
  bucket: any;
  now:    string;
}): Promise<ActionExecutionResult> {
  const { intent, bucket, now } = input;
  const descriptor = getActionDescriptor("flag_job_for_review");

  const ts     = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const key    = `${descriptor.r2_prefix}${ts}_${random}.json`;

  const entry = {
    schema:       descriptor.schema,
    created_at:   now,
    intent_id:    intent.id,
    source_event: intent.source_event,
    target:       intent.target,
    reasons:      intent.reasons,
    reviewed_by:  intent.review?.reviewed_by ?? null,
    reviewed_at:  intent.review?.reviewed_at ?? null,
  };

  await r2PutJSON(bucket, key, entry);

  return {
    ok:          true,
    action:      "flag_job_for_review",
    executed_at: now,
    target:      intent.target,
    metadata:    { log_key: key },
  };
}

// ── C. attach_advisory_note ──────────────────────────────────────────────────

async function writeAdvisoryNote(input: {
  intent: OrchestrationIntent;
  bucket: any;
  now:    string;
}): Promise<ActionExecutionResult> {
  const { intent, bucket, now } = input;
  const descriptor = getActionDescriptor("attach_advisory_note");

  const ts     = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const key    = `${descriptor.r2_prefix}${ts}_${random}.json`;

  const entry = {
    schema:       descriptor.schema,
    created_at:   now,
    intent_id:    intent.id,
    source_event: intent.source_event,
    target:       intent.target,
    reasons:      intent.reasons,
    note:         intent.review?.note ?? null,
    reviewed_by:  intent.review?.reviewed_by ?? null,
    reviewed_at:  intent.review?.reviewed_at ?? null,
  };

  await r2PutJSON(bucket, key, entry);

  return {
    ok:          true,
    action:      "attach_advisory_note",
    executed_at: now,
    target:      intent.target,
    metadata:    { log_key: key },
  };
}

// ── D. queue_assignment_review ───────────────────────────────────────────────

async function writeAssignmentReview(input: {
  intent: OrchestrationIntent;
  bucket: any;
  now:    string;
}): Promise<ActionExecutionResult> {
  const { intent, bucket, now } = input;
  const descriptor = getActionDescriptor("queue_assignment_review");

  const ts     = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const key    = `${descriptor.r2_prefix}${ts}_${random}.json`;

  const entry = {
    schema:       descriptor.schema,
    created_at:   now,
    intent_id:    intent.id,
    source_event: intent.source_event,
    target:       intent.target,
    reasons:      intent.reasons,
    reviewed_by:  intent.review?.reviewed_by ?? null,
    reviewed_at:  intent.review?.reviewed_at ?? null,
  };

  await r2PutJSON(bucket, key, entry);

  return {
    ok:          true,
    action:      "queue_assignment_review",
    executed_at: now,
    target:      intent.target,
    metadata:    { log_key: key },
  };
}

// ── R2 helper (inline — avoids importing agent/_lib at lib level) ─────────────

async function r2PutJSON(bucket: any, key: string, value: unknown): Promise<void> {
  await bucket.put(key, JSON.stringify(value, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}
