// src/lib/agents/registry.ts
// Agent Runtime Registry v0.01
//
// Canonical mapping of agent name → AgentRuntime contract.
// Declarative only — no fetch, no side effects, no system mutation.
// Import individual runtimes directly for tree-shaking; import this registry
// for enumeration, documentation generation, or validator tooling.

import { type AgentRuntime, type AgentRuntimeRegistry } from "./agent-runtime";
import { omniRuntime } from "./runtimes/omni";
import { ctoRuntime  } from "./runtimes/cto";
import { cfoRuntime  } from "./runtimes/cfo";

export const agentRegistry: AgentRuntimeRegistry = {
  omni: omniRuntime,
  cto:  ctoRuntime,
  cfo:  cfoRuntime,
};

/** Resolve an agent runtime by name. Returns undefined if not registered. */
export function resolveAgentRuntime(name: string): AgentRuntime | undefined {
  return agentRegistry[name.trim()];
}

/** Return all registered agent runtimes. */
export function listAgentRuntimes(): AgentRuntime[] {
  return Object.values(agentRegistry);
}
