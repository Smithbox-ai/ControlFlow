# Changelog — controlflow-cursor

## 1.0.0 — 2026-06-25

- Reduced the generated portable workflow to `controlflow-plan`, `controlflow-verify`, and
  `controlflow-review`.
- Replaced 11 role subagents with one planner agent; implementation and review execution
  remain native Cursor responsibilities.
- Removed obsolete report templates, strict orchestration overrides, and the standalone
  multi-artifact validator.

## 0.1.0 — 2026-06-01

- Initial Cursor plugin: 10 workflow skills, 11 subagents, templates, install script.
- Host `cursor` added to `plugins/controlflow-shared-source` generation manifest.
- Cursor-specific overrides for strict-workflow and orchestration skills.
