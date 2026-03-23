# SDP-LANDSCAPING-v0.01

status: READY FOR COMPILATION  
workflow_class: EXECUTION

---

## 1. Surface Identity

**slug:** landscaping  
**name:** Landscaping  
**one_line_purpose:**  
On-site property maintenance execution with structured job tracking and evidence capture.

---

## 2. Classification

**workflow_class:** EXECUTION

**surface_abstraction:**  
Physical property maintenance execution environment (not tied to a specific company or venue)

**core_pattern:**  
request → schedule → dispatch → execute → capture → complete → report

---

## 3. Workflow Mapping

**primary_actors:**
- customer (property owner / manager)
- operator (landscaper / crew)
- admin (optional dispatcher)

**request_type:**  
property_service_request

**job_type:**  
landscaping_job

**service_events:**
- job_created
- job_scheduled
- job_assigned
- job_started
- job_paused
- job_resumed
- job_completed
- job_verified

**record_type:**  
property_service_record

---

## 4. Reality Check

**exists_today:**  
YES

**where:**
- residential lawn care
- commercial property maintenance
- HOA / community groundskeeping
- mobile landscaping crews

**who:**
- independent landscapers
- small crews (1–5 operators)
- property service companies

**current_breakdowns:**
- no structured job tracking
- weak before/after documentation
- inconsistent pricing + scope clarity
- poor communication with customers
- no standardized execution records

---

## 5. Scope Guardrails

**this_surface_does:**
- manage landscaping jobs
- track job lifecycle
- capture before/after state (photos + notes)
- allow operator execution flow
- generate service record

**this_surface_does_NOT_do:**
- design landscaping plans (no architecture layer)
- inventory management (for now)
- heavy CRM features
- payroll or HR systems

---

## 6. Execution Loop

1. intake received (`job_created`)
2. job scheduled (`job_scheduled`)
3. operator assigned (`job_assigned`)
4. operator arrives on site
5. capture BEFORE state (photos + notes)
6. execute service:
   - mowing
   - trimming
   - edging
   - cleanup
7. capture AFTER state
8. mark job complete (`job_completed`)
9. generate report / evidence bundle

---

## 7. State Model

```text
job_created
→ job_scheduled
→ job_assigned
→ job_started
→ job_completed
→ job_verified
```

Optional states:

```text
job_paused
job_resumed
job_canceled
```

---

## 8. Evidence Model

- before_photos: required
- after_photos: required
- notes: optional
- timestamp: required
- location: optional (future GPS)

This is the:
- proof of work layer
- future tokenization layer
- customer trust layer

---

## 9. Settlement Model

**payment_timing:**
- post-job (default)

**pricing_model:**
- flat rate
- per property
- per service tier

**future_ready:**
- integrate POS.X1 / StarAccept

---

## 10. Routing Model

**entry_points:**
- intake form
- admin panel
- API (future)

**operator_access:**
- operator dashboard
- view assigned jobs
- claim / start / complete

---

## 11. Operator Interface Requirements

**dashboard must show:**
- today’s jobs
- job status
- job details (address, notes)

**job view must allow:**
- start job
- upload BEFORE photos
- upload AFTER photos
- mark complete

---

## 12. Repo Mapping

Follow the proven pattern:

```text
src/data/surfaces.ts
→ add: landscaping

src/templates/operator/v1/
→ create: landscaping.astro

src/lib/operator-templates.ts
→ register mapping:
  landscaping → landscaping template

src/data/operators.ts
→ add landscaping operator

validate:
→ /surfaces/landscaping
→ /operators/[slug]
```

---

## 13. Validation Checklist

- [ ] surface renders at `/surfaces/landscaping`
- [ ] operator route resolves
- [ ] template loads without fallback
- [ ] no build errors
- [ ] resolver correctly maps surface → template

---

## 14. Agent Intent

**future_agent_roles:**
- route optimizer
- job summarizer
- upsell recommender
- auto-report generator

---

## Drop-in Compiler Prompt for Claude

```text
Activate a new surface using the QTM Surface Activation Protocol.

Surface:
landscaping

Follow STRICTLY:
- confirm repo reality first
- do not invent files
- preserve build integrity
- do not break resolver graph

Execute:
surface → template → resolver → operator → validation

Use:
SDP-LANDSCAPING-v0.01

Begin with:
1. verify src/data/surfaces.ts
2. confirm route exists
3. proceed step-by-step
WAIT for confirmation at each step
```
