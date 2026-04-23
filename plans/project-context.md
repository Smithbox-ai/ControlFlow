# Project Context — ControlFlow Agent System

## Phase Executor Agents

The following agents are available for Orchestrator phase dispatch. The `executor_agent` field in Planner plans must use one of these exact names.

| Agent | Role | Primary Use Case | Model Recommendation |
| --- | --- | --- | --- |
| CodeMapper-subagent | Read-only discovery | Codebase exploration, file mapping | Fast model (mini) |
| Researcher-subagent | Research & evidence | Deep investigation, evidence extraction | Fast model (mini) |
| CoreImplementer-subagent | Backend implementation | Code creation, modification, testing | Capable model (Sonnet) |
| UIImplementer-subagent | UI implementation | Components, styling, accessibility | Capable model (Sonnet) |
| PlatformEngineer-subagent | Infrastructure | CI/CD, containers, deployment | Capable model (Sonnet) |
| TechnicalWriter-subagent | Documentation | Docs, diagrams, walkthroughs | Capable model (Sonnet) |
| BrowserTester-subagent | E2E testing | Browser tests, accessibility audits | Capable model (Sonnet) |
| CodeReviewer-subagent | Post-impl verification | Code review, quality gates | Capable model (Sonnet) |

**Note:** Optional Final Review Gate (Completion Gate sub-step) — activated for LARGE tier (auto) or on user request; dispatches CodeReviewer with review_scope=final; policy flag: governance/runtime-policy.json#final_review_gate

## Review Pipeline Agents

The following agents are dispatched by Orchestrator specifically during the PLAN_REVIEW lifecycle or pre-flight phase, and perform read-only auditing.

| Agent | Role | Primary Use Case | Model Recommendation |
| --- | --- | --- | --- |
| PlanAuditor-subagent | Pre-impl plan audit | Architecture, security, risk review | Read-only capable model |
| AssumptionVerifier-subagent | Mirage detection | Assumption verification, hallucination hunting | Read-only capable model |
| ExecutabilityVerifier-subagent | Executability verification | Cold-start plan simulation | Read-only capable model |

*Note: `PlanAuditor-subagent`, `AssumptionVerifier-subagent`, and `ExecutabilityVerifier-subagent` are strictly review-only agents. They are dispatched by Orchestrator during the PLAN_REVIEW lifecycle and must NOT appear as `executor_agent` values in Planner plan phases. The `executor_agent` enum in `schemas/planner.plan.schema.json` enforces this exclusion.*

### Entry-Point Delegation Policy

Orchestrator acts as an entry point and must delegate only to `Planner` or the project-internal subagents documented in this file.
Planner acts as an entry point for planning research only and must delegate only to the project-internal research agents documented in this file: `CodeMapper-subagent` and `Researcher-subagent`.
Delegation to external or third-party agents is strictly prohibited.

**Non-executor agents** (not dispatched via executor_agent):

- **Orchestrator** — Conductor (conductor, not a phase executor)
- **Planner** — Plan Producer (produces plans, not a phase executor)
- **PlanAuditor-subagent** — Review-only auditor (dispatched during PLAN_REVIEW, not via `executor_agent`)

## Complexity Tier Definitions

| Tier | File Count | Scope | Pipeline Depth |
| --- | --- | --- | --- |
| TRIVIAL | ≤2 files | Single concern, isolated change | Skip PLAN_REVIEW entirely |
| SMALL | 3-5 files | Single domain, clear boundaries | PlanAuditor only (lite review) |
| MEDIUM | 6-15 files | Cross-domain, multiple concerns | PlanAuditor + AssumptionVerifier |
| LARGE | 15+ files | Cross-cutting, system-wide impact | Full pipeline (PlanAuditor + AssumptionVerifier + ExecutabilityVerifier) |

**Override Rule:** Any plan with `risk_review` containing `applicability: applicable` AND `impact: HIGH` AND `disposition` not `resolved` → force LARGE-tier pipeline regardless of file count.

## Semantic Risk Taxonomy

Seven mandatory risk categories evaluated by Planner during planning:

| Category | Description | Trigger Heuristics |
| --- | --- | --- |
| data_volume | Data scale and pagination concerns | Tables, datasets, batch ops, SELECT *, missing LIMIT |
| performance | Query paths, algorithmic complexity | N+1 patterns, missing indexes, computed columns in hot paths |
| concurrency | Parallel execution safety | Shared mutable state, parallel writes, background jobs |
| access_control | Data visibility and authorization | New endpoints, ownership model changes, role transitions |
| migration_rollback | Schema and data migration safety | DB schema changes, data transforms, file format changes |
| dependency | External service and package contracts | External APIs, new packages, version upgrades |
| operability | Deployment and observability | New services, infrastructure changes, monitoring gaps |

