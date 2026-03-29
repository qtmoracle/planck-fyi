// functions/api/agents/log.ts
// POST /api/agents/log
//
// Agent Routing Activity Log v0.01 — append-only
//
// Persists a routing tap result as an immutable log entry in R2.
// Each write is a new unique key — nothing is overwritten.
//
// Storage: env.INTAKE_BUCKET (same bucket as all system records)
// Key pattern: planck/agent_logs/AGENT_ROUTING_LOG_v0.01/<timestamp>_<random>.json
//
// Auth:    x-agent-token
// Mutates: append-only R2 write (no intake/job state touched)
// Version: agent-routing-log-v0.01

import { checkAgentAuth, isR2, json, r2PutJSON } from "../agent/_lib";

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    const authError = checkAgentAuth(request, env);
    if (authError) return authError;

    const bucket = env?.INTAKE_BUCKET;
    if (!isR2(bucket)) {
      return json(
        { ok: false, error: "r2_binding_missing", hint: "Expected env.INTAKE_BUCKET (R2)." },
        500
      );
    }

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

    const eventType = String(body.event_type || "").trim();
    const source = String(body.source || "unknown").trim();
    const routingResult = body.routing_result ?? {};

    if (!eventType) {
      return json({ ok: false, error: "missing_event_type" }, 400);
    }

    const now = new Date().toISOString();
    const ts = Date.now();
    const random = Math.random().toString(36).slice(2, 8);

    const logEntry = {
      schema: "AGENT_ROUTING_LOG_v0.01",
      created_at: now,
      source,
      event_type: eventType,
      routing_result: routingResult,
    };

    const key = `planck/agent_logs/AGENT_ROUTING_LOG_v0.01/${ts}_${random}.json`;

    await r2PutJSON(bucket, key, logEntry);

    return json({ ok: true, key }, 200);
  } catch (err: any) {
    return json(
      { ok: false, error: "internal_error", message: String(err?.message || err) },
      500
    );
  }
};
