# Chapter 12 — Memory Architecture

## Why this chapter

Understand **where state lives** across the plan → verify → review pipeline and why the three-layer memory model prevents context loss across context resets. The memory model is unchanged by the slim refactor; what changed is who writes to it. In the slim model, native Copilot executes phases inline (the conceptual executor roles the Planner assigns), `@controlflow-planner` owns the plan artifact, and the user re-invokes the Planner for replans. There is no Orchestrator agent writing to `NOTES.md` at every phase boundary — that write is now the user's (or native Copilot's) responsibility at phase boundaries.

## Key Concepts

- **Session memory** — conversation-scoped scratch; cleared after the conversation ends.
- **Task-episodic memory** — per-task history in `plans/artifacts/<task-slug>/`; persists beyond the conversation.
- **Repo-persistent memory** — durable facts in `NOTES.md` + `/memories/repo/`; survives context resets.
- **Context compaction** — trimming context when the budget runs out; memory layers allow recovery.
- **Conceptual role, not shipped agent** — the executor roles that read and write memory are the preserved 8-name conceptual taxonomy executed inline by native Copilot (see chapter 03). There is no Orchestrator agent file in the slim model.

## Three-Layer Memory Model

```mermaid
flowchart TD
    subgraph L1["Layer 1: Session"]
        SM["/memories/session/<br/>Conversation scratch<br/>Cleared on reset"]
    end
    subgraph L2["Layer 2: Task-Episodic"]
        TE["plans/artifacts/<task-slug>/<br/>Per-task: decisions,<br/>revision history, deliverables"]
    end
    subgraph L3["Layer 3: Repo-Persistent"]
        NM["NOTES.md<br/>Active objective state"]
        RM["/memories/repo/<br/>Durable codebase facts"]
    end
    L1 -->|promote at phase boundaries| L2
    L2 -->|promote when the task is complete| L3
```

The canonical spec is `docs/agent-engineering/MEMORY-ARCHITECTURE.md`. Every conceptual role that writes to memory follows the same three-layer contract.

## Memory Content Taxonomy

Every entry written to `/memories/repo/` should be classified into one of four content types:

| Type | What to store |
|------|--------------|
| `user` | Personal preferences and workflows spanning the entire environment |
| `feedback` | Historical corrections: past mistakes, constraints the agent must respect |
| `project` | Core architecture decisions, structure, and established project conventions |
| `reference` | Verified CLI commands, configuration values, and build instructions |

**Save exclusions — never write these to repo-persistent memory:**
- Derivable code state (anything that can be re-read from the repo directly).
- Git history (commit messages, branch names, merge records).
- Ephemeral task state (single-turn notes, tool scratch, "iteration 3 passed at 14:32").

**Verify before recommending:** any claim about a named file or function that comes from memory must be re-verified against the current codebase before being acted on or reported. Memory is a hint, not a source of truth for specific code locations.

## Layer 1: Session Memory

**Location:** `/memories/session/`

**Purpose:** Scratch space for the current conversation. Stores:
- Current phase context.
- Intermediate research notes.
- Open questions for this session.

**Rules:**
- Do not create new session files unnecessarily.
- List existing files before reading — they are not auto-loaded into context.
- Cleared when the conversation ends.
- For long orchestration runs, use the session notes template at `plans/templates/session-notes-template.md`. It provides five sections: `Current State`, `Files and Functions`, `Errors & Corrections`, `Key Results`, `Worklog`.

**Who uses it:** Any conceptual role during its run (executed inline by native Copilot).

## Layer 2: Task-Episodic Memory

**Location:** `plans/artifacts/<task-slug>/`

**Purpose:** History for one specific task. Stores:
- Revision history (why was the plan revised?).
- Verified items across iterations.
- Phase completion reports.
- Intermediate deliverables (designs, diagrams, verify verdicts).

**Rules:**
- Create one folder per task; slug = kebab-case task title.
- Contents persist beyond the conversation.
- The Planner and native Copilot read this in revision loops to populate regression tracking.

