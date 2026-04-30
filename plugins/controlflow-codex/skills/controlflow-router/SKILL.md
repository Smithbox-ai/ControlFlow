---
name: controlflow-router
description: "Use when a task broadly matches ControlFlow for Codex and you need to decide whether to start with planning, orchestration, review, or memory hygiene, or whether to combine several of those skills in sequence."
---

# ControlFlow Router

## Overview

Route work to the right ControlFlow-Codex skill instead of loading all of them by default. Use this as the entry point when the user wants "ControlFlow discipline" but has not said which mode is needed first.

## Routing Rules

Start with `controlflow-planning` when:
- the user asks for a plan
- the task is medium or large
- the file scope or architecture is still fuzzy
- the change includes migrations, cross-cutting edits, or explicit risk review

Start with `controlflow-orchestration` when:
- a plan already exists
- the task should be executed in phases
- approvals, retries, or handoff discipline matter
- the user wants structured progress through several steps

Start with `controlflow-review` when:
- the user asks for a review
- there is a diff, patch, PR, or completed phase to inspect
- the highest-value output is bugs, regressions, and validation gaps

Start with `controlflow-memory-hygiene` when:
- the task spans many turns or phases
- repo-persistent notes need cleanup
- the conversation risks relying on stale memory

## Combined Flows

- For a new non-trivial task: `controlflow-planning` -> `controlflow-orchestration`
- For a long-running implementation: `controlflow-memory-hygiene` + `controlflow-orchestration`
- For sign-off after implementation: `controlflow-review`
- For a large or messy task: `controlflow-router` first, then load only the skills that genuinely apply

## Common Mistakes

- Loading every ControlFlow skill up front.
- Starting orchestration before a stable plan exists.
- Using review mode to do planning.
- Treating memory hygiene as a substitute for re-reading the repository.
