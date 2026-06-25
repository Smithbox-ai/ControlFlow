# Plan: Lifecycle Fixture Missing Sections Non-Production Test

**Status:** `READY_FOR_EXECUTION`
**Agent:** `Planner`
**Schema Version:** `1.2.0`
**Complexity Tier:** `SMALL`
**Confidence:** `0.90`
**Abstain:** `is_abstaining: false` - reasons: []
**Summary:** Non-production INVALID strict Codex plan fixture. Intentionally omits the two trailing entries of the fixed lifecycle list (Outcomes and Idempotence and Recovery) to verify that the validator rejects incomplete plans and reports each missing section. Not intended for execution.

## Context & Analysis

- This is a non-production test fixture for the ControlFlow-Codex plugin validator.
- It satisfies every required base section/header checked by `validate-strict-artifacts.ps1`.
- It intentionally omits the two trailing headings of the fixed lifecycle list: Outcomes and Idempotence and Recovery.
- The validator must reject this fixture and report both missing lifecycle sections.

## Design Decisions

### Architectural Choices

- Fixture designed to isolate lifecycle-section validation from base-section validation.

### Boundary & Integration Points

- No boundary changes identified.

### Temporal Flow

- Sequential: validator runs against this fixture and exits non-zero.

### Constraints & Trade-offs

- No fenced code blocks are permitted in plan or template artifacts.

## Implementation Phases

### Phase 1 - Negative Validation Pass

- **Objective:** Confirm that the strict-plan validator rejects this fixture for missing lifecycle sections.
- **Owner:** local
- **Wave:** 1
- **Dependencies:** None.
- **Files:** This file.
- **Tests:** Run `validate-strict-artifacts.ps1` with `-PlanPath` pointing to this file.
- **Acceptance Criteria:** Validator exits non-zero and reports missing lifecycle sections.
- **Quality Gates:** `schema_valid`
- **Failure Expectations:** Transient — rerun the validator.
- **Steps:**
  1. Run the validator against this fixture; confirm it fails for missing lifecycle sections.

## Inter-Phase Contracts

- **Phase 1 -> End:** Validator non-zero exit confirms this fixture is correctly rejected.
- **Format:** Exit code non-zero plus error output naming the missing sections.
- **Validation:** Check `$LASTEXITCODE -ne 0`.

## Open Questions

- None.

## Risks

- None. This is a non-production test fixture.

## Semantic Risk Review

Every plan must include all 7 categories exactly once.

| Category | Applicability | Impact | Evidence Source | Disposition |
| --- | --- | --- | --- | --- |
| data_volume | not_applicable | LOW | fixture scope | not_applicable |
| performance | not_applicable | LOW | fixture scope | not_applicable |
| concurrency | not_applicable | LOW | fixture scope | not_applicable |
| access_control | not_applicable | LOW | fixture scope | not_applicable |
| migration_rollback | not_applicable | LOW | fixture scope | not_applicable |
| dependency | not_applicable | LOW | fixture scope | not_applicable |
| operability | not_applicable | LOW | fixture scope | not_applicable |

## Success Criteria

- Validator exits non-zero against this fixture.
- Validator output names the missing lifecycle sections.

## Handoff

- **Target:** `controlflow-orchestration`
- **Review Before Execution:** Not required for non-production fixture.
- **Prompt:** Non-production fixture; no handoff required.

## Notes for Orchestration

- This file is a test fixture only. Do not execute as a real plan.
- Used by `plugins/controlflow-codex/tests/validate-strict-artifacts.test.ps1`.

## Progress

- Fixture created as part of Phase 5 lifecycle section enforcement (trace: 9c04f9fe-111e-4b6e-9d16-1d8b8751a4b3).
- Base sections are present; the two trailing lifecycle headings are deliberately omitted.

## Discoveries

- Omitting the trailing lifecycle sections from an otherwise valid base-section plan is the targeted negative case.

## Decision Log

- Chose to omit the two trailing entries of the fixed lifecycle list to isolate the validator's per-heading reporting.
