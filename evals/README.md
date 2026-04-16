# ControlFlow — Eval Suite

Structural, behavioral, and orchestration validation fixtures for the ControlFlow multi-agent system. These scenarios verify schema compliance, agent contracts, and orchestration behavior without executing live agents.

## What is validated

1. Schema compliance for agent output contracts.
2. Consistency under repeated runs.
3. Robustness under paraphrases and naming drift.
4. Predictability via correct `ABSTAIN` behavior.
5. Safety via mandatory human approval gates for high-risk actions.
6. Failure taxonomy routing (`transient`, `fixable`, `needs_replan`, `escalate`).
7. Wave-based execution ordering and batch approval.
8. Agent-specific contracts (PlatformEngineer rollback, BrowserTester health-first, TechnicalWriter parity).
9. Clarification triggering via `askQuestions` for enumerated ambiguity classes.
10. Tool routing compliance (MCP usage when third-party docs are needed).
11. `NEEDS_INPUT` routing from subagents through Orchestrator to user via `askQuestions`.
12. Semantic risk coverage — Planner `risk_review` array covers all 7 categories in every plan output.
13. Adversarial plan review — PlanAuditor, AssumptionVerifier, and ExecutabilityVerifier contracts.
14. Complexity-aware pipeline routing (TRIVIAL / SMALL / MEDIUM / LARGE).
15. Prompt behavior contract — behavioral invariant regression across Planner, Researcher, CodeMapper, CoreImplementer, CodeReviewer, TechnicalWriter, AssumptionVerifier, PlanAuditor, and shared policy.
16. Orchestration handoff discipline — PLAN_REVIEW gating, delegation routing, escalation thresholds.
17. F7 complexity tier validation for Planner scenarios.
18. F8 reference integrity scanning for core documentation paths.

## Validation passes

High-level grouping (see full `### Passes` table below for all intermediate sub-passes):

- **Pass 1:** Schema ingestion and compilation (Ajv strict mode).
- **Pass 2:** `scenarios/` structural hydration and mapping (includes Pass 3a, 3b, 3c, 3d, 4b).
- **Pass 3:** Cross-scenario structural regression testing (216 checks).
- **Pass 7:** Behavioral regressions (`prompt-behavior-contract.test.mjs` — 74 checks).
- **Pass 8:** Orchestration validation (`orchestration-handoff-contract.test.mjs` — 49 checks).
- **Pass 9:** Drift detection (`drift-detection.test.mjs` — 38 checks).

Test suite total: **377 total checks**.

1. Run each scenario against the corresponding agent contract.
2. Validate output against the matching schema in `schemas/`.
3. Repeat deterministic scenarios at least 3 times and compare status transitions.
4. Record any drift in gate events and abstention decisions.

## Scenario set

### Core reliability

- `scenarios/consistency-repeatability.json`
- `scenarios/robustness-paraphrase.json`
- `scenarios/predictability-abstain.json`
- `scenarios/safety-approval-gate.json`
- `scenarios/planner-schema-output.json`
- `scenarios/orchestrator-phase-verification.json`

### Agent contracts

- `scenarios/core-implementer-contract.json` — CoreImplementer execution contract
- `scenarios/ui-implementer-contract.json` — UIImplementer execution contract
- `scenarios/platform-engineer-contract.json` — PlatformEngineer execution contract
- `scenarios/technical-writer-contract.json` — TechnicalWriter execution contract
- `scenarios/browser-tester-contract.json` — BrowserTester execution contract
- `scenarios/executability-verifier-contract.json` — ExecutabilityVerifier execution contract
- `scenarios/assumption-verifier-contract.json` — AssumptionVerifier execution contract
- `scenarios/code-reviewer-contract.json` — CodeReviewer verdict contract
- `scenarios/code-mapper-contract.json` — CodeMapper discovery contract
- `scenarios/implementer-role-differentiation.json` — Implementer role uniqueness guard

