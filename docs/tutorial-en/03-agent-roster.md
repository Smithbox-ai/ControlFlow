# Chapter 03 — Role Taxonomy

## Why this chapter

Provide a **card for each conceptual role** in the ControlFlow pipeline: what it does, when the Planner assigns it, and how native Copilot executes it. After this chapter you will be able to say, for any task: "the Planner will assign this role, because…" — and you will understand that none of these roles is a shipped agent file.

This is a _taxonomy_, not a roster of shipped agents. The slim model ships one agent (`@controlflow-planner`) and three skills. The names below are conceptual labels the Planner writes into the `executor_agent` field of a plan phase, or the labels `controlflow-verify` uses for its three inline phases. Execution is native Copilot's job.

## Summary Table

### Phase Executor Roles (8) — the `executor_agent` enum

The `executor_agent` field in a plan phase must use one of these exact names. The enum is enforced by `schemas/planner.plan.schema.json` and mirrored in `plans/project-context.md` and `governance/project-context-registry.json`.

| # | Role | What it does | Model Routing Role (conceptual) |
|---|------|--------------|---------------------------------|
| 1 | `CodeMapper-subagent` | Read-only codebase exploration, file mapping | `fast-readonly` |
| 2 | `Researcher-subagent` | Research & evidence with citations | `research-capable` |
| 3 | `CoreImplementer-subagent` | Backend implementation — code, tests, refactoring. Canonical backbone. | `capable-implementer` |
| 4 | `UIImplementer-subagent` | UI implementation — components, styling, accessibility | `ui-implementer` |
| 5 | `PlatformEngineer-subagent` | Infrastructure — CI/CD, containers, deployment | `capable-implementer` |
| 6 | `TechnicalWriter-subagent` | Documentation, diagrams, code–doc parity | `documentation` |
| 7 | `BrowserTester-subagent` | E2E browser tests, accessibility audits | `browser-testing` |
| 8 | `CodeReviewer-subagent` | Post-implementation review (the review-role persona; `controlflow-review` layers this over native code review) | `capable-reviewer` |

### Inline Verify Roles (3) — performed by `controlflow-verify`, never `executor_agent`

These three names label the three phases of the `controlflow-verify` skill. They are strictly read-only and **must not** appear as `executor_agent` values in plan phases.

| # | Role | Verify phase | What it looks for | Model Routing Role (conceptual) |
|---|------|-------------|--------------------|---------------------------------|
| 9 | `PlanAuditor-subagent` | Phase 1 — structural audit | Schema/template conformance; architecture, security, rollback, dependency conflicts | `capable-reviewer` |
| 10 | `AssumptionVerifier-subagent` | Phase 2 — mirage detection | Plan claims not supported by the codebase (the mirage taxonomy P1–P10, A11–A17) | `capable-reviewer` |
| 11 | `ExecutabilityVerifier-subagent` | Phase 3 — executability cold-start | Can a fresh executor start Phase 1 from the plan alone, without asking the user? | `review-readonly` |

### Non-Executor Roles (2)

| Role | Status | Notes |
|------|--------|-------|
| `Orchestrator` | **Retired** — conceptual conductor only | Mentioned historically. No shipped agent in the slim model. The Planner + native Copilot cover orchestration. The legacy state machine, dispatch, waves, and gates are gone. |
| `Planner` | Shipped as `@controlflow-planner` | The sole shipped entry point. Produces plans; assigns `executor_agent` per phase; hands execution to native Copilot. |

**Single source of truth:** the tables above mirror `governance/project-context-registry.json` and `plans/project-context.md`. The Pass 14 drift check (`validateProjectContextRegistryMirror`) verifies them row-for-row. Do not hand-edit these tables independently of the registry.

## Role Cards — Phase Executors

For each role: what it does, when the Planner assigns it, and the fact of execution being native Copilot.

### 1. CodeMapper-subagent

