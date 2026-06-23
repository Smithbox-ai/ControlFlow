# Chapter 16 — Exercises

## Why this chapter

Practice tasks that reinforce the key concepts from all previous chapters. Grouped by level: 🟢 beginner, 🟡 intermediate, 🔴 advanced. The exercises reflect the slim ControlFlow surface: one agent (`@controlflow-planner`), three skills (`controlflow-plan` / `controlflow-verify` / `controlflow-review`), and native Copilot executing the phases.

---

## 🟢 Exercise 1 — Slim Surface Map

**Goal:** Get oriented in the shipped repository structure.

1. Open the repo in your editor.
2. List the files under `.github/agents/` and `.github/skills/`. Confirm the shipped surface is one agent plus three skills.
3. Fill in the table:

| Category | Path | Purpose |
|----------|------|---------|
| Planner agent | `.github/agents/…` | ? |
| Plan skill | `.github/skills/…` | ? |
| Verify skill | `.github/skills/…` | ? |
| Review skill | `.github/skills/…` | ? |
| Routing stub | `.github/…` | ? |

4. Open `.github/copilot-instructions.md` and find the tier table. Which tier skips the pipeline entirely?

---

## 🟢 Exercise 2 — Planner Agent + Skill Reading

**Goal:** Learn to read the planner agent and a skill.

1. Open `.github/agents/controlflow-planner.agent.md`.
2. Find the frontmatter fields (`description`, `name`, `tools`). Confirm there is no `model:` line.
3. Identify the sections in the body (e.g., "Load the planning skill", "Idea Interview", "Write the plan artifact", "Hand off to native Copilot").
4. Open `.github/skills/controlflow-plan/SKILL.md` and read what the plan skill does.
5. List the `skill_references` (value-add patterns) the Planner may inject per phase. What is the maximum per phase?

---

## 🟢 Exercise 3 — Run Evals

**Goal:** Learn the verification command.

1. Open a terminal.
2. Run `cd evals && npm test`.
3. Count the total number of checks across all passes.
4. Which pass runs the most checks?
5. Optionally redirect the run to a local file (`cd evals && npm test > out.txt`, which is gitignored) — what was the result?

---

## 🟢 Exercise 4 — NOTES.md

**Goal:** Understand repo-persistent memory.

1. Open `NOTES.md`.
2. What is the current active objective?
3. Are there any unresolved blockers?
4. When was the file last updated (based on its content)?
5. Does the file contain any stale (superseded) entries? What does the memory-hygiene pattern at `skills/patterns/repo-memory-hygiene.md` say to do with them?

---

## 🟡 Exercise 5 — Tiers and Pipeline

**Goal:** Apply the tier-gated policy.

For each scenario, determine: **complexity tier** + **which verify phases run**.

| Scenario | Tier | Verify phases |
|----------|------|---------------|
| Add a localization key (1 file, low risk) | ? | ? |
| Refactor a service class (4 files, no HIGH risk) | ? | ? |
| Migrate the database (8 files, `data_volume: HIGH`, unresolved) | ? | ? |
| Add an admin panel (10 files, `access_control: HIGH`, unresolved) | ? | ? |

Hint: check `governance/runtime-policy.json` → `review_pipeline_by_tier`, and remember the HIGH-risk override rule.

---

## 🟡 Exercise 6 — Failure Routing

**Goal:** Apply the failure taxonomy and identify who routes.

For each failure scenario, state: **classification** + **who routes it** (native Copilot or re-invoke `@controlflow-planner`).

| Scenario | Classification | Routed by |
|----------|---------------|-----------|
| 1. CoreImplementer: TypeScript compiler not responding (timeout) | ? | ? |
| 2. UIImplementer: forgot to import a component | ? | ? |
| 3. Mid-execution: phase 3 depends on a function that doesn't exist in the codebase | ? | ? |
| 4. PlatformEngineer: deployment will overwrite production data without a backup | ? | ? |
| 5. BrowserTester: Playwright crashes (rate limit) | ? | ? |
| 6. CoreImplementer: the entire architecture needs to be redesigned | ? | ? |
| 7. Researcher: the routed/primary model is unreachable | ? | ? |

**Answers:**
1. `transient` → native Copilot retries.
2. `fixable` → native Copilot retries with a fix hint.
3. `needs_replan` → re-invoke `@controlflow-planner` for a targeted replan.
4. `escalate` → native Copilot stops; user approval required.
5. `transient` → native Copilot retries.
6. `needs_replan` → re-invoke `@controlflow-planner`.
7. `model_unavailable` → native Copilot substitutes a model, then escalates on exhaustion.

---

## 🟡 Exercise 7 — Schema Reading

**Goal:** Learn to navigate JSON schemas.

1. Open `schemas/planner.plan.schema.json`.
2. Find `risk_review.items.properties.category.enum` — list all seven values.
3. Find `phases.items.properties.executor_agent.enum` — list all eight executor role names.
4. What is the minimum number of elements in `acceptance_criteria`?
5. Which three verify role names are **excluded** from the `executor_agent` enum, and why?

