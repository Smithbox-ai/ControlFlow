# Changelog — controlflow-cursor

## 1.0.0 — 2026-06-23

### Changed

- Redesigned the plugin from the heavy 10-skill / 11-subagent model to the slim **3-skill / 1-planner-agent** model that mirrors the canonical `.github/skills/` surface: `controlflow-plan`, `controlflow-verify`, `controlflow-review`.
- `controlflow-plan` is now schema-sourced: it reads the shared `schemas/planner.plan.schema.json` and `plans/templates/plan-document-template.md` at invoke time.
- `controlflow-verify` runs inline adversarial verification (structural audit + assumption/mirage check + executability cold-start) with a terminal APPROVED / NEEDS_REVISION / REJECTED verdict — replacing the previous assumption-verifier and executability-verifier subagents.
- `controlflow-review` is now a thin layer over native Cursor review, adding plan-vs-implementation scope drift, evidence discipline, and proactive vulnerability/error search.
- Manifest (`plugin.json`) bumped to 1.0.0 with an updated description and keywords reflecting the slim, zero-verifier-subagent design.
- README and USAGE rewritten for the slim 3-skill model.
- `scripts/install-project.ps1` no longer copies retired `.cursor/rules` (the root `.cursor/` mirror was retired in Phase 3); it now installs only `skills/` + `agents/`.

### Added

- `agents/controlflow-planner.agent.md` — the single planner agent (hands off execution to the native Cursor agent; 0 verifier subagents).

### Removed

- Nine obsolete skills: `controlflow-router`, `controlflow-spec`, `controlflow-strict-workflow`, `controlflow-planning`, `controlflow-plan-audit`, `controlflow-assumption-verifier`, `controlflow-executability-verifier`, `controlflow-orchestration`, `controlflow-memory-hygiene`.
- Ten obsolete subagent definitions: `controlflow-{code-mapper,researcher,plan-auditor,assumption-verifier,executability-verifier,code-reviewer,core-implementer,ui-implementer,platform-engineer,technical-writer,browser-tester}.md`.
- `templates/` (assumption-verifier-report, executability-verifier-report, plan-audit-report templates) — `controlflow-verify` writes a single combined `verify-verdict.md`.
- `scripts/validate-strict-artifacts.ps1` (validated the retired heavy-model lifecycle artifacts).

### Notes

- The slim skills are generated from `plugins/controlflow-shared-source/skills/` (which mirrors `.github/skills/`). The cursor `agents/` directory is hand-maintained from `host-overrides/cursor/agents/` because the slim Codex plugin ships no `agents/` directory and every manifest target must emit to both hosts.

## 0.1.0 — 2026-06-01

- Initial Cursor plugin: 10 workflow skills, 11 subagents, templates, install script.
- Host `cursor` added to `plugins/controlflow-shared-source` generation manifest.
- Cursor-specific overrides for strict-workflow and orchestration skills.