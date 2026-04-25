# Reliability Gates (Core)

This document defines enforceable reliability controls for ControlFlow core agents.

> **Note:** Any exact numeric routing/retry values shown in this document (such as retry budgets, escalation thresholds, and throttle percentages) are reference summaries. The authoritative source for these values is `governance/runtime-policy.json`.

## 1) Consistency

Goal: reduce outcome and trajectory variance on identical inputs.

Required controls:

- Deterministic output schema per agent.
- Stable status enums only.
- Explicit state transitions (no implicit jumps).
- Repeated run checks for critical scenarios.

Acceptance gate:

- Same scenario run multiple times must keep identical status and equivalent gate outcomes.

## 2) Robustness

Goal: remain stable under paraphrases and minor format drift.

Required controls:

- Input normalization for naming variants (camelCase/snake_case aliases where applicable).
- Explicit handling of missing optional fields.
- No silent assumptions for required fields.
- Structured error output when input shape is invalid.

Acceptance gate:

- Scenario variants (prompt paraphrase, key-name drift) produce valid schema output and safe behavior.

## 3) Predictability

Goal: agent knows when not to act.

Required controls:

- Confidence score in all core outputs.
- Abstention threshold policy.
- Evidence minimum policy:
  - If required evidence is missing, return `ABSTAIN` with reasons.

Acceptance gate:

- Low-confidence cases reliably return `ABSTAIN` instead of speculative actions.

## 4) Safety

Goal: enforce policy constraints before side effects.

Required controls:

- High-risk action classification.
- Mandatory human approval gate for destructive/irreversible actions.
- Explicit PII/secrets/data-exposure checks in review outputs.
- Refusal path for unsafe instructions.

Acceptance gate:

- All high-risk scenarios are blocked pending approval or refused with structured safety reasoning.

### Approval Cadence

- Ordinary multi-phase waves use one user approval per wave, as configured by `governance/runtime-policy.json` -> `batch_approval.approval_per`.
- Destructive/high-risk phases and phases that are `FAILED` or `BLOCKED` require per-phase approval, as configured by `batch_approval.exception_destructive_phases` and Orchestrator stopping rules.
- CodeReviewer review and todo completion remain per-phase even when user approval is batched at the wave boundary.

## PreFlect Gate (Before Action)

Before executing an action batch, the agent must:

1. State the intended plan in compact form.
2. Compare against known failure classes:
   - Scope drift
   - Schema drift
   - Missing evidence
   - Unsafe side effects
3. Emit gate decision:
   - `GO`
   - `REPLAN`
   - `ABSTAIN`

## Final Review Gate (Completion Gate)

Optional Completion Gate sub-step for holistic cross-phase scope-drift detection.

- Activated for LARGE tier (auto) or on user request.
- Dispatches CodeReviewer with `review_scope="final"`.
- Policy flag: `governance/runtime-policy.json#final_review_gate`.

## Output Evidence Rule

Any success/failure claim must include evidence references:

- file paths
- schema fields
- gate decisions
- validation result summary

## 5) Clarification Reliability

Goal: ensure agents ask for clarification when ambiguity would materially change the output.

Required controls:

- Positive trigger list for known ambiguity classes.
- Threshold rule: clarification required only for decisions with material output impact.
- Structured clarification payloads when returning `NEEDS_INPUT`.

Acceptance gate:

- When presented with enumerated ambiguity classes, agents with `askQuestions` use it proactively.
- Agents without `askQuestions` return `NEEDS_INPUT` with structured `clarification_request`.
- Clarification does not fire for questions answerable from codebase evidence.

## 6) Tool Routing Reliability

Goal: agents use the correct knowledge source for their role.

Required controls:

- Local-first rule: prefer codebase search before external sources.
- External-doc rule: when task depends on third-party APIs, frameworks, or current best practices, use external tools before finalizing output.
- MCP/Context7 rule: when granted, use for library documentation resolution before planning around third-party behavior.
- No phantom grants: tools in frontmatter must have body-level routing rules.

Acceptance gate:

- Agents with external tools use them when the task domain requires external knowledge.
- Agents without external tools do not claim to have consulted external sources.
- No tool listed in frontmatter goes unreferenced in body instructions.

## 7) Retry Reliability

Goal: prevent silent failures and hung pipelines during parallel agent execution.

> **Source of truth:** Exact numeric values (retry budgets, throttle percentages, escalation thresholds) are authoritative in `governance/runtime-policy.json`. The values below are reference summaries. On any conflict, `runtime-policy.json` wins.

Required controls:

- Silent failure detection: empty responses, timeouts, and rate-limit errors (HTTP 429) must be caught and logged.
- Retry budget: each phase has a cumulative retry budget across failure classifications. Exceeding the budget triggers mandatory user escalation.
- Failure classifications include `transient`, `fixable`, `needs_replan`, `escalate`, and `model_unavailable` where permitted by the acting agent's schema.
- `model_unavailable` uses `retry_budgets.model_unavailable_max`; it retries with model-substitution semantics and escalates on exhaustion.
- PlanAuditor and AssumptionVerifier exclude `transient`; ExecutabilityVerifier can use all five classifications.
- Per-wave throttling: if 2+ subagents in the same wave return `transient` failures, reduce parallelism for subsequent waves by 50%.
- Exponential backoff signaling: retry attempts include a `retry_attempt` counter in delegation payloads.
- Escalation threshold: 3 consecutive failures with the same classification on the same phase triggers escalation regardless of individual retry limits.

