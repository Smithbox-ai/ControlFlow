# CLAUDE.md — ControlFlow for Claude Code

## When to Generate a Plan

Generate a structured plan **before** implementation when the task is MEDIUM/LARGE:

### YAML Header (exact fields — no fence)

```yaml
Status: READY_FOR_EXECUTION | ABSTAIN | REPLAN_REQUIRED
Agent: controlflow-planning
Schema Version: 2.0.0
Complexity Tier: TRIVIAL | SMALL | MEDIUM | LARGE
Confidence: 0.0–1.0 (computed; below 0.87 auto-NEEDS_REVISION)
Abstain: is_abstaining: false or [ true, reasons: [...] ]
Summary: One paragraph describing task and approach
```

### Non-negotiable rules

- Every phase declares exactly one `executor_agent` from: `CodeMapper-subagent`, `Researcher-subagent`, `CoreImplementer-subagent`, `UIImplementer-subagent`, `PlatformEngineer-subagent`, `TechnicalWriter-subagent`
