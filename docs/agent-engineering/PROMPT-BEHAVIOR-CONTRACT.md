# Prompt Behavior Contract

Behavioral invariants for ControlFlow's slim Copilot-first surface: the `@controlflow-planner` agent and the three skills (`controlflow-plan`, `controlflow-verify`, `controlflow-review`) running over native Copilot. The contract governs what the Planner and the skills must do, not where they write it. The behavioral regression tests in `evals/tests/` verify these rules against the shipped agent prompt and skill sources.

## Scope

This contract applies to the `@controlflow-planner` agent and the three ControlFlow skills. The conceptual executor roles (`CodeMapper-subagent`, `Researcher-subagent`, `CoreImplementer-subagent`, `UIImplementer-subagent`, `PlatformEngineer-subagent`, `TechnicalWriter-subagent`, `BrowserTester-subagent`, `CodeReviewer-subagent`) and the three inline verify roles (`PlanAuditor-subagent`, `AssumptionVerifier-subagent`, `ExecutabilityVerifier-subagent`) are labels the Planner assigns in plan phases and native Copilot executes inline — they are not shipped agent files, and native Copilot owns their execution discipline. Mid-execution clarification, retry routing, and parallelism are native Copilot's job; the Planner can be re-invoked for a replan.

## Ownership of Shared Behavioral Invariants

To avoid drift and context bloat, prompt authors must follow these ownership rules when updating the planner agent or the skills:

1. **Point at shared canon:** Reference authoritative documents (e.g., `plans/project-context.md`, `governance/runtime-policy.json`) instead of restating large matrices in the planner prompt or skill bodies.
2. **Reference, don't restate:** For exact values like tier routing and review pipeline sequences, refer to the authoritative file rather than hardcoding numbers.
3. **Inline only unique rules:** The planner prompt or a skill may only inline behavioral rules that it uniquely owns or strict overrides explicitly deviating from shared policy.

## Behavioral Invariants

### 1. Evidence-Backed Completion

Every Planner claim, finding, or recommendation must cite evidence. The same standard applies to the verify and review skills.

| Role | Evidence standard |
| --- | --- |
| Planner | Confidence ≥ 0.9 required for plan delivery; below threshold → `ABSTAIN` or `REPLAN_REQUIRED` |
| Researcher (conceptual) | Every claim requires `file` + `line_start` evidence; no claim without file/line reference |
| CodeMapper (conceptual) | No speculative claims without references; `ABSTAIN` on contradictory or insufficient results |
| PlanAuditor (inline verify phase 1) | Findings reference plan sections or codebase files; severity justified by evidence |
| CodeReviewer (conceptual / `controlflow-review`) | Issues include file path, line number, and validation status (`confirmed`/`rejected`/`unvalidated`) |
| AssumptionVerifier (inline verify phase 2) | Mirages cite specific plan text that conflates assumption with fact |

### 2. Follow-Through Discipline

The Planner and the skills complete their contracted workflow without skipping gates.

| Rule | Enforcement |
| --- | --- |
| Planner outputs artifact before chat | `Do not produce any chat output until the file is saved` — tested in the behavior contract |
| Planner gate sequence | Idea Interview → Clarification → Semantic Risk → Complexity — ordering tested |
| Verify verdict lifecycle | A `NEEDS_REVISION` verdict is re-audited after fix; sensitive or ambiguous changes trigger a full re-audit, and the ExecutabilityVerifier phase stays in scope whenever the current tier or override requires it |
| Phase acceptance checklist | 5-point checklist: tests, build, lint, review APPROVED, phase deliverable recorded |
| Researcher convergence | Stop when ≥ 3 of 4 criteria met (coverage, convergence, completeness, diminishing returns) |

### 3. Scoped Override Semantics

Skill-specific rules override shared policy only when explicitly declared.

