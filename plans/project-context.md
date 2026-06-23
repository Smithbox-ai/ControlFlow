# Project Context — ControlFlow (Slim Copilot-First Model)

## Overview

ControlFlow is a thin layer over native Copilot. It ships one agent — `@controlflow-planner` at `.github/agents/controlflow-planner.agent.md` (a Copilot agent prompt using the Auto model picker, no `model:` frontmatter) — and three skills at `.github/skills/`: `controlflow-plan`, `controlflow-verify`, `controlflow-review`. The Planner produces schema-anchored plans; `controlflow-verify` adversarially audits them inline (zero subagents); `controlflow-review` reviews implementation. There are no shipped subagents — Copilot native provides execution, tool access, and model selection.

The role labels in the tables below name conceptual ROLES the Planner may assign in plan phases (`executor_agent`) and the verify skill performs inline. They are not shipped agent files. The `executor_agent` enum in `schemas/planner.plan.schema.json` enforces the 8 executor names; the 3 review roles are performed inline by `controlflow-verify`'s phases. The legacy 13-agent dispatch surface (root `*.agent.md`, `governance/model-routing.json`, `governance/tool-grants.json`, `governance/agent-grants.json`) is retired.

## Phase Executor Agents

The following role labels are available for `executor_agent` assignment in Planner plans. The `executor_agent` field must use one of these exact names.

**SINGLE SOURCE OF TRUTH: `governance/project-context-registry.json`.** The roster/role-matrix tables below (Phase Executor Agents, Review Pipeline Agents, Agent Role Matrix) are a human-readable mirror, automatically verified row-for-row by the Pass 14 drift check (`validateProjectContextRegistryMirror`). Do not hand-edit these tables independently of the registry — update the registry first, then mirror the change here.

| Agent | Role | Primary Use Case | Model Routing Role |
| --- | --- | --- | --- |
| CodeMapper-subagent | Read-only discovery | Codebase exploration, file mapping | `fast-readonly` |
| Researcher-subagent | Research & evidence | Deep investigation, evidence extraction | `research-capable` |
| CoreImplementer-subagent | Backend implementation | Code creation, modification, testing | `capable-implementer` |
| UIImplementer-subagent | UI implementation | Components, styling, accessibility | `ui-implementer` |
| PlatformEngineer-subagent | Infrastructure | CI/CD, containers, deployment | `capable-implementer` |
| TechnicalWriter-subagent | Documentation | Docs, diagrams, walkthroughs | `documentation` |
| BrowserTester-subagent | E2E testing | Browser tests, accessibility audits | `browser-testing` |
| CodeReviewer-subagent | Post-impl verification | Code review, quality gates | `capable-reviewer` |

**Note:** The `Model Routing Role` column lists conceptual capability tiers the Copilot Auto model picker targets when the Planner describes a role. There is no model-routing surface in the slim model — the legacy `governance/model-routing.json` and `docs/agent-engineering/MODEL-ROUTING.md` are retired.

## Review Pipeline Agents

The following review roles are performed inline by the `controlflow-verify` skill (not dispatched as subagents). Phase 1 (structural audit) corresponds to the PlanAuditor role; phase 2 (assumption/mirage detection) to the AssumptionVerifier role; phase 3 (executability cold-start) to the ExecutabilityVerifier role. They are strictly read-only and must NOT appear as `executor_agent` values in Planner plan phases.

| Agent | Role | Primary Use Case | Model Routing Role |
| --- | --- | --- | --- |
| PlanAuditor-subagent | Pre-impl plan audit | Architecture, security, risk review | `capable-reviewer` |
| AssumptionVerifier-subagent | Mirage detection | Assumption verification, hallucination hunting | `capable-reviewer` |
| ExecutabilityVerifier-subagent | Executability verification | Cold-start plan simulation | `review-readonly` |

*Note: `PlanAuditor-subagent`, `AssumptionVerifier-subagent`, and `ExecutabilityVerifier-subagent` are review-only roles performed inline by `controlflow-verify`. They must NOT appear as `executor_agent` values in Planner plan phases. The `executor_agent` enum in `schemas/planner.plan.schema.json` enforces this exclusion.*

### Entry-Point Delegation Policy

`@controlflow-planner` (`.github/agents/controlflow-planner.agent.md`) is the sole shipped entry point. It produces plans and assigns an `executor_agent` role per phase; execution, tool access, and model selection are delegated to native Copilot. Delegation to external or third-party agents is not part of the slim flow.

**Non-executor roles** (not assigned via `executor_agent`):

- **Orchestrator** — conceptual conductor role; no shipped agent in the slim model (the Planner plus native Copilot cover orchestration).
- **Planner** — plan-producer role, shipped as `@controlflow-planner`.
- The three review-only roles (`PlanAuditor-subagent`, `AssumptionVerifier-subagent`, `ExecutabilityVerifier-subagent`) are also non-executors — performed inline by `controlflow-verify` (see the **Review Pipeline Agents** table and its note above).

## Complexity Tier Definitions

