import type { AccessActor, AccessResource, AccessState, AccessDecision } from "./types";

function deny(accessState: AccessState, ...reasons: string[]): AccessDecision {
  return { allow: false, reasons, accessState };
}

function allow(accessState: AccessState): AccessDecision {
  return { allow: true, reasons: [], accessState };
}

/**
 * All access policy rules live here — nowhere else.
 *
 * Rules evaluated in order:
 *   1. Suspended — block everything
 *   2. Agent mutation guard — agents never mutate
 *   3. Limited mode — block service_event mutations
 *   4. Ownership — operators only access their own resources
 *   5. Default allow
 */
export function applyPolicy(
  actor: AccessActor,
  action: string,
  resource: AccessResource,
  accessState: AccessState
): AccessDecision {
  // 1. Suspended — full block
  if (accessState === "suspended") {
    return deny(accessState, "operator_suspended");
  }

  // 2. Agent mutation guard — agents MUST NEVER mutate state
  if (actor.type === "agent" && action.includes("mutate")) {
    return deny(accessState, "agent_execution_forbidden");
  }

  // 3. Limited mode restrictions
  if (accessState === "limited") {
    if (action === "service_event_mutate") {
      return deny(accessState, "operator_limited_execution_blocked");
    }
    // intake creation and reads are allowed in limited mode
  }

  // 4. Ownership enforcement for operator actors
  if (actor.type === "operator") {
    // If resource has an assigned_to field, operator must own it
    if (resource.assigned_to && resource.assigned_to !== actor.operator_slug) {
      return deny(accessState, "not_job_owner");
    }
    // If resource has an owner, operator must be that owner
    if (resource.owner_operator_slug && resource.owner_operator_slug !== actor.operator_slug) {
      return deny(accessState, "not_resource_owner");
    }
  }

  return allow(accessState);
}
