// src/lib/surface-runtime.ts
// Surface Runtime Spec v0.01
//
// Canonical contract for surface-level execution semantics.
// Defines the shape that every concrete surface runtime must satisfy.
// This file is types + constants only — no side effects, no imports from surfaces.

export const SURFACE_RUNTIME_SPEC = "surface-runtime-spec-v0.01" as const;
export type SurfaceRuntimeSpec = typeof SURFACE_RUNTIME_SPEC;

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export type LifecyclePhase =
  | "queued"
  | "claimed"
  | "arrived"
  | "in_progress"
  | "evidence"
  | "complete";

// ─── Execution Contract ───────────────────────────────────────────────────────

/**
 * Whether the operator must explicitly call /api/job/claim before execution begins.
 * "required" — job stays queued until claimed; claim sets assigned_to.
 * "optional" — job can be worked without a formal claim step.
 * "none"     — no claim concept for this surface.
 */
export type ClaimMode = "required" | "optional" | "none";

/**
 * Whether execution is scoped to a specific operator slug.
 * "assigned" — job.assigned_to must match the calling operator on complete.
 * "pool"     — any authenticated operator can execute.
 * "none"     — no ownership concept for this surface.
 */
export type OwnershipMode = "assigned" | "pool" | "none";

/**
 * Which storage object is the authoritative record of execution state.
 * "service_event"      — ServiceEvent (SES) is source of truth.
 * "job_state"          — JOB_STATE_v0.01 is source of truth.
 * "completion_packet"  — COMPLETION_PACKET_v0.01 is source of truth.
 */
export type ExecutionRecord = "service_event" | "job_state" | "completion_packet";

/**
 * When payment can be recorded relative to job completion.
 * "independent"     — payment may be recorded at any point; not gated on completion.
 * "before_complete" — payment must be recorded before job can be marked complete.
 * "after_complete"  — payment is recorded only after completion.
 */
export type PaymentTiming = "independent" | "before_complete" | "after_complete";

export interface SurfaceExecutionContract {
  claim_mode: ClaimMode;
  ownership_mode: OwnershipMode;
  execution_record: ExecutionRecord;
  payment_timing: PaymentTiming;
  /** Whether completed jobs remain visible in the operator dashboard. */
  completed_jobs_visible: boolean;
}

// ─── Evidence Contract ────────────────────────────────────────────────────────

export interface EvidenceContract {
  /** Evidence categories that must be captured for this surface. */
  required_categories: string[];
  /** Evidence categories that are captured but not required. */
  optional_categories: string[];
  /** Minimum number of photos per required category. */
  min_per_category: number;
}

// ─── Identity ─────────────────────────────────────────────────────────────────

export type SurfaceRuntimeStatus = "active" | "planned" | "deprecated";

export interface SurfaceRuntimeIdentity {
  /** The slug used in operator routing and intake source.surface_slug. */
  surface_slug: string;
  /** Human-readable display name for this surface. */
  display_name: string;
  /** Spec version this runtime was written against. */
  spec: SurfaceRuntimeSpec;
  /** Deployment status of this surface runtime. */
  status: SurfaceRuntimeStatus;
}

// ─── Surface Runtime (root contract) ─────────────────────────────────────────

export interface SurfaceRuntime {
  identity: SurfaceRuntimeIdentity;
  execution: SurfaceExecutionContract;
  evidence: EvidenceContract;
  /** Ordered lifecycle phases for this surface, from first to terminal. */
  lifecycle: LifecyclePhase[];
  /** Operator-facing labels for each lifecycle phase. Partial — omit phases that use defaults. */
  lifecycle_labels: Partial<Record<LifecyclePhase, string>>;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/** Registry of all registered surface runtimes, keyed by surface_slug. */
export type SurfaceRuntimeRegistry = Record<string, SurfaceRuntime>;

const _registry: SurfaceRuntimeRegistry = {};

/**
 * Register a surface runtime. Called once per concrete runtime module at import time.
 * Registration is idempotent — re-registering the same slug overwrites the prior entry.
 */
export function registerSurfaceRuntime(runtime: SurfaceRuntime): void {
  _registry[runtime.identity.surface_slug] = runtime;
}

/** Resolve a surface runtime by slug. Returns undefined if not registered. */
export function resolveSurfaceRuntime(slug: string | null | undefined): SurfaceRuntime | undefined {
  const key = typeof slug === "string" ? slug.trim() : "";
  return _registry[key];
}

/** Return all registered surface runtimes. */
export function listSurfaceRuntimes(): SurfaceRuntime[] {
  return Object.values(_registry);
}
