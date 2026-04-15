# Plan Document Template

Plans must follow this structure at `<plan-directory>/<task-name>-plan.md`.

## Plan: {Task Title}

**Status:** `READY_FOR_EXECUTION` | `ABSTAIN` | `REPLAN_REQUIRED`
**Agent:** Planner
**schema_version:** 1.2.0
**Complexity Tier:** `TRIVIAL` | `SMALL` | `MEDIUM` | `LARGE`
**Confidence:** 0.0–1.0 (e.g. `0.95`; values below 0.9 trigger PlanAuditor escalation)
**Abstain:** `is_abstaining: false` — set `true` with reasons array if Planner cannot produce a safe plan
**Summary:** High-level description of the task and approach.

### Context & Analysis

- Current state of relevant code/systems.
- Key constraints and requirements.
- Architecture decisions and rationale.

### Design Decisions

Mandatory for all plans. Record explicit answers to each dimension before phase decomposition.

#### Architectural Choices

- Key architecture decisions and rationale for this task.

#### Boundary & Integration Points

- System boundary changes, new actors, or modified integration points.
- If no boundary changes: "No boundary changes identified."

#### Temporal Flow

- Execution order, parallel paths, approval gates, review loops, retries, or conditional branches.
- For MEDIUM/LARGE plans, reference or embed a Mermaid `sequenceDiagram` here.

#### Constraints & Trade-offs

- Design constraints that apply to this task.
- Trade-offs considered and decisions made.

### Implementation Phases

#### Phase 1 — {Phase Title}

- **Objective:** What this phase accomplishes.
- **Executor Agent:** Primary subagent Orchestrator must dispatch for this phase. Required in the JSON plan and must match the supported executor set in `plans/project-context.md`.
- **Wave:** Execution wave number (phases in the same wave run in parallel).
- **Dependencies:** Prerequisites (files, decisions, prior phases by ID).
- **Files:** Files to create/modify.
- **Tests:** Tests to add or update.
- **Acceptance Criteria:** Measurable conditions that define successful completion of this phase (required by schema; minimum one entry).
  - Example: The target behavior is observable via automated test X.
- **Quality Gates:** Gates that must pass before this phase is considered done. Select from: `tests_pass`, `lint_clean`, `schema_valid`, `safety_clear`, `human_approved_if_required`.
- **Failure Expectations:** Likely failure modes with classification (transient/fixable/needs_replan/escalate) and mitigation.
- **Steps:**
  1. Step description in prose (no code blocks in plan).
  2. ...

#### Phase 2 — {Phase Title}

- **Objective:** What this phase accomplishes.
- **Executor Agent:** Primary subagent.
- **Wave:** Execution wave number.
- **Dependencies:** Prerequisites.
- **Files:** Files to create/modify.
- **Tests:** Tests to add or update.
- **Acceptance Criteria:** Measurable conditions for successful phase completion (required by schema).
  - Example: All targeted tests pass and build is green.
- **Quality Gates:** Select from: `tests_pass`, `lint_clean`, `schema_valid`, `safety_clear`, `human_approved_if_required`.
- **Failure Expectations:** Likely failure modes with classification and mitigation.
- **Steps:**
  1. ...
...

### Inter-Phase Contracts

Define data and interface contracts between phases that have dependencies:

- **From Phase → To Phase:** Description of interface/data contract.
- **Format:** Expected output format from the upstream phase.
- **Validation:** How the downstream phase verifies the contract is met.

### Open Questions

- Items requiring clarification before or during execution.

### Risks

- Identified risks with mitigation strategies.

### Semantic Risk Review

Mandatory checklist — evaluate every category. Non-applicable entries must still appear with `applicability: not_applicable`.