**Role:** Read-only discovery. "Where is the logic for X?", "Who uses function Y?", "Which files belong to subsystem Z?"

**When the Planner assigns it:** A phase needs codebase exploration before implementation can be planned concretely. Often the first phase of a MEDIUM/LARGE plan.

**Execution:** Native Copilot runs the phase inline (read + search tools). The role's discipline lives in `skills/patterns/completeness-traceability.md` and `skills/patterns/code-simplification.md`; the Planner may inject ≤3 patterns via `skill_references`.

**Output shape (contract doc):** `schemas/code-mapper.discovery.schema.json` — file list with types and annotations.

### 2. Researcher-subagent

**Role:** Research & evidence. "How does X work in library Y?", "What approaches exist for Z?" Distinct from CodeMapper: CodeMapper finds files; Researcher explains with cited evidence.

**When the Planner assigns it:** A phase needs external research or evidence-grounded explanation the codebase alone cannot answer.

**Execution:** Native Copilot (read + fetch). Discipline in `skills/patterns/source-grounding.md` and `skills/patterns/completeness-traceability.md`.

**Output shape:** `schemas/researcher.research-findings.schema.json` — structured findings with citations.

### 3. CoreImplementer-subagent

**Role:** Backend implementation — code, tests, refactoring. The **canonical backbone** for executors. UIImplementer and PlatformEngineer extend its rhythm with domain-specific gates (see `docs/agent-engineering/MIGRATION-CORE-FIRST.md`).

**Working rhythm (inherited):** read applicable patterns → PreFlect (4 risk classes, `skills/patterns/preflect-core.md`) → domain work test-first → gate verification (tests/build/lint) → structured report.

**When the Planner assigns it:** Any backend / non-UI implementation. The default executor.

**Execution:** Native Copilot (full implementation toolset). Discipline in `skills/patterns/tdd-patterns.md`, `skills/patterns/debugging-discipline.md`, `skills/patterns/error-handling-patterns.md`.

**Output shape:** `schemas/core-implementer.execution-report.schema.json` — changes / tests / build / lint / DoD evidence.

### 4. UIImplementer-subagent

**Role:** Frontend — components, styles, accessibility, responsive design.

**What it adds on top of the backbone:** accessibility (a11y) gate, responsive gate, design-system gate.

**When the Planner assigns it:** Any UI-facing change.

**Execution:** Native Copilot (full implementation toolset). Discipline in `skills/patterns/tdd-patterns.md`, `skills/patterns/code-simplification.md`, `skills/patterns/error-handling-patterns.md`.

**Output shape:** `schemas/ui-implementer.execution-report.schema.json` — `ui_changes`, accessibility/responsive report.

### 5. PlatformEngineer-subagent

**Role:** Infrastructure — CI/CD, containers, deployments.

**What it adds on top of the backbone:** approval gate (deployment requires explicit approval), idempotency gate, rollback plan, health checks, environment preconditions.

**When the Planner assigns it:** Infrastructure or deployment changes.

**Execution:** Native Copilot (full implementation toolset). Discipline in `skills/patterns/error-handling-patterns.md`, `skills/patterns/debugging-discipline.md`, `skills/patterns/integration-validator.md`.

**Output shape:** `schemas/platform-engineer.execution-report.schema.json` — approvals, health checks, rollback plan.

### 6. TechnicalWriter-subagent

**Role:** Documentation, diagrams, code ↔ docs synchronization.

**When the Planner assigns it:** A phase produces user-visible docs, diagrams, or requires code–doc parity work.

**Execution:** Native Copilot (edit + search). Discipline in `skills/patterns/completeness-traceability.md` and `skills/patterns/llm-behavior-guidelines.md`.

**Output shape:** `schemas/technical-writer.execution-report.schema.json` — `docs_created`, `docs_updated`, parity check, diagrams.

### 7. BrowserTester-subagent

**Role:** E2E browser tests, UI accessibility audit.

**Gate (health-first):** verify the application starts before running scenarios.