Acceptance gate:

- No pipeline step proceeds after unhandled subagent failure.
- Rate-limit scenarios are covered by throttling policy, not by infinite retry.
- Retry budget exhaustion always escalates to user with accumulated failure evidence.

## 8) Executability

Goal: plans must be actionable by a cold-start executor without additional clarification.

Required controls:

- Every phase must specify concrete file paths, input/output contracts, and verification commands.
- Plans are audited for cold-start executability by PlanAuditor (executability_checklist in schema).
- If a plan cannot be executed from the artifact alone, PlanAuditor raises at minimum a MAJOR finding.

Acceptance gate:

- PlanAuditor populates executability_checklist for the first 3 tasks of every audited plan.
- Plans with any executability failure produce a MAJOR or CRITICAL finding — they do not silently pass.

## 9) Semantic Risk Coverage

Goal: plans must surface non-functional and contextual risks before phase decomposition, not after.

Required controls:

- Planner evaluates all 7 semantic risk categories (`data_volume`, `performance`, `concurrency`, `access_control`, `migration_rollback`, `dependency`, `operability`) at Step 3 of the Mandatory Workflow — after clarification, before research delegation.
- Every plan must emit a `risk_review` array with all seven categories present exactly once.
- Any category with `applicability: applicable` AND `impact: HIGH` that cannot be resolved from available evidence must set `disposition: research_phase_added` and include a dedicated research phase before implementation phases begin.
- Orchestrator triggers PlanAuditor whenever any `risk_review` entry has `applicability: applicable` AND `impact: HIGH` AND `disposition` is not `resolved` — even for plans with fewer than 3 phases and confidence ≥ 0.9.
- PlanAuditor maps applicable HIGH-impact risk entries to its audit focus areas (see Semantic Risk Taxonomy in `plans/project-context.md`).

Acceptance gate:

- Plans with `HIGH`-impact applicable risk entries and no corresponding research phase or `resolved` disposition are non-compliant.
- PlanAuditor must check the `risk_review` field when `audit_scope` includes `performance` focus area.
- A missing, duplicate, or incomplete `risk_review` array in the plan schema is a schema validation failure — the plan is rejected before PlanAuditor review.

## 10) Scoring Reliability

Goal: quantitative scores must be reproducible given identical findings.

Required controls:

- Scoring uses discrete, countable inputs (mirage count, orphaned requirements, blocked tasks) — not subjective ratings.
- Formulas are mathematical operations on counted evidence, defined in `docs/agent-engineering/SCORING-SPEC.md`.
- Cross-validated ceilings are applied deterministically: same AssumptionVerifier/ExecutabilityVerifier evidence → same ceiling applied.
- Verdict thresholds are fixed numeric boundaries (≥75%, 60-74%, <60%).

Acceptance gate:

- Given identical plan audit findings, the scoring dimensions and final percentage are reproducible.
- Ceiling rules produce the same cap given the same mirage/blocker counts.

## 11) Regression Gate

Goal: verified plan items must not regress without BLOCKING classification.

Required controls:

- Items verified in iteration N that fail in iteration N+1 are automatically classified as BLOCKING regressions.
- Regression tracking uses the Verified Items Registry (`plans/templates/verified-items-template.md`).
- Regressions override the severity of the underlying finding — a MINOR finding that regresses becomes BLOCKING.

Acceptance gate:

- No previously-verified item silently reverts to failing status.
- Regressions appear in `validated_blocking_issues` regardless of original severity.

## 12) Skill Routing Reliability

Goal: selected skills must match the task domain and be loadable by implementation agents.

Required controls:

- Planner selects skills from `skills/index.md` based on keyword matching against the domain mapping table.
- Selected skill file paths are included in phase `skill_references` and resolve to existing files.
- Implementation agents load referenced skills before executing phase tasks.

Acceptance gate:

- Every `skill_references` path resolves to an existing file in `skills/patterns/`.
- Selected skills are relevant to the task domain (no random skill selection).

## 13) Offline Validation Gate

Goal: keep repository-level validation deterministic and local.

Required controls:

- `cd evals && npm test` is the canonical validation command.
- The suite is offline: it validates schemas, fixtures, prompt behavior, orchestration handoff, drift checks, NOTES.md hygiene, archive behavior, and structural fingerprinting without executing live agents or using the network.
- `evals/validate.mjs` uses Ajv 2020-12 with `strict: false` and `allErrors: true`; documentation must not describe the harness as using strict validator mode.

Acceptance gate:

- Documentation and operator guidance describe the eval harness as offline structural/behavioral validation, not live-agent scenario execution.
