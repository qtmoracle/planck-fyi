export type ActionSurfaceAction =
  | "create_admin_followup"
  | "create_operator_followup"
  | "flag_job_for_review"
  | "attach_advisory_note"
  | "queue_assignment_review";

export type ActionExecutionResult = {
  ok: boolean;
  action: ActionSurfaceAction;
  executed_at: string;
  target: {
    type: "intake" | "job" | "service_event" | "record" | "operator";
    id?: string;
    operator_slug?: string;
  };
  reason?: string;
  metadata?: Record<string, unknown>;
};
