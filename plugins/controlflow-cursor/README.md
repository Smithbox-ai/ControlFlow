# ControlFlow for Cursor

**Version:** 1.0.0

This is the slim, standalone ControlFlow plugin for [Cursor IDE](https://cursor.com). It
brings ControlFlow's planning, inline plan-verification, and review discipline to Cursor
**without** the token cost of dedicated verifier subagents. All verification runs inline, in
the main context, with adversarial framing built into the skill.

This plugin is generated from `plugins/controlflow-shared-source/skills/` (which mirrors the
canonical `.github/skills/` surface). The Claude Code sibling is hand-maintained; this one is
generator-managed.

## Design Principles

- **3 skills, 0 verifier subagents.** One skill (`controlflow-verify`) runs structural audit,
  assumption/mirage check, and executability cold-start inline.
- **One planner agent.** Cursor requires a plugin `agents/` directory, so the
  `@controlflow-planner` agent is shipped under `agents/`. It produces a saved plan artifact
  and hands execution off to the native Cursor agent. There is no orchestration or verifier
  subagent roster.
- **Native-tool coexistence.** `controlflow-review` is a thin layer over native Cursor
  review, adding plan-vs-implementation scope drift, evidence discipline, and proactive
  vulnerability/error search.
- **Schema-sourced planning.** `controlflow-plan` reads the shared
  `schemas/planner.plan.schema.json` and `plans/templates/plan-document-template.md` at
  invoke time, so it tracks the canonical format without a frozen copy.

## Skills

| Skill | Invocation | Purpose |
| --- | --- | --- |
| controlflow-plan | `/controlflow-plan` | Generate a high-quality plan in the shared ControlFlow format (schema-sourced, tier-gated) |
| controlflow-verify | `/controlflow-verify` | Inline adversarial verification: structural audit + assumption/mirage check + executability cold-start (zero subagents); writes `plans/artifacts/<task-slug>/verify-verdict.md` |
| controlflow-review | `/controlflow-review` | Evidence-backed implementation review: a thin layer over native Cursor review, adding plan-vs-implementation scope drift and proactive vulnerability/error search |

## Agent

`agents/controlflow-planner.agent.md` — the single planner agent. Invoke in Cursor Agent
mode: `Follow the controlflow-plan skill for this task.` It writes the plan to
`plans/<task-slug>-plan.md` and hands off execution to the native Cursor agent.

Routing for MEDIUM/LARGE tasks is defined in the repo `CLAUDE.md`: plan → verify → review.

## Install Into Another Repo

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-cursor/scripts/install-project.ps1 -TargetRepo C:\path\to\app
```

The installer copies `skills/` and `agents/` into `<target>/.cursor/` and scaffolds
`plans/artifacts/`.

## Sync From Shared Source

Canonical one-step sync for this repository (shared source → plugin `skills/`):

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-shared-source/scripts/sync-plugin-assets.ps1 -RepoRoot . -Host cursor -Write
```

The cursor `agents/` directory is hand-maintained from
`plugins/controlflow-shared-source/host-overrides/cursor/agents/` (it is not wired through
the generation manifest, because the slim Codex plugin ships no `agents/` directory).

## Selective Core Parity

ControlFlow-Cursor follows a machine-checked selective portability contract in
[`../controlflow-shared-source/core-portability-matrix.json`](../controlflow-shared-source/core-portability-matrix.json).
Intentional divergences include `model_unavailable`, VS Code model routing, tool grants, the
fixed agent roster, session telemetry, compaction, and budget enforcement — all remain
core-only.

## References

- [Main README — ControlFlow for Cursor](../../README.md#controlflow-for-cursor)