# Agent-as-Tool — Conceptual Executor-Role Input Contract (Spec Only)

## Purpose

Codify the minimum input contract every conceptual executor role accepts, so that a role can be surfaced in the future as an MCP tool or a native Copilot/Cursor chat tool without re-designing its signature. This document is specification-only; no runtime wiring is introduced.

In the slim Copilot-first model, the 8 executor role labels (`CodeMapper-subagent`, `Researcher-subagent`, `CoreImplementer-subagent`, `UIImplementer-subagent`, `PlatformEngineer-subagent`, `TechnicalWriter-subagent`, `BrowserTester-subagent`, `CodeReviewer-subagent`) are **conceptual roles** the Planner assigns in plan phases and native Copilot executes inline — they are not shipped agent files. See `plans/project-context.md` for the role taxonomy. There is no Orchestrator that dispatches them, and no ControlFlow tool-routing surface — native Copilot provides tools and dispatch.

## Scope

Applies to the 8 conceptual executor roles and the 3 inline verify roles (`PlanAuditor-subagent`, `AssumptionVerifier-subagent`, `ExecutabilityVerifier-subagent`). The Planner is the plan-producer role (shipped as `@controlflow-planner`); the retired Orchestrator is not part of this contract.

## Required input fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `scope` | string (prose) | Concrete description of the delegated unit of work. Bounded, verifiable, and scoped to a single phase or sub-phase. |
| `context_refs` | array of strings | File paths or artifact URIs the role must read before acting. Relative to repo root. Empty array allowed only for purely generative tasks. |
| `trace_id` | UUIDv4 string | Per-task correlation identifier. Propagated through plan lifecycle sections and report schemas for observability. |

Absence of any required field implies missing context:

- Native Copilot / a native tool wrapper should catch missing required fields before invocation where the role's schema lacks a clarification path.
- Roles whose schema admits a clarification path may emit a structured `clarification_request` per `docs/agent-engineering/CLARIFICATION-POLICY.md`.
- Read-only / review roles should use their schema-supported `ABSTAIN`, `INSUFFICIENT_EVIDENCE`, or failure path.

## Recommended input fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `iteration_index` | integer ≥ 0 | Current iteration in a bounded verify loop. Propagated through Planner replan/update payloads. |
| `max_iterations` | integer ≥ 1 | Cap from `governance/runtime-policy.json` verdict-routing thresholds. |
| `retry_attempt` | integer ≥ 0 | Attempt counter for reliability signaling. Retry routing is native Copilot's job in the slim model. |
| `budget_context` | object | Optional resource budget envelope per `skills/patterns/budget-tracking.md`. |
| `fix_hint` | object | Optional pre-retry reflection output per `skills/patterns/reflection-loop.md`. |

Recommended fields improve determinism and observability but are not required for contract conformance.

## Return shape

Every conceptual role returns a structured execution report that satisfies the agent-as-tool return contract. The report schemas live in `schemas/` and serve as contract documentation and eval fixture references (not runtime-validated inter-agent messages in the slim model):

- `schemas/core-implementer.execution-report.schema.json`
- `schemas/ui-implementer.execution-report.schema.json`
- `schemas/platform-engineer.execution-report.schema.json`
- `schemas/technical-writer.execution-report.schema.json`
- `schemas/browser-tester.execution-report.schema.json`
- `schemas/executability-verifier.execution-report.schema.json`
- `schemas/code-reviewer.verdict.schema.json`
- `schemas/plan-auditor.plan-audit.schema.json`
- `schemas/assumption-verifier.plan-audit.schema.json`
- `schemas/code-mapper.discovery.schema.json`
- `schemas/researcher.research-findings.schema.json`
- `schemas/planner.plan.schema.json`

Every report schema carries an optional `trace_id`, which closes the correlation loop required for tool surfacing. No additional schema change is required for forward compatibility.

## Forward compatibility — MCP / native tool surfacing

Each conceptual role is designed to be surfaced as a tool with the following frontmatter-described I/O contract:

```yaml
name: <role-id>
description: <one-line mission from the role's prompt>
inputs:
  scope: { type: string, required: true }
  context_refs: { type: array, items: string, required: true }
  trace_id: { type: string, format: uuid, required: true }
  iteration_index: { type: integer, required: false }
  max_iterations: { type: integer, required: false }
  retry_attempt: { type: integer, required: false }
  budget_context: { type: object, required: false }
  fix_hint: { type: object, required: false }
output_schema: schemas/<role>.<report|verdict|discovery|plan|plan-audit>.schema.json
```

When a future phase implements surfacing, no contract-breaking field changes are needed — only the registration wrapper. Native Copilot (or Cursor, via `plugins/controlflow-cursor/`) provides the tool-dispatch surface; ControlFlow does not ship a competing one.

## Non-goals

- No MCP server is registered by ControlFlow.
- No Copilot tool manifest is changed by ControlFlow.
- No shipped agent frontmatter is mutated (the slim model ships one agent; the rest are conceptual roles).
- No schema `required` arrays are changed.

## Cross-references

- `docs/agent-engineering/CLARIFICATION-POLICY.md` — clarification contract when required fields are missing.
- `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md` — which capabilities ControlFlow delegates to native Copilot (tool access, subagent dispatch, model selection).
- `skills/patterns/reflection-loop.md` — producer of `fix_hint`.
- `skills/patterns/budget-tracking.md` — producer of `budget_context`.
- `plans/project-context.md` — the role taxonomy and the agent role matrix.