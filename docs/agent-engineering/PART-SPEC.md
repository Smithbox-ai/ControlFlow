# Agent Prompt Structure (Guidance)

## Purpose

This document is guidance for writing a good custom agent prompt for `.github/agents/` — not a mandatory template enforced on shipped surfaces. The slim ControlFlow model ships exactly one agent (`.github/agents/controlflow-planner.agent.md`); any additional agents you add under `.github/agents/` are native Copilot custom agents and should follow the discipline below.

### Historical note: P.A.R.T. (retired)

The legacy ControlFlow model enforced a mandatory four-section structure on every `*.agent.md` file: **Prompt → Archive → Resources → Tools** (P.A.R.T.). That mandatory structure is **retired**. The retired model's root `*.agent.md` files (Orchestrator, Planner, and the specialized subagents) were deleted when the slim model shipped, and P.A.R.T. is no longer enforced by any gate. The discipline behind those four sections still informs how a good custom agent prompt is written, so it is preserved below as informative guidance — not as a contract.

## The slim shipped agent (worked example)

The sole shipped ControlFlow agent is `.github/agents/controlflow-planner.agent.md`. Its frontmatter is minimal Copilot agent frontmatter:

```yaml
---
description: "ControlFlow Planner — produces a saved, schema-conforming ControlFlow plan artifact in plans/ before implementation. ..."
name: controlflow-planner
tools: ["read", "search", "edit"]
---
```

Notable choices, which generalize to any custom agent you add:

- **No `model:` frontmatter.** The Copilot Auto model picker selects the model. Pin a model only if the role genuinely demands it.
- **`tools:` lists the tools the agent may call.** Copilot enforces tool access natively; there is no ControlFlow tool-grants surface.
- **The prompt body is prose.** Role, scope, contracts, and handoff are written as short prose sections, not as a rigid four-section template.

Read `.github/agents/controlflow-planner.agent.md` before authoring a new agent; it is the canonical worked example.

## Guidance: how to write a good custom agent prompt

### 1. Frontmatter

- `name` — the `@-mention` identifier and the filename stem.
- `description` — one paragraph: what the agent does, when to use it, and what it hands off. Copilot uses this for routing and the agents dropdown.
- `tools` — the minimal tool list the role needs. Prefer read-only tools for read-only roles. Do not add a `model:` key unless pinning is required.

### 2. Role and objective (prose)

One paragraph: the role, the single observable outcome the agent produces, and what it does **not** do. For the planner, the single outcome is "a saved, schema-conforming plan artifact in `plans/`." State the scope boundary explicitly (in-scope vs. out-of-scope).

### 3. Contracts as prose

Name the contract files the agent must conform to — schemas, templates, governance — as prose pointers, not as a mandatory `## Resources` section. Example: "The artifact must conform to `schemas/planner.plan.schema.json` and `plans/templates/plan-document-template.md`." Schemas in `schemas/` serve as contract documentation and eval fixture references; they are not runtime-validated inter-agent messages in the slim model.

### 4. Behavior constraints (prose)

Hard rules the agent must never violate, written as gate-style preconditions:

- Plan vs. act split (a planner does not write code; an implementer does not replan).
- Abstention: if evidence is insufficient for a confident output, return `ABSTAIN` or `REPLAN_REQUIRED` with reasons — do not force a result past the evidence.
- Human approval for destructive or irreversible actions (delegated to native Copilot approvals).
- Evidence over assertion: cite file paths, commands, or repo evidence for claims.

### 5. Handoff (prose)

How the agent hands off to the next step. The planner hands off in prose: name the plan artifact path and the first phase to execute. There is no dispatch protocol — native Copilot executes inline, using the plan's `executor_agent` field as a per-phase role label, not a spawned agent.

### 6. Optional: resources the agent should load

If the role benefits from value-add patterns, list them as a short pointer block (the retired `## Resources` section, but optional):

```text
## Resources
- skills/patterns/tdd-patterns.md
- skills/patterns/debugging-discipline.md
```

The pattern files carry the reusable discipline; the agent file carries the persona. See `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md` §5 for the full recreation recipe.

## Prompt altitude rules (preserved from P.A.R.T.)

- Avoid vague directives (e.g., "do your best").
- Avoid brittle micro-steps tied to one exact environment.
- Use stable gate-style rules: preconditions, allowed transitions, required evidence, failure mode (`ABSTAIN` / `NEEDS_REVISION` / `FAILED`).

## Deterministic status enums (reference)

The slim model uses these status values across plan lifecycle sections and verify verdicts. Individual schemas may define richer or stricter subsets.

- `APPROVED` / `NEEDS_REVISION` / `REJECTED` — `controlflow-verify` verdicts.
- `READY_FOR_EXECUTION` / `ABSTAIN` / `REPLAN_REQUIRED` — Planner plan status.
- `COMPLETE` / `FAILED` — phase execution outcomes (recorded in plan lifecycle sections).
- `transient` / `fixable` / `needs_replan` / `escalate` / `model_unavailable` — failure classification enum (recorded in plan lifecycle sections; retry routing is native Copilot's job).

The authoritative enum for any contract is its schema in `schemas/`. This vocabulary is a reference summary only.

## Human-in-the-loop gate

Any destructive or irreversible action must be blocked until explicit user confirmation. Examples: file deletion outside temporary/eval artifacts, bulk refactors with contract breaks, external side effects (financial, production, or data-destructive operations). Use native Copilot approvals.

## Compliance checklist (guidance, not enforced)

- [ ] Frontmatter has `name`, `description`, `tools`; no `model:` unless pinning is required.
- [ ] Role and single observable outcome stated in one paragraph.
- [ ] Scope boundary (in-scope vs. out-of-scope) explicit.
- [ ] Contract files named as prose pointers.
- [ ] Abstention rule present.
- [ ] Human approval gate for destructive actions present (or marked N/A with reason).
- [ ] Handoff stated in prose (no dispatch protocol).

## See also

- [`NATIVE-DELEGATION-BOUNDARY.md`](NATIVE-DELEGATION-BOUNDARY.md) — §5, the specialized-agent recreation recipe.
- [`PROMPT-BEHAVIOR-CONTRACT.md`](PROMPT-BEHAVIOR-CONTRACT.md) — behavioral invariants complementing this guidance.
- `.github/agents/controlflow-planner.agent.md` — the canonical worked example.