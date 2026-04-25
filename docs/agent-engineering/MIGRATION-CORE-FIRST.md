# Core-first Migration Guide

This document remains the canonical reference for the shared implementation backbone and external-consolidation exit criteria. The phase sections below also remain as the historical migration record.

## Scope (Completed)

Core agents:

- `Orchestrator.agent.md`
- `Planner.agent.md`
- `Researcher-subagent.agent.md`
- `CodeMapper-subagent.agent.md`
- `CodeReviewer-subagent.agent.md`

Implementation agents:

- `CoreImplementer-subagent.agent.md`
- `UIImplementer-subagent.agent.md`

## Phase 2: Ecosystem Expansion (Completed)

New specialized agents:

- `PlatformEngineer-subagent.agent.md` — CI/CD, containers, infrastructure deployment.
- `TechnicalWriter-subagent.agent.md` — Documentation, diagrams, code-doc parity.
- `BrowserTester-subagent.agent.md` — scripted E2E browser testing and accessibility audits through provided harnesses.

Cross-cutting enhancements:

- Failure taxonomy (`transient`, `fixable`, `needs_replan`, `escalate`) added to all agents during the initial expansion. Current routing also includes `model_unavailable` where admitted by each agent schema.
- Wave-aware parallel execution added to Orchestrator.
- Inter-phase contracts and failure expectations added to Planner plan template.
- External delegation protocol schema (`schemas/orchestrator.delegation-protocol.schema.json`) added to reduce Orchestrator context bloat.
- Batch approval mechanism added to Orchestrator. Current behavior uses one approval per ordinary wave, with per-phase approval retained for destructive/high-risk or FAILED/BLOCKED phases.

## Breaking Change Policy

Controlled breaking changes were applied during migration.

Implications:

- Core agents now require strict schema-governed outputs.
- Legacy free-form outputs are non-compliant for core workflows.

## Required Artifacts

- `docs/agent-engineering/PART-SPEC.md`
- `docs/agent-engineering/RELIABILITY-GATES.md`
- `schemas/*.schema.json` for each core output contract
- `schemas/core-implementer.execution-report.schema.json`
- `schemas/ui-implementer.execution-report.schema.json`
- `schemas/platform-engineer.execution-report.schema.json`
- `schemas/technical-writer.execution-report.schema.json`
- `schemas/browser-tester.execution-report.schema.json`
- `schemas/orchestrator.delegation-protocol.schema.json`
- `evals/scenarios/*` fixtures for deterministic checks

## Rollout Sequence

1. Land schemas and governance docs.
2. Refactor core agents to P.A.R.T + schema references.
3. Refactor implementation agents to P.A.R.T + schema references.
4. Run scenario checks (schema compliance, abstention, safety gates).
5. Update README architecture and usage guidance.

## Backward Compatibility Strategy

Not guaranteed for core output shape.

Mitigation:

- Keep human-readable summaries in addition to schema objects where possible.
- Document exact schema file per agent.
- Keep status enums stable across agents.

## Quality Gates Before Merge

- Schema files parse as valid JSON.
- Each agent references one primary schema contract.
- Human approval gate is explicit in Orchestrator and CodeReviewer paths.
- Predictability path (`ABSTAIN`) is present in all agents.

## Phase 3: Modernization (Completed, 2026-04-04)

Comprehensive bishx-inspired upgrade across 9 implementation phases.

**New agents (2):**

- `AssumptionVerifier-subagent.agent.md` — mirage detection with 17 patterns, quantitative scoring.
- `ExecutabilityVerifier-subagent.agent.md` — cold-start plan executability simulation.

**New infrastructure:**

- `docs/agent-engineering/SCORING-SPEC.md` — single source of truth for 7-dimension weighted scoring, cross-validated ceilings, and regression tracking.
- `plans/templates/` — externalized plan, phase-completion, plan-completion, and verified-items templates.
- `skills/` — skill library with index and 7 domain pattern files (TDD, error handling, security, performance, completeness, integration, idea-to-prompt).
- `governance/tool-grants.json` — canonical machine-readable tool policy for validator enforcement.
- `governance/runtime-policy.json` — Orchestrator operational knobs (review routing, retry budgets, stagnation thresholds).

