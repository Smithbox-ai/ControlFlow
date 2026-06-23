# ControlFlow Tutorial (English)

A practical guide to ControlFlow — a thin, non-duplicating layer over GitHub Copilot's native agent capabilities. Suitable for both newcomers and developers who want to understand the system deeply.

## Table of Contents

| # | Chapter | Topic |
|---|---------|-------|
| 00 | [Introduction](00-introduction.md) | What ControlFlow is and what it delivers |
| 01 | [Quick Start](01-quickstart.md) | Orientation in 30 minutes |
| 02 | [Architecture Overview](02-architecture-overview.md) | Mental model of the whole system |
| 03 | [Role Taxonomy](03-agent-roster.md) | Conceptual executor + verify role labels (not shipped agents) |
| 04 | [Agent prompt structure (guidance)](04-part-spec.md) | How to write a good custom agent prompt |
| 05 | [The plan → verify → review pipeline](05-orchestration.md) | How the pipeline governs the process |
| 06 | [Planning](06-planning.md) | How the Planner turns ideas into plans |
| 07 | [Review Pipeline (controlflow-verify)](07-review-pipeline.md) | Adversarial verify before execution |
| 08 | [Execution + review over native Copilot](08-execution-pipeline.md) | Native Copilot executes phases; `controlflow-review` gates after |
| 09 | [Schemas (Contracts)](09-schemas.md) | All JSON schemas — purpose and key fields |
| 10 | [Governance](10-governance.md) | Governance files — policy, registry, matrix, allowlist |
| 11 | [Skills](11-skills.md) | Three workflow skills + value-add patterns |
| 12 | [Memory Architecture](12-memory.md) | Three-layer memory model |
| 13 | [Failure Taxonomy](13-failure-taxonomy.md) | Failure classes and routing |
| 14 | [Eval Harness](14-evals.md) | Offline validation suite |
| 15 | [Case Studies](15-case-studies.md) | End-to-end scenario walkthroughs |
| 16 | [Exercises](16-exercises.md) | Practice tasks by level |
| 17 | [Glossary](17-glossary.md) | Key terms with chapter references |
| 18 | [FAQ](18-faq.md) | Frequently asked questions |

## Reading Trajectories

### 🟢 New to the system
00 → 01 → 02 → 03 → 04

### 🟡 Understanding the pipeline and planning
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
- `.github/agents/controlflow-planner.agent.md` — the sole shipped agent; authoritative for planner behavior.
- `.github/copilot-instructions.md` — the shared routing stub (tier table, failure classification).
- `.github/skills/controlflow-plan/`, `.github/skills/controlflow-verify/`, `.github/skills/controlflow-review/` — the three workflow skills.
- `governance/runtime-policy.json` — authoritative for tier-gated verify depth, semantic-risk policy, and verdict routing.
- `governance/project-context-registry.json` — authoritative for the conceptual role taxonomy (executor + verify roles).
- `schemas/*.json` — authoritative for contract shapes (the plan format anchor is `schemas/planner.plan.schema.json`).
- `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md` — authoritative for the native-vs-ControlFlow delegation boundary.
- `plans/project-context.md` — authoritative human-readable mirror of the role taxonomy, tiers, and conventions.

When the tutorial conflicts with a canonical source, the canonical source wins.

## Text Conventions

- **`monospace`** — file paths, field names, enum values, commands.
- _Italic_ — emphasis on a key point on first introduction.
- → — "see also" link within or across chapters.
- Technical terms (agent names, file paths, field names) are in English throughout.