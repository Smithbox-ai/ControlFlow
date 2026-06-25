# Chapter 03 — Agent Roster

## Why this chapter

Provide a **card for each of the 13 agents**: role, inputs, outputs, typical scenarios, output schema, and key constraints. After this chapter you will be able to say immediately, for any task: "this needs such-and-such agent, because…".

## Summary Table

| # | Agent | Group | Output Schema | Tools | Invoked By |
|---|-------|-------|--------------|-------|------------|
| 1 | Orchestrator | Conductor | `orchestrator.gate-event.schema.json` | Coordination | User |
| 2 | Planner | Planning | `planner.plan.schema.json` | Read+search+ask | User |
| 3 | CodeMapper-subagent | Discovery | `code-mapper.discovery.schema.json` | Read-only (5) | All entry points |
| 4 | Researcher-subagent | Research | `researcher.research-findings.schema.json` | Read+fetch (6) | Orchestrator, Planner |
| 5 | PlanAuditor-subagent | Plan Review | `plan-auditor.plan-audit.schema.json` | Read-only (7) | Orchestrator |
| 6 | AssumptionVerifier-subagent | Plan Review | `assumption-verifier.plan-audit.schema.json` | Read-only (6) | Orchestrator |
| 7 | ExecutabilityVerifier-subagent | Plan Review | `executability-verifier.execution-report.schema.json` | Read-only (5) | Orchestrator |
| 8 | CoreImplementer-subagent | Execution | `core-implementer.execution-report.schema.json` | Full impl (11) | Orchestrator |
| 9 | UIImplementer-subagent | Execution | `ui-implementer.execution-report.schema.json` | Full impl (10) | Orchestrator |
| 10 | PlatformEngineer-subagent | Execution | `platform-engineer.execution-report.schema.json` | Full impl (10) | Orchestrator |
| 11 | TechnicalWriter-subagent | Execution | `technical-writer.execution-report.schema.json` | Edit+search (6) | Orchestrator |
| 12 | BrowserTester-subagent | Execution | `browser-tester.execution-report.schema.json` | Search+edit (6) | Orchestrator |
| 13 | CodeReviewer-subagent | Post-Review | `code-reviewer.verdict.schema.json` | Search+run (6) | Orchestrator |

---

## Agent Cards

### 1. Orchestrator

**File:** [Orchestrator.agent.md](../../Orchestrator.agent.md)
**Group:** Conductor
**When to invoke:** When you have a concrete task with clear requirements or a ready plan from Planner.

**What it does:**
- Manages the lifecycle `PLANNING → WAITING_APPROVAL → PLAN_REVIEW → ACTING → REVIEWING → COMPLETE`.
- Delegates phases to executor agents via the `executor_agent` field.
- Conducts the PLAN_REVIEW pipeline (PlanAuditor, AssumptionVerifier, ExecutabilityVerifier).
- Routes failures via the taxonomy (transient/fixable/needs_replan/escalate).
- Escalates to the user via approval gates at phase and wave boundaries.

**What it does NOT do:**
- Does not write code directly (when a suitable executor is available).
- Does not skip gates for speed.
- Does not delegate to agents outside `plans/project-context.md`.

**Typical output:** Structured text with Status / Decision / Confidence / Requires Human Approval / Reason / Next Action. Contract: `orchestrator.gate-event.schema.json`.

---

### 2. Planner

**File:** [Planner.agent.md](../../Planner.agent.md)
**Group:** Planning
**When to invoke:** The task is vague, a plan is needed, or decomposition is required.

**What it does:**
- Runs an **idea interview** for vague tasks.
- Applies a **clarification gate** (5 classes).
- Performs a **semantic risk review** (7 categories).
- Classifies by **complexity tier** (TRIVIAL/SMALL/MEDIUM/LARGE).
- Selects ≤3 **skills** per phase.
- Delegates **research** (Researcher, CodeMapper) when needed.
- Produces **design** and **phase decomposition** (3–10 phases).
- Hands off the plan to Orchestrator.

**What it does NOT do:** does not write code, does not invoke executors, does not invoke reviewers.

**Typical output:** plan conforming to `planner.plan.schema.json`, saved to `plans/<task>-plan.md`.

---

### 3. CodeMapper-subagent

**File:** [CodeMapper-subagent.agent.md](../../CodeMapper-subagent.agent.md)
**Group:** Discovery
**When to invoke:** "Where is the logic for X?", "Who uses function Y?", "Which files belong to subsystem Z?"

