# Chapter 17 — Glossary

Alphabetical reference for all key terms in the slim ControlFlow model. Each entry includes a definition and chapter cross-references. Retired concepts are marked as such for historical context.

---

## A

**ABSTAIN** — A Planner output status meaning "I cannot assess with sufficient confidence." Does not block the pipeline; logged as uncertainty. → Ch.06, Ch.07

**Acceptance criteria** — A measurable condition that must be true for a phase to be considered complete. At least one measurable observable outcome per phase. → Ch.06, Ch.08, `schemas/planner.plan.schema.json`

**Agent (custom Copilot agent)** — A Markdown file under `.github/agents/` with Copilot agent frontmatter (`name`, `description`, `tools`) that Copilot surfaces in the agents dropdown. The slim model ships exactly one: `@controlflow-planner`. → Ch.04

**`@controlflow-planner`** — The sole shipped ControlFlow agent, at `.github/agents/controlflow-planner.agent.md`. Produces schema-anchored plans; hands execution to native Copilot. Uses the Copilot Auto model picker (no `model:` frontmatter). → Ch.01, Ch.03, Ch.06

**Agent grants** — **Retired.** The legacy `governance/agent-grants.json` file no longer exists; subagent governance is delegated to native Copilot. → Ch.10

**AssumptionVerifier-subagent** — The inline verify role label for `controlflow-verify` phase 2 (mirage detection). Checks that plan claims are supported by the codebase (mirage taxonomy P1–P10, A11–A17). Performed inline — never an `executor_agent`. → Ch.07, `schemas/assumption-verifier.plan-audit.schema.json`

---

## B

**Backbone pattern** — See `docs/agent-engineering/MIGRATION-CORE-FIRST.md`. The shared implementation rhythm `CoreImplementer-subagent` carries; extended by UIImplementer and PlatformEngineer with domain-specific gates. → Ch.03

**Behavior contract** — `docs/agent-engineering/PROMPT-BEHAVIOR-CONTRACT.md`. Behavioral invariants (evidence over assertion, abstain on no harness, stop-the-line on regression). → Ch.04

**BrowserTester-subagent** — A conceptual executor role for E2E browser tests and UI/accessibility audits. Not a shipped agent; recreate as a native Copilot custom agent per `NATIVE-DELEGATION-BOUNDARY.md §5` if you want the persona back. → Ch.03, `schemas/browser-tester.execution-report.schema.json`

---

## C

**`controlflow-plan`** — The plan skill at `.github/skills/controlflow-plan/`. Produces a schema-anchored plan artifact in `plans/`; single-sources the format from `schemas/planner.plan.schema.json` and `plans/templates/plan-document-template.md`. → Ch.06

**`controlflow-review`** — The review skill at `.github/skills/controlflow-review/`. Evidence-backed review layered over native Copilot code review; adds plan-vs-implementation scope-drift comparison and proactive vulnerability/error search. → Ch.08

**`controlflow-verify`** — The verify skill at `.github/skills/controlflow-verify/`. Inline adversarial verification (zero subagents); tier-gated phases (structural audit, mirage detection, executability cold-start); emits `APPROVED` / `NEEDS_REVISION` / `REJECTED`. → Ch.07

**CodeMapper-subagent** — A conceptual executor role for read-only codebase exploration. Returns a discovery report. Not a shipped agent. → Ch.03, `schemas/code-mapper.discovery.schema.json`

**CodeReviewer-subagent** — A conceptual executor role for post-implementation review. In the slim model, `controlflow-review` already layers review over native Copilot code review; recreate this persona only if you want a dedicated review agent (see `NATIVE-DELEGATION-BOUNDARY.md §5`). → Ch.03, Ch.08, `schemas/code-reviewer.verdict.schema.json`

**Cold start** — The condition in which a fresh executor arrives at a phase with only the repository and the plan description, without additional context. `ExecutabilityVerifier-subagent` (verify phase 3) tests exactly this. → Ch.07

**Complexity tier** — `TRIVIAL` / `SMALL` / `MEDIUM` / `LARGE`. Determined by the Planner; drives whether plan, verify, and review run at all and how many verify phases run. → Ch.05, Ch.06, Ch.07, Ch.08

**Confidence** — A numeric value (0–1) in the plan header reflecting how certain the Planner is. Below 0.9 the plan is `NEEDS_REVISION` automatically. → Ch.06

