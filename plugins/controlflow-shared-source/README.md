# ControlFlow Shared Source Generator

This directory is the source-of-truth root for generated ControlFlow plugin skill and template assets shared by the Codex, Claude Code, and Cursor plugin packages.

Generated outputs remain tracked and standalone under:

- `plugins/controlflow-codex/skills/`
- `plugins/controlflow-codex/templates/`
- `plugins/controlflow-claude-code/skills/`
- `plugins/controlflow-claude-code/templates/`
- `plugins/controlflow-cursor/skills/`
- `plugins/controlflow-cursor/templates/`

The generator is intentionally additive. It does not move, delete, or require any existing plugin package at runtime.

## Layout

- `generation-manifest.json` declares canonical source paths and generated output targets.
- `skills/` contains canonical shared skill sources.
- `templates/` contains canonical shared report template sources.
- `host-overrides/codex/` contains Codex-specific overlays when needed.
- `host-overrides/claude-code/` contains Claude Code-specific overlays and compact `generation-overrides.json` content insertions.
- `host-overrides/cursor/` contains Cursor-specific skill overlays.
- `scripts/sync-plugin-assets.ps1` validates or writes declared generated targets.
- `scripts/validate-generated-assets.ps1` runs read-only drift validation.

## Commands

Validate without writing:

```powershell
powershell.exe -ExecutionPolicy Bypass -NoProfile -File plugins/controlflow-shared-source/scripts/validate-generated-assets.ps1 -RepoRoot .
```

Write declared generated targets only:

```powershell
powershell.exe -ExecutionPolicy Bypass -NoProfile -File plugins/controlflow-shared-source/scripts/sync-plugin-assets.ps1 -RepoRoot . -Write
```

Use `-Host codex`, `-Host claude_code`, or `-Host cursor` to limit either command to one plugin output tree.

## Safety Contract

Write mode copies only the files declared by the manifest and any declared host override overlay. It does not delete unmanaged files or directories. Validation mode performs hash checks only and exits non-zero on drift.

Host `generation-overrides.json` files may derive a generated text file from canonical source plus small declared insertions. Use this when a host needs a few invocation lines but a full file override would duplicate the canonical template.

## Selective Core Portability

`core-portability-matrix.json` records which core ControlFlow invariants portable plugins adopt, adapt, or intentionally exclude. It stores evidence paths and short semantic anchors rather than copying core policy prose. The offline eval suite validates this contract in Pass 16.

### Portable Runtime Policy Subset

The portable runtime-policy snapshot keeps host-neutral review routing, retry discipline, batch approval, pre-wave cache recommendations, and transient-wave throttling. It does not attempt to mirror every top-level core runtime-policy block.

### Portable Simplicity Discipline

The Minimum Viable Change Ladder is portable: before adding code, phases, abstractions, or dependencies, agents check whether the accepted scope can be handled by existing project behavior, the standard library, a native platform feature, an already-installed dependency, or one localized line. Review and plan-audit skills treat avoidable over-engineering as a maintainability signal without weakening safety, validation, accessibility, rollback, or explicitly requested behavior.

### Intentional Divergences

- `model_unavailable` remains an intentional divergence because portable skills do not own model substitution.
- VS Code model routing, tool grants, and the fixed agent roster remain core-only.
- Core session telemetry, compaction, and budgets remain host-runtime concerns.
