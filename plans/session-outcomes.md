# Session Outcomes Log

Orchestrator appends an entry before the final completion summary of each completed plan execution.
Use this log for pipeline calibration and pattern detection across sessions.
Archive old entries when the log exceeds 50 entries (see `plans/templates/session-outcome-template.md`).

---

<!-- Entries appended below by Orchestrator after each plan completion -->

## Entry

**Plan ID:** `memory-efficiency-improvements-plan`
**Date:** `2026-04-17`
**Complexity Tier:** `MEDIUM`
**Total Phases:** `4 / 4`

### Review Pipeline

| Agent | Result | Notes |
|---|---|---|
| AssumptionVerifier-subagent | COMPLETE | 3 iterations: iter1 1 BLOCKING + 2 MINOR → iter2 1 BLOCKING + 1 MINOR → iter3 0 BLOCKING + 1 MINOR (84%) |
| PlanAuditor-subagent | APPROVED | 3 iterations: 65.6% → 60.8% → 84.5% |
| ExecutabilityVerifier-subagent | N/A | MEDIUM tier — not in scope |
| CodeReviewer-subagent | APPROVED (after 2 fixes) | Wave 1: 1 MAJOR (plan-vs-execution scope mismatch on `.gitignore`) → plan amended, APPROVED at 91%. Phase 4: 1 MAJOR (README badge stale count) → badge fixed, APPROVED at 97% |

**Total review iterations:** `3` / `5`
**Convergence:** `Converged`

### Outcome

**Status:** `SUCCESS`
**CodeReviewer false positive rate:** `0 / 2` (`0%`)

### Lessons Learned

1. When Orchestrator adds scope to a phase at dispatch time (e.g. closing a prior reviewer's MINOR finding with an extra file edit), the plan file must be amended in-place before CodeReviewer runs, not after. Reviewer correctly flagged `.gitignore` as out-of-scope vs the plan text even though the edit itself was correct.
2. Eval count-consistency (Pass 11) is a coupled constraint: any new check requires synchronized bumps across all documents publishing the count (7 files). Plan phase scope must list this coupling explicitly; otherwise executors emit out-of-scope edits that are functionally necessary.
3. Planner `create_file`-only tool surface cannot overwrite an existing plan file. Orchestrator must delete the prior artifact before re-dispatching revision. Consider giving Planner an edit/replace tool to eliminate this friction.
4. Scope creep into `session_telemetry` telemetry surface (iteration 2) was caught only by AssumptionVerifier — demonstrates value of the parallel mirage check on top of PlanAuditor's structural review. Ideation-to-telemetry drift is a known Planner pattern.

---


## Entry

**Plan ID:** `model-routing-stage-c-plan`
**Date:** `2026-04-16`
**Complexity Tier:** `MEDIUM`
**Total Phases:** `7 / 7`

### Review Pipeline

| Agent | Result | Notes |
|---|---|---|
| AssumptionVerifier-subagent | COMPLETE | 2 iterations, 48% → 82%; 0 blocking mirages at final |
| PlanAuditor-subagent | APPROVED | 4 iterations, 26% → 64% → 88% → 95% |
| ExecutabilityVerifier-subagent | N/A | MEDIUM tier — not in scope |
| CodeReviewer-subagent | APPROVED (after fix) | Phase 2 NEEDS_REVISION (1 MAJOR: frontmatter regex scoping) — fixed via nested regex + Test D regression |

**Total review iterations:** `4` / `4`
**Convergence:** `Converged`

### Outcome

**Status:** `SUCCESS`
**CodeReviewer false positive rate:** `0 / 1` (`0%`)

Stage B runtime rollout complete (all 13 agents carry `model_role:` frontmatter). Stage C matrix landed (`by_tier` with 5 divergent + 5 `inherit_from: "default"` roles). Drift-check suite grew 23 → 34 (+4 model_role, +4 matrix-completeness, +3 reference-integrity). Total eval suite 358 → 370, all green. Stage D = forward pointer only.

### Lessons Learned

1. Enabling a previously uncounted drift check (MODEL_ROLE_CHECK_ENABLED false → true) causes an arithmetic surprise: the check contributes a Pass 8 count that was invisible to baseline math. Budget the +1 explicitly in the plan.
2. Frontmatter-scoped regex validation must bound the search to the `---...---` block via a two-step extract (outer `/^---\r?\n([\s\S]*?)\r?\n---\s*$/m`, inner key regex) — single-pass `/^key:/m` is a security-adjacent false positive waiting to happen when file bodies legitimately contain the same token.
3. Iterative PLAN_REVIEW converges in 3–4 rounds for MEDIUM plans when each iteration produces ≥10% score delta; stagnation detection (<5% over 2 iters) correctly didn't trigger here.
4. Doc-consolidation phases (Phase 7) must re-assert every regex-matched sentence the drift checks scan for — removing an older `Eval suite (N checks)` line under an archived section without replacing it under the new section fails Check #5 even when numerics are globally consistent.

---

## Entry

**Plan ID:** `planner-architecture-preserving-remediation-plan.revised`
**Date:** `2026-04-09`
**Complexity Tier:** `MEDIUM`
**Total Phases:** `5 / 5`

### Review Pipeline

| Agent | Result | Notes |
| --- | --- | --- |
| AssumptionVerifier-subagent | COMPLETE | Iteration 1 found one blocking mirage around unenforced eval assertions; iteration 2 verified the revised plan with no blockers |
| PlanAuditor-subagent | APPROVED | Iteration 1 returned NEEDS_REVISION with 3 major issues; iteration 2 approved the revised plan at 97% |
| ExecutabilityVerifier-subagent | N/A | MEDIUM-tier plan review did not route through ExecutabilityVerifier |
| CodeReviewer-subagent | APPROVED | Phase 1 required 1 fixable retry for contract completeness; Phases 2, 3, 4, and 5 approved with no validated blocking issues |

**Total review iterations:** `2` / `5`
**Convergence:** `Converged`

### Outcome

**Status:** `SUCCESS`
**CodeReviewer false positive rate:** `0 / 2` (`0%`)

### Lessons Learned

1. Structural eval assertions only matter if `evals/validate.mjs` actively enforces them; fixture metadata alone is not a regression guard.
2. Keeping Planner and Orchestrator ownership boundaries explicit in both prompts and docs prevents architectural drift while still fixing user-visible behavior.
3. Documentation-only phases still need explicit problems-gate cleanup because markdownlint debt in touched files can block completion.

---

## Entry

**Plan ID:** `subagent-routing-guardrails-plan`
**Date:** `2025-07-18`
**Complexity Tier:** `MEDIUM`
**Total Phases:** `5 / 5`

### Review Pipeline

| Agent | Result | Notes |
| --- | --- | --- |
| AssumptionVerifier-subagent | COMPLETE | Iteration 1 raised 1 blocking mirage (Planner fixture owned Orchestrator-scoped fields); iteration 2 cleared all blocking mirages |
| PlanAuditor-subagent | APPROVED | Iteration 1 returned NEEDS_REVISION with wave sequencing gaps and Steps sections missing; iteration 2 approved |
| ExecutabilityVerifier-subagent | N/A | MEDIUM-tier plan review — ExecutabilityVerifier not in scope |
| CodeReviewer-subagent | APPROVED | All 5 phases required 1–3 review iterations; Phase 3 required 3 iterations for semantic tightening of HIGH-risk override predicate and roster drift detection |

**Total review iterations:** `2` / `5`
**Convergence:** `Converged`

### Outcome

**Status:** `SUCCESS`
**CodeReviewer false positive rate:** `0 / 4` (`0%`)

**Summary:**
Implemented subagent routing guardrails across 5 phases. Replaced `agents: ["*"]` wildcard in `Orchestrator.agent.md` with explicit 12-agent roster and added Scope OUT prohibition bullets to both Orchestrator and Planner. Created `governance/agent-grants.json` as the canonical repo-level allowlist and extended `evals/validate.mjs` with Pass 3d "Agent Grant Consistency" (set-equality drift detection). Added 2 new eval scenarios and 12 new behavioral assertions covering Planner complexity tier classification and Orchestrator HIGH-risk override semantics (predicate: `applicable AND HIGH AND not resolved`). Restructured `plans/project-context.md` with Phase Executor / Review Pipeline split and Entry-Point Delegation Policy. Added delegation constraint to `.github/copilot-instructions.md`. Final state: 170 structural + 38 behavior + 41 orchestration = 249 checks, all passing.

### Lessons Learned

1. Scenario fixtures that model ownership-crossing expectations (e.g., Planner fixture asserting Orchestrator-owned reviewer dispatch) create false contracts — strict ownership boundaries must be enforced in both code and documentation.
2. "Force full pipeline regardless of tier" alone is insufficient as a test predicate; the compound condition `applicable AND HIGH AND not resolved` must be validated with explicit positive and negative scenario inputs.
3. Governance manifests must be read at test runtime for drift detection; recording expected values at creation time allows set drift to go undetected indefinitely.

---

## Entry

**Plan ID:** `review-and-rename-plan.revised`
**Date:** `2025-07-17`
**Complexity Tier:** `LARGE`
**Total Phases:** `6 / 6`

### Review Pipeline

| Agent | Result | Notes |
| --- | --- | --- |
| AssumptionVerifier-subagent | N/A | Plan review skipped — execution was already in Phase 3 from prior session |
| PlanAuditor-subagent | APPROVED | Pre-approved in prior session with full PlanAuditor + AssumptionVerifier + ExecutabilityVerifier pipeline |
| ExecutabilityVerifier-subagent | N/A | Completed in prior session |
| CodeReviewer-subagent | APPROVED | Phase 3: 97/100 (3 iterations). Phase 6: initial report had false positives from transient file duplication; independent verification confirmed 135/135 green |

**Total review iterations:** `4` / `5`
**Convergence:** `Converged`

### Outcome

**Status:** `SUCCESS`
**CodeReviewer false positive rate:** `4 / 4` (`100%`) — Phase 6 findings were all caused by transient untracked file duplication from subagent file reads, not actual migration defects

**Summary:**
Complete 6-phase rename migration of the ControlFlow agent system. 25 files renamed via `git mv` (12 agents, 13 schemas). All 37 eval scenarios, 15 schemas, 13 agent prompts, 8 governance/doc files, 4 templates, 2 skill patterns, and 2 package files updated to canonical names. Residual sweep confirms zero capitalized old names outside 8 exception-class files (historical plans, migration artifacts, allowlist). Validator at 135/135 passing. Only lowercase structural identifiers remain (scenario_id, label, JSON keys, $id URIs, file path references to unchanged scenario filenames) — all intentional and stable.

---

## Entry

**Plan ID:** `orchestration-weak-spots-remediation-plan`
**Date:** `2026-04-14`
**Complexity Tier:** `LARGE`
**Total Phases:** `6 / 6`

### Review Pipeline

| Agent | Result | Notes |
| --- | --- | --- |
| AssumptionVerifier-subagent | COMPLETE | Iteration 1: 2 BLOCKING mirages (ExecutabilityVerifier/AssumptionVerifier as executor_agents; executor_agent fallback audit coverage claim); iteration 2: 0 blocking |
| PlanAuditor-subagent | APPROVED | Iteration 1: NEEDS_REVISION (executor_agent gaps, TRIVIAL tier confusion); iteration 2: APPROVED at 89% |
| ExecutabilityVerifier-subagent | PASS | Iteration 1: WARN (2 tasks needed specificity); iteration 2: PASS after Planner revision |
| CodeReviewer-subagent | APPROVED | All 6 phases approved. Phase 6 required 2 iterations: Round 1 NEEDS_REVISION for F5 overstatement and markdown lint; Round 2 APPROVED at 96% |

**Total review iterations:** `2` / `5`
**Convergence:** `Converged`

### Outcome

**Status:** `SUCCESS`
**CodeReviewer false positive rate:** `0 / 2` (`0%`)

**Summary:**
Full 6-phase LARGE-tier remediation of 14 orchestration weak spots identified in a Phase 1 baseline audit. Phase 2 fixed the TRIVIAL `risk_review` shortcut and `complexity_tier` schema enforcement (261→283 tests). Phase 3 hardened 7 executor/reviewer schemas with machine-enforced `if/then` conditional blocks for `failure_classification` and `clarification_request`. Phase 4 expanded the eval harness (178+56+49 = 283 checks; +44 tests from baseline). Phase 5 normalized operator docs (README, NOTES, RELIABILITY-GATES, PART-SPEC). Phase 6 produced the closure audit mapping all 16 criteria to final disposition: 12 CLOSED, 2 ACCEPTED_RESIDUAL (C5/C7 — executability-verifier `if/then` parity not included in Phase 3 scope), 2 CONFIRMED HEALTHY. Final test count: 283/283.

### Lessons Learned

1. Schema `if/then` enforcement scope must be explicitly listed per-schema in the plan — implicit "all schemas" wording causes auditors to assume executability-verifier is covered when it was intentionally excluded.
2. When a phase hardening operation has a deliberate scope boundary (7 of 8 schemas), document the excluded item and its rationale in the plan to prevent ACCEPTED_RESIDUAL being misclassified as CLOSED in the closure audit.
3. Final audit documents (phase 6 patterns) should include a `<!-- markdownlint-disable -->` pragma from creation when the artifact contains fenced code blocks and tables — prevents a predictable round of lint debt in CodeReviewer.

---

## Entry

**Plan ID:** `controlflow-comprehensive-revision-plan`  
**Date:** 2026-04-16  
**Complexity Tier:** LARGE  
**Total Phases:** 10 / 10 (Phase 4 completed in degraded logical-index-only mode per documented `needs_replan` mitigation)

### Review Pipeline

| Agent | Result | Notes |
|---|---|---|
| AssumptionVerifier-subagent | COMPLETE | Mirages found: 0 (iter 2; 98.8% confidence) |
| PlanAuditor-subagent | APPROVED | Final score: ~97% after document-truncation fix |
| ExecutabilityVerifier-subagent | WARN -> PASS | 4 ambiguities patched before dispatch (actor/gate/parser/DAG) |
| CodeReviewer-subagent | APPROVED | Validated blocking issues: 0 (Phase 3 reviewed; downstream phases verified via build + eval harness) |

**Total review iterations:** 2 / 5  
**Convergence:** Converged

### Outcome

**Status:** SUCCESS  
**CodeReviewer false positive rate:** 0 / 1 (0%) — only one MINOR finding (PROMPT-BEHAVIOR-CONTRACT stale count), folded into Phase 10

### Lessons Learned

1. VS Code-reload smoke tests cannot be performed autonomously; plans with interactive spikes must declare a documented degraded-mode fallback (logical-index-only) so execution can proceed without user interaction.
2. Pre-creating a shared anchor-map artifact is a valid Orchestrator-level coordination action when two plans contend for the same edit surface and only one is active; the anchor-map acts as a forward-contract for the future plan.
3. `validate.mjs` cache at `evals/.cache/` must be cleared (`Remove-Item .cache -Recurse`) to see fresh `Total:` output; the cached-run path prints only `All checks passed (cached)`.
4. When migrating large doc-surface checks, update the `CHECK_COUNT_SOURCES` equality-literals LAST so the equality drift-check does not flap mid-refactor.
