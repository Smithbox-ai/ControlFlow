# Review Checklist

Review in this order:

1. Does the change violate the intended behavior or user request?
2. Could it corrupt data, skip validation, leak access, or break authorization?
3. Could it introduce race conditions, ordering bugs, or state divergence?
4. Does it create performance or scale regressions on likely hot paths?
5. Did it drift from the plan, contract, schema, or accepted scope?
6. Are tests missing for the riskiest behavior?
7. Are docs, migration notes, or operational steps missing where required?

## Change Size and Signal

- Treat reviews much larger than roughly 100 changed lines as lower-signal unless the diff is mechanical or tightly scoped.
- Ask for a split when a diff mixes unrelated behaviors, generated output, policy changes, and implementation edits.
- If a large review cannot be split, review by file area and risk axis and state confidence limits.

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

## Five-Axis Prompts

- Correctness & Functionality: requested behavior, edge cases, and regressions.
- Security: authorization, secrets, inputs, data boundaries, and destructive operations.
- Architecture & Design: ownership, dependencies, schemas, lifecycle boundaries, and rollback expectations.
- Maintainability & Style: simple, localized, idiomatic, and free of unrelated cleanup.
- Test Quality & Coverage: observable behavior, correct boundary, and evidence matching the completion claim.
