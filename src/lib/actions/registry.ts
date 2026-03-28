// src/lib/actions/registry.ts
// Action Surface allowlist — v0.01.
//
// Only actions that are:
//   - low-risk: no irreversible state mutations
//   - auditable: append-only R2 log entry produced
//   - advisory: inform humans, do not alter execution records
//   - compatible: supported by current repo R2 patterns

import type { ActionSurfaceAction } from "./types";

type ActionDescriptor = {
  action: ActionSurfaceAction;
  description: string;
  r2_prefix: string;
  schema: string;
};

export const ACTION_REGISTRY: Record<ActionSurfaceAction, ActionDescriptor> = {
  create_admin_followup: {
    action:      "create_admin_followup",
    description: "Create an append-only follow-up task log entry for admin review.",
    r2_prefix:   "planck/action_logs/ACTION_FOLLOWUP_v0.01/",
    schema:      "ACTION_FOLLOWUP_v0.01",
  },
  create_operator_followup: {
    action:      "create_operator_followup",
    description: "Create an append-only follow-up task log entry for operator review.",
    r2_prefix:   "planck/action_logs/ACTION_FOLLOWUP_v0.01/",
    schema:      "ACTION_FOLLOWUP_v0.01",
  },
  flag_job_for_review: {
    action:      "flag_job_for_review",
    description: "Persist a review flag entry tied to a job ID in append-only form.",
    r2_prefix:   "planck/action_logs/ACTION_JOB_FLAG_v0.01/",
    schema:      "ACTION_JOB_FLAG_v0.01",
  },
  attach_advisory_note: {
    action:      "attach_advisory_note",
    description: "Persist an advisory note tied to an intake, job, or service event in append-only form.",
    r2_prefix:   "planck/action_logs/ACTION_ADVISORY_NOTE_v0.01/",
    schema:      "ACTION_ADVISORY_NOTE_v0.01",
  },
  queue_assignment_review: {
    action:      "queue_assignment_review",
    description: "Log that a job or intake requires operator assignment review.",
    r2_prefix:   "planck/action_logs/ACTION_ASSIGNMENT_REVIEW_v0.01/",
    schema:      "ACTION_ASSIGNMENT_REVIEW_v0.01",
  },
};

// Explicitly excluded actions — never in the Action Surface
const EXCLUDED_ACTIONS = new Set([
  "complete_job",
  "mutate_payment",
  "reassign_job_owner",
  "auto_create_service_event",
  "rewrite_record",
]);

export function isRegisteredAction(action: string): action is ActionSurfaceAction {
  if (EXCLUDED_ACTIONS.has(action)) return false;
  return Object.prototype.hasOwnProperty.call(ACTION_REGISTRY, action);
}

export function getActionDescriptor(action: ActionSurfaceAction): ActionDescriptor {
  return ACTION_REGISTRY[action];
}
