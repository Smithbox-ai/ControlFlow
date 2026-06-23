# Cursor Host Overrides

The slim ControlFlow plugin ships three host-neutral skills (`controlflow-plan`,
`controlflow-verify`, `controlflow-review`) that mirror the canonical
`.github/skills/` surface verbatim. Cursor invokes skills with the bare
`/controlflow-*` form, which matches the canonical source — so no Cursor skill
overlay or `generation-overrides.json` insertions are required.

## Cursor agent overlay

Cursor requires a plugin `agents/` directory, so the `@controlflow-planner` agent is
mirrored here as a host-adapted overlay:

- `agents/controlflow-planner.agent.md` — the single planner agent (hands off
  execution to the native Cursor agent; 0 subagents shipped).

This overlay is hand-delivered to `plugins/controlflow-cursor/agents/` (it is not
wired through `generation-manifest.json`, because every manifest target must emit to
both Codex and Cursor, and the slim Codex plugin ships no `agents/` directory). The
file is the source of truth for the cursor plugin's planner agent.