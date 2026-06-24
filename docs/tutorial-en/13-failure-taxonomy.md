# Chapter 13 — Failure Taxonomy

## Why this chapter

Understand **how ControlFlow labels failures** so that errors resolve efficiently: retrying when retrying helps, escalating when escalating is needed, re-invoking the Planner when the plan itself is the problem — without getting into an infinite loop.

The headline reframe for readers of the legacy tutorial: the five failure classes still label failures in plan lifecycle sections, but **retry routing, retry budgets, and parallelism are now native Copilot's job, not an Orchestrator dispatch table**. There is no `Orchestrator.agent.md` in the slim model. The Planner or native Copilot retries per class; `needs_replan` is the one class that re-enters the ControlFlow pipeline — it re-invokes `@controlflow-planner` for a targeted replan.

## Key Concepts

- **`failure_classification`** — a mandatory field in every failure record written to a plan lifecycle section (`## Progress`, `## Discoveries`, `## Idempotence & Recovery`) when status is `FAILED`, `NEEDS_REVISION`, `NEEDS_INPUT`, or `REJECTED`.
- **Failure class** — one of `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable`. Five classes, no others.
- **Routing** — who acts on the classification. In the slim model, routing is native Copilot's job for four of the five classes; `needs_replan` re-enters the ControlFlow pipeline by re-invoking the Planner.
- **Re-enter the pipeline** — the single ControlFlow entry point for a failure: `needs_replan` re-invokes `@controlflow-planner` for a targeted replan, then `controlflow-verify` gates the revised plan before execution resumes.
- **NEEDS_INPUT** — a separate path, independent of `failure_classification`; handled by native Copilot's clarification surface (see chapter 05).

## When `failure_classification` Is Required

If a status is one of the following, `failure_classification` is **required** on the lifecycle record:
- `FAILED`
- `NEEDS_REVISION`
- `NEEDS_INPUT`
- `REJECTED`

**Exception:** the inline verify roles (`PlanAuditor-subagent`, `AssumptionVerifier-subagent`, `ExecutabilityVerifier-subagent`) **exclude `transient`** — their failures are structural and non-transient by nature.

## The 5 Classification Classes

| Class | Meaning | Example |
|-------|---------|---------|
| `transient` | Temporary tool error; retry with identical scope | Network timeout, rate limit (HTTP 429), flaky test |
| `fixable` | Small correctable error; retry with a fix hint | Missing import, typo in config |
| `needs_replan` | Architecture mismatch or missing dependency; delegate to the Planner for a targeted replan | Dependency doesn't exist, API incompatibility |
| `escalate` | Security risk or unresolvable blocker; stop and await human approval | Data loss risk, security vulnerability |
| `model_unavailable` | The routed/primary model is unavailable or unreachable; retry with a native Copilot model substitution, then escalate on exhaustion | Provider outage, model deprecation |

The five classes mirror the failure-classification enum in `.github/copilot-instructions.md` and `governance/runtime-policy.json`.

## Routing Flowchart

```mermaid
flowchart TD
    Fail[Failure recorded in lifecycle section] --> Class{failure_classification?}
    Class -->|transient| TR[Native Copilot: retry identical scope]
    Class -->|fixable| FX[Native Copilot: retry with fix hint]
    Class -->|needs_replan| NR[Re-invoke "@controlflow-planner" for targeted replan]
    Class -->|escalate| ES[STOP → await human approval]
    Class -->|model_unavailable| MU[Native Copilot: retry with model substitution, then escalate on exhaustion]
    NR --> V["controlflow-verify gates the revised plan"]
    V -->|APPROVED| Resume[Resume execution]
    V -->|NEEDS_REVISION/REJECTED| NR
```

## Routing Table

| Class | Who routes | Action |
|----------------|-----------|--------|
| `transient` | Native Copilot | Retry the same phase with identical scope |
| `fixable` | Native Copilot | Retry the same phase with a `fix_hint` in context |
| `needs_replan` | Re-invoke `@controlflow-planner` | Delegate to the Planner for a targeted phase replan; `controlflow-verify` gates the revised plan before execution resumes |
| `escalate` | Native Copilot stops; user decides | STOP; present the blocker to the user and await human approval |
| `model_unavailable` | Native Copilot | Retry with a native Copilot model substitution, then escalate on exhaustion |

Retry budgets, retry-attempt counters, and parallelism are native Copilot's job, not ControlFlow's. ControlFlow only labels the failure; `needs_replan` is the single class that re-enters the ControlFlow pipeline.

## Why Routing Is Native Copilot's Job

The legacy Orchestrator owned a retry budget table, per-wave throttling, exponential backoff signaling, and a dispatch state machine that routed failures per class. As of February 2026, Copilot does subagent dispatch + parallelism natively (GA default-on), approvals natively, and model selection natively. Keeping a ControlFlow dispatch state machine on top of those would duplicate native capabilities — exactly what the slim model forbids. So the Orchestrator is retired as a shipped agent (see chapter 05); retry routing and parallelism are native Copilot's job.

What ControlFlow keeps is the **label** (the five-class taxonomy) and the **single re-entry point** (`needs_replan` re-invokes the Planner, and `controlflow-verify` re-gates the revised plan). Everything else is delegated.

