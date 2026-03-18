export type ServiceEventStatus = "created" | "in_progress" | "completed";
export type EvidenceStage = "arrival" | "before" | "after";
export type NoteChannel = "internal" | "customer_visible";
export type ServiceEventPaymentStatus = "unpaid" | "paid" | "partial";

export type ServiceEventEvidenceItem = {
  url?: string;
  key?: string;
  kind: "photo";
  caption?: string;
  created_at: string;
};

export type ServiceEventNote = {
  text: string;
  created_at: string;
};

export type ServiceEvent = {
  id: string;
  job_id: string;
  request_id: string;

  operator_id: string;
  customer_id: string;
  asset_id: string;

  status: ServiceEventStatus;

  timestamps: {
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
  };

  location: {
    type: string;
    address: string;
    geo: {
      lat: number | null;
      lng: number | null;
    };
  };

  service: {
    surface: string;
    tier: string;
    scope_notes: string;
  };

  evidence: {
    arrival: ServiceEventEvidenceItem[];
    before: ServiceEventEvidenceItem[];
    after: ServiceEventEvidenceItem[];
  };

  notes: {
    internal: ServiceEventNote[];
    customer_visible: ServiceEventNote[];
  };

  outcome: {
    status: string | null;
    issues: string[];
    recommendations: string[];
    completion_summary: string | null;
  };

  meta: {
    source: string;
    version: 1;
    payment_status?: ServiceEventPaymentStatus;
    amount_collected?: number | null;
  };
};

export type CreateServiceEventInput = {
  job_id: string;
  request_id: string;
  operator_id: string;
  customer_id: string;
  asset_id: string;
  location?: {
    type?: string;
    address?: string;
    geo?: {
      lat?: number | null;
      lng?: number | null;
    };
  };
  service: {
    surface: string;
    tier: string;
    scope_notes?: string;
  };
};

export const SERVICE_EVENT_VERSION = "0.01";