### Orchestration

- `scenarios/wave-execution.json`
- `scenarios/failure-retry.json`
- `scenarios/orchestrator-todo-orchestration.json`
- `scenarios/orchestrator-phase-executor-routing.json`
- `scenarios/orchestrator-retry-backoff.json`
- `scenarios/complexity-gate-routing.json`
- `scenarios/orchestrator-high-risk-review-override.json` — HIGH-impact risk_review override routing
- `scenarios/orchestrator-state-runtime-consistency.json` — State machine vs runtime-policy tier alignment

### Clarification and routing

- `scenarios/clarification-askquestions.json`
- `scenarios/clarification-schema-fragment.json`
- `scenarios/skills-mcp-routing.json`
- `scenarios/agent-triggering-quality.json`
- `scenarios/needs-input-routing.json`
- `scenarios/planner-ambiguity-plus-schema.json`

### Adversarial review

- `scenarios/plan-auditor-contract.json` — PlanAuditor contract
- `scenarios/plan-auditor-adversarial-detection.json` — PlanAuditor defect detection
- `scenarios/plan-auditor-replan-loop.json` — PlanAuditor revision iteration
- `scenarios/orchestrator-plan-auditor-integration.json` — Orchestrator ↔ PlanAuditor integration
- `scenarios/assumption-verifier-contract.json` — AssumptionVerifier contract
- `scenarios/assumption-verifier-mirage-detection.json` — AssumptionVerifier mirage detection
- `scenarios/executability-verifier-contract.json` — ExecutabilityVerifier contract
- `scenarios/executability-verifier-executability.json` — ExecutabilityVerifier walkthrough
- `scenarios/iterative-review-convergence.json` — Review loop convergence

### Planner behavior

- `scenarios/planner-large-data-risk-discovery.json` — Semantic risk discovery
- `scenarios/planner-mermaid-output.json` — Mermaid diagram generation
- `scenarios/planner-idea-interview-trigger.json` — Idea interview activation
- `scenarios/planner-idea-interview-bypass.json` — Idea interview bypass
- `scenarios/behavioral-plan-quality.json` — Plan quality behavioral checks
- `scenarios/planner-terminal-status-artifacts.json` — ABSTAIN and REPLAN_REQUIRED artifact creation
- `scenarios/planner-complexity-classification.json` — Complexity tier classification (TRIVIAL/SMALL/MEDIUM/LARGE)
- `scenarios/planner-orchestrator-handoff.json` — Planner→Orchestrator plan handoff discipline
- `scenarios/planner-reviewed-flow-routing.json` — Handoff plan enters PLAN_REVIEW gate

### Behavioral regression

- `tests/prompt-behavior-contract.test.mjs` — Planner, Researcher, CodeMapper, CoreImplementer, CodeReviewer, TechnicalWriter, AssumptionVerifier, PlanAuditor, and shared policy behavioral invariants
- `tests/orchestration-handoff-contract.test.mjs` — Orchestrator PLAN_REVIEW gating, delegation routing, failure handling, phase verification

## Running Validations

The `validate.mjs` harness runs structural checks against schemas, agent prompts, and eval fixtures. It now includes stronger structural scenario-integrity checks to detect prompt masking and schema collisions, while still running completely offline without executing live agents.

### Install

```bash
cd evals
npm install
```

### Run

```bash
npm test
```

### Passes

