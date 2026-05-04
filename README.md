# ControlFlow

[![CI](https://github.com/Smithbox-ai/ControlFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/Smithbox-ai/ControlFlow/actions/workflows/ci.yml)
![Agents](https://img.shields.io/badge/agents-13-blue)
![Eval](https://img.shields.io/badge/eval-offline-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

A multi-agent orchestration system for VS Code Copilot, plus a maintained Codex plugin. ControlFlow coordinates 13 specialized agents under deterministic **P.A.R.T contracts** (Prompt → Archive → Resources → Tools), structured text outputs, and layered reliability gates.

---

## Contents

- [Why ControlFlow?](#why-controlflow)
- [Quick Start](#quick-start)
- [When to Use Which Agent](#when-to-use-which-agent)
- [Pipeline by Complexity](#pipeline-by-complexity)
- [Orchestration State Machine](#orchestration-state-machine)
- [Failure Routing](#failure-routing)
- [Agent Architecture](#agent-architecture)
- [Evaluation Suite](#evaluation-suite)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Installation](#installation)
- [ControlFlow for Codex (Plugin)](#controlflow-for-codex-plugin)
- [License](#license)

---

## Why ControlFlow?

| | Single Agent | ControlFlow (13 agents) |
| --- | --- | --- |
| **Planning** | Agent guesses architecture on-the-fly | Planner runs structured idea interview, produces phased plan with Mermaid diagrams |
| **Quality gates** | None | PlanAuditor + AssumptionVerifier + ExecutabilityVerifier audit before implementation |
| **Execution** | Sequential, monolithic | Wave-based parallel execution with inter-phase contracts |
| **Failures** | Silent or catastrophic | Classified (`transient`/`fixable`/`needs_replan`/`escalate`, plus `model_unavailable`) with bounded retry routing |
| **Scope drift** | Common | [LLM Behavior Guidelines](skills/patterns/llm-behavior-guidelines.md) enforce surgical changes |
| **Verification** | Manual | Offline eval suite + CodeReviewer gates every phase |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/Smithbox-ai/ControlFlow.git

# 2. Copy to your VS Code prompts directory (or symlink)
#    Windows: %APPDATA%\Code\User\prompts
#    macOS:   ~/Library/Application Support/Code/User/prompts
#    Linux:   ~/.config/Code/User/prompts

# 3. Enable in VS Code settings:
#    { "chat.customAgentInSubagent.enabled": true,
#      "github.copilot.chat.responsesApiReasoningEffort": "high" }

# 4. Reload VS Code → type @Planner in Copilot Chat

# 5. Verify evals
cd evals && npm install && npm test
```

> **First task?** Type `@Planner "Add OAuth login with Google"` — the system handles the rest.
>
> **Quick project status?** Run `cd evals && npm run health` for an offline, read-only operator report (git status by surface, NOTES.md state, plans by status, latest session outcome, artifact coverage).

---

## When to Use Which Agent

| Scenario | Agent | What happens |
| ---------- | ------- | -------------- |
| Abstract idea or vague goal | `@Planner` | Idea interview → phased plan → Mermaid diagram |
| Detailed task, clear requirements | `@Orchestrator` | Dispatches subagents → verification gates → phase-by-phase execution |
| Research question | `@Researcher` | Evidence-based investigation with confidence scores |
| Quick codebase exploration | `@CodeMapper` | Read-only discovery — files, dependencies, entry points |

**Typical workflow:** `@Planner` authors a plan → you approve → `@Orchestrator` executes it with full subagent coordination, review gates, and approvals.

---

## Pipeline by Complexity

| Tier | Scope | Review Agents | Max Iterations |
| ------ | ------- | --------------- | ---------------- |
| **TRIVIAL** | 1–2 files, single concern | None (CodeReviewer still runs per-phase) | — |
| **SMALL** | 3–5 files, single domain | PlanAuditor | 2 |
| **MEDIUM** | 6–15 files, cross-domain | PlanAuditor + AssumptionVerifier | 5 |
| **LARGE** | 15+ files, system-wide | PlanAuditor + AssumptionVerifier + ExecutabilityVerifier | 5 |

Any plan with an unresolved `HIGH`-impact `risk_review` entry forces the full pipeline regardless of tier.

CodeReviewer still runs after each implementation, testing, documentation, or platform phase. Ordinary multi-phase waves use one user approval per wave; destructive/high-risk phases and phases that are `FAILED` or `BLOCKED` require per-phase approval. Todo completion remains per-phase.

---

## Orchestration State Machine

```mermaid
stateDiagram-v2
    [*] --> PLANNING
    PLANNING --> WAITING_APPROVAL: plan ready
    WAITING_APPROVAL --> PLAN_REVIEW: user approved
    PLAN_REVIEW --> ACTING: audit passed
    PLAN_REVIEW --> PLANNING: needs revision
    WAITING_APPROVAL --> ACTING: trivial plan (skip review)
    ACTING --> REVIEWING: phase complete
    REVIEWING --> WAITING_APPROVAL: review / approval point
    WAITING_APPROVAL --> ACTING: next wave or phase approved
    WAITING_APPROVAL --> COMPLETE: all phases done
    COMPLETE --> [*]
```

> Simplified — REJECTED transition, HIGH_RISK_APPROVAL_GATE, required PLAN_REVIEW ABSTAIN handling, and final review paths omitted for clarity. See `Orchestrator.agent.md` for the full state machine.

---

## Failure Routing

| Classification | Action | Max Retries |
| ---------------- | -------- | ------------- |
| `transient` | Retry same agent | 3 |
| `fixable` | Retry with fix hint | 1 |
| `needs_replan` | Delegate to Planner | 1 |
| `escalate` | Stop — present to user | 0 |
| `model_unavailable` | Retry same agent with model-substitution semantics, then escalate on exhaustion | `retry_budgets.model_unavailable_max` |

When any retry budget is exhausted the phase escalates to the user with accumulated failure evidence.

PlanAuditor and AssumptionVerifier intentionally exclude `transient` and may use `model_unavailable` when their assigned model is unreachable. ExecutabilityVerifier can use all five failure classifications.

---

## Agent Architecture

### Interaction diagram

```mermaid
graph TB
    User((User))

    subgraph Orchestration
        Orchestrator[Orchestrator<br/><i>conductor & gate controller</i>]
        Planner[Planner<br/><i>structured planning</i>]
    end

    subgraph "Adversarial Review"
        PlanAuditor[PlanAuditor<br/><i>plan audit</i>]
        AssumptionVerifier[AssumptionVerifier<br/><i>mirage detection</i>]
        ExecutabilityVerifier[ExecutabilityVerifier<br/><i>executability check</i>]
    end

    subgraph Research
        Researcher[Researcher<br/><i>evidence-first research</i>]
        CodeMapper[CodeMapper<br/><i>codebase discovery</i>]
    end

    subgraph Implementation
        CoreImplementer[CoreImplementer<br/><i>backend implementation</i>]
        UIImplementer[UIImplementer<br/><i>frontend implementation</i>]
        PlatformEngineer[PlatformEngineer<br/><i>CI/CD & infrastructure</i>]
    end

    subgraph Verification
        CodeReviewer[CodeReviewer<br/><i>code review & safety</i>]
        BrowserTester[BrowserTester<br/><i>scripted E2E & accessibility</i>]
    end

    subgraph Documentation
        TechnicalWriter[TechnicalWriter<br/><i>docs & diagrams</i>]
    end

    User -->|idea / vague goal| Planner
    User -->|detailed task| Orchestrator
    User -->|research question| Researcher
    User -->|codebase question| CodeMapper
    Planner -->|structured plan| Orchestrator
    Orchestrator -->|dispatch| Research
    Orchestrator -->|dispatch| Implementation
    Orchestrator -->|dispatch| Verification
    Orchestrator -->|dispatch| Documentation
    Orchestrator -->|audit| PlanAuditor
    Orchestrator -->|audit| AssumptionVerifier
    Orchestrator -->|audit| ExecutabilityVerifier

    style Orchestrator fill:#4A90D9,color:#fff
    style Planner fill:#7B68EE,color:#fff
    style PlanAuditor fill:#E74C3C,color:#fff
    style AssumptionVerifier fill:#E74C3C,color:#fff
    style ExecutabilityVerifier fill:#E74C3C,color:#fff
    style Researcher fill:#2ECC71,color:#fff
    style CodeMapper fill:#2ECC71,color:#fff
    style CoreImplementer fill:#F39C12,color:#fff
    style UIImplementer fill:#F39C12,color:#fff
    style PlatformEngineer fill:#F39C12,color:#fff
    style CodeReviewer fill:#1ABC9C,color:#fff
    style BrowserTester fill:#1ABC9C,color:#fff
    style TechnicalWriter fill:#9B59B6,color:#fff
```

### Primary Agents

| Agent | File | Role |
| ------- | ------ | ------ |
| **Orchestrator** | `Orchestrator.agent.md` | Conductor, gate controller, delegation |
| **Planner** | `Planner.agent.md` | Structured planning, idea interviews |

### Specialized Subagents

| Agent | File | Role |
| ------- | ------ | ------ |
| **Researcher** | `Researcher-subagent.agent.md` | Evidence-first research |
| **CodeMapper** | `CodeMapper-subagent.agent.md` | Read-only codebase discovery |
| **CodeReviewer** | `CodeReviewer-subagent.agent.md` | Code review and safety gates |
| **PlanAuditor** | `PlanAuditor-subagent.agent.md` | Adversarial plan audit |
| **AssumptionVerifier** | `AssumptionVerifier-subagent.agent.md` | Assumption-fact confusion detection |
| **ExecutabilityVerifier** | `ExecutabilityVerifier-subagent.agent.md` | Cold-start plan executability simulation |
| **CoreImplementer** | `CoreImplementer-subagent.agent.md` | Backend implementation |
| **UIImplementer** | `UIImplementer-subagent.agent.md` | Frontend implementation |
| **PlatformEngineer** | `PlatformEngineer-subagent.agent.md` | CI/CD, containers, infrastructure |
| **TechnicalWriter** | `TechnicalWriter-subagent.agent.md` | Documentation, diagrams, code-doc parity |
| **BrowserTester** | `BrowserTester-subagent.agent.md` | Runs provided E2E/accessibility scripts or harnesses; abstains when no executable harness is supplied |

VS Code Copilot defaults to reading the literal `model:` value from each agent frontmatter. However, for internal orchestrated dispatch (via `agent/runSubagent`), **ControlFlow actively resolves `governance/model-routing.json` at call time** (routing dynamically based on task complexity) — see [docs/agent-engineering/MODEL-ROUTING.md](docs/agent-engineering/MODEL-ROUTING.md).

---

## Evaluation Suite

`cd evals && npm test` is the canonical offline suite. It runs structural validation plus prompt-behavior, orchestration-handoff, drift, NOTES.md, archive-script, and fingerprint regression checks. No live agents, no network.

See [`evals/README.md`](evals/README.md) for pass descriptions and how to add scenarios.

---

## Project Structure

```text
├── Orchestrator.agent.md          # Conductor agent
├── Planner.agent.md               # Planning agent
├── *-subagent.agent.md            # 11 specialized subagents
├── .github/
│   └── copilot-instructions.md    # Shared agent policy (loaded by all agents)
├── schemas/                       # JSON Schema contracts
├── docs/
│   ├── agent-engineering/         # Governance policies and reliability gates
│   └── tutorial-ru/               # Full Russian-language tutorial (19 chapters)
├── governance/                    # Operational knobs and tool grants
├── skills/                        # Reusable domain pattern library (15 patterns)
├── evals/                         # Offline validation suite
│   └── scenarios/                 # Eval scenario fixtures
├── plans/                         # Plan artifacts and templates
├── plugins/
│   └── controlflow-codex/         # Codex CLI plugin (9 portable skills)
└── NOTES.md                       # Active objective state (repo-persistent)
```

---

## Documentation

- **[docs/tutorial-en/](docs/tutorial-en/README.md)** — full English tutorial: architecture, agents, orchestration, planning, review pipeline, schemas, governance, skills, memory, failure taxonomy, evals, case studies, exercises, glossary, FAQ.
- **[docs/tutorial-ru/](docs/tutorial-ru/README.md)** — то же на русском языке.
- **[docs/agent-engineering/](docs/agent-engineering/)** — authoritative governance specs: P.A.R.T, reliability gates, clarification policy, tool routing, scoring, observability, memory architecture.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to add agents, schemas, eval scenarios.
- **[CHANGELOG.md](CHANGELOG.md)** — version history.

---

## Installation

> **VS Code prompts directory:**
>
> - **Windows:** `%APPDATA%\Code\User\prompts`
> - **macOS:** `~/Library/Application Support/Code/User/prompts`
> - **Linux:** `~/.config/Code/User/prompts`

1. Clone this repository.
2. Copy the entire repo contents into the prompts directory (or symlink the repo there).
3. Enable custom agents in VS Code settings:

   ```json
   {
     "chat.customAgentInSubagent.enabled": true,
     "github.copilot.chat.responsesApiReasoningEffort": "high"
   }
   ```

4. Reload VS Code.
5. Verify: type `@Planner` in Copilot Chat — the agent should appear in suggestions.
6. Run evals: `cd evals && npm install && npm test`

Without `.github/copilot-instructions.md` agents will not have access to shared failure classification, conventions, and governance references.

### Adding Custom Agents

Create a new `.agent.md` file following the P.A.R.T structure (Prompt → Archive → Resources → Tools). See [CONTRIBUTING.md](CONTRIBUTING.md) for the full 4-step process.

---

## ControlFlow for Codex (Plugin)

A portable adaptation of ControlFlow for [OpenAI Codex CLI](https://github.com/openai/codex), located in [`plugins/controlflow-codex/`](plugins/controlflow-codex/).

The plugin brings the core ControlFlow disciplines — phased planning, pre-execution plan review, assumption verification, orchestration, evidence-backed code review, and memory hygiene — into Codex without depending on VS Code-specific tool contracts, fixed agent rosters, or `@Agent` syntax.

### Included Skills

| Skill | Analogous ControlFlow Role |
|-------|---------------------------|
| `$controlflow-router` | Entry-point dispatcher |
| `$controlflow-strict-workflow` | Orchestrator (full workflow entry point) |
| `$controlflow-planning` | Planner — writes `plans/<task-slug>-plan.md` |
| `$controlflow-plan-audit` | PlanAuditor |
| `$controlflow-assumption-verifier` | AssumptionVerifier |
| `$controlflow-executability-verifier` | ExecutabilityVerifier |
| `$controlflow-orchestration` | Orchestrator (execution-only path) |
| `$controlflow-review` | CodeReviewer |
| `$controlflow-memory-hygiene` | Memory hygiene |

Complexity routing matches the main project: `TRIVIAL` → optional; `SMALL` → plan-audit; `MEDIUM` → plan-audit + assumption-verifier; `LARGE` → full pipeline.

### Installation

From the repository root:

```powershell
# Windows — installs to ~/plugins/controlflow-codex/ and registers in ~/.agents/plugins/marketplace.json
powershell -ExecutionPolicy Bypass -File plugins/controlflow-codex/scripts/install-home-local.ps1

# Re-install (replace existing)
powershell -ExecutionPolicy Bypass -File plugins/controlflow-codex/scripts/install-home-local.ps1 -Force
```

After installation, the plugin is available in Codex as `$controlflow-*` skills.

### Usage

Recommended entry point for any non-trivial task:

```
Use $controlflow-strict-workflow to handle this repository task from plan through execution.
```

For individual steps:

```
# Write a strict plan artifact
Use $controlflow-planning to write a plan in plans/ for this task.

# Audit an existing plan before coding
Use $controlflow-plan-audit to review plans/my-task-plan.md.

# Check for hidden assumptions
Use $controlflow-assumption-verifier to find mirages in plans/my-task-plan.md.

# Execute an approved plan in phases
Use $controlflow-orchestration to execute plans/my-task-plan.md.

# Review completed implementation
Use $controlflow-review to review the completed implementation.
```

See [`plugins/controlflow-codex/USAGE.md`](plugins/controlflow-codex/USAGE.md) for the full prompt catalog and [`plugins/controlflow-codex/README.md`](plugins/controlflow-codex/README.md) for detailed documentation.

### Validating Codex Strict-Plan Artifacts

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-codex/scripts/validate-strict-artifacts.ps1 `
  -RepoRoot . `
  -PlanPath plans/my-task-plan.md `
  -RequirePlanAudit `
  -RequireAssumptionVerifier
```

The `validate-strict-artifacts.ps1` script validates **Codex strict-plan artifacts only**. Do not use it for core VS Code plans. It enforces the mandatory lifecycle sections (`## Progress`, `## Discoveries`, `## Decision Log`, `## Outcomes`, `## Idempotence & Recovery`).

### Intentional Differences from the VS Code Version

- Symphony daemon/runtime, Linear workflow, and Gem Team multi-plugin packaging were NOT imported.

- No `@Agent` syntax or fixed subagent roster.
- No `agent/runSubagent` dispatch or `governance/model-routing.json` — model selection is Codex's responsibility.
- No VS Code-specific tool surfaces (`vscode/askQuestions`, `read/problems`, etc.).
- Plan artifact structure (`plans/<task-slug>-plan.md`) and review artifact paths (`plans/artifacts/<task-slug>/`) are identical to the main project.
- Skills use `update_plan` and local shell inspection rather than schema-driven chat payloads.

---

## License

MIT. Copyright (c) 2026 ControlFlow Contributors.

## Acknowledgments

ControlFlow was inspired by and builds upon ideas from:

- [Github-Copilot-Atlas](https://github.com/bigguy345/Github-Copilot-Atlas) — original multi-agent orchestration concept for VS Code Copilot.
- [claude-bishx](https://github.com/bish-x/claude-bishx) — agent engineering patterns and structured workflows.
- [copilot-orchestra](https://github.com/ShepAlderson/copilot-orchestra)
- [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)
