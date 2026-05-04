# Changelog

All notable changes to ControlFlow are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased] — Codex Plugin & Lifecycle Documentation Parity (Phases 4-8)

### Added

- **BrowserTester Evidence Discipline**: Added snapshot, wait, console/network, visual regression, and untrusted content protocols (`BrowserTester-subagent.agent.md`).
- **Living-Document Guidance**: Added "Living-Document and Restartability Guidance" section to `plans/templates/plan-document-template.md`.

### Changed

- **Codex Plugin Lifecycle**: Introduced fixed lifecycle sections (`## Progress`, `## Discoveries`, `## Decision Log`, `## Outcomes`, `## Idempotence & Recovery`) in strict-plan dialect, enforced by `validate-strict-artifacts.ps1`.
- **Plugin First-Class Status**: Upgraded `controlflow-codex` to a first-class plugin deliverable in `AGENTS.md` and `README.md`.

---

## [Unreleased] — Model Routing Stage C Matrix

### Added

- `feat: add optional final review gate via final_review_gate policy flag` — Adds opt-in Completion Gate sub-step that dispatches CodeReviewer with review_scope=final for holistic scope-drift detection. Auto-triggers for LARGE tier plans. Configured via governance/runtime-policy.json.
- **Stage C Final (Consolidated)**: Model Routing Stage C has fully landed. Stage D is a forward pointer only.
  - All 13 agents now declare `model_role:` frontmatter.
  - `governance/model-routing.json` extended with optional `by_tier` matrix (10 roles × 4 complexity tiers with `inherit_from: "default"` for non-divergent cases).
  - `evals/drift-checks.mjs` gained `validateModelRole` + `validateByTierShape`.
  - Drift-check suite grew from 23 → 34 (+11): 4 Check #1 model_role tests (A/B/C/D), 4 matrix-completeness tests (N1/N2/N3/positive), 3 reference-integrity tests (RI-1/RI-2/RI-3).
  - Structural gained +1 (Check #1 real implementation).
  - Total eval suite: 358 → 370.
  - VS Code runtime tolerance PASS recorded in `plans/artifacts/model-routing-stage-c/phase-1-spike-result.md`.

### Changed

- **Eval suite (410 checks)** — 227 structural + 78 behavior + 63 orchestration-handoff + 42 drift-detection. Advertised counts in `README.md`, `.github/copilot-instructions.md`, `CONTRIBUTING.md`, `evals/README.md`, `SECURITY.md`, and `.github/PULL_REQUEST_TEMPLATE.md` reconciled to the measured value and enforced by drift Check #5.

---

## [Unreleased] — ControlFlow Comprehensive Revision

Ten-phase revision and modernization program delivered per `plans/controlflow-comprehensive-revision-plan.md`.

### Added

- **Phase 1 — Researcher validation + `plans_classification`.** Evidence-first confirmation of all 10 audit findings and per-plan classification artifact gating downstream archival decisions.
- **Phase 2 — CodeMapper drift inventory.** Mechanical cross-reference of agent model pins, tool grants, schema references, skill registrations, executor-enum alignment, and PreFlect baseline line counts.
- **Phase 3 — Consistency fixes (relabel-only; archival gated).** Phase Executor Agents table reduced to 8 rows matching the `executor_agent` enum; three-way check-count reconciliation; in-place status relabels without destructive moves.
- **Phase 4 — Model Routing (logical-index-only; spike deferred).** Published `governance/model-routing.json` with 10 logical roles covering all 13 agents and `docs/agent-engineering/MODEL-ROUTING.md`. Runtime opt-in via agent frontmatter `model_role:` is held pending VS Code frontmatter-tolerance verification; drift Check #1 remains gated off.
- **Phase 5 — Observability & `trace_id` schema hardening.** UUIDv4 `trace_id` added as additive-optional field across 13 report / verdict / audit / discovery / research / clarification / plan schemas; `docs/agent-engineering/OBSERVABILITY.md` documents generation, propagation, and the NDJSON sink convention at `plans/artifacts/observability/<task-id>.ndjson`.
- **Phase 6 — Agentic Memory layering.** Three-layer memory model (session / task-episodic / repo-persistent) codified in `docs/agent-engineering/MEMORY-ARCHITECTURE.md`; `NOTES.md` scoped to repo-persistent state with reversible migration manifest.
- **Phase 7 — PreFlect canonicalization.** Single `skills/patterns/preflect-core.md` replaces per-agent PreFlect restatements with pointer + ≤5 domain lines; Orchestrator-enforced cross-plan entry gate against `plans/performance-optimization-plan.md`.
- **Phase 8 — SOTA pattern integration (additive, no budget compounding).** `skills/patterns/reflection-loop.md` (pre-retry hook; default disabled; draws from existing `retry_budgets`), `skills/patterns/budget-tracking.md` (`budget_defaults` orthogonal to `retry_budgets`), and `docs/agent-engineering/AGENT-AS-TOOL.md` (MCP forward-compatible input contract).
- **Phase 9 — Additive drift-detection evals.** Four new drift checks (roster ↔ enum bidirectional alignment, agent `Resources` ↔ schemas existence, cross-plan file-overlap with anchor-map gate, multi-doc check-count consistency) in `evals/tests/drift-detection.test.mjs`; `model_role` resolution check staged but gated off until Phase 4 spike re-enables it.
- **Phase 10 — README & engineering-docs refresh.** Measured-value badges, new Feature rows for the six shipped capabilities, and `docs/agent-engineering/README.md` index for the 11 engineering documents.

### Changed

- **Eval suite (358 checks)** — 212 structural + 74 behavior + 49 orchestration-handoff + 23 drift-detection. Advertised counts in `README.md`, `.github/copilot-instructions.md`, `CONTRIBUTING.md`, `evals/README.md`, `SECURITY.md`, and `.github/PULL_REQUEST_TEMPLATE.md` reconciled to the measured value and enforced by drift Check #5.
- Phase Executor Agents table reduced to 8 rows aligned with the `executor_agent` enum; AssumptionVerifier and ExecutabilityVerifier reclassified as review-only roles outside the executor enum.

### Notes

- Phase 4 shipped in logical-index-only mode — the runtime opt-in spike on `BrowserTester-subagent.agent.md` is deferred, and `model_role:` is intentionally not yet added to agent frontmatter.
- All schema changes are additive-optional; `required` arrays are unchanged and existing fixtures continue to validate.
- Canonical verification remains offline: `cd evals && npm test`.

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
- LLM Behavior Guidelines meta-skill derived from Karpathy's observations on LLM coding anti-patterns (scope drift, over-abstraction, silent assumptions, unverifiable tasks)
- Skill index at `skills/index.md`

**Eval suite (303 checks)**

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

**CI**

- GitHub Actions workflow running the full eval suite on every push and pull request to `master`
