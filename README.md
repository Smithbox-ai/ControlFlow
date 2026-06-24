# ControlFlow

[![CI](https://github.com/Smithbox-ai/ControlFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/Smithbox-ai/ControlFlow/actions/workflows/ci.yml)
![Surface](https://img.shields.io/badge/surface-1%20agent%20%C2%B7%203%20skills-blue)
![Delegation](https://img.shields.io/badge/native%20delegation-zero%20duplication-brightgreen)
![Eval](https://img.shields.io/badge/eval-offline-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

A thin, non-duplicating layer over GitHub Copilot's native agent capabilities. ControlFlow ships **one agent** (`@controlflow-planner`) and **three skills** (`controlflow-plan`, `controlflow-verify`, `controlflow-review`) over native Copilot, and keeps only what Copilot does not provide natively: the schema-enforced plan format, adversarial verification, the 7-category semantic-risk taxonomy, plan-vs-implementation scope-drift review, and the contract-drift eval suite.

The canonical native-vs-ControlFlow delegation boundary lives in [docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md).

---

## Contents

- [ControlFlow](#controlflow)
  - [Contents](#contents)
  - [Why ControlFlow?](#why-controlflow)
  - [Quick Start](#quick-start)
  - [The Slim Surface](#the-slim-surface)
  - [Pipeline by Complexity](#pipeline-by-complexity)
  - [Evaluation Suite](#evaluation-suite)
  - [Project Structure](#project-structure)
  - [Documentation](#documentation)
  - [Installation](#installation)
  - [ControlFlow for Claude Code (Plugin)](#controlflow-for-claude-code-plugin)
  - [ControlFlow for Codex (Plugin)](#controlflow-for-codex-plugin)
  - [ControlFlow for Cursor (Plugin)](#controlflow-for-cursor-plugin)
  - [License](#license)
  - [Acknowledgments](#acknowledgments)

---

## Why ControlFlow?

Copilot now does planning, subagent dispatch, code review, skills, model selection, and approvals natively (see the [boundary doc](docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)). ControlFlow does not duplicate any of that. It adds the five disciplines Copilot does not have:

| | Copilot native | ControlFlow adds |
| --- | --- | --- |
| **Planning** | `/plan` discovery + Alignment + Design | Schema-enforced plan *format* (YAML header, 10 sections, 7-category semantic risk, Mermaid per tier) written to `plans/` |
| **Verification** | None | Adversarial `controlflow-verify` (structural audit, mirage detection, executability cold-start) → `APPROVED` / `NEEDS_REVISION` / `REJECTED` |
| **Review** | Agentic code review | `controlflow-review` layers plan-vs-implementation scope-drift + evidence discipline + proactive vulnerability search over native review |
| **Workflow policy** | None | Tier-gated pipeline (`TRIVIAL` / `SMALL` / `MEDIUM` / `LARGE`) with verify-phase depth |
| **Drift control** | None | Offline contract-drift eval suite asserts the plan format, the role taxonomy, and the governance config stay aligned across files |

Execution, tool access, model selection, retries, and parallelism are delegated to native Copilot. ControlFlow keeps no shipped subagents and no dispatch state machine.

---

## Quick Start

The slim surface lives at `.github/` — Copilot reads `agents/`, `skills/`, and `copilot-instructions.md` natively from there.

```bash
# 1. Clone
git clone https://github.com/Smithbox-ai/ControlFlow.git

# 2. Open the repo in VS Code → open Copilot Chat → switch to Agent mode
#    → open the agents dropdown → select "controlflow-planner"

# 3. Prompt it. Example:
#    @controlflow-planner Add a hello-world function
#    (Selecting from the dropdown is the GA-confirmed invocation path.
#     @controlflow-planner via @-mention also works if it surfaces in your setup.)

# 4. The Planner writes a schema-conforming plan to plans/<task-slug>-plan.md
#    and points you to the artifact path (it never inlines the plan in chat).

# 5. Verify evals
cd evals && npm install && npm test
```

> **First task?** In Copilot Chat Agent mode, select `controlflow-planner` from the agents dropdown and prompt `Add OAuth login with Google` — the Planner runs an Idea Interview if the request is vague, then writes the plan artifact.
>
> **Quick project status?** Run `cd evals && npm run health` for an offline, read-only operator report (git status by surface, NOTES.md state, plans by status, latest session outcome, artifact coverage).

For SMALL+ work, run `/controlflow-verify` on the plan before implementing, then `/controlflow-review` after implementation.

---

## The Slim Surface

| Surface | Path | Role |
| --- | --- | --- |
| `@controlflow-planner` agent | `.github/agents/controlflow-planner.agent.md` | The sole shipped agent. Runs the plan skill + Idea Interview; hands execution to native Copilot. Uses the Copilot Auto model picker (no `model:` frontmatter). |
| `controlflow-plan` skill | `.github/skills/controlflow-plan/SKILL.md` + `references/` | Produces a schema-anchored plan artifact in `plans/`. Single-sources the format from `schemas/planner.plan.schema.json` + `plans/templates/plan-document-template.md`. |
| `controlflow-verify` skill | `.github/skills/controlflow-verify/SKILL.md` + `references/` | Inline adversarial verification (zero subagents). Tier-gated phases: structural audit, mirage detection, executability cold-start. Emits a verdict. |
| `controlflow-review` skill | `.github/skills/controlflow-review/SKILL.md` + `references/` | Evidence-backed review layered over native Copilot code review. Adds plan-vs-implementation scope-drift comparison. |
| Routing stub | `.github/copilot-instructions.md` | Shared policies; ties plan → verify → review together. |

The role labels in plans (`CodeMapper-subagent`, `Researcher-subagent`, `CoreImplementer-subagent`, `UIImplementer-subagent`, `PlatformEngineer-subagent`, `TechnicalWriter-subagent`, `BrowserTester-subagent`, `CodeReviewer-subagent`) and the three inline verify roles (`PlanAuditor`, `AssumptionVerifier`, `ExecutabilityVerifier`) are **conceptual roles** the Planner assigns in plan phases and native Copilot executes inline — they are not shipped agent files. See `plans/project-context.md` for the full role taxonomy, and [NATIVE-DELEGATION-BOUNDARY.md §5](docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md) for how to recreate a specialized persona as a native Copilot custom agent if you want one back.

There is no `governance/model-routing.json`, `governance/tool-grants.json`, or `governance/agent-grants.json` — model selection, tool access, and subagent governance are delegated to native Copilot.

---

## Pipeline by Complexity

| Tier | Scope | Plan | Verify (inline phases) | Review |
| --- | --- | --- | --- | --- |
| **TRIVIAL** | 1–2 files, single concern | skip | skip | skip |
| **SMALL** | 3–5 files, single domain | `controlflow-plan` | phase 1 (structural audit) | `controlflow-review` |
| **MEDIUM** | 6–14 files, cross-domain | `controlflow-plan` | phases 1–2 (audit + assumption/mirage) | `controlflow-review` |
| **LARGE** | 15+ files, system-wide | `controlflow-plan` | phases 1–3 (audit + mirage + executability cold-start) | `controlflow-review` |

Any plan with an unresolved `HIGH`-impact semantic-risk entry forces `LARGE` regardless of file count. Do not begin implementation on SMALL+ work until `controlflow-verify` returns `APPROVED`.

Failure classifications (`transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable`) are recorded in plan lifecycle sections; retry routing and parallelism are native Copilot's job, not ControlFlow's.

---

## Evaluation Suite

`cd evals && npm test` is the canonical offline suite. No live agents, no network. It runs structural validation plus prompt-behavior-contract, drift-detection (including the `plans/project-context.md` ↔ `governance/project-context-registry.json` mirror and the `CLAUDE.md` ↔ plan-contract drift), NOTES.md hygiene, archive-script, fingerprint, skill-discoverability, capability-matrix, plugin-manifest-parity, and `CLAUDE.md` contract-drift checks.

The cache at `evals/.cache/` may mask failures after structural edits — delete it (`rm -rf evals/.cache`) before trusting a green run.

See [`evals/README.md`](evals/README.md) for pass descriptions and how to add scenarios.

---

## Project Structure

```text
.github/
├── agents/
│   └── controlflow-planner.agent.md   # the sole shipped agent
├── skills/
│   ├── controlflow-plan/              # plan skill + references
│   ├── controlflow-verify/            # verify skill + references
│   └── controlflow-review/            # review skill + references
└── copilot-instructions.md            # shared routing stub
schemas/                               # JSON Schema contracts (planner.plan.schema.json is the immutable plan format)
governance/                            # Slimmed: runtime-policy.json, project-context-registry.json, canonical-source-matrix.json, rename-allowlist.json
plans/
├── project-context.md                 # slim roster + tiers + conventions (mirrors the registry)
└── templates/                         # plan + session-notes templates
skills/
├── patterns/                          # value-add domain patterns (19)
└── index.md                           # pattern domain mapping
docs/
├── agent-engineering/                 # governance docs + NATIVE-DELEGATION-BOUNDARY.md
├── tutorial-en/                        # English tutorial
└── tutorial-ru/                       # Russian tutorial
evals/                                 # offline validation suite
│   └── scenarios/                     # eval scenario fixtures
plugins/
├── controlflow-claude-code/          # Claude Code plugin (three skills, no plugin agents, standalone)
├── controlflow-codex/                # Codex CLI plugin (host adaptation)
└── controlflow-cursor/               # Cursor plugin (host adaptation)
NOTES.md                               # active objective state (repo-persistent)
```

---

## Documentation

- **[docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)** — the canonical native-vs-ControlFlow delegation boundary (table + audit checklist + specialized-agent recreation guide).
- **[docs/tutorial-en/](docs/tutorial-en/README.md)** — full English tutorial: architecture, the slim surface, planning, verify, review pipeline, schemas, governance, skills, memory, failure taxonomy, evals, case studies, exercises, glossary, FAQ.
- **[docs/tutorial-ru/](docs/tutorial-ru/README.md)** — то же на русском языке.
- **[docs/agent-engineering/](docs/agent-engineering/README.md)** — authoritative governance specs; see its README for the full, current index.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to add skills, edit the planner agent, edit governance, and contribute to plugins.
- **[CHANGELOG.md](CHANGELOG.md)** — version history.

---

## Installation

The slim surface lives at `.github/` and Copilot reads it natively from a repo opened in VS Code. To use ControlFlow in **another** repository, copy the slim surface + its contracts:

1. Copy `.github/agents/`, `.github/skills/`, `.github/copilot-instructions.md` into your repo's `.github/`.
2. Copy `schemas/`, `governance/`, `plans/templates/`, `plans/project-context.md`, `skills/`, and `evals/` if you want the contract-drift gate and pattern library.
3. Open your repo in VS Code → Copilot Chat → Agent mode → select `controlflow-planner` from the agents dropdown.
4. Verify evals: `cd evals && npm install && npm test`.

For Cursor or Codex hosts, use the host plugins below instead of copying `.github/`.

Without `.github/copilot-instructions.md` the skills lose the shared routing stub (failure classification, conventions, governance references) — keep it.

---

## ControlFlow for Claude Code (Plugin)

A lightweight, standalone adaptation of ControlFlow for [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code), located in [`plugins/controlflow-claude-code/`](plugins/controlflow-claude-code/).

Version `1.0.0` is **three skills, zero plugin agents** — it produces high-quality plans in the shared ControlFlow plan format, verifies them inline with adversarial framing, and reviews code as a thin layer over the host's native toolset (VS Code Copilot Chat primary; Claude Code, Codex, and Cursor mirrors shipped as plugins). It does not duplicate or shadow native `/code-review`, `Explore`, `Plan`, or the `code-reviewer` subagent. The Claude Code plugin is hand-maintained and intentionally **not** generated by the shared-source plugin generator; the Codex and Cursor plugins are regenerated from `.github/skills/` via `plugins/controlflow-shared-source/`.

### Installing the Plugin

The repo-root [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) registers this plugin under the `controlflow-marketplace` local marketplace.

**Global install (recommended — available in every project, lives in `~/.claude`):**

```sh
# 1. From the repo root, register the marketplace (user scope = global)
claude plugin marketplace add ./ --scope user

# 2. Install the plugin (default scope is user = global)
claude plugin install controlflow-claude-code@controlflow-marketplace

# 3. Verify
claude plugin list
```

Use `--scope project` to scope the marketplace to the current project only, or `--scope local` for a one-off. After install, the three skills are available in every new session as `/controlflow-claude-code:controlflow-plan`, `:controlflow-verify`, `:controlflow-review`. To update after pulling repo changes, re-run the install command; to remove, `claude plugin uninstall controlflow-claude-code@controlflow-marketplace`.

**Local development (no install — load straight from the working tree):**

```sh
claude --plugin-dir ./plugins/controlflow-claude-code
```

**Validate the plugin manifest:**

```sh
cd plugins/controlflow-claude-code && claude plugin validate .
```

### Skills

| Skill | Purpose |
| ----- | ------- |
| `/controlflow-claude-code:controlflow-plan` | Generate a plan in the shared ControlFlow format → `plans/<task-slug>-plan.md` |
| `/controlflow-claude-code:controlflow-verify` | Inline adversarial pre-execution verification (zero subagents) → `APPROVED` / `NEEDS_REVISION` / `REJECTED` |
| `/controlflow-claude-code:controlflow-review` | Evidence-backed review layered over native `/code-review`, with plan-vs-implementation scope-drift comparison |

Typical flow: `controlflow-plan` → `controlflow-verify` (must return `APPROVED`) → implement → `controlflow-review`.

See [`plugins/controlflow-claude-code/README.md`](plugins/controlflow-claude-code/README.md) and [`plugins/controlflow-claude-code/USAGE.md`](plugins/controlflow-claude-code/USAGE.md) for full documentation.

---

## ControlFlow for Codex (Plugin)

A portable adaptation of ControlFlow for [OpenAI Codex CLI](https://github.com/openai/codex), located in [`plugins/controlflow-codex/`](plugins/controlflow-codex/). The Codex plugin is a host adaptation generated from the shared source; it is being aligned to the slim canonical `.github/` surface. See [`plugins/controlflow-codex/README.md`](plugins/controlflow-codex/README.md) and [`plugins/controlflow-codex/USAGE.md`](plugins/controlflow-codex/USAGE.md) for the current skill catalog, installation, and the strict-plan artifact validator.

---

## ControlFlow for Cursor (Plugin)

ControlFlow ships a **Cursor plugin** (Project Rules, workflow Skills, and agents) at [`plugins/controlflow-cursor/`](plugins/controlflow-cursor/). Cursor does not support `@controlflow-planner` or VS Code `runSubagent`; the Cursor plugin approximates the slim flow with Cursor's native surfaces. See [`plugins/controlflow-cursor/README.md`](plugins/controlflow-cursor/README.md) and the install script for the current surface and quick start.

---

## License

MIT. Copyright (c) 2026 ControlFlow Contributors.

## Acknowledgments

ControlFlow was inspired by and builds upon ideas from:

- [Github-Copilot-Atlas](https://github.com/bigguy345/Github-Copilot-Atlas) — original multi-agent orchestration concept for VS Code Copilot.
- [claude-bishx](https://github.com/bish-x/claude-bishx) — agent engineering patterns and structured workflows.
- [copilot-orchestra](https://github.com/ShepAlderson/copilot-orchestra)
- [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)