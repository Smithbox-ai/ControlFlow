# Model Routing

**Status:** Active logical-role routing with structural offline regression coverage
**File:** `governance/model-routing.json` is the canonical source of truth for internal model selection.
**trace_id:** 7d3f5a2e-1b4c-4e9f-9a8b-2c5d8e1f3a7b

## Purpose

Decouple agent definitions from hard-pinned model strings. Today every `*.agent.md` carries a literal `model: <vendor model> (copilot)` line. Swapping a model — for cost, capability, or availability reasons — requires editing 13 files. Model routing introduces a logical-role indirection so agents reference *what kind of model they need* rather than a specific build.

## File

`governance/model-routing.json` is the canonical source of truth. It declares 10 logical roles covering all 13 ControlFlow agents, with the following per-role shape:

```json
{
  "primary": "<model string>",
  "fallbacks": ["<same-family alt>", "<cross-family alt>"],
  "cost_tier": "low | medium | high",
  "latency_tier": "fast | medium | slow",
  "consumers": ["<agent-file.agent.md>", ...]
}
```

The 10 roles are:

| Role | Consumers |
| --- | --- |
| `orchestration-capable` | Orchestrator |
| `capable-planner` | Planner |
| `capable-implementer` | CoreImplementer, PlatformEngineer |
| `ui-implementer` | UIImplementer |
| `documentation` | TechnicalWriter |
| `capable-reviewer` | CodeReviewer, PlanAuditor, AssumptionVerifier |
| `review-readonly` | ExecutabilityVerifier |
| `browser-testing` | BrowserTester |
| `fast-readonly` | CodeMapper |
| `research-capable` | Researcher |

### Default Auto Selection with Selective Pinning

Copilot **Auto** is the default model-selection mode for every agent. Auto agents omit the `model:` frontmatter line entirely (omission is the only supported way to defer to the picker — there is no `model: auto` sentinel), so VS Code Copilot's model picker chooses the runtime model for both direct invocation and orchestrated `runSubagent` dispatch. Deterministic/pinned selection is the **opt-in override** for a small set of control-plane agents whose model choice decides output quality.

Exactly four agents are pinned, listed in the top-level `pinned_agents` array of `governance/model-routing.json`:

- `Orchestrator` — pinned to `Claude Opus 4.8 (copilot)` (role `orchestration-capable`, `cost_tier: high`). This pin is required by the tier-floor invariant below, so that no pinned subagent it dispatches is capped down.
- `Planner` — pinned to `GPT-5.5 (copilot)` (role `capable-planner`) so plan quality, decomposition, and risk framing use the strongest available planning model. The planner fallback ordering is governed by `roles.capable-planner` (primary: `GPT-5.5 (copilot)`, fallback 1: `Claude Opus 4.8 (copilot)`, fallback 2: `GPT-5.4 mini (copilot)`). This preserves the scalar `model:` frontmatter in `Planner.agent.md` and does not imply list-valued frontmatter is required.
- `PlanAuditor-subagent` and `AssumptionVerifier-subagent` — pinned to `Claude Opus 4.8 (copilot)` (role `capable-reviewer`) for premium adversarial review on direct invocation and orchestrated dispatch.

The remaining nine agents — including `CodeReviewer-subagent`, `CodeMapper-subagent`, `ExecutabilityVerifier-subagent`, and the implementation agents — are Auto: they keep `model_role:` but omit `model:`, and Copilot's picker selects their runtime model. Pinning is keyed by agent **filename** in `pinned_agents`, not by role, so `PlanAuditor`/`AssumptionVerifier` stay on the shared `capable-reviewer` role while the (Auto) `CodeReviewer` on the same role needs no role split. For tier-aware `capable-reviewer` resolution under pinned/deterministic dispatch, see [Fallback semantics](#fallback-semantics).

> **Advisory/inert fields for Auto agents.** For any non-pinned (Auto) agent, the role's `primary`, `fallbacks`, `by_tier`, `cost_tier`, and `reasoning_effort_hint` fields are **advisory reference only** — Copilot's model picker selects the model at runtime and these fields are not applied. They take effect only if the agent is later pinned (added to `pinned_agents`).

This yields a pragmatic split:

- Premium tokens are spent on planning and on finding flaws (Planner, the two pinned reviewers), plus the Orchestrator pin that floors their tier.
- Routine orchestration, implementation, and read-only work defer to Auto and let Copilot's picker choose.

Pinned agents carry both a `model:` line and a `model_role:` line in their frontmatter; Auto agents carry `model_role:` alone and omit `model:`:

```yaml
---
description: '...'
tools: [...]
model: GPT-5.5 (copilot)
model_role: capable-planner
---
```

For a pinned agent both lines coexist: the `model:` line is what VS Code Copilot consumes for direct invocation and must equal the role's top-level `primary`. For an Auto agent the `model:` line is omitted and Copilot's picker selects the model; `model_role:` remains the logical-layer indirection validated by evals in both cases.

### Tier-floor invariant and the subagent cost-cap rule

