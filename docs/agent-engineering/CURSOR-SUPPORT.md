# Cursor IDE Support

## Overview

ControlFlow supports Cursor IDE through version-controlled Project Rules under `.cursor/rules/`. These rules give Cursor users access to ControlFlow conventions, governance policies, and the offline verification gate without creating a new runtime plugin or altering VS Code agent semantics.

Cursor IDE support is **documentation and rules only**. Cursor cannot execute VS Code-specific subagent semantics (`agent/runSubagent`) and no new tool grants or executor roles are required.

## Rule Inventory

All rules live under `.cursor/rules/` as `.mdc` files with YAML frontmatter.

| File | Activation | Scope | Description |
| ---- | ---------- | ----- | ----------- |
| `controlflow-core.mdc` | `alwaysApply: true` | All sessions | Repo identity, canonical source hierarchy, no-runtime-app warning, offline eval gate |
| `controlflow-planning.mdc` | `globs: plans/**/*.md, schemas/planner.*.json` | Planning work | Planning discipline, phase decomposition, risk review, plan-artifact conventions |
| `controlflow-implementation-review.mdc` | `globs: *.agent.md, governance/*.json, schemas/*.json` | Implementation and review | P.A.R.T. preservation, tool/grant update requirements, failure classification |
| `controlflow-docs-evals.mdc` | `globs: docs/**/*.md, evals/**/*.mjs, ...` | Documentation and evals | Tutorial parity, eval harness conventions, verification gate |
| `controlflow-portability.mdc` | `globs: plugins/**/*, docs/agent-engineering/TOOL-ROUTING.md` | Portability work | Codex, Claude Code, and shared-source adapter guidance |

## Activation Guidance

- `controlflow-core.mdc` uses `alwaysApply: true` and is automatically active in every Cursor session for this repository.
- Scoped rules activate via `globs` when the current file matches the specified pattern, keeping detailed instructions focused and session-context efficient.
- Rules reference canonical ControlFlow files rather than duplicating long agent prompts, minimising stale-instruction risk.
- Use Cursor Project Rules (`.cursor/rules/`) as the primary integration surface for Cursor users. Do not rely on the root `AGENTS.md` as the distributable Cursor surface; it is a local-only helper (see Limitations).

## Limitations

- **No VS Code runtime semantics.** Cursor does not support `agent/runSubagent`. Cursor rules provide guidance; they do not orchestrate ControlFlow subagents. No rule may claim or imply Cursor can execute VS Code-only capabilities.
- **No new tool grants.** Cursor support is a documentation surface only. `governance/tool-grants.json` and `governance/agent-grants.json` are unchanged.
- **No new executor roles.** Adding Cursor rules does not create new `executor_agent` entries in `plans/project-context.md` or `governance/project-context-registry.json`.
- **Rules must stay under 500 lines.** Each `.mdc` file should reference canonical docs rather than copy them verbatim.
- **AGENTS.md is local-only.** The root `AGENTS.md` is an explicit local-only helper for AI coding agents working in this repository. It is not the primary Cursor support artifact and must not be treated as a versioned Cursor rule.

## Validation Commands

Run these commands locally to verify Cursor rule integrity:

```sh
# Structural validation only (schema + P.A.R.T. + Cursor rule structure)
cd evals && npm run test:structural

# Full offline suite including Cursor rule contract validation
cd evals && npm test
```

The offline eval harness validates:

- All `.cursor/rules/*.mdc` files have valid frontmatter delimiters (opening and closing `---`).
- All rules include at least one activation metadata key: `alwaysApply`, `description`, or `globs`.
- `controlflow-core.mdc` uses `alwaysApply: true` and references at least one canonical ControlFlow path.
- No rule file exceeds 500 lines.

## Authoritative References

| Concern | File |
| ------- | ---- |
| Cursor rule source of truth | `.cursor/rules/*.mdc` |
| ControlFlow shared policies | `.github/copilot-instructions.md` |
| Agent roster and complexity tiers | `plans/project-context.md` |
| Tool routing policy | `docs/agent-engineering/TOOL-ROUTING.md` |
| P.A.R.T. specification | `docs/agent-engineering/PART-SPEC.md` |
| Eval harness documentation | `evals/README.md` |

## Changing Cursor Rules

Before modifying any `.cursor/rules/*.mdc` file:

1. Verify the change does not duplicate content already in `.github/copilot-instructions.md` — reference the canonical file instead.
2. Confirm the rule does not imply Cursor can use VS Code-only capabilities (`agent/runSubagent`).
3. If a change requires updated Cursor frontmatter semantics, verify against official Cursor documentation (`https://cursor.com/docs/rules`) before editing; Cursor docs are the external source of truth for `.mdc` activation behaviour.
4. Run `cd evals && npm test` after any rule change. The structural gate must pass before declaring the change done.
