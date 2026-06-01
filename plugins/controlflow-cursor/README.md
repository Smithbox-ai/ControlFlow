# ControlFlow for Cursor

**Version:** 0.1.0

Portable ControlFlow workflow for [Cursor IDE](https://cursor.com): strict planning, tiered plan review, phased orchestration, evidence-backed review, and memory hygiene — without VS Code Copilot or `agent/runSubagent`.

## What This Package Provides

- **10 workflow skills** under `skills/` (synced from `plugins/controlflow-shared-source/`)
- **11 subagent definitions** under `agents/` (installed to `.cursor/agents/`)
- **Report templates** under `templates/`
- **Install script** for arbitrary repositories

## Skills

| Skill | ControlFlow role |
| ----- | ---------------- |
| `controlflow-router` | Entry dispatcher |
| `controlflow-spec` | Spec-before-plan |
| `controlflow-strict-workflow` | Full workflow entry |
| `controlflow-planning` | Planner |
| `controlflow-plan-audit` | PlanAuditor (inline) |
| `controlflow-assumption-verifier` | AssumptionVerifier (inline) |
| `controlflow-executability-verifier` | ExecutabilityVerifier (inline) |
| `controlflow-orchestration` | Orchestrator |
| `controlflow-review` | CodeReviewer (inline) |
| `controlflow-memory-hygiene` | Memory hygiene |

In Cursor Agent mode: `Follow the controlflow-strict-workflow skill for this task.`

## Subagents

Installed to `.cursor/agents/` — invoke via Task when available. See [USAGE.md](USAGE.md).

## Install Into Another Repo

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-cursor/scripts/install-project.ps1 -TargetRepo C:\path\to\app
```

## Validate Strict Plan Artifacts

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-cursor/scripts/validate-strict-artifacts.ps1 `
  -RepoRoot . `
  -PlanPath plans/my-task-plan.md `
  -RequirePlanAudit
```

## Sync From Shared Source

Canonical one-step sync for this repository (shared source → plugin → `.cursor/`, strips Codex `openai.yaml`):

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-cursor/scripts/sync-to-dotcursor.ps1 -RepoRoot . -Force
```

Manual alternative:

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-shared-source/scripts/sync-plugin-assets.ps1 -RepoRoot . -Host cursor -Write
# Then run sync-to-dotcursor.ps1 or copy skills/agents yourself; do not ship agents/openai.yaml under Cursor trees.
```

## Differences From VS Code

- No `@Planner` / `@Orchestrator` or `runSubagent`.
- Markdown artifacts instead of JSON gate-events in chat.
- Model routing is guidance only (`model: inherit` on subagents).
- Task tool may be unavailable — skills provide fallback.

## References

- [docs/agent-engineering/CURSOR-SUPPORT.md](../../docs/agent-engineering/CURSOR-SUPPORT.md)
- [Main README — ControlFlow for Cursor](../../README.md#controlflow-for-cursor)
