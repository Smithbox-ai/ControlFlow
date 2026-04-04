# Core-first Migration Guide

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
- `BrowserTester-subagent.agent.md` — E2E browser testing, accessibility audits.

Cross-cutting enhancements:
- Failure taxonomy (`transient`, `fixable`, `needs_replan`, `escalate`) added to all agents.
- Wave-aware parallel execution added to Orchestrator.
- Inter-phase contracts and failure expectations added to Planner plan template.
- External delegation protocol schema (`schemas/orchestrator.delegation-protocol.schema.json`) added to reduce Orchestrator context bloat.
- Batch approval mechanism added to Orchestrator (one approval per wave).

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
- `skills/` — skill library with index and 4 domain pattern files (TDD, error handling, security, performance).
- `governance/tool-grants.json` — canonical machine-readable tool policy for validator enforcement.
- `governance/runtime-policy.json` — Orchestrator operational knobs (review routing, retry budgets, stagnation thresholds).

**Agent enhancements:**
- Orchestrator: PLAN_REVIEW loop extended to 5 iterations with complexity-adaptive routing, convergence detection, regression tracking, trace_id observability.
- Planner: Complexity Gate (TRIVIAL/SMALL/MEDIUM/LARGE), Skill Selection step, Semantic Risk Discovery Gate.
- PlanAuditor: 7-dimension scoring, focus-area routing, validated blocking findings.
- CodeReviewer: 5-dimension weighted scoring, per-issue validation protocol.

**Eval coverage:** 29 → 35 eval scenarios. Schema count: 13 → 15.

Full implementation details: `plans/atlas-modernization-plan.md`.
