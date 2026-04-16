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
| `capable-reviewer` | CodeReviewer, PlanAuditor |
| `review-readonly` | AssumptionVerifier, ExecutabilityVerifier |
| `browser-testing` | BrowserTester |
| `fast-readonly` | CodeMapper |
| `research-capable` | Researcher |

## How agents opt in

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

VS Code Copilot today reads the literal `model:` value from frontmatter. The `model_role:` key is **not** runtime-enforced. It serves three purposes during this phase:

1. **Logical index.** Documents the intended role classification per agent.
2. **Eval-validated drift detection.** A future eval scenario (`evals/scenarios/model-routing-alignment.json`, gated on the Phase 4 spike verdict) asserts every declared `model_role` resolves to an entry in `governance/model-routing.json` and that its `primary` matches the literal `model:` line.
3. **Migration scaffold.** When VS Code Copilot (or a future runtime shim) gains the ability to resolve logical roles, agents will already be tagged. Full runtime enforcement is a future step gated on (a) the Phase 4 spike result and (b) VS Code Copilot support for the indirection.

## Matrix shape (Stage C)

The `by_tier` object describes model overrides based on the complexity tier of the task (`TRIVIAL`, `SMALL`, `MEDIUM`, `LARGE`). 

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

Stage D is OUT OF SCOPE for the current plan.

Prerequisites for Stage D:
- (a) accumulate ≥50 task telemetry entries via the NDJSON sink at `plans/artifacts/observability/`
- (b) a new runtime resolver module (not yet designed)
- (c) expand `governance/model-routing.json` schema with `inherit_from` targets beyond `"default"` (e.g., other roles or tier mixes)

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

## Cross-references

- Repository agent-engineering index: `docs/agent-engineering/README.md` (authored in Phase 10).
- Drift detection: `evals/validate.mjs` and the upcoming `evals/scenarios/model-routing-alignment.json`.
- Plan: `plans/controlflow-comprehensive-revision-plan.md` Phase 4.
- Spike record: `plans/artifacts/controlflow-revision/phase-4-spike-result.md`.
