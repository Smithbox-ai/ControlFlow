# Changelog - ControlFlow for Claude Code

All notable changes to this plugin will be documented here.

Format: Added / Changed / Fixed / Removed per release.

## [0.2.0] - 2026-06-18

### Changed

- Redesigned the plugin from a token-heavy 10-skill / 6-agent model to a lightweight **3-skill / 0-agent** model focused on high-quality plan generation, inline adversarial plan verification, and evidence-backed review layered over the native Claude Code toolset.
- `controlflow-plan` is now schema-sourced: it reads the shared `schemas/planner.plan.schema.json` and `plans/templates/plan-document-template.md` at invoke time instead of carrying a frozen planning body.
- `controlflow-review` is now a thin layer over native `/code-review` / `security-review`: delegates the mechanical/style pass to native review and adds plan-vs-implementation scope drift, evidence discipline, and proactive vulnerability/error search.
- Manifest (`plugin.json`) and marketplace entry bumped to 0.2.0 with an updated description and keywords reflecting the standalone, zero-subagent design.
- Plugin decoupled from the shared-source generator: `claude_code` removed from `generation-manifest.json` targets and from `sync-plugin-assets.ps1` / `validate-generated-assets.ps1` host sets. This plugin is now a standalone, hand-maintained source-of-truth for the Claude Code host; codex and cursor remain generator-managed.
- Repo `CLAUDE.md` slimmed to a routing stub (~64% smaller) that preserves all drift anchors (YAML header with `Agent: Planner` + `Schema Version: 1.2.0`, the "below 0.9" confidence threshold phrase, the 8-agent executor enum sentence, and the 7 semantic-risk categories).

### Added

- `controlflow-verify` skill: three-phase inline adversarial verification (structural audit, assumption/mirage check, executability cold-start) with tier gating and an APPROVED / NEEDS_REVISION / REJECTED verdict; writes `plans/artifacts/<task-slug>/verify-verdict.md`. Adversarial framing and anti-rationalization rules built into the skill so inline verification is not a rubber stamp.
- Reference docs for the new skills: `plan-format.md`, `complexity-tiers.md`, `inline-execution.md`, `llm-behavior-guidelines.md` (plan); `adversarial-framing.md`, `verify-phases.md`, `mirage-patterns.md` (verify); `review-checklist.md`, `validation-status.md`, `evidence-discipline.md`, `security-review-discipline.md` (review).

### Removed

- Nine obsolete skills: `controlflow-router`, `controlflow-spec`, `controlflow-strict-workflow`, `controlflow-planning`, `controlflow-plan-audit`, `controlflow-assumption-verifier`, `controlflow-executability-verifier`, `controlflow-orchestration`, `controlflow-memory-hygiene`.
- Six obsolete plugin agents: `controlflow-code-mapper`, `controlflow-researcher`, `controlflow-plan-auditor`, `controlflow-assumption-verifier-agent`, `controlflow-executability-verifier-agent`, `controlflow-code-reviewer`. The `agents/` directory is gone; verification runs inline.
- Orphaned `host-overrides/claude-code/` override directory (no longer generator-managed).
- V1 plugin-local tooling that encoded the deleted verifier/audit model: the three report templates (`assumption-verifier-report-template.md`, `executability-verifier-report-template.md`, `plan-audit-report-template.md`), the `scripts/validate-claude-artifacts.ps1` validator, and the `tests/` directory (fixtures + `validate-claude-artifacts.test.ps1`). `controlflow-verify` writes a single combined `verify-verdict.md`, so the per-verifier report templates no longer apply. Dependent references updated in lockstep: `plugins/controlflow-shared-source/tests/validate-generated-assets.test.ps1` (TEST 4 removed), `plugins/controlflow-shared-source/README.md` (claude-code dropped from generated-output / host-override lists), `CONTRIBUTING.md` (claude-code section now points to the eval suite + `USAGE.md`), and `docs/architecture-decisions/0002-planner-schema-2.0.0-roadmap.md` (claude-code fixtures dropped from the 2.0.0 migration inventory).

### Notes

- None of the removed tooling was referenced by the repo `evals/` suite or CI (`ci.yml` runs only `cd evals && npm test`, which executes the `.mjs` gate); removal does not affect the eval gate.

## [0.1.0] - 2026-05-11

### Added

- Plugin skeleton under plugins/controlflow-claude-code/
- Manifest at .claude-plugin/plugin.json with name, version, description, author, repository, license, and keywords
- README.md and USAGE.md initial shells
- Report templates: plan-audit-report-template.md, assumption-verifier-report-template.md, executability-verifier-report-template.md
- Planning reference files: plan-template.md, complexity-tiers.md, semantic-risk-taxonomy.md, controlflow-portability.md, planner-output-contract.md
- Skills (Phase 3): ten ControlFlow workflow skills adapted for Claude Code native slash invocation
- Agents (Phase 4): six selected plugin agents for isolated audit, research, and review work (including `controlflow-assumption-verifier-agent` and `controlflow-executability-verifier-agent`)
- Validator and tests (Phase 5): validate-claude-artifacts.ps1, test suite, and fixtures
- Documentation (Phase 6): README.md, USAGE.md, and integrated project docs