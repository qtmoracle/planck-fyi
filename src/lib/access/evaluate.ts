import { getOperatorBySlug } from "../../data/operators";
import { applyPolicy } from "./policy";
import type { AccessRequest, AccessDecision, AccessState } from "./types";

/**
 * Evaluate an access request.
 *
 * Loads the operator's accessState from the operator registry,
 * runs all policy rules, and returns a deterministic AccessDecision.
 *
 * The operator slug is resolved from:
 *   1. actor.operator_slug (operator or agent actor)
 *   2. resource.owner_operator_slug
 *   3. resource.assigned_to
 *
 * If no operator can be resolved the access defaults to "active"
 * (admin / system actors are not operator-gated).
 */
export function evaluateAccess(input: AccessRequest): AccessDecision {
  const { actor, action, resource } = input;

  // Admin and system actors bypass operator access state
  if (actor.type === "admin" || actor.type === "system") {
    return { allow: true, reasons: [], accessState: "active" };
  }

  const operatorSlug =
    actor.operator_slug ||
    resource.owner_operator_slug ||
    resource.assigned_to ||
    null;

  let accessState: AccessState = "active";

  if (operatorSlug) {
    const operator = getOperatorBySlug(operatorSlug);
    if (operator) {
      accessState = operator.accessState;
    }
    // Unknown operator slug — default to active (do not fail on missing operators)
  }

  return applyPolicy(actor, action, resource, accessState);
}
