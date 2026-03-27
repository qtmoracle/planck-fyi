// src/lib/surfaces/detailing-runtime.ts
// Surface Runtime — auto-detailing
// Spec: surface-runtime-spec-v0.01
//
// Declares the canonical execution contract for the auto-detailing surface.
// Does NOT modify any API behavior — claim, complete, evidence, and service-event
// endpoints remain the authoritative runtime. This file describes what they enforce.

import {
  SURFACE_RUNTIME_SPEC,
  registerSurfaceRuntime,
  type SurfaceRuntime,
} from "../surface-runtime";

export const detailingRuntime: SurfaceRuntime = {
  identity: {
    surface_slug: "auto-detailing",
    display_name: "Auto Detailing",
    spec: SURFACE_RUNTIME_SPEC,
    status: "active",
  },

  execution: {
    // Operator must call POST /api/job/claim before execution begins.
    // claim sets job state -> active and writes assigned_to = operator slug.
    claim_mode: "required",

    // POST /api/job/complete scopes the completion scan to assigned_to === operatorSlug.
    // A job claimed by operator A cannot be completed by operator B.
    ownership_mode: "assigned",

    // ServiceEvent (SES) is the authoritative record of what happened on-site.
    // job_state tracks lifecycle phase; completion_packet is the immutable seal.
    execution_record: "service_event",

    // Payment is recorded via ServiceEvent at any point during execution.
    // It does not gate job completion — the operator calls complete independently.
    payment_timing: "independent",

    // Completed jobs appear in the operator dashboard completed-jobs panel.
    completed_jobs_visible: true,
  },

  evidence: {
    // Arrival, before-service, and after-service photos are the core evidence set.
    required_categories: ["arrival", "before", "after"],
    optional_categories: [],
    min_per_category: 1,
  },

  lifecycle: [
    "queued",
    "claimed",
    "arrived",
    "in_progress",
    "evidence",
    "complete",
  ],

  lifecycle_labels: {
    queued: "Awaiting technician.",
    claimed: "Load job and confirm client access.",
    arrived: "Begin service when ready.",
    in_progress: "Capture before and in-progress photos.",
    evidence: "Collect payment and record closeout.",
    complete: "Service complete.",
  },
};

// Self-register on import so resolveSurfaceRuntime("auto-detailing") works
// without requiring callers to enumerate surface modules manually.
registerSurfaceRuntime(detailingRuntime);

// Re-export the SES adapter for co-location convenience.
// The adapter handles payload interpretation and record composition;
// this runtime handles execution contract and lifecycle declaration.
export { autoDetailingAdapter } from "../runtime-adapters";
