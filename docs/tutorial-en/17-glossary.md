# Chapter 17 — Glossary

Alphabetical reference for all key terms. Each entry includes a definition and chapter cross-references.

---

## A

**ABSTAIN** — A reviewer or Planner output status meaning "I cannot assess with sufficient confidence." Does not block the pipeline. → Ch.07, Ch.06

**Acceptance criteria** — A measurable condition that must be true for a phase to be considered complete. Minimum 1 required per phase. → Ch.06, Ch.08, planner.plan.schema.json

**ACTING** — An Orchestrator workflow state indicating active phase execution by subagents. → Ch.05

**Agent** — A specialized AI system defined by a `*.agent.md` file with P.A.R.T. structure. 13 agents in the ControlFlow system. → Ch.03

**Agent grants** — `governance/agent-grants.json` — the tool allowlist for each agent. → Ch.10

**AssumptionVerifier** — An adversarial reviewer that detects 17 types of plan mirages (claims not supported by the codebase). → Ch.07, assumption-verifier.plan-audit.schema.json

---

## B

**Backbone pattern** — See `docs/agent-engineering/MIGRATION-CORE-FIRST.md`. A shared implementation pattern for multi-agent consolidation.

**Batch approval** — One approval request per wave (not per phase). Exception: destructive waves require per-phase approval. → Ch.08

**Behavior contract** — `docs/agent-engineering/PROMPT-BEHAVIOR-CONTRACT.md`. Behavioral invariants complementing P.A.R.T. structural rules. → Ch.04

**BrowserTester** — A subagent that runs E2E browser tests and validates UI/accessibility. → Ch.03, browser-tester.execution-report.schema.json

**Budget tracking** — A skill that monitors token/retry budgets per phase. → Ch.11

---

## C

**Clarification policy** — `docs/agent-engineering/CLARIFICATION-POLICY.md`. Rules for when to use `vscode/askQuestions` vs NEEDS_INPUT. → Ch.05, Ch.06

**Clarification request** — A structured payload (schema: `clarification-request.schema.json`) containing a question, options, and recommendation. → Ch.13

**CodeMapper** — A subagent for read-only codebase exploration. Returns a discovery report. → Ch.03, code-mapper.discovery.schema.json

**CodeReviewer** — A post-execution review subagent. Never owns a fix cycle. Returns `validated_blocking_issues`. → Ch.03, Ch.08, code-reviewer.verdict.schema.json

**Cold start** — The condition in which an executor arrives at a phase with only the repository and the plan description, without additional context. ExecutabilityVerifier tests exactly this. → Ch.07

**COMPLETE** — The final Orchestrator workflow state. → Ch.05

**Completion gate** — The final task phase: consistency review, todo verification, session-outcome flush, final summary. → Ch.08

**Complexity tier** — TRIVIAL / SMALL / MEDIUM / LARGE. Determined by Planner; drives review pipeline and model routing. → Ch.06, Ch.07, Ch.08

**Confidence** — A numeric value (0–1) in Planner output and gate events reflecting how certain the agent is in its assessment. → Ch.06

**ControlFlow** — A prompt/governance/eval repository for an agent orchestration system. 13 agents, 20 schemas, 7 governance files, 20 skills. → Ch.00

**Convergence detection** — See stagnation. → Ch.07

**CoreImplementer** — A subagent for backend implementation (code, tests, migrations). → Ch.03, core-implementer.execution-report.schema.json

---

## D

**Definition of done** — A list of conditions that must be true for a phase to be declared complete. Matches `quality_gates`. → Ch.08

**Delegation protocol** — The payload the Orchestrator sends to a subagent. Schema: `orchestrator.delegation-protocol.schema.json`. → Ch.05, Ch.09

**Drift check** — A test in `evals/drift-checks.mjs` that verifies agent files haven't gone out of sync with contracts. → Ch.04, Ch.14

---

## E

**Eval harness** — The offline test suite in `evals/` (~410 checks). No live agents, no network. → Ch.14

**Escalate** — A failure classification: security/data risk or unresolvable blocker. Immediate STOP + WAITING_APPROVAL. → Ch.13

**ExecutabilityVerifier** — A reviewer that simulates cold-start executability of the first 3 tasks per phase. Active on LARGE tier. → Ch.07, executability-verifier.execution-report.schema.json

**executor_agent** — A required phase field (enum: 8 values). Orchestrator must not infer it heuristically. → Ch.08, Ch.06

