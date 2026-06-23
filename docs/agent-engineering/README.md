# Agent Engineering Governance

Index of governance and engineering policy documents for the slim Copilot-first model. ControlFlow ships one agent (`@controlflow-planner` at `.github/agents/controlflow-planner.agent.md`) and three skills (`.github/skills/controlflow-plan/`, `.github/skills/controlflow-verify/`, `.github/skills/controlflow-review/`) over native Copilot. The documents below record the policies, contracts, and boundaries that govern that surface; the Planner and the skills load the relevant subset on demand.

## Canonical boundary

- [`NATIVE-DELEGATION-BOUNDARY.md`](NATIVE-DELEGATION-BOUNDARY.md) — the canonical native-vs-ControlFlow delegation boundary (table + audit checklist + specialized-agent recreation recipe). Single source of truth for "ControlFlow ships no surface that duplicates a native Copilot capability."

## Core contracts

- [`PART-SPEC.md`](PART-SPEC.md) — agent prompt structure guidance (role, scope, contracts as prose, tools frontmatter, no `model:` by default). The legacy P.A.R.T. mandatory section order is preserved as retired-but-informative history.
- [`PROMPT-BEHAVIOR-CONTRACT.md`](PROMPT-BEHAVIOR-CONTRACT.md) — behavioral invariants complementing the prompt-structure guidance (evidence discipline, follow-through, ABSTAIN, escalation).
- [`CLARIFICATION-POLICY.md`](CLARIFICATION-POLICY.md) — when the Planner asks clarifying questions at planning time (Idea Interview) and how mid-execution clarification is delegated to native Copilot's approvals/ask-questions surface.

## Risk and review

- [`RISK-TAXONOMY.md`](RISK-TAXONOMY.md) — the 7 semantic-risk categories (schema-anchored) and the audit dimensions used by `controlflow-verify` Phase 1.
- [`FINAL-REVIEW-SCOPE.md`](FINAL-REVIEW-SCOPE.md) — scope of the `controlflow-review` final pass over the aggregate diff (plan-vs-implementation scope-drift + evidence + proactive vulnerability search).
- [`AGENT-AS-TOOL.md`](AGENT-AS-TOOL.md) — the conceptual executor-role input contract (`scope`, `context_refs`, `trace_id`) for future MCP/native-tool surfacing. Specification only; no runtime wiring.

## Scoring and migration

- [`SCORING-SPEC.md`](SCORING-SPEC.md) — quantitative scoring reference for reviewers and eval harnesses.
- [`MIGRATION-CORE-FIRST.md`](MIGRATION-CORE-FIRST.md) — the "ship the slim surface first, then layer patterns" migration pattern and its historical migration record.

## Process

- [`ADR-PROCESS.md`](ADR-PROCESS.md) — Architecture Decision Record workflow: when to author an ADR, lifecycle states, and review expectations.
- [`ADR-TEMPLATE.md`](ADR-TEMPLATE.md) — canonical ADR template for recording context, decision, and consequences.

## Memory

- [`MEMORY-ARCHITECTURE.md`](MEMORY-ARCHITECTURE.md) — three-layer memory model: session (volatile) / task-episodic (`plans/artifacts/<task-slug>/`) / repo-persistent (`NOTES.md`).

## Portability and IDE support

The repository contains adaptations of the ControlFlow surface for non-VS Code environments and IDE integrations:

- **Codex CLI**: see `plugins/controlflow-codex/README.md` for the portable skills and artifacts adapter.
- **Claude Code**: see `plugins/controlflow-claude-code/README.md` for the native plugin skills and local development lifecycle.
- **Cursor IDE**: see [`CURSOR-SUPPORT.md`](CURSOR-SUPPORT.md) for the `plugins/controlflow-cursor/` plugin (Project Rules, workflow Skills, agents). Optional CI patterns: [`CURSOR-SDK.md`](CURSOR-SDK.md). The legacy root `.cursor/rules` mirror is retired.

## Retired surfaces (historical reference only)

The following docs were removed when the heavy 13-agent / Orchestrator model was retired in Phase 3. They are not part of the slim surface and must not be cited as live references: the former RELIABILITY-GATES.md, TOOL-ROUTING.md, MODEL-ROUTING.md, and OBSERVABILITY.md. The retired governance/model-routing.json, governance/tool-grants.json, and governance/agent-grants.json knobs are replaced by native Copilot model selection, tool access, and subagent governance. See [`NATIVE-DELEGATION-BOUNDARY.md`](NATIVE-DELEGATION-BOUNDARY.md) for the full retirement rationale.