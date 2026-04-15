# Changelog

All notable changes to ControlFlow are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.0.0] — 2026-04-15

### Added

**Agent system (13 agents)**

- `Orchestrator` — conductor, gate controller, wave-based parallel dispatch, failure routing
- `Planner` — structured planning with idea interview, phased plans, Mermaid diagrams, semantic risk discovery across 7 non-functional risk categories
- `PlanAuditor` — adversarial plan audit, architecture and risk review
- `AssumptionVerifier` — assumption-fact confusion detection, mirage elimination
- `ExecutabilityVerifier` — cold-start plan executability simulation
- `CoreImplementer` — backend implementation with TDD enforcement
- `UIImplementer` — frontend implementation
- `PlatformEngineer` — CI/CD, containers, infrastructure, rollback contracts
- `CodeReviewer` — code review, safety gates, verdict contracts
- `Researcher` — evidence-first research with confidence scores and citations
- `CodeMapper` — read-only codebase discovery
- `TechnicalWriter` — documentation, diagrams, code-doc parity enforcement
- `BrowserTester` — E2E browser testing with health-first verification and accessibility audits

**Architecture**

- P.A.R.T contract architecture (Prompt → Archive → Resources → Tools) enforced across all agents
- Structured text outputs replacing raw JSON to conserve context tokens in delegation chains
- Wave-based parallel execution — Orchestrator dispatches independent phases in parallel
- Adversarial review pipeline — up to three independent reviewers before implementation (depth scales with complexity tier: TRIVIAL / SMALL / MEDIUM / LARGE)
- Failure taxonomy (`transient` / `fixable` / `needs_replan` / `escalate`) with deterministic retry and escalation routing
- Least-privilege tool grants — each agent's `tools:` frontmatter trimmed to minimum required by role
- Semantic risk discovery — 7 non-functional risk categories evaluated before research delegation
- Batch approval per execution wave, per-phase approval for destructive operations
- `NEEDS_INPUT` clarification routing from subagents through Orchestrator to user via `askQuestions`

**Governance and contracts**

- JSON Schema contracts for all agent outputs in `schemas/`
- Governance policies in `docs/agent-engineering/`: PART-SPEC, RELIABILITY-GATES, CLARIFICATION-POLICY, TOOL-ROUTING, SCORING-SPEC, MIGRATION-CORE-FIRST, PROMPT-BEHAVIOR-CONTRACT
- Canonical tool grants in `governance/agent-grants.json`
- Agent roster and complexity tier definitions in `plans/project-context.md`

**Skill library**

- 7 domain-specific skill patterns: Testing, Error Handling, Security, Performance, Completeness, Integration, Idea-to-Prompt
- Skill index at `skills/index.md`

**Eval suite (302 checks)**

- Pass 1: Schema validity (Ajv strict mode, JSON Schema 2020-12)
- Pass 2–3: Scenario integrity and cross-scenario structural regression (179 structural checks)
- Pass 4: P.A.R.T section order enforcement
- Pass 4b: Clarification trigger and tool routing section validation
- Pass 5: Skill library registration integrity
- Pass 6: Synthetic rename negative-path checks
- Pass 7: Prompt behavior contract behavioral regression (74 checks across 9 agents)
- Pass 8: Orchestration handoff contract regression (49 checks)
- F7/F8: Complexity tier and reference integrity enforcement
- Warm cache for fast repeated structural runs

**CI**

- GitHub Actions workflow running the full eval suite on every push and pull request to `master`
