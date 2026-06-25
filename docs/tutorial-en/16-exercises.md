# Chapter 16 — Exercises

## Why this chapter

Practice tasks that reinforce the key concepts from all previous chapters. Grouped by level: 🟢 beginner, 🟡 intermediate, 🔴 advanced.

---

## 🟢 Exercise 1 — Repo Map

**Goal:** Get oriented in the repository structure.

1. Open `e:\WORK\Github\ControlFlow` (or `~/repos/ControlFlow`) in your file manager.
2. Find all `*.agent.md` files. How many are there?
3. Fill in the table:

| Category | Files |
|----------|-------|
| Orchestration | ? |
| Planning | ? |
| Adversarial review | ? |
| Executability | ? |
| Execution | ? |
| Post-review | ? |
| Research | ? |
| Documentation | ? |
| Testing | ? |

4. Which file does P.A.R.T. structure specification live in?

---

## 🟢 Exercise 2 — P.A.R.T. Analysis

**Goal:** Learn to read agent file structure.

1. Open `CoreImplementer-subagent.agent.md`.
2. Find the 4 P.A.R.T. sections: Prompt, Archive, Resources, Tools.
3. For the **Resources** section, list all referenced files.
4. For the **Tools** section, list allowed and disallowed tools.
5. Find `skill_references` in the file — is it present, and what skills are listed?

---

## 🟢 Exercise 3 — Run Evals

**Goal:** Learn the verification command.

1. Open a terminal.
2. Run `cd evals && npm test`.
3. Count the total number of checks.
4. Which pass runs the most checks?
5. Optionally redirect the run to a local file (`cd evals && npm test > out.txt`, which is gitignored) — what was the result?

---

## 🟢 Exercise 4 — NOTES.md

**Goal:** Understand repo-persistent memory.

1. Open `NOTES.md`.
2. What is the current active objective?
3. Are there any unresolved blockers?
4. When was the file last updated (based on its content)?
5. Does the file contain any stale (superseded) entries?

---

## 🟡 Exercise 5 — Tiers and Pipeline

**Goal:** Apply tier routing rules.

For each scenario, determine: **complexity tier** + **which reviewers run**.

| Scenario | Tier | Reviewers |
|----------|------|-----------|
| Add a localization key (1 file, low risk) | ? | ? |
| Refactor a service class (4 phases, no risk entries) | ? | ? |
| Migrate the database (6 phases, data_volume: HIGH) | ? | ? |
| Add an admin panel (8 phases, access_control: HIGH) | ? | ? |

Hint: check `governance/runtime-policy.json` → `review_pipeline_by_tier`.

---

## 🟡 Exercise 6 — Failure Routing

**Goal:** Apply the failure taxonomy.

For each failure scenario, state: **classification** + **Orchestrator action**.

| Scenario | Classification | Action |
|----------|---------------|--------|
| 1. CoreImplementer: TypeScript compiler not responding (timeout) | ? | ? |
| 2. UIImplementer: forgot to import a component | ? | ? |
| 3. PlanAuditor: phase 3 depends on a function that doesn't exist in the codebase | ? | ? |
| 4. PlatformEngineer: deployment will overwrite production data without a backup | ? | ? |
| 5. BrowserTester: Playwright crashes (rate limit) | ? | ? |
| 6. CoreImplementer: the entire architecture needs to be redesigned | ? | ? |
| 7. Researcher: the question contains a contradiction in requirements | ? | ? |

**Answers:**
1. `transient` → retry (max 3)
2. `fixable` → retry with hint (max 1)
3. `needs_replan` → Planner replan
4. `escalate` → STOP + user
5. `transient` → retry (max 3)
6. `needs_replan` → Planner replan
7. `escalate` → STOP + user

---

## 🟡 Exercise 7 — Schema Reading

**Goal:** Learn to navigate JSON Schemas.

1. Open `schemas/planner.plan.schema.json`.
2. Find `risk_review.items.properties.category.enum` — list all values.
3. Find `phases.items.properties.executor_agent.enum` — list all 8 values.
4. What is the minimum number of elements in `acceptance_criteria`?
5. Is `trace_id` required in the top-level plan, or optional?

---

## 🟡 Exercise 8 — Skill Selection

**Goal:** Practice skill assignment.

For each phase, choose ≤3 skills from `skills/index.md`.

| Phase | Recommended skills |
|-------|------------------|
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
| "All agent files must follow P.A.R.T. order" | ? | ? |

---

## 🔴 Exercise 10 — Full Design Flow

**Goal:** Simulate the complete pipeline.

**Input:** A user requests a "Report generator that exports user activity by date range."

1. What clarification questions should the Planner ask (minimum 3)?
2. Which `risk_review` categories apply?
3. What should `complexity_tier` be?
4. List 5–6 phases with executor_agent and wave.
5. Will PLAN_REVIEW activate? If so, which reviewers?
6. Which skills would you assign to the implementation phase?

---

## 🔴 Exercise 11 — Adversarial Mindset

**Goal:** Think like AssumptionVerifier.

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
4. Formulate a mirage for each BLOCKING assumption.

---

## 🔴 Exercise 12 — Mirage Hunting

**Goal:** Apply the 17 AssumptionVerifier patterns.

Open `AssumptionVerifier-subagent.agent.md` and find the list of 17 patterns.

For the following plan claim: *"The auth module caches tokens in Redis with a 15-minute TTL, so the rate limiter can rely on it."*

1. Which patterns apply?
2. List all verifiable facts.
3. What would you call the mirage if Redis caching turned out to be a feature in development, not production code?

---

## 🔴 Exercise 13 — Cold Start Simulation

**Goal:** Think like ExecutabilityVerifier.

**Given Phase 2, Task 1:**
```
"Add an endpoint for export:
  - Use Express.js
  - Return CSV in the response"
```

You are an executor arriving with only the repository and this description.

1. What is missing for you to start immediately?
2. List ≥5 concreteness gaps.
3. Propose a revised task description that closes these gaps.

---

## 🔴 Exercise 14 — Code Review Final Mode

**Goal:** Understand the final review gate.

**Given:**
- 5-phase LARGE task.
- Phase 1 created `src/auth/auth.ts`.
- Phase 3 modified `src/auth/auth.ts` and `src/users/users.ts`.
- Phase 5 modified `src/users/users.ts`.
- Final review found CRITICAL in `src/users/users.ts`.

1. What is the `changed_files[]` list (after deduplication)?
2. What is `plan_phases_snapshot[]` (phase_id → files[])?
3. Who is the fix executor for `src/users/users.ts`?
4. Can the Orchestrator re-run CodeReviewer on `review_scope: "final"` more than once?
5. If the fix executor also fails — what happens?

---

## Summary

| Level | Exercises | Key skills |
|-------|-----------|-----------|
| 🟢 Beginner | 1–4 | Navigation, structure reading, running the harness |
| 🟡 Intermediate | 5–9 | Tier routing, failure classification, schema reading, skill selection, memory layers |
| 🔴 Advanced | 10–14 | Full pipeline simulation, adversarial thinking, cold start analysis, final review |

## See Also

- [Chapter 15 — Case Studies](15-case-studies.md)
- [Chapter 17 — Glossary](17-glossary.md)
- [Chapter 18 — FAQ](18-faq.md)
