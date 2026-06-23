# Changelog

All notable changes to ControlFlow are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

- **Cursor IDE plugin (level 3)**: Added `plugins/controlflow-cursor/` with 10 workflow skills, 11 project subagents (`.cursor/agents/`), orchestration rule, `install-project.ps1`, eval pass 3f, and expanded `docs/agent-engineering/CURSOR-SUPPORT.md` / `CURSOR-SDK.md`. Project Rules remain under `.cursor/rules/`.
- **Claude Code Plugin**: Shipped a first-class plugin adaptation for Anthropic's Claude Code at `plugins/controlflow-claude-code/`.
  - Includes 10 ControlFlow workflow skills adapted for Claude native slash-invocation.
  - Adds 6 native plugin agents for isolated review, research, mapping, and verification tasks.
  - Ships local validation scripts and local development lifecycle documentation.
  - Adds project-level references inside `README.md`, `CONTRIBUTING.md`, and quickstart docs.
- **BrowserTester Evidence Discipline**: Added snapshot, wait, console/network, visual regression, and untrusted content protocols (`BrowserTester-subagent.agent.md`).
- **Living-Document Guidance**: Added "Living-Document and Restartability Guidance" section to `plans/templates/plan-document-template.md`.
- **Optional final review gate** via the `final_review_gate` policy flag — adds an opt-in Completion Gate sub-step that dispatches CodeReviewer with `review_scope=final` for holistic scope-drift detection. Auto-triggers for LARGE tier plans. Configured via `governance/runtime-policy.json`.
- **Model Routing Stage C Matrix (Consolidated)**: Model Routing Stage C has fully landed. Stage D is a forward pointer only.
  - All 13 agents now declare `model_role:` frontmatter.
  - `governance/model-routing.json` extended with optional `by_tier` matrix (10 roles × 4 complexity tiers with `inherit_from: "default"` for non-divergent cases).
  - `evals/drift-checks.mjs` gained `validateModelRole` + `validateByTierShape`.
  - Drift-check suite grew from 23 → 34 (+11): 4 Check #1 model_role tests (A/B/C/D), 4 matrix-completeness tests (N1/N2/N3/positive), 3 reference-integrity tests (RI-1/RI-2/RI-3).
  - VS Code runtime tolerance PASS recorded in `plans/artifacts/model-routing-stage-c/phase-1-spike-result.md`.
- **ControlFlow Comprehensive Revision** — ten-phase revision and modernization program delivered per `plans/controlflow-comprehensive-revision-plan.md`:
  - **Phase 1 — Researcher validation + `plans_classification`.** Evidence-first confirmation of all 10 audit findings and per-plan classification artifact gating downstream archival decisions.
  - **Phase 2 — CodeMapper drift inventory.** Mechanical cross-reference of agent model pins, tool grants, schema references, skill registrations, executor-enum alignment, and PreFlect baseline line counts.
  - **Phase 3 — Consistency fixes (relabel-only; archival gated).** Phase Executor Agents table reduced to 8 rows matching the `executor_agent` enum; three-way check-count reconciliation; in-place status relabels without destructive moves.
  - **Phase 4 — Model Routing (logical-index-only; spike deferred).** Published `governance/model-routing.json` with 10 logical roles covering all 13 agents and `docs/agent-engineering/MODEL-ROUTING.md`. Runtime opt-in via agent frontmatter `model_role:` is held pending VS Code frontmatter-tolerance verification; drift Check #1 remains gated off.
  - **Phase 5 — Observability & `trace_id` schema hardening.** UUIDv4 `trace_id` added as additive-optional field across 13 report / verdict / audit / discovery / research / clarification / plan schemas; `docs/agent-engineering/OBSERVABILITY.md` documents generation, propagation, and the NDJSON sink convention at `plans/artifacts/observability/<task-id>.ndjson`.
  - **Phase 6 — Agentic Memory layering.** Three-layer memory model (session / task-episodic / repo-persistent) codified in `docs/agent-engineering/MEMORY-ARCHITECTURE.md`; `NOTES.md` scoped to repo-persistent state with reversible migration manifest.
  - **Phase 7 — PreFlect canonicalization.** Single `skills/patterns/preflect-core.md` replaces per-agent PreFlect restatements with pointer + ≤5 domain lines; Orchestrator-enforced cross-plan entry gate against `plans/performance-optimization-plan.md`.
  - **Phase 8 — SOTA pattern integration (additive, no budget compounding).** `skills/patterns/reflection-loop.md` (pre-retry hook; default disabled; draws from existing `retry_budgets`), `skills/patterns/budget-tracking.md` (`budget_defaults` orthogonal to `retry_budgets`), and `docs/agent-engineering/AGENT-AS-TOOL.md` (MCP forward-compatible input contract).
  - **Phase 9 — Additive drift-detection evals.** Four new drift checks (roster ↔ enum bidirectional alignment, agent `Resources` ↔ schemas existence, cross-plan file-overlap with anchor-map gate, multi-doc check-count consistency) in `evals/tests/drift-detection.test.mjs`; `model_role` resolution check staged but gated off until Phase 4 spike re-enables it.
  - **Phase 10 — README & engineering-docs refresh.** Measured-value badges, new Feature rows for the six shipped capabilities, and `docs/agent-engineering/README.md` index for the 14 engineering documents.