**What it does:** Read-only exploration of the repository structure, returning a list of relevant files, usages, and dependencies.

**Tools (5):** read and search only.

**Typical output:** `code-mapper.discovery.schema.json` — file list with types and annotations.

---

### 4. Researcher-subagent

**File:** [Researcher-subagent.agent.md](../../Researcher-subagent.agent.md)
**Group:** Research
**When to invoke:** A deep, evidence-based answer is needed. For example: "How does X work in library Y?", "What approaches exist for Z?"

**Difference from CodeMapper:** CodeMapper = "find files". Researcher = "understand and explain with cited evidence".

**Tools (6):** read + fetch (access to external URLs).

**Typical output:** `researcher.research-findings.schema.json` — structured findings with citations.

---

### 5. PlanAuditor-subagent

**File:** [PlanAuditor-subagent.agent.md](../../PlanAuditor-subagent.agent.md)
**Group:** Plan Review
**When to invoke:** Orchestrator only, during PLAN_REVIEW only.

**What it looks for:**
- Architecture problems (module inconsistencies, boundary violations).
- Security vulnerabilities.
- Missing rollback for destructive operations.
- Dependency conflicts between phases.
- Scope coverage gaps.

**What it does NOT do:** does not write code, does not appear as `executor_agent`. Failure classification excludes `transient`.

**Typical output:** `plan-auditor.plan-audit.schema.json` with status `APPROVED` / `NEEDS_REVISION` / `REJECTED` / `ABSTAIN`.

---

### 6. AssumptionVerifier-subagent

**File:** [AssumptionVerifier-subagent.agent.md](../../AssumptionVerifier-subagent.agent.md)
**Group:** Plan Review
**When to invoke:** Orchestrator on MEDIUM and LARGE tiers.

**What it looks for:** "**Mirages**" — plan claims not supported by the codebase. Uses **17 detection patterns** (e.g., "references a non-existent file", "function allegedly returns X but actually returns Y", "uses a deprecated API").

**Why it supplements PlanAuditor:** PlanAuditor reviews design; AssumptionVerifier reviews factual accuracy of plan claims. These are different axes of validation.

**Typical output:** `assumption-verifier.plan-audit.schema.json` with mirage list and `severity` (BLOCKING / WARNING / INFO).

---

### 7. ExecutabilityVerifier-subagent

**File:** [ExecutabilityVerifier-subagent.agent.md](../../ExecutabilityVerifier-subagent.agent.md)
**Group:** Plan Review
**When to invoke:** Orchestrator on LARGE tier (or with HIGH-risk override).

**What it looks for:** Simulates a **cold start** on the first 3 plan tasks. Can an executor, seeing only these tasks and the repository, start work without additional questions?

**What it checks:**
- Are file paths concrete?
- Are input/output contracts specified?
- Are verification commands given (how to confirm the phase is done)?

**Typical output:** `executability-verifier.execution-report.schema.json` with status `PASS` / `WARN` / `FAIL`.

---

### 8. CoreImplementer-subagent

**File:** [CoreImplementer-subagent.agent.md](../../CoreImplementer-subagent.agent.md)
**Group:** Execution
**When to invoke:** Any backend / non-UI implementation — code, tests, refactoring.

**Special status:** This is the **canonical backbone** for all executors. UIImplementer and PlatformEngineer inherit its working rhythm and extend it with domain-specific gates. See [docs/agent-engineering/MIGRATION-CORE-FIRST.md](../agent-engineering/MIGRATION-CORE-FIRST.md).

**Working rhythm:**
1. Read applicable standards and skill patterns.
2. PreFlect (4 risk classes).
3. Domain work (test-first).
4. Gate verification (tests/build/lint).
5. Structured report.

**Tools (11):** full implementation set including `replace_string_in_file`, `create_file`, `runInTerminal`, etc.

**Typical output:** `core-implementer.execution-report.schema.json` with changes / tests / build / lint / DoD evidence.

---

### 9. UIImplementer-subagent

**File:** [UIImplementer-subagent.agent.md](../../UIImplementer-subagent.agent.md)
**Group:** Execution
**When to invoke:** Frontend tasks — components, styles, accessibility, responsive design.

**What it adds on top of the backbone:** accessibility gate (a11y), responsive gate, design-system gate.

**Typical output:** `ui-implementer.execution-report.schema.json` with `ui_changes`, accessibility/responsive report.

