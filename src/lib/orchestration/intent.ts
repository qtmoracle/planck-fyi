// src/lib/orchestration/intent.ts
// Pure function: maps routing output into proposed orchestration intents.
// No side effects. No state mutation. Returns mode: "proposed" only.

import type { OrchestrationIntent } from "./types";
import { isAllowedAction } from "./policy";

let _counter = 0;

function makeId(): string {
  const ts  = Date.now();
  const seq = (++_counter).toString().padStart(4, "0");
  const rnd = Math.random().toString(36).slice(2, 7);
  return `oi_${ts}_${seq}_${rnd}`;
}

export type BuildIntentsInput = {
  event: {
    type: string;
    payload?: any;
  };
  routingPlan: Array<{
    name: string;
    display_name?: string;
    allowed_actions?: Array<{
      id: string;
      kind: string;
      description: string;
      mutates_state: boolean;
    }>;
    guardrails?: Array<{ id: string; description: string }>;
  }>;
};

/**
 * Build orchestration intents from a routing plan.
 *
 * For each agent in the routing plan, map its allowed_actions to proposed
 * orchestration intents — filtered through the orchestration policy.
 *
 * Pure function: deterministic, no side effects, no mutations.
 * All returned intents have mode: "proposed" and requires_human: true.
 */
export function buildOrchestrationIntents(input: BuildIntentsInput): OrchestrationIntent[] {
  const { event, routingPlan } = input;
  const now = new Date().toISOString();

  const intents: OrchestrationIntent[] = [];

  for (const agent of routingPlan) {
    const actions = Array.isArray(agent.allowed_actions) ? agent.allowed_actions : [];

    for (const action of actions) {
      // Only create intents for actions the policy permits
      if (!isAllowedAction(action.id)) continue;

      // Derive target from event payload where possible
      const operatorSlug = String(event.payload?.source?.operator_slug || "").trim() || undefined;
      const intakeId     = String(event.payload?.id || "").trim() || undefined;

      const target: OrchestrationIntent["target"] = (() => {
        if (event.type === "intake_created") {
          return { type: "intake", id: intakeId, operator_slug: operatorSlug };
        }
        if (event.type === "job_created" || event.type === "job_completed") {
          return { type: "job", operator_slug: operatorSlug };
        }
        if (event.type === "record_composed") {
          return { type: "record", operator_slug: operatorSlug };
        }
        return { type: "operator", operator_slug: operatorSlug };
      })();

      intents.push({
        id:           makeId(),
        source_event: event.type,
        initiated_by: "agent",
        agent_id:     agent.name,
        action:       action.id,
        target,
        mode:          "proposed",
        reasons:       [action.description],
        requires_human: true,
        created_at:    now,
      });
    }
  }

  return intents;
}
