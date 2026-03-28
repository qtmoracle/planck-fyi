# VALIDATOR PROMPT — LANDSCAPING v0.01 (MULTI-OPERATOR + REGION AWARE)

## Purpose
Validate activation of the Landscaping Surface with support for:
- multiple operators
- region-aware routing
- execution surface semantics

---

## Inputs

- SURFACE_SLUG: landscaping
- SDP: surfaces/_compiler/sdp/SDP-LANDSCAPING-v0.01.md
- CTP: surfaces/_compiler/ctp/CTP-landscaping-v0.01.md

---

## Instructions (Claude)

We are validating the Landscaping Surface activation.

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
- surfaces/_compiler/sdp/SDP-LANDSCAPING-v0.01.md
- surfaces/_compiler/ctp/CTP-landscaping-v0.01.md

If missing:
FAIL immediately

---

## Step 2 — Surface Registry Validation

Read:
src/data/surfaces.ts

Check:
- landscaping entry exists
- schema matches existing surfaces
- status: "live" (required for route generation)

Mark:
PASS / PARTIAL / FAIL

---

## Step 3 — Route Infrastructure Validation

Read:
src/pages/surfaces/[slug].astro

Check:
- route exists
- surfaces rendered from data via getStaticPaths
- getStaticPaths filters to status === "live"

Determine:
Would /surfaces/landscaping resolve if data entry exists with status: "live"?

Mark:
PASS / PARTIAL / FAIL

---

## Step 4 — Template Validation

Inspect:
src/templates/operator/v1/

Check:
- landscaping.astro exists

If missing:
- is there a reusable template that could substitute?
- mark clearly

Mark:
PASS / PARTIAL / FAIL

---

## Step 5 — Resolver Validation

Read:
src/lib/operator-templates.ts

Check:
- 'v1:landscaping' mapping exists and points to a real import

Mark:
PASS / PARTIAL / FAIL

---

## Step 6 — Operator Validation (Multi-Aware)

Read:
src/data/operators.ts

Check:
- operators with surface: "landscaping" exist

Count:
- number of operators attached

Evaluate:
- 0 → PARTIAL (surface exists but no operator)
- 1 → PASS (minimum viable)
- 2+ → PASS (multi-operator ready)

Verify:
- schema matches existing operators (slug, name, logo, country, state, city, regionName, surface, tagline, template, bookingHref)

---

## Step 7 — Region Awareness Validation

Inspect operator entries for landscaping.

Check:
- do operators include country, state, city, regionName fields?
- do values follow existing patterns?

Then determine:

If repo supports geo routing (/[country]/[state]/[city]/[surface]):
- would /us/<state>/<city>/landscaping resolve for each operator?
- PASS / PARTIAL / FAIL

If repo does NOT support geo routing:
- mark as NOT APPLICABLE

DO NOT assume geo support. Confirm by checking src/pages/ structure.

---

## Step 8 — Runtime Semantic Fit

Evaluate:

Can current system support:
- landscaping_request → landscaping_job → service event → property_service_record?

Check consistency with:
- existing surfaces (auto-detailing, astrology)
- operator model
- template system
- ServiceEvent-centered execution philosophy

Mark:
PASS / PARTIAL / FAIL

---

## Step 9 — Build Validation

Run:
npm run build

Check:
- build passes
- landscaping pages generated
- no errors introduced by activation

Mark:
PASS / FAIL

---

## Step 10 — Route Validation

Check:

- /surfaces/landscaping
- /operators/<slug> for each landscaping operator

If geo routing exists in repo:
- /us/<state>/<city>/landscaping for each region

Mark each:
OK / FAIL / NOT APPLICABLE

---

## Step 11 — Final Output

Return:

Landscaping Surface Validation Report — v0.01

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

Operators Found:
- list slugs

Routes:
- surface:
- operators:
- region:

Findings:
- bullet points only

Final Verdict:
- FULL PASS
- PASS WITH GAPS
- FAIL

Next Required Action:
- minimal action only