| Tier | File Count | Scope | Pipeline Depth |
| --- | --- | --- | --- |
| TRIVIAL | ≤2 files | Single concern, isolated change | Skip plan/verify/review entirely |
| SMALL | 3-5 files | Single domain, clear boundaries | controlflow-verify phase 1 (structural audit) |
| MEDIUM | 6-14 files | Cross-domain, multiple concerns | controlflow-verify phases 1–2 (audit + assumption/mirage) |
| LARGE | 15+ files | Cross-cutting, system-wide impact | controlflow-verify phases 1–3 (audit + mirage + executability cold-start) |

**Override Rule:** Any plan with `risk_review` containing `applicability: applicable` AND `impact: HIGH` AND `disposition` not `resolved` → force LARGE-tier pipeline regardless of file count.

## Semantic Risk Taxonomy

see [RISK-TAXONOMY.md § Semantic Risk Categories](../docs/agent-engineering/RISK-TAXONOMY.md#semantic-risk-categories)

### controlflow-verify Phase 1 (Audit) Focus Area Mapping

When a semantic risk entry triggers the audit phase, the risk category maps to audit focus areas:

| Risk Category | Audit Focus Areas |
| --- | --- |
| data_volume, performance | `["performance"]` |
| concurrency, access_control | `["architecture"]` |
| migration_rollback | `["destructive_risk", "missing_rollback"]` |
| dependency | `["architecture"]` |
| operability | `["scope_gap"]` |

## Agent Role Matrix

| Agent | Schema Output | Tools Profile | Delegation Source |
| --- | --- | --- | --- |
| CodeMapper-subagent | code-mapper.discovery.schema.json | Read-only (native Copilot) | controlflow-planner |
| Researcher-subagent | researcher.research-findings.schema.json | Read + fetch (native Copilot) | controlflow-planner |
| CoreImplementer-subagent | core-implementer.execution-report.schema.json | Full implementation (native Copilot) | controlflow-planner |
| UIImplementer-subagent | ui-implementer.execution-report.schema.json | Full implementation (native Copilot) | controlflow-planner |
| PlatformEngineer-subagent | platform-engineer.execution-report.schema.json | Full implementation (native Copilot) | controlflow-planner |
| TechnicalWriter-subagent | technical-writer.execution-report.schema.json | Edit + search (native Copilot) | controlflow-planner |
| BrowserTester-subagent | browser-tester.execution-report.schema.json | Search + edit evidence (native Copilot) | controlflow-planner |
| CodeReviewer-subagent | code-reviewer.verdict.schema.json | Search + run (native Copilot) | controlflow-planner |
| PlanAuditor-subagent | plan-auditor.plan-audit.schema.json | Read-only (native Copilot) | controlflow-planner |
| AssumptionVerifier-subagent | assumption-verifier.plan-audit.schema.json | Read-only (native Copilot) | controlflow-planner |
| ExecutabilityVerifier-subagent | executability-verifier.execution-report.schema.json | Read-only (native Copilot) | controlflow-planner |

## Shared Conventions

- All role outputs use structured text format. Do NOT output raw JSON to chat — it wastes context tokens. Schemas in `schemas/` serve as contract documentation and eval fixture references.
- Failure classification enum: `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable` (PlanAuditor and AssumptionVerifier exclude `transient`).
  - `model_unavailable` — the routed/primary model is unavailable or unreachable; distinct from `transient`.
- Plan artifacts are stored in `plans/` directory.
- Skills library is stored in `skills/` directory.
- Template files are stored in `plans/templates/` directory.
- Tool access and model selection are delegated to native Copilot in the slim model. The legacy `governance/tool-grants.json` and `governance/model-routing.json` grant/routing surfaces are retired.
- **Cursor IDE support** ships as the `plugins/controlflow-cursor/` plugin (agents + skills + templates). The legacy root `.cursor/rules/*.mdc` mirror is retired.

## Canonical Source Matrix

| Concern | Authoritative File | Notes |
| --- | --- | --- |
| Executor roster | `governance/project-context-registry.json` | Defines allowed `executor_agent` names for phases. |
| Review pipeline roster | `governance/project-context-registry.json` | Defines the 3 review-only roles performed inline by `controlflow-verify`. |
| Agent role matrix | `governance/project-context-registry.json` | Defines schema outputs, tool profiles, and delegation sources for project roles. |
| Complexity tiers | `plans/project-context.md` | Maps file counts/risk to pipeline depth. |
| Semantic-risk taxonomy | `docs/agent-engineering/RISK-TAXONOMY.md` | Defines the 7 risk categories evaluated during planning. |
| Runtime policy | `governance/runtime-policy.json` | Slimmed policy: `review_pipeline_by_tier` (tier-gated verify/review depth), `semantic_risk_policy` (7 categories + override), `verdict_routing` (verify verdicts + confidence thresholds). |
| Shared evidence discipline | `docs/agent-engineering/PROMPT-BEHAVIOR-CONTRACT.md` | Mandates evidence citations for claims across all roles. |