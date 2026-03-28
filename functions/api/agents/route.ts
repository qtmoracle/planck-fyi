// functions/api/agents/route.ts
// POST /api/agents/route
//
// Agent Event Router v0.01 — inspection only
//
// Accepts an event, runs the decision engine, resolves each selected agent's
// runtime contract, and returns a full routing plan. No agents are invoked,
// no actions are executed, no state is mutated.
//
// Auth:    x-agent-token (same as all agent-layer endpoints)
// Mutates: nothing
// Version: agent-router-v0.01

import { checkAgentAuth, isR2, json } from "../agent/_lib";
import { decideAgents } from "../../../src/lib/agents/decision";
import { resolveAgentRuntime } from "../../../src/lib/agents/registry";
import { evaluateAccess, denyResponse } from "../../../src/lib/access/index";
import { buildOrchestrationIntents, logOrchestrationIntents } from "../../../src/lib/orchestration/index";

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // 0) Auth
    const authError = checkAgentAuth(request, env);
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

    // 1b) Access gate: agent routing blocked if operator is not active
    const operatorSlug =
      String(body.payload?.source?.operator_slug || "").trim() ||
      request.headers.get("x-operator-slug") || "";
    if (operatorSlug) {
      const accessDecision = evaluateAccess({
        actor: { type: "agent", id: "agent", operator_slug: operatorSlug },
        action: "agent_route",
        resource: { type: "agent", owner_operator_slug: operatorSlug },
      });
      if (!accessDecision.allow) return denyResponse(accessDecision);
    }

    // 2) Run decision engine — pure function, no side effects
    const decision = decideAgents({ type: eventType, payload: body.payload });

    console.log(
      `[agent-router] event="${eventType}" selected=[${decision.selected_agents.join(",")}] confidence=${decision.confidence}`
    );

    // 3) Resolve each selected agent's runtime contract
    const routingPlan = decision.selected_agents.map((name) => {
      const runtime = resolveAgentRuntime(name);

      // resolveAgentRuntime validated presence in decideAgents already,
      // but guard defensively in case registry changes between calls.
      if (!runtime) {
        return {
          name,
          display_name:    name,
          allowed_actions: [],
          guardrails:      [],
          error:           "runtime_not_found",
        };
      }

      return {
        name:            runtime.identity.name,
        display_name:    runtime.identity.display_name,
        allowed_actions: runtime.actions.map((a) => ({
          id:            a.id,
          kind:          a.kind,
          description:   a.description,
          mutates_state: a.mutates_state,
        })),
        guardrails: runtime.guardrails.map((g) => ({
          id:          g.id,
          description: g.description,
        })),
      };
    });

    // 4) Build orchestration intents from routing plan (pure, no side effects)
    const orchestrationIntents = buildOrchestrationIntents({
      event: { type: eventType, payload: body.payload },
      routingPlan,
    });

    console.log(
      `[orchestration] event="${eventType}" intents=${orchestrationIntents.length} proposed`
    );

    // 5) Persist orchestration intents — best-effort, non-blocking
    //    Must never affect the route response or delay the caller.
    if (orchestrationIntents.length > 0 && isR2(env?.INTAKE_BUCKET)) {
      ctx.waitUntil(
        logOrchestrationIntents(env.INTAKE_BUCKET, orchestrationIntents, eventType)
          .then((key) => {
            console.log(`[orchestration] logged ${orchestrationIntents.length} intent(s) → ${key}`);
          })
          .catch((err) => {
            console.log(`[orchestration] log failed:`, String(err?.message || err));
          })
      );
    }

    return json({
      ok:           true,
      version:      "agent-router-v0.01",
      input_type:   eventType,
      routed_count: routingPlan.length,
      routing_plan: routingPlan,
      orchestration: {
        intent_count: orchestrationIntents.length,
        intents:      orchestrationIntents,
      },
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
