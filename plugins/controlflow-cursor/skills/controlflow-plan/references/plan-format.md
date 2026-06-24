# Plan Format Checklist

The authoritative format is **not** this file. It is:

- `schemas/planner.plan.schema.json` — the machine-enforced JSON contract (field names, enums, required keys, LARGE-tier diagram rules).
- `plans/templates/plan-document-template.md` — the human document skeleton (section order, phase shape, lifecycle sections).

Read both at invoke time. Use this checklist only to confirm the artifact conforms.

## YAML header (fenced)

```yaml
Status: READY_FOR_EXECUTION | ABSTAIN | REPLAN_REQUIRED
Agent: Planner
Schema Version: 1.2.0
Complexity Tier: TRIVIAL | SMALL | MEDIUM | LARGE
Confidence: 0.0–1.0 (computed; below 0.9 auto-NEEDS_REVISION)
Abstain: is_abstaining: false or [ true, reasons: [...] ]
Summary: One paragraph describing task and approach
```

## 10 sections, in order

1. Context & Analysis — verified facts only; assumptions separate with bounded scope.
2. Design Decisions (MEDIUM+; for non-trivial orchestration include a `sequenceDiagram` in Temporal Flow).
3. Implementation Phases — 3–10 phases; each: Objective, Executor Agent, Wave, Dependencies, Files, Tests, Acceptance Criteria, Quality Gates, Failure Expectations, Steps.
4. Inter-Phase Contracts (MEDIUM+) — deliverable format + downstream validation.
5. Open Questions.
6. Risks — table: Risk | Impact | Likelihood | Mitigation.
7. Semantic Risk Review — all 7 rows (below).
8. Architecture Visualization (MEDIUM+) — `flowchart TD` DAG; LARGE adds `sequenceDiagram`; each ≤30 lines.
9. Success Criteria — measurable, tied to phase acceptance.
10. Handoff & Execution Notes — target agent, prompt, execution order, parallelization, max parallel agents.

## 5 lifecycle sections (SMALL+; exact order, exact headings)

`## Progress`, `## Discoveries`, `## Decision Log`, `## Outcomes`, `## Idempotence & Recovery` — one evidence-backed sentence per entry.

## Semantic Risk Review — exactly 7 categories, once each

`data_volume`, `performance`, `concurrency`, `access_control`, `migration_rollback`, `dependency`, `operability`.

Each row: Applicability (`applicable` | `not_applicable` | `uncertain`), Impact (`HIGH` | `MEDIUM` | `LOW` | `UNKNOWN`), Evidence Source (file/command/repo), Disposition (`resolved` | `open_question` | `research_phase_added` | `not_applicable`). Never skip — `not_applicable` requires justification.

## Executor Agent enum (one per phase, from the schema)

`CodeMapper-subagent`, `Researcher-subagent`, `CoreImplementer-subagent`, `UIImplementer-subagent`, `PlatformEngineer-subagent`, `TechnicalWriter-subagent`, `BrowserTester-subagent`, `CodeReviewer-subagent`.

## Quality Gates (only these five)

`tests_pass`, `lint_clean`, `schema_valid`, `safety_clear`, `human_approved_if_required`.

## Hard rules

- No code blocks inside the plan body — numbered prose only.
- All verification automatable — no manual testing steps.
- Acceptance criteria include at least one measurable observable outcome per phase.
- Handoff points to the saved artifact path; never inlines the plan in chat.
- For ABSTAIN / REPLAN_REQUIRED, use the template's terminal-outcome structure, not the phase structure.