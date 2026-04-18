# Repo-Memory Hygiene Skill

## Purpose

Pre-write checklist and prune routine for ControlFlow's repo-persistent memory layer. Load this skill before any `/memories/repo/` write or `NOTES.md` update. Prevents the two most common memory pollution failure modes: near-duplicate repo-memory entries and task-history bloat in `NOTES.md`.

**Governance flag:** `governance/runtime-policy.json → memory_hygiene.repo_memory_dedup_required: true`. If this flag is present and true, following this checklist is mandatory before any `/memories/repo/` `create` call.

## When to Load

- Before calling `create` on `/memories/repo/`.
- Before updating `NOTES.md` at a phase boundary or task completion.
- When the `<repository_memories>` block in context shows near-duplicate entries.

Applicable agents: Orchestrator (mandatory at phase boundaries), Planner (before any repo-memory write after plan completion).

---

## Checklist A — Pre-Write Deduplication (`/memories/repo/`)

Work through every step before calling `create`. If any step returns "DO NOT WRITE", stop and do not create the entry.

### Step 1: Normalize the subject

Rewrite your intended `subject` field in canonical form:
- Strip the plan name, task slug, or date from the subject.
- Express it as a repo-wide invariant (e.g., "ControlFlow eval harness" not "memory-plan eval harness notes").
- If the subject is task-specific (only applies to one plan), it belongs in **task-episodic memory** (`plans/artifacts/<task-slug>/`), not `/memories/repo/`. **DO NOT WRITE.**

### Step 2: Check for near-duplicates by subject

Scan the `<repository_memories>` context block for entries whose `subject` overlaps semantically with your normalized subject. Two subjects overlap if they describe the same system, command, or invariant — even with different phrasing.

- If an existing entry covers the same subject with the same or more specific fact: **DO NOT WRITE.** The retention mechanism will naturally decay older entries.
- If an existing entry is outdated or wrong: write a corrected fact with an explicit note ("supersedes prior entry about X"). One correction write per outdated fact.

### Step 3: Check for fact-text similarity

Compare your `fact` text against existing entries with the same subject. Similarity threshold: if your fact would convey no additional information to a reader who already has the existing entry, it is a duplicate. **DO NOT WRITE.**

Key signal: the current `<repository_memories>` block for this repo already shows 6 near-identical entries about `cd evals && npm test`. Any new entry describing the eval harness command without a materially new fact is a duplicate.

### Step 4: Verify the fact is cross-plan

Ask: "Will this fact be actionable for a future task unrelated to the current plan?" If the answer is "only for this plan", it is task-episodic. **DO NOT WRITE** to `/memories/repo/`; record in `plans/artifacts/<task-slug>/` instead.

### Step 5: Fill all required fields

A `/memories/repo/` entry is only valid with all five fields: `subject`, `fact`, `citations` (concrete file + line references), `reason` (why this is worth storing cross-plan), `category`. An entry missing any field may cause downstream readers to misinterpret it. **DO NOT WRITE** until all five fields are complete.

---

## Checklist B — NOTES.md Prune Routine

Run at every phase boundary and at task completion. Target: ≤20 lines (enforced by `evals/validate.mjs` Pass 7).

### Step 1: Open NOTES.md

Read the full current content.

### Step 2: Identify active-objective lines

Keep only lines that answer: "What is the current task and phase, and what are the live blockers?" Maximum structure:
- One "Active objective" bullet (what plan/task is running and which phase/wave).
- One "Blockers" bullet (empty "none" if no blockers).
- One "Pending" bullet for a single most-important next action (optional).

### Step 3: Delete everything else

Remove: completed phase notes, iteration counts, verdict references, artifact paths, historical decisions, list of completed steps, embedded code blocks, cross-references to other tasks. These belong in `plans/artifacts/<task-slug>/` or are no longer needed.

### Step 4: Verify the updated content passes the style check

The content must pass `validateNotesMdStyle` (exported from `evals/drift-checks.mjs`). Violations that will fail CI:
- Lines containing `iteration` or `verdict`.
- Lines containing `phase-\d+-` artifact path fragments.
- More than 3 consecutive bullet items under a single heading.
- Fenced code blocks.

### Step 5: Verify line count ≤ 20

Count lines. If > 20, trim further. The 20-line budget is enforced by CI.

---

## When to Escalate (DO NOT WRITE)

Return `ABSTAIN` or skip the write entirely when:
- The fact is task-specific (only applies to the current plan).
- A near-duplicate already exists in `<repository_memories>`.
- All five required fields cannot be completed with direct evidence.
- The subject normalizes to a fact that is already captured more precisely by an existing entry.

---

## Related

- `docs/agent-engineering/MEMORY-ARCHITECTURE.md` — Cleanup & Enforcement section (authoritative spec).
- `governance/runtime-policy.json → memory_hygiene` — thresholds consumed by this skill.
- `evals/drift-checks.mjs` — exports `validateNotesMdStyle`.
- `evals/archive-completed-plans.mjs` — task-episodic auto-archive script.
