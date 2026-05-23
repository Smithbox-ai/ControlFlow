# Architecture Decision Records (ADRs)

## Purpose

ControlFlow uses Architecture Decision Records (ADRs) to capture and preserve the context and rationale for architecture-significant decisions. ADRs ensure that future contributors understand *why* a particular technical path was chosen, independent of the implementation details.

## Trigger Conditions

An ADR is required when a plan or task introduces any of the following architecture-significant decisions:

- Introducing a new agent.
- Restructuring agent prompts (e.g., modifying the P.A.R.T. structural requirements).
- Changing governance configuration schemas or policies.
- Modifying schema contracts.
- Modifying cross-cutting plugin architecture.
- Making a breaking change to the eval-harness.

## Required Minimum Field Set

ADRs must strictly adhere to the `ADR-TEMPLATE.md` format. They must include exactly the following fields:

- **Title**
- **Date**
- **Status** (Proposed | Accepted | Superseded)
- **Context / Problem**
- **Decision**
- **Consequences**
- **Alternatives Considered**
- **Related ADRs**

## Storage Convention

ADRs are stored as individual append-only records in the `docs/architecture-decisions/` directory using the naming format `NNNN-kebab-title.md` (where `NNNN` is a zero-padded sequential number, e.g., `0001-initial-architecture.md`). The directory will be created when the first ADR is written. Unlike active plans which undergo `in_place_update` revisions, ADRs preserve historical context.

## Status Lifecycle

1. **Proposed**: The decision is drafted and under review along with the associated plan or PR.
2. **Accepted**: The decision has been approved and is being implemented or has been implemented.
3. **Superseded**: The decision is no longer active and has been replaced by a newer decision (accompanied by a link to the superseding ADR, following a `new_artifact_supersession` model).

## Review Expectations

ADRs must accompany the plan or pull request that introduces the architecture-significant decision. Reviewers must confirm that all required fields are complete and that the rationale is clearly explained.

## Anti-Pattern Note

ADRs are *not* changelogs. They should capture the **decision and its rationale**, not the low-level implementation steps. Focus on the *why*, rather than the *how*.
