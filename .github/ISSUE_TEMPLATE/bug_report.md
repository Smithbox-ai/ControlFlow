---
name: Bug Report
about: Report incorrect agent behavior, eval failures, or contract violations
title: "[Bug] "
labels: bug
---

## Describe the Bug
A clear description of what went wrong.

## Component Involved
Which ControlFlow component exhibited the issue? (e.g., `@controlflow-planner` agent, or the `controlflow-plan` / `controlflow-verify` / `controlflow-review` skill)

## Steps to Reproduce
1. Invoked `@controlflow-planner` (or ran a ControlFlow skill) with: "..."
2. ...
3. Observed: ...

## Expected Behavior
What should have happened instead.

## Eval Suite Result
```bash
cd evals && npm test
```
Did the eval suite pass? Paste the summary line (`Total: X | Passed: X | Failed: X`).

## Environment
- VS Code version:
- OS:
- Copilot extension version:
