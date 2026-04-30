# ControlFlow for Codex

This repo-local plugin ports the parts of ControlFlow that transfer cleanly into Codex:

- phased planning
- complexity-aware execution discipline
- evidence-backed review
- semantic risk checks
- failure taxonomy
- memory hygiene

It intentionally does **not** try to recreate VS Code Copilot-specific prompt contracts, fixed agent rosters, or tool names that do not exist in Codex.

## Included Skills

- `controlflow-planning`
- `controlflow-orchestration`
- `controlflow-review`
- `controlflow-memory-hygiene`
- `controlflow-router`

## Installation Shape

- Plugin manifest: `.codex-plugin/plugin.json`
- Marketplace entry: `../../.agents/plugins/marketplace.json`
- Skill folders: `./skills/`
- Home-local installer: `./scripts/install-home-local.ps1`

## Notes

- The manifest metadata is usable as-is, but author/contact branding is intentionally generic and can be customized later.
- The workflow references are written for Codex, not for the original VS Code ControlFlow runtime.
- To install into your personal Codex home, run `scripts/install-home-local.ps1` from this plugin directory.
