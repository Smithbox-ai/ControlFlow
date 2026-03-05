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
8. Agent-specific contracts (DevOps rollback, BrowserTester health-first, DocWriter parity).

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

### Agent contracts
- `scenarios/sisyphus-contract.json`
- `scenarios/frontend-contract.json`
- `scenarios/devops-contract.json`
- `scenarios/docwriter-contract.json`
- `scenarios/browser-tester-contract.json`

### Orchestration
- `scenarios/wave-execution.json`
- `scenarios/failure-retry.json`
