# ControlFlow Portability Notes for Claude Code

This file describes which ControlFlow practices carry over to Claude Code and which
require Claude-native adaptation.

## Keep from ControlFlow

- Phased planning with saved Markdown artifacts
- Semantic risk review (all seven categories, every plan)
- Complexity tiers (TRIVIAL / SMALL / MEDIUM / LARGE)
- Artifact-first thinking: save plans, reports, and research packets to files before acting
- Explicit validation and rollback notes
- Failure taxonomy: transient, fixable, needs_replan, escalate
- Evidence discipline: cite file paths, symbols, or commands; never assert without evidence
- Review gates before execution (plan-audit, assumption-verifier, executability-verifier)
- Memory hygiene: prune stale artifacts, keep active-objective notes terse

## Adapt for Claude Code

These VS Code / Codex concepts do not exist in Claude Code as-is. Use the Claude-native
equivalents below instead of copying them literally.

| VS Code / Codex concept | Claude Code equivalent |
| --- | --- |
| `@Agent` dispatch syntax | Plugin agent invocation via Claude Code sub-agent support |
| `vscode/askQuestions` tool | Claude Code interactive clarification in the main thread |
| P.A.R.T section contracts (Prompt / Archive / Resources / Tools) | Not required; use plain Markdown system prompts for plugin agents |
| Schema-driven JSON chat outputs | Structured plain text outputs; save artifacts to files |
| `governance/model-routing.json` | Claude Code model selection per agent via `model` frontmatter |
| `skills/patterns/` at repo root | Plugin-local references under `skills/<skill>/references/` |
| `governance/agent-grants.json` | Plugin agent `tools` and `disallowedTools` frontmatter |
| Codex `$controlflow-*` skill syntax | `/controlflow-claude-code:<skill-name>` slash syntax |
| `runSubagent` / `spawn_agent` | Claude Code native sub-agent dispatch when available |
| `update_plan` command | Direct file writes to plans/ artifacts |

## Claude-Native Skill Invocation

Skills in this plugin are invoked as:

```text
/controlflow-claude-code:{skill-name}
```

Examples:

- `/controlflow-claude-code:controlflow-planning`
- `/controlflow-claude-code:controlflow-plan-audit`
- `/controlflow-claude-code:controlflow-strict-workflow`

## Runtime Boundaries

Claude Code plugins are cached. Plugin files must not rely on paths outside the plugin
root directory at runtime. All references should point to files bundled inside this plugin.
