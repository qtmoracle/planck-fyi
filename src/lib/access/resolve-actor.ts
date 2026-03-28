import type { AccessActor } from "./types";

/**
 * Extract actor identity from a Cloudflare Pages Function request.
 *
 * Resolution order:
 *   1. x-admin-token → admin actor
 *   2. x-agent-token → agent actor
 *   3. x-operator-slug → operator actor
 *   4. fallback → system actor
 */
export function resolveActor(request: Request, env: any): AccessActor {
  const adminToken = String(env?.ADMIN_TOKEN || "");
  const agentToken = String(env?.AGENT_TOKEN || "");

  const reqAdminToken = request.headers.get("x-admin-token") || "";
  const reqAgentToken = request.headers.get("x-agent-token") || "";
  const operatorSlug = request.headers.get("x-operator-slug") || "";

  if (adminToken && reqAdminToken === adminToken) {
    return { type: "admin", id: "admin" };
  }

  if (agentToken && reqAgentToken === agentToken) {
    return { type: "agent", id: "agent", operator_slug: operatorSlug || undefined };
  }

  if (operatorSlug) {
    return { type: "operator", id: operatorSlug, operator_slug: operatorSlug };
  }

  return { type: "system", id: "system" };
}
