export type AccessState = "active" | "limited" | "suspended";

export type AccessActor = {
  type: "operator" | "admin" | "agent" | "system";
  id: string;
  operator_slug?: string;
};

export type AccessResource = {
  type: "intake" | "job" | "service_event" | "record" | "agent";
  id?: string;
  owner_operator_slug?: string;
  assigned_to?: string;
  state?: string;
};

export type AccessRequest = {
  actor: AccessActor;
  action: string;
  resource: AccessResource;
};

export type AccessDecision = {
  allow: boolean;
  reasons: string[];
  accessState: AccessState;
};
