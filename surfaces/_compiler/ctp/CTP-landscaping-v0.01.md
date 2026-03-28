# COMPILATION TARGET PACK — LANDSCAPING v0.01

## Compilation Target Identity
- target slug: landscaping
- target name: Landscaping Surface
- source SDP: surfaces/_compiler/sdp/SDP-LANDSCAPING-v0.01.md
- workflow class: EXECUTION

## Intent
Activate the Landscaping Surface inside the Planck/QTM OS repo using the existing surface architecture without breaking runtime integrity.

This compilation target is for independent landscapers, property maintenance crews, and operators managing on-site job execution across residential and commercial properties.

## Activation Goal
Map the landscaping surface into the repo so that:
- the surface exists in the canonical surface registry
- the surface route resolves correctly
- multiple operators can be attached to the surface across regions
- the operator template renders without inventing runtime architecture
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
- slug: `landscaping`
- name: `Landscaping`
- description: on-site property maintenance execution with structured job tracking and evidence capture
- workflow class: `EXECUTION`

Minimum requirement:
- the surface must appear in `src/data/surfaces.ts`
- the entry must match the established schema already used by existing surfaces
- status: `"live"`
- no schema invention allowed

### 2. Surface Route Target
The following route must resolve:
- `/surfaces/landscaping`

Expected behavior:
- the surface page renders successfully
- operator cards render for all operators attached to this surface
- build must pass

### 3. Operator Template Target
Create or register a surface-specific operator template for landscaping.

Expected target:
- `src/templates/operator/v1/landscaping.astro`

This file must NOT be created unless:
- the existing template pattern is confirmed
- the resolver pattern is confirmed

Template intent:
- render a landscaping operator profile
- support property maintenance / crew framing
- preserve current layout and data expectations
- avoid speculative UI complexity

### 4. Template Resolver Target
Register the landscaping template in:
- `src/lib/operator-templates.ts`

Expected mapping pattern:
- `v1:landscaping`

Rules:
- preserve existing resolver conventions
- do not refactor unrelated mappings
- do not introduce fallback ambiguity

### 5. Operator Data Target
Add operators attached to `surface: "landscaping"`.

Operator mode: MULTIPLE

Rules:
- must use existing operator schema exactly
- must attach to `surface: "landscaping"`
- must include location fields (country, state, city, regionName) per existing schema
- must not invent unsupported fields

### 6. Runtime Semantics Target
The landscaping surface must preserve these semantic units:

request:
- landscaping_request (property_service_request)

job:
- landscaping_job

service event:
- job_created, job_scheduled, job_assigned, job_started, job_completed, job_verified

record:
- property_service_record

Execution spine:
- request → job → service event → record

Evidence required:
- before_photos (required)
- after_photos (required)
- notes (optional)

## Operational Semantics
This surface represents:
- intake / job request capture
- operator assignment and scheduling
- on-site execution (mow, trim, edge, cleanup)
- before/after evidence capture
- settlement (post-job payment)
- final service record generation

This surface does NOT require:
- landscaping design / architecture tools
- inventory management systems
- HR or payroll features
- autonomous scheduling agents at compile time
- speculative marketplace logic

## Compatibility Rules
The activation must be compatible with:
- existing Astro route generation
- existing operator template resolution
- existing static build behavior
- existing surface/operator schema discipline
- existing ServiceEvent-centered execution philosophy
- existing geo routing (`/[country]/[state]/[city]/[surface]`) if repo supports it

## Validation Targets

### Surface Validation
- `/surfaces/landscaping` resolves
- surface appears in canonical surface data
- build passes

### Operator Validation
- `/operators/<slug>` resolves for each attached operator
- operators bind to correct template
- operators bind to `landscaping`

### Resolver Validation
- template resolver recognizes `v1:landscaping`
- no unrelated templates break
- no fallback collision introduced

### Region Validation
- operators include location fields per schema
- geo routes resolve if repo supports them

### Integrity Validation
- no changes to unrelated runtime paths
- no schema invention
- no broken imports
- no build regressions

## Stop Conditions
Compilation is complete when:
- landscaping surface is registered
- route resolves
- template is confirmed and registered
- at least one operator path resolves
- build passes
- no architecture drift introduced

## Non-Goals
This compilation target does NOT:
- introduce a scheduling engine
- implement inventory tracking
- create payroll or HR infrastructure
- add autonomous routing logic
- redesign the execution spine

## Notes for Future Versions
Future CTP versions may extend landscaping with:
- GPS-based territory routing
- crew multi-operator job assignment
- recurring job scheduling
- seasonal service packages
- property history and evidence archive
- customer portal for proof-of-service review

## Compilation Principle
Compile the simplest valid version of the landscaping surface first.

Do not overbuild.
Do not invent orchestration layers.
Preserve the spine.
Activate the surface cleanly.
