export type AstrologyModeCandidate =
  | "general"
  | "focused"
  | "natal"
  | "transit"
  | "hybrid";

export type AstrologyMode =
  | "GENERAL"
  | "FOCUSED"
  | "NATAL"
  | "TRANSIT"
  | "HYBRID";

export type AstrologyLocation = {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  timezone?: string | null;
};

export type AstrologyContextPack = {
  meta: {
    surface: "astrology";
    mode_candidate: AstrologyModeCandidate;
    created_at: string;
    timezone: string;
  };

  client: {
    name?: string | null;
    current_location?: AstrologyLocation | null;
  };

  inquiry: {
    request_type?: string | null;
    focus_area?: string | null;
    question?: string | null;
    urgency?: "low" | "medium" | "high" | null;
    notes?: string | null;
    report_mode_preference?: AstrologyModeCandidate | "auto" | null;
    session_preference?: "instant" | "live" | "both" | null;
  };

  birth_data: {
    birth_date?: string | null;
    birth_time?: string | null;
    birth_location?: AstrologyLocation | null;
    birth_time_confidence?: "exact" | "approximate" | "unknown" | null;
  };

  current_context: {
    current_date?: string | null;
    current_time?: string | null;
    current_location?: AstrologyLocation | null;
  };

  astrological_context: {
    natal_summary?: {
      sun_sign?: string | null;
      moon_sign?: string | null;
      rising_sign?: string | null;
      notable_natal_features?: string[];
    } | null;

    transit_summary?: {
      active_transits?: string[];
      major_alignments?: string[];
      timing_window?: string | null;
      interpretive_weight?: "light" | "moderate" | "strong" | null;
    } | null;

    calculation_notes?: string[];
  };

  constraints: {
    can_use_transits: boolean;
    can_use_natal: boolean;
    can_make_time_sensitive_claims: boolean;
    missing_fields: string[];
  };
};

export type RawAstrologyIntake = {
  name?: unknown;
  request_type?: unknown;
  focus_area?: unknown;
  question?: unknown;
  urgency?: unknown;
  notes?: unknown;
  birth_date?: unknown;
  birth_time?: unknown;
  birth_location?: unknown;
  birth_time_confidence?: unknown;
  current_location?: unknown;
  timezone?: unknown;
  current_date?: unknown;
  current_time?: unknown;
  report_mode_preference?: unknown;
  session_preference?: unknown;

  natal_summary?: unknown;
  transit_summary?: unknown;
  calculation_notes?: unknown;
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeLocation(value: unknown): AstrologyLocation | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const city = asTrimmedString(raw.city);
  const region = asTrimmedString(raw.region);
  const country = asTrimmedString(raw.country);
  const timezone = asTrimmedString(raw.timezone);

  if (!city && !region && !country && !timezone) return null;

  return {
    city,
    region,
    country,
    timezone,
  };
}

function normalizeUrgency(
  value: unknown
): "low" | "medium" | "high" | null {
  const normalized = asTrimmedString(value)?.toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return null;
}

