# Cursor IDE Support

## Overview

ControlFlow ships a **Cursor plugin** at `plugins/controlflow-cursor/` (Project Rules, workflow Skills, and agents). Cursor does not support `@controlflow-planner` or VS Code `agent/runSubagent`; the plugin approximates the slim ControlFlow flow — plan → verify → review — with Cursor's native surfaces. The legacy root `.cursor/rules/*.mdc` mirror is **retired**; Cursor support ships solely from the plugin.

The slim ControlFlow surface for VS Code Copilot is one agent (`@controlflow-planner`) plus three skills (`controlflow-plan`, `controlflow-verify`, `controlflow-review`). The Cursor plugin mirrors that surface with Cursor-native equivalents. There is no Orchestrator, no model-routing surface, and no tool-grants surface in the slim model — model selection and tool access are delegated to the host (Cursor or Copilot).

Authoritative plugin docs: `plugins/controlflow-cursor/README.md`, `plugins/controlflow-cursor/USAGE.md`.

## What the plugin ships

The Cursor plugin packages the slim surface for Cursor:

- **Project Rules** (Cursor-native `.mdc` rules) — repo identity, tiers, offline eval gate, planning discipline.
- **Workflow Skills** (Cursor-native skills) — `controlflow-plan`, `controlflow-verify`, `controlflow-review` adapted from `.github/skills/`.
- **Agents** (Cursor-native `.cursor/agents/` files installed by the plugin) — a Cursor approximation of the planner, plus optional persona agents for the conceptual executor roles.

The 8 executor role labels (`CodeMapper-subagent`, `Researcher-subagent`, `CoreImplementer-subagent`, `UIImplementer-subagent`, `PlatformEngineer-subagent`, `TechnicalWriter-subagent`, `BrowserTester-subagent`, `CodeReviewer-subagent`) and the 3 inline verify roles (`PlanAuditor`, `AssumptionVerifier`, `ExecutabilityVerifier`) are **conceptual roles** the Planner assigns in plan phases. Cursor executes them inline or via Cursor's Task tool — they are not shipped VS Code agent files. See `plans/project-context.md` for the full role taxonomy.

## Integration levels

| Level | Surface | What you get |
| ----- | ------- | ------------ |
| 1 | Project Rules only | Conventions when editing matching files; no workflow skills |
| 2 | Rules + Skills | plan → verify → review with `plans/` artifacts |
| 3 | Rules + Skills + agents | Delegation via Cursor's `Task` tool to named persona agents |
| 4 | VS Code Copilot | Full `@controlflow-planner` + native Copilot subagent dispatch (not in Cursor) |

The plugin ships **level 3** assets. Consumers install level 3 with the plugin's install script.

## Role mapping (conceptual roles → Cursor surface)

The Cursor plugin installs agents that approximate the conceptual executor roles. The prompt bodies live in the plugin (adapted from the slim `.github/` source), not in deleted root `*.agent.md` files.

| Conceptual role | Cursor surface (installed by the plugin) |
| --------------- | ---------------------------------------- |
| Planner | Cursor planner agent + `controlflow-plan` skill |
| PlanAuditor (verify phase 1) | `controlflow-verify` skill (inline) |
| AssumptionVerifier (verify phase 2) | `controlflow-verify` skill (inline) |
| ExecutabilityVerifier (verify phase 3) | `controlflow-verify` skill (inline) |
| CodeMapper-subagent | Cursor `code-mapper` agent (read-only) |
| Researcher-subagent | Cursor `researcher` agent (read-only) |
| CoreImplementer-subagent | Cursor `core-implementer` agent |
| UIImplementer-subagent | Cursor `ui-implementer` agent |
| PlatformEngineer-subagent | Cursor `platform-engineer` agent |
| TechnicalWriter-subagent | Cursor `technical-writer` agent |
| BrowserTester-subagent | Cursor `browser-tester` agent |
| CodeReviewer-subagent | `controlflow-review` skill (inline) + optional Cursor review agent |

