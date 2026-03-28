# COMPILER PROMPT — v0.06 (FULL SURFACE PACK GENERATOR)

## Purpose
Generate a complete compiler pack for a new surface in one pass.

Outputs:
- SDP (Surface Declaration Pack)
- CTP (Compilation Target Pack)
- Activation Prompt
- Validator Prompt

---

## Inputs

- SURFACE_NAME: <name>
- SURFACE_SLUG: <slug>
- WORKFLOW_CLASS: INTERPRETIVE | EXECUTION | COORDINATION
- DESCRIPTION: <one-line purpose>

Optional:
- PRIMARY_ACTORS:
- REQUEST_TYPE:
- JOB_TYPE:
- REGION_AWARE: true | false
- OPERATOR_MODE: single | multiple

---

## Instructions (Claude)

We are generating a full compiler pack for a new surface.

Surface:
- name: {{SURFACE_NAME}}
- slug: {{SURFACE_SLUG}}

Goal:
Create all required compiler artifacts for this surface inside the compiler layer.

---

## Rules

- DO NOT modify runtime files
- DO NOT invent new directories outside compiler layer
- FOLLOW existing naming conventions
- KEEP outputs deterministic and minimal
- DO NOT include git commands

---

## Step 1 — Confirm Compiler Layer

Verify:
- surfaces/_compiler/sdp/
- surfaces/_compiler/ctp/
- surfaces/_compiler/prompts/

---

## Step 2 — Generate SDP

Create:

surfaces/_compiler/sdp/SDP-{{SURFACE_SLUG}}-v0.01.md

Include:
- Surface Identity
- Classification
- Workflow Mapping
- Reality Check
- Scope Guardrails
- Agent Intent
- Universal Execution Model
- Guard + State Model
- Execution Record Model
- Evidence Layer
- Settlement Model
- Output / Report Model
- Routing Model
- Kernel Invariant
- Anti-Drift Rules
- Validation Checklist

Adapt fields using inputs.

---

## Step 3 — Generate CTP

Create:

surfaces/_compiler/ctp/CTP-{{SURFACE_SLUG}}-v0.01.md

Include:
- Compilation Target Identity
- Intent
- Activation Goal
- Repo Assumptions
- Required Compilation Targets:
  - Surface Registry
  - Route
  - Template
  - Resolver
  - Operator
- Runtime Semantics
- Validation Targets
- Stop Conditions
- Non-Goals

---

## Step 4 — Generate Activation Prompt

Create:

surfaces/_compiler/prompts/activation-{{SURFACE_SLUG}}-v0.01.md

Base on:
activation-prompt-template-v0.02.md

Fill:
- slug
- name
- SDP path
- CTP path
- OPERATOR_MODE
- REGION_AWARE

---

## Step 5 — Generate Validator Prompt

Create:

surfaces/_compiler/prompts/validator-{{SURFACE_SLUG}}-v0.01.md

Base on:
validator-prompt-event-v0.02.md

Adapt:
- surface slug
- paths
- operator expectations
- region handling (if applicable)

---

## Step 6 — Verify Output

Run:
tree -L 3 surfaces/_compiler

Confirm all files created:
- SDP
- CTP
- activation prompt
- validator prompt

---

## Step 7 — Output

Return:

Compiler Pack Report

Surface:
{{SURFACE_NAME}} ({{SURFACE_SLUG}})

Files Created:
- list all 4 files

Workflow Class:
{{WORKFLOW_CLASS}}

Operator Mode:
{{OPERATOR_MODE}}

Region Aware:
{{REGION_AWARE}}

Status:
READY FOR ACTIVATION

Notes:
- ...
