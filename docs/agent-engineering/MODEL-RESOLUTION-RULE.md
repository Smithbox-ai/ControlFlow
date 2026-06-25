# Universal Model Resolution Rule

Authoritative source for the Universal Model Resolution Rule referenced by Orchestrator. The runtime model is selected by this rule, governed by `governance/model-routing.json` and `governance/runtime-policy.json#model_dispatch`.

### Universal Model Resolution Rule (Mandatory — All Dispatches)
Before every `agent/runSubagent` call, regardless of dispatch context, apply this rule:
1. Load `governance/model-routing.json`.
2. Load `governance/runtime-policy.json` and resolve `runtime_model_mode` from per-dispatch override when present, else `model_dispatch.default_mode` (now defaults to `auto`; deterministic is the opt-in mode used for pinned dispatch).
3. Set payload marker `runtime_model_mode` on every delegation payload for auditability and mode-consistency checks.
4. Look up the target agent name in the top-level `agent_role_index` map to get its role.
5. Read `roles[role].by_tier[complexity_tier]`. If the entry is `{ "inherit_from": "default" }`, use the role's top-level `primary` model; otherwise use the tier-specific `primary`.
6. Pass the exact target as the outer `agentName` parameter to `agent/runSubagent`.
7. **Deterministic mode (opt-in, used for pinned dispatch):** pass the resolved `primary` model string as the outer `model` parameter to `agent/runSubagent`. Never omit outer `model` in deterministic mode.
8. **Auto mode:** omit the outer `model` parameter so Copilot platform auto-selection can choose the runtime model. Keep payload-level `model` optional in this mode and rely on `runtime_model_mode: auto` marker for contract semantics and audits.
9. For initial planning dispatches before any plan `complexity_tier` exists: deterministic mode uses the target role's top-level `primary` model; auto mode still omits outer `model`. Missing tier context changes the resolution source (deterministic) or preserves omission (auto), not the mode contract.

This rule covers all dispatch paths without exception: Plan Review Gate reviewers (PlanAuditor, AssumptionVerifier, ExecutabilityVerifier), phase CodeReviewer dispatch, final CodeReviewer dispatch, failure-classification retry dispatch, needs_replan Planner dispatch, and Implementation Loop executor dispatch.

## See also

- [governance/model-routing.json](governance/model-routing.json)
- [governance/runtime-policy.json](governance/runtime-policy.json)
- [docs/agent-engineering/TOOL-ROUTING.md](TOOL-ROUTING.md)
