# Agent Engineering Governance

Index of governance and engineering policy documents. Each agent loads the relevant subset on demand via its `## Resources` section.

## Core contracts

- [`PART-SPEC.md`](PART-SPEC.md) — P.A.R.T. specification and mandatory section order (**Prompt → Archive → Resources → Tools**) for every agent file.
- [`PROMPT-BEHAVIOR-CONTRACT.md`](PROMPT-BEHAVIOR-CONTRACT.md) — Behavioral invariants complementing P.A.R.T structural rules (evidence discipline, follow-through, ABSTAIN, escalation).
- [`RELIABILITY-GATES.md`](RELIABILITY-GATES.md) — Verification gate requirements (build, tests, lint, approval) shared across all agents.

## Clarification and routing

- [`CLARIFICATION-POLICY.md`](CLARIFICATION-POLICY.md) — When to invoke `vscode/askQuestions` vs. return `NEEDS_INPUT` to the conductor.
- [`TOOL-ROUTING.md`](TOOL-ROUTING.md) — Routing rules for external tools (`fetch`, `githubRepo`, MCP) and local-first precedence.

## Scoring and consolidation

- [`SCORING-SPEC.md`](SCORING-SPEC.md) — Quantitative scoring reference for reviewers and eval harnesses.
- [`MIGRATION-CORE-FIRST.md`](MIGRATION-CORE-FIRST.md) — Shared implementation backbone pattern and consolidation exit criteria.

## Process

- [`ADR-PROCESS.md`](ADR-PROCESS.md) — Architecture Decision Record workflow: when to author an ADR, lifecycle states, and review expectations.
- [`ADR-TEMPLATE.md`](ADR-TEMPLATE.md) — Canonical ADR template for recording context, decision, and consequences.

## Portability & IDE Support

The repository contains adaptations of the ControlFlow system for non-VS Code environments and IDE integrations:

- **Codex CLI**: See `plugins/controlflow-codex/README.md` for the portable skills and artifacts adapter.
- **Claude Code**: See `plugins/controlflow-claude-code/README.md` for the native plugin skills, agents, and local development lifecycle.
- **Cursor IDE**: See [`CURSOR-SUPPORT.md`](CURSOR-SUPPORT.md) for the version-controlled Project Rules surface, activation guidance, limitations, and validation commands. Cursor support does not alter VS Code tool grants or add new executor roles.

## Runtime capabilities (shipped in the ControlFlow revision program)

- [`MODEL-ROUTING.md`](MODEL-ROUTING.md) — Logical model-role indirection backed by `governance/model-routing.json`; actively resolved at runtime by Orchestrator and Planner via `agent/runSubagent`.
- [`OBSERVABILITY.md`](OBSERVABILITY.md) — UUIDv4 `trace_id` propagation across delegation and report schemas; NDJSON event sink convention under `plans/artifacts/observability/` (one file per task).
- [`MEMORY-ARCHITECTURE.md`](MEMORY-ARCHITECTURE.md) — Three-layer memory model: session (volatile) / task-episodic (`plans/artifacts/<task-slug>/`) / repo-persistent (`NOTES.md`).
- [`AGENT-AS-TOOL.md`](AGENT-AS-TOOL.md) — MCP forward-compatible subagent input contract (`scope`, `context_refs`, `trace_id`, `iteration_index`) for future native tool surfacing.