export function makeServiceEventId(): string {
  return `se_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getServiceEventKey(id: string): string {
  return `planck/service_events/SERVICE_EVENT_v${SERVICE_EVENT_VERSION}/${id}.json`;
}

export function getServiceEventJobIndexKey(jobId: string): string {
  return `planck/service_events/by_job/${jobId}.json`;
}

export function isServiceEventStatus(value: unknown): value is ServiceEventStatus {
  return value === "created" || value === "in_progress" || value === "completed";
}

export function isEvidenceStage(value: unknown): value is EvidenceStage {
  return value === "arrival" || value === "before" || value === "after";
}

export function isNoteChannel(value: unknown): value is NoteChannel {
  return value === "internal" || value === "customer_visible";
}

export function isServiceEventPaymentStatus(
  value: unknown
): value is ServiceEventPaymentStatus {
  return value === "unpaid" || value === "paid" || value === "partial";
}

export function createServiceEvent(input: CreateServiceEventInput): ServiceEvent {
  const now = new Date().toISOString();

  return {
    id: makeServiceEventId(),
    job_id: String(input.job_id).trim(),
    request_id: String(input.request_id).trim(),

    operator_id: String(input.operator_id).trim(),
    customer_id: String(input.customer_id).trim(),
    asset_id: String(input.asset_id).trim(),

    status: "created",

    timestamps: {
      created_at: now,
      started_at: null,
      completed_at: null,
    },

    location: {
      type: String(input.location?.type || "onsite"),
      address: String(input.location?.address || ""),
      geo: {
        lat: input.location?.geo?.lat ?? null,
        lng: input.location?.geo?.lng ?? null,
      },
    },

    service: {
      surface: String(input.service.surface || "").trim(),
      tier: String(input.service.tier || "").trim(),
      scope_notes: String(input.service.scope_notes || "").trim(),
    },

    evidence: {
      arrival: [],
      before: [],
      after: [],
    },

    notes: {
      internal: [],
      customer_visible: [],
    },

    outcome: {
      status: null,
      issues: [],
      recommendations: [],
      completion_summary: null,
    },

    meta: {
      source: "operator_execution_screen",
      version: 1,
      payment_status: "unpaid",
      amount_collected: null,
    },
  };
}

export function startServiceEvent(event: ServiceEvent): ServiceEvent {
  if (event.status === "completed") {
    throw new Error("service_event_already_completed");
  }

  if (event.status === "in_progress") {
    return event;
  }

  return {
    ...event,
    status: "in_progress",
    timestamps: {
      ...event.timestamps,
      started_at: event.timestamps.started_at || new Date().toISOString(),
    },
  };
}

export function completeServiceEvent(
  event: ServiceEvent,
  updates?: {
    outcome?: Partial<ServiceEvent["outcome"]>;
    payment_status?: ServiceEventPaymentStatus;
    amount_collected?: number | null;
  }
): ServiceEvent {
  if (event.status === "completed") {
    return event;
  }

  const outcome = updates?.outcome;
  const hasAmountCollected =
    typeof updates?.amount_collected === "number" || updates?.amount_collected === null;

  return {
    ...event,
    status: "completed",
    timestamps: {
      ...event.timestamps,
      completed_at: new Date().toISOString(),
    },
    outcome: {
      status: outcome?.status ?? "completed_successfully",
      issues: Array.isArray(outcome?.issues) ? outcome.issues : event.outcome.issues,
      recommendations: Array.isArray(outcome?.recommendations)
        ? outcome.recommendations
        : event.outcome.recommendations,
      completion_summary:
        typeof outcome?.completion_summary === "string"
          ? outcome.completion_summary
          : event.outcome.completion_summary,
    },
    meta: {
      ...event.meta,
      payment_status: updates?.payment_status ?? event.meta.payment_status,
      amount_collected: hasAmountCollected
        ? updates.amount_collected
        : (event.meta.amount_collected ?? null),
    },
  };
}

export function appendEvidence(
  event: ServiceEvent,
  stage: EvidenceStage,
  items: ServiceEventEvidenceItem[]
): ServiceEvent {
  return {
    ...event,
    evidence: {
      ...event.evidence,
      [stage]: [...event.evidence[stage], ...items],
    },
  };
}

export function appendNote(
  event: ServiceEvent,
  channel: NoteChannel,
  text: string
): ServiceEvent {
  const trimmed = String(text || "").trim();
  if (!trimmed) return event;

  return {
    ...event,
    notes: {
      ...event.notes,
      [channel]: [
        ...event.notes[channel],
        {
          text: trimmed,
          created_at: new Date().toISOString(),
        },
      ],
    },
  };
}

export async function putServiceEvent(bucket: R2Bucket, event: ServiceEvent): Promise<void> {
  const key = getServiceEventKey(event.id);

  await bucket.put(key, JSON.stringify(event, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });

  await bucket.put(
    getServiceEventJobIndexKey(event.job_id),
    JSON.stringify(
      {
        service_event_id: event.id,
        job_id: event.job_id,
        updated_at: new Date().toISOString(),
      },
      null,
      2
    ),
    {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    }
  );
}

export async function getServiceEvent(
  bucket: R2Bucket,
  id: string
): Promise<ServiceEvent | null> {
  const obj = await bucket.get(getServiceEventKey(id));
  if (!obj) return null;

  const json = await obj.json<ServiceEvent>();
  return json;
}

export async function getServiceEventIdByJobId(
  bucket: R2Bucket,
  jobId: string
): Promise<string | null> {
  const obj = await bucket.get(getServiceEventJobIndexKey(jobId));
  if (!obj) return null;

  const json = (await obj.json()) as { service_event_id?: string } | null;
  const id = String(json?.service_event_id || "").trim();
  return id || null;
}

export async function getServiceEventByJobId(
  bucket: R2Bucket,
  jobId: string
): Promise<ServiceEvent | null> {
  const id = await getServiceEventIdByJobId(bucket, jobId);
  if (!id) return null;
  return getServiceEvent(bucket, id);
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
