// functions/api/agents/logs.ts
// GET /api/agents/logs
//
// Recent Agent Routing Logs v0.01 — read-only
//
// Lists recent agent routing activity log entries from R2.
// Returns a compact summary of each entry — no full payloads.
// Malformed or unreadable entries are skipped silently.
//
// Storage: env.INTAKE_BUCKET
// Prefix:  planck/agent_logs/AGENT_ROUTING_LOG_v0.01/
//
// Auth:    x-agent-token
// Mutates: nothing
// Version: agent-logs-v0.01

import { checkAgentAuth, isR2, json, r2GetJSON } from "../agent/_lib";

const LOG_PREFIX = "planck/agent_logs/AGENT_ROUTING_LOG_v0.01/";
const MAX_RESULTS = 20;

export const onRequestGet: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // 0) Auth
    const authError = checkAgentAuth(request, env);
    if (authError) return authError;

    // 1) R2 binding
    const bucket = env?.INTAKE_BUCKET;
    if (!isR2(bucket)) {
      return json({ ok: false, error: "r2_binding_missing", hint: "Expected env.INTAKE_BUCKET (R2)." }, 500);
    }

    // 2) List log keys under prefix, newest first
    // R2 list returns keys in lexicographic order. Keys include a timestamp prefix
    // (e.g. 1711497843000_x4k2p9.json) so lexicographic order ≈ chronological order.
    // We list all, sort descending, and take the top MAX_RESULTS before fetching.
    const listed = await bucket.list({ prefix: LOG_PREFIX, limit: 1000 });
    const allKeys: string[] = (listed?.objects || [])
      .map((o: any) => String(o?.key || ""))
      .filter(Boolean);

    // Sort descending (newest timestamp first — relies on key format <ts>_<random>.json)
    allKeys.sort((a, b) => b.localeCompare(a));

    const recentKeys = allKeys.slice(0, MAX_RESULTS);

    // 3) Fetch each log entry and extract summary fields
    const logs: any[] = [];

    for (const key of recentKeys) {
      const entry = await r2GetJSON(bucket, key);

      // Skip malformed entries — never throw on bad data
      if (!entry || typeof entry !== "object") continue;
      if (entry.schema !== "AGENT_ROUTING_LOG_v0.01") continue;

      const decision       = entry.routing_result?.decision ?? {};
      const selectedAgents = Array.isArray(decision.selected_agents) ? decision.selected_agents : [];
      const confidence     = typeof decision.confidence === "number" ? decision.confidence : null;

      logs.push({
        key,
        created_at:      String(entry.created_at || ""),
        source:          String(entry.source || ""),
        event_type:      String(entry.event_type || ""),
        selected_agents: selectedAgents,
        ...(confidence !== null ? { confidence } : {}),
      });
    }

    return json({
      ok:    true,
      count: logs.length,
      logs,
    }, 200);

  } catch (err: any) {
    return json(
      { ok: false, error: "internal_error", message: String(err?.message || err) },
      500
    );
  }
};
