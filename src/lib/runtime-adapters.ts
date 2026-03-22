export type AdapterStatus = "active" | "planned" | "fallback" | "deprecated";

export type AdapterNotes = string[] | undefined;

export interface SESRuntimeAdapterIdentity {
  surface: string;
  adapter_name: string;
  status: AdapterStatus;
}

export interface SESRuntimeAdapter {
  identity: SESRuntimeAdapterIdentity;
  interpretIntakePayload(input: {
    surface: string;
    payload: unknown;
  }): {
    normalized_payload: unknown;
    notes?: string[];
  };
  interpretJobPayload(input: {
    surface: string;
    payload: unknown;
  }): {
    normalized_payload: unknown;
    notes?: string[];
  };
  interpretServiceEvent(input: {
    surface: string;
    event_type: string;
    payload: unknown;
  }): {
    semantic_event_type: string;
    normalized_payload?: unknown;
    notes?: string[];
  };
  composeRecord(input: {
    surface: string;
    job: unknown;
    events: unknown[];
  }): {
    summary: string;
    payload: unknown;
    notes?: string[];
  };
  composeSummary?(input: {
    surface: string;
    job: unknown;
    events: unknown[];
  }): string;
}

const FALLBACK_SURFACE = "surface-navigator";
const ACTIVE_DETAILING_SURFACE = "auto-detailing";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeVehicleType(value: unknown): "sedan" | "suv" | "truck" | "unknown" {
  const raw = (asString(value) || "").toLowerCase();
  if (["sedan", "car", "coupe", "hatchback"].includes(raw)) return "sedan";
  if (["suv", "crossover", "wagon"].includes(raw)) return "suv";
  if (["truck", "pickup"].includes(raw)) return "truck";
  return "unknown";
}

function getEventType(event: unknown): string {
  const obj = asObject(event);
  const raw = obj.event_type ?? obj.type ?? obj.name ?? null;
  return typeof raw === "string" && raw.trim() ? raw.trim() : "unknown_event";
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(obj[key]);
    if (value) return value;
  }
  return null;
}

const DETAILING_EVENT_MAP: Record<string, string> = {
  intake_created: "detailing_request_received",
  intake_approved: "detailing_request_approved",
  job_created: "detailing_job_created",
  job_claimed: "technician_assigned",
  service_started: "detailing_started",
  service_start: "detailing_started",
  service_update: "detailing_in_progress",
  service_progress: "detailing_in_progress",
  photo_capture: "detailing_media_captured",
  service_complete: "detailing_complete",
  payment_recorded: "payment_confirmed",
  payment_collected: "payment_confirmed",
  closeout: "detailing_closeout_complete",
};

export const surfaceNavigatorAdapter: SESRuntimeAdapter = {
  identity: {
    surface: FALLBACK_SURFACE,
    adapter_name: "surface-navigator-runtime-adapter",
    status: "fallback",
  },

  interpretIntakePayload({ payload }) {
    return {
      normalized_payload: payload ?? {},
      notes: ["Handled by Surface Navigator fallback adapter."],
    };
  },

  interpretJobPayload({ payload }) {
    return {
      normalized_payload: payload ?? {},
      notes: ["No surface-specific job interpretation available."],
    };
  },

  interpretServiceEvent({ event_type, payload }) {
    return {
      semantic_event_type: event_type || "routing_event",
      normalized_payload: payload,
      notes: ["Neutral routing interpretation applied."],
    };
  },

  composeRecord({ job, events }) {
    return {
      summary: "Request captured and routed through Surface Navigator for classification.",
      payload: {
        job,
        events,
      },
      notes: ["Fallback record composed without domain-specific assumptions."],
    };
  },

  composeSummary() {
    return "Request captured and routed through Surface Navigator for classification.";
  },
};

