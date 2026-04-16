# Agentic Memory Architecture

Canonical three-layer memory model for the ControlFlow 13-agent system. Every agent's Archive section links here; agents add only agent-specific fields on top of this contract.

## Three Layers

### 1. Session memory — ephemeral, per-conversation

- **Lifetime:** single agent run. Dropped at task end or on compaction.
- **Location:** the agent's working context plus `/memories/session/` (accessed via the Copilot memory tool).
- **Readers/writers:** any agent during its run.
- **Contents:** in-progress reasoning, transient plans, tool output summaries, short-lived working state.
- **Do not use for:** facts that must survive the task or inform future tasks.

### 2. Task-episodic memory — per-plan, artifact-scoped

- **Lifetime:** persists for the life of a plan and beyond via commit history.
- **Location:** `plans/artifacts/<task-slug>/`. Phase deliverables, manifests, and audit records live here.
- **Readers/writers:** all agents participating in the plan. Reviewed and approved before commit.
- **Contents:** phase deliverables, migration manifests, audit verdicts, test evidence tied to a specific plan, operator sign-offs.
- **Canonical episodic record:** phase deliverables. Treat the `plans/artifacts/<task-slug>/` tree as the durable record of what happened during that task.

### 3. Repo-persistent memory — long-lived codebase facts

- **Lifetime:** indefinite, until superseded.
- **Location:**
  - `NOTES.md` — active objective + current high-level state only (≤20 lines).
  - Repo-memory via the Copilot memory tool under `/memories/repo/` — durable facts about conventions, commands, and invariants.
- **Readers/writers:** all agents. Governed by memory guidelines in mode instructions.
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

When an agent needs prior context, consult memory layers in this order:

1. **Task-episodic first.** `plans/artifacts/<task-slug>/` contains the authoritative record for the current plan. Read the relevant deliverables before anything else.
2. **Session next.** Short-lived working notes from the same conversation.
3. **Repo-persistent last.** `NOTES.md` anchors active objective; `/memories/repo/` supplies stable facts.

Rationale: task-episodic memory is the most specific and most trustworthy for the current work. Repo-persistent memory is the most general and lowest-resolution; consult it last so it does not override plan-specific decisions.

## Compaction Triggers

Trigger compaction when any of the following holds:

- **Context budget** — the agent's working context approaches its limit. Summarize and drop verbose intermediate tool output already reflected in a deliverable.
- **Phase boundary** — at the end of each phase, session notes are either promoted to a phase deliverable (task-episodic) or dropped. `NOTES.md` is updated to reflect the new active phase.
- **Task completion** — at plan completion, session memory is dropped, task-episodic artifacts are finalized and committed, and any cross-plan lesson is promoted to `/memories/repo/`. `NOTES.md` is trimmed back to active-objective state.

Compaction must preserve: active scope, unresolved blockers, safety constraints, and any deliverable paths referenced elsewhere.

## Pointer Convention for Agent Files

Every `*.agent.md` Archive section's `### Agentic Memory Policy` subsection follows this shape:

```markdown
### Agentic Memory Policy

See [docs/agent-engineering/MEMORY-ARCHITECTURE.md](../docs/agent-engineering/MEMORY-ARCHITECTURE.md) for the three-layer memory model.

Agent-specific fields:
- <1–3 bullets unique to this agent, if any; otherwise "none">
```

Rules:

- The pointer is canonical. Do not restate the three-layer model in the agent file.
- Agent-specific fields capture only what differs from the shared contract (e.g., "Orchestrator updates `NOTES.md` at each phase boundary"; "AssumptionVerifier is stateless per invocation").
- If an agent has no agent-specific fields, write `- none`.
- The heading level (`###`) must match the surrounding Archive subsections.

## Related Documents

- `docs/agent-engineering/PART-SPEC.md` — overall P.A.R.T. structure.
- `docs/agent-engineering/MIGRATION-CORE-FIRST.md` — shared implementation backbone including compaction rules.
- `.github/copilot-instructions.md` — short pointer to this doc.
