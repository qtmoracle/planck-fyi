// src/lib/agents/decision.ts
// Agent Decision Layer v0.01
//
// Pure, deterministic function that maps a system event to the set of agents
// that should respond. No API calls, no state mutation, no side effects.
//
// Prepares the path: Event → Agent Selection → (future) Agent Execution

import { resolveAgentRuntime } from "./registry";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KnownEventType =
  | "intake_created"
  | "job_created"
  | "job_completed"
  | "record_composed"
  | "system_validation";

export interface DecisionInput {
  type: KnownEventType | string;
  payload?: unknown;
}

export interface DecisionOutput {
  event_type:      string;
  selected_agents: string[];
  reasoning:       string[];
  confidence:      number;  // 0.0–1.0
  unresolved:      string[];  // agents named in mapping but missing from registry
}

// ─── Event → Agent mapping ────────────────────────────────────────────────────

interface AgentSelection {
  agents:    string[];
  reasoning: string[];
  confidence: number;
}

const EVENT_MAP: Record<string, AgentSelection> = {
  intake_created: {
    agents:     ["omni"],
    reasoning:  ["Omni handles intake evaluation: scores data quality, detects missing fields, and surfaces prioritized suggestions."],
    confidence: 1.0,
  },
  job_created: {
    agents:     ["omni"],
    reasoning:  ["Omni evaluates job creation events: checks operator assignment and suggests scheduling actions."],
    confidence: 1.0,
  },
  job_completed: {
    agents:     ["omni", "cfo"],
    reasoning:  [
      "Omni evaluates job completion: checks payment status and evidence capture.",
      "CFO computes updated revenue metrics from the completed jobs dataset.",
    ],
    confidence: 1.0,
  },
  record_composed: {
    agents:     ["omni"],
    reasoning:  ["Omni evaluates composed records: checks for summary completeness and suggests delivery actions."],
    confidence: 1.0,
  },
  system_validation: {
    agents:     ["cto"],
    reasoning:  ["CTO Validator handles system integrity checks: surfaces, operators, templates, runtimes, and endpoints."],
    confidence: 1.0,
  },
};

// ─── Decision function ────────────────────────────────────────────────────────

/**
 * Evaluate which agents should respond to a given event.
 *
 * Pure function — no side effects, no API calls, no state mutation.
 * Validates each selected agent name against the live registry before returning.
 */
export function decideAgents(input: DecisionInput): DecisionOutput {
  const eventType = String(input.type || "").trim();

  const mapping = EVENT_MAP[eventType];

  if (!mapping) {
    return {
      event_type:      eventType,
      selected_agents: [],
      reasoning:       [`No agent mapping defined for event type: "${eventType}"`],
      confidence:      0.0,
      unresolved:      [],
    };
  }

  // Validate each named agent exists in the live registry
  const resolved:   string[] = [];
  const unresolved: string[] = [];

  for (const name of mapping.agents) {
    if (resolveAgentRuntime(name)) {
      resolved.push(name);
    } else {
      unresolved.push(name);
    }
  }

  const reasoning = [...mapping.reasoning];
  if (unresolved.length > 0) {
    reasoning.push(`Warning: agent(s) not found in registry — ${unresolved.join(", ")}`);
  }

  // Confidence degrades if any named agents are missing from the registry
  const confidence = unresolved.length === 0
    ? mapping.confidence
    : Math.max(0, mapping.confidence - (unresolved.length / mapping.agents.length) * 0.5);

  return {
    event_type:      eventType,
    selected_agents: resolved,
    reasoning,
    confidence,
    unresolved,
  };
}
