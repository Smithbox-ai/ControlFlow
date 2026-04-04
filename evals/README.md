# ControlFlow — Eval Suite

Structural validation fixtures for the ControlFlow multi-agent system. These scenarios verify schema compliance, agent contracts, and orchestration behavior without executing live agents.

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

## Suggested execution flow
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

### Orchestration
- `scenarios/wave-execution.json`
- `scenarios/failure-retry.json`
- `scenarios/orchestrator-todo-orchestration.json`
- `scenarios/orchestrator-phase-executor-routing.json`
- `scenarios/orchestrator-retry-backoff.json`
- `scenarios/complexity-gate-routing.json`

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

## Running Validations

The `validate.mjs` harness runs structural checks against schemas, agent prompts, and eval fixtures. It does not execute the agents themselves.

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
|------|----------------|
| **1 — Schema Validity** | All `schemas/*.schema.json` compile under `ajv` JSON Schema 2020-12. |
| **2 — Scenario Integrity** | All `evals/scenarios/*.json` have the required identity fields and point to real agent files. Planner scenarios must assert `risk_review_present: true`. |
| **3 — Reference Integrity** | All backtick schema/doc references inside `*.agent.md` resolve to existing files. |
| **3b — Required Artifacts** | Shared repo-local dependencies like `.github/copilot-instructions.md`, `plans/project-context.md`, and governance docs exist. |
| **3c — Tool Grant Consistency** | Every agent frontmatter `tools:` list matches the repository's canonical least-privilege tool set. |
| **4 — P.A.R.T Section Order** | Every `*.agent.md` preserves `## Prompt` → `## Archive` → `## Resources` → `## Tools` ordering. |
| **5 — Skill Library** | Every file in `skills/patterns/` is registered in `skills/index.md` and every index entry resolves to a real file. |
| **6 — Synthetic Rename Negative-Path Checks** | Structural guard checks: stale `target_agent`, stale `expected.schema`, and stale nested `agent` references are correctly rejected. |

### Exit codes

- `0` — all checks passed.
- `1` — one or more checks failed.

### Limitations

- The harness validates structural consistency, not live model behavior.
- It does not prove that an agent uses every granted tool correctly at runtime.
- It does not execute Copilot agents or assert semantic quality of freeform prose.
