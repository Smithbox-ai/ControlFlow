# ControlFlow Shared Source Generator

This directory is the source-of-truth root for generated ControlFlow plugin skill and template assets shared by the Codex and Claude Code plugin packages.

Generated outputs remain tracked and standalone under:

- `plugins/controlflow-codex/skills/`
- `plugins/controlflow-codex/templates/`
- `plugins/controlflow-claude-code/skills/`
- `plugins/controlflow-claude-code/templates/`

The generator is intentionally additive. It does not move, delete, or require either existing plugin package at runtime.

## Layout

- `generation-manifest.json` declares canonical source paths and generated output targets.
- `skills/` contains canonical shared skill sources.
- `templates/` contains canonical shared report template sources.
- `host-overrides/codex/` contains Codex-specific overlays when needed.
- `host-overrides/claude-code/` contains Claude Code-specific overlays and compact `generation-overrides.json` content insertions.
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

Use `-Host codex` or `-Host claude_code` to limit either command to one plugin output tree.

## Safety Contract

Write mode copies only the files declared by the manifest and any declared host override overlay. It does not delete unmanaged files or directories. Validation mode performs hash checks only and exits non-zero on drift.

Host `generation-overrides.json` files may derive a generated text file from canonical source plus small declared insertions. Use this when a host needs a few invocation lines but a full file override would duplicate the canonical template.
