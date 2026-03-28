# ACTIVATION PROMPT TEMPLATE — v0.02 (MULTI-OPERATOR + REGION AWARE)

## Purpose
Activate a surface with support for:
- multiple operators
- regional routing readiness
- coordination-heavy workflows

---

## Inputs

- SURFACE_SLUG: <slug>
- SURFACE_NAME: <name>
- SDP_PATH: surfaces/_compiler/sdp/<file>
- CTP_PATH: surfaces/_compiler/ctp/<file>

Optional:
- DEFAULT_REGION: <city/region>
- OPERATOR_MODE: single | multiple

---

## Instructions (Claude)

We are activating a coordination-capable surface.

Surface:
- slug: {{SURFACE_SLUG}}
- name: {{SURFACE_NAME}}

Artifacts:
- SDP: {{SDP_PATH}}
- CTP: {{CTP_PATH}}

Goal:
Activate a scalable surface that supports multiple operators and regional routing without breaking current architecture.

---

## Rules

- CONFIRM repo reality before changes
- DO NOT invent structure
- PRESERVE existing routing patterns
- DO NOT include git commands
- KEEP implementation minimal but extensible

---

## Step 1 — Repo Reality Check

Run:
pwd
tree -L 3 src/data
tree -L 3 src/pages
tree -L 3 src/templates
tree -L 3 src/lib

Confirm:
- src/data/surfaces.ts
- src/data/operators.ts
- src/lib/operator-templates.ts
- src/pages/surfaces/[slug].astro
- src/pages/operators/[slug].astro

If any missing:
STOP and report.

---

## Step 2 — Schema Pattern Read

Read:
- src/data/surfaces.ts
- src/data/operators.ts
- src/lib/operator-templates.ts

Understand schema before modifying.

---

## Step 3 — Surface Registration

Modify:
src/data/surfaces.ts

Ensure:
- add {{SURFACE_SLUG}} using existing schema exactly
- compatible with region-based routing
- status allows routing (likely "live")

---

## Step 4 — Route Compatibility Check

Read:
- src/pages/surfaces/[slug].astro

If present, also inspect geo routing reality from existing pages before assuming anything.

Verify whether repo supports:
- /surfaces/[slug]
- /[country]/[state]/[city]/[surface]

Do NOT invent geo behavior if current repo does not support it.

---

## Step 5 — Template Strategy

Inspect:
src/templates/operator/v1/
src/lib/operator-templates.ts

Evaluate:
- is this a coordination-heavy surface?
- can an existing template be reused?
- is a new template actually necessary?

If YES and necessary:
- template must support:
  - operator identity
  - request initiation
  - coordination-capable framing

Create or reuse accordingly.

---

## Step 6 — Template Creation (if needed)

Path:
src/templates/operator/v1/{{SURFACE_SLUG}}.astro

Must:
- support operator identity
- not assume single-service simplicity
- remain minimal
- follow existing imports/layouts/patterns

---

## Step 7 — Resolver Registration

Modify:
src/lib/operator-templates.ts

Add:
'v1:{{SURFACE_SLUG}}'

Ensure:
- no conflicts
- no fallback break

---

## Step 8 — Operator Strategy

Modify:
src/data/operators.ts

If OPERATOR_MODE == single:
- add one operator

If OPERATOR_MODE == multiple:
- add 2–3 operators with:
  - same surface
  - different slugs
  - region/location values only if supported by existing schema

Do NOT invent schema fields.

---

## Step 9 — Region Awareness Check

Inspect:
src/data/operators.ts

Confirm:
- operator includes location fields if schema supports it

If present:
- ensure new operators follow the same pattern exactly

---

## Step 10 — Build Validation

Run:
npm run build

Must pass.

---

## Step 11 — Route Validation

Check:
- /surfaces/{{SURFACE_SLUG}}
- /operators/<slug>

If geo routing is confirmed by repo reality, also check:
- /us/.../{{SURFACE_SLUG}}

Do NOT claim geo routing works unless confirmed by actual repo structure and build output.

---

## Step 12 — Output

Activation Report v0.02

Surface:
{{SURFACE_NAME}}

Operators:
- list all created

Template:
- reused / created

Routing:
- surface: OK / FAIL
- operators: OK / FAIL
- region: OK / FAIL / NOT APPLICABLE

Build:
- PASS / FAIL

Scalability Readiness:
- single-operator ready
- multi-operator ready
- region-ready / not applicable

Notes:
- ...
