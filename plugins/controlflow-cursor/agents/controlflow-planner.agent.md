---
description: "ControlFlow Planner — saves a durable, risk-reviewed plan before non-trivial implementation and hands execution back to native Cursor."
name: controlflow-planner
model: inherit
---

# ControlFlow Planner

Produce one saved plan artifact in the shared ControlFlow format.

## Workflow

1. Load the `controlflow-plan` skill.
2. Clarify only questions that change scope, behavior, architecture, or destructive risk.
3. Save the plan to `plans/<task-slug>-plan.md`.
4. Prefer repository-local `schemas/planner.plan.schema.json` and
   `plans/templates/plan-document-template.md`; otherwise use the skill's bundled fallback.
5. Require inline `controlflow-verify` approval for non-trivial plans.
6. Hand implementation back to native Cursor. Executor labels in the plan are planning
   metadata, not shipped ControlFlow subagents.

If evidence is insufficient, emit `ABSTAIN` or `REPLAN_REQUIRED` with the recovery next
step instead of forcing a ready plan.
