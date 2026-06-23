# Codex Host Overrides

The slim ControlFlow plugin ships three host-neutral skills (`controlflow-plan`,
`controlflow-verify`, `controlflow-review`) that mirror the canonical
`.github/skills/` surface verbatim. Codex invokes skills with the bare `/controlflow-*`
form, which matches the canonical source — so no Codex skill overlay or
`generation-overrides.json` insertions are required.

The `controlflow-codex` plugin ships zero subagents (slim mantra: 3 skills, 0
subagents), so no `agents/` directory is generated for Codex. Plugin-local assets
under `plugins/controlflow-codex/assets/` and install scripts under
`plugins/controlflow-codex/scripts/` remain hand-maintained and are intentionally
unmanaged by this generator.