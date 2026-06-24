# Core-first Migration Guide

This document is the canonical reference for the "ship the slim surface first, then layer patterns" migration pattern, followed by the historical migration record from the retired 13-agent / Orchestrator model.

## Slim-model pattern: ship the slim surface first

The current migration discipline is the inverse of the retired model's "land 13 agents, then converge." The rule is: **ship the smallest non-duplicating surface first, then layer value-add patterns on top.**

1. **Ship the slim surface.** One agent — `.github/agents/controlflow-planner.agent.md` — and three skills — `.github/skills/controlflow-plan/`, `.github/skills/controlflow-verify/`, `.github/skills/controlflow-review/` — over native Copilot. Plus the routing stub at `.github/copilot-instructions.md`. Nothing else ships as a ControlFlow surface.
2. **Delegate everything Copilot does natively.** Subagent dispatch, parallelism, model selection, tool access, approvals, Plan mode discovery, and agentic code review are all native Copilot capabilities (see `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`). ControlFlow does not re-implement them.
3. **Layer the non-native disciplines.** The schema-enforced plan format (anchored by `schemas/planner.plan.schema.json`), adversarial verify, the tier-gated policy, plan-vs-implementation scope-drift review, and the contract-drift eval suite are the five things Copilot does not provide natively. They are the irreducible value-add.
4. **Add patterns, not agents.** Reusable domain discipline (TDD, error handling, security review, source grounding, etc.) lives in `skills/patterns/` as Planner-injected value-add patterns (at most three per phase via `skill_references`), not as shipped specialized agents. If a specialized persona is genuinely needed, recreate it as a native Copilot custom agent under `.github/agents/` per `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md` §5.
5. **Gate with the eval suite.** `cd evals && npm test` is the offline contract-drift gate. Delete `evals/.cache/` before trusting a green run.

There is no Orchestrator, no dispatch state machine, no wave execution, no Completion Gate, and no tool-grants / model-routing / agent-grants surface in the slim model. Orchestration is the plan → verify → review pipeline over native Copilot.

## Required artifacts (slim model)

- `.github/agents/controlflow-planner.agent.md` — the sole shipped agent.
- `.github/skills/controlflow-{plan,verify,review}/` — the three workflow skills.
- `.github/copilot-instructions.md` — the routing stub.
- `schemas/planner.plan.schema.json` — the immutable plan format contract.
- `plans/project-context.md` — the role taxonomy + tier definitions + canonical-source matrix.
- `governance/runtime-policy.json`, `governance/project-context-registry.json`, `governance/canonical-source-matrix.json`, `governance/rename-allowlist.json` — the four governance files.
- `evals/` — the offline contract-drift suite.

## Rollout sequence (slim model)

1. Land the slim `.github/` surface (agent + three skills + routing stub).
2. Land the schemas and governance files the skills single-source from.
3. Land the `skills/patterns/` library and `skills/index.md`.
4. Run `cd evals && npm test` and iterate until green.
5. Update `README.md` and the tutorials to the slim surface.

## Historical migration record (retired model)

The sections below are the historical migration record from the retired 13-agent / Orchestrator model. They describe a surface that no longer ships and are kept for traceability. The retired files (the root `*.agent.md` roster, governance/model-routing.json, governance/tool-grants.json, governance/agent-grants.json, and the former RELIABILITY-GATES.md, TOOL-ROUTING.md, MODEL-ROUTING.md, OBSERVABILITY.md) are not part of the slim surface.

### Phase 1–2: Core agents and ecosystem expansion (retired)

The retired model landed a 13-agent roster (Planner, Orchestrator, and 11 specialized subagents) with P.A.R.T.-structured `*.agent.md` files, schema-governed outputs, wave-aware parallel execution, and an inter-phase delegation protocol. This surface was retired in Phase 3 when Copilot gained native subagent dispatch, parallelism, model selection, and tool access. The role names survive only as conceptual labels the Planner assigns in plan phases and native Copilot executes inline (see `plans/project-context.md`).

### Phase 3: Modernization (retired, 2026-04-04)

Added `AssumptionVerifier-subagent` and `ExecutabilityVerifier-subagent` as shipped agents, a scoring spec, plan templates, the skills library, and governance/tool-grants.json / `governance/runtime-policy.json` knobs for the Orchestrator. In the slim model, the two verifiers are inline phases of `controlflow-verify` (not shipped agents); governance/tool-grants.json is retired; `governance/runtime-policy.json` survives with three blocks (`review_pipeline_by_tier`, `semantic_risk_policy`, `verdict_routing`).

### Phase 4: Implementer rationalization (retired, 2026-04-05)

An internal convergence of the CoreImplementer / UIImplementer / PlatformEngineer trio that preserved the 13-agent roster externally. In the slim model the three implementers are conceptual executor roles (the `executor_agent` enum in `schemas/planner.plan.schema.json`), executed by native Copilot — there are no shipped implementer agent files to converge. The shared implementation backbone (read standards → PreFlect → execute → verify gates → emit structured report) survives as the discipline carried by `skills/patterns/` files, Planner-injected per phase.

## Quality gates before merge (slim model)

- `cd evals && npm test` exits 0 (delete `evals/.cache/` first).
- The slim `.github/` surface contains exactly one agent and three skills.
- No shipped ControlFlow surface duplicates a native Copilot capability (audit checklist in `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`).
- The plan format, role taxonomy, and governance config stay aligned across files (Pass 14 drift check).

## Backward compatibility

Not guaranteed for the retired 13-agent output shape. The slim model is a clean break: the retired root `*.agent.md` roster, the Orchestrator dispatch state machine, and the tool-grants / model-routing / agent-grants knobs are gone. Plans produced under the slim model conform to `schemas/planner.plan.schema.json` and use the 8 `executor_agent` role labels as conceptual roles, not shipped agents.