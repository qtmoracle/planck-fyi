// src/lib/orchestration/policy.ts
// Orchestration action policy for v0.01.
//
// Two tiers:
//   ALLOWED_ACTIONS     — may exist as proposed intents
//   HUMAN_EXECUTABLE    — narrower subset; may be acted on after human approval
//
// DISALLOWED_ACTIONS are blocked at all tiers.

const ALLOWED_ACTIONS = new Set<string>([
  "notify_operator",
  "review_unassigned_job",
  "flag_payment_risk",
  "review_schema_issue",
  "prompt_admin_assignment",
  "evaluate_intake",
  "evaluate_job",
  "evaluate_record",
  "surface_suggestions",
  "surface_flags",
]);

// Narrower subset: actions a human may approve for eventual execution.
// v0.01: all approved actions remain informational — no execution routes exist yet.
const HUMAN_EXECUTABLE_ACTIONS = new Set<string>([
  "notify_operator",
  "review_unassigned_job",
  "prompt_admin_assignment",
  "flag_payment_risk",
  "review_schema_issue",
]);

const DISALLOWED_ACTIONS = new Set<string>([
  "complete_job",
  "mutate_payment",
  "assign_job_automatically",
  "rewrite_record",
  "create_service_event_automatically",
]);

/**
 * Returns true if the given action ID is permitted to exist as a proposed
 * orchestration intent. Explicitly disallowed actions always return false.
 */
export function isAllowedAction(actionId: string): boolean {
  const id = String(actionId || "").trim();
  if (DISALLOWED_ACTIONS.has(id)) return false;
  return ALLOWED_ACTIONS.has(id) || !DISALLOWED_ACTIONS.has(id);
}

/**
 * Returns true if the action is in the approved-executable subset for v0.01.
 *
 * Being human-executable means a human may approve it and the system will
 * acknowledge that approval. v0.01 execution routes do not yet exist for any
 * of these actions — approval is logged and displayed but does not trigger
 * autonomous system action.
 */
export function isHumanExecutableAction(actionId: string): boolean {
  const id = String(actionId || "").trim();
  if (DISALLOWED_ACTIONS.has(id)) return false;
  return HUMAN_EXECUTABLE_ACTIONS.has(id);
}
