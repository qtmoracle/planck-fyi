# ACTIVATION PROMPT TEMPLATE — v0.01

## Purpose
Activate a surface from compiler artifacts (SDP + CTP) into runtime.

This template ensures a surface becomes:
- registered
- routable
- renderable
- minimally operable

---

## Inputs (fill before use)

- SURFACE_SLUG: <slug>
- SURFACE_NAME: <name>
- SDP_PATH: surfaces/_compiler/sdp/<file>
- CTP_PATH: surfaces/_compiler/ctp/<file>

---

## Instructions (Claude)

We are activating a surface into runtime.

Surface:
- slug: {{SURFACE_SLUG}}
- name: {{SURFACE_NAME}}

Artifacts:
- SDP: {{SDP_PATH}}
- CTP: {{CTP_PATH}}

Goal:
Activate this surface cleanly into the repo using existing architecture.

---

## Rules

- CONFIRM repo reality before making changes
- DO NOT invent files or directories
- ONLY modify confirmed existing files
- PRESERVE build integrity
- DO NOT include git commands
- FOLLOW existing schema exactly
- READ before WRITE

---

## Step 1 — Confirm Repo Reality

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

## Step 2 — Read Existing Patterns

Read:
- src/data/surfaces.ts
- src/data/operators.ts
- src/lib/operator-templates.ts

Understand schema before modifying.

---

## Step 3 — Add Surface Entry

Modify:
src/data/surfaces.ts

Add:
- slug: {{SURFACE_SLUG}}
- name: {{SURFACE_NAME}}
- correct schema fields
- status: "live" (or match pattern)

Do NOT break formatting.

---

## Step 4 — Confirm Route Mechanism

Read:
src/pages/surfaces/[slug].astro

Verify:
- surfaces are rendered from data
- no extra wiring required

Do NOT modify unless necessary.

---

## Step 5 — Template Strategy

Inspect:
src/templates/operator/v1/
src/lib/operator-templates.ts

Choose:
- reuse existing template OR
- create new template

Prefer reuse.

---

## Step 6 — Template Creation (if required)

Path:
src/templates/operator/v1/{{SURFACE_SLUG}}.astro

Requirements:
- follow existing template structure
- use same layout/imports
- minimal viable UI only

---

## Step 7 — Register Template

Modify:
src/lib/operator-templates.ts

Add:
'v1:{{SURFACE_SLUG}}' → template

Do not break resolver.

---

## Step 8 — Add Operator

Modify:
src/data/operators.ts

Add ONE operator:
- valid schema
- surface: "{{SURFACE_SLUG}}"

---

## Step 9 — Build Check

Run:
npm run build

Ensure:
- no errors
- pages generated

---

## Step 10 — Route Check

Verify:
- /surfaces/{{SURFACE_SLUG}}
- /operators/<operator-slug>

---

## Step 11 — Output

Return:

Activation Report

Surface:
{{SURFACE_NAME}} ({{SURFACE_SLUG}})

Files Modified:
- ...

Template:
- reused / created

Operator:
- slug

Build:
- PASS / FAIL

Routes:
- surfaces: OK / FAIL
- operator: OK / FAIL

Notes:
- ...
