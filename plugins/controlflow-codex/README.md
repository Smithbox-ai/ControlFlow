# ControlFlow for Codex

**Version:** 1.0.0

This is the slim, standalone ControlFlow plugin for [OpenAI Codex CLI](https://github.com/openai/codex).
It brings ControlFlow's planning, inline plan-verification, and review discipline to Codex
**without** the token cost of dedicated subagents. All verification runs inline, in the main
context, with adversarial framing built into the skill. It is designed to coexist with
Codex's native toolset without conflict or overload.

This plugin is generated from `plugins/controlflow-shared-source/skills/` (which mirrors the
canonical `.github/skills/` surface). The Claude Code sibling is hand-maintained; this one is
generator-managed.

## Design Principles

- **3 skills, 0 subagents.** No per-verifier agent contexts. One skill (`controlflow-verify`)
  runs structural audit, assumption/mirage check, and executability cold-start inline.
- **Native-tool coexistence.** `controlflow-review` is a thin layer over native Codex review,
  adding plan-vs-implementation scope drift, evidence discipline, and proactive
  vulnerability/error search.
- **Schema-sourced planning.** `controlflow-plan` reads the shared `schemas/planner.plan.schema.json`
  and `plans/templates/plan-document-template.md` at invoke time, so it tracks the canonical
  format without a frozen copy.
- **Lazy loading.** Skill bodies and references load only on invoke.

## Skills

| Skill | Invocation | Purpose |
| --- | --- | --- |
| controlflow-plan | `/controlflow-plan` | Generate a high-quality plan in the shared ControlFlow format (schema-sourced, tier-gated) |
| controlflow-verify | `/controlflow-verify` | Inline adversarial verification: structural audit + assumption/mirage check + executability cold-start (zero subagents); writes `plans/artifacts/<task-slug>/verify-verdict.md` |
| controlflow-review | `/controlflow-review` | Evidence-backed implementation review: a thin layer over native Codex review, adding plan-vs-implementation scope drift and proactive vulnerability/error search |

Routing for MEDIUM/LARGE tasks is defined in the repo `CLAUDE.md`: plan → verify → review.

## When to Use This Plugin

ControlFlow-Codex is intentionally opt-in. It adds structure when Codex would otherwise be
asked to manage a multi-step repository change from loose chat context alone.

Use ControlFlow-Codex when:

- the task is `SMALL` or larger
- the change spans multiple files, phases, or ownership boundaries
- planning, review gates, rollback notes, or durable artifacts would reduce risk
- migrations, refactors, semantic-risk checks, or execution handoffs matter

Skip ControlFlow-Codex and prompt Codex directly when:

- the task is truly `TRIVIAL` (single-file, obvious, low-risk)
- a direct edit is faster than creating plan artifacts
- you are prototyping throwaway code or exploring an idea casually

The plugin does not install global hooks or replace Codex defaults.

## Selective Core Parity

ControlFlow-Codex follows a machine-checked selective portability contract in
[`../controlflow-shared-source/core-portability-matrix.json`](../controlflow-shared-source/core-portability-matrix.json).
The contract adapts host-neutral workflow behavior without copying core prompt prose.

Intentional divergences include `model_unavailable`, VS Code model routing, tool grants, the
fixed agent roster, session telemetry, compaction, and budget enforcement — all remain
core-only.

## Installation Shape

- Plugin manifest: `.codex-plugin/plugin.json`
- Marketplace entry: `~/.agents/plugins/marketplace.json` (written by installer)
- Skill folders: `./skills/`
- Home-local installer: `./scripts/install-home-local.ps1`

## Installation

```powershell
# From the repository root
powershell -ExecutionPolicy Bypass -File plugins/controlflow-codex/scripts/install-home-local.ps1

# Re-install (replace existing)
powershell -ExecutionPolicy Bypass -File plugins/controlflow-codex/scripts/install-home-local.ps1 -Force
```

The installer copies the plugin to `~/plugins/controlflow-codex/` and registers it in
`~/.agents/plugins/marketplace.json`.

## Uninstalling

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-codex/scripts/uninstall-home-local.ps1
```

After uninstalling, `/controlflow-*` skills are no longer available in Codex.

## Notes

- The manifest metadata is usable as-is; author/contact branding is intentionally generic.
- Keep using native Codex for trivial changes; the plugin is meant for work where structured
  plans and review gates pay for themselves.
- For a practical prompt catalog in Russian, read `USAGE.md`.