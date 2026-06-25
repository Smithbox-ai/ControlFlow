# LLM Behavior Guidelines

Portable ControlFlow guardrails for avoiding common coding-agent anti-patterns.

## When to Apply

| Skill | Principles |
| ----- | ---------- |
| `controlflow-plan` | Think before coding; goal-driven execution |
| `controlflow-verify` | Think before coding; surgical refutation |
| `controlflow-review` | Simplicity first; evidence-backed review |

## Think Before Coding

- Do not hide uncertainty. Ask when the answer changes scope, behavior, architecture, or
  risk handling.
- Keep assumptions separate from verified facts.
- Present material trade-offs instead of silently choosing.

## Simplicity First

- Build only the requested behavior.
- Apply the Minimum Viable Change Ladder before adding code, phases, dependencies, or
  abstractions: check existing project behavior, the standard library or native platform,
  an already-installed dependency, and one localized line or existing helper before
  writing new machinery.
- Avoid one-use abstractions, speculative configuration, and impossible defensive paths.
- Do not simplify away security, data-loss prevention, accessibility, rollback, or
  explicitly requested behavior.

## Surgical Changes

- Touch only files and lines tied to the task.
- Do not clean adjacent code unless the requested change makes it necessary.
- Report unrelated observations without editing them.

## Goal-Driven Execution

- Convert the task into observable artifacts, commands, tests, review gates, or documented
  skip reasons.
- Match verification strength to the completion claim.

## Preserve Business Intent in Code Documentation

- Before completing an implementation phase, review changed code for non-obvious business
  rules, invariants, exceptions, constraints, and decision rationale that future
  maintainers would not recover safely from syntax alone. Explain why the behavior exists
  or what business condition it protects; do not narrate the code.
- For new or materially changed public or extensible symbols that need API documentation,
  use the language/ecosystem-native format and the project's existing level of detail (for
  example, XML documentation comments in C#, docstrings in Python, or JSDoc/TSDoc in
  JavaScript/TypeScript).
- Match the natural language of the nearest existing code documentation: prefer the same
  symbol or type, then the current file/module, then the project's primary documentation
  language. If no reliable convention exists, use concise English. Do not mix languages
  within one local documentation block or translate unrelated comments unless requested.
- Do not add comments by quota or boilerplate documentation for self-explanatory code.
  Update nearby documentation only when the implementation change makes it inaccurate.

## Anti-Rationalization

| Pattern | Required Action |
| ------- | --------------- |
| Assume a missing requirement | Ask if it changes scope; otherwise record a bounded assumption. |
| Add future-proof abstraction | Build only accepted scope and record future options separately. |
| Add dependency before checking native options | Check project behavior, standard library, native platform, and installed dependencies first. |
| Clean adjacent code | Keep the edit surgical and report the observation. |
| Skip verification for prompt or docs changes | Run the smallest relevant automated check plus required gates. |
| Treat a narrow pass as broad proof | State exactly what was and was not verified. |
