// src/lib/agents/runtimes/omni.ts
// Omni Agent Runtime v0.01
//
// Declarative contract for the Omni ingestion agent.
// Omni receives system events, inspects payload quality, and returns
// structured suggestions + flags to the operator dashboard.
// READ-ONLY — no state mutation, no outbound calls beyond internal API reads.

import { AGENT_RUNTIME_SPEC, type AgentRuntime } from "../agent-runtime";

export const omniRuntime: AgentRuntime = {

  identity: {
    name:         "omni",
    display_name: "Omni",
    spec:         AGENT_RUNTIME_SPEC,
    version:      "v0.02",
    status:       "active",
  },

  scope: {
    layers:      ["intake", "job"],
    description: "Inspects intake and job events, scores data quality, and surfaces prioritized suggestions for operator action.",
  },

  inputs: [
    {
      kind:    "system_event",
      sources: ["intake_created", "job_created", "job_completed", "record_composed"],
    },
    {
      kind:    "api_response",
      sources: ["/api/job/by_id/:job_id"],
    },
    {
      kind:    "session_store",
      sources: ["omni:{intakeId}"],
    },
  ],

  memory: {
    backend:             "session_storage",
    key_pattern:         "omni:{intakeId}",
    max_entries:         1,
    scoped_to_operator:  false,
  },

  capabilities: [
    { id: "intake_quality_scoring",  description: "Scores intake completeness 0–100 based on required and optional field presence." },
    { id: "field_flag_detection",    description: "Detects missing or low-quality fields in contact, asset, and request data." },
    { id: "suggestion_generation",   description: "Returns prioritized action suggestions (approve_intake, request_more_info, create_job)." },
    { id: "job_completion_analysis", description: "Checks payment and evidence status on job_completed events." },
    { id: "memory_persistence",      description: "Caches suggestions per intake ID in sessionStorage for restore on page load." },
  ],

  actions: [
    { id: "score_intake",         kind: "read",    description: "Compute quality_score for an intake payload.",                        mutates_state: false },
    { id: "flag_missing_field",   kind: "flag",    description: "Surface a high-priority warning for a missing required field.",       mutates_state: false },
    { id: "flag_data_quality",    kind: "flag",    description: "Surface a medium-priority warning for incomplete but present data.",  mutates_state: false },
    { id: "suggest_next_action",  kind: "suggest", description: "Return a prioritized action suggestion for the operator.",            mutates_state: false },
    { id: "log_activity",         kind: "log",     description: "Append an entry to the Omni activity log in sessionStorage.",        mutates_state: false },
  ],

  permissions: {
    r2:              "none",
    external_api:    false,
    internal_api:    "read",
    session_storage: "read_write",
  },

  guardrails: [
    { id: "no_r2_writes",        description: "Omni may not write to R2 or mutate any server-side state." },
    { id: "no_external_calls",   description: "Omni may not call external APIs (Resend, Claude, etc.)." },
    { id: "read_only_actions",   description: "All actions must have mutates_state: false." },
    { id: "suggestions_only",    description: "Omni returns suggestions; the operator must confirm before any state-changing action is executed." },
    { id: "no_auto_approve",     description: "Omni may not autonomously approve intakes or create jobs without operator confirmation." },
  ],

  triggers: [
    { kind: "event",  description: "Fires on intake_created event after submit.ts writes to R2 (ctx.waitUntil, best-effort)." },
    { kind: "manual", description: "Operator enters an intake ID and clicks 'Get Suggestions' in the dashboard." },
  ],

  outputs: [
    { id: "quality_score", description: "Integer 0–100 reflecting intake completeness.",                             shape: "number" },
    { id: "suggestions",   description: "Array of prioritized action suggestions with type, action, label, priority.", shape: "Suggestion[]" },
    { id: "flags",         description: "Array of data quality warnings with type, label, priority.",                 shape: "Suggestion[]" },
    { id: "activity_log",  description: "Appended entry in sessionStorage Omni activity log.",                        shape: "OmniLogEntry" },
  ],

  observability: {
    log_backend:     "session_storage",
    log_key_pattern: "omni-log:{operatorSlug}",
    ui_panel:        true,
  },

};