| Pass | What it checks |
| ---- | -------------- |
| **1 — Schema Validity** | All `schemas/*.schema.json` compile under `ajv` JSON Schema 2020-12. |
| **2 — Scenario Integrity** | All `evals/scenarios/*.json` have the required identity fields and point to real agent files. Planner scenarios must assert `risk_review_present: true` and `complexity_tier_present: true`. Planner terminal-status scenarios (`ABSTAIN` / `REPLAN_REQUIRED`) must assert `plan_file_created: true`. |
| **3 — Reference Integrity** | All backtick schema/doc references inside `*.agent.md` resolve to existing files. |
| **3a — F7/F8 Enforcement** | F7: all Planner scenarios assert `complexity_tier_present` explicitly on every input (no vacuous pass). F8: internal markdown links and backtick code references in `README.md` and `docs/agent-engineering/*.md` resolve to files under the known top-level directories. |
| **3b — Required Artifacts** | Shared repo-local dependencies like `.github/copilot-instructions.md`, `plans/project-context.md`, and governance docs exist. |
| **3c — Tool Grant Consistency** | Every agent frontmatter `tools:` list matches the repository's canonical least-privilege tool set. |
| **3d — Agent Grant Consistency** | Every agent frontmatter `agents:` list matches `governance/agent-grants.json`. |
| **4 — P.A.R.T Section Order** | Every `*.agent.md` preserves `## Prompt` → `## Archive` → `## Resources` → `## Tools` ordering. |
| **4b — Clarification Triggers & Tool Routing** | Every agent either has a `### Clarification` section, delegates via `NEEDS_INPUT`, or is an ABSTAIN-only role (§5). Agents with external tools must have a `### Tool Routing` section (§6). |
| **5 — Skill Library** | Every file in `skills/patterns/` is registered in `skills/index.md` and every index entry resolves to a real file. |
| **6 — Synthetic Rename Negative-Path Checks** | Structural guard checks: stale `target_agent`, stale `expected.schema`, and stale nested `agent` references are correctly rejected. |
| **7 — Prompt Behavior Contract** | Behavioral invariants across Planner, Researcher, CodeMapper, CoreImplementer, CodeReviewer, TechnicalWriter, AssumptionVerifier, PlanAuditor, and shared policy: evidence discipline, ABSTAIN rules, output contracts, quality standards. (Separate harness: `tests/prompt-behavior-contract.test.mjs`.) |
| **8 — Orchestration Handoff Contract** | Orchestrator PLAN_REVIEW gating, complexity-aware routing, review loop convergence, failure classification routing, phase verification, todo lifecycle, trace propagation. (Separate harness: `tests/orchestration-handoff-contract.test.mjs`.) |

### Exit codes

- `0` — all checks passed.
- `1` — one or more checks failed.

### Warm cache

`validate.mjs` maintains a success-only warm cache at `evals/.cache/validate-cache.json`. On a cold run that passes all structural checks the harness writes an aggregate fingerprint to the cache file. On a subsequent run it computes the same fingerprint and, if it matches, exits immediately with ✅ without re-executing any pass.

**What the fingerprint covers (conservative invalidation):** `validate.mjs` itself, `evals/package.json`, `evals/package-lock.json`, all `schemas/*.schema.json`, all `evals/scenarios/*.json`, all `*.agent.md` root files, the required governance and artifact files consumed by the harness (`.github/copilot-instructions.md`, `plans/project-context.md`, `docs/agent-engineering/` policy files, `governance/*.json`), and `skills/index.md` plus all `skills/patterns/*.md` files.

**Cache safety rules:**

- Only successful (all-pass) runs are cached. A failing run never writes to the cache.
- Any cache read, parse, or write failure falls back silently to a full cold run.
- Touching any file in the fingerprint set invalidates the cache on the next run.

**Timing guidance:** Measure `node validate.mjs` cold then immediately warm to observe the structural cache benefit. Use `npm test` only as a non-regression gate — it also runs the behavioral (`tests/prompt-behavior-contract.test.mjs`) and orchestration-handoff (`tests/orchestration-handoff-contract.test.mjs`) suites, which are not cached and carry additional overhead beyond the structural passes.

The cache file is excluded from version control via `.gitignore`.

### Limitations

- The harness validates structural consistency, not live model behavior.
- It does not prove that an agent uses every granted tool correctly at runtime.
- It does not execute Copilot agents or assert semantic quality of freeform prose.
