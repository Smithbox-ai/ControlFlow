# Chapter 04 — P.A.R.T. Specification

## Why this chapter

Understand the mandatory structure of **every** agent file in ControlFlow. After this chapter you will be able to open any new `*.agent.md` and immediately locate the answer to any question about its behavior, permissions, and contracts.

## What P.A.R.T. Is

**P.A.R.T.** is an acronym for four mandatory sections of an agent file, which must appear in a strictly fixed order:

| Letter | Section | Contains |
|--------|---------|---------|
| **P** | **Prompt** | Mission, scope, contracts, rules, abstention |
| **A** | **Archive** | Continuity, compaction, memory, PreFlect |
| **R** | **Resources** | Canonical docs and schemas |
| **T** | **Tools** | Allowed/disallowed tools, selection rules |

Source: [docs/agent-engineering/PART-SPEC.md](../agent-engineering/PART-SPEC.md).

> **From the specification:** "Agents must keep this exact order. Missing or reordered sections are non-compliant."

Violating the order causes a **drift check failure** in the eval harness (`evals/drift-detection.test.mjs`).

## Why a Fixed Order

- **Predictability** — you open a file and immediately know where to find the mission, the tools, and the skills.
- **Automation** — the drift checker parses structure and validates section presence and order.
- **Security** — the Tools section is always last, making privilege audits easier.
- **Governance alignment** — frontmatter fields and sections are tightly coupled to `governance/agent-grants.json` and `governance/tool-grants.json`.

## Structure of Each Section

### P — Prompt

The heart of the agent file. Contains:

- **Mission** — one sentence fixing the agent's purpose.
- **Scope IN / Scope OUT** — what the agent does / does **not** do.
- **Deterministic Contracts** — references to output schemas.
- **State Machine** (optional, for conductors) — state diagram.
- **Planning vs Acting Split** — hard rule: design and execution must not mix.
- **PreFlect** — mandatory pre-action gate (see below).
- **Approval Gate** — when human approval is required.
- **Clarification Triggers** — when to invoke `vscode/askQuestions`.
- **Delegation Heuristics** (for conductors) — who to delegate to.
- **Abstention Rule** — when to return ABSTAIN instead of guessing.
- **Output Discipline** — structured text, not raw JSON.

### A — Archive

Policies for resilience in long sessions:

- **Context Compaction Policy** — what to keep and what to drop as context limit approaches.
- **Agentic Memory Policy** — where to write (session / task-episodic / repo-persistent).
- **State Tracking** (Orchestrator only) — which fields to hold in working memory.
- **Observability Sink** — where to flush gate-events for tracing.

### R — Resources

A list of **canonical** documents and schemas the agent needs to know:

- Schemas the agent emits or reads.
- Governance docs relevant to its role.
- Plan / project context files.
- Skills it will always use.

This section is **not** an index of the entire repository. Only what the agent uses directly.

### T — Tools

- **Allowed** — which tools the agent may use.
- **Disallowed** — what is explicitly forbidden.
- **Tool Selection Rules** — preference order (e.g., "prefer local search over fetch").
- **External Tool Routing** — rules for `web/fetch`, `vscode/askQuestions`, etc.

Must be **synchronized** with `governance/tool-grants.json` and `governance/agent-grants.json`. The drift checker detects discrepancies.

## Frontmatter

Before the P.A.R.T. sections there is always YAML frontmatter. Required fields:

```yaml
---
description: Brief description of the agent's role
agents: [list of agents this agent may delegate to; empty for non-orchestrators]
tools: [list of MCP tools]
model: GPT-5.5 (copilot)
model_role: capable-planner
---
```

- **`description`** — appears in the VS Code Copilot Chat UI.
- **`tools`** — must match `governance/tool-grants.json` for this agent.
- **`model_role`** — logical role from `governance/model-routing.json` (see [Chapter 10](10-governance.md)).
- **`model`** — required ONLY for pinned agents (Orchestrator, Planner, PlanAuditor, AssumptionVerifier); it is OMITTED for auto (default) agents so Copilot's picker selects the model. When present, it must equal the role's `primary`. The example above is the pinned `capable-planner` case; an auto agent omits `model:` and keeps just its `model_role:` (for example, `model_role: research-capable`).

