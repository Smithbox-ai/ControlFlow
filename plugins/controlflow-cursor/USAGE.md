# ControlFlow for Cursor - Usage

**Version:** 1.0.0

Slim ControlFlow plugin for Cursor: 3 skills (`controlflow-plan`, `controlflow-verify`,
`controlflow-review`) and 1 planner agent. 0 verifier subagents.

## Skills

| Skill | Cursor invocation | Purpose |
| --- | --- | --- |
| `controlflow-plan` | `Follow the controlflow-plan skill for this task.` | Generate a plan in the shared ControlFlow format (schema-sourced, tier-gated) |
| `controlflow-verify` | `Follow the controlflow-verify skill on this saved plan.` | Inline adversarial verification (zero subagents); writes `plans/artifacts/<task-slug>/verify-verdict.md` |
| `controlflow-review` | `Follow the controlflow-review skill on the implementation diff.` | Evidence-backed review, layered over native Cursor review |

## Recommended flow (SMALL and above)

```text
Follow the controlflow-plan skill for this task.        # plan -> plans/<task-slug>-plan.md
Follow the controlflow-verify skill on this saved plan. # verdict -> plans/artifacts/<task-slug>/verify-verdict.md
# ... implement ...
Follow the controlflow-review skill on the diff.         # review against the plan
```

Routing for MEDIUM/LARGE tasks lives in the repo `CLAUDE.md`: plan → verify → review.

## Planner agent

`@controlflow-planner` (in `agents/`) produces a saved, schema-conforming plan artifact and
hands execution off to the native Cursor agent. Use it when the request is vague enough to
need an idea interview before planning.

## When to use

- the task is `SMALL` or larger
- the change spans multiple files, phases, or ownership boundaries
- planning, review gates, rollback notes, or durable artifacts would reduce risk

Skip the plugin and prompt Cursor directly for truly `TRIVIAL` work.

## Install into another repo

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-cursor/scripts/install-project.ps1 -TargetRepo C:\path\to\app
```