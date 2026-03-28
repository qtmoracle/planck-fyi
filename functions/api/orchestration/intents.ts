// functions/api/orchestration/intents.ts
// GET /api/orchestration/intents
//
// Orchestration Intent Log — recent entries, read-only.
//
// Returns the most recent orchestration intent log entries from R2.
// Each entry may contain multiple proposed intents.
// Malformed entries are skipped silently.
//
// Storage: env.INTAKE_BUCKET
// Prefix:  planck/orchestration_logs/ORCHESTRATION_INTENT_v0.01/
//
// Auth:    x-agent-token
// Mutates: nothing
// Version: orchestration-intents-v0.01

import { checkAgentAuth, isR2, json, r2GetJSON } from "../agent/_lib";
import { ORCHESTRATION_LOG_PREFIX } from "../../../src/lib/orchestration/index";

const MAX_RESULTS = 20;

export const onRequestGet: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // Auth
    const authError = checkAgentAuth(request, env);
    if (authError) return authError;

    // R2 binding
    const bucket = env?.INTAKE_BUCKET;
    if (!isR2(bucket)) {
      return json({ ok: false, error: "r2_binding_missing" }, 500);
    }

    // List log keys under prefix, newest first
    const listed = await bucket.list({ prefix: ORCHESTRATION_LOG_PREFIX, limit: 1000 });
    const allKeys: string[] = (listed?.objects || [])
      .map((o: any) => String(o?.key || ""))
      .filter(Boolean);

    // Sort descending — keys include timestamp prefix so lexicographic ≈ chronological
    allKeys.sort((a: string, b: string) => b.localeCompare(a));
    const recentKeys = allKeys.slice(0, MAX_RESULTS);

    const entries: any[] = [];

    for (const key of recentKeys) {
      const entry = await r2GetJSON(bucket, key);
      if (!entry || typeof entry !== "object") continue;
      if (entry.schema !== "ORCHESTRATION_INTENT_LOG_v0.01") continue;

      entries.push({
        key,
        logged_at:    String(entry.logged_at || ""),
        source_event: String(entry.source_event || ""),
        intent_count: Array.isArray(entry.intents) ? entry.intents.length : 0,
        intents:      Array.isArray(entry.intents) ? entry.intents : [],
      });
    }

    return json({
      ok:      true,
      version: "orchestration-intents-v0.01",
      count:   entries.length,
      entries,
    }, 200);

  } catch (err: any) {
    return json(
      { ok: false, error: "internal_error", message: String(err?.message || err) },
      500
    );
  }
};