**Examples of files in a task folder:**
- `verify-verdict.md` — the compact verdict written by `controlflow-verify`.
- `final_review.md` — optional final review advisory from `controlflow-review`.
- `verified_items.md` — verified items from iteration 1.

## Layer 3: Repo-Persistent Memory

**Two locations:**

### NOTES.md

**Purpose:** Active-objective state only. Contains:
- Current active goal and its phase.
- Unresolved blockers and risks.
- Current phase boundary.

**Rules:**
- Update at each phase boundary (the user or native Copilot during execution; the Planner does not write mid-execution).
- Remove stale entries when superseded.
- Keep within the 20-line budget (enforced by `evals/validate.mjs` Pass 7; style drift checked via `validateNotesMdStyle` in `evals/drift-checks.mjs`).
- Do not use `NOTES.md` for task-specific history — that goes in task-episodic memory.

### /memories/repo/

**Purpose:** Durable codebase facts that survive context resets. Examples:
- "The test command is `cd evals && npm test`."
- "PlanAuditor excludes the `transient` failure classification."
- "The slim model ships one agent and three skills."

**Rules:**
- Only `create` is supported — no inline edits.
- Each fact must be short (1–2 sentences), with citations.
- Store only if: independently actionable, unlikely to change, relevant to future tasks.

## Read and Write Rules

| Event | Read | Write |
|-------|------|-------|
| Context start | Session (if exists), `NOTES.md` | — |
| Plan written | `NOTES.md`, repo-persistent | `plans/<task-slug>-plan.md` (task-episodic) |
| Phase start | Task-episodic (relevant files) | Session note; promote durable cross-plan facts to `/memories/repo/` using Checklist C in `skills/patterns/repo-memory-hygiene.md` |
| Phase end | — | Task-episodic (completion report, `NOTES.md`) |
| Task complete | — | `/memories/repo/` (durable facts) |
| Conversation end | — | Session files cleared |

Before writing to `/memories/repo/` or updating `NOTES.md` at a phase boundary, load and follow `skills/patterns/repo-memory-hygiene.md` (dedup checklist + prune routine).

## Example Scenario

| Step | Who | Memory layer |
|------|-----|--------------|
| 1 | User says "implement feature X" | — |
| 2 | `@controlflow-planner` reads `NOTES.md` | Repo-persistent |
| 3 | Planner writes `plans/feature-x-plan.md`; task-episodic dir created | Task-episodic |
| 4 | `controlflow-verify` writes `verify-verdict.md` | Task-episodic |
| 5 | Phase 1 executes (native Copilot inline); completion report written | Task-episodic |
| 6 | Context resets | Session cleared |
| 7 | Native Copilot reads `NOTES.md` and `plans/artifacts/feature-x/` | Both layers |
| 8 | Task complete; write durable fact about the API convention | `/memories/repo/` |

## Context Compaction Policy

When context budget approaches the limit, native Copilot (executing the current phase):
- **Keeps:** active phase, unresolved blockers, approved decisions, safety constraints.
- **Drops:** verbose intermediate tool output already summarized.
- **Emits:** compact summary in deterministic bullets before proceeding.

The compaction ladder (L1 inline truncation → L2 summary replacement → L3 chunk discard → L4 spill to disk under `.cache/tool-output/<task-slug>/` → L5 hard reset preserving continuity through `NOTES.md` and the task-episodic artifact tree) is specified in `docs/agent-engineering/MEMORY-ARCHITECTURE.md`.

The idea: session and task-episodic layers hold the state, so the model can be reset without losing task history.

## Memory Pollution

Excessive or noisy memory records are **memory pollution**. Symptoms:
- `NOTES.md` grows with stale entries.
- `/memories/repo/` records facts that change frequently.
- Session files accumulate unused notes.

**Prevention:**
- Prune stale `NOTES.md` entries at each phase boundary.
- Only store facts meeting the "durable" criteria in `/memories/repo/`.
- Don't create new session files unless necessary.

## Memory Use Discipline

Two behavioral invariants (enforced by `evals/tests/prompt-behavior-contract.test.mjs`):

