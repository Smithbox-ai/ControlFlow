# ControlFlow for Cursor

**Version:** 1.0.0

Slim portable ControlFlow package for Cursor:

- 3 skills: `controlflow-plan`, `controlflow-verify`, `controlflow-review`
- 1 planner agent: `controlflow-planner`
- no ControlFlow implementation, verifier, orchestration, or memory subagents

The skills preserve durable plan structure, inline adversarial verification, and
plan-aware evidence review. Native Cursor remains responsible for execution, task tools,
approvals, model behavior, and optional subagents.

## Install

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-cursor/scripts/install-project.ps1 -TargetRepo C:\path\to\app
```

## Sync in This Repository

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-cursor/scripts/sync-to-dotcursor.ps1 -RepoRoot . -Force
```

The sync script removes Codex-only `agents/openai.yaml` UI metadata from the installed
`.cursor/skills/` tree.

## Flow

1. Use the `controlflow-planner` agent or select `controlflow-plan`.
2. Run `controlflow-verify` before implementation.
3. Let native Cursor execute the approved plan.
4. Use native review, then `controlflow-review` for plan conformance.

See [USAGE.md](USAGE.md) for examples.
