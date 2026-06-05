# Plan: Reordered Lifecycle Negative Fixture

**Status:** `READY_FOR_EXECUTION`
**Agent:** `Planner`
**Schema Version:** `1.2.0`
**Complexity Tier:** `SMALL`
**Confidence:** `0.95`

## Context & Analysis

- Negative fixture.

## Design Decisions

- Lifecycle headings are intentionally out of order.

## Implementation Phases

- One fixture-validation phase.

## Inter-Phase Contracts

- None.

## Open Questions

- None.

## Risks

- None.

## Semantic Risk Review

| Category | Applicability | Impact | Evidence Source | Disposition |
| --- | --- | --- | --- | --- |
| operability | not_applicable | LOW | fixture | not_applicable |

## Success Criteria

- Validator rejects this fixture for lifecycle ordering.

## Handoff

- No execution handoff.

## Notes for Orchestration

- Negative test only.

## Discoveries

- Intentionally appears before Progress.

## Progress

- Intentionally appears after Discoveries.

## Decision Log

- Reordered for negative validation.

## Outcomes

- Expected rejection.

## Idempotence & Recovery

- Safe to validate repeatedly.
