# Architecture Decision Record

## Title

ADR-0002: Planner Schema 2.0.0 — Roadmap (not yet implemented)

## Date

2026-06-17

## Status

Proposed / not started

## Context / Problem

`CLAUDE.md` (the repo's Claude Code control doc) carried a `Schema Version: 2.0.0` label while the machine-enforced contract — `schemas/planner.plan.schema.json` (`schema_version` const `1.2.0`, `agent` const `Planner`, 8-agent executor enum) plus `governance/project-context-registry.json`, `governance/runtime-policy.json`, `plans/templates/plan-document-template.md`, and `plugins/controlflow-shared-source/skills/controlflow-planning/` — uniformly enforces `1.2.0`. A plan written literally per the old `CLAUDE.md` (`Schema Version: 2.0.0`) would fail Ajv const validation. Repo-wide, `2.0.0` appeared only at `CLAUDE.md`; no `2.0.0` schema, fixture, or tutorial existed. `CLAUDE.md`'s own "Changes from v1 → v2" section describes a *process* rewrite (audit-pipeline consolidation), not a schema version bump — so the `2.0.0` label was aspirational/erroneous, not an implemented migration.

This ADR records the decision to **reconcile** `CLAUDE.md` to the enforced `1.2.0` contract now (executed in `plans/controlflow-remediation-plan.md`, Phases 2–4) and to **defer** a real `2.0.0` schema migration until a breaking contract change is actually required — so the forward-migration intent behind the (now-corrected) `2.0.0` label is not lost.

## Decision

1. **Reconcile now (done):** `CLAUDE.md` is corrected to `Agent: Planner`, `Schema Version: 1.2.0`, confidence threshold `0.9`, and the 8-agent executor enum. The control doc no longer contradicts the schema. A CI drift-check (`evals/drift-checks.mjs::checkControlFlowContractDrift`, wired as `validate.mjs` Pass 17) prevents recurrence.
2. **Defer 2.0.0:** Do not implement a `2.0.0` schema bump unless/until a breaking contract change is needed. A `2.0.0` migration is a cross-cutting change (see inventory below) disproportionate to the goal of keeping the control doc honest.

## Consequences

- **Positive:** The control doc and the enforced contract agree; CI now catches any future CLAUDE.md↔schema drift. The 2.0.0 intent is preserved here rather than silently dropped.
- **Negative:** A future maintainer who wants to ship 2.0.0 must update every dependent in the inventory below in one coherent change; partial migration would re-introduce the exact drift this plan fixed.

## 2.0.0 Migration-Dependents Inventory

A real `2.0.0` bump must update all of the following in lockstep (verified paths, 2026-06-17):

- `schemas/planner.plan.schema.json:25` — `schema_version` const `1.2.0` → `2.0.0` (and any new/removed required fields, enum changes, or restructured `risk_review`).
- `plans/templates/plan-document-template.md:9` — header `schema_version: 1.2.0`.
- All strict-plan fixtures that assert the header: `plugins/controlflow-codex/tests/fixtures/strict-plan-*.md` (and any codex `validate-strict-artifacts.ps1` expectations). The standalone Claude Code plugin's old `tests/fixtures/strict-plan-*.md` were removed in the 0.2.0 redesign (that plugin no longer ships a plan-structure validator or strict-plan fixtures).
- `plugins/controlflow-shared-source/skills/controlflow-planning/references/planner-output-contract.md:11` and `…/SKILL.md:53` — `Agent: Planner` / schema references (only if 2.0.0 changes the agent label or contract).
- Both tutorial sets: `docs/tutorial-en/06-planning.md`, `docs/tutorial-en/09-schemas.md`, `docs/tutorial-ru/06-planning.md`, `docs/tutorial-ru/09-schemas.md` (the `09-schemas.md` files cite `1.2.0` at ~line 90).
- `evals/validate.mjs` and `evals/drift-checks.mjs` — any hardcoded `1.2.0` assertions (including the new `checkControlFlowContractDrift` Pass 17 added by this plan, whose targets would need bumping).
- `CLAUDE.md` header + executor-enum sentence (already at `1.2.0` after this plan).
- `governance/runtime-policy.json:88` `confidence_threshold` — only if 2.0.0 changes the threshold; otherwise untouched.
- `governance/canonical-source-matrix.json` / `project-context-registry.json` — only if 2.0.0 changes the executor roster or authority declarations.

## Triggers (when 2.0.0 would be justified)

A `2.0.0` bump is warranted only when the plan contract gains a **breaking** change that `1.2.0` cannot express, for example:

- New required plan/phase fields, or removal of existing required fields.
- Expansion of the semantic risk taxonomy beyond the current 7 categories (or a structural change to `risk_review`).
- A new lifecycle model or a change to the 8-agent executor roster.
- A change to the `agent` const or the `schema_version` semantics.

A documentation/process rewrite (like the existing "v1 → v2" audit-pipeline consolidation) is **not** a schema trigger — it does not require bumping `schema_version`.

## Alternatives Considered

- **Implement 2.0.0 now:** Rejected — no breaking contract change is needed; the only problem was the control doc lying about the version. A full migration would touch ~10+ surfaces for no behavioral gain and risk re-introducing drift mid-migration.
- **Silently drop the 2.0.0 label with no record:** Rejected — the forward-migration intent (if it was real) would be lost, and a future maintainer would have no context for why the label existed.

## Related ADRs

- ADR-0001: Plan Artifact Revision Policy (`docs/architecture-decisions/0001-plan-artifact-revision-policy.md`).