# VALIDATOR PROMPT — EVENT v0.02 (MULTI-OPERATOR + REGION AWARE)

## Purpose
Validate activation of the Event Coordination Surface with support for:
- multiple operators
- region-aware routing
- coordination surface semantics

---

## Inputs

- SURFACE_SLUG: event-coordination
- SDP: surfaces/_compiler/sdp/SDP-EVENT-v0.01.md
- CTP: surfaces/_compiler/ctp/CTP-EVENT-v0.01.md

---

## Instructions (Claude)

We are validating the Event Coordination Surface activation.

Goal:
Produce a deterministic PASS / PARTIAL / FAIL report based ONLY on repo reality.

---

## Rules

- DO NOT modify any files
- DO NOT invent runtime behavior
- CONFIRM everything via actual file inspection
- MARK missing pieces explicitly
- DO NOT assume geo routing exists unless proven
- DO NOT include git commands

---

## Step 1 — Confirm Compiler Artifacts

Check:
- surfaces/_compiler/sdp/SDP-EVENT-v0.01.md
- surfaces/_compiler/ctp/CTP-EVENT-v0.01.md

If missing:
FAIL immediately

---

## Step 2 — Surface Registry Validation

Read:
src/data/surfaces.ts

Check:
- event-coordination exists
- schema matches existing surfaces
- status allows routing (likely "live")

Mark:
PASS / PARTIAL / FAIL

---

## Step 3 — Route Infrastructure Validation

Read:
src/pages/surfaces/[slug].astro

Check:
- route exists
- surfaces are rendered from data

Determine:
Would /surfaces/event-coordination resolve?

Mark:
PASS / PARTIAL / FAIL

---

## Step 4 — Template Validation

Inspect:
src/templates/operator/v1/

Check:
- event template exists OR reusable template confirmed

Mark:
PASS / PARTIAL / FAIL

---

## Step 5 — Resolver Validation

Read:
src/lib/operator-templates.ts

Check:
- 'v1:event-coordination' mapping exists

Mark:
PASS / PARTIAL / FAIL

---

## Step 6 — Operator Validation (Multi-Aware)

Read:
src/data/operators.ts

Check:
- at least one operator with surface: "event-coordination"

Count:
- number of operators attached

Evaluate:
- 0 → PARTIAL (surface exists but no operator)
- 1 → PASS (minimum viable)
- 2+ → PASS (multi-operator ready)

Also verify:
- schema matches existing operators

---

## Step 7 — Region Awareness Validation

Inspect operator entries.

Check:
- do operators include region/location fields?
- do they match existing schema patterns?

Then determine:

- if repo supports geo routing:
  PASS / PARTIAL / FAIL

- if repo does NOT support geo routing:
  mark as NOT APPLICABLE

DO NOT assume geo support.

---

## Step 8 — Runtime Semantic Fit

Evaluate:

Can current system support:
- request → job → service event → record
for event coordination?

Check consistency with:
- existing surfaces
- operator model
- template system

Mark:
PASS / PARTIAL / FAIL

---

## Step 9 — Build Validation

Run:
npm run build

Check:
- build passes
- no errors introduced

Mark:
PASS / FAIL

---

## Step 10 — Route Validation

Check:

- /surfaces/event-coordination
- /operators/<event-operator>

If geo routing exists:
- /us/.../event-coordination

Mark each:
OK / FAIL / NOT APPLICABLE

---

## Step 11 — Final Output

Return:

Event Surface Validation Report — v0.02

Validation Matrix:
- Compiler Artifacts:
- Surface Registry:
- Surface Route:
- Template:
- Resolver:
- Operator Attachment:
- Region Support:
- Runtime Fit:
- Build Integrity:

Operator Count:
- #

Routes:
- surface:
- operator:
- region:

Findings:
- bullet points only

Final Verdict:
- FULL PASS
- PASS WITH GAPS
- FAIL

Next Required Action:
- minimal action only
