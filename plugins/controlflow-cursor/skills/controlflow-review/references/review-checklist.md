# Review Checklist

This checklist covers the ControlFlow-specific layer: plan conformance,
over-engineering, and aggregate scope reconciliation. Native host review (Codex
`/review`) owns general correctness, style, security, and size-signal mechanics;
consume its results rather than repeating them.

## Over-Engineering Pass

- After correctness, security, data integrity, and scope checks, ask what can delete, inline, or replace with a standard library or native platform feature.
- Flag one-use abstractions, speculative configuration, wrappers with no policy value, and new dependencies that an already-installed dependency or platform primitive covers.
- Treat over-engineering as a maintainability signal. Block only when it creates real review, behavior, test, dependency, or operability risk; otherwise report it as a non-blocking simplification opportunity.

## Stop-the-Line Decision Points

Halt for security, authorization, secret-handling, destructive-action, or data-integrity defects; failed core behavior or acceptance criteria; migration/schema/contract changes without rollback or compatibility evidence; or scope drift that prevents comparison to the approved plan.

## Final Aggregate Review

### Out-of-Scope Reconciliation

- Compare every aggregate changed path and behavior to the approved phases.
- Classify each difference as approved follow-through, justified deviation, or blocking scope drift.

### Novelty Filter

- Compare final findings with prior phase findings.
- Mark recurring findings as regressions and report only genuinely new findings as novel.
- Re-check verified items affected by later revisions.