**When the Planner assigns it:** A phase needs E2E browser coverage or an accessibility audit.

**Execution:** Native Copilot (search + edit evidence). Discipline in `skills/patterns/tdd-patterns.md`, `skills/patterns/debugging-discipline.md`, `skills/patterns/error-handling-patterns.md`.

**Output shape:** `schemas/browser-tester.execution-report.schema.json` — scenarios, console/network failures, accessibility findings.

### 8. CodeReviewer-subagent

**Role:** Post-implementation review. The review-role persona.

**When the Planner assigns it:** Optionally at the final gate for LARGE tasks. In the slim model, `controlflow-review` already layers review over native Copilot code review, so a dedicated review _phase_ is optional — recreate a dedicated review persona only if you want one (see `NATIVE-DELEGATION-BOUNDARY.md §5`).

**What it checks:** correctness vs phase scope, security, code quality, quality-gate compliance (`tests_pass`, `lint_clean`, `schema_valid`, `safety_clear`), scope drift.

**Execution:** Native Copilot (search + run). Discipline in `skills/patterns/security-review-discipline.md`, `skills/patterns/decision-challenge.md`, `skills/patterns/llm-behavior-guidelines.md`.

**Output shape:** `schemas/code-reviewer.verdict.schema.json` — `APPROVED` / `NEEDS_REVISION` / `REJECTED`.

## Role Cards — Inline Verify Roles

These are not assigned via `executor_agent`. They are the three phases of `controlflow-verify`, performed inline in the main context (zero subagents).

### 9. PlanAuditor-subagent — verify phase 1 (structural audit)

Confirm the artifact conforms to `schemas/planner.plan.schema.json` and `plans/templates/plan-document-template.md`:

- YAML header present; `Status`, `Agent: Planner`, `Schema Version: 1.2.0`, numeric `Confidence`.
- All 10 sections present in order; 5 lifecycle sections present and ordered for SMALL+.
- Section 7 has exactly seven risk categories, each once.
- Every phase declares one `executor_agent` from the schema enum; quality gates use only the five standard values.
- Acceptance criteria include at least one measurable observable outcome per phase.
- LARGE tier includes `flowchart TD` + `sequenceDiagram`; each ≤30 lines.

Structural failure → `NEEDS_REVISION` immediately. Failure classification excludes `transient`.

### 10. AssumptionVerifier-subagent — verify phase 2 (mirage detection)

Try to refute the plan's factual claims. Every referenced file/path/symbol must be real (open or grep for it). Every assumption must be bounded. No "should be safe" hand-waving on concurrency or shared mutable state. The full mirage taxonomy is in `.github/skills/controlflow-verify/references/mirage-patterns.md` (presence mirages P1–P10, absence mirages A11–A17).

Why it supplements PlanAuditor: PlanAuditor reviews _design_; AssumptionVerifier reviews _factual accuracy of plan claims_. Different axes of validation.

### 11. ExecutabilityVerifier-subagent — verify phase 3 (executability cold-start)

Simulate a fresh executor starting Phase 1 with only the plan in hand:

- Can Phase 1 execute without asking the user a question? If yes → fine; if no → flag the ambiguity as a Phase 1 blocker.
- Are verification commands concrete enough to run as-is?
- Does each destructive or migration-heavy phase have rollback/recovery guidance? HIGH blast radius → require `human_approved_if_required`; MEDIUM → `safety_clear`.
- Is the inter-phase contract deliverable format explicit?

Tier gating: SMALL → phase 1 only; MEDIUM → phases 1–2; LARGE → phases 1–3. Any unresolved HIGH-impact semantic risk forces all three phases regardless of tier.

## Recreating a Specialized Agent as a Native Copilot Custom Agent

The refactor retires the legacy specialized `*.agent.md` files. Their _personas_ are not lost — the value-add patterns they embodied remain in `skills/patterns/`. If you want a specialized persona back as a shipped agent, recreate it as a **native Copilot custom agent** (a new file under `.github/agents/`) and have `controlflow-planner` assign it as a phase `executor_agent`. The Planner treats any agent file under `.github/agents/` as a valid conceptual executor role.

