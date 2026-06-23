# Chapter 04 — Agent prompt structure (guidance)

## Why this chapter

ControlFlow no longer ships a fleet of specialized agent files — the slim model ships one agent (`@controlflow-planner` at `.github/agents/controlflow-planner.agent.md`) and delegates execution to native Copilot. But you may still want to **write your own custom agent prompt** under `.github/agents/` (to recreate a specialized persona like a BrowserTester, or to add a project-specific role). This chapter is guidance for writing a good one.

> **History note.** The legacy ControlFlow model enforced a mandatory four-section template called **P.A.R.T.** (Prompt / Archive / Resources / Tools) on every `*.agent.md`. That contract is **retired** — the slim model ships one planner agent and no longer enforces a fixed section order on agent files. The P.A.R.T. discipline (role / scope / contracts / tools as prose) still informs how a good custom agent prompt is written, but it is guidance, not a mandatory template, and the drift checker no longer audits for it.

## Key concepts

- **Custom agent prompt** — a Markdown file under `.github/agents/` with Copilot agent frontmatter (`name`, `description`, `tools`) that Copilot surfaces in the agents dropdown.
- **Role** — one sentence fixing the agent's purpose (the "P" in the old P.A.R.T. acronym).
- **Scope** — what the agent does and does **not** do.
- **Contracts as prose** — output shape and rules written as prose, not as runtime-validated inter-agent messages. In the slim model, schemas are contract documentation + eval fixture references, not runtime-enforced payloads.
- **Tools frontmatter** — the `tools:` array declares which tools the agent may use; there is no tool-access grant file to synchronize against (that governance surface is retired — tool access is delegated to native Copilot).
- **No `model:` by default** — let the Copilot Auto model picker choose. Pin a model only if the role demands it.

## The Worked Example: controlflow-planner.agent.md

The sole shipped ControlFlow agent is the best example to copy from. Open `.github/agents/controlflow-planner.agent.md`. Its structure:

```text
---
description: "ControlFlow Planner — ..."
name: controlflow-planner
tools: ["read", "search", "edit"]
---

# ControlFlow Planner

You are the ControlFlow Planner. ...

## Load the planning skill
## Idea Interview (when the request is vague)
## Write the plan artifact
## Hand off to native Copilot for implementation
## Failure mode
```

Notice what it does **not** have: no `model:` line (the Copilot Auto picker selects), no `agents:` delegation list, no mandatory Archive/Resources/Tools sections, no `model_role:` field, no reference to a tool-access grant file. It is frontmatter plus prose with a handful of clearly labeled sections.

## Frontmatter (required)

Copilot agent frontmatter is the only mandatory part of a custom agent file:

```yaml
---
description: One-line description shown in the Copilot Chat agents dropdown
name: your-agent-name
tools: ["read", "search", "edit"]
---
```

- **`description`** — appears in the VS Code Copilot Chat UI. Write it so a user knows when to pick this agent.
- **`name`** — the identifier used in `@-mention` and the dropdown.
- **`tools`** — the MCP tools the agent may use. Pick the minimal set the role needs (least privilege). There is no tool-access grant file to synchronize with — tool access is delegated to native Copilot.
- **No `model:` by default.** Omit it so the Copilot Auto model picker selects. Pin a model only if the role demands it (rare).

## Writing the Body (guidance, not a template)

The P.A.R.T. discipline (Prompt / Archive / Resources / Tools) is retired as a mandatory order, but the four concerns it captured are still worth covering **as prose, in whatever order reads best for your role**:

| Old P.A.R.T. section | Modern guidance (prose, not mandatory) |
|----------------------|----------------------------------------|
| **P — Prompt** | State the role's mission, scope IN / scope OUT, abstention rule, and output discipline in prose. This is the heart of the file. |
| **A — Archive** | If the role maintains long-session state, describe what to keep vs drop as context limit approaches, and where to write (session / task-episodic / repo-persistent via `NOTES.md`, `plans/artifacts/`, `/memories/repo/`). Omit if not relevant. |
| **R — Resources** | List the `skills/patterns/` paths the role should load just-in-time (the former static binding is now Planner-injected `skill_references`). Keep the list minimal — only what the role uses directly. |
| **T — Tools** | The `tools:` frontmatter covers tool access. If the role has tool-selection rules ("prefer local search over fetch"), write them as prose here. |

