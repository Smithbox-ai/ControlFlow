# Agentic Memory Architecture

Canonical three-layer memory model for ControlFlow's slim Copilot-first surface: one `@controlflow-planner` agent and three skills (`controlflow-plan`, `controlflow-verify`, `controlflow-review`) running over native Copilot. The Planner and the skills share this memory contract; native Copilot provides session memory and subagent dispatch. There is no Orchestrator and no shipped subagent roster — the conceptual executor roles (`CodeMapper-subagent`, `Researcher-subagent`, `CoreImplementer-subagent`, `UIImplementer-subagent`, `PlatformEngineer-subagent`, `TechnicalWriter-subagent`, `BrowserTester-subagent`, `CodeReviewer-subagent`) and the three inline verify roles (`PlanAuditor-subagent`, `AssumptionVerifier-subagent`, `ExecutabilityVerifier-subagent`) are labels the Planner assigns in plan phases and native Copilot executes inline.

## Three Layers

### 1. Session memory — ephemeral, per-conversation

- **Lifetime:** single Planner turn or a single native Copilot execution run. Dropped at task end or on compaction.
- **Location:** native Copilot's working context plus `/memories/session/` (accessed via the Copilot memory tool).
- **Readers/writers:** the `@controlflow-planner` agent, the three skills, and any native Copilot execution context running a plan phase.
- **Contents:** in-progress reasoning, transient plans, tool output summaries, short-lived working state.
- **Do not use for:** facts that must survive the task or inform future tasks.
- Use the session notes template at [plans/templates/session-notes-template.md](../../plans/templates/session-notes-template.md) for structured state during long-running work.

### 2. Task-episodic memory — per-plan, artifact-scoped

- **Lifetime:** persists for the life of a plan and beyond via commit history.
- **Location:** `plans/artifacts/<task-slug>/`. Phase deliverables, manifests, and audit records live here.
- **Readers/writers:** the Planner, the verify/review skills, and native Copilot execution contexts participating in the plan. Reviewed and approved before commit.
- **Contents:** phase deliverables, migration manifests, audit verdicts, test evidence tied to a specific plan, operator sign-offs.
- **Canonical episodic record:** phase deliverables. Treat the `plans/artifacts/<task-slug>/` tree as the durable record of what happened during that task.

### 3. Repo-persistent memory — long-lived codebase facts

- **Lifetime:** indefinite, until superseded.
- **Location:**
  - `NOTES.md` — active objective + current high-level state only (≤20 lines).
  - Repo-memory via the Copilot memory tool under `/memories/repo/` — durable facts about conventions, commands, and invariants.
- **Readers/writers:** the Planner, the skills, and native Copilot execution contexts. Governed by the memory hygiene pattern in `skills/patterns/repo-memory-hygiene.md`.
- **Contents:** active objective, current phase, repo-wide conventions, verified build/test commands, stable architectural invariants.
- **Do not use for:** task-specific minutiae (those belong in task-episodic memory).

## Write Rules

| Fact kind | Target layer |
|-----------|--------------|
| Transient reasoning, tool scratch, in-progress notes | Session |
| Phase deliverables, audit reports, migration manifests, task-specific test evidence | Task-episodic (`plans/artifacts/<task-slug>/`) |
| Active objective and current phase only | `NOTES.md` |
| Repo-wide conventions, verified commands, architectural invariants | `/memories/repo/` |
| Historical per-task state already captured in a deliverable | Do not re-record; link to the artifact |

Rule of thumb: if a fact applies to exactly one plan, it belongs in task-episodic memory. If it applies across plans, it belongs in repo-persistent memory. If it will not outlive the current turn, leave it in session memory.

## Read Rules

When the Planner or a skill needs prior context, consult memory layers in this order:

1. **Task-episodic first.** `plans/artifacts/<task-slug>/` contains the authoritative record for the current plan. Read the relevant deliverables before anything else.
2. **Session next.** Short-lived working notes from the same conversation (native Copilot context).
3. **Repo-persistent last.** `NOTES.md` anchors active objective; `/memories/repo/` supplies stable facts.

Rationale: task-episodic memory is the most specific and most trustworthy for the current work. Repo-persistent memory is the most general and lowest-resolution; consult it last so it does not override plan-specific decisions.

## Memory Content Taxonomy

The `/memories/repo/` layer accepts only a small set of content types. Every repo-persistent write must classify its entry as one of:

- `user` — Personal preferences and workflows spanning the entire environment.
- `feedback` — Historical corrections detailing past mistakes and constraints.
- `project` — Core architectural designs, structure, and established conventions.
- `reference` — Tested CLI commands, verified configuration, and build instructions.

**Save exclusions:** derivable code state (code that can be re-read from the repo), git history, ephemeral task state (single-turn notes or tool scratch) — never write these to `/memories/repo/`.

**Verify before recommending:** any claim about a named file or function sourced from memory must be re-verified against current code before being acted on (links to the `Memory Use Discipline` invariant in [PROMPT-BEHAVIOR-CONTRACT.md](PROMPT-BEHAVIOR-CONTRACT.md)).

## Compaction Triggers

Native Copilot owns compaction, context budgeting, and retry routing for execution contexts. The Planner and the skills trigger compaction only at the discipline boundaries ControlFlow owns:

