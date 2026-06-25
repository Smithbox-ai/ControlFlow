# Failure Taxonomy

Use bounded failure labels so a stalled phase does not devolve into vague chatter.

## transient

- Meaning: the same scope may succeed on retry
- Examples: flaky command, temporary lock, intermittent tool failure
- Default action: retry with the same scope, but do not exceed the configured budget

## fixable

- Meaning: the phase is basically sound but needs one targeted correction
- Examples: missing import, wrong flag, bad path, failing assertion with obvious cause
- Default action: retry once with a fix hint

### Diagnosis Packet

Before a fixable retry on non-trivial work, record reproduction steps, the smallest affected component, the root-cause hypothesis, and what will change in the next attempt. Do not repeat an unchanged attempt.

## needs_replan

- Meaning: the local design is no longer valid
- Examples: wrong file ownership, bad architecture assumption, dependency contract changed
- Default action: replan the affected phase, not the entire project, unless scope really changed

## escalate

- Meaning: continuing without human input is unsafe or misleading
- Examples: destructive ambiguity, security concern, unclear data migration, approval-gated branch action
- Default action: stop and ask the user

## Transient Wave Throttling

When transient failures in one wave reach the configured threshold, reduce parallelism for later waves by the configured factor. Throttling does not change phase scope or bypass approval.
