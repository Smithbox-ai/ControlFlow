# Chapter 00 — Introduction

## Why this chapter

Understand **what ControlFlow is**, what it delivers, and why it exists. After this chapter you will know the difference between ControlFlow and other AI tools, and where to start exploring.

## Key concepts

- **Agent system** — a coordinated set of AI agents with defined roles, contracts, and governance.
- **Prompt repo** — ControlFlow is a repository of agent prompts, schemas, and governance files — not a compiled application.
- **Determinism** — every decision follows a documented rule; no guessing, no silent assumptions.

## What ControlFlow Is (and Is Not)

**ControlFlow is a multi-agent orchestration framework** expressed as a set of Markdown prompt files, JSON schemas, and governance configuration. It defines how 13 AI agents collaborate to plan, implement, review, and ship engineering tasks reliably.

**ControlFlow is NOT:**
- A runtime server or compiled application.
- A code library you `npm install`.
- A chatbot or single-agent assistant.
- A low-code drag-and-drop workflow builder.

The repository delivers:

| Artifact | Count | Purpose |
|----------|-------|---------|
| Agent prompt files (`*.agent.md`) | 13 | Define role, scope, contracts, and tools for each agent |
| JSON schemas (`schemas/*.json`) | 15 | Formal contracts for inter-agent communication |
| Governance configs (`governance/*.json`) | 5 | Tool permissions, retry budgets, tier routing, model mapping |
| Skill patterns (`skills/patterns/*.md`) | 11 | Reusable domain expertise loaded just-in-time |
| Eval harness (`evals/`) | ~410 checks | Offline validation of schema compliance and behavioral invariants |
| Documentation (`docs/`) | — | Engineering policies, tutorials, architecture docs |

## Why ControlFlow Exists

Without a structured multi-agent framework, LLM-based engineering assistance suffers from recurring failure modes:

1. **Hallucination** — agents invent files, APIs, or behaviors that don't exist.
2. **Scope drift** — agents change things outside their assigned scope.
3. **Silent assumptions** — agents guess instead of asking.
4. **Missing rollback** — destructive operations proceed without a recovery plan.
5. **Approval bypass** — high-risk actions execute without human confirmation.
6. **Flaky outputs** — results vary with no deterministic routing for failures.

ControlFlow addresses all six by enforcing:
- Adversarial plan review before any code is written.
- Schema-validated contracts between agents.
- Explicit human approval gates at phase boundaries.
- Deterministic failure classification and routing.
- Offline eval harness to catch regressions continuously.

## Architecture in One Sentence

A **Planner** authors phased plans. An **Orchestrator** governs their review and execution. **Executor subagents** implement phases. **Reviewer subagents** validate plans and code. **Research subagents** gather evidence. Every handoff is a schema-validated contract.

## Audience

This tutorial is written for two audiences:

**Newcomers (chapters 00–04):** No prior ControlFlow knowledge required. You need only basic familiarity with Markdown, JSON, and software engineering concepts.

**Mid-level developers (chapters 05–14):** Assumes you have read chapters 00–04 and want to understand orchestration, planning, schemas, governance, and the eval harness in depth.

**Practitioners (chapters 15–18):** Hands-on case studies, exercises, a glossary, and an FAQ for day-to-day use.

## Learning Outcomes

After completing this tutorial you will be able to:

1. Describe the role of each of the 13 agents in the system.
2. Read any `*.agent.md` file and understand its behavior, scope, and tool surface.
3. Explain how the Orchestrator state machine progresses from `PLANNING` to `COMPLETE`.
4. Classify any failure scenario into one of the 4 failure classes.
5. Run `cd evals && npm test` and interpret the output.
6. Contribute a new agent or schema following the process documented in CONTRIBUTING.md.

## How to Read This Tutorial

- **Sequential** — read chapters in order for a complete mental model.
- **By trajectory** — see the [README](README.md) for four curated reading paths.
- **As a reference** — chapters 03, 09, 10, 17, and 18 are designed for lookup.

## Review Questions

1. Name three things ControlFlow is **not**.
2. What six failure modes does ControlFlow address?
3. Which repository directory holds the offline eval harness?
4. What is the relationship between Planner and Orchestrator?

## See Also

- [Chapter 01 — Quick Start](01-quickstart.md)
- [Chapter 02 — Architecture Overview](02-architecture-overview.md)
- [plans/project-context.md](../../plans/project-context.md)