There is **no** drift check that enforces section order or presence. The contract-drift eval suite audits the plan format, the role taxonomy, and the governance config — not your custom agent file's section headers.

## Citing Patterns (the modern "Resources")

The legacy specialized agents (BrowserTester, UIImplementer, PlatformEngineer, etc.) had static `Resources` sections binding them to `skills/patterns/` files. In the slim model those agents are retired and their discipline lives in `skills/patterns/`. If you recreate a specialized persona, cite the patterns it should load:

```text
## Resources
- skills/patterns/tdd-patterns.md
- skills/patterns/debugging-discipline.md
- skills/patterns/error-handling-patterns.md
```

The patterns carry the reusable discipline; your agent file carries the persona. See `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md §5` for the full recreation recipe and the worked-examples table mapping retired personas to surviving patterns.

## The Planner Can Assign Your Agent as an executor_role

Once your agent file exists under `.github/agents/`, `@controlflow-planner` can assign it as a phase `executor_agent` (the schema enum already includes the eight canonical role names; if you name your file matching one of them, the Planner can assign that role). Execution is native Copilot's job — your agent file is the persona Copilot loads when the phase runs.

## Common Mistakes

- **Adding a `model:` line by default.** Omit it unless the role demands a pinned model. The Copilot Auto picker is the slim-model default.
- **Duplicating a native Copilot capability in the prompt body.** If your agent re-implements planning, dispatch, code review, or approvals, it violates the delegation boundary (see `NATIVE-DELEGATION-BOUNDARY.md`). Layer over; don't duplicate.
- **Bloating the Resources list with an index of the whole repository.** Keep it minimal — only the `skills/patterns/` the role actually loads.
- **Expecting a drift-check failure for "wrong section order".** P.A.R.T. order is no longer enforced. The drift checker audits the plan format and governance config, not your custom agent's section headers.
- **Synchronizing `tools:` frontmatter against a retired tool-access grant file.** That surface is retired; pick the minimal tool set in frontmatter and move on.
- **Writing contracts as runtime-validated JSON payloads.** In the slim model, schemas are contract documentation + eval fixture references, not inter-agent messages. Describe output shape in prose.

## Exercises

1. **(beginner)** Open `.github/agents/controlflow-planner.agent.md`. Find the three frontmatter fields. Confirm there is no `model:` line.
2. **(beginner)** Read the body. Which "P.A.R.T. concern" (Prompt / Archive / Resources / Tools) is most developed, and which is omitted? Why is the omission acceptable in the slim model?
3. **(intermediate)** Pick a retired persona (e.g. BrowserTester-subagent). Following `NATIVE-DELEGATION-BOUNDARY.md §5`, draft a stub `browser-tester.agent.md` under `.github/agents/` that cites `skills/patterns/tdd-patterns.md`, `skills/patterns/debugging-discipline.md`, and `skills/patterns/error-handling-patterns.md`.
4. **(intermediate)** Why is there no tool-access grant synchronization step when writing a custom agent? Where did tool-access governance go in the slim model?
5. **(advanced)** Draft on paper a stub for a new agent `link-checker` that validates links in Markdown files. What tools does it need? Which `skills/patterns/` should it load? What abstention rule covers "no executable harness supplied"?

## Review Questions

1. What does P.A.R.T. stand for, and why is it now guidance rather than a mandatory template?
2. Which frontmatter fields are required for a Copilot custom agent, and which is omitted by default?
3. Where does tool-access governance live in the slim model, and why is there no tool-access grant file?
4. How does a recreated specialized agent get assigned as a phase executor?
5. Why is the Resources list kept minimal rather than a full repository index?

## See Also

- [Chapter 03 — Role Taxonomy](03-agent-roster.md)
- [Chapter 09 — Schemas](09-schemas.md)
- [Chapter 10 — Governance](10-governance.md)
- [docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](../agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)