# Architecture Decision Record

## Title

ADR-0001: Plan Artifact Revision Policy

## Date

2026-05-23

## Status

Proposed

## Context / Problem

When plans need revision during execution, there is ambiguity about whether to modify the plan document in-place, or create a new superseding plan. Furthermore, there is a strict requirement to keep context use low, which means plan artifacts should not contain raw code blocks. We also need standard replan/update payload metadata to trace a plan's evolution effectively.

## Decision

We adopt a dual-mode hybrid plan editing policy. Plans can use one of two revision modes:

1. **In-place update** (`revision_mode: in_place_update`): Minor corrections, phase additions, or small fixes can be edited directly into the active plan.
2. **New artifact supersession** (`revision_mode: new_artifact_supersession`): Major pivot or unrecoverable structural changes require creating a wholly new plan file. The new plan must define `revision_of` pointing to the path of the original superseded plan.

Plans must include an active revision-log matching their lifecycle. All plan handoffs must be **artifact-first**: Planner authors and saves the plan file without fenced code blocks, then hands off the artifact path to a read-only reviewer (`controlflow-verify`) for PLAN_REVIEW. `controlflow-verify` manages the review loop and rollback handling. Planner replan/update payload metadata must include `trace_id` and `iteration_index`.

## Consequences

- **Positive:** Clearer, lightweight artifact-first plan handoffs save context tokens. Dual editing mode balances agility with structural history. Review boundaries explicitly limit the reviewer to read-only while the Planner retains authorship.
- **Negative:** Increased overhead in defining `revision_mode` and maintaining the revision log for minor updates.

## Alternatives Considered

- **Strictly in-place updates:** Rejected because large pivots overwrite historical logic, breaking architectural history.
- **Strictly append-only or new artifacts:** Rejected because minor checks and typo fixes would spam the workspace with unnecessary plan versions.

## Related ADRs

None