### Changed

- **Codex Plugin Lifecycle**: Introduced fixed lifecycle sections (`## Progress`, `## Discoveries`, `## Decision Log`, `## Outcomes`, `## Idempotence & Recovery`) in strict-plan dialect, enforced by `validate-strict-artifacts.ps1`.
- **Plugin First-Class Status**: Upgraded `controlflow-codex` to a first-class plugin deliverable in `AGENTS.md` and `README.md`.
- **Eval suite count reconciliation** — Advertised eval counts in `README.md`, `.github/copilot-instructions.md`, `CONTRIBUTING.md`, `evals/README.md`, `SECURITY.md`, and `.github/PULL_REQUEST_TEMPLATE.md` were reconciled to the measured value. There is no live count-enforcement pass; the current total is reported by `cd evals && npm test`.
- **Phase Executor Agents table** reduced to 8 rows aligned with the `executor_agent` enum; AssumptionVerifier and ExecutabilityVerifier reclassified as review-only roles outside the executor enum.

### Notes

- Phase 4 shipped in logical-index-only mode — the runtime opt-in spike on `BrowserTester-subagent.agent.md` is deferred, and `model_role:` is intentionally not yet added to agent frontmatter.
- All schema changes are additive-optional; `required` arrays are unchanged and existing fixtures continue to validate.
- Canonical verification remains offline: `cd evals && npm test`.

## [2.0.0] — 2026-06-23

### Summary — 2.0.0

**Breaking.** ControlFlow is rebuilt as a slim Copilot-first layer over native GitHub Copilot (primary harness: VS Code Copilot Chat). The 13-agent / Orchestrator core is retired; the shipped surface is **one agent (`@controlflow-planner`), three skills (`controlflow-plan` / `controlflow-verify` / `controlflow-review`), and a routing stub**, with 0 shipped subagents. The 8 executor roles and 3 inline verify roles survive as conceptual labels the Planner assigns and native Copilot executes inline.

### Changed — 2.0.0