**Conceptual role** — A labeled responsibility (e.g., `CoreImplementer-subagent`, `PlanAuditor-subagent`) the Planner assigns in plan phases (`executor_agent`) or that `controlflow-verify` performs inline. **Not** a shipped agent file. The slim model ships one agent; the eight executor role names and three verify role names are conceptual labels executed by native Copilot. → Ch.02, Ch.03

**ControlFlow** — A thin, non-duplicating layer over GitHub Copilot's native agent capabilities. Ships one agent and three skills; keeps only what Copilot does not provide natively (schema-enforced plan format, adversarial verify, tier-gated policy, scope-drift review, contract-drift eval suite). → Ch.00, `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`

**CoreImplementer-subagent** — A conceptual executor role for backend implementation (code, tests, refactoring). The canonical backbone for executors. → Ch.03, `schemas/core-implementer.execution-report.schema.json`

---

## D

**Delegation boundary** — The rule that ControlFlow ships no surface duplicating a native Copilot capability. The canonical record is `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`. → Ch.02, Ch.03, Ch.10

**Definition of done** — A list of conditions that must be true for a phase to be declared complete. Matches the phase's `quality_gates`. → Ch.08

**Drift check** — A test in `evals/drift-checks.mjs` that verifies the plan format, role taxonomy, and governance config stay aligned across files (e.g., `plans/project-context.md` ↔ `governance/project-context-registry.json` mirror). → Ch.04, Ch.14

---

## E

**Eval harness** — The offline test suite in `evals/`. No live agents, no network. → Ch.14

**Escalate** — A failure classification: security/data risk or unresolvable blocker. Native Copilot stops and awaits user approval. Zero automatic retries. → Ch.13

**ExecutabilityVerifier-subagent** — The inline verify role label for `controlflow-verify` phase 3 (executability cold-start). Simulates a fresh executor starting Phase 1 with only the plan. Runs on `LARGE` tier or when the HIGH-risk override fires. → Ch.07, `schemas/executability-verifier.execution-report.schema.json`

**executor_agent** — A required phase field; enum of eight executor role names enforced by `schemas/planner.plan.schema.json`. The three inline verify roles are excluded from this enum. → Ch.06, Ch.08

---

## F

**Failure classification** — A required field when a phase or verdict records a failure. Values: `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable`. (`PlanAuditor` and `AssumptionVerifier` exclude `transient`.) → Ch.13

**Fixable** — A failure classification: small correctable error. Native Copilot retries with a fix hint. → Ch.13

**Frontmatter** — YAML metadata at the top of a Copilot agent file (`.github/agents/*.agent.md`): `description`, `name`, `tools`. No `model:` line by default. → Ch.04

---

## G

**Governance** — Configuration files in `governance/` that define runtime policy, the role registry, canonical sources, and rename allowlists. The slim model keeps four governance files: `runtime-policy.json`, `project-context-registry.json`, `canonical-source-matrix.json`, `rename-allowlist.json`. → Ch.10

**Ground truth** — For doc-count checks, the on-disk file counts the eval suite resolves at runtime (schemas, skills patterns, governance files, root agent files). Stating a count that mismatches ground truth in an allowlisted doc fails Pass 15. → Ch.14

---

## H

**Handoff** — The Planner output field (`handoff: {target, prompt}`) that points the user to the plan artifact path and the next step (`/controlflow-verify`). The Planner does not dispatch execution; it hands off. → Ch.06

---

## I

**Idea Interview** — The Planner's clarifying-question phase, run when the request is vague. Asks the user directly when an answer changes file scope, user-visible behavior, architecture, or destructive-risk handling; otherwise records a bounded assumption. → Ch.06

---

## L

**LARGE** — The highest complexity tier. `controlflow-verify` runs all three phases (structural audit + mirage detection + executability cold-start). Forced by file count (fifteen or more) or by any unresolved HIGH-impact semantic-risk entry. → Ch.05, Ch.07

---

## M

**Memory architecture** — The three-layer memory model (session / task-episodic / repo-persistent). → Ch.12, `docs/agent-engineering/MEMORY-ARCHITECTURE.md`

**Mirage** — A plan claim not supported by the actual codebase. Detected by `AssumptionVerifier-subagent` (verify phase 2). The full taxonomy (presence P1–P10, absence A11–A17) is in `.github/skills/controlflow-verify/references/mirage-patterns.md`. → Ch.07

