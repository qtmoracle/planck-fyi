import type { AstrologyContextPack, AstrologyMode } from "./astrology-context";

export type AstrologyModeGateResult = {
  mode: AstrologyMode;
  reason: string;
  restrictions: string[];
};

export function resolveAstrologyMode(
  pack: AstrologyContextPack
): AstrologyModeGateResult {
  const { inquiry, birth_data, current_context, astrological_context, constraints } =
    pack;

  const hasQuestion = Boolean(inquiry.question || inquiry.focus_area);

  const hasNatalMinimum = Boolean(
    birth_data.birth_date && birth_data.birth_location
  );

  const hasTransitMinimum = Boolean(
    current_context.current_date &&
      current_context.current_time &&
      (current_context.current_location?.timezone || pack.meta.timezone) &&
      astrological_context.transit_summary
  );

  if (constraints.can_use_natal && constraints.can_use_transits) {
    return {
      mode: "HYBRID",
      reason: "Natal context and current transit context are both available.",
      restrictions: [
        "Stay within the provided context pack.",
        "Do not invent unsupported astrological details.",
        "Do not make stronger timing claims than the transit summary supports.",
      ],
    };
  }

  if (constraints.can_use_transits && hasTransitMinimum) {
    return {
      mode: "TRANSIT",
      reason: "Current timing context and transit summary are available.",
      restrictions: [
        "Do not make natal-specific pattern claims unless natal context is provided.",
        "Stay within the supplied transit summary.",
      ],
    };
  }

  if (constraints.can_use_natal && hasNatalMinimum) {
    return {
      mode: "NATAL",
      reason: "Birth data is sufficient for natal-based interpretation.",
      restrictions: [
        "Do not make current transit claims unless transit context is provided.",
        "Avoid unsupported house/rising specificity if birth time confidence is weak.",
      ],
    };
  }

  if (hasQuestion) {
    return {
      mode: "FOCUSED",
      reason: "A clear question or focus area is present, but natal/transit context is incomplete.",
      restrictions: [
        "Interpret around the stated concern only.",
        "Do not claim chart-specific or current alignment-specific facts.",
      ],
    };
  }

  return {
    mode: "GENERAL",
    reason: "Birth data and transit context are unavailable or incomplete.",
    restrictions: [
      "Do not make chart-specific claims.",
      "Do not make time-sensitive transit claims.",
      "Keep interpretation broad, honest, and reflective.",
    ],
  };
}