1. **Verify before use** — any named file or named function claim that originates from memory (session notes, `/memories/repo/`, or `NOTES.md`) must be re-verified against the current codebase before being acted on or reported to the user. Stale memory is a hint, not a source of truth for specific code locations.

2. **Ignore memory on request** — when the user explicitly says "ignore memory" (or equivalent: "don't use memory", "fresh context"), the agent must not consult `/memories/repo/`, `NOTES.md`, or session notes for that turn. This override is per-turn and does not persist.

See `docs/agent-engineering/PROMPT-BEHAVIOR-CONTRACT.md → §7 Memory Use Discipline`.

## Task-Episodic Auto-Archive

`plans/artifacts/<task-slug>/` accumulates indefinitely unless explicitly archived. The tooling:

- **Script:** `evals/archive-completed-plans.mjs` — scans `plans/*.md`, detects closed plans (status `DONE`, `SUPERSEDED`, `DEFERRED`), checks age ≥ 14 days, then moves the plan and its matched artifact directory to `plans/archive/<YYYY-MM>/`. Dry-run by default (`npm run archive:dry`); `--apply` mode to execute (`npm run archive:apply`).
- **Safety:** idempotent, no deletes, `READY_FOR_EXECUTION` plans are never eligible.

To identify plans ready for archival: `cd evals && npm run archive:dry`. To execute: `npm run archive:apply`.

## Logical vs Physical Storage

| Logical Layer | Physical Location |
|---------------|-----------------|
| Session memory | `/memories/session/` (VS Code / Copilot Chat) |
| Task-episodic | `plans/artifacts/<task-slug>/` (file system) |
| Repo-persistent | `NOTES.md` + `/memories/repo/` (file system + Copilot memory tool) |

## Common Mistakes

- **Writing unclassified or derivable facts to `/memories/repo/`.** Use the content taxonomy to classify first; discard derivable code state, git history, and ephemeral task state before promoting.
- **Acting on stale memory without verification.** Named file and function claims from memory become incorrect after refactoring. Always re-verify against the current codebase before acting.
- **Creating session files for everything.** They should be minimal scratch — not a full task journal.
- **Forgetting to read task-episodic memory after a reset.** Regression tracking and verified items are there.
- **Looking for an Orchestrator agent to update `NOTES.md`.** There is no Orchestrator agent in the slim model. The user or native Copilot updates `NOTES.md` at phase boundaries; the Planner does not write mid-execution.

## Exercises

1. **(beginner)** Open `NOTES.md` — what is the current active objective?
2. **(beginner)** Which memory layer stores per-task revision history?
3. **(intermediate)** A phase completes successfully. What should be written to memory and where?
4. **(intermediate)** A context reset occurs at phase 3 of 6. What data does native Copilot have available to reconstruct state?
5. **(advanced)** Design a memory usage strategy for a LARGE-tier 10-phase task that requires resumability after a context reset.
6. **(intermediate)** A phase just completed. You noticed that the executor discovered a new API convention. Walk through Checklist C (in `skills/patterns/repo-memory-hygiene.md`) to decide whether to promote this fact to `/memories/repo/`.
7. **(advanced)** Your `/memories/repo/` context block shows six entries with slightly different descriptions of the same `cd evals && npm test` command. Run Checklist D (periodic audit) to produce an Audit Report for this situation.

## Review Questions

1. Name the 3 memory layers.
2. What does `NOTES.md` store, and what is its line budget?
3. What are task-episodic deliverables?
4. What is memory pollution?
5. Who updates `NOTES.md` at phase boundaries in the slim model?

## See Also

- [docs/agent-engineering/MEMORY-ARCHITECTURE.md](../agent-engineering/MEMORY-ARCHITECTURE.md)
- [Chapter 05 — The plan → verify → review pipeline](05-orchestration.md)
- [Chapter 08 — Execution Pipeline](08-execution-pipeline.md)
- [Chapter 11 — Skills](11-skills.md)
- [NOTES.md](../../NOTES.md)