The three verify roles are **not** recreated as Cursor agents — they are the inline phases of the `controlflow-verify` skill, which is the non-native value-add.

## Delegation via Cursor's Task tool

When a plan phase assigns an executor role and Cursor's Task tool is available for custom agents, the parent session can delegate:

```text
Task(subagent_type="controlflow-core-implementer", description="Implement phase 2", prompt="...")
```

The `prompt` must be self-contained: plan path, complexity tier, expected report sections, and any template paths under `plugins/controlflow-cursor/templates/`.

### Task tool fallback

Some Cursor builds do not expose Task for custom agents (see the Cursor forum thread on Task-tool availability for `.cursor/agents/`). When Task is unavailable:

1. Run the same instructions in the parent session.
2. Apply the matching skill (`controlflow-verify`, `controlflow-review`, etc.).
3. Save output under `plans/artifacts/<task-slug>/` as Markdown.

Do not claim subagent isolation was enforced if the fallback ran in the parent session.

## What Cursor cannot do (parity gaps)

- `@controlflow-planner` chat mentions or VS Code Copilot custom agent UI.
- `agent/runSubagent` with VS Code payload schemas.
- VS Code-only tools (`vscode/askQuestions`, `read/problems`).
- Deterministic model routing — the slim model has no model-routing surface anyway; model selection is delegated to the host.
- Guaranteed parallel waves with runtime write locks — discipline only. (The slim model has no wave dispatch surface; parallelism is native to the host.)

## What is preserved (semantic parity)

- Complexity tiers: `TRIVIAL` → `LARGE` verify/review depth (see the README pipeline table).
- Artifact paths: `plans/<task-slug>-plan.md`, `plans/artifacts/<task-slug>/`.
- Failure classification enum (`transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable`) recorded in plan lifecycle sections; retry routing is the host's job.
- Offline eval gate: `cd evals && npm test`.
- The 7 semantic-risk categories and the schema-anchored plan format.

## Installation modes

### ControlFlow repository (development)

Open the repo in Cursor. The plugin's Project Rules, skills, and agents load from `plugins/controlflow-cursor/` and the plugin's installed `.cursor/` assets. After editing shared-source skills, refresh with the plugin's sync script (see `plugins/controlflow-cursor/USAGE.md`).

### Another repository (consumer)

From the ControlFlow repo root:

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-cursor/scripts/install-project.ps1 -TargetRepo C:\path\to\your-app
```

Creates or updates `.cursor/skills`, `.cursor/agents`, a minimal rules subset, and `plans/` scaffolding. The retired root `.cursor/rules` mirror is no longer the install target.

## Validation commands

```sh
# Structural validation
cd evals && npm run test:structural

# Full offline suite
cd evals && npm test
```

## Authoritative references

| Concern | File |
| ------- | ---- |
| Cursor plugin package | `plugins/controlflow-cursor/` |
| Cursor plugin usage | `plugins/controlflow-cursor/USAGE.md` |
| Shared policies | `.github/copilot-instructions.md` |
| Role taxonomy and tiers | `plans/project-context.md` |
| Native delegation boundary | `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md` |
| SDK / CI (optional) | `docs/agent-engineering/CURSOR-SDK.md` |
| Eval harness | `evals/README.md` |

## Changing Cursor assets

Before modifying the plugin's rules, skills, or agents:

1. Prefer editing the shared source and syncing via the plugin's sync script (see `plugins/controlflow-cursor/USAGE.md`).
2. Do not imply Cursor can use `agent/runSubagent` or VS Code-only tools.
3. Run `cd evals && npm test` before declaring done.
4. Update `evals/scenarios/cursor-plugin/` contracts when adding agents or skills.

## Retired surfaces (historical reference only)

The legacy root `.cursor/rules/*.mdc` mirror and the retired `@Planner` / `@Orchestrator` chat-mention model are no longer part of the shipped surface. The retired governance/model-routing.json knob and the former docs/agent-engineering/TOOL-ROUTING.md are not part of the slim model. See `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md` for the full retirement rationale.