# ControlFlow for Cursor — Usage

**Version:** 1.0.0

## Plan

Select `controlflow-plan` or invoke the `controlflow-planner` agent. The result is a saved
`plans/<task-slug>-plan.md` artifact.

## Verify

Run `controlflow-verify` before implementation. It performs tier-gated structural,
assumption, and executability checks inline.

## Execute

Use native Cursor Agent mode. ControlFlow does not ship implementation or orchestration
subagents.

## Review

Use native review for the general pass, then `controlflow-review` to compare the aggregate
implementation and test evidence with the approved plan.
