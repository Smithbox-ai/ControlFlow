# Prompt Behavior Contract

Complements P.A.R.T (structural) with behavioral invariants that all ControlFlow agents must preserve. The behavioral regression tests in `evals/tests/` verify these rules against the agent source files.

## Scope

P.A.R.T governs section order and structural completeness. This contract governs behavioral consistency: what agents must do, not where they write it.

## Behavioral Invariants

### 1. Evidence-Backed Completion

Every agent claim, finding, or recommendation must cite evidence.

| Agent role | Evidence standard |
| --- | --- |
| Planner | Confidence ≥ 0.9 required for plan delivery; below threshold → `ABSTAIN` or `REPLAN_REQUIRED` |
| Researcher | Every claim requires `file` + `line_start` evidence; no claim without file/line reference |
| CodeMapper | No speculative claims without references; ABSTAIN on contradictory or insufficient results |
| PlanAuditor | Findings reference plan sections or codebase files; severity justified by evidence |
| CodeReviewer | Issues include file path, line number, and validation status (`confirmed`/`rejected`/`unvalidated`) |
| AssumptionVerifier | Mirages cite specific plan text that conflates assumption with fact |

### 2. Follow-Through Discipline

Agents complete their contracted workflow without skipping gates.

| Rule | Enforcement |
| --- | --- |
| Planner outputs artifact before chat | `Do not produce any chat output until the file is saved` — tested in behavior contract |
| Planner gate sequence | Idea Interview → Clarification → Semantic Risk → Complexity — ordering tested |
| Orchestrator review reruns | Closed-world invalidation: only reviewer-local summary wording or evidence-citation text may rerun selectively; sensitive or ambiguous changes fall back to full rerun, and ExecutabilityVerifier stays in scope whenever the current tier or override requires it |
| Orchestrator todo lifecycle | No phase transition while the completed phase's todo item remains unmarked |
| Orchestrator phase verification | 5-point checklist: tests, build, lint, review APPROVED, todo marked |
| Researcher convergence | Stop when ≥ 3 of 4 criteria met (coverage, convergence, completeness, diminishing returns) |

### 3. Scoped Override Semantics

Agent-specific rules override shared policy only when explicitly declared.

| Scope | Behavior |
| --- | --- |
| Shared policy (`.github/copilot-instructions.md`) | Applies to ALL agents unless an agent declares a deviation |
| Agent-specific deviation | Must state explicitly what differs and why (e.g., PlanAuditor excludes `transient` from failure classification) |
| No silent override | Removing or weakening a shared rule in an agent file without a documented deviation note is a compliance violation |

### 4. ABSTAIN and Escalation Discipline

Agents must use bounded status enums and escalate rather than guess.

| Agent | ABSTAIN conditions |
| --- | --- |
| Planner | Required files inaccessible, clarification attempted but unresolved, evidence insufficient for stable decomposition |
| Researcher | Evidence insufficient for reliable conclusions → `ABSTAIN` with reasons |
| CodeMapper | Results contradictory or coverage insufficient → `ABSTAIN` with reasons |
| Orchestrator | 3 failures with same classification → escalate to user regardless of individual classification |

### 5. Handoff Artifact Contract

Before handing off to the next agent or phase, the producing agent must generate a durable artifact.

| Transition | Required artifact |
| --- | --- |
| Planner → Orchestrator | Markdown plan file at `plan_path` (even for `ABSTAIN` and `REPLAN_REQUIRED`) |
| Orchestrator → subagent | Delegation payload with `trace_id`, `task_id`, `plan_path` |
| Researcher → caller | Research findings with evidence array and status enum |
| CodeReviewer → Orchestrator | Verdict with `validated_blocking_issues` array |

### 6. Output Hygiene

| Rule | Rationale |
| --- | --- |
| No raw JSON in chat | Wastes context tokens; use structured text |
| No inline plan bodies in chat messages | Chat is for concise handoff messages; plan content lives in the artifact file |
| Structured text only | All agent outputs use structured text format |

### 7. Memory Use Discipline

1. **Verify before use** — any named file or named function claim that originates from memory (session notes, `/memories/repo/`, or `NOTES.md`) must be re-verified against the current codebase before being acted on or reported to the user. Stale memory is not a reliable source for specific code locations.
2. **Ignore memory on request** — when the user explicitly says "ignore memory" (or equivalent: "don't use memory", "fresh context"), the agent must not consult `/memories/repo/`, NOTES.md, or session notes for that turn. This override applies per-turn and does not persist.

## Regression Coverage

These behavioral invariants are verified by:

- `evals/tests/prompt-behavior-contract.test.mjs` — 74 checks across Planner, Researcher, CodeMapper, CoreImplementer (failure_classification), CodeReviewer (validated_blocking_issues), TechnicalWriter (doc-only scope), AssumptionVerifier (COMPLETE/ABSTAIN), PlanAuditor (executability_checklist), Memory Use Discipline invariants, and shared policy
- `evals/tests/orchestration-handoff-contract.test.mjs` — 49 checks on Orchestrator PLAN_REVIEW gating, rerun invalidation, delegation routing, failure handling, phase verification, todo lifecycle, and observability

## Relationship to Other Specs

| Spec | Governs |
| --- | --- |
| `PART-SPEC.md` | Section order and structural completeness |
| `PROMPT-BEHAVIOR-CONTRACT.md` (this) | Behavioral consistency and invariant preservation |
| `RELIABILITY-GATES.md` | Build/test/lint verification gates |
| `SCORING-SPEC.md` | Quantitative scoring dimensions and ceilings |
| `CLARIFICATION-POLICY.md` | When to ask questions vs. return NEEDS_INPUT |