function normalizeBirthTimeConfidence(
  value: unknown
): "exact" | "approximate" | "unknown" | null {
  const normalized = asTrimmedString(value)?.toLowerCase();
  if (
    normalized === "exact" ||
    normalized === "approximate" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  return null;
}

function normalizeModeCandidate(
  value: unknown
): AstrologyModeCandidate | "auto" | null {
  const normalized = asTrimmedString(value)?.toLowerCase();
  if (
    normalized === "general" ||
    normalized === "focused" ||
    normalized === "natal" ||
    normalized === "transit" ||
    normalized === "hybrid" ||
    normalized === "auto"
  ) {
    return normalized;
  }
  return null;
}

function normalizeSessionPreference(
  value: unknown
): "instant" | "live" | "both" | null {
  const normalized = asTrimmedString(value)?.toLowerCase();
  if (normalized === "instant" || normalized === "live" || normalized === "both") {
    return normalized;
  }
  return null;
}

function pickModeCandidate(input: {
  report_mode_preference: AstrologyModeCandidate | "auto" | null;
  question: string | null;
  focus_area: string | null;
  birth_date: string | null;
  birth_location: AstrologyLocation | null;
  current_date: string | null;
  current_time: string | null;
  current_location: AstrologyLocation | null;
  transit_summary_present: boolean;
}): AstrologyModeCandidate {
  if (input.report_mode_preference && input.report_mode_preference !== "auto") {
    return input.report_mode_preference;
  }

  const hasNatal = Boolean(input.birth_date && input.birth_location);
  const hasTransit =
    Boolean(input.current_date && input.current_time) &&
    Boolean(input.current_location?.timezone || input.current_location) &&
    input.transit_summary_present;

  if (hasNatal && hasTransit) return "hybrid";
  if (hasTransit) return "transit";
  if (hasNatal) return "natal";
  if (input.question || input.focus_area) return "focused";
  return "general";
}

export function buildAstrologyContextPack(
  raw: RawAstrologyIntake,
  options?: {
    now?: Date;
    fallbackTimezone?: string;
  }
): AstrologyContextPack {
  const now = options?.now ?? new Date();
  const fallbackTimezone = options?.fallbackTimezone ?? "America/New_York";

  const name = asTrimmedString(raw.name);
  const request_type = asTrimmedString(raw.request_type);
  const focus_area = asTrimmedString(raw.focus_area);
  const question = asTrimmedString(raw.question);
  const notes = asTrimmedString(raw.notes);

  const birth_date = asTrimmedString(raw.birth_date);
  const birth_time = asTrimmedString(raw.birth_time);
  const birth_location = normalizeLocation(raw.birth_location);
  const birth_time_confidence =
    normalizeBirthTimeConfidence(raw.birth_time_confidence) ?? "unknown";

  const current_location = normalizeLocation(raw.current_location);
  const timezone =
    asTrimmedString(raw.timezone) ??
    current_location?.timezone ??
    fallbackTimezone;

  const current_date = asTrimmedString(raw.current_date);
  const current_time = asTrimmedString(raw.current_time);

  const natalSummaryRaw =
    raw.natal_summary && typeof raw.natal_summary === "object"
      ? (raw.natal_summary as Record<string, unknown>)
      : null;

  const transitSummaryRaw =
    raw.transit_summary && typeof raw.transit_summary === "object"
      ? (raw.transit_summary as Record<string, unknown>)
      : null;

  const natal_summary = natalSummaryRaw
    ? {
        sun_sign: asTrimmedString(natalSummaryRaw.sun_sign),
        moon_sign: asTrimmedString(natalSummaryRaw.moon_sign),
        rising_sign: asTrimmedString(natalSummaryRaw.rising_sign),
        notable_natal_features: asStringArray(
          natalSummaryRaw.notable_natal_features
        ),
      }
    : null;

  const transit_summary = transitSummaryRaw
    ? {
        active_transits: asStringArray(transitSummaryRaw.active_transits),
        major_alignments: asStringArray(transitSummaryRaw.major_alignments),
        timing_window: asTrimmedString(transitSummaryRaw.timing_window),
        interpretive_weight:
          asTrimmedString(transitSummaryRaw.interpretive_weight)?.toLowerCase() ===
            "light" ||
          asTrimmedString(transitSummaryRaw.interpretive_weight)?.toLowerCase() ===
            "moderate" ||
          asTrimmedString(transitSummaryRaw.interpretive_weight)?.toLowerCase() ===
            "strong"
            ? (asTrimmedString(
                transitSummaryRaw.interpretive_weight
              )!.toLowerCase() as "light" | "moderate" | "strong")
            : null,
      }
    : null;

  const calculation_notes = asStringArray(raw.calculation_notes);

  const can_use_natal = Boolean(birth_date && birth_location);
  const can_use_transits =
    Boolean(current_date && current_time) &&
    Boolean(current_location?.timezone || timezone) &&
    Boolean(transit_summary);

  const missing_fields: string[] = [];

  if (!birth_date) missing_fields.push("birth_date");
  if (!birth_time) missing_fields.push("birth_time");
  if (!birth_location) missing_fields.push("birth_location");
  if (!current_date) missing_fields.push("current_date");
  if (!current_time) missing_fields.push("current_time");
  if (!current_location) missing_fields.push("current_location");

  const report_mode_preference = normalizeModeCandidate(raw.report_mode_preference);
  const mode_candidate = pickModeCandidate({
    report_mode_preference,
    question,
    focus_area,
    birth_date,
    birth_location,
    current_date,
    current_time,
    current_location,
    transit_summary_present: Boolean(transit_summary),
  });

  return {
    meta: {
      surface: "astrology",
      mode_candidate,
      created_at: now.toISOString(),
      timezone,
    },

    client: {
      name,
      current_location,
    },

    inquiry: {
      request_type,
      focus_area,
      question,
      urgency: normalizeUrgency(raw.urgency),
      notes,
      report_mode_preference,
      session_preference: normalizeSessionPreference(raw.session_preference),
    },

    birth_data: {
      birth_date,
      birth_time,
      birth_location,
      birth_time_confidence,
    },

    current_context: {
      current_date,
      current_time,
      current_location,
    },

    astrological_context: {
      natal_summary,
      transit_summary,
      calculation_notes,
    },

    constraints: {
      can_use_transits,
      can_use_natal,
      can_make_time_sensitive_claims: can_use_transits,
      missing_fields,
    },
  };
}
