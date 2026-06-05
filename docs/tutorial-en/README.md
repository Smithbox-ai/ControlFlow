# ControlFlow Tutorial (English)

A practical guide to the ControlFlow multi-agent orchestration system. Suitable for both newcomers and developers who want to understand the system deeply.

## Table of Contents

| # | Chapter | Topic |
|---|---------|-------|
| 00 | [Introduction](00-introduction.md) | What ControlFlow is and what it delivers |
| 01 | [Quick Start](01-quickstart.md) | Orientation in 30 minutes |
| 02 | [Architecture Overview](02-architecture-overview.md) | Mental model of the whole system |
| 03 | [Agent Roster](03-agent-roster.md) | All 13 agents — roles, inputs, outputs |
| 04 | [P.A.R.T. Specification](04-part-spec.md) | Mandatory structure of every agent file |
| 05 | [Orchestration](05-orchestration.md) | How the Orchestrator governs the process |
| 06 | [Planning](06-planning.md) | How the Planner turns ideas into plans |
| 07 | [Review Pipeline](07-review-pipeline.md) | Adversarial PLAN_REVIEW before execution |
| 08 | [Execution Pipeline](08-execution-pipeline.md) | Phases, waves, quality gates |
| 09 | [Schemas (Contracts)](09-schemas.md) | All 20 JSON schemas — purpose and key fields |
| 10 | [Governance](10-governance.md) | 7 governance files — permissions and runtime knobs |
| 11 | [Skills (Patterns)](11-skills.md) | Reusable expert patterns for agents |
| 12 | [Memory Architecture](12-memory.md) | Three-layer memory model |
| 13 | [Failure Taxonomy](13-failure-taxonomy.md) | 4 failure classes and routing |
| 14 | [Eval Harness](14-evals.md) | Offline validation suite |
| 15 | [Case Studies](15-case-studies.md) | End-to-end scenario walkthroughs |
| 16 | [Exercises](16-exercises.md) | Practice tasks by level |
| 17 | [Glossary](17-glossary.md) | Key terms with chapter references |
| 18 | [FAQ](18-faq.md) | Frequently asked questions |

## Reading Trajectories

### 🟢 New to the system
00 → 01 → 02 → 03 → 04

### 🟡 Understanding orchestration and planning
05 → 06 → 07 → 08

### 🔵 Infrastructure: schemas, governance, skills, memory, evals
09 → 10 → 11 → 12 → 14

### 🔴 Practice
13 → 15 → 16 → 17 → 18

## Chapter Template

Each chapter follows this structure:
- **Why this chapter** — what you will understand after reading.
- **Key concepts** — definitions of terms introduced in the chapter.
- **Mermaid diagram** — visual model of the described process or structure.
- **Detailed text** — explanation with examples and code references.
- **Common mistakes** — what is misunderstood most often.
- **Exercises** — practice tasks (🟢 beginner / 🟡 intermediate / 🔴 advanced).
- **Review questions** — self-check.
- **See also** — links to related chapters and files.

## Canonical Sources

All chapter content is derived from:
- Agent files (`*.agent.md`) — authoritative for agent behavior.
- `governance/runtime-policy.json` — authoritative for thresholds, tiers, retry budgets.
- `schemas/*.json` — authoritative for inter-agent contracts.
- `docs/agent-engineering/` — authoritative for engineering policies.
- `plans/project-context.md` — authoritative for agent roster and conventions.

When the tutorial conflicts with a canonical source, the canonical source wins.

## Text Conventions

- **`monospace`** — file paths, field names, enum values, commands.
- _Italic_ — emphasis on a key point on first introduction.
- → — "see also" link within or across chapters.
- Technical terms (agent names, file paths, field names) are in English throughout.
