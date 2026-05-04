# Changelog

All notable changes to the `controlflow-codex` plugin are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-05-04

### Added

- Five required lifecycle sections for non-trivial strict Codex plans (SMALL / MEDIUM / LARGE): `## Progress`, `## Discoveries`, `## Decision Log`, `## Outcomes`, `## Idempotence & Recovery`. These are a ControlFlow-native adaptation of ExecPlan living-document discipline; they are not a literal import of OpenAI's `PLANS.md` format.
- `plugins/controlflow-codex/skills/controlflow-planning/references/plan-template.md` — five lifecycle sections added after `## Notes for Orchestration`, preserving ControlFlow section order and the no-fenced-code-block rule.
- `plugins/controlflow-codex/scripts/validate-strict-artifacts.ps1` — lifecycle section enforcement for ControlFlow-Codex strict-plan artifacts only. Reports each missing required heading independently before failing. Does not validate core VS Code Planner artifacts.
- `plugins/controlflow-codex/tests/fixtures/strict-plan-lifecycle-valid-plan.md` — non-production valid strict Codex plan fixture containing every validator-required base section plus all five lifecycle headings.
- `plugins/controlflow-codex/tests/fixtures/strict-plan-lifecycle-missing-sections-plan.md` — non-production invalid strict Codex plan fixture that intentionally omits the two trailing lifecycle headings to exercise negative validation.
- `plugins/controlflow-codex/tests/validate-strict-artifacts.test.ps1` — test harness: positive test confirms the valid fixture passes, negative test confirms the invalid fixture fails for missing lifecycle sections. Uses the same fixed five-heading lifecycle list as the template, validator, and fixtures.

### Changed

- `controlflow-planning/SKILL.md` — step 7 added: require the fixed five lifecycle sections for non-trivial Codex plans with exact heading names and order. Subsequent steps renumbered.
- `controlflow-strict-workflow/SKILL.md` — Completion Gate step 5 added: require lifecycle sections to be current at each phase boundary and at final review.
- `README.md` — added ExecPlan-Compatible Lifecycle Discipline section describing the five headings, their purpose, and clarifying this is a ControlFlow-native adaptation.
- `USAGE.md` — added Russian-language prompt examples for living plans: how to update Progress, Discoveries, Decision Log, Outcomes, and Idempotence and Recovery during execution.

### Notes

- No breaking changes to existing plan artifacts that already satisfy the base section/header set. Existing plans without lifecycle sections will fail the updated validator; add the five headings to bring them into compliance.
- Validator scope remains limited to ControlFlow-Codex strict-plan artifacts. Core VS Code Planner validation is unchanged.
- The five required lifecycle heading names are fixed and canonical. Do not rename or reorder them; the validator, template, and fixtures must remain in sync.

## [0.3.0] - 2026-04-30

### Added

- `scripts/uninstall-home-local.ps1` — reversible removal of the home-local plugin copy and marketplace registration.
- README and USAGE guidance for when to use native Codex directly instead of invoking ControlFlow-Codex, plus artifact lifecycle cleanup notes.
- `controlflow-executability-verifier/references/executability-checklist.md` — extracted the 8-point cold-start checklist, TDD walk-through, and blocker classification table from `SKILL.md` into a proper reference document.
- `controlflow-planning/references/llm-behavior-guidelines.md` — Codex-adapted port of the main project's behavioral guardrails (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution).
- `controlflow-orchestration/references/tdd-patterns.md` — port of the main project's RED -> GREEN -> REFACTOR discipline and test quality signals.
- `controlflow-review/references/security-review-discipline.md` — confidence threshold (>80%), exclusion list, and focus areas for the security-review pass.
- `README.md` — top-level link to the section in the main repository README; skills listed as a table with Codex invocation syntax; explicit installation command block.
- Cross-references between skills so `controlflow-plan-audit`, `controlflow-orchestration`, and `controlflow-review` can load the new behavioral, TDD, and security references.

### Changed

- Plugin manifest wording now emphasizes on-demand use for non-trivial Codex tasks instead of implying that every Codex task needs strict workflow overhead.
- `controlflow-router` now includes a fast-path warning for `TRIVIAL` work.
- `controlflow-executability-verifier/SKILL.md` — workflow steps now point to `references/executability-checklist.md` instead of inlining the checklist.
- Plugin manifest version bumped from `0.2.0` to `0.3.0`.

### Notes

- No breaking changes for existing plan or review artifacts; all template paths and section names are unchanged.
- VS Code-specific governance (`governance/model-routing.json`, `agent-grants.json`, P.A.R.T section validator, eval suite) is intentionally still **not** ported — Codex handles model routing and tool grants natively.

## [0.2.0] - prior

- Strict workflow entry point added (`controlflow-strict-workflow`).
- Pre-execution review pipeline: `controlflow-plan-audit`, `controlflow-assumption-verifier`, `controlflow-executability-verifier`.
- Strict planner output contract and ControlFlow-shaped Markdown plan template.
- Local artifact validator (`scripts/validate-strict-artifacts.ps1`).
- Home-local installer (`scripts/install-home-local.ps1`).

## [0.1.0] - initial

- Initial portable skills: `controlflow-router`, `controlflow-planning`, `controlflow-orchestration`, `controlflow-review`, `controlflow-memory-hygiene`.
- Codex plugin manifest scaffold under `.codex-plugin/plugin.json`.
