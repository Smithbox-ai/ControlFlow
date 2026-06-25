# Bundled Plan Format Fallback

Use this contract when the active repository does not provide
`schemas/planner.plan.schema.json` and `plans/templates/plan-document-template.md`.
Repository-local canonical files take precedence when they exist.

## Header

- `Status`: `READY_FOR_EXECUTION`, `ABSTAIN`, or `REPLAN_REQUIRED`
- `Agent`: `Planner`
- `Schema Version`: `1.2.0`
- `Complexity Tier`: `TRIVIAL`, `SMALL`, `MEDIUM`, or `LARGE`
- `Confidence`: numeric `0.0–1.0`
- `Abstain`: boolean state plus reasons when true
- `Summary`: one concise paragraph

## Required Main Sections

1. `## Context & Analysis`
2. `## Design Decisions`
3. `## Implementation Phases`
4. `## Inter-Phase Contracts`
5. `## Open Questions`
6. `## Risks`
7. `## Semantic Risk Review`
8. `## Success Criteria`
9. `## Handoff`
10. `## Notes for Execution`

## Phase Shape

Each phase includes:

- objective
- one executor role label
- wave and dependencies
- concrete files and actions
- tests and exact commands
- measurable acceptance criteria
- quality gates from `tests_pass`, `lint_clean`, `schema_valid`, `safety_clear`,
  `human_approved_if_required`
- failure expectations with `transient`, `fixable`, `needs_replan`, or `escalate`
- numbered prose steps

Executor role labels remain portable planning metadata. They do not imply that the Codex
plugin ships custom agents.

## Semantic Risk Review

Include every category exactly once:

- `data_volume`
- `performance`
- `concurrency`
- `access_control`
- `migration_rollback`
- `dependency`
- `operability`

Each row records applicability, impact, evidence source, and disposition. A
`not_applicable` row still requires evidence or justification.

## Living-Document Sections

For non-trivial plans, append these exact headings in this order:

1. `## Progress`
2. `## Discoveries`
3. `## Decision Log`
4. `## Outcomes`
5. `## Idempotence & Recovery`

## Diagram Rules

- Plans with three or more phases include a compact `flowchart TD` dependency DAG.
- `LARGE` plans also include a compact `sequenceDiagram`.
- `MEDIUM` plans add a sequence diagram when orchestration is non-trivial.
- Keep each Mermaid source at or below 30 lines.

## Hard Rules

- No fenced code blocks inside plan artifacts.
- No manual-only verification.
- Prefer 3–10 incremental phases.
- Handoff points to the saved artifact path instead of inlining the plan in chat.
- Non-ready outcomes use a short terminal structure: resolved scope, blockers, missing
  evidence, recovery next step, and partial semantic-risk items.
