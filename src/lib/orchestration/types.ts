export type OrchestrationIntentMode =
  | "proposed"
  | "approved"
  | "denied"
  | "executed";

export type OrchestrationReview = {
  status: "approved" | "denied";
  reviewed_by: string;
  reviewed_at: string;
  note?: string;
};

export type OrchestrationIntent = {
  id: string;
  source_event: string;
  initiated_by: "system" | "agent";
  agent_id?: string;
  action: string;
  target: {
    type: "intake" | "job" | "service_event" | "record" | "operator";
    id?: string;
    operator_slug?: string;
  };
  mode: OrchestrationIntentMode;
  reasons: string[];
  requires_human: boolean;
  created_at: string;
  review?: OrchestrationReview;
};