---

### 10. PlatformEngineer-subagent

**File:** [PlatformEngineer-subagent.agent.md](../../PlatformEngineer-subagent.agent.md)
**Group:** Execution
**When to invoke:** CI/CD, containers, deployments, infrastructure changes.

**What it adds on top of the backbone:** approval gate (deployment requires explicit approval), idempotency gate, rollback plan, health checks, environment preconditions.

**Typical output:** `platform-engineer.execution-report.schema.json` with approvals, health checks, rollback plan.

---

### 11. TechnicalWriter-subagent

**File:** [TechnicalWriter-subagent.agent.md](../../TechnicalWriter-subagent.agent.md)
**Group:** Execution
**When to invoke:** Documentation, diagrams, code ↔ docs synchronization.

**Tools (6):** edit + search.

**Typical output:** `technical-writer.execution-report.schema.json` with docs_created, docs_updated, parity check, diagrams.

---

### 12. BrowserTester-subagent

**File:** [BrowserTester-subagent.agent.md](../../BrowserTester-subagent.agent.md)
**Group:** Execution
**When to invoke:** E2E browser tests, UI accessibility audit.

**Gate:** Health-first — verify the application starts before running scenarios.

**Typical output:** `browser-tester.execution-report.schema.json` with scenarios, console/network failures, accessibility findings.

---

### 13. CodeReviewer-subagent

**File:** [CodeReviewer-subagent.agent.md](../../CodeReviewer-subagent.agent.md)
**Group:** Post-Review
**When to invoke:** **Mandatory** after every execution phase. Optionally at the final gate for LARGE tasks (`final_review_gate`).

**What it checks:**
- Correctness of the implementation relative to the phase scope.
- Security.
- Code quality.
- Quality gate compliance (tests_pass, lint_clean, schema_valid, safety_clear).
- Absence of scope drift (especially in final mode).

**Key mechanism:** `validated_blocking_issues` — the Orchestrator blocks continuation **only** on these, not on raw CRITICAL/MAJOR findings.

**What it does NOT do:** never owns a fix cycle. If blocking issues are found, the fix is delegated to the appropriate executor.

**Typical output:** `code-reviewer.verdict.schema.json` with status `APPROVED` / `NEEDS_REVISION` / `REJECTED`.

## Principle of Single Responsibility

Each agent has a **narrow** area of responsibility. This is intentional:

- Narrow context → fewer hallucinations.
- Clear boundary → easier to write the prompt and validate output.
- Composition → complex workflows built from simple blocks.
- Security → each agent has the minimum required tools.

## Common Mistakes

- **Using CoreImplementer for a UI task.** Use UIImplementer — it has a11y/responsive gates.
- **Using CodeMapper when understanding is needed.** Use Researcher — it produces evidence-based explanations.
- **Assigning PlanAuditor as `executor_agent`.** Forbidden by schema; it is a read-only reviewer.
- **Invoking an executor directly without Orchestrator.** Technically possible, but without gates and review the result is risky.

## Exercises

1. **(beginner)** Match each task to an agent: `(a)` "Find all uses of API X", `(b)` "Add CSV export", `(c)` "Check plan for mirages", `(d)` "Write docs for a new endpoint", `(e)` "Deploy to staging".
2. **(beginner)** Open `governance/tool-grants.json` and compare the tools available to Researcher and CoreImplementer. What is the fundamental difference?
3. **(intermediate)** Which 3 agents **can never** appear in `executor_agent`? Why?
4. **(intermediate)** How does PlanAuditor differ from AssumptionVerifier in what each reviews?
5. **(advanced)** Read [docs/agent-engineering/MIGRATION-CORE-FIRST.md](../agent-engineering/MIGRATION-CORE-FIRST.md). What gates does UIImplementer add on top of the CoreImplementer backbone?

## Review Questions

1. How many agents are in the system and how many of them are executors?
2. Who is the single "conductor"?
3. Which agent uses "17 mirage detection patterns"?
4. What are `validated_blocking_issues` and why do they matter?
5. Who can be invoked as an entry point besides Orchestrator and Planner?

## See Also

- [Chapter 02 — Architecture Overview](02-architecture-overview.md)
- [Chapter 04 — P.A.R.T. Specification](04-part-spec.md)
- [Chapter 09 — Schemas](09-schemas.md)
- [plans/project-context.md](../../plans/project-context.md)
