# ACTIVATION PROMPT — LANDSCAPING v0.01 (MULTI-OPERATOR + REGION AWARE)

## Surface
- slug: landscaping
- name: Landscaping
- SDP: surfaces/_compiler/sdp/SDP-LANDSCAPING-v0.01.md
- CTP: surfaces/_compiler/ctp/CTP-landscaping-v0.01.md
- OPERATOR_MODE: multiple
- REGION_AWARE: true

---

## Instructions (Claude)

We are activating the Landscaping Surface.

Goal:
Activate a region-aware, multi-operator landscaping surface cleanly into the repo using existing architecture.

---

## Rules

- CONFIRM repo reality before changes
- DO NOT invent structure
- PRESERVE existing routing patterns
- DO NOT include git commands
- KEEP implementation minimal but extensible
- READ before WRITE

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

Add:
- slug: "landscaping"
- name: "Landscaping"
- description: "On-site property maintenance execution with structured job tracking and evidence capture."
- status: "live"
- image: "/images/surfaces/landscaping.svg"

Use existing schema exactly. Do NOT break formatting.

---

## Step 4 — Route Compatibility Check

Read:
- src/pages/surfaces/[slug].astro

Verify:
- surfaces are rendered from data
- getStaticPaths filters to status === "live"

Also inspect geo routing reality:
- does /[country]/[state]/[city]/[surface] exist in pages?

Do NOT invent geo behavior if not present in repo.

---

## Step 5 — Template Strategy

Inspect:
src/templates/operator/v1/
src/lib/operator-templates.ts

Evaluate:
- does landscaping.astro already exist?
- can an existing template be reused?
- is a new template actually necessary?

If template does not exist:
- create src/templates/operator/v1/landscaping.astro
- follow existing template structure exactly
- framing: property maintenance / on-site crew execution
- remain minimal

---

## Step 6 — Template Creation (if needed)

Path:
src/templates/operator/v1/landscaping.astro

Must:
- support operator identity
- support landscaping-framed request CTA
- follow existing imports/layouts/patterns
- not invent unsupported props or schema

---

## Step 7 — Resolver Registration

Modify:
src/lib/operator-templates.ts

Add:
'v1:landscaping' → landscaping template

Ensure:
- no conflicts
- no fallback break
- import added if template is new

---

## Step 8 — Operator Strategy

Modify:
src/data/operators.ts

Add 2–3 operators with:
- surface: "landscaping"
- different slugs
- location fields (country, state, city, regionName) per existing schema
- template: "v1"

Do NOT invent schema fields.

---

## Step 9 — Region Awareness Check

Inspect:
src/data/operators.ts

Confirm:
- operators include country, state, city, regionName
- new landscaping operators follow the same pattern exactly

If geo routing pages exist:
- verify /[country]/[state]/[city]/landscaping would resolve

---

## Step 10 — Build Validation

Run:
npm run build

Must pass with no errors.

---

## Step 11 — Route Validation

Check:
- /surfaces/landscaping
- /operators/<slug> for each operator added

If geo routing confirmed by repo:
- /us/<state>/<city>/landscaping for each operator region

Do NOT claim geo routing works unless confirmed by build output.

---

## Step 12 — Output

Activation Report — Landscaping v0.01

Surface:
Landscaping (landscaping)

Files Modified:
- list all files touched

Template:
- reused / created

Operators Added:
- list all slugs

Routing:
- surface: OK / FAIL
- operators: OK / FAIL
- region: OK / FAIL / NOT APPLICABLE

Build:
- PASS / FAIL

Scalability Readiness:
- single-operator ready: YES
- multi-operator ready: YES
- region-ready: YES / NOT APPLICABLE

Notes:
- ...