VS Code enforces a **subagent cost-cap rule**: a subagent's effective model cost tier cannot exceed the cost tier of the MAIN (Orchestrator) model. If a dispatched subagent is pinned to a higher-cost-tier model than the running Orchestrator, the subagent is silently capped down to the Orchestrator's model (it falls back to the main model). This makes the Orchestrator's tier **load-bearing** in two ways:

- **Tier-floor invariant (pinned subagents):** the Orchestrator's pinned model `cost_tier` must be `>=` the highest `cost_tier` among the pinned subagents it dispatches. The pinned Planner and the two pinned reviewers (PlanAuditor, AssumptionVerifier) all sit at `cost_tier: high`, so `orchestration-capable` is pinned to `Claude Opus 4.8 (copilot)` (`cost_tier: high`) — guaranteeing no pinned subagent is capped down below its configured model.
- **Auto-agent safety:** the same cap also bounds Auto subagents, so an Auto agent such as `ExecutabilityVerifier-subagent` can never resolve above the Orchestrator's high tier. Deferring it (and the other Auto agents) to Copilot's picker is therefore safe.

## Resolution at runtime

VS Code Copilot defaults to reading the literal `model:` value from frontmatter. However, within ControlFlow, **prompt-driven runtime resolution is active** for subagent dispatch.

When Orchestrator or Planner dispatch a subagent via `agent/runSubagent`, they actively execute model resolution:

1. They load `governance/model-routing.json`.
2. They resolve `runtime_model_mode` from `governance/runtime-policy.json` (`model_dispatch.default_mode`), which now defaults to **auto**; deterministic is the opt-in mode applied to pinned dispatch.
3. They look up the target agent in `agent_role_index`.
4. They apply the `by_tier` complexity rule to determine the required model string. If no `complexity_tier` exists yet, they use the target role's top-level `primary` model rather than omitting model selection.
5. They pass the verified target-agent field as the outer `agentName` parameter.
6. In deterministic mode, they pass the resolved `primary` explicitly as the outer `model` parameter to `agent/runSubagent`, overriding the agent's frontmatter at call time.
7. In auto mode, they intentionally omit the outer `model` parameter so Copilot platform model auto-selection chooses the subagent runtime model.

### Delegation Payload Contract

The schema definition in `schemas/orchestrator.delegation-protocol.schema.json` requires a nested payload-level `runtime_model_mode` marker (`deterministic` or `auto`) and conditionally requires payload-level `model` in deterministic mode. These payload-level fields carry resolved model context for validation, audit, and prompt-visible traceability, but they do not by themselves enforce runtime model selection. The outer tool-call boundary remains authoritative: deterministic mode requires outer `model`, while auto mode intentionally omits it.

While global VS Code Copilot execution (e.g., triggering an agent directly from chat) still relies on the frontmatter fallback, all internal orchestrated pipeline dispatches strictly enforce the logical routing graph dynamically. It is important to note that offline evals do not prove live `runSubagent` execution; we distinguish structural tests and tool/API-shape evidence from real live subagent dispatch (as proven by the existing model override spike).

### Offline Regression Coverage

Structural and behavior evals validate the dispatch contract shape and the prompt-visible routing rules. They intentionally do not claim to observe live `agent/runSubagent` runtime parameters.

Current negative cases are documented in `evals/scenarios/orchestrator-model-resolution.json` and validated by `evals/validate.mjs`, `evals/tests/orchestration-handoff-contract.test.mjs`, and `evals/tests/drift-detection.test.mjs`:

- Missing outer `agentName`, even if a payload/prose target is present.
- Missing outer `model`, even if `agentName` is present.
- Payload-only `model`, where the nested delegation payload carries model context but the outer runtime selector is omitted.
- Auto-mode omission allowance: missing outer `model` is accepted only when `runtime_model_mode` is `auto`.
- Wrong effective review tier, especially unresolved HIGH risk that must route capable-reviewer dispatch through `LARGE`.
- Unconfigured fallback on `model_unavailable`, where retry models must come from the configured fallback list for the same effective tier.
- Omitted model due to missing tier context, where the correct behavior is to use the target role's top-level `primary` model.

## Matrix shape (Stage C/D)

The `by_tier` object describes model overrides based on the complexity tier of the task (`TRIVIAL`, `SMALL`, `MEDIUM`, `LARGE`). Because internal control plane logic resolves this matrix dynamically during subagent dispatch, this is an **active runtime switch** for Orchestrator and Planner.

Each key corresponds to a complexity tier, and its value is either a full override (`{primary, fallbacks, cost_tier, latency_tier}`) or `{inherit_from: "default"}`.

### Resolution Rule

The resolution rule for a given role and tier is:
`resolve(role, tier) = by_tier[tier] === {inherit_from: "default"} ? role.primary/fallbacks : by_tier[tier]`

### Worked Example

For example, a role with an explicit `TRIVIAL` override could use a faster model like Sonnet:

```json
"by_tier": {
  "TRIVIAL": {
    "primary": "Claude 3.5 Sonnet",
    "fallbacks": ["GPT-4o mini"],
    "cost_tier": "low",
    "latency_tier": "fast"
  },
  "LARGE": {
    "inherit_from": "default"
  }
}
```