---

## F

**Failure classification** — A required field when status is FAILED/NEEDS_REVISION/NEEDS_INPUT/REJECTED. Values: transient/fixable/needs_replan/escalate. → Ch.13

**Final review gate** — An optional final CodeReviewer pass after all phases complete. Configured in `governance/runtime-policy.json`. → Ch.08

**Fixable** — A failure classification: small correctable error. Retry once with a fix hint. → Ch.13

**Frontmatter** — YAML metadata at the top of `*.agent.md` files (e.g., `agents:`, `tools:`). → Ch.04

---

## G

**Gate event** — An Orchestrator transition event with a fixed field contract. Schema: `orchestrator.gate-event.schema.json`. → Ch.05, Ch.09

**Governance** — Configuration files in `governance/` that define agent permissions, model routing, and operational policies. → Ch.10

**Handoff** — The Planner output field `handoff: {target_agent, prompt}` that routes the plan to Orchestrator. → Ch.06

**HIGH_RISK_APPROVAL_GATE** — A gate event type for high-risk operations requiring user approval. → Ch.05

---

## H

**Idea interview** — The first Planner phase: converting a vague idea into concrete requirements through clarifying questions. → Ch.06

---

## I

**Iteration index** — `iteration_index` — the current iteration number in the PLAN_REVIEW loop. Passed to all reviewers. → Ch.07

---

## L

**LARGE** — The highest complexity tier. Full PLAN_REVIEW pipeline: PlanAuditor + AssumptionVerifier + ExecutabilityVerifier. → Ch.07

---

## M

**Memory architecture** — The three-layer memory model (session / task-episodic / repo-persistent). → Ch.12, MEMORY-ARCHITECTURE.md

**Mirage** — A plan claim not supported by the actual codebase. Detected by AssumptionVerifier. → Ch.07

**Model role** — The model routing field per task type. Configured in `governance/model-routing.json`. → Ch.10

---

## N

**NEEDS_INPUT** — A subagent status indicating that a clarifying question must be asked of the user. Routes through `vscode/askQuestions`, **not** through `failure_classification`. → Ch.13

**needs_replan** — A failure classification: architecture mismatch requiring a phase replan via Planner. Max 1 retry. → Ch.13

**NOTES.md** — The repo-persistent active-objective state file. Updated at each phase boundary. → Ch.12

---

## O

**Observability** — Gate event logging to `plans/artifacts/<task-id>/observability/<task-id>.ndjson`. → Ch.05, OBSERVABILITY.md

**Orchestrator** — The conductor agent. Runs the state machine, dispatches subagents, enforces gates. → Ch.03, Ch.05

---

## P

**P.A.R.T.** — The mandatory section order for every `*.agent.md`: **Prompt → Archive → Resources → Tools**. → Ch.04, PART-SPEC.md

**Phase** — A plan unit with an `executor_agent`, acceptance criteria, and quality gates. → Ch.06, Ch.08

**PHASE_REVIEW_GATE** — A gate event after phase completion. → Ch.05

**PlanAuditor** — An adversarial reviewer of architecture, security, risks, and rollback. → Ch.07, plan-auditor.plan-audit.schema.json

**Planner** — The planning agent. Runs an idea interview, produces phased plans, selects skills. → Ch.03, Ch.06

**PLANNING** — The initial Orchestrator workflow state during plan creation. → Ch.05

**Plan path** — The `plan_path` field in Planner output — the path to the plan file. A reviewable input, not an implicit approval. → Ch.05, Ch.06

**Plan Review Gate** — The PLAN_REVIEW stage between plan arrival and execution start. Conditional. → Ch.07

**PlatformEngineer** — A subagent for CI/CD, containerization, and infra deployment. → Ch.03, platform-engineer.execution-report.schema.json

**PreFlect** — A mandatory gate before each action batch. Uses `preflect-core` skill. 4 risk classes: destructive, scope-drift, assumption, dependency. → Ch.05, Ch.11

**Prompt** — The first section of P.A.R.T. Contains the agent's mission, scope, and invariants. → Ch.04

**Quality gate** — A phase readiness condition. Enum: tests_pass, lint_clean, schema_valid, safety_clear, human_approved_if_required. → Ch.08

---

## R

**Reflection loop** — A skill for agents with a revision step: produce output, self-evaluate, refine. → Ch.11