## Minimal Example

```markdown
---
description: Demo agent that does nothing useful
agents: []
tools: [search/codebase, read/file]
model_role: research-capable
---

You are DemoAgent, a minimal example for tutorial purposes.

<!-- DemoAgent is an auto (default) agent: it omits `model:` so Copilot's picker selects the model. A pinned agent would instead add a matching `model:` line, e.g. `model: GPT-5.5 (copilot)` with `model_role: capable-planner`. -->

## Prompt

### Mission
Read a file and return a one-line summary.

### Scope IN
- File reading.
- Single-line summarization.

### Scope OUT
- Writing files.
- Multi-file analysis.

### Abstention Rule
If the file is binary or empty, return ABSTAIN.

### Output Discipline
Return structured text with fields: file_path, summary, status.

## Archive

### Context Compaction Policy
Drop file content after summarization; keep only the summary.

### Agentic Memory Policy
- Session: store the request.
- Task-episodic: not used.
- Repo-persistent: not used.

## Resources

- `schemas/demo.schema.json` (hypothetical)

## Tools

### Allowed
- `search/codebase`
- `read/file`

### Disallowed
- Any write operation.

### Tool Selection Rules
1. Prefer `search/codebase` for finding the file.
2. Use `read/file` only on resolved paths.
```

## Drift Checks in the Eval Harness

`evals/drift-detection.test.mjs` validates the following on **every** agent file:

| Check | What it catches |
|-------|----------------|
| Section order | Sections P → A → R → T in the correct order. |
| Section presence | All 4 sections are present. |
| Frontmatter completeness | Fields `description`, `tools`, `model_role` are populated; `model` is present only for pinned agents and absent for auto (default) agents. |
| Tools sync | `tools:` frontmatter ↔ `governance/tool-grants.json`. |
| Schema references | Every cited schema exists in `schemas/`. |
| PreFlect presence | Every agent references `skills/patterns/preflect-core.md`. |

This means: whenever you add a new agent or edit an existing one, **always run `cd evals && npm test`**.

## Just-In-Time Loading Principle

Note that the Resources section is not loaded into context automatically. The agent **itself** decides which document to read at the right moment via `read/file`. This conserves context budget significantly.

Similarly, a schema cited in Resources is a contract reference, not content that is embedded in every request. The agent knows the contract exists and reads it when needed.

## Common Mistakes

- **Reordering sections** (e.g., Resources before Archive) → drift fail.
- **Forgetting the PreFlect reference** → violation of [skills/patterns/preflect-core.md](../../skills/patterns/preflect-core.md).
- **Listing a tool in `tools:` frontmatter without registering it in `governance/tool-grants.json`** → desync.
- **Bloating Resources with an index of the whole repository** → wasted tokens; keep the list minimal.
- **Duplicating a canonical spec** in Archive instead of referencing it → diverges on updates.

## Exercises

1. **(beginner)** Open `Researcher-subagent.agent.md`. Find the boundaries of each of the 4 sections. Note the line numbers.
2. **(beginner)** Find the `State Machine` subsection in `Orchestrator.agent.md`. Which section is it in?
3. **(intermediate)** Open `governance/tool-grants.json` and compare `Researcher-subagent` with the `tools:` frontmatter field in `Researcher-subagent.agent.md`. Do they match?
4. **(intermediate)** Read [docs/agent-engineering/PART-SPEC.md](../agent-engineering/PART-SPEC.md) → Compliance Checklist section. How many items does it contain?
5. **(advanced)** Draft on paper a stub for a new agent "LinkChecker-subagent" that validates links in Markdown files. What tools does it need? What schemas? Which PreFlect risk class is most important?

## Review Questions

1. Expand P.A.R.T. and state the section order.
2. What happens if you swap Archive and Resources?
3. Where is the mandatory pre-action PreFlect gate described?
4. Why is the Resources section short rather than a full repository index?
5. Which governance file is synchronized with the `tools:` frontmatter field?

## See Also

- [Chapter 03 — Agent Roster](03-agent-roster.md)
- [Chapter 09 — Schemas](09-schemas.md)
- [Chapter 10 — Governance](10-governance.md)
- [docs/agent-engineering/PART-SPEC.md](../agent-engineering/PART-SPEC.md)
