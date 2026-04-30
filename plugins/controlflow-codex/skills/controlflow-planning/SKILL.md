---
name: controlflow-planning
description: "Use when a repository change needs an explicit implementation plan before coding, especially for medium or large scope, ambiguous requirements, cross-file edits, risky migrations, or multi-phase work that benefits from phased tasks, validation steps, and risk review."
---

# ControlFlow Planning

## Overview

Turn a fuzzy or risky coding request into a durable, execution-ready plan for Codex. This skill adapts the strongest planning ideas from ControlFlow while stripping out VS Code Copilot-specific runtime assumptions.

## Workflow

1. Decide whether formal planning is justified. Use this skill when the change spans more than 2-3 files, touches multiple subsystems, includes meaningful rollback risk, or the user explicitly asks for a plan. Skip heavy planning for tiny, isolated edits.
2. Clarify only when the answer changes file scope, user-visible behavior, or architecture. Otherwise state the assumption and keep moving.
3. Map the likely files, tests, commands, and dependencies before writing phases. Read the codebase first; do not plan from memory.
4. Read [references/complexity-tiers.md](references/complexity-tiers.md) and [references/semantic-risk-taxonomy.md](references/semantic-risk-taxonomy.md). Assign a tier and record which risk categories are actually in play.
5. Save the plan as a durable artifact before implementation whenever the task is `MEDIUM` or `LARGE`, or when the user explicitly asked for a plan. Prefer a repo-local path such as `plans/`, `docs/`, or a user-requested location.
6. Use [references/plan-template.md](references/plan-template.md) to structure the artifact. Each phase should include:
   - objective
   - file targets
   - validation command
   - exit criteria
   - open risks or dependencies
7. Add research or spike phases before implementation when a `HIGH`-impact risk is unresolved. Do not bury uncertainty inside a coding phase.
8. Keep phases incremental. Each phase should leave the repo in a verifiable state, not a half-wired one.
9. Before leaving planning mode, sanity-check the plan against [references/controlflow-portability.md](references/controlflow-portability.md) so you do not depend on VS Code-specific agent/tool assumptions that Codex cannot honor directly.

## Output Rules

- Prefer structured text over raw JSON.
- Name the active owner for each phase: `local`, `subagent`, or a concrete future executor description.
- Include the exact verification command when known. If unknown, say what still needs discovery.
- Record assumptions separately from verified facts.

## Common Mistakes

- Writing a phase list before understanding the current file map.
- Treating every large task as sequential when some phases are independent.
- Folding unresolved research into implementation.
- Copying ControlFlow schemas or P.A.R.T prompt structure verbatim into Codex-oriented plans.

## References

- `references/plan-template.md`
- `references/complexity-tiers.md`
- `references/semantic-risk-taxonomy.md`
- `references/controlflow-portability.md`
