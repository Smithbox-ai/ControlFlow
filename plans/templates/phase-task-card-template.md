# Phase Task Card Template

Use this as the compact executor payload for each implementation, documentation, platform, or test phase.

## Phase Task Card: Phase {N} - {Title}

**Task ID:** {task-id}
**Phase ID:** {phase-id}
**Executor Agent:** {executor}
**Resource Profile:** default | small_local

### Objective

- One-screen objective for this phase.

### Allowed Files

- Exact files or directories the executor may modify.

### Forbidden Areas

- Files, directories, behaviors, or contracts that must not change.

### Context Artifacts

- Spec, research brief, code context pack, or context packet paths to read first.

### Validation Commands

- Exact automated checks for this phase.

### Acceptance Checks

- Observable done conditions.

### Budgets

- Max changed files, max files to read before replan, and any active resource cap.

### Escalation Rule

- When to return `NEEDS_INPUT`, `needs_replan`, or `escalate` instead of continuing.
