# Cursor IDE Support

## Overview

ControlFlow supports Cursor IDE through a layered integration:

1. **Project Rules** (`.cursor/rules/*.mdc`) — conventions, tiers, P.A.R.T, offline eval gate.
2. **Agent Skills** (`.cursor/skills/controlflow-*/SKILL.md`) — planning, review, orchestration workflow (Planner/Orchestrator roles).
3. **Project Subagents** (`.cursor/agents/controlflow-*.md`) — isolated audit, research, and implementer roles (11 subagents).
4. **Portable plugin** (`plugins/controlflow-cursor/`) — install into any repository via `install-project.ps1`.

Cursor approximates the VS Code 13-agent system but does **not** execute `agent/runSubagent`, VS Code tool grants, or schema-enforced gate-event payloads in chat. Semantic parity (tiers, artifacts, failure taxonomy) is preserved; runtime determinism is not.

Authoritative plugin docs: [`plugins/controlflow-cursor/README.md`](../../plugins/controlflow-cursor/README.md), [`plugins/controlflow-cursor/USAGE.md`](../../plugins/controlflow-cursor/USAGE.md).

## Integration Levels

| Level | Surface | What you get |
| ----- | ------- | ------------ |
| 1 | `.cursor/rules/` only | Conventions when editing matching files; no workflow skills |
| 2 | Rules + Skills | Plan → review → execute → review with `plans/` artifacts |
| 3 | Rules + Skills + `.cursor/agents/` | Delegation via Cursor `Task` tool to named subagents |
| 4 | VS Code Copilot | Full `@Planner` / `@Orchestrator` + `runSubagent` (not in Cursor) |

This repository ships **level 3** assets in-tree. Consumers install level 3 with the Cursor plugin script.

## Role Mapping (13 VS Code agents → Cursor)

| VS Code (`.agent.md`) | Cursor surface |
| --------------------- | -------------- |
| Planner | Skill `controlflow-planning` |
| Orchestrator | Skills `controlflow-strict-workflow`, `controlflow-orchestration` + rule `controlflow-orchestration.mdc` |
| CodeMapper-subagent | `.cursor/agents/controlflow-code-mapper.md` (`readonly: true`) |
| Researcher-subagent | `.cursor/agents/controlflow-researcher.md` (`readonly: true`) |
| PlanAuditor-subagent | `.cursor/agents/controlflow-plan-auditor.md` (`readonly: true`) |
| AssumptionVerifier-subagent | `.cursor/agents/controlflow-assumption-verifier.md` (`readonly: true`) |
| ExecutabilityVerifier-subagent | `.cursor/agents/controlflow-executability-verifier.md` (`readonly: true`) |
| CodeReviewer-subagent | `.cursor/agents/controlflow-code-reviewer.md` (`readonly: true`) |
| CoreImplementer-subagent | `.cursor/agents/controlflow-core-implementer.md` |
| UIImplementer-subagent | `.cursor/agents/controlflow-ui-implementer.md` |
| PlatformEngineer-subagent | `.cursor/agents/controlflow-platform-engineer.md` |
| TechnicalWriter-subagent | `.cursor/agents/controlflow-technical-writer.md` |
| BrowserTester-subagent | `.cursor/agents/controlflow-browser-tester.md` |

Canonical prompt bodies remain in root `*.agent.md` and `plugins/controlflow-shared-source/`. Cursor agents are adapted copies with Cursor frontmatter (`name`, `description`, `readonly`, `model`).

## Subagent Delegation (`Task` tool)

For PLAN_REVIEW and phase dispatch, the parent agent should delegate with Cursor's Task tool when available:

```text
Task(subagent_type="controlflow-plan-auditor", description="Audit plan", prompt="...")
```

The `prompt` must be self-contained: plan path, complexity tier, `trace_id`, expected report sections, and template paths under `plugins/controlflow-cursor/templates/`.

### Task tool fallback