---

## 🟡 Exercise 8 — Skill Pattern Selection

**Goal:** Practice Planner-injected pattern selection.

For each phase, choose up to three patterns from `skills/index.md`.

| Phase | Recommended patterns |
|-------|---------------------|
| "Write integration tests for the payment API" | ? |
| "Implement the export handler (backend)" | ? |
| "Write docs for the new API (with Mermaid diagrams)" | ? |
| "Deploy the service to staging (with rollback)" | ? |
| "Research alternatives for Redis caching" | ? |

---

## 🟡 Exercise 9 — Memory Placement

**Goal:** Determine the right memory layer for each fact.

For each fact, state: **memory layer** + **file/path**.

| Fact | Layer | Location |
|------|-------|----------|
| "The verification command is `cd evals && npm test`" | ? | ? |
| "Phase 3 complete, phase 4 in progress" | ? | ? |
| "PlanAuditor found 2 BLOCKING issues in iteration 1" | ? | ? |
| "User prefers flat CSV format" | ? | ? |
| "The slim model ships one planner agent and three skills" | ? | ? |

---

## 🔴 Exercise 10 — Full Pipeline Trace

**Goal:** Simulate the complete plan → verify → review pipeline.

**Input:** A user requests a "Report generator that exports user activity by date range."

1. What clarification questions should the Planner ask in the Idea Interview (minimum 3)?
2. Which `risk_review` categories apply, and which are `not_applicable` with justification?
3. What should `complexity_tier` be? Does the HIGH-risk override fire?
4. List 5–6 phases with `executor_agent` and a one-line objective.
5. Which verify phases run, and which inline verify role labels correspond to them?
6. Which `skills/patterns/` would you inject (≤3) into the implementation phase?

---

## 🔴 Exercise 11 — Adversarial Mindset

**Goal:** Think like `AssumptionVerifier-subagent` (verify phase 2).

**Given this fragment from a plan:**
```
Phase 3: "Implement export
  - Use the existing UserExportService class
  - Call the method getActivityByDateRange(userId, from, to)
  - The results are already paginated"
```

1. List all **assumptions** in this fragment.
2. Which assumptions can be verified in the codebase?
3. Which are BLOCKING if false?
4. Formulate a mirage for each BLOCKING assumption (using the P1–P10 / A11–A17 taxonomy in `.github/skills/controlflow-verify/references/mirage-patterns.md`).

---

## 🔴 Exercise 12 — Mirage Hunting

**Goal:** Apply the mirage taxonomy.

Open `.github/skills/controlflow-verify/references/mirage-patterns.md` and read the presence (P1–P10) and absence (A11–A17) mirage patterns.

For the following plan claim: *"The auth module caches tokens in Redis with a 15-minute TTL, so the rate limiter can rely on it."*

1. Which patterns apply?
2. List all verifiable facts.
3. What would you call the mirage if Redis caching turned out to be a feature in development, not production code?

---

## 🔴 Exercise 13 — Cold Start Simulation

**Goal:** Think like `ExecutabilityVerifier-subagent` (verify phase 3).

**Given Phase 2, Task 1:**
```
"Add an endpoint for export:
  - Use Express.js
  - Return CSV in the response"
```

You are a fresh executor arriving with only the repository and this plan description.

1. What is missing for you to start immediately without asking the user?
2. List at least five concreteness gaps (file path, route, auth, validation, verification command, rollback if destructive).
3. Propose a revised task description that closes these gaps.

---

## 🔴 Exercise 14 — Recreate a Specialized Agent

**Goal:** Recreate a retired persona as a native Copilot custom agent.

Per `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md §5`:

1. Pick a retired persona (e.g., `BrowserTester-subagent`).
2. List the `skills/patterns/` files that carry its discipline (see the worked-examples table in §5).
3. Draft a stub `browser-tester.agent.md` to live under `.github/agents/`:
   - Frontmatter: `name`, `description`, `tools` (no `model:` line).
   - Body: cite the patterns in a `## Resources` section; write the abstain rule ("abstain when no executable harness is supplied").
4. How would the Planner assign this recreated agent as a phase `executor_agent`? What would native Copilot do when the phase runs?

---

## Summary

| Level | Exercises | Key skills |
|-------|-----------|------------|
| 🟢 Beginner | 1–4 | Slim surface navigation, planner/skill reading, running the harness, repo memory |
| 🟡 Intermediate | 5–9 | Tier routing, failure classification, schema reading, pattern selection, memory layers |
| 🔴 Advanced | 10–14 | Full pipeline trace, adversarial thinking, cold-start analysis, specialized-agent recreation |

## See Also

- [Chapter 15 — Case Studies](15-case-studies.md)
- [Chapter 17 — Glossary](17-glossary.md)
- [Chapter 18 — FAQ](18-faq.md)
- [docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](../agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)