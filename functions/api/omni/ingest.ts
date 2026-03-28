// functions/api/omni/ingest.ts
// POST /api/omni/ingest
//
// Omni v0.02 — Ingestion Layer
//
// Receives system events, normalizes payloads, returns structured suggestions.
// READ-ONLY intelligence — does not mutate any system state.
//
// Auth:    AGENT_TOKEN via header x-agent-token
// Storage: no R2 writes to core state
// Version: omni-ingest-v0.02

import { checkAgentAuth, json } from "../agent/_lib";

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // 0) Auth — same token as agent bridge endpoints
    const authError = checkAgentAuth(request, env);
    if (authError) return authError;

    // 1) Parse body
    let body: any = null;
    try {
      const txt = await request.text();
      body = txt ? JSON.parse(txt) : null;
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    if (!body || typeof body !== "object") {
      return json({ ok: false, error: "missing_body" }, 400);
    }

    const eventType = String(body.type || "").trim();
    const payload = body.payload ?? {};

    if (!eventType) {
      return json({ ok: false, error: "missing_type", hint: "body.type is required" }, 400);
    }

    // 2) Route to handler
    let result: OmniIngestResult;

    switch (eventType) {
      case "intake_created":
        result = handleIntakeCreated(payload);
        break;
      case "job_created":
        result = handleJobCreated(payload);
        break;
      case "job_completed":
        result = handleJobCompleted(payload);
        break;
      case "record_composed":
        result = handleRecordComposed(payload);
        break;
      default:
        result = {
          event_type: eventType,
          recognized: false,
          quality_score: 0,
          suggestions: [
            { type: "info", label: `Unrecognized event type: ${eventType}`, priority: "low" },
          ],
        };
    }

    return json({
      ok: true,
      omni: "ingest-v0.02",
      event_type: eventType,
      recognized: result.recognized,
      quality_score: result.quality_score,
      suggestions: result.suggestions,
      ...(result.flags && result.flags.length > 0 ? { flags: result.flags } : {}),
    }, 200);

  } catch (err: any) {
    return json(
      { ok: false, error: "internal_error", message: String(err?.message || err) },
      500
    );
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────

type SuggestionKind = "action" | "warning" | "info";
type ActionType = "approve_intake" | "create_job" | "request_more_info";
type Priority = "high" | "medium" | "low";

interface Suggestion {
  type: SuggestionKind;
  action?: ActionType;
  label: string;
  priority: Priority;
}

interface OmniIngestResult {
  event_type: string;
  recognized: boolean;
  quality_score: number;
  suggestions: Suggestion[];
  flags?: Suggestion[];
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleIntakeCreated(payload: any): OmniIngestResult {
  const suggestions: Suggestion[] = [];
  const flags: Suggestion[] = [];

  const contact = payload?.data?.contact ?? payload?.contact ?? {};
  const asset   = payload?.data?.asset   ?? payload?.asset   ?? {};
  const request = payload?.data?.request ?? payload?.request ?? {};
  const notes   = payload?.data?.notes   ?? payload?.notes   ?? {};

  // ── Required field checks (each deducts from quality score) ──────────────

  let deductions = 0;

  if (!str(contact.name)) {
    deductions += 15;
    flags.push({ type: "warning", label: "Contact name is missing", priority: "high" });
  }
  if (!str(contact.email) && !str(contact.phone)) {
    deductions += 15;
    flags.push({ type: "warning", label: "No contact method (email or phone)", priority: "high" });
  }
  if (!str(asset.details)) {
    deductions += 15;
    flags.push({ type: "warning", label: "Asset details missing", priority: "high" });
  }

  // service_area maps to "location" in upgrade requirements
  if (!str(request.service_area) && !str(request.serviceArea)) {
    deductions += 20;
    flags.push({ type: "warning", label: "Service location not specified", priority: "high" });
  }

  // tier maps to "service_type" in upgrade requirements
  if (!str(request.tier) && !str(request.tier_id)) {
    deductions += 20;
    flags.push({ type: "warning", label: "Service type not specified", priority: "high" });
  }

  // Optional but tracked for completeness
  if (!str(notes.condition)) {
    deductions += 10;
    flags.push({ type: "warning", label: "Condition notes missing", priority: "medium" });
  }

  const photos = Array.isArray(payload?.photos?.items) ? payload.photos.items : [];
  if (photos.length === 0) {
    deductions += 5;
    flags.push({ type: "warning", label: "No photos attached", priority: "medium" });
  }

  const quality_score = Math.max(0, 100 - deductions);

  // ── Suggestions based on completeness ────────────────────────────────────

  const hasHighPriorityFlags = flags.some((f) => f.priority === "high");

  if (hasHighPriorityFlags) {
    suggestions.push({
      type: "action",
      action: "request_more_info",
      label: "Request more information",
      priority: "high",
    });
    suggestions.push({
      type: "action",
      action: "approve_intake",
      label: "Approve intake anyway",
      priority: "low",
    });
  } else if (flags.length > 0) {
    // Only medium/low flags — non-blocking
    suggestions.push({
      type: "action",
      action: "approve_intake",
      label: "Approve intake",
      priority: "medium",
    });
    suggestions.push({
      type: "action",
      action: "request_more_info",
      label: "Request more information",
      priority: "low",
    });
  } else {
    // Clean intake
    suggestions.push({
      type: "action",
      action: "approve_intake",
      label: "Approve intake",
      priority: "high",
    });
  }

  return { event_type: "intake_created", recognized: true, quality_score, suggestions, flags };
}

function handleJobCreated(payload: any): OmniIngestResult {
  const suggestions: Suggestion[] = [];

  const assignedTo = str(payload?.assigned_to ?? payload?.state?.assigned_to);

  if (!assignedTo) {
    suggestions.push({ type: "warning", label: "No operator assigned", priority: "high" });
    suggestions.push({ type: "action", label: "Assign operator", priority: "high" });
  } else {
    suggestions.push({ type: "info", label: `Assigned to: ${assignedTo}`, priority: "low" });
    suggestions.push({ type: "action", label: "Notify operator", priority: "medium" });
  }

  suggestions.push({ type: "action", label: "Schedule job", priority: "medium" });

  return { event_type: "job_created", recognized: true, quality_score: 100, suggestions };
}

function handleJobCompleted(payload: any): OmniIngestResult {
  const suggestions: Suggestion[] = [];
  const flags: Suggestion[] = [];

  // Check payment
  const paymentRecorded =
    payload?.payment_recorded === true ||
    payload?.state?.payment_recorded === true ||
    str(payload?.payment_amount);

  if (!paymentRecorded) {
    flags.push({ type: "warning", label: "Payment not confirmed", priority: "high" });
    suggestions.push({ type: "action", label: "Confirm payment", priority: "high" });
  }

  // Check evidence
  const hasEvidence = Array.isArray(payload?.evidence) && payload.evidence.length > 0;

  if (!hasEvidence) {
    flags.push({ type: "warning", label: "No evidence items captured", priority: "high" });
  }

  // Follow-up only if no blocking issues
  if (paymentRecorded && hasEvidence) {
    suggestions.push({ type: "action", label: "Follow up with customer", priority: "medium" });
    suggestions.push({ type: "action", label: "Generate media pack", priority: "low" });
  } else {
    suggestions.push({ type: "info", label: "Resolve warnings before follow-up", priority: "medium" });
  }

  const deductions = (paymentRecorded ? 0 : 40) + (hasEvidence ? 0 : 30);
  const quality_score = Math.max(0, 100 - deductions);

  return { event_type: "job_completed", recognized: true, quality_score, suggestions, flags };
}

function handleRecordComposed(payload: any): OmniIngestResult {
  const suggestions: Suggestion[] = [
    { type: "action", label: "Deliver record to customer", priority: "high" },
    { type: "action", label: "Archive service record", priority: "low" },
  ];

  const flags: Suggestion[] = [];

  const summary = str(payload?.summary ?? payload?.record?.summary);
  if (!summary) {
    flags.push({ type: "warning", label: "Record has no summary", priority: "medium" });
  }

  const quality_score = summary ? 100 : 70;

  return { event_type: "record_composed", recognized: true, quality_score, suggestions, flags };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the string value if non-empty, null otherwise. */
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
