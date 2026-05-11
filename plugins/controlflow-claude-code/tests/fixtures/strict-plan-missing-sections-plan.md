# Plan: Strict Plan Missing Sections Non-Production Test

**Status:** `READY_FOR_EXECUTION`
**Agent:** `Planner`
**Schema Version:** `1.2.0`
**Complexity Tier:** `SMALL`
**Confidence:** `0.90`
**Abstain:** `is_abstaining: false` - reasons: []
**Summary:** Non-production INVALID strict Claude Code plan fixture. Intentionally omits the two trailing lifecycle headings (Outcomes and Idempotence and Recovery) to verify that validate-claude-artifacts.ps1 rejects incomplete plans and reports each missing section. Not intended for execution.

## Context & Analysis

- This is a non-production test fixture for the ControlFlow Claude Code plugin validator.
- It satisfies every required base section checked by validate-claude-artifacts.ps1.
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

### Phase 1 - Fixture Negative Validation

- **Objective:** Confirm that the Claude plugin validator rejects this fixture with actionable messages.
- **Executor Agent:** local
- **Wave:** 1
- **Dependencies:** None.
- **Files:** This file.
- **Tests:** Run validate-claude-artifacts.ps1 with -PlanPath pointing to this file; expect exit non-zero.
- **Acceptance Criteria:** Validator exits non-zero and output names Outcomes and Idempotence and Recovery as missing.
- **Quality Gates:** schema_valid
- **Failure Expectations:** Transient - rerun the validator.
- **Steps:**
  1. Run the validator against this fixture and confirm exit non-zero.

## Inter-Phase Contracts

- **Phase 1 -> End:** Validator exit non-zero confirms this fixture correctly triggers missing-section errors.
- **Format:** Exit code 1 plus FAIL output lines naming the missing lifecycle sections.
- **Validation:** Check $LASTEXITCODE -ne 0 and output mentions Outcomes or Idempotence.

## Open Questions

- None.

## Risks

- None. This is a non-production test fixture.

## Semantic Risk Review

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

- Validator exits non-zero against this fixture (TEST 2).
- Validator output names Outcomes and Idempotence and Recovery as missing sections.

## Handoff

- **Target:** controlflow-orchestration
- **Review Before Execution:** Not required for non-production fixture.
- **Prompt:** Non-production fixture; no handoff required.

## Notes for Orchestration

- This file is a test fixture only. Do not execute as a real plan.
- Used by plugins/controlflow-claude-code/tests/validate-claude-artifacts.test.ps1 (TEST 2).

## Progress

- Fixture created as part of Phase 5 Claude Code plugin validator (trace: b7c4e2a1-3d9f-4b8e-a5c6-1f2e8d4a7b3c).
- Base sections all present; two trailing lifecycle headings intentionally omitted.

## Discoveries

- Omitting Outcomes and Idempotence and Recovery is sufficient to trigger the validator's lifecycle check failure.
- The validator reports each missing section individually with an actionable FAIL message.

## Decision Log

- Two trailing lifecycle sections omitted to verify the validator catches incomplete lifecycle blocks.
- Progress and Discoveries included so the first three lifecycle sections do not mask the missing ones.
