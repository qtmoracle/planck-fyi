// functions/api/agents/route.ts
// POST /api/agents/route

import { checkAgentAuth, isR2, json } from "../agent/_lib";
import {
  decideAgents,
  resolveAgentRuntime,
} from "qtm-core/agents";
import {
  buildOrchestrationIntents,
  logOrchestrationIntents,
} from "qtm-core/orchestration";
import { evaluateAccess, denyResponse } from "qtm-core/access";

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    const authError = checkAgentAuth(request, env);
    if (authError) return authError;

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

    const decision = decideAgents({ type: eventType, payload: body.payload });

    const routingPlan = decision.selected_agents.map((name) => {
      const runtime = resolveAgentRuntime(name);

      if (!runtime) {
        return {
          name,
          display_name: name,
          allowed_actions: [],
          guardrails: [],
          error: "runtime_not_found",
        };
      }

      return {
        name: runtime.identity.name,
        display_name: runtime.identity.display_name,
        allowed_actions: runtime.actions.map((a) => ({
          id: a.id,
          kind: a.kind,
          description: a.description,
          mutates_state: a.mutates_state,
        })),
        guardrails: runtime.guardrails.map((g) => ({
          id: g.id,
          description: g.description,
        })),
      };
    });

    const orchestrationIntents = buildOrchestrationIntents({
      event: { type: eventType, payload: body.payload },
      routingPlan,
    });

    if (orchestrationIntents.length > 0 && isR2(env?.INTAKE_BUCKET)) {
      ctx.waitUntil(
        logOrchestrationIntents(env.INTAKE_BUCKET, orchestrationIntents, eventType)
          .catch(() => {})
      );
    }

    return json(
      {
        ok: true,
        version: "agent-router-v0.01",
        input_type: eventType,
        routed_count: routingPlan.length,
        routing_plan: routingPlan,
        orchestration: {
          intent_count: orchestrationIntents.length,
          intents: orchestrationIntents,
        },
        decision: {
          selected_agents: decision.selected_agents,
          reasoning: decision.reasoning,
          confidence: decision.confidence,
          ...(decision.unresolved.length > 0 ? { unresolved: decision.unresolved } : {}),
        },
      },
      200
    );
  } catch (err: any) {
    return json(
      { ok: false, error: "internal_error", message: String(err?.message || err) },
      500
    );
  }
};
