# Copilot Atlas (Fork)

> Modified fork of [bigguy345/Github-Copilot-Atlas](https://github.com/bigguy345/Github-Copilot-Atlas).

A multi-agent orchestration system for VS Code Copilot. This fork replaces vibe-based prompts with deterministic **P.A.R.T contracts** (Prompt → Archive → Resources → Tools), strict JSON Schema outputs, and reliability gates.

## Key Features

- **Context Conservation** — agents summarize and compress context at delegation boundaries to stay within token limits.
- **Parallel Agent Execution** — Atlas dispatches independent subagents in parallel when tasks have no dependencies, using wave-based execution from Prometheus plans.
- **Structured Planning** — Prometheus produces phased plans with explicit task IDs, dependencies, wave assignments, inter-phase contracts, and failure expectations before any code is written.
- **Deterministic Handoffs** — every subagent returns a structured JSON report; Atlas validates schema compliance before accepting results.
- **Reliability Gates** — PreFlect (pre-execution review), human approval gates for destructive operations, and explicit abstention when confidence is low.
- **TDD Integration** — Code-Review and implementation agents enforce test-first methodology.
- **Failure Taxonomy** — all agents classify failures (`transient`, `fixable`, `needs_replan`, `escalate`) enabling automated retry and routing by Atlas.
- **Batch Approval** — Atlas requests one approval per execution wave to reduce approval fatigue, with per-phase approval for destructive operations.
- **Health-First Testing** — BrowserTester verifies application health before running E2E scenarios to eliminate false positives.

## Agent Architecture

### Primary Agents

| Agent | File | Model | Role |
|-------|------|-------|------|
| **Atlas** | `Atlas.agent.md` | Claude Sonnet 4.6 | Orchestrator, gate controller, delegation |
| **Prometheus** | `Prometheus.agent.md` | Claude Opus 4.6 | Planning-only, phased implementation plans |

### Specialized Subagents

| Agent | File | Model | Role |
|-------|------|-------|------|
| **Oracle** | `Oracle-subagent.agent.md` | GPT-5.3-Codex | Evidence-first research |
| **Explorer** | `Explorer-subagent.agent.md` | Gemini 3 Flash | Read-only codebase discovery |
| **Code-Review** | `Code-Review-subagent.agent.md` | GPT-5.3-Codex | Verification, safety gate reviewer |
| **Sisyphus** | `Sisyphus-subagent.agent.md` | Claude Sonnet 4.6 | Implementation with execution reports |
| **Frontend-Engineer** | `Frontend-Engineer-subagent.agent.md` | Gemini 3.1 Pro | Frontend implementation with execution reports |
| **DevOps** | `DevOps-subagent.agent.md` | Claude Sonnet 4.6 | CI/CD, containers, infrastructure deployment |
| **DocWriter** | `DocWriter-subagent.agent.md` | Gemini 3.1 Pro | Documentation, diagrams, code-doc parity |
| **BrowserTester** | `BrowserTester-subagent.agent.md` | Gemini 3 Flash | E2E browser testing, accessibility audits |

### Clarification & Tool Routing

Prometheus and Atlas own user-facing clarification via `askQuestions`. Acting subagents (Sisyphus, Frontend-Engineer, DevOps, DocWriter, BrowserTester) return structured `NEEDS_INPUT` with `clarification_request` when they encounter ambiguity. Read-only agents (Oracle, Explorer, Code-Review) return findings, verdicts, or `ABSTAIN` — they do not interact with the user directly.

Each agent has role-specific routing rules for external tools. See `docs/agent-engineering/TOOL-ROUTING.md` and `docs/agent-engineering/CLARIFICATION-POLICY.md`.

## Reliability Model

Contracts are aligned to four dimensions:

1. **Consistency** — deterministic statuses and gate transitions.
2. **Robustness** — graceful behavior under paraphrase and naming drift.
3. **Predictability** — explicit abstention when confidence or evidence is low.
4. **Safety** — mandatory human approval gates for destructive and irreversible operations.
5. **Failure Taxonomy** — all agents classify failures as `transient`, `fixable`, `needs_replan`, or `escalate` for automated routing by Atlas.
6. **Clarification Reliability** — agents with `askQuestions` use it proactively for enumerated ambiguity classes; agents without it return structured `NEEDS_INPUT` for conductor routing.
7. **Tool Routing** — deterministic rules for local search vs external fetch vs Context7/MCP, with no phantom grants.

Reference: `docs/agent-engineering/RELIABILITY-GATES.md`.

## Usage

### Planning with Prometheus

Ask Prometheus to produce a structured plan for your task. Review the phased plan, approve it, then hand off to Atlas.

### Executing with Atlas

Atlas orchestrates phase execution: dispatches subagents, runs PreFlect gates before each batch, and requires human approval for high-risk operations. Continue phase-by-phase with explicit approvals where required.

### Direct Research with Oracle

For research-only tasks, invoke Oracle directly. It returns structured findings with evidence citations and confidence scores.

### Quick Exploration with Explorer

For fast codebase discovery, invoke Explorer. It performs parallel searches and returns a discovery report without modifying files.

## Workflow Example

```
User Request
    └── Prometheus (creates phased plan with waves)
         └── Atlas (orchestrates wave-based execution)
              ├── Wave 1: Foundation
              │    └── Explorer / Oracle (discovery & research)
              ├── Wave 2: Implementation (parallel)
              │    ├── Sisyphus (backend implementation)
              │    ├── Frontend-Engineer (UI implementation)
              │    └── DevOps (infrastructure deployment)
              ├── Wave 3: Verification
              │    ├── Code-Review (verification & safety)
              │    └── BrowserTester (E2E & accessibility)
              └── Wave 4: Documentation
                   └── DocWriter (docs & diagrams)
```

### Failure Routing

```
Subagent returns failure_classification
    ├── transient → Atlas retries same agent (max 3x)
    ├── fixable → Atlas retries with fix hint (max 1x)
    ├── needs_replan → Atlas delegates to Prometheus
    └── escalate → Atlas stops and presents to user
```

## Installation

1. Clone this repository.
2. Copy `*.agent.md` files to your VS Code prompts directory.
3. Reload VS Code.

## Configuration

### VS Code Settings

```json
{
  "chat.customAgentInSubagent.enabled": true,
  "github.copilot.chat.responsesApiReasoningEffort": "high"
}
```

### Adding Custom Agents

**Quick method:** Create a new `.agent.md` file following the P.A.R.T structure (Prompt → Archive → Resources → Tools).

**Manual method:** Copy an existing agent file (e.g., `Sisyphus-subagent.agent.md`) and modify the sections for your use case.

Every custom agent should include:
- A JSON Schema output contract in `schemas/`.
- Non-Negotiable Rules (no fabrication, abstain on uncertainty).
- Explicit tool restrictions in the `## Tools` section.

## Requirements

- VS Code Insiders recommended.
- GitHub Copilot with custom agent support.

## What Changed (Fork vs Upstream)

### P.A.R.T Migration

- All 7 agents migrated from vibe-based prompts to deterministic P.A.R.T contracts.
- Strict JSON Schema 2020-12 output contracts for all agents.
- Planning vs Acting split made explicit.
- PreFlect gate added before execution batches.
- Human approval gates for destructive and irreversible operations.
- Context compaction and agentic memory policy standardized.

### Post-Migration Revision

- Restored delegation heuristics and routing templates for Atlas and Prometheus.
- Added parallel search mandates and merging protocols for Explorer.
- Restored uncertainty protocols and confidence criteria for Oracle.
- Added stopping rules and best practices for Sisyphus and Frontend-Engineer.
- Strengthened Code-Review verdict schema with explicit approval/rejection criteria.

### Ecosystem Modernization

- Added 3 new specialized agents: DevOps, DocWriter, BrowserTester.
- Wave-aware parallel execution in Atlas (batch approval per wave).
- Failure taxonomy across all agents (`transient`, `fixable`, `needs_replan`, `escalate`).
- Inter-phase contracts and failure expectations in Prometheus plans.
- External delegation protocol schema to reduce Atlas context bloat.
- Health-first gate for BrowserTester to prevent false-positive E2E failures.
- Rollback protocol mandate for DevOps agent.

### New Artifacts

**Governance docs:**
- `docs/agent-engineering/PART-SPEC.md`
- `docs/agent-engineering/RELIABILITY-GATES.md`
- `docs/agent-engineering/MIGRATION-CORE-FIRST.md`
- `docs/agent-engineering/CLARIFICATION-POLICY.md`
- `docs/agent-engineering/TOOL-ROUTING.md`
- `docs/agent-engineering/COMPLIANCE-GAPS.md`

**Schema contracts:**
- `schemas/atlas.gate-event.schema.json`
- `schemas/atlas.delegation-protocol.schema.json`
- `schemas/prometheus.plan.schema.json`
- `schemas/oracle.research-findings.schema.json`
- `schemas/explorer.discovery.schema.json`
- `schemas/code-review.verdict.schema.json`
- `schemas/sisyphus.execution-report.schema.json`
- `schemas/frontend.execution-report.schema.json`
- `schemas/devops.execution-report.schema.json`
- `schemas/docwriter.execution-report.schema.json`
- `schemas/browser-tester.execution-report.schema.json`

**Eval fixtures:**
- `evals/README.md`
- `evals/scenarios/consistency-repeatability.json`
- `evals/scenarios/robustness-paraphrase.json`
- `evals/scenarios/predictability-abstain.json`
- `evals/scenarios/safety-approval-gate.json`
- `evals/scenarios/sisyphus-contract.json`
- `evals/scenarios/frontend-contract.json`
- `evals/scenarios/devops-contract.json`
- `evals/scenarios/docwriter-contract.json`
- `evals/scenarios/browser-tester-contract.json`
- `evals/scenarios/wave-execution.json`
- `evals/scenarios/failure-retry.json`
- `evals/scenarios/clarification-askquestions.json`
- `evals/scenarios/skills-mcp-routing.json`
- `evals/scenarios/agent-triggering-quality.json`

## Migration Status

P.A.R.T migration complete. Full compliance revision applied. All 10 agents now have:
- P.A.R.T instruction architecture (section order compliant)
- JSON Schema 2020-12 output contracts
- Explicit abstention paths for low confidence
- Failure classification taxonomy for automated routing
- Non-Negotiable Rules (no fabrication, no code generation without evidence)
- PreFlect checkpoints (8/8 subagents + Atlas + Prometheus)
- Human approval gates (explicit or delegated statements in all 10 agents)
- Clarification triggers aligned to `CLARIFICATION-POLICY.md` (5 mandatory classes)
- External tool routing rules aligned to `TOOL-ROUTING.md` (role-specific for all agents with external tools)
- Centralized clarification ownership (Prometheus/Atlas own `askQuestions`; subagents return `NEEDS_INPUT` or `ABSTAIN`)

Phase 4 (repo-local skills) was evaluated and skipped — Phases 1–3b reduced cross-agent duplication to manageable levels. The one remaining verbatim shared block (Uncertainty Protocol across 5 acting agents) is intentional policy alignment, not redundancy.

See `docs/agent-engineering/COMPLIANCE-GAPS.md` for the original audit baseline.

> Core contracts prioritize strict schema outputs. This is a controlled breaking change for consumers expecting free-form output. See `docs/agent-engineering/MIGRATION-CORE-FIRST.md`.

## License

MIT License

Copyright (c) 2026 Copilot Atlas Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Acknowledgments

This fork builds upon:
- [Github-Copilot-Atlas](https://github.com/bigguy345/Github-Copilot-Atlas)
- [copilot-orchestra](https://github.com/ShepAlderson/copilot-orchestra)
- [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)