**Agent enhancements:**

- Orchestrator: PLAN_REVIEW loop extended to 5 iterations with complexity-adaptive routing, convergence detection, regression tracking, trace_id observability.
- Planner: Complexity Gate (TRIVIAL/SMALL/MEDIUM/LARGE), Skill Selection step, Semantic Risk Discovery Gate.
- PlanAuditor: 7-dimension scoring, focus-area routing, validated blocking findings.
- CodeReviewer: 5-dimension weighted scoring, per-issue validation protocol.

**Eval coverage at that point:** 29 → 35 eval scenarios (Phase 3). Schema count: 13 → 15. Later hardening expanded coverage; use `evals/README.md` and `evals/package.json` for the current suite composition.

Full implementation details: plans/archive/atlas-modernization-plan.md (archived).

## Phase 4: Implementer Rationalization (2026-04-05)

Executor-preserving internal convergence of the implementation trio.

**Decision:** Keep 13-agent roster. Preserve all external executor identities, schema contracts, and tool grants. Internal convergence only.

**Evidence baseline:** Phase 1 research confirmed 6 no-go conditions for external consolidation:

1. Three distinct delegation payloads in `schemas/orchestrator.delegation-protocol.schema.json`.
2. Non-identical tool grants — Core has extra `agent` grant.
3. Different required schema output fields (UI: accessibility/responsive; Platform: health_checks/rollback).
4. Different eval assertions across the three contract fixtures.
5. Different Definition of Done semantics bound to external identity.
6. Executor set in `plans/project-context.md` still routes to three distinct roles.

**Shared Implementation Backbone:**

All three implementer agents follow the same structural rhythm:

1. Read standards → PreFlect risk evaluation → Execute domain work → Verify gates → Emit structured report.
2. Deterministic Contracts: schema-governed output, shared status enum, shared failure classification.
3. Planning vs Acting Split: execute-only, no global replan, targeted clarification routing.
4. Archive: context compaction + NOTES.md updates with scope-specific fields.
5. Non-Negotiable Rules: no out-of-scope files, no fabricated evidence, ABSTAIN on uncertainty.
6. Uncertainty Protocol: `NEEDS_INPUT` with `clarification_request` per `CLARIFICATION-POLICY.md`.

CoreImplementer-subagent is the canonical backbone reference. UIImplementer-subagent and PlatformEngineer-subagent extend it with domain-specific sections:

- **UIImplementer additions:** accessibility gates, responsive checks, design-system compliance, Frontend Best Practices Checklist.
- **PlatformEngineer additions:** approval gates, idempotency mandate, rollback protocol, health checks, environment prerequisites.

**Eval hardening:**

- Added `evals/scenarios/code-reviewer-contract.json` — direct CodeReviewer contract fixture.
- Added `evals/scenarios/code-mapper-contract.json` — direct CodeMapper contract fixture.
- Added `evals/scenarios/implementer-role-differentiation.json` — guards against accidental role collapse.
- Eval count: 37 → 40 (Phase 4). Validator at that point: 161/161 passing.

**Future exit criteria for external consolidation:**

External consolidation (reducing implementer count) is not planned but remains possible if ALL of these conditions are intentionally satisfied in a future migration:

1. Single canonical delegation payload envelope in `schemas/orchestrator.delegation-protocol.schema.json`.
2. Single canonical tool grant profile in `governance/tool-grants.json`.
3. Single or composed execution-report schema covering UI and platform evidence surfaces.
4. Rewritten eval fixtures testing one executor against the full evidence set.
5. Role-specific DoD gates moved from external identity into task metadata.
6. Executor set and role matrix updated in `plans/project-context.md`.
