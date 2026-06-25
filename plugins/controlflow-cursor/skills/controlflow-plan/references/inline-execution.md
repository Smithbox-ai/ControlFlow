# Native Host Execution Boundary

This reference preserves only the execution guidance that is ControlFlow-specific.
It does not restate how the host executes; the host owns live state, parallelism,
sandboxing, approvals, retries, and subagent lifecycle.

## Durable vs Live State

- Use the saved ControlFlow plan for durable scope, acceptance criteria, decisions,
  and recovery. Use native host plan tracking for the current step and next action.
- Update the plan's lifecycle sections (`## Progress`, `## Discoveries`,
  `## Decision Log`, `## Outcomes`, `## Idempotence & Recovery`) at phase boundaries,
  not after every command.

## Resumability

- A resumable plan must identify the next incomplete phase without relying on chat
  history.
- Task-specific evidence belongs under `plans/artifacts/<task-slug>/`.
- Native host memories may help recall preferences, but re-open repository files
  before treating a remembered claim as fact.

## Host Boundary

- The native host owns subagent spawning, waiting, steering, and closure. Use
  subagents only when the user explicitly requests them.
- Diagnose before retrying; replan the affected phase when the correction changes
  files, dependencies, acceptance criteria, phase order, or blast radius.
- The native host requires approval before destructive or gated work; the plan
  records the safety gate, the host enforces it.
