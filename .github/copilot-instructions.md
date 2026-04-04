# ControlFlow Agent System — Shared Policies

## Continuity
Use `plans/project-context.md` when present as stable reference for project conventions.

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
- `PART-SPEC.md` — P.A.R.T. specification (mandatory section structure for all agents).
- `RELIABILITY-GATES.md` — Verification gate requirements (build/tests/lint).
- `CLARIFICATION-POLICY.md` — When to invoke `vscode/askQuestions` vs. return `NEEDS_INPUT`.
- `TOOL-ROUTING.md` — Routing rules for external tools (fetch, githubRepo, MCP).

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

Quantitative scoring reference: `docs/agent-engineering/SCORING-SPEC.md`
Complexity tiers: TRIVIAL / SMALL / MEDIUM / LARGE (see `plans/project-context.md`)
Skill library: `skills/index.md`
