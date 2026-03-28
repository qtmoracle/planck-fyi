// src/lib/orchestration/approval.ts
// Pure function: apply a human review decision to a proposed orchestration intent.
// No side effects. No state mutation. Returns a new intent object.

import type { OrchestrationIntent } from "./types";

export type ReviewInput = {
  intent: OrchestrationIntent;
  decision: "approved" | "denied";
  reviewed_by: string;
  note?: string;
};

/**
 * Apply a human review decision to a proposed orchestration intent.
 *
 * Validates:
 *   - intent must currently be in "proposed" mode
 *   - requires_human must be true
 *   - reviewed_by must be a non-empty string
 *
 * Returns a new intent with mode updated and review metadata attached.
 * Does not mutate the original intent.
 *
 * Throws if the intent is not reviewable.
 */
export function reviewOrchestrationIntent(input: ReviewInput): OrchestrationIntent {
  const { intent, decision, reviewed_by, note } = input;

  if (intent.mode !== "proposed") {
    throw new Error(`intent_not_reviewable: mode is "${intent.mode}", expected "proposed"`);
  }

  if (intent.requires_human !== true) {
    throw new Error("intent_not_reviewable: requires_human is not true");
  }

  const reviewedBy = String(reviewed_by || "").trim();
  if (!reviewedBy) {
    throw new Error("reviewed_by is required");
  }

  return {
    ...intent,
    mode: decision,
    review: {
      status:      decision,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      ...(note ? { note: String(note).trim() } : {}),
    },
  };
}
