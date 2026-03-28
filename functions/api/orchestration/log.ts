// functions/api/orchestration/log.ts
// POST /api/orchestration/log
//
// Orchestration Intent Logger — append-only.
//
// Accepts a validated orchestration intent batch and persists it.
// Enforces: mode must be "proposed", requires_human must be true (v0.01).
// No execute endpoint exists in v0.01.
//
// Auth:    x-agent-token
// Mutates: append-only R2 write
// Version: orchestration-log-v0.01

import { checkAgentAuth, isR2, json } from "../agent/_lib";
import { logOrchestrationIntents } from "../../../src/lib/orchestration/index";
import type { OrchestrationIntent } from "../../../src/lib/orchestration/index";

export const onRequestPost: PagesFunction = async (ctx) => {
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

    // Parse body
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

    const sourceEvent = String(body.source_event || "").trim();
    if (!sourceEvent) {
      return json({ ok: false, error: "missing_source_event" }, 400);
    }

    const rawIntents = Array.isArray(body.intents) ? body.intents : [];
    if (rawIntents.length === 0) {
      return json({ ok: false, error: "missing_intents" }, 400);
    }

    // Validate: v0.01 only accepts proposed intents with requires_human: true
    const validated: OrchestrationIntent[] = [];
    for (const raw of rawIntents) {
      if (!raw || typeof raw !== "object") continue;
      if (String(raw.mode || "") !== "proposed") {
        return json({ ok: false, error: "invalid_mode", detail: "v0.01 only accepts mode: proposed" }, 400);
      }
      if (raw.requires_human !== true) {
        return json({ ok: false, error: "requires_human_must_be_true", detail: "v0.01 requires requires_human: true" }, 400);
      }
      validated.push(raw as OrchestrationIntent);
    }

    if (validated.length === 0) {
      return json({ ok: false, error: "no_valid_intents" }, 400);
    }

    const key = await logOrchestrationIntents(bucket, validated, sourceEvent);

    return json({
      ok:            true,
      key,
      intent_count:  validated.length,
    }, 200);

  } catch (err: any) {
    return json(
      { ok: false, error: "internal_error", message: String(err?.message || err) },
      500
    );
  }
};
