// src/lib/orchestration/execute-approved.ts
// Approved Intent Execution Bridge — v0.01
//
// Maps an approved orchestration intent to the Action Surface executor.
// This module is the single entry point from the orchestration layer
// into the action execution layer.
//
// Rules:
//   - intent must be approved
//   - requires_human must be true
//   - action must be in the Action Surface registry
//   - Access Layer is re-checked inside executeActionSurfaceIntent
//   - all executions produce an append-only R2 log entry

import type { OrchestrationIntent } from "./types";
import { isHumanExecutableAction } from "./policy";
import { isRegisteredAction, executeActionSurfaceIntent } from "../actions/index";
import type { ActionExecutionResult } from "../actions/types";

export type ExecutionBridgeResult =
  | { bridged: true;  result: ActionExecutionResult }
  | { bridged: false; reason: string; action: string };

/**
 * Attempt to execute an approved orchestration intent via the Action Surface.
 *
 * Returns a bridged result if the action is supported, or a structured
 * refusal if the intent or action is not eligible.
 */
export async function executeApprovedIntent(
  intent: OrchestrationIntent,
  bucket: any
): Promise<ExecutionBridgeResult> {
  if (intent.mode !== "approved") {
    return { bridged: false, reason: "not_approved", action: intent.action };
  }

  if (intent.requires_human !== true) {
    return { bridged: false, reason: "requires_human_not_set", action: intent.action };
  }

  // Check orchestration-layer human-executable policy first
  if (!isHumanExecutableAction(intent.action)) {
    return { bridged: false, reason: "not_human_executable", action: intent.action };
  }

  // Check Action Surface registry
  if (!isRegisteredAction(intent.action)) {
    return { bridged: false, reason: "not_in_action_surface", action: intent.action };
  }

  // Delegate to Action Surface executor (re-checks Access Layer internally)
  const result = await executeActionSurfaceIntent({ intent, bucket });

  return { bridged: true, result };
}