| Scope | Behavior |
| --- | --- |
| Shared policy (`.github/copilot-instructions.md`) | Applies to the Planner and all three skills unless a skill declares a deviation |
| Skill-specific deviation | Must state explicitly what differs and why (e.g., the verify skill's PlanAuditor and AssumptionVerifier phases exclude `transient`; the ExecutabilityVerifier phase can use all five current failure classifications) |
| No silent override | Removing or weakening a shared rule in the planner prompt or a skill without a documented deviation note is a compliance violation |

### 4. ABSTAIN and Escalation Discipline

The Planner and the skills use bounded status enums and escalate rather than guess.

| Role | ABSTAIN conditions |
| --- | --- |
| Planner | Required files inaccessible, clarification attempted but unresolved, evidence insufficient for stable decomposition |
| Researcher (conceptual) | Evidence insufficient for reliable conclusions → `ABSTAIN` with reasons |
| CodeMapper (conceptual) | Results contradictory or coverage insufficient → `ABSTAIN` with reasons |
| Verify skill | 3 failures with same classification → escalate to user regardless of individual classification |

If the PlanAuditor or AssumptionVerifier phase returns `ABSTAIN` during a required verify run, the verify skill retries once and escalates to the user if evidence is still unavailable. Optional abstentions may be logged and allowed to proceed according to the tier-gated policy.

### 5. Handoff Artifact Contract

Before handing off to the next stage, the producing context must generate a durable artifact.

| Transition | Required artifact |
| --- | --- |
| Planner → verify | Markdown plan file at `plan_path` (even for `ABSTAIN` and `REPLAN_REQUIRED`) |
| Planner → native Copilot execution | Plan artifact with `executor_agent` declared per phase; native Copilot owns the delegation payload |
| Verify → review (or next verify phase) | Verdict record with findings array and status enum |
| Researcher (conceptual) → caller | Research findings with evidence array and status enum |
| CodeReviewer (conceptual / `controlflow-review`) → user | Verdict with `validated_blocking_issues` array |

### 6. Output Hygiene

| Rule | Rationale |
| --- | --- |
| No raw JSON in chat | Wastes context tokens; use structured text |
| No inline plan bodies in chat messages | Chat is for concise handoff messages; plan content lives in the artifact file |
| Structured text only | All Planner and skill outputs use structured text format |

### 7. Memory Use Discipline

1. **Verify before use** — any named file or named function claim that originates from memory (session notes, `/memories/repo/`, or `NOTES.md`) must be re-verified against the current codebase before being acted on or reported to the user. Stale memory is not a reliable source for specific code locations.
2. **Ignore memory on request** — when the user explicitly says "ignore memory" (or equivalent: "don't use memory", "fresh context"), the agent must not consult `/memories/repo/`, `NOTES.md`, or session notes for that turn. This override applies per-turn and does not persist.

## Regression Coverage

These behavioral invariants are verified by offline eval harnesses:

- `evals/tests/prompt-behavior-contract.test.mjs` — prompt-level invariants for the planner agent and the three skills against shared policy.
- `evals/tests/drift-detection.test.mjs`, `evals/tests/notes-md-drift.test.mjs`, `evals/tests/archive-script.test.mjs`, and `evals/tests/fingerprint.test.mjs` — drift helper, memory-note, archive, and structural fingerprint regression coverage.

The retired orchestration-handoff contract test (which asserted an Orchestrator dispatch state machine, wave execution, and inter-agent delegation payloads) was removed in Phase 2 together with the Orchestrator surface; the plan→verify→review pipeline is now covered by the prompt-behavior-contract and drift-detection suites.

## Relationship to Other Specs

| Spec | Governs |
| --- | --- |
| `PROMPT-BEHAVIOR-CONTRACT.md` (this) | Behavioral consistency and invariant preservation for the Planner and the three skills |
| [NATIVE-DELEGATION-BOUNDARY.md](NATIVE-DELEGATION-BOUNDARY.md) | What native Copilot owns vs. what ControlFlow keeps |
| [CLARIFICATION-POLICY.md](CLARIFICATION-POLICY.md) | When to ask questions vs. return NEEDS_INPUT |
| [SCORING-SPEC.md](SCORING-SPEC.md) | Quantitative scoring dimensions and ceilings |
| [MEMORY-ARCHITECTURE.md](MEMORY-ARCHITECTURE.md) | Three-layer memory model referenced by the `Memory Use Discipline` above |