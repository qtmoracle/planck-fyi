// src/lib/agents/agent-runtime.ts
// Agent Runtime Spec v0.01
//
// Canonical contract for all agent runtimes in the Planck execution platform.
// Declarative only — no fetch, no side effects, no system mutation.

export const AGENT_RUNTIME_SPEC = "agent-runtime-spec-v0.01" as const;
export type AgentRuntimeSpec = typeof AGENT_RUNTIME_SPEC;

// ─── Identity ─────────────────────────────────────────────────────────────────

export type AgentStatus = "active" | "planned" | "deprecated";

export interface AgentIdentity {
  /** Canonical agent name used in registry and observability keys. */
  name: string;
  /** Human-readable display name. */
  display_name: string;
  /** Spec version this runtime was written against. */
  spec: AgentRuntimeSpec;
  /** Version of this concrete runtime. */
  version: string;
  /** Deployment status. */
  status: AgentStatus;
}

// ─── Scope ────────────────────────────────────────────────────────────────────

export type AgentScopeLayer =
  | "intake"
  | "job"
  | "service_event"
  | "payment"
  | "system"
  | "operator"
  | "financial";

export interface AgentScope {
  /** Which system layers this agent operates over. */
  layers: AgentScopeLayer[];
  /** Free-text description of what this agent is responsible for. */
  description: string;
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export type InputSourceKind =
  | "system_event"   // internal event bus (e.g. intake_created)
  | "api_response"   // data returned from a Pages Function endpoint
  | "file_system"    // read-only repo file access (CTO validator)
  | "session_store"  // sessionStorage in the operator browser
  | "manual";        // operator-initiated (button click, form)

export interface AgentInput {
  kind: InputSourceKind;
  /** Specific event types, endpoint paths, or keys this agent consumes. */
  sources: string[];
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export type MemoryBackend = "none" | "session_storage" | "r2" | "in_memory";

export interface AgentMemory {
  backend: MemoryBackend;
  /** Key pattern used in the chosen backend (e.g. "omni:{intakeId}"). */
  key_pattern?: string;
  /** Maximum number of entries retained (for log-style memory). */
  max_entries?: number;
  /** Whether memory is scoped per operator slug. */
  scoped_to_operator: boolean;
}

// ─── Capabilities ─────────────────────────────────────────────────────────────

export interface AgentCapability {
  /** Short identifier for this capability. */
  id: string;
  description: string;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type ActionKind =
  | "read"       // read data from a source
  | "suggest"    // return a structured suggestion to the operator
  | "flag"       // surface a data quality or missing-field warning
  | "render"     // update a UI element
  | "validate"   // run a check and report PASS/FAIL
  | "log";       // append to an activity log

export interface AgentAction {
  id: string;
  kind: ActionKind;
  description: string;
  /** Whether this action mutates system state. Must be false for v0.01. */
  mutates_state: boolean;
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export interface AgentPermissions {
  /** R2 access level. */
  r2: "none" | "read" | "read_write";
  /** Whether this agent may call external APIs (Resend, Claude, etc.). */
  external_api: boolean;
  /** Whether this agent may call internal Pages Function endpoints. */
  internal_api: "none" | "read" | "read_write";
  /** Whether this agent may write to sessionStorage. */
  session_storage: "none" | "read" | "read_write";
}

// ─── Guardrails ───────────────────────────────────────────────────────────────

export interface AgentGuardrail {
  id: string;
  description: string;
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

export type TriggerKind =
  | "event"     // fires on a named system event
  | "manual"    // operator-initiated
  | "interval"  // time-based (page reload, polling)
  | "ci";       // invoked in CI pipeline

export interface AgentTrigger {
  kind: TriggerKind;
  description: string;
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

export interface AgentOutput {
  id: string;
  description: string;
  /** Shape hint — not enforced at runtime in v0.01. */
  shape?: string;
}

// ─── Observability ────────────────────────────────────────────────────────────

export interface AgentObservability {
  /** Where activity is logged. */
  log_backend: MemoryBackend;
  /** Log key pattern if applicable. */
  log_key_pattern?: string;
  /** Whether a UI activity panel is rendered for this agent. */
  ui_panel: boolean;
}

// ─── Root Contract ────────────────────────────────────────────────────────────

export interface AgentRuntime {
  identity:      AgentIdentity;
  scope:         AgentScope;
  inputs:        AgentInput[];
  memory:        AgentMemory;
  capabilities:  AgentCapability[];
  actions:       AgentAction[];
  permissions:   AgentPermissions;
  guardrails:    AgentGuardrail[];
  triggers:      AgentTrigger[];
  outputs:       AgentOutput[];
  observability: AgentObservability;
}

// ─── Registry type ────────────────────────────────────────────────────────────

export type AgentRuntimeRegistry = Record<string, AgentRuntime>;
