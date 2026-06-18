# LLM Behavior Guidelines

Portable ControlFlow guardrails for avoiding common LLM coding anti-patterns. This file
is the plugin-local contract; it must remain useful without VS Code agent mode or the
main ControlFlow prompt set.

## When to Apply

| Skill | Principles |
| ----- | ---------- |
| `controlflow-plan` | Think before coding; goal-driven execution |
| `controlflow-verify` | Think before coding; surgical changes (refute precisely) |
| `controlflow-review` | Simplicity first; surgical changes while auditing |

## Principles

### 1. Think Before Coding

- Do not hide uncertainty. Ask the user when the answer changes scope, behavior,
  architecture, or risk handling.
- Keep assumptions separate from verified facts in plans, specs, and reports.
- When several interpretations are valid, present the tradeoff instead of silently
  choosing.

### 2. Simplicity First

- Build only the requested behavior.
- Apply the Minimum Viable Change Ladder before adding code, phases, dependencies, or abstractions: does this need to exist, can existing project behavior cover it, can the standard library or native platform cover it, can an already-installed dependency cover it, can one localized line or existing helper cover it, and only then write the minimum new code that works.
- Avoid one-use abstractions, speculative configurability, and defensive branches that
  cannot happen under current constraints.
- If the solution is much larger than the task warrants, stop and simplify before
  continuing.
- Do not simplify away trust-boundary validation, data-loss prevention, security,
  accessibility, rollback guidance, or explicitly requested behavior.

### 3. Surgical Changes

- Touch only files and lines tied to the task.
- Do not reformat, rename, or clean adjacent code unless the requested change made it
  necessary.
- Mention unrelated observations in the report instead of editing them.

### 4. Goal-Driven Execution

- Convert every task into observable success criteria: artifact, command, test, review
  gate, or documented skip reason.
- For multi-phase work, keep phase acceptance criteria and quality gates explicit.
- Match verification strength to the completion claim, then state any residual gap.

## Anti-Rationalization Table

| Pattern | Required Action |
| ------- | --------------- |
| Assume a missing requirement because the likely answer seems obvious | Ask when the answer changes scope, behavior, or file set; otherwise record the bounded assumption. |
| Add abstraction because a future task might need it | Build the requested behavior only; record future options separately. |
| Add a dependency or custom helper before checking existing options | Check existing project behavior, standard library, native platform, and already-installed dependency options first. |
| Clean up adjacent code while editing nearby lines | Keep edits tied to task scope and report unrelated observations without changing them. |
| Skip verification because a change is prompt-only or documentation-only | Run the smallest relevant check plus any workflow-required gate. |
| Treat a narrow pass as proof of a broad claim | Match the command to the claim and state what remains unverified. |

## Decision Table

| Situation | Action |
| --------- | ------ |
| Multiple valid task interpretations | Ask the user or record an explicit accepted assumption. |
| Tempted to add an untasked feature | Do not add it; note it as a future option. |
| Adjacent issue noticed | Report it, but do not edit it. |
| Task has no verify criterion | Derive one before implementation. |
| Implementation exceeds about 3x expected size | Stop and present a smaller approach. |
