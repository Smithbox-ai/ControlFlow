# ControlFlow Shared Source Generator

This directory is the source of truth for the portable ControlFlow skills generated into
the Cursor plugin package.

## Portable Surface

- `controlflow-plan` — durable ControlFlow plan artifacts, complexity tiers, semantic-risk
  review, and standalone plan-format fallback.
- `controlflow-verify` — inline tier-gated structural audit, mirage detection, and
  cold-start executability verification.
- `controlflow-review` — plan-conformance and evidence layer over native host review.

The generated portable surface is **3 skills, 0 plugin subagents**.

## Native Host Boundary

The portable plugins do not recreate host runtime behavior:

- no router skill; the host already selects skills from descriptions or explicit
  invocation
- no spec skill; native planning and direct clarification own requirement discovery
- no orchestration or strict-workflow skill; the host owns task execution and live state
- no approval, sandbox, retry, subagent-lifecycle, model-routing, or memory engine
- no separate plan-audit, assumption-verifier, or executability-verifier skills; their
  useful checks are consolidated in `controlflow-verify`
- no generic review replacement; `controlflow-review` adds plan drift and evidence
  discipline

## Standalone Planning

`controlflow-plan` prefers repository-local
`schemas/planner.plan.schema.json` and `plans/templates/plan-document-template.md` when
present. Its bundled `references/plan-format.md` keeps the installed plugin useful in
repositories that do not contain ControlFlow's canonical files.

## Generated Outputs

- `plugins/controlflow-cursor/skills/`

Host-specific UI metadata files are package-specific and not part of the shared generated target.

The Claude Code plugin is standalone and hand-maintained.

## Commands

Validate generated parity without writing:

```powershell
powershell.exe -ExecutionPolicy Bypass -NoProfile -File plugins/controlflow-shared-source/scripts/validate-generated-assets.ps1 -RepoRoot .
```

Synchronize declared outputs:

```powershell
powershell.exe -ExecutionPolicy Bypass -NoProfile -File plugins/controlflow-shared-source/scripts/sync-plugin-assets.ps1 -RepoRoot . -Write
```

Use `-Host cursor` to limit the operation.

## Safety Contract

The generator writes only declared files and does not delete retired output directories.
Package migrations must remove obsolete paths explicitly, then run parity validation.

## Intentional Divergences

- Host model routing and `model_unavailable` handling stay with the host.
- Tool grants and fixed agent rosters stay with the core host configuration.
- Session telemetry, compaction, budgets, approvals, sandboxing, and memories stay with
  the host runtime.