Some Cursor builds do not expose Task for custom `.cursor/agents/` (see [forum discussion](https://forum.cursor.com/t/task-tool-missing-for-custom-agents-in-cursor-agents-documentation-pages-return-errors/149771)). When Task is unavailable:

1. Run the same instructions in the parent session.
2. Apply the matching skill (`controlflow-plan-audit`, `controlflow-assumption-verifier`, `controlflow-review`, etc.).
3. Save output under `plans/artifacts/<task-slug>/` as Markdown (not JSON gate-events).

Do not claim subagent isolation was enforced if fallback ran in the parent session.

## Rule Inventory

All rules live under `.cursor/rules/` as `.mdc` files with YAML frontmatter.

| File | Activation | Scope | Description |
| ---- | ---------- | ----- | ----------- |
| `controlflow-core.mdc` | `alwaysApply: true` | All sessions | Repo identity, skills/agents pointers, no `runSubagent` |
| `controlflow-planning.mdc` | `globs: plans/**/*.md, ...` | Planning work | Planning discipline, phases, risk review |
| `controlflow-orchestration.mdc` | `globs: plans/**/*.md` | Plan execution | State machine, tier routing, Task delegation |
| `controlflow-implementation-review.mdc` | `globs: *.agent.md, governance/*, schemas/*` | Agents and governance | P.A.R.T, tool grants, failure classification |
| `controlflow-docs-evals.mdc` | `globs: docs/**, evals/**, ...` | Docs and evals | Tutorial parity, eval gate |
| `controlflow-portability.mdc` | `globs: plugins/**, TOOL-ROUTING.md` | Portability | Codex, Claude Code, Cursor plugin |

## Skills Inventory

Project skills: `.cursor/skills/controlflow-*/SKILL.md` (generated from `plugins/controlflow-shared-source/` via `plugins/controlflow-cursor/`).

| Skill | Role |
| ----- | ---- |
| `controlflow-router` | Entry routing |
| `controlflow-spec` | Spec-before-plan |
| `controlflow-strict-workflow` | Full strict workflow entry |
| `controlflow-planning` | Planner |
| `controlflow-plan-audit` | PlanAuditor (inline fallback) |
| `controlflow-assumption-verifier` | AssumptionVerifier (inline fallback) |
| `controlflow-executability-verifier` | ExecutabilityVerifier (inline fallback) |
| `controlflow-orchestration` | Orchestrator execution path |
| `controlflow-review` | CodeReviewer (inline fallback) |
| `controlflow-memory-hygiene` | Memory hygiene |

Entry prompt (Agent mode): `Follow the controlflow-strict-workflow skill for this task.`

## Cursor Version Requirements

- **Project Rules:** [cursor.com/docs/rules](https://cursor.com/docs/rules)
- **Subagents:** [cursor.com/docs/subagents](https://cursor.com/docs/subagents) — requires Agent mode and Task tool availability for custom agents in `.cursor/agents/`
- **Skills:** [cursor.com/docs/skills](https://cursor.com/docs/skills) — project skills under `.cursor/skills/`

Verify frontmatter against current Cursor docs before changing activation fields.

## What Cursor Cannot Do (1:1 parity gaps)

- `@Planner` / `@Orchestrator` chat mentions or Copilot custom agent UI.
- `agent/runSubagent` with VS Code payload schemas.
- `vscode/askQuestions`, `read/problems`, and other VS Code-only tools.
- Deterministic enforcement of `governance/model-routing.json` on every dispatch.
- JSON orchestrator gate-events in chat (`schemas/orchestrator.gate-event.schema.json`) — use Markdown artifacts in `plans/artifacts/` instead.
- Guaranteed parallel waves with runtime write locks — discipline only.

## What Is Preserved (semantic parity)

- Complexity tiers: `TRIVIAL` → `LARGE` review routing (see README pipeline table).
- Artifact paths: `plans/<task-slug>-plan.md`, `plans/artifacts/<task-slug>/`.
- Failure taxonomy and runtime policy references in orchestration skills.
- Offline eval gate: `cd evals && npm test`.
- P.A.R.T for changes to `*.agent.md` and governance.

## Installation Modes

### ControlFlow repository (development)

Open the repo in Cursor. Rules, skills, and agents load from `.cursor/` automatically.

After editing shared-source skills, refresh:

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-cursor/scripts/sync-to-dotcursor.ps1 -RepoRoot . -Force
```

### Another repository (consumer)

From ControlFlow repo root:

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-cursor/scripts/install-project.ps1 -TargetRepo C:\path\to\your-app
```

Creates or updates `.cursor/skills`, `.cursor/agents`, a minimal rules subset, and `plans/` scaffolding.

## Validation Commands

```sh
# Structural validation (rules, skills, agents, schemas, P.A.R.T.)
cd evals && npm run test:structural

# Full offline suite
cd evals && npm test
```

Validates:

- `.cursor/rules/*.mdc` frontmatter and line budget (pass 3e).
- `.cursor/skills/**/SKILL.md` and `.cursor/agents/*.md` contracts (pass 3f).
- Generated plugin drift when applicable.

## Authoritative References

| Concern | File |
| ------- | ---- |
| Cursor plugin package | `plugins/controlflow-cursor/` |
| Cursor rules | `.cursor/rules/*.mdc` |
| Cursor skills | `.cursor/skills/` |
| Cursor subagents | `.cursor/agents/` |
| Shared policies | `.github/copilot-instructions.md` |
| Agent roster and tiers | `plans/project-context.md` |
| Tool routing | `docs/agent-engineering/TOOL-ROUTING.md` |
| SDK / CI (optional) | `docs/agent-engineering/CURSOR-SDK.md` |
| Eval harness | `evals/README.md` |

## Changing Cursor Assets

Before modifying `.cursor/rules`, `.cursor/skills`, or `.cursor/agents`:

1. Prefer editing `plugins/controlflow-shared-source/` and syncing with `sync-plugin-assets.ps1 -Host cursor -Write`, then copying to `.cursor/` if needed.
2. Do not imply Cursor can use `agent/runSubagent` or VS Code-only tools.
3. Run `cd evals && npm test` before declaring done.
4. Update `evals/scenarios/cursor-plugin/` contracts when adding agents or skills.