**Model routing** — **Retired.** The legacy `governance/model-routing.json` and `docs/agent-engineering/MODEL-ROUTING.md` no longer exist. Model selection is delegated to native Copilot (Auto model picker). The `Model Routing Role` column in the roster is a conceptual capability tier, not a routing surface. → Ch.10

**model_unavailable** — A failure classification: the routed/primary model is unavailable or unreachable. Native Copilot substitutes a model, then escalates on exhaustion. → Ch.13

---

## N

**Native Copilot** — The VS Code Copilot agent platform that provides custom agents, subagent dispatch + parallelism, Plan mode, agentic code review, the skills library, MCP, model selection, approvals, and custom instructions. ControlFlow layers over it without duplicating these. → Ch.02, `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`

**needs_replan** — A failure classification: architecture mismatch or missing dependency. The user re-invokes `@controlflow-planner` for a targeted replan — the only class that re-enters the ControlFlow pipeline. → Ch.13

**NEEDS_REVISION** — A `controlflow-verify` verdict: ambiguous Phase 1, unverified paths, vague criteria, or structural failure. Re-invoke the Planner to revise, then re-verify. → Ch.07

**NOTES.md** — The repo-persistent active-objective state file. Updated at phase boundaries; kept within a twenty-line budget. → Ch.12

---

## O

**Orchestrator** — **Retired — conceptual conductor only.** The legacy agent that ran the state machine (`PLANNING` / `WAITING_APPROVAL` / `PLAN_REVIEW` / `ACTING` / `REVIEWING` / `COMPLETE`), dispatched subagents in waves, and routed failures. In the slim model the Planner plus native Copilot cover orchestration; the state machine, dispatch, waves, and gates are gone. See "the plan → verify → review pipeline" instead. → Ch.05

---

## P

**P.A.R.T.** — **Retired as a mandatory template.** The legacy four-section order (Prompt / Archive / Resources / Tools) enforced on every `*.agent.md`. The discipline (role / scope / contracts / tools as prose) still informs how a good custom agent prompt is written, but it is guidance, not a mandatory template, and the drift checker no longer audits for it. → Ch.04

**Phase** — A plan unit with an `executor_agent`, acceptance criteria, quality gates, and steps. → Ch.06, Ch.08

**Plan artifact** — The Markdown file the Planner writes to `plans/<task-slug>-plan.md` conforming to `schemas/planner.plan.schema.json`. A reviewable input, not an implicit approval. → Ch.05, Ch.06

**PlanAuditor-subagent** — The inline verify role label for `controlflow-verify` phase 1 (structural audit). Confirms schema/template conformance, ten sections in order, seven risk categories, executor enum, Mermaid rules. → Ch.07, `schemas/plan-auditor.plan-audit.schema.json`

**Planner** — The plan-producer role, shipped as `@controlflow-planner`. Runs the Idea Interview, assigns tier, fills the seven risk categories, declares `executor_agent` per phase, writes the artifact. Does not write code. → Ch.03, Ch.06

**PlatformEngineer-subagent** — A conceptual executor role for CI/CD, containers, and infrastructure deployment. Adds approval, idempotency, and rollback gates on top of the backbone. → Ch.03, `schemas/platform-engineer.execution-report.schema.json`

**PreFlect** — A mandatory self-check before each action batch, using `skills/patterns/preflect-core.md`. Four risk classes: destructive, scope-drift, assumption, dependency. Decision: `GO` / `PAUSE` / `ABORT`. → Ch.05, Ch.11

**Prompt** — The body of a custom agent file stating the role's mission, scope IN/OUT, abstention rule, and output discipline. The "P" in the retired P.A.R.T. acronym. → Ch.04

**Pipeline** — The plan → verify → review flow over native Copilot: `controlflow-plan` (Planner produces the artifact) → `controlflow-verify` (inline adversarial audit) → native Copilot executes phases → `controlflow-review` (scope-drift + evidence layer). Three gates, not a state machine. → Ch.05

**Quality gate** — A phase readiness condition. Enum: `tests_pass`, `lint_clean`, `schema_valid`, `safety_clear`, `human_approved_if_required`. → Ch.08

---

## R

**REJECTED** — A `controlflow-verify` verdict: structural flaw; scope not deliverable as authored. Do not start coding; ask the user for direction or replan from scratch. → Ch.07