**Reliability gates** — `docs/agent-engineering/RELIABILITY-GATES.md`. Verification gate requirements. → Ch.08

**REPLAN_REQUIRED** — A Planner output status indicating requirements need clarification before planning can proceed. → Ch.06

**Repo memory** — `/memories/repo/` — durable codebase facts. Create-only (no edits). → Ch.12

**Repo-persistent** — The third memory layer: NOTES.md + /memories/repo/. Survives context resets. → Ch.12

**REVIEWING** — An Orchestrator workflow state during code review after a phase. → Ch.05

**Researcher** — A subagent for deep research. Returns findings with citations. → Ch.03, researcher.research-findings.schema.json

**risk_review** — A planner.plan field with 7 semantic risk categories, dispositions, and applicability. → Ch.06, Ch.07

---

## S

**Schema** — A `schemas/*.json` file defining an agent output contract (JSON Schema draft 2020-12). 20 schemas total. → Ch.09

**Scope drift** — Executing actions beyond the declared plan scope. Detected by PreFlect and llm-behavior-guidelines. → Ch.05, Ch.11

**Scoring spec** — `docs/agent-engineering/SCORING-SPEC.md`. Quantitative scoring formula for reviewer verdicts. → Ch.07

**Semantic risk taxonomy** — 7 risk categories in `risk_review`: data_volume, performance, concurrency, access_control, migration_rollback, dependency, operability. → Ch.06

**Session memory** — Layer 1: `/memories/session/`. Conversation-scoped scratch. → Ch.12

**Skill** — A reusable Markdown pattern file in `skills/patterns/`. Loaded just in time. → Ch.11

**Skill index** — `skills/index.md`. The registry from which Planner selects ≤3 skills per phase. → Ch.11

**SMALL** — A complexity tier. PLAN_REVIEW runs PlanAuditor only. → Ch.07

**Stagnation** — When score improvement over 2 iterations < 5% at iteration ≥ 3. Triggers WAITING_APPROVAL. → Ch.07

**Subagent** — Any agent that executes as a phase executor or reviewer. Not an entry point for direct user interaction. → Ch.03

---

## T

**Task-episodic** — Layer 2: `plans/artifacts/<task-slug>/`. Per-task revision history and deliverables. → Ch.12

**TDD** — Test-driven development. Applied via the `tdd-patterns` skill. → Ch.11

**TechnicalWriter** — A subagent for documentation generation and code-doc parity. → Ch.03, technical-writer.execution-report.schema.json

**Tool grants** — `governance/tool-grants.json`. Properties and allowed callers for each tool. → Ch.10

**Tool routing** — `docs/agent-engineering/TOOL-ROUTING.md`. Rules for when to use external tools vs subagents. → Ch.05

**Trace ID** — A UUID v4 generated at task start and propagated to all gate events and delegation payloads. Enables log correlation. → Ch.05

**Transient** — A failure classification: temporary error (timeout, rate limit). Retry identically, max 3. → Ch.13

**TRIVIAL** — The lowest complexity tier. PLAN_REVIEW is skipped entirely. → Ch.07

---

## U

**UIImplementer** — A subagent for frontend implementation (UI, styling, responsive, accessibility). → Ch.03, ui-implementer.execution-report.schema.json

---

## V

**Validated blocking issues** — `validated_blocking_issues` in CodeReviewer verdict. Only these block phase progression — not raw CRITICAL/MAJOR findings. → Ch.08, Ch.09

**Verified items** — A list of items confirmed as correct in the previous iteration. Passed to reviewers for regression tracking. → Ch.07

**vscode/askQuestions** — The tool used by Orchestrator for mandatory clarification classes and NEEDS_INPUT routing. → Ch.05, Ch.13

---

## W

**WAITING_APPROVAL** — An Orchestrator workflow state requiring user confirmation before proceeding. → Ch.05

**Wave** — A group of parallel plan phases. Wave N+1 starts only after all phases of wave N complete. → Ch.08

**Wave-aware execution** — Phase execution strategy with wave grouping and parallelism. → Ch.08

**Workflow state** — The current Orchestrator state machine node. Enum in `orchestrator.gate-event.schema.json`: PLANNING/WAITING_APPROVAL/ACTING/REVIEWING/COMPLETE. → Ch.05

---

## See Also

- [Chapter 00 — Introduction](00-introduction.md)
- [Chapter 18 — FAQ](18-faq.md)
- [plans/project-context.md](../../plans/project-context.md)
