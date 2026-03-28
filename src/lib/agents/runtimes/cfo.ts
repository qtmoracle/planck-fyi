// src/lib/agents/runtimes/cfo.ts
// CFO Agent Runtime v0.01
//
// Declarative contract for the CFO financial snapshot agent.
// Reads completed job data already fetched by the operator dashboard and
// computes revenue metrics: collected totals, paid/unpaid counts, averages.
// READ-ONLY — never fabricates data; only sums non-null amount_collected values.

import { AGENT_RUNTIME_SPEC, type AgentRuntime } from "../agent-runtime";

export const cfoRuntime: AgentRuntime = {

  identity: {
    name:         "cfo",
    display_name: "CFO Snapshot",
    spec:         AGENT_RUNTIME_SPEC,
    version:      "v0.01",
    status:       "active",
  },

  scope: {
    layers:      ["financial", "job"],
    description: "Computes revenue metrics from completed job data: total collected, paid/unpaid counts, and average per completed job.",
  },

  inputs: [
    {
      kind:    "api_response",
      sources: ["/api/job/completed"],
    },
  ],

  memory: {
    backend:            "none",
    scoped_to_operator: true,
  },

  capabilities: [
    { id: "payment_status_rollup",   description: "Counts jobs by payment status: paid, partial, waived, unpaid." },
    { id: "revenue_sum",             description: "Sums amount_collected across completed jobs where value is a non-null number." },
    { id: "average_calculation",     description: "Computes average collected amount per job with a recorded payment." },
    { id: "data_gap_disclosure",     description: "Surfaces a footnote when amount_collected is null for some jobs — never substitutes 0." },
    { id: "unpaid_flag",             description: "Highlights unpaid job count in red when > 0 as an operator attention signal." },
  ],

  actions: [
    { id: "render_revenue_snapshot", kind: "render", description: "Render the Revenue Snapshot card in the operator dashboard from the completed jobs array.", mutates_state: false },
  ],

  permissions: {
    r2:              "none",
    external_api:    false,
    internal_api:    "read",
    session_storage: "none",
  },

  guardrails: [
    { id: "no_fabrication",         description: "CFO agent must never invent revenue figures. If amount_collected is null, the field is shown as '—'." },
    { id: "null_safe_summation",     description: "Only non-null number values of amount_collected are included in totals and averages." },
    { id: "no_r2_writes",           description: "CFO agent may not write to R2 or persist financial data server-side." },
    { id: "no_payment_mutation",     description: "CFO agent may not initiate, modify, or settle any payment — display only." },
    { id: "gap_disclosure_required", description: "When some jobs lack amount_collected, a footnote must appear disclosing the partial coverage." },
  ],

  triggers: [
    { kind: "event",    description: "Fires after loadCompleted() resolves in the operator dashboard reload cycle." },
    { kind: "interval", description: "Re-computed on every dashboard reload (default: 20-second interval)." },
  ],

  outputs: [
    { id: "completed_count",  description: "Total number of completed jobs for this operator.",                   shape: "number" },
    { id: "paid_count",       description: "Jobs where payment_status is paid, partial, or waived.",              shape: "number" },
    { id: "unpaid_count",     description: "Jobs where payment_status is unpaid or absent.",                      shape: "number" },
    { id: "total_collected",  description: "Sum of amount_collected across jobs with a non-null value.",          shape: "number | null" },
    { id: "avg_per_job",      description: "Average collected amount across jobs with a non-null amount_collected.", shape: "number | null" },
    { id: "coverage_note",    description: "Footnote disclosing partial data when some jobs lack amount_collected.", shape: "string | null" },
  ],

  observability: {
    log_backend: "none",
    ui_panel:    true,
  },

};