**REPLAN_REQUIRED** — A Planner output status indicating requirements need clarification before planning can proceed. Blocks progress. → Ch.06

**Repo memory** — `/memories/repo/` — durable codebase facts. Create-only (no edits). → Ch.12

**Repo-persistent** — The third memory layer: `NOTES.md` + `/memories/repo/`. Survives context resets. → Ch.12

**Researcher-subagent** — A conceptual executor role for research and evidence. Returns findings with citations. → Ch.03, `schemas/researcher.research-findings.schema.json`

**risk_review** — A plan field with the seven semantic risk categories, dispositions, and applicability. → Ch.06, Ch.07

---

## S

**Schema** — A `schemas/*.json` file (JSON Schema draft 2020-12). Contract documentation + eval fixture references in the slim model; not runtime-validated inter-agent messages. Twenty schemas total. → Ch.09

**Scope drift** — Executing actions beyond the declared plan scope. Detected by `controlflow-review`'s plan-vs-implementation comparison. → Ch.08, Ch.11

**Semantic risk taxonomy** — Seven risk categories in `risk_review`: `data_volume`, `performance`, `concurrency`, `access_control`, `migration_rollback`, `dependency`, `operability`. None skipped; `not_applicable` with justification when irrelevant. → Ch.06

**Session memory** — Layer 1: `/memories/session/`. Conversation-scoped scratch. → Ch.12

**Skill** — A reusable Markdown pattern. Two surfaces: the three workflow skills at `.github/skills/controlflow-{plan,verify,review}/` and the value-add patterns at `skills/patterns/`. → Ch.11

**Skill index** — `skills/index.md`. The registry from which the Planner injects ≤3 patterns per phase via `skill_references`. → Ch.11

**Skill references** — The `skill_references` field in a plan phase listing the value-add patterns the Planner injects (≤3 per phase). → Ch.06, Ch.11

**SMALL** — A complexity tier. `controlflow-verify` runs phase 1 (structural audit) only. → Ch.07

**Subagent** — **Conceptual executor role (native Copilot executes).** In the slim model the `*-subagent` names are role labels the Planner assigns in plan phases; native Copilot executes them inline. There are no shipped ControlFlow subagents. → Ch.03

---

## T

**Task-episodic** — Layer 2: `plans/artifacts/<task-slug>/`. Per-task revision history and deliverables. → Ch.12

**TDD** — Test-driven development. Applied via `skills/patterns/tdd-patterns.md`. → Ch.11

**TechnicalWriter-subagent** — A conceptual executor role for documentation and code-doc parity. → Ch.03, `schemas/technical-writer.execution-report.schema.json`

**Tier-gated** — The policy that the complexity tier decides whether plan, verify, and review run at all and how many verify phases run. → Ch.05, Ch.07

**Tool grants** — **Retired.** The legacy `governance/tool-grants.json` file no longer exists. Tool access is delegated to native Copilot (declared per-agent in `tools:` frontmatter when recreated). → Ch.10

**Transient** — A failure classification: temporary error (timeout, rate limit). Native Copilot retries with identical scope. → Ch.13

**TRIVIAL** — The lowest complexity tier. Plan, verify, and review are all skipped. → Ch.07

---

## U

**UIImplementer-subagent** — A conceptual executor role for frontend implementation (UI, styling, responsive, accessibility). Adds a11y/responsive/design-system gates on top of the backbone. → Ch.03, `schemas/ui-implementer.execution-report.schema.json`

---

## V

**Verdict** — The decision emitted by a skill. `controlflow-verify` → `APPROVED` / `NEEDS_REVISION` / `REJECTED`; `controlflow-review` → findings + verdict. A gate blocks progression until resolved. → Ch.05, Ch.07, Ch.08

**Verdict gate** — A decision point in the pipeline. The verify gate blocks execution until `APPROVED`; the review gate blocks shipping until the user reviews the findings. → Ch.05

---

## W

**Workflow state (legacy)** — **Retired.** The former Orchestrator state machine node enum (`PLANNING` / `WAITING_APPROVAL` / `ACTING` / `REVIEWING` / `COMPLETE`). Not shipped in the slim model. The pipeline gates replace it. → Ch.05

---

## See Also

- [Chapter 00 — Introduction](00-introduction.md)
- [Chapter 18 — FAQ](18-faq.md)
- [plans/project-context.md](../../plans/project-context.md)
- [docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](../agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)