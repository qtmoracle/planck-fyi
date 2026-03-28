# COMPILATION TARGET PACK — EVENT / BANQUET HALL v0.01

## Compilation Target Identity
- target slug: event-coordination
- target name: Event Coordination Surface
- source SDP: surfaces/_compiler/sdp/SDP-EVENT-v0.01.md
- workflow class: COORDINATION

## Intent
Activate the Event Coordination Surface inside the Planck/QTM OS repo using the existing surface architecture without breaking runtime integrity.

This compilation target is for banquet halls, wedding venues, event spaces, and similar environments where a single client request expands into coordinated execution across venue staff, vendors, timing, and settlement.

## Activation Goal
Map the event surface into the repo so that:
- the surface exists in the canonical surface registry
- the surface route resolves correctly
- an operator can be attached to the surface
- the operator template can render without inventing runtime architecture
- the system preserves the kernel invariant:
  Actor → Request → Job → ServiceEvent → Record

## Repo Assumptions
- surfaces are declared in `src/data/surfaces.ts`
- operators are declared in `src/data/operators.ts`
- operator routes resolve via `src/pages/operators/[slug].astro`
- surface routes resolve via `src/pages/surfaces/[slug].astro`
- operator templates are resolved through `src/lib/operator-templates.ts`
- templates live under `src/templates/operator/v1/`
- no file structure may be invented without confirming repo reality first

## Required Compilation Targets

### 1. Surface Registry Target
Add a canonical surface entry for:
- slug: `event-coordination`
- name: `Event Coordination`
- description: coordination of live time-bound event execution across venue, vendors, staff, and settlement
- workflow class: `COORDINATION`

Minimum requirement:
- the surface must appear in `src/data/surfaces.ts`
- the entry must match the established schema already used by existing surfaces
- no schema invention allowed

### 2. Surface Route Target
The following route must resolve:
- `/surfaces/event-coordination`

Expected behavior:
- the surface page renders successfully
- if no operators are attached yet, fallback behavior is acceptable if it matches current system conventions
- build must pass

### 3. Operator Template Target
Create or register a surface-specific operator template for event coordination only if repo reality supports it.

Expected target:
- `src/templates/operator/v1/events.astro`

But this file must NOT be created unless:
- the existing template pattern is confirmed
- the resolver pattern is confirmed
- there is not already a reusable template better suited to this surface

Template intent:
- render an event operator profile
- support banquet hall / venue / event coordinator framing
- preserve current layout and data expectations
- avoid speculative UI complexity

### 4. Template Resolver Target
Register the event template in:
- `src/lib/operator-templates.ts`

Expected mapping pattern:
- `v1:event-coordination`

Rules:
- preserve existing resolver conventions
- do not refactor unrelated mappings
- do not introduce fallback ambiguity

### 5. Operator Data Target
Add one starter operator only if requested during activation.

Suggested starter operator shape:
- a banquet hall
- an event venue
- or `qtm-events` as a generic operator placeholder

Rules:
- must use existing operator schema exactly
- must attach to `surface: "event-coordination"`
- must not invent unsupported fields

### 6. Runtime Semantics Target
The event surface must preserve these semantic units:

request:
- event request

job:
- master event execution job

service event:
- milestone/state-bearing execution events

record:
- final event record

Important:
Event coordination may include multiple sub-services or vendor tasks, but compilation should NOT invent a new orchestration engine if the repo does not already support one.
The first activation should compile to the current spine cleanly, even if nested coordination remains conceptual for now.

## Operational Semantics
This surface represents:
- booking coordination
- vendor/staff assignment
- schedule checkpoints
- setup/live/teardown tracking
- settlement
- final record generation

This surface does NOT require:
- a guest social graph
- ticketing platform replacement
- kitchen/POS replacement
- speculative marketplace logic
- autonomous multi-agent orchestration at compile time

## Compatibility Rules
The activation must be compatible with:
- existing Astro route generation
- existing operator template resolution
- existing static build behavior
- existing surface/operator schema discipline
- existing ServiceEvent-centered execution philosophy

## Validation Targets

### Surface Validation
- `/surfaces/event-coordination` resolves
- surface appears in canonical surface data
- build passes

### Operator Validation
If operator added:
- `/operators/<slug>` resolves
- operator binds to correct template
- operator binds to `event-coordination`

### Resolver Validation
- template resolver recognizes the event surface
- no unrelated templates break
- no fallback collision introduced

### Integrity Validation
- no changes to unrelated runtime paths
- no schema invention
- no broken imports
- no build regressions

## Stop Conditions
Compilation is complete when:
- event surface is registered
- route resolves
- template path is confirmed and registered if needed
- operator path resolves if operator added
- build passes
- no architecture drift introduced

## Non-Goals
This compilation target does NOT:
- introduce a new scheduler engine
- implement vendor marketplace logic
- create payment processor infrastructure
- add admin workflow redesign
- implement agentic coordination
- redesign the execution spine

## Notes for Future Versions
Future CTP versions may extend event coordination with:
- sub-job/vendor assignment model
- schedule blocks / run-of-show timeline
- venue resource allocation
- contract/deposit state
- post-event media pack generation
- referral/vendor attribution
- banquet hall CRM + marketing bridge

## Compilation Principle
Compile the simplest valid version of the event surface first.

Do not overbuild.
Do not invent orchestration layers.
Preserve the spine.
Activate the surface cleanly.
