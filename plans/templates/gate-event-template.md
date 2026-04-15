# Gate Event & Commit Format Reference

## Gate Event Output

When reporting any gate decision, include the fields from `schemas/orchestrator.gate-event.schema.json` as clearly labeled structured text. Do NOT output raw JSON to chat.

## Plan Completion Template

After all phases, produce `<plan-name>-complete.md`:

### Plan Complete: {Task Title}

**Summary:** What was accomplished across all phases.

#### Phases Completed
- ✅ Phase 1 — {Title}
- ✅ Phase 2 — {Title}
- ...

#### All Files Modified
[Complete list]

#### Key Functions/Components
[List of main additions or changes]

#### Test Coverage
[Summary of test additions and results]

#### Recommendations
[Follow-up work or improvements if any]

## Commit Message Format

```
fix|feat|chore|test|refactor: Short description (max 50 chars)

- Bullet point details of the change.
- Additional context if needed.
```

### Commit Rules
- Do NOT reference plan names or phase numbers in commit messages.
- Prefix must be one of: `fix`, `feat`, `chore`, `test`, `refactor`.
- Body bullets are optional but recommended for multi-file changes.
