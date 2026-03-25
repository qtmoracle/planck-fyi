# SURFACE DECLARATION PACK — EVENT / BANQUET HALL v0.01

## Surface Identity
- slug: event-coordination
- name: Event Coordination Surface
- one-line purpose:
  Coordinate time-bound live events across client, venue, vendors, staff, execution checkpoints, settlement, and final record.

## Classification
- workflow class: COORDINATION
- surface abstraction:
  A time-bound, multi-party service environment where people, vendors, schedules, resources, and deliverables must be synchronized to produce a successful event outcome.

## Workflow Mapping
- primary actors:
  - client / host
  - venue operator
  - event coordinator
  - vendors
  - venue staff
  - guests
- request type:
  event_request
- job type:
  event_execution_job
- service events:
  intake_received, quote_prepared, quote_sent, booking_confirmed, deposit_received, vendor_assigned, staff_assigned, schedule_finalized, setup_started, setup_completed, guest_arrival_window_open, event_live, issue_logged, milestone_captured, service_completed, teardown_started, teardown_completed, final_payment_received, event_closed
- record type:
  event_record

## Reality Check
- where does this exist in the real world right now?
  - banquet halls
  - wedding venues
  - hotels with event operations
  - private event spaces
  - conference/event centers
- who is already doing this workflow?
  - banquet hall managers
  - event coordinators
  - wedding planners
  - venue operations teams
  - hospitality groups using fragmented CRMs / spreadsheets / calls / email / PDFs
- what is currently broken about it?
  - fragmented communication across client, venue, and vendors
  - no single operational record
  - manual scheduling and reassignment
  - poor visibility into setup / live / teardown status
  - weak vendor accountability
  - disconnected deposit / payment / settlement flow
  - marketing and content generation happen separately from execution
  - event knowledge does not compound into structured reusable data

## Scope Guardrails
- what this surface does:
  - capture structured event requests
  - convert event requests into executable jobs
  - coordinate vendors, staff, and schedule checkpoints
  - maintain event state through service events
  - attach media/evidence to execution state
  - support settlement and completion
  - produce a final event record for audit, service proof, and post-event marketing inputs
- what this surface does NOT do:
  - it does not replace specialized creative tools or kitchen/POS systems
  - it does not itself provide venue, catering, decor, music, or staffing
  - it does not function as an open marketplace by default
  - it does not manage broad social networking behavior of guests
  - it does not eliminate human event coordinators; it structures and strengthens them

## Agent Intent (optional)
- potential agent roles:
  - intake agent
  - quote preparation agent
  - coordinator support agent
  - vendor routing agent
  - scheduling agent
  - issue escalation agent
  - settlement support agent
  - event summary / media pack agent

---

## Universal Execution Model
REQUEST
→ QUOTE / BOOKING
→ ASSIGNMENT
→ QUEUE
→ CLAIM (recommended where applicable)
→ ACTIVE
→ EXECUTION
   → PRE-CAPTURE (optional)
   → SETUP
   → LIVE EVENT
   → MILESTONE CAPTURE
   → TEARDOWN
   → POST-CAPTURE (optional)
→ SETTLEMENT
→ COMPLETION
→ REPORT
→ ROUTING

CORE RULE:
A banquet/event surface is not complete until the full event loop is closed.

## Guard + State Model

GUARD MODEL:
- UI must verify operator/staff/vendor permissions before action
- API must enforce ownership or authorized venue/admin scope
- execution must require status == active
- queued jobs cannot be executed as if live

STATE MODEL:
status:
- queued
- active
- complete

Transitions:
- queued → active
- active → complete

RULE:
Each transition has ONE canonical endpoint.
No duplicates allowed.

## Execution Record Model

PRIMARY RECORD:
ServiceEvent (or event-equivalent execution record)

Must include:

timestamps:
- created_at
- started_at
- completed_at

evidence:
- before[]
- after[]
- optional setup[]
- optional live[]
- optional teardown[]

meta:
- payment_status
- amount_collected
- payment_method
- payment_note

outcome:
- completion_summary

## Evidence Layer

EVIDENCE MODEL:
- capture stages:
  before / during / after
- storage:
  external (R2 or equivalent)
- persistence:
  append-only
  idempotent
- linkage:
  attached to execution record

RULE:
Photos/videos/files alone are not enough.
Evidence must be attached to system state.

## Settlement Model

SETTLEMENT MODEL:
- independent of completion: true

supported states:
- unpaid
- partial
- paid
- waived

supported methods:
- cash
- zelle
- venmo
- card
- wire
- other

storage:
execution record meta

## Output / Report Model

REPORT MODEL:
generated from:
- intake snapshot
- quote / booking context
- execution record
- evidence
- settlement

properties:
- deterministic
- renderable in UI
- usable as customer-facing summary
- usable as internal audit record
- usable as marketing input

purpose:
- proof of delivery
- service record
- operational review
- testimonial/content pipeline input

## Routing Model

ENTRY:
- queued → dashboard / coordination queue
- active → live event execution view
- complete → record / archive / reporting view

POST-COMPLETION:
- re-fetch active jobs
- else queued jobs
- else idle state

## Kernel Invariant

Actor → Request → Job → ServiceEvent → Record

This surface must preserve that chain.

## Anti-Drift Rules

- never invent schema
- never bypass authorization model
- never collapse execution and settlement into one ambiguous step
- never treat static files as state
- always preserve deterministic transition logic
- always validate build after filesystem changes if repo standards require it

## Validation Checklist

[ ] surface document exists in compiler layer
[ ] event loop closes
[ ] assignment/authorization model is explicit
[ ] execution is state-guarded
[ ] evidence attaches to state
[ ] settlement persists independently
[ ] final record is definable
[ ] no runtime files modified