### Orchestrator → PlanAuditor Focus Area Mapping

When a semantic risk entry triggers PlanAuditor review, Orchestrator maps the risk category to PlanAuditor focus areas:

| Risk Category | PlanAuditor Focus Areas |
| --- | --- |
| data_volume, performance | `["performance"]` |
| concurrency, access_control | `["architecture"]` |
| migration_rollback | `["destructive_risk", "missing_rollback"]` |
| dependency | `["architecture"]` |
| operability | `["scope_gap"]` |

## Agent Role Matrix

| Agent | Schema Output | Tools Profile | Delegation Source |
| --- | --- | --- | --- |
| CodeMapper-subagent | code-mapper.discovery.schema.json | Read-only (5 tools) | Orchestrator, Researcher, Planner |
| Researcher-subagent | researcher.research-findings.schema.json | Read + fetch (6 tools) | Orchestrator, Planner |
| CoreImplementer-subagent | core-implementer.execution-report.schema.json | Full implementation (11 tools) | Orchestrator |
| UIImplementer-subagent | ui-implementer.execution-report.schema.json | Full implementation (10 tools) | Orchestrator |
| PlatformEngineer-subagent | platform-engineer.execution-report.schema.json | Full implementation (10 tools) | Orchestrator |
| TechnicalWriter-subagent | technical-writer.execution-report.schema.json | Edit + search (6 tools) | Orchestrator |
| BrowserTester-subagent | browser-tester.execution-report.schema.json | Search + edit evidence (6 tools) | Orchestrator |
| CodeReviewer-subagent | code-reviewer.verdict.schema.json | Search + run (6 tools) | Orchestrator |
| PlanAuditor-subagent | plan-auditor.plan-audit.schema.json | Read-only (7 tools) | Orchestrator |
| AssumptionVerifier-subagent | assumption-verifier.plan-audit.schema.json | Read-only (6 tools) | Orchestrator |
| ExecutabilityVerifier-subagent | executability-verifier.execution-report.schema.json | Read-only (5 tools) | Orchestrator |

## Shared Conventions

- All agent outputs use structured text format. Do NOT output raw JSON to chat — it wastes context tokens. Schemas in `schemas/` serve as contract documentation and eval fixture references.
- Failure classification enum: `transient`, `fixable`, `needs_replan`, `escalate` (except PlanAuditor/AssumptionVerifier which exclude `transient`).
- PART-spec section order is mandatory for all agents: Prompt → Archive → Resources → Tools.
- Plan artifacts are stored in `plans/` directory.
- Skills library is stored in `skills/` directory.
- Template files are stored in `plans/templates/` directory.
- Implementation agents (CoreImplementer, UIImplementer, PlatformEngineer) share a common execution backbone documented in `docs/agent-engineering/MIGRATION-CORE-FIRST.md`. CoreImplementer is the canonical backbone reference; UI and Platform extend it with domain-specific gates.
- Model-role routing uses the `by_tier` convention defined in `governance/model-routing.json`; the authoritative spec is `docs/agent-engineering/MODEL-ROUTING.md`. All 13 agents declare a valid `model_role:` frontmatter key matching a role entry in that file.

## Canonical Source Matrix

| Concern | Authoritative File | Notes |
| --- | --- | --- |
| Executor roster | `plans/project-context.md` | Defines allowed `executor_agent` names for phases. |
| Complexity tiers | `plans/project-context.md` | Maps file counts/risk to pipeline depth. |
| Semantic-risk taxonomy | `plans/project-context.md` | Defines the 7 risk categories evaluated during planning. |
| Review routing | `governance/runtime-policy.json` | Active rules for PLAN_REVIEW and Completion Gate execution. |
| Retry budgets | `governance/runtime-policy.json` | Exact numeric limits, backoffs, and escalation thresholds. |
| Shared evidence discipline | `docs/agent-engineering/PROMPT-BEHAVIOR-CONTRACT.md` | Mandates evidence citations for claims across all agents. |
| Gate-event contract | `docs/agent-engineering/RELIABILITY-GATES.md` | Governs PreFlect, Completion, and validation structural rules. |