export const autoDetailingAdapter: SESRuntimeAdapter = {
  identity: {
    surface: ACTIVE_DETAILING_SURFACE,
    adapter_name: "auto-detailing-runtime-adapter",
    status: "active",
  },

  interpretIntakePayload({ payload }) {
    const obj = asObject(payload);
    const vehicleRaw = firstString(obj, ["vehicle", "vehicle_type", "vehicleType", "type"]);
    const packageRaw = firstString(obj, ["package", "service", "requested_package", "requestedPackage"]);
    const notesRaw = firstString(obj, ["notes", "request_text", "requestText", "description"]);
    const locationRaw = firstString(obj, ["location", "address", "service_address", "serviceAddress"]);

    return {
      normalized_payload: {
        vehicle: {
          type: normalizeVehicleType(vehicleRaw),
        },
        service: {
          requested_package: packageRaw || "unspecified",
        },
        request_context: {
          notes: notesRaw,
          location: locationRaw,
        },
        raw: obj,
      },
    };
  },

  interpretJobPayload({ payload }) {
    const intake = this.interpretIntakePayload({
      surface: ACTIVE_DETAILING_SURFACE,
      payload,
    });

    return {
      normalized_payload: {
        job_type: "vehicle-detail",
        vehicle: asObject(intake.normalized_payload).vehicle ?? { type: "unknown" },
        service: asObject(intake.normalized_payload).service ?? { requested_package: "unspecified" },
        execution_context: {
          on_site: true,
        },
        raw: asObject(intake.normalized_payload).raw ?? asObject(payload),
      },
      notes: intake.notes,
    };
  },

  interpretServiceEvent({ event_type, payload }) {
    return {
      semantic_event_type: DETAILING_EVENT_MAP[event_type] || event_type || "detailing_event",
      normalized_payload: payload,
    };
  },

  composeRecord({ job, events }) {
    const interpretedJob = this.interpretJobPayload({
      surface: ACTIVE_DETAILING_SURFACE,
      payload: asObject(job).payload ?? job,
    });

    const semanticTimeline = (events || []).map((event) => {
      const eventObj = asObject(event);
      const eventType = getEventType(event);
      const interpreted = this.interpretServiceEvent({
        surface: ACTIVE_DETAILING_SURFACE,
        event_type: eventType,
        payload: eventObj.payload ?? eventObj,
      });

      return {
        event_type: eventType,
        semantic_event_type: interpreted.semantic_event_type,
        payload: interpreted.normalized_payload,
      };
    });

    const vehicle = asObject(interpretedJob.normalized_payload).vehicle ?? { type: "unknown" };
    const service = asObject(interpretedJob.normalized_payload).service ?? { requested_package: "unspecified" };
    const completed = semanticTimeline.some((event) => event.semantic_event_type === "detailing_complete");

    const summary = completed
      ? "Vehicle detailing service completed. Exterior and interior restored according to selected package. Final condition verified."
      : "Detailing request recorded. Service activity captured in the execution timeline.";

    return {
      summary,
      payload: {
        vehicle,
        service,
        execution: {
          completed,
          notes: completed
            ? "Service completion captured from SES event history."
            : "Limited completion data available.",
        },
        timeline: semanticTimeline,
      },
    };
  },

  composeSummary({ events }) {
    const semanticTimeline = (events || []).map((event) =>
      this.interpretServiceEvent({
        surface: ACTIVE_DETAILING_SURFACE,
        event_type: getEventType(event),
        payload: asObject(event).payload ?? event,
      }).semantic_event_type
    );

    if (semanticTimeline.includes("detailing_complete")) {
      return "Detailing service completed and ready for review.";
    }

    if (
      semanticTimeline.includes("detailing_in_progress") ||
      semanticTimeline.includes("detailing_started")
    ) {
      return "Detailing in progress. Technician is actively servicing the vehicle.";
    }

    return "Detailing request captured. Limited service details available.";
  },
};

export const runtimeAdapters: Record<string, SESRuntimeAdapter> = {
  [surfaceNavigatorAdapter.identity.surface]: surfaceNavigatorAdapter,
  [autoDetailingAdapter.identity.surface]: autoDetailingAdapter,
};

export function resolveRuntimeAdapter(surface: string | null | undefined): SESRuntimeAdapter {
  const slug = typeof surface === "string" ? surface.trim() : "";
  return runtimeAdapters[slug] || surfaceNavigatorAdapter;
}

export function composeSurfaceRecord(input: {
  surface: string | null | undefined;
  job: unknown;
  events: unknown[];
}) {
  return resolveRuntimeAdapter(input.surface).composeRecord({
    surface: input.surface || FALLBACK_SURFACE,
    job: input.job,
    events: input.events,
  });
}

export function composeSurfaceSummary(input: {
  surface: string | null | undefined;
  job: unknown;
  events: unknown[];
}) {
  const adapter = resolveRuntimeAdapter(input.surface);
  return adapter.composeSummary
    ? adapter.composeSummary({
        surface: input.surface || FALLBACK_SURFACE,
        job: input.job,
        events: input.events,
      })
    : adapter.composeRecord({
        surface: input.surface || FALLBACK_SURFACE,
        job: input.job,
        events: input.events,
      }).summary;
}