## Who Returns What

| Conceptual role | Possible classifications |
|-----------------|------------------------|
| CoreImplementer-subagent | `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable` |
| UIImplementer-subagent | `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable` |
| PlatformEngineer-subagent | `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable` |
| TechnicalWriter-subagent | `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable` |
| BrowserTester-subagent | `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable` |
| PlanAuditor-subagent | `fixable`, `needs_replan`, `escalate` (NO `transient`, NO `model_unavailable`) |
| AssumptionVerifier-subagent | `fixable`, `needs_replan`, `escalate` (NO `transient`, NO `model_unavailable`) |
| ExecutabilityVerifier-subagent | `fixable`, `needs_replan`, `escalate` (NO `transient`, NO `model_unavailable`) |
| `@controlflow-planner` | `needs_replan`, `escalate` |

These are conceptual roles (see chapter 03), executed inline by native Copilot. The inline verify roles exclude `transient` and `model_unavailable` because their failures are structural — a model outage does not make a plan structurally valid.

## NEEDS_INPUT — Separate Path

`NEEDS_INPUT` is a distinct routing path, **independent of** `failure_classification`. When a phase returns `status: "NEEDS_INPUT"` with a `clarification_request`, native Copilot surfaces it to the user directly (its native approvals/ask-questions surface) and continues. There is no ControlFlow routing table for NEEDS_INPUT — that was an Orchestrator concept.

If the clarification changes file scope, user-visible behavior, architecture, or destructive-risk handling, the user re-invokes `@controlflow-planner` for a targeted replan rather than resolving it inline (see chapter 05).

The `clarification_request` format (see `schemas/clarification-request.schema.json`):
- `question`
- `options[]` — each with `label`, `pros`, `cons`, `affected_files`, `recommended`
- `recommendation_rationale`
- `impact_analysis`

## End-to-End Scenario Walkthrough

**Scenario:** Phase 3 fails during execution.

1. Executor returns `status: FAILED`, `failure_classification: transient`. → Native Copilot retries (retry 1).
2. Same failure. → Native Copilot retries (retry 2).
3. Same failure again. → Native Copilot's retry budget exhausted; the failure is reclassified or escalated. If the user judges it a network issue, the user instructs native Copilot to retry after waiting.
4. Executor returns `COMPLETE`. Phase proceeds.

**Scenario:** Phase 3 fails with `needs_replan`.

1. Executor returns `status: FAILED`, `failure_classification: needs_replan`. → The user re-invokes `@controlflow-planner` with the failure record.
2. Planner reads the existing artifact in `plans/`, updates the affected phases, and re-runs `controlflow-verify`.
3. `controlflow-verify` returns `APPROVED`. Execution resumes on the revised plan.

## Output Requirements

When recording a `failure_classification` in a plan lifecycle section, include:
- `failure_classification` (string)
- `failure_reason` (description for routing)
- `fix_hint` (for `fixable` — what exactly to fix)
- `escalation_details` (for `escalate` — why human intervention is needed)

These fields are defined in the respective execution-report schemas in `schemas/`.

## Common Mistakes

- **Treating NEEDS_INPUT as a `failure_classification`.** No — it's a separate path handled by native Copilot's clarification surface.
- **Continuing after an empty response.** Silent failure — must be caught, not ignored.
- **Giving an inline verify role a `transient` or `model_unavailable` classification.** Forbidden — verifiers exclude both by contract; their failures are structural.
- **Expecting ControlFlow to retry, parallelize, or throttle.** Those are native Copilot's job. ControlFlow only labels failures; `needs_replan` re-enters the pipeline.
- **Assuming `needs_replan` repairs the current phase in place.** It rewrites the affected phases through the Planner and re-runs `controlflow-verify` — not in place.
- **Looking for the retired Orchestrator retry-budget table.** It is gone. Retry budgets and parallelism are native Copilot's.

## Exercises

1. **(beginner)** Executor = CoreImplementer-subagent, failure = "npm registry unavailable for 30 seconds". Classification?
2. **(beginner)** Verify role = PlanAuditor-subagent, failure = "architecture section references a module that doesn't exist". Classification?
3. **(intermediate)** A phase fails with `model_unavailable`. Who routes it, and what is the action?
4. **(intermediate)** A phase fails with `needs_replan`. Who routes it, and what is the single ControlFlow entry point that re-enters the pipeline?
5. **(advanced)** A phase fails with `needs_replan` mid-execution. Trace the exact sequence: who is re-invoked, what artifact is updated, what gate re-runs, what verdict allows execution to resume.

## Review Questions

1. Name the 5 failure classification classes.
2. When is `failure_classification` required?
3. Who excludes `transient` and `model_unavailable`, and why?
4. Which failure class re-enters the ControlFlow pipeline, and how?
5. Why is retry routing native Copilot's job rather than an Orchestrator dispatch table?

## See Also

- [Chapter 05 — The plan → verify → review pipeline](05-orchestration.md)
- [Chapter 08 — Execution Pipeline](08-execution-pipeline.md)
- [docs/agent-engineering/CLARIFICATION-POLICY.md](../agent-engineering/CLARIFICATION-POLICY.md)
- [schemas/clarification-request.schema.json](../../schemas/clarification-request.schema.json)
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md)