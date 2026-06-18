# Inline Execution Notes

How execution treats an approved plan. This is the folded orchestration discipline — no plugin subagents are spawned by default.

## Default: execute inline in the main context

Keep immediate blocking work in the current conversation context. Run phases in the main context unless delegation has clear benefit and the user asks for it. The `executor_agent` field is an authoritative per-phase role label; in Claude Code it is fulfilled inline, not by spawning a plugin subagent.

## Waves and parallelism

- Phases in the same wave may run in parallel only when write ownership is clearly disjoint; otherwise serialize.
- Wave N+1 waits for wave N to complete.
- `max_parallel_agents` defaults to 10; reduce for resource-intensive phases. In inline mode this caps concurrent background work, not subagent spawns.

## Context packet

For MEDIUM/LARGE plans, a compact context packet (research digest, code-context pack, phase task card) may be written to `plans/artifacts/<task-slug>/` so a resuming executor reconstructs phase context without live session memory. Refresh it after each completed wave.

## Gates and stop-the-line

- Run each phase's acceptance criteria and quality gates before advancing.
- Stop the phase before the next when verification fails, an assumption proves false, a security/data/contract risk appears, or required approval is missing.
- Retry only with a recorded diagnosis; replan the affected phase when the fix changes files, dependencies, acceptance criteria, phase order, or blast radius.

## Optional delegation (escape hatch)

When a fresh-context review or isolated search is wanted, spawn a native Claude Code subagent (`code-reviewer`, `Explore`, or `Plan`) manually. This is the user's explicit choice, not the default. ControlFlow keeps no plugin subagents of its own.

## Restartability

A well-structured plan file is its own cold-start reference: read it, find the next incomplete phase by its acceptance criteria, and continue. Keep phase steps as prose that stays accurate after earlier phases complete.