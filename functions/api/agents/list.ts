// functions/api/agents/list.ts
// GET /api/agents/list
//
// Agent Runtime Inspection v0.01
//
// Read-only endpoint exposing the registered agent runtime contracts.
// Returns identity, capabilities, actions, guardrails, and scope for each agent.
// Does NOT expose memory keys, internal API paths, or session state.
//
// Auth:    x-agent-token (same token as agent bridge endpoints)
// Mutates: nothing
// Version: agent-inspection-v0.01

import { checkAgentAuth, json } from "../agent/_lib";
import { listAgentRuntimes } from "qtm-core/agents";

export const onRequestGet: PagesFunction = async (ctx) => {
  try {
    const { request } = ctx;

    const authError = checkAgentAuth(request, ctx.env);
    if (authError) return authError;

    const runtimes = listAgentRuntimes();

    const agents = runtimes.map((r) => ({
      name: r.identity.name,
      display_name: r.identity.display_name,
      version: r.identity.version,
      status: r.identity.status,
      scope: {
        layers: r.scope.layers,
        description: r.scope.description,
      },
      capabilities: r.capabilities.map((c) => ({
        id: c.id,
        description: c.description,
      })),
      actions: r.actions.map((a) => ({
        id: a.id,
        kind: a.kind,
        description: a.description,
        mutates_state: a.mutates_state,
      })),
      guardrails: r.guardrails.map((g) => ({
        id: g.id,
        description: g.description,
      })),
      permissions: r.permissions,
    }));

    return json(
      {
        ok: true,
        version: "agent-inspection-v0.01",
        count: agents.length,
        agents,
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