At `LARGE` complexity, it inherits the role default. The current `capable-planner`
configuration does not define a `TRIVIAL` override; it inherits the same ordered
fallback chain at every complexity tier.

## Stage D (forward pointer)

The prompt-driven runtime resolution module (Orchestrator/Planner dynamic lookup) is complete.

Remaining prerequisites for Stage D (auto-tuning observability):

- (a) accumulate ≥50 task telemetry entries via the NDJSON sink at `plans/artifacts/observability/`
- (b) expand `governance/model-routing.json` schema with `inherit_from` targets beyond `"default"` (e.g., other roles or tier mixes)

### Stage C Cross-references

- Phase 1 spike artifact: `plans/artifacts/model-routing-stage-c/phase-1-spike-result.md`
- Validation helper: `evals/drift-checks.mjs` → `validateByTierShape`

## Cost/latency tier meanings

| Tier | `cost_tier` | `latency_tier` |
| --- | --- | --- |
| `low` | Inexpensive per-call; suitable for high-volume read-only or smoke tasks. | Sub-second to a few seconds typical first-token. |
| `medium` | Mid-range per-call; default for implementer and review-readonly work. | A few seconds typical first-token. |
| `high` | Expensive per-call; reserve for planning, deep review, or research. | `slow` — multi-second first-token; long completions expected. |

These tiers are advisory and intended to inform future cost-aware routing (Phase 8+).

## Fallback semantics

The `fallbacks` chain and the `model_unavailable` retry behavior described in this section apply to **pinned/deterministic dispatch only**. Auto agents delegate availability and substitution to Copilot's model picker, so the fallback machinery and the `model_unavailable` failure-classification carve-out are not engaged for them.

`fallbacks` lists alternate models in **preferred order**, used when the `primary` is unavailable (rate-limited, capability-gated, or model removed from Copilot):

- The first fallback is typically a **same-family** alternative (e.g., Claude Sonnet 4.6 → Claude Opus 4.8) preserving prompt compatibility.
- The second is a **cross-family** alternative (e.g., Claude → GPT) accepting potentially larger behavior shifts in exchange for availability.

For the `capable-reviewer` role (used by CodeReviewer, PlanAuditor, and AssumptionVerifier), routing is **tier-aware**. For `TRIVIAL`, `SMALL`, and `MEDIUM` plans, the primary is `Claude Sonnet 4.6` with `GPT-5.4` and `GPT-5.5` as fallbacks (cost_tier: medium). For `LARGE` plans, or when a high-impact unresolved `risk_review` entry forces an effective review tier of `LARGE`, the role default applies: primary is `Claude Opus 4.8` with `GPT-5.5` as first fallback (cost_tier: high). The Orchestrator resolves primary and fallbacks from `governance/model-routing.json` `roles.capable-reviewer.by_tier[<effective_review_tier>]`; it must not use any unconfigured model as a silent substitute, and must escalate to `WAITING_APPROVAL` when all configured models for the effective tier are unavailable. `ExecutabilityVerifier-subagent` is an intentional exception: it uses the `review-readonly` role with `Claude Sonnet 4.6` as primary, regardless of tier.

The tier-aware `capable-reviewer` routing is enforced through the `by_tier` matrix in `governance/model-routing.json`. Generic fallback-list automation (passing an array of fallbacks for runtime execution) is **not** runtime-enforced today and remains future scope. The `fallbacks` list simply documents the intended chain so future routing logic can implement it deterministically without re-deriving safe substitutions. (Note: offline evals structurally validate these contracts but do not constitute live runtime proof of fallback execution.)

## Reasoning Effort Hint (Advisory)

`reasoning_effort_hint` is an **advisory-only** metadata field added per-role as a sibling of `primary`, `fallbacks`, `cost_tier`, `latency_tier`, and `consumers`.

### Allowed values

`low` | `medium` | `high`

### Semantics

- Consumers **MAY** use this hint to bias per-call reasoning effort (e.g., number of thinking tokens, chain-of-thought depth).
- Consumers **MUST** ignore it safely if the value is unrecognized or if the underlying runtime does not support effort control.
- The field is **NOT** passed through the delegation protocol and is **NOT** enforced at runtime.

### Placement

The field lives at the **per-role** level, as a sibling of `primary`, `fallbacks`, `cost_tier`, `latency_tier`, and `consumers`. It is **not** placed inside `by_tier` sub-objects or `consumers` arrays.

```json
"capable-planner": {
  "primary": "...",
  "fallbacks": [...],
  "cost_tier": "high",
  "latency_tier": "slow",
  "consumers": [...],
  "reasoning_effort_hint": "high",
  "by_tier": { ... }
}
```

## Cross-references

- Repository agent-engineering index: `docs/agent-engineering/README.md` (authored in Phase 10).
- Drift detection: `evals/validate.mjs`, `evals/scenarios/model-routing-alignment.json`, and `evals/scenarios/orchestrator-model-resolution.json`.
- Plan: `plans/controlflow-comprehensive-revision-plan.md` Phase 4.
- Spike record: `plans/artifacts/model-resolver/phase-1-spike.md`.
