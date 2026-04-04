# Active Notes

## Current Task

**ControlFlow Rename Migration** — COMPLETE

## Current Phase

All 6 phases complete.

## Phase Status

- Phase 1 ✅ COMPLETE — Rename Ledger (CodeReviewer 95/100)
- Phase 2 ✅ COMPLETE — Fix Current Drift (CodeReviewer 91/100)
- Phase 3 ✅ COMPLETE — Strengthen Rename Safety Checks (CodeReviewer 97/100, 135/135 validator)
- Phase 4 ✅ COMPLETE — Atomic Runtime Rename (25 git mv, all internal refs updated, 135/135)
- Phase 5 ✅ COMPLETE — Active Docs & Residual Sweep (38+ files updated, zero capitalized old names)
- Phase 6 ✅ COMPLETE — Final Verification (135/135 validator, zero old names in active files)

## Scope Boundaries

- Runtime contracts, active docs/templates, and package metadata are in scope
- Historical plans/audits remain historical records and should receive migration notes instead of narrative rewrites
- Repository slug change is out of scope for this migration; defer until after in-repo rename is validated

## Plan Assumptions

- Canonical names: ControlFlow, Orchestrator, Planner, PlanAuditor, AssumptionVerifier, ExecutabilityVerifier, CoreImplementer, UIImplementer, PlatformEngineer, CodeReviewer, Researcher, CodeMapper, TechnicalWriter, BrowserTester
- Validator hardening must precede any repository-wide rename wave
- Historical/attribution exceptions must be machine-bounded before leftover-name sweeps are enabled

## Unresolved Questions

- Whether the repository slug itself should be renamed after the in-repo migration lands
- Whether legal/copyright text should keep Orchestrator branding or follow the active project label after migration

## Plan File

`plans/review-and-rename-plan.revised.md` — 6 phases, sequential execution with pre-rename safety gates

## Pending Approvals

- **Phase 4 approval required** — Atomic Runtime Rename is a HIGH_RISK_APPROVAL_GATE (bulk file renames, schema renames, all 37 eval scenarios updated). Requires explicit user confirmation before CoreImplementer-subagent is dispatched.