- **Agent count: 13 → 1.** `Orchestrator.agent.md` and the 11 `*-subagent.agent.md` files are removed; the single kept agent (`@controlflow-planner`) relocates to `.github/agents/controlflow-planner.agent.md` (≈200 lines, down from ≈2,160). The Copilot Auto model picker selects the model (no `model:` frontmatter by default).
- **Orchestration retired.** The Orchestrator dispatch state machine, wave execution, batch gates, the Completion Gate, the per-phase Verification Build Gate, and `NEEDS_INPUT` routing are gone — native Copilot owns subagent dispatch + parallelism, `/plan` mode, agentic code review, approvals, and retry routing. Orchestration is now the plan → verify → review pipeline over native Copilot, governed by a tier-gated policy (`TRIVIAL` / `SMALL` / `MEDIUM` / `LARGE`).
- **Three skills shipped.** `controlflow-plan` (schema-sourced plan artifact in `plans/`), `controlflow-verify` (inline adversarial verification, zero subagents — structural audit, mirage detection, executability cold-start; emits `APPROVED` / `NEEDS_REVISION` / `REJECTED`), `controlflow-review` (evidence-backed review + plan-vs-implementation scope-drift, layered over native Copilot code review).
- **Governance slimmed.** `governance/runtime-policy.json` keeps three blocks (`review_pipeline_by_tier`, `semantic_risk_policy`, `verdict_routing`). `governance/model-routing.json`, `governance/tool-grants.json`, and `governance/agent-grants.json` are removed — model selection, tool access, and subagent governance are delegated to native Copilot.
- **Delegation boundary documented.** `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md` records the native-vs-ControlFlow split and a recreation recipe for any persona a user wants as a native custom agent.
- **Evals rewritten under the new contract.** Contract-drift asserts the plan format against `schemas/planner.plan.schema.json` + `governance/project-context-registry.json` + `governance/runtime-policy.json`; behavior scenarios cover the 3 skills; orchestrator / subagent / gate-event / model-routing / context-packet scenarios retired. `cd evals && npm test` is green.
- **Docs rewritten (bilingual).** `docs/tutorial-en/` and `docs/tutorial-ru/` (20 chapters each), `docs/agent-engineering/` policy docs, `README.md`, and `CONTRIBUTING.md` reflect the slim model; stale 13-agent / Orchestrator / model-routing references are removed from live framing (retired only as history).
- **Plugins synced from canonical.** `plugins/controlflow-shared-source/` reworked as the slim sync-OUT source (3 skills from `.github/skills/`); `plugins/controlflow-codex/` and `plugins/controlflow-cursor/` regenerated to the 3-skill model (9 obsolete heavy-model skills, per-skill agents, retired report templates, and heavy-model validate scripts removed; Cursor ships `@controlflow-planner` in `agents/`). `plugins/controlflow-claude-code/` remains hand-maintained. Plugin generation parity (`codex == shared-source`) and `core-portability-matrix.json` (Pass 16) verified.

### Removed — 2.0.0

- `Orchestrator.agent.md` and the 11 root `*-subagent.agent.md` files.
- `governance/model-routing.json`, `governance/tool-grants.json`, `governance/agent-grants.json`.
- `docs/agent-engineering/` retired docs: `RELIABILITY-GATES.md`, `TOOL-ROUTING.md`, `MODEL-ROUTING.md`, `OBSERVABILITY.md` (and `MODEL-RESOLUTION-RULE.md`).
- Root `.cursor/rules` + `.cursor/agents` + `.cursor/skills` legacy mirror (Cursor ships as `plugins/controlflow-cursor/`).
- Retired plan templates: `phase-task-card-template.md`, `gate-event-template.md`, `code-context-pack-template.md`.
- The orchestration-handoff contract test and orchestrator/subagent/gate-event/model-routing eval scenarios.
- 9 obsolete plugin skills (orchestration, router, spec, strict-workflow, plan-audit, planning, assumption-verifier, executability-verifier, memory-hygiene) and their per-skill agents/templates.

### Kept (conceptual / portable) — 2.0.0

- The 8 executor role names + 3 inline verify role names (conceptual labels, `executor_agent` enum in `schemas/planner.plan.schema.json`).
- The 7-category semantic risk review (`data_volume` / `performance` / `concurrency` / `access_control` / `migration_rollback` / `dependency` / `operability`).
- The failure taxonomy (`transient` / `fixable` / `needs_replan` / `escalate` / `model_unavailable`) as a portable reference.
- The value-add patterns in `skills/patterns/` and the schema/template library in `schemas/` + `plans/templates/`.

