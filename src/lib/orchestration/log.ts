// src/lib/orchestration/log.ts
// Append-only orchestration intent log writer.
//
// Storage: env.INTAKE_BUCKET (same bucket as all system records)
// Key pattern: planck/orchestration_logs/ORCHESTRATION_INTENT_v0.01/<timestamp>_<random>.json
// Schema: ORCHESTRATION_INTENT_LOG_v0.01
//
// Each write is a unique key — nothing is ever overwritten.

import type { OrchestrationIntent } from "./types";

export const ORCHESTRATION_LOG_PREFIX =
  "planck/orchestration_logs/ORCHESTRATION_INTENT_v0.01/";

export type OrchestrationLogEntry = {
  schema:   "ORCHESTRATION_INTENT_LOG_v0.01";
  logged_at: string;
  intents:   OrchestrationIntent[];
  source_event: string;
};

/**
 * Persist a batch of orchestration intents as a single append-only log entry.
 * Returns the R2 key written.
 */
export async function logOrchestrationIntents(
  bucket: any,
  intents: OrchestrationIntent[],
  sourceEvent: string
): Promise<string> {
  const now    = new Date().toISOString();
  const ts     = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  const entry: OrchestrationLogEntry = {
    schema:       "ORCHESTRATION_INTENT_LOG_v0.01",
    logged_at:    now,
    intents,
    source_event: sourceEvent,
  };

  const key = `${ORCHESTRATION_LOG_PREFIX}${ts}_${random}.json`;

  await bucket.put(key, JSON.stringify(entry, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });

  return key;
}
