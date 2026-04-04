# ControlFlow Agent System — Shared Policies

## Continuity
Use `plans/project-context.md` as the stable reference for agent roster, complexity tiers, semantic risk taxonomy, and shared conventions.

## Build and Test
```sh
cd evals && npm test   # schema compliance and agent contract validation (no live agents needed)
```
Scenarios are in `evals/scenarios/`. Validate against matching schemas in `schemas/`.

## Failure Classification
When status is `FAILED`, `NEEDS_INPUT`, `NEEDS_REVISION`, or `REJECTED`, include `failure_classification`:
- `transient` — Flaky test, network timeout, or temporary tool unavailability; retry with identical scope.
- `fixable` — Small correctable issue (typo, missing import, config value); retry with fix hint.
- `needs_replan` — Architecture mismatch or missing dependency; delegate to Planner for targeted replan.
- `escalate` — Security vulnerability, data integrity risk, or unresolvable blocker; stop and await human approval.

## NOTES.md
Maintain/update `NOTES.md` for persistent state across context resets:
- Active objective and current phase.
- Blockers and unresolved risks.
- Remove stale entries when superseded.

## Governance Docs
Agent engineering policies are in `docs/agent-engineering/`:
- `PART-SPEC.md` — P.A.R.T. specification (mandatory section order: **Prompt → Archive → Resources → Tools**).
- `RELIABILITY-GATES.md` — Verification gate requirements (build/tests/lint).
- `CLARIFICATION-POLICY.md` — When to invoke `vscode/askQuestions` vs. return `NEEDS_INPUT`.
- `TOOL-ROUTING.md` — Routing rules for external tools (fetch, githubRepo, MCP).
- `SCORING-SPEC.md` — Quantitative scoring reference.

## Conventions
- Agent files live at repo root: `<Name>.agent.md` or `<Name>-subagent.agent.md`.
- Artifacts: plans → `plans/`, schemas → `schemas/`, skill patterns → `skills/patterns/`.
- All agent outputs use **structured text**. Do NOT output raw JSON to chat — it wastes context tokens.
- Skill library is at `skills/index.md`. Planner selects ≤3 skills per plan phase.
- Failure taxonomy applies to all agents; PlanAuditor and AssumptionVerifier exclude `transient`.

## Agent System
13 agents in the ControlFlow system:
- **Orchestration:** Orchestrator
- **Planning:** Planner
- **Adversarial Review:** PlanAuditor-subagent, AssumptionVerifier-subagent
- **Executability Verification:** ExecutabilityVerifier-subagent
- **Implementation:** CoreImplementer-subagent, UIImplementer-subagent, PlatformEngineer-subagent
- **Review:** CodeReviewer-subagent
- **Research:** Researcher-subagent, CodeMapper-subagent
- **Documentation:** TechnicalWriter-subagent
- **Testing:** BrowserTester-subagent

Complexity tiers: TRIVIAL / SMALL / MEDIUM / LARGE — see `plans/project-context.md`.
