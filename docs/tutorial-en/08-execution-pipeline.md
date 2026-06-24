# Chapter 08 — Execution + review over native Copilot

## Why this chapter

Understand **what happens after `controlflow-verify` returns `APPROVED`**: native Copilot runs the plan's phases (the executor roles the Planner assigned), and `controlflow-review` gates the result. This chapter covers both halves — execution and the post-execution review — because in the slim model they are both "over native Copilot": native Copilot executes phases; `controlflow-review` layers a thin scope-drift + evidence discipline on top of native Copilot code review.

The headline change: the legacy **Orchestrator-driven wave dispatch is retired**. There is no dispatch state machine, no wave scheduler, no per-phase gate event stream. The plan declares phases with per-phase acceptance criteria; native Copilot executes them; `controlflow-verify` gated before (chapter 07); `controlflow-review` gates after.

## Key Concepts

- **Execution** — native Copilot runs the plan's phases. The `executor_agent` per phase is a **conceptual role label** (chapter 03) native Copilot executes inline; it is not a shipped agent file.
- **Phase** — a plan unit with a fixed `executor_agent`, concrete files, tests, acceptance criteria, quality gates, and failure expectations.
- **Quality gates** — the plan's per-phase acceptance criteria plus the two pipeline gates: `controlflow-verify` (pre-execution) and `controlflow-review` (post-execution). The per-phase gate enum is `tests_pass` / `lint_clean` / `schema_valid` / `safety_clear` / `human_approved_if_required`.
- **`controlflow-review`** — the post-execution gate. A **layer over** native Copilot code review, not a replacement. Adds plan-vs-implementation scope-drift comparison, evidence discipline, and proactive vulnerability/error search.
- **Scope drift** — anything implemented but not planned, or planned but not implemented, is a review finding.
- **Failure classification** — one of `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable`. Recorded in plan lifecycle sections; retry routing and parallelism are native Copilot's job.
- **Mid-execution clarification** — native Copilot surfaces ambiguity to the user directly (its native approvals / ask-questions surface). If the ambiguity changes file scope, user-visible behavior, architecture, or destructive-risk handling, re-invoke `@controlflow-planner` for a targeted replan.
- **Orchestrator (retired)** — the conceptual conductor role. Mentioned here only as history: in the slim model, the Planner + native Copilot cover orchestration. The legacy state machine (`PLANNING` → `WAITING_APPROVAL` → `PLAN_REVIEW` → `ACTING` → `REVIEWING` → `COMPLETE`), dispatch, waves, and batch gates are gone.

## Execution + Review Pipeline

```mermaid
sequenceDiagram
    participant U as User
    participant V as controlflow-verify
    participant N as Native Copilot
    participant R as controlflow-review

    U->>V: /controlflow-verify (plan approved by Planner)
    V-->>U: APPROVED
    U->>N: implement phases (executor_agent roles from plan)
    Note over N: per-phase: run steps → meet acceptance criteria → quality gates
    N-->>U: implementation
    U->>R: /controlflow-review
    R->>R: read plan; delegate mechanical pass to native code review
    R-->>U: findings + verdict (scope drift, vulnerabilities, evidence)
    alt NEEDS_REVISION
        U->>N: fix per findings (native Copilot)
    else clean
        U->>U: ship
    end
    alt mid-execution ambiguity changes scope
        U->>U: re-invoke @controlflow-planner for targeted replan
    end
```

The pipeline has two gates around execution: verify before, review after. Between gates, native Copilot runs the show.

## Execution — Native Copilot Runs the Phases

On `APPROVED`, the user points native Copilot at the plan artifact. Native Copilot runs the phases:

- The `executor_agent` per phase is a **conceptual role label** the Planner assigned (`CoreImplementer-subagent`, `UIImplementer-subagent`, `PlatformEngineer-subagent`, `TechnicalWriter-subagent`, `BrowserTester-subagent`, `CodeMapper-subagent`, `Researcher-subagent`, `CodeReviewer-subagent`). Native Copilot executes the phase inline using the role's discipline — the value-add patterns the Planner injected via `skill_references` (≤3 per phase, from `skills/patterns/`).
- Each phase's `steps` are numbered prose with **no code blocks**. Verification commands must be concrete enough to run as-is (phase 3 of verify checked this).
- Each phase declares `quality_gates` from the enum — these are the per-phase acceptance signals native Copilot must satisfy before the phase is done.
- Each phase declares `acceptance_criteria` — at least one measurable observable outcome. These are what `controlflow-review` later compares the diff against.

Native Copilot owns retry routing, retry budgets, and parallelism. ControlFlow does not ship a dispatch state machine, a wave scheduler, or a retry table — those are retired (the legacy Orchestrator surface). If a phase fails, the failure is classified per the taxonomy below, and native Copilot routes the retry.

