---
paths:
  - "**/*"
---

# Planning Rules (ControlFlow x Claude Code) — Project-Level

Приоритет у `CLAUDE.md` в корне проекта. Это дополнение для сессий где CLAUDE.md может не загрузиться.

## Complexity Tiers

| Tier | Criteria | Review Required |
|------|----------|-----------------|
| TRIVIAL | 1-2 files, single concern, low blast radius | Skip (no plan artifact) |
| SMALL | 3-5 files, one subsystem | controlflow-plan-audit |
| MEDIUM | 6-14 files or multiple concerns | plan-audit + assumption-verifier |
| LARGE | 15+ files OR high-risk any size | plan-audit + assumption-verifier + executability-verifier |

**Override:** Any unresolved HIGH semantic risk → automatically LARGE.

## Semantic Risk Review — 7 mandatory categories

Every plan MUST include all 7: data_volume, performance, concurrency, access_control, migration_rollback, dependency, operability. Never skip — use `not_applicable` if irrelevant.

## Skill Invocations

| Tier | Command |
|------|---------|
| TRIVIAL | Skip |
| SMALL | `/controlflow-claude-code:controlflow-plan-audit` |
| MEDIUM | plan-audit + `/controlflow-claude-code:controlflow-assumption-verifier` |
| LARGE | plan-audit + assumption-verifier + `/controlflow-claude-code:controlflow-executability-verifier` |
