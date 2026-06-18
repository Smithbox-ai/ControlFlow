---
paths:
  - "**/*"
---

# Planning Rules (ControlFlow x Claude Code) — Project-Level

Приоритет у `CLAUDE.md` в корне проекта. Это дополнение для сессий где CLAUDE.md может не загрузиться. Plugin v0.2.0: 3 skills, 0 subagents — plan → verify → review.

## Workflow (tier-gated)

| Tier | Plan | Verify (inline phases) | Review |
|------|------|------------------------|--------|
| TRIVIAL | skip | skip | skip |
| SMALL | `/controlflow-claude-code:controlflow-plan` | `/controlflow-claude-code:controlflow-verify` phase 1 | `/controlflow-claude-code:controlflow-review` |
| MEDIUM | `controlflow-plan` | `controlflow-verify` phases 1–2 | `controlflow-review` |
| LARGE | `controlflow-plan` | `controlflow-verify` phases 1–3 | `controlflow-review` |

**Override:** Any unresolved HIGH semantic risk → automatically LARGE (all 3 verify phases). Do not begin implementation on SMALL+ work until `controlflow-verify` returns APPROVED.

## Semantic Risk Review — 7 mandatory categories

Every plan MUST include all 7: data_volume, performance, concurrency, access_control, migration_rollback, dependency, operability. Never skip — use `not_applicable` if irrelevant.

## Plan Format

The full plan format (YAML header with `Agent: Planner` and `Schema Version: 1.2.0`, the 10 sections in order, the 5 lifecycle sections, the 7-category semantic risk table, and the Mermaid rules) is defined once in the `controlflow-plan` skill, which reads `schemas/planner.plan.schema.json` and `plans/templates/plan-document-template.md` as the single source of truth. Refer there rather than restating it.