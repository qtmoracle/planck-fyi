// functions/api/agents/decide.ts
// POST /api/agents/decide
//
// Agent Decision Inspection v0.01
//
// Read-only endpoint that runs the decision engine against a given event type
// and returns which agents would be selected, with reasoning and confidence.
//
// This is NOT orchestration — no agents are invoked, no actions are executed,
// no state is mutated. Pure inspection of the decision function output.
//
// Auth:    x-agent-token (same as all agent-layer endpoints)
// Mutates: nothing
// Version: agent-decision-inspect-v0.01

import { checkAgentAuth, json } from "../agent/_lib";
import { decideAgents } from "../../../src/lib/agents/decision";
import { evaluateAccess, denyResponse } from "../../../src/lib/access/index";

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request } = ctx;

    // 0) Auth
    const authError = checkAgentAuth(request, ctx.env);
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
    if (!eventType) {
      return json({ ok: false, error: "missing_type", hint: "body.type is required" }, 400);
    }

    // 1b) Access gate: agent execution blocked if operator is not active
    const operatorSlug =
      String(body.payload?.source?.operator_slug || "").trim() ||
      request.headers.get("x-operator-slug") || "";
    if (operatorSlug) {
      const accessDecision = evaluateAccess({
        actor: { type: "agent", id: "agent", operator_slug: operatorSlug },
        action: "agent_decide",
        resource: { type: "agent", owner_operator_slug: operatorSlug },
      });
      if (!accessDecision.allow) return denyResponse(accessDecision);
    }

    // 2) Run decision engine — pure function, no side effects
    const decision = decideAgents({ type: eventType, payload: body.payload });

    return json({
      ok:         true,
      version:    "agent-decision-inspect-v0.01",
      input_type: eventType,
      decision: {
        selected_agents: decision.selected_agents,
        reasoning:       decision.reasoning,
        confidence:      decision.confidence,
        ...(decision.unresolved.length > 0 ? { unresolved: decision.unresolved } : {}),
      },
    }, 200);

  } catch (err: any) {
    return json(
      { ok: false, error: "internal_error", message: String(err?.message || err) },
      500
    );
  }
};
