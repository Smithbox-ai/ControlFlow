# Review Checklist

Review in this order:

1. Does the change violate the intended behavior or the user's request?
2. Could it corrupt data, skip validation, leak access, or break authorization?
3. Could it introduce race conditions, ordering bugs, or state divergence?
4. Does it create performance or scale regressions on likely hot paths?
5. Did the implementation drift away from the plan, contract, or schema?
6. Are tests missing for the riskiest behavior?
7. Are docs, migration notes, or operational steps missing where they should have changed?

## Change Size and Signal

- Treat reviews much larger than roughly 100 changed lines as lower-signal unless the diff is mechanical or tightly scoped.
- Ask for a split when a diff mixes unrelated behaviors, generated output, policy changes, and implementation edits.
- If a large review cannot be split, review by file area and risk axis, then state any confidence limits.

## Stop-the-Line Decision Points

- Halt for security, authorization, secret-handling, destructive-action, or data-integrity defects that could cause harm if the next phase proceeds.
- Halt when verification proves the core behavior is broken or the plan's acceptance criteria are no longer true.
- Halt when a migration, schema, or contract change lacks rollback or compatibility evidence.
- Halt when scope drift makes the completed work impossible to compare to the approved plan.

## Five-Axis Prompts

- Correctness & Functionality: Does the implementation do what was requested, preserve existing behavior, handle edge cases, and avoid regressions?
- Security: Does the change protect authorization, secrets, inputs, data boundaries, and destructive operations?
- Architecture & Design: Does the design fit existing ownership, dependencies, schemas, lifecycle boundaries, and rollback expectations?
- Maintainability & Style: Is the diff simple, localized, idiomatic for the repository, and free of unrelated cleanup?
- Test Quality & Coverage: Do tests prove observable behavior at the right boundary, and does verification evidence support the completion claim?
