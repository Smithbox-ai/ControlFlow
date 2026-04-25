# Model Routing

**Status:** Phase 4 spike (single-agent rollout)
**File:** `governance/model-routing.json`
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
|---|---|
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

### Control-Plane Premium Pinning

While internal subagent dispatch resolves models dynamically, top-level user entry points (handling the initial chat request) execute using the literal `model:` frontmatter value. The operating mode ensures premium requests are spent on agents that decide quality at the control plane:

- `Planner` is pinned to `GPT-5.5` so plan quality, decomposition, and risk framing use the strongest available planning model.
- `CodeReviewer`, `PlanAuditor`, and `AssumptionVerifier` rely on premium adversarial reviewers (`Claude Opus 4.7`).
- `ExecutabilityVerifier`, `Orchestrator`, and the implementation agents typically resolve to cheaper defaults (`Claude Sonnet 4.6`, `GPT-5.4`, `GPT-5.4 mini`, `Gemini 3.1 Pro`) to contain premium usage.

This yields a pragmatic split:
- Premium tokens are spent on planning and on finding flaws.
- Routine orchestration and implementation stay cheaper, managed through dynamic subagent dispatch logic.



During the rollout window, agents add a `model_role:` line to their frontmatter **alongside** the existing `model:` line:

```yaml
---
description: '...'
tools: [...]
model: GPT-5.4 mini (copilot)
model_role: browser-testing
---
```

Both lines coexist. The `model:` line is what VS Code Copilot currently consumes; `model_role:` is the logical-layer indirection validated by evals.

## Resolution at runtime

VS Code Copilot defaults to reading the literal `model:` value from frontmatter. However, within ControlFlow, **prompt-driven runtime resolution is active** for subagent dispatch. 

When Orchestrator or Planner dispatch a subagent via `agent/runSubagent`, they actively execute model resolution:
1. They load `governance/model-routing.json`.
2. They look up the target agent in `agent_role_index`.
3. They apply the `by_tier` complexity rule to determine the required model string.
4. They pass the resolved `primary` model explicitly as the `model` parameter to `agent/runSubagent`, overriding the agent's frontmatter at call time.

While global VS Code Copilot execution (e.g., triggering an agent directly from chat) still relies on the frontmatter fallback, all internal orchestrated pipeline dispatches strictly enforce the logical routing graph dynamically.

## Matrix shape (Stage C/D)

The `by_tier` object describes model overrides based on the complexity tier of the task (`TRIVIAL`, `SMALL`, `MEDIUM`, `LARGE`). Because internal control plane logic resolves this matrix dynamically during subagent dispatch, this is an **active runtime switch** for Orchestrator and Planner.

Each key corresponds to a complexity tier, and its value is either a full override (`{primary, fallbacks, cost_tier, latency_tier}`) or `{inherit_from: "default"}`.

### Resolution Rule

The resolution rule for a given role and tier is:
`resolve(role, tier) = by_tier[tier] === {inherit_from: "default"} ? role.primary/fallbacks : by_tier[tier]`

### Worked Example

For example, `capable-planner` at `TRIVIAL` complexity might use a faster model like Sonnet:
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
At `LARGE` complexity, it inherits the default (which might be Opus).

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
|---|---|---|
| `low` | Inexpensive per-call; suitable for high-volume read-only or smoke tasks. | Sub-second to a few seconds typical first-token. |
| `medium` | Mid-range per-call; default for implementer and review-readonly work. | A few seconds typical first-token. |
| `high` | Expensive per-call; reserve for planning, deep review, or research. | `slow` — multi-second first-token; long completions expected. |

These tiers are advisory and intended to inform future cost-aware routing (Phase 8+).

## Fallback semantics

`fallbacks` lists alternate models in **preferred order**, used when the `primary` is unavailable (rate-limited, capability-gated, or model removed from Copilot):

- The first fallback is typically a **same-family** alternative (e.g., Claude Sonnet 4.6 → Claude Opus 4.7) preserving prompt compatibility.
- The second is a **cross-family** alternative (e.g., Claude → GPT) accepting potentially larger behavior shifts in exchange for availability.

Fallback resolution is **not** runtime-enforced today; the list documents the intended chain so future routing logic can implement it deterministically without re-deriving safe substitutions.

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
- Drift detection: `evals/validate.mjs` and the upcoming `evals/scenarios/model-routing-alignment.json`.
- Plan: `plans/controlflow-comprehensive-revision-plan.md` Phase 4.
- Spike record: `plans/artifacts/model-resolver/phase-1-spike.md`.