### Plugin versions — 2.0.0

The plugin packages (versioned independently, previously 0.x) reach their first stable release alongside the core 2.0.0: `controlflow-claude-code` 1.0.0, `controlflow-codex` 1.0.0, `controlflow-cursor` 1.0.0. The core repo version is 2.0.0 (breaking change after 1.3.0).

### Migration notes — 2.0.0

- Existing plan artifacts in `plans/` remain valid history; new plans conform to `schemas/planner.plan.schema.json` via the `controlflow-plan` skill.
- Users who relied on a specialized subagent persona (e.g. `BrowserTester`, `UIImplementer`, `PlatformEngineer`) can recreate it as a native Copilot custom agent using the recipe in `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md` §5; the value-add patterns those personas embodied stay in `skills/patterns/`.
- `governance/model-routing.json` / `tool-grants.json` / `agent-grants.json` users: model selection, tool access, and subagent governance are now native Copilot's job (per-agent `tools:` frontmatter + Auto model picker).

## [1.0.0] — 2026-04-15

### Added - 1.0.0

#### Agent system (13 agents)

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

#### Architecture

- P.A.R.T contract architecture (Prompt → Archive → Resources → Tools) enforced across all agents
- Structured text outputs replacing raw JSON to conserve context tokens in delegation chains
- Wave-based parallel execution — Orchestrator dispatches independent phases in parallel
- Adversarial review pipeline — up to three independent reviewers before implementation (depth scales with complexity tier: TRIVIAL / SMALL / MEDIUM / LARGE)
- Failure taxonomy (`transient` / `fixable` / `needs_replan` / `escalate`) with deterministic retry and escalation routing
- Least-privilege tool grants — each agent's `tools:` frontmatter trimmed to minimum required by role
- Semantic risk discovery — 7 non-functional risk categories evaluated before research delegation
- Batch approval per execution wave, per-phase approval for destructive operations
- `NEEDS_INPUT` clarification routing from subagents through Orchestrator to user via `askQuestions`

#### Governance and contracts

- JSON Schema contracts for all agent outputs in `schemas/`
- Governance policies in `docs/agent-engineering/`: PART-SPEC, RELIABILITY-GATES, CLARIFICATION-POLICY, TOOL-ROUTING, SCORING-SPEC, MIGRATION-CORE-FIRST, PROMPT-BEHAVIOR-CONTRACT
- Canonical tool grants in `governance/agent-grants.json`
- Agent roster and complexity tier definitions in `plans/project-context.md`

#### Skill library

- 7 domain-specific skill patterns: Testing, Error Handling, Security, Performance, Completeness, Integration, Idea-to-Prompt
- LLM Behavior Guidelines meta-skill derived from Karpathy's observations on LLM coding anti-patterns (scope drift, over-abstraction, silent assumptions, unverifiable tasks)
- Skill index at `skills/index.md`

#### Eval suite (303 checks)

- Pass 1: Schema validity (Ajv strict mode, JSON Schema 2020-12)
- Pass 2–3: Scenario integrity and cross-scenario structural regression (180 structural checks)
- Pass 4: P.A.R.T section order enforcement
- Pass 4b: Clarification trigger and tool routing section validation
- Pass 5: Skill library registration integrity
- Pass 6: Synthetic rename negative-path checks
- Pass 7: Prompt behavior contract behavioral regression (74 checks across 9 agents)
- Pass 8: Orchestration handoff contract regression (49 checks)
- F7/F8: Complexity tier and reference integrity enforcement
- Warm cache for fast repeated structural runs

#### CI

- GitHub Actions workflow running the full eval suite on every push and pull request to `master`
