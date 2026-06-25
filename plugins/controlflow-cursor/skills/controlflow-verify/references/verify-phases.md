# Verify Phases

## Phase 1 — Structural Audit

1. Referenced files, paths, tests, and commands are real.
2. Objectives are clear and same-wave write ownership does not overlap.
3. Acceptance criteria are measurable.
4. Verification commands run without guessing.
5. Destructive or migration-heavy work has recovery and the correct safety gate.
6. Dependencies and external contracts are verified or explicitly uncertain.
7. The Minimum Viable Change Ladder was applied before any new abstraction, new dependency,
   or generated surface.
8. The first phases can start without hidden context.
9. Every requested outcome is implemented by a phase.
10. Security, access-control, and operability risks have proportional gates.

## Phase 2 — Assumption and Mirage Check

Apply `mirage-patterns.md` to every factual claim. Verify presence claims and search for
missing error, validation, cleanup, migration, and security requirements. Unknown is
`uncertain`, never an automatic pass.

## Phase 3 — Cold-Start Executability

For the first relevant phases confirm:

- what is being changed
- exact location
- approach and preserved behavior
- required inputs
- expected outputs
- dependencies
- runnable verification command
- concrete test behavior

Simulate opening the file, reading the existing pattern, writing a failing test, running
it, implementing the minimum change, rerunning tests, and refactoring. Stop at the first
hard blocker and record it.
