# ControlFlow-Cursor Usage

## Recommended entry

For non-trivial work in Cursor Agent mode:

```text
Follow the controlflow-strict-workflow skill for this repository task from plan through execution and final review.
```

## Tier routing

| Tier | Pre-execution review |
| ---- | -------------------- |
| TRIVIAL | Optional |
| SMALL | Plan audit |
| MEDIUM | Plan audit + assumption verifier |
| LARGE | Plan audit + assumption + executability verifier |

## Prompt catalog

### Full strict workflow

```text
Follow controlflow-strict-workflow. Task: <description>. Save plan to plans/<slug>-plan.md.
```

### Spec before plan

```text
Follow controlflow-spec to write plans/artifacts/<slug>/spec.md, then controlflow-planning with plan_path=plans/<slug>-plan.md.
```

### Planning only

```text
Follow controlflow-planning to write plans/<slug>-plan.md for: <description>.
```

### Plan audit (Task)

```text
Task(subagent_type="controlflow-plan-auditor", description="Audit plan", prompt="Audit plans/<slug>-plan.md. Tier: MEDIUM. Save findings as structured text for plans/artifacts/<slug>/plan-audit.md. Read templates in plugins/controlflow-cursor/templates/.")
```

### Plan audit (fallback)

```text
Follow controlflow-plan-audit for plans/<slug>-plan.md. Write plans/artifacts/<slug>/plan-audit.md.
```

### Assumption verifier (Task)

```text
Task(subagent_type="controlflow-assumption-verifier", description="Verify assumptions", prompt="Review plans/<slug>-plan.md for mirages and hidden assumptions. Tier: MEDIUM.")
```

### Execute approved plan

```text
Follow controlflow-orchestration for plans/<slug>-plan.md. Delegate implementer phases via Task to controlflow-core-implementer (or matching agent) when available.
```

### Implementation phase (Task)

```text
Task(subagent_type="controlflow-core-implementer", description="Implement phase N", prompt="Execute phase N from plans/<slug>-plan.md. Scope: <files>. Run verification: <command>. Return structured completion report.")
```

### Final review

```text
Task(subagent_type="controlflow-code-reviewer", description="Review implementation", prompt="Review completed work against plans/<slug>-plan.md. Evidence-backed verdict.")
```

## Artifact paths

- Plan: `plans/<task-slug>-plan.md`
- Reviews: `plans/artifacts/<task-slug>/plan-audit.md`, `assumption-verifier.md`, `executability-verifier.md`
- Lifecycle sections in plan: `## Progress`, `## Discoveries`, `## Decision Log`, `## Outcomes`, `## Idempotence & Recovery`

## Install into a consumer repo

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-cursor/scripts/install-project.ps1 -TargetRepo C:\path\to\app
```
