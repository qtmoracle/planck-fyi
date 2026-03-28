// src/lib/agents/runtimes/cto.ts
// CTO Agent Runtime v0.01
//
// Declarative contract for the CTO validation agent.
// Runs read-only system integrity checks against the repo: surfaces, operators,
// templates, surface runtimes, and execution endpoints.
// Intended for manual invocation and CI gating.

import { AGENT_RUNTIME_SPEC, type AgentRuntime } from "../agent-runtime";

export const ctoRuntime: AgentRuntime = {

  identity: {
    name:         "cto",
    display_name: "CTO Validator",
    spec:         AGENT_RUNTIME_SPEC,
    version:      "v0.01",
    status:       "active",
  },

  scope: {
    layers:      ["system"],
    description: "Validates structural integrity of the Planck execution platform: surface definitions, operator mappings, template registry, surface runtimes, and API endpoint presence.",
  },

  inputs: [
    {
      kind:    "file_system",
      sources: [
        "src/data/surfaces.ts",
        "src/data/operators.ts",
        "src/lib/operator-templates.ts",
        "src/lib/surface-runtime.ts",
        "src/lib/surfaces/",
        "functions/api/job/",
        "functions/api/service-events/",
        "functions/api/omni/ingest.ts",
        "functions/api/agent/",
      ],
    },
  ],

  memory: {
    backend:            "none",
    scoped_to_operator: false,
  },

  capabilities: [
    { id: "surface_validation",   description: "Verifies surface definitions have required fields (slug, name)." },
    { id: "operator_validation",  description: "Verifies operators reference known surfaces and have required region fields." },
    { id: "template_validation",  description: "Verifies template registry keys map to existing .astro files; cross-checks operator template:surface combos." },
    { id: "runtime_validation",   description: "Verifies surface-runtime.ts exports expected symbols and concrete runtimes self-register." },
    { id: "endpoint_validation",  description: "Verifies required execution endpoint files exist on disk." },
    { id: "auth_guard_check",     description: "Verifies omni/ingest.ts includes checkAgentAuth guard." },
    { id: "count_reporting",      description: "Reports surface count, operator count, and runtime count." },
  ],

  actions: [
    { id: "validate_system",    kind: "validate", description: "Run all checks and produce a PASS/FAIL report with per-check status.", mutates_state: false },
    { id: "report_counts",      kind: "render",   description: "Print counts of surfaces, operators, and runtimes.",                   mutates_state: false },
    { id: "exit_on_failure",    kind: "log",      description: "Call process.exit(1) if any check fails (enables CI gating).",        mutates_state: false },
  ],

  permissions: {
    r2:              "none",
    external_api:    false,
    internal_api:    "none",
    session_storage: "none",
  },

  guardrails: [
    { id: "read_only_fs",      description: "CTO agent may only read files; it must never write, delete, or modify any file." },
    { id: "no_network_calls",  description: "CTO agent may not make any network calls — validation is purely local." },
    { id: "no_deploy_actions", description: "CTO agent may not trigger builds, deployments, or CI runs." },
    { id: "text_parse_only",   description: "Source files are parsed as text — no TypeScript compilation or runtime import." },
  ],

  triggers: [
    { kind: "manual", description: "npm run validate:system — invoked by engineer or CTO agent." },
    { kind: "ci",     description: "Can gate CI pipelines via process.exit(1) on failure." },
  ],

  outputs: [
    { id: "check_results",    description: "Per-check PASS/FAIL lines with ✓/✗ symbols and detail messages.", shape: "string[]" },
    { id: "system_status",    description: "Top-level SYSTEM STATUS: PASS or FAIL.",                          shape: "\"PASS\" | \"FAIL\"" },
    { id: "counts",           description: "Counts of surfaces, operators, and surface runtimes.",             shape: "{ surfaces: number, operators: number, runtimes: number }" },
    { id: "warnings",         description: "Non-fatal warnings that do not block PASS.",                       shape: "string[]" },
  ],

  observability: {
    log_backend: "none",
    ui_panel:    false,
  },

};