| Category | Applicability | Impact | Evidence Source | Disposition |
| --- | --- | --- | --- | --- |
| data_volume | applicable / not_applicable / uncertain | HIGH/MEDIUM/LOW/UNKNOWN | file or query | resolved / open_question / research_phase_added / not_applicable |
| performance | ... | ... | ... | ... |
| concurrency | ... | ... | ... | ... |
| access_control | ... | ... | ... | ... |
| migration_rollback | ... | ... | ... | ... |
| dependency | ... | ... | ... | ... |
| operability | ... | ... | ... | ... |

### Success Criteria

- Measurable criteria for plan completion.

### Handoff

Required for `READY_FOR_EXECUTION` plans. Maps to the top-level `handoff` field in `schemas/planner.plan.schema.json`.

- **Target Agent:** The agent receiving the plan for review and execution (typically `Orchestrator`).
- **Prompt:** Concise handoff prompt pointing to the saved plan artifact path and requesting execution start. Do NOT inline the plan content here.

Example:

```yaml
target_agent: Orchestrator
prompt: "Plan saved at plans/my-task-plan.md. Please begin PLAN_REVIEW and dispatch Phase 1 when ready."
```

### Notes for Orchestrator

- Recommended execution order and parallelization opportunities.
- Wave assignments and dependency graph.
- `executor_agent` is the authoritative per-phase routing field. Optional delegation notes may name supporting agents, but must not conflict with the declared primary executor.
- Max parallel agents recommendation (default: 10, reduce if resource-intensive phases).
- Failure expectations summary per wave.

### Architecture Visualization (Mandatory for 3+ phase plans)

**Tier-gated rules (mandatory):**

- **Baseline:** Plans with 3+ phases MUST include a phase dependency DAG in Mermaid format (`flowchart TD`).
- **MEDIUM:** Plans with MEDIUM complexity that involve non-trivial orchestration flow (review loops, parallel waves, approval gates) MUST also include a Mermaid `sequenceDiagram`.
- **LARGE:** Plans with LARGE complexity MUST always include a Mermaid `sequenceDiagram` in addition to the DAG.

Allowed diagram types:

- `flowchart TD` — Phase dependency DAG showing execution order and wave grouping.
- `sequenceDiagram` — Temporal flow: inter-agent delegation, approval gates, review loops, parallel dispatch.
- `stateDiagram-v2` — State machine visualization for complex branching or lifecycle logic.

When no explicit Architecture Visualization section is used, the DAG appears inline with the phases. Place the Mermaid diagram block directly beneath the relevant phase or in the `#### Temporal Flow` subsection of Design Decisions.

Keep diagrams compact. Each diagram should fit within 30 lines of Mermaid source.

## Rules

- NO code blocks inside the plan — describe changes in prose.
- NO manual testing steps — all verification must be automatable.
- Each phase must be incremental and self-contained with TDD approach.
- Phase count: 3–10 (decompose further if >10 phases needed).

## Terminal Non-Ready Outcome Artifact

Use this structure ONLY when `status` is `ABSTAIN` or `REPLAN_REQUIRED`. Do NOT apply to `READY_FOR_EXECUTION` plans — use the Phase structure above instead.

### Plan: {Task Title} — [ABSTAIN | REPLAN REQUIRED]

**Status:** ABSTAIN | REPLAN_REQUIRED
**Summary:** One sentence on what was attempted and why the plan cannot proceed to execution.

### Resolved Scope

- Aspects of the task that were definitively understood before the blocker was reached.

### Blockers / Invalidated Assumptions

List each blocker with evidence: inaccessible file, changed dependency, unresolvable ambiguity, reversed architectural decision.

### Missing Evidence

Specific information needed to unblock (for ABSTAIN) or to produce a valid decomposition (for REPLAN_REQUIRED).

### Recovery Next Step

The single highest-value next action: load a specific file, clarify a specific question, or identify the replacement dependency.

### Semantic Risk Items (Partial)

Evaluate as many of the 7 risk categories as available evidence supports. Categories that cannot be assessed yet use `applicability: uncertain`.