- **Phase boundary** — at the end of each plan phase, session notes are either promoted to a phase deliverable (task-episodic) or dropped. `NOTES.md` is updated to reflect the new active phase.
- **Task completion** — at plan completion, session memory is dropped, task-episodic artifacts are finalized and committed, and any cross-plan lesson is promoted to `/memories/repo/`. `NOTES.md` is trimmed back to active-objective state.
- **Context budget** — when native Copilot signals context pressure, summarize and drop verbose intermediate tool output already reflected in a deliverable.

Compaction must preserve: active scope, unresolved blockers, safety constraints, and any deliverable paths referenced elsewhere.

## Compaction Ladder

- **L1 — Inline truncation**: brief per-message truncation of overly long tool outputs while keeping the message record.
- **L2 — Summary replacement**: replace verbose tool output with a concise summary plus pointer.
- **L3 — Chunk discard**: drop resolved/closed intermediate chunks that are no longer referenced.
- **L4 — Spill to disk**: write oversized raw output to `.cache/tool-output/<task-slug>/` and keep only the path + summary in context.
- **L5 — Hard reset**: reset the context, preserving continuity through `NOTES.md` and the task-episodic artifact tree.

## Cleanup & Enforcement

Automation and machine-enforced invariants that prevent the canonical pollution failure modes.

### NOTES.md Invariants

- **Size cap:** `NOTES.md` must not exceed 20 lines (enforced by `evals/validate.mjs` Pass 7, sourced from `evals/scenarios/memory-architecture-references.json`; the governance mirror was the retired `memory_hygiene.notes_md_max_lines` block).
- **Style anti-patterns (CI-enforced):** Pass 7 also runs `validateNotesMdStyle` (exported from `evals/drift-checks.mjs`). Lines that match any of the following patterns fail the check:
  - Contains `iteration` or `verdict` (task-history leakage).
  - Contains an artifact path fragment matching `phase-\d+-` (phase-level task reference).
  - More than 3 consecutive bullet items under a single heading.
  - Fenced code block (triple backtick).
- **Prune rule:** at every plan phase boundary, the active execution context updates `NOTES.md`. Load `skills/patterns/repo-memory-hygiene.md` for the step-by-step prune checklist.

### Repo-Memory Write-Side Deduplication

`/memories/repo/` supports only `create`. There is no delete or update API. Natural decay via tool-level retention is the only automatic cleanup path. The write-side control is:

- **Before any `/memories/repo/` write**, the writing context (Planner, a skill, or a native Copilot execution run) MUST load and follow `skills/patterns/repo-memory-hygiene.md` (the repo-memory hygiene pattern). The checklist covers subject normalization, near-duplicate detection by fact-text similarity, and citation-overlap detection.

### Task-Episodic Auto-Archive

`plans/artifacts/<task-slug>/` accumulates indefinitely unless explicitly archived. The automation tooling:

- **Script:** `evals/archive-completed-plans.mjs` — scans `plans/*.md`, detects closed plans (status in the archive-eligible set: `DONE`, `SUPERSEDED`, `DEFERRED`), checks age ≥ 14 days, then moves the plan and its matched artifact directory to `plans/archive/<YYYY-MM>/`. Dry-run by default (`npm run archive:dry`); `--apply` mode to execute (`npm run archive:apply`).
- **Artifact mapping:** uses a conservative prefix/substring heuristic; logs `[MANUAL REVIEW NEEDED]` and skips artifact archival when no confident match is found — the plan file is still moved.
- **Safety:** idempotent, no deletes, `READY_FOR_EXECUTION` plans are never eligible.

## Related Documents

- [NATIVE-DELEGATION-BOUNDARY.md](NATIVE-DELEGATION-BOUNDARY.md) — the canonical native-vs-ControlFlow delegation boundary (what native Copilot owns, what ControlFlow keeps).
- [PROMPT-BEHAVIOR-CONTRACT.md](PROMPT-BEHAVIOR-CONTRACT.md) — behavioral invariants, including the `Memory Use Discipline` referenced above.
- `.github/copilot-instructions.md` — short pointer to this doc.
- `skills/patterns/repo-memory-hygiene.md` — write-side dedup checklist for `/memories/repo/` and `NOTES.md` prune routine.
- `evals/archive-completed-plans.mjs` — task-episodic auto-archive script.
- `evals/drift-checks.mjs` — exports `validateNotesMdStyle` consumed by Pass 7.

## Phase Boundary Cache Check

Before the Planner finalizes a phase (or before `controlflow-verify`/`controlflow-review` accepts one), the active context scans `plans/artifacts/` (task-episodic memory) for recently completed phases or tasks whose scope overlaps the current phase. This is a read-only operation against the task-episodic layer.

**Evidence source:** task-episodic memory (`plans/artifacts/<task-slug>/`) — the authoritative record of completed work.

**Output:** a human-visible recommendation only. The check cannot silently complete a phase, skip an approval gate, or modify the plan. Retry routing, parallelism, and mid-execution clarification are native Copilot's job; the Planner can be re-invoked for a replan when the recommendation surfaces a real overlap.

**Memory layer relationship:**

- Reads from: task-episodic (`plans/artifacts/`).
- Does not write to any memory layer. The recommendation is surfaced inline in the Planner or verify progress summary.