### Recreating a Specialized Persona as a Native Copilot Custom Agent

The `executor_agent` names are conceptual labels, not shipped files. If you want a specialized persona back as a shipped agent — e.g. a dedicated `BrowserTester` or `UIImplementer` — recreate it as a **native Copilot custom agent** under `.github/agents/` and have `controlflow-planner` assign it as a phase `executor_agent`. The recipe and worked examples are in `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md §5`. The three verify roles are **not** recreated as agents — they are the inline phases of `controlflow-verify`.

## Quality Gates

"Quality gates" in the slim model means two things together:

1. **The plan's per-phase acceptance criteria + the `quality_gates` enum** — what native Copilot must satisfy to call a phase done. The enum:

| Gate | Meaning |
|------|---------|
| `tests_pass` | All tests in the target scope pass. |
| `lint_clean` | Lint is clean. |
| `schema_valid` | All produced schemas are valid. |
| `safety_clear` | No unresolved safety risk for the phase. |
| `human_approved_if_required` | If approval is required, it has been obtained. |

2. **The two pipeline gates** — `controlflow-verify` (pre-execution, chapter 07) and `controlflow-review` (post-execution, this chapter).

The legacy **Verification Build Gate** — a separate Orchestrator-owned check that re-ran the build after every phase — is retired. Native Copilot verifies per-phase completion itself; `controlflow-review` is the post-execution gate that catches what native review misses.

## Review — `controlflow-review` (post-execution, layered over native)

`/controlflow-review` runs after implementation. It is a **layer over** native Copilot code review, not a replacement. The mechanical / style pass (lint-class issues, formatting, rote pattern checks) belongs to native Copilot code review and `security-review`. ControlFlow adds only what native review does not:

- **Plan comparison** — does the diff match the plan's phases, files, and acceptance criteria? Flag scope drift, missing phases, extra-phased work, and unmet acceptance criteria.
- **Proactive vulnerability / error search** — trace new data flows to their endpoints; check validation at each boundary; look for error paths the implementation skipped (absence mirages A11–A13); check for missing migrations or rollback (A16); check for missing security boundaries on sensitive operations (A17); where the plan declared failure expectations, confirm the implementation handles them.
- **Evidence discipline** — label each finding with severity, confidence, file, line, user impact, and validation method. Distinguish **validated blockers** from **hypotheses**; state validation gaps explicitly.

Findings are presented first, ordered by severity. If there are none, the skill says so and names residual risks or test gaps. Soft labels (`Nit`, `Optional`, `FYI`) come only **after** blocking findings — they are not severity levels and must not hide a correctness, security, or test-coverage defect.

### Review Axes

Prioritize correctness/functionality, security, data integrity, regression risk, and contract drift **before** style. Maintainability / style comments should support a behavioral risk, not bury one — and the mechanical side of style is native Copilot code review's job.

### Change Size Caution

Large reviews lose signal. When a diff is much larger than roughly 100 changed lines or mixes unrelated concerns, `controlflow-review` asks for a split or reviews by file area and risk axis with an explicit confidence limit.

### Review-Specific Failure Checks

- Do not lead with nits before behavior checks.
- Do not mark missing tests as `FYI` when the untested behavior can regress.
- Do not state a blocker without validation evidence or an explicit unconfirmed-risk label.
- Do not duplicate native Copilot code review's mechanical pass — delegate it.
- Do not skip the plan comparison when a plan artifact exists.

## Failure Classification During Execution

Every failure recorded in a plan lifecycle section (`## Progress`, `## Discoveries`, `## Idempotence & Recovery`) receives a `failure_classification`:

| Class | Meaning | Who routes |
|-------|---------|------------|
| `transient` | Flaky test, network timeout, temporary tool unavailability; retry with identical scope | Native Copilot |
| `fixable` | Small correctable issue (typo, missing import, config value); retry with fix hint | Native Copilot |
| `needs_replan` | Architecture mismatch or missing dependency; delegate to the Planner for a targeted replan | Re-invoke `@controlflow-planner` |
| `escalate` | Security vulnerability, data integrity risk, unresolvable blocker; stop and await human approval | Native Copilot stops; user decides |
| `model_unavailable` | The routed/primary model is unavailable or unreachable; retry with a native Copilot model substitution, then escalate on exhaustion | Native Copilot |

Retry routing, retry budgets, and parallelism are native Copilot's job, not ControlFlow's. `needs_replan` is the one class that re-enters the ControlFlow pipeline — it re-invokes the Planner for a targeted replan, then re-runs `controlflow-verify` before execution resumes. See chapter 13 for the full taxonomy.

## Mid-Execution Clarification

Native Copilot handles mid-execution ambiguity. If a phase needs clarification, native Copilot surfaces it to the user directly (its native approvals / ask-questions surface) and continues. There is no `NEEDS_INPUT` routing table — that was an Orchestrator concept.

If the ambiguity changes **file scope, user-visible behavior, architecture, or destructive-risk handling**, the user re-invokes `@controlflow-planner` for a targeted replan rather than resolving it inline. The Planner reads the existing artifact in `plans/`, updates the affected phases, and re-runs `controlflow-verify` before execution resumes.

## Completion

After all phases and `controlflow-review` return clean:

1. Verify all phase acceptance criteria are met (the review already compared the diff to the plan).
2. Append a session-outcome entry to `plans/session-outcomes.md` using `plans/templates/session-outcome-template.md`.
3. Produce a completion summary for the user.

The session-outcome is written **before** the completion summary, so the user sees the summary after telemetry is flushed.

## Commit Conventions

- Prefix from the enum: `fix`, `feat`, `chore`, `test`, `refactor`.
- **Do not** mention plan names or phase numbers in commit messages.

## Why the Orchestrator-Driven Wave Dispatch Was Retired

A brief history, since the question is common. The legacy Orchestrator owned a lifecycle, emitted gate events, dispatched phases in waves, ran a per-phase CodeReviewer, and routed failures per a retry budget. As of February 2026, Copilot does all of this natively: subagent dispatch + parallelism is GA default-on, `/plan` mode is GA, agentic code review is GA, and approvals + custom instructions are GA.

Keeping a ControlFlow dispatch state machine on top of those would duplicate native capabilities — exactly what the slim model forbids (see `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`). So the Orchestrator is retired as a shipped agent. What ControlFlow keeps is what Copilot does not provide natively: the plan _format_, the adversarial _verify_ gate, the tier-gated _policy_, and the scope-drift _review_ layer. Execution itself — running phases, retrying, parallelizing — is native Copilot's job.

## Common Mistakes

- **Looking for the Orchestrator or the wave scheduler.** Both are retired. The plan declares phases; native Copilot executes them.
- **Treating `controlflow-review` as a replacement for native Copilot code review.** It is a **layer over** it. Run native code review (or `security-review`) first for the mechanical pass; `controlflow-review` consumes and augments its output.
- **Skipping `controlflow-review` on SMALL tasks.** SMALL runs review (see the tier table) — only TRIVIAL skips the pipeline.
- **Skipping the plan comparison.** When a plan artifact exists at `plans/<task-slug>-plan.md`, the plan comparison is mandatory — scope drift is a review issue, not a style preference.
- **Leading with nits before behavior checks.** Soft labels (`Nit`, `Optional`, `FYI`) come only after blocking findings.
- **Expecting ControlFlow to retry, parallelize, or route failures.** Those are native Copilot's job. ControlFlow only labels failures (`needs_replan` re-enters the pipeline; the rest are native Copilot's to handle).
- **Inferring `executor_agent` heuristically at execution time.** The Planner declares `executor_agent` per phase in the artifact; native Copilot reads it. If the field is missing from a legacy plan, re-invoke the Planner rather than guessing.

## Exercises

1. **(beginner)** Open `.github/skills/controlflow-review/SKILL.md` and list the three things ControlFlow adds over native Copilot code review.
2. **(beginner)** Open `schemas/planner.plan.schema.json` and find the `quality_gates` enum. List all five values.
3. **(intermediate)** A phase fails with `needs_replan`. Who routes it, and what is the single ControlFlow entry point that re-enters the pipeline? What must re-run before execution resumes?
4. **(intermediate)** A MEDIUM-tier plan has completed implementation. Which gate runs next, and what three things does it add over native Copilot code review?
5. **(advanced)** The diff touches a file not listed in any plan phase's `files` array, and skips a migration the plan's `migration_rollback` risk row flagged. Which two `controlflow-review` findings fire, and which absence mirages (A11–A17) do they correspond to?

## Review Questions

1. What does "execution is native Copilot's job" mean, and which retired ControlFlow surface does it replace?
2. What are "quality gates" in the slim model (two senses)?
3. Name the three things `controlflow-review` adds over native Copilot code review.
4. Which failure class re-enters the ControlFlow pipeline, and how?
5. Why was the Orchestrator-driven wave dispatch retired rather than slimmed?

## See Also

- [Chapter 05 — The plan → verify → review pipeline](05-orchestration.md)
- [Chapter 06 — Planning](06-planning.md)
- [Chapter 07 — Review Pipeline (controlflow-verify)](07-review-pipeline.md)
- [Chapter 13 — Failure Taxonomy](13-failure-taxonomy.md)
- [.github/skills/controlflow-review/SKILL.md](../../.github/skills/controlflow-review/SKILL.md)
- [docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](../agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)