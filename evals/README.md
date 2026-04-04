# Core Evals (Phase 1 + Phase 2)

This folder contains scenario fixtures used to validate reliability for core agents.

## What is validated
1. Schema compliance for core outputs.
2. Consistency under repeated runs.
3. Robustness under paraphrases and naming drift.
4. Predictability via correct `ABSTAIN` behavior.
5. Safety via mandatory human approval gates for high-risk actions.
6. Failure taxonomy routing (transient, fixable, needs_replan, escalate).
7. Wave-based execution ordering and batch approval.
8. Agent-specific contracts (PlatformEngineer rollback, BrowserTester health-first, TechnicalWriter parity).
9. Clarification triggering via askQuestions for enumerated ambiguity classes.
10. Tool routing compliance (Context7/MCP usage when third-party docs are needed).
11. NEEDS_INPUT routing from subagents through Orchestrator to user via askQuestions.
12. Semantic risk coverage — Planner `risk_review` array is present and covers all 7 categories in every plan output.

## Suggested execution flow
1. Run each scenario against the corresponding agent contract.
2. Validate output object against the matching schema in `schemas/`.
3. Repeat deterministic scenarios at least 3 times and compare status transitions.
4. Record any drift in gate events and abstention decisions.

## Scenario set

### Core reliability
- `scenarios/consistency-repeatability.json`
- `scenarios/robustness-paraphrase.json`
- `scenarios/predictability-abstain.json`
- `scenarios/safety-approval-gate.json`
- `scenarios/prometheus-schema-output.json`
- `scenarios/atlas-phase-verification.json`

### Agent contracts
- `scenarios/sisyphus-contract.json`
- `scenarios/frontend-contract.json`
- `scenarios/devops-contract.json`
- `scenarios/docwriter-contract.json`
- `scenarios/browser-tester-contract.json`

### Orchestration
- `scenarios/wave-execution.json`
- `scenarios/failure-retry.json`
- `scenarios/atlas-todo-orchestration.json`

### Clarification and routing
- `scenarios/clarification-askquestions.json`
- `scenarios/skills-mcp-routing.json`
- `scenarios/agent-triggering-quality.json`
- `scenarios/prometheus-ambiguity-plus-schema.json`

### PlanAuditor adversarial and integration
- `scenarios/challenger-contract.json`
- `scenarios/challenger-adversarial-detection.json`
- `scenarios/challenger-replan-loop.json`
- `scenarios/atlas-challenger-integration.json`

### Semantic risk discovery
- `scenarios/prometheus-large-data-risk-discovery.json`

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

### Exit codes

- `0` — all checks passed.
- `1` — one or more checks failed.

### Limitations

- The harness validates structural consistency, not live model behavior.
- It does not prove that an agent uses every granted tool correctly at runtime.
- It does not execute Copilot agents or assert semantic quality of freeform prose.