**Recipe (summary):**

1. Create a new agent file under `.github/agents/` with Copilot agent frontmatter (`name`, `description`, `tools`). Do **not** add `model:` — let the Copilot Auto picker choose, or pin a model only if the role demands it.
2. In the prompt body, cite the `skills/patterns/` files the persona should load (the former static binding).
3. Write the persona's discipline as prose (abstain when no executable harness is supplied; evidence over assertion; stop-the-line on regression). The pattern files carry the reusable discipline; the agent file carries the persona.
4. The Planner can now assign that role as a phase `executor_agent`. Execution is native Copilot.

See `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md §5` for the full recipe and worked examples (BrowserTester, UIImplementer, PlatformEngineer, Researcher, CodeMapper, TechnicalWriter, CodeReviewer). The three verify roles are **not** recreated as agents — they are the inline phases of `controlflow-verify`, the non-native value-add.

## Principle of Single Responsibility

Each role has a **narrow** area of responsibility. This is intentional:

- Narrow context → fewer hallucinations.
- Clear boundary → easier for the Planner to assign and for native Copilot to execute.
- Composition → complex workflows built from simple plan phases.
- Security → tool access is delegated to native Copilot, scoped per the agent's `tools:` frontmatter when recreated as a custom agent.

## Common Mistakes

- **Using CoreImplementer for a UI task.** Use `UIImplementer-subagent` — it adds a11y/responsive gates.
- **Using CodeMapper when understanding is needed.** Use `Researcher-subagent` — it produces evidence-based explanations.
- **Assigning a verify role as `executor_agent`.** Forbidden. `PlanAuditor-subagent`, `AssumptionVerifier-subagent`, and `ExecutabilityVerifier-subagent` are read-only verify phases performed by `controlflow-verify`.
- **Treating the role names as shipped agent files.** They are conceptual labels. The only shipped agent is `@controlflow-planner`. If you want a persona as a shipped agent, recreate it under `.github/agents/` (see above).
- **Looking for the legacy `*-subagent.agent.md` files.** They are retired (deleted). The discipline lives in `skills/patterns/`.

## Exercises

1. **(beginner)** Match each task to a role: `(a)` "Find all uses of API X", `(b)` "Add CSV export", `(c)` "Check plan for mirages", `(d)` "Write docs for a new endpoint", `(e)` "Deploy to staging".
2. **(beginner)** Open `plans/project-context.md` and the Phase Executor Agents table. Confirm all eight names match the table in this chapter.
3. **(intermediate)** Which three roles **can never** appear in `executor_agent`? Why?
4. **(intermediate)** How does `PlanAuditor-subagent` differ from `AssumptionVerifier-subagent` in what each reviews? (Design axis vs factual-accuracy axis.)
5. **(advanced)** Pick a retired persona (e.g. BrowserTester). Which `skills/patterns/` files carry its discipline? Draft the frontmatter for recreating it as a native Copilot custom agent under `.github/agents/`.

## Review Questions

1. How many conceptual executor roles are in the `executor_agent` enum, and how many inline verify roles are there?
2. Which role is the "canonical backbone" for executors?
3. Which role uses the mirage taxonomy, and which verify phase does it correspond to?
4. What does it mean that a role is a _conceptual label_, not a shipped agent file?
5. Where do you look for the discipline a retired specialized agent used to carry?

## See Also

- [Chapter 02 — Architecture Overview](02-architecture-overview.md)
- [Chapter 04 — Agent prompt structure (guidance)](04-part-spec.md)
- [Chapter 07 — Review Pipeline](07-review-pipeline.md)
- [Chapter 09 — Schemas (Contracts)](09-schemas.md)
- [plans/project-context.md](../../plans/project-context.md)
- [docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](../agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)