# Contributing to ControlFlow

Thank you for your interest in contributing! This guide covers the key contribution paths for the slim Copilot-first model: one `@controlflow-planner` agent and three skills (`controlflow-plan`, `controlflow-verify`, `controlflow-review`) layered over native Copilot.

## Table of Contents

- [Contributing to ControlFlow](#contributing-to-controlflow)
  - [Table of Contents](#table-of-contents)
  - [Running the eval suite](#running-the-eval-suite)
  - [Adding or editing a skill](#adding-or-editing-a-skill)
  - [Editing the planner agent](#editing-the-planner-agent)
  - [Adding skills library patterns](#adding-skills-library-patterns)
  - [Adding or modifying eval scenarios and validator passes](#adding-or-modifying-eval-scenarios-and-validator-passes)
  - [Editing governance configuration (`governance/*.json`)](#editing-governance-configuration-governancejson)
  - [Editing schemas (`schemas/*.json`)](#editing-schemas-schemasjson)
  - [Contributing to plugins](#contributing-to-plugins)
  - [Proposing changes](#proposing-changes)
  - [Code of conduct](#code-of-conduct)

---

## Running the eval suite

The eval suite is the canonical offline quality gate. It validates schema compliance, skill frontmatter, behavioral invariants, drift checks (including the `plans/project-context.md` ↔ `governance/project-context-registry.json` mirror and the `CLAUDE.md` ↔ plan-contract drift), NOTES.md hygiene, archive behavior, and structural fingerprint coverage — without invoking live agents.

```bash
cd evals
npm install
npm test
```

All checks must pass before any PR can be merged. The suite runs fully offline.

For a faster structural-only pass:

```bash
npm run test:structural
```

For behavioral regressions only:

```bash
npm run test:behavior
```

The cache at `evals/.cache/` may mask failures after structural edits — delete it (`rm -rf evals/.cache`) and re-run before trusting a green result.

---

## Adding or editing a skill

The three shipped skills live at `.github/skills/controlflow-{plan,verify,review}/SKILL.md`.

1. **Edit the SKILL.md** — keep the frontmatter (`name` + `description`) valid. The eval suite validates skill frontmatter.
2. **Update eval scenarios** in `evals/scenarios/` if the skill's contract shape changes.
3. **Update `plans/project-context.md`** if the slim surface changed (the tier-gated workflow table, the role matrix, or the canonical source matrix).
4. **Run the full eval suite** and fix any failures before opening a PR.

Do not add shipped subagents — the slim model has none. Execution, tool access, and model selection are delegated to native Copilot. Conceptual role labels (CodeMapper-subagent, Researcher-subagent, etc. in `plans/project-context.md`) name roles the Planner assigns in plan phases and `controlflow-verify` performs inline; they are not shipped agent files.

---

## Editing the planner agent

The single shipped agent lives at `.github/agents/controlflow-planner.agent.md`.

1. Read the current agent file carefully. Understand the plan-format contract and the tier-gated workflow before making changes.
2. Keep it a Copilot agent prompt — do **not** add a `model:` frontmatter key (the Copilot Auto model picker selects the model).
3. Run `cd evals && npm test` **before and after** your edit to confirm no regressions.
4. If you change plan-output contracts (status values, required fields, failure classifications), update `schemas/planner.plan.schema.json` and any eval scenarios that assert those fields, and update `CLAUDE.md` to match — `evals/tests/controlflow-contract-drift.test.mjs` asserts the three stay aligned.

---

## Adding skills library patterns

Skills-library patterns are reusable domain snippets the Planner may reference per phase. They live in `skills/patterns/*.md`.

1. Create `skills/patterns/<topic>.md` following the style of existing patterns. Keep each file ≤100 lines (Pass 15 (2/4) enforces).
2. Register the new file in `skills/index.md`.
3. Run `cd evals && npm test` — the skill-discoverability suite validates that every `skills/patterns/` file is registered in the index and every index entry resolves to a real file.

---

## Adding or modifying eval scenarios and validator passes

The eval suite is the only verification gate (`cd evals && npm test`).

1. Scenario fixtures live in `evals/scenarios/`; add or edit the fixture that exercises the behavior, validated against the matching schema in `schemas/`.
2. Validator passes live in `evals/validate.mjs` (structural/schema/drift) and drift checks in `evals/drift-checks.mjs`. Add a pass only when an existing one cannot express the contract; keep new passes offline and network-free.
3. Run `cd evals && npm test` (or the faster `test:structural` / `test:behavior`) and confirm green before opening a PR. See `evals/README.md` for pass descriptions.

---

## Editing governance configuration (`governance/*.json`)

1. `runtime-policy.json` — slimmed to three blocks: `review_pipeline_by_tier`, `semantic_risk_policy`, `verdict_routing`. Do not re-add retired blocks (plan-review gate trigger conditions, retry budgets, compaction knobs, etc. — those are delegated to native Copilot in the slim model). `evals/tests/controlflow-contract-drift.test.mjs` asserts `verdict_routing.confidence_thresholds.ready_for_execution_min` against `CLAUDE.md`.
2. `project-context-registry.json` — the executor/review/matrix roster. Edit it first, then mirror the change into the `plans/project-context.md` tables (Phase Executor Agents, Review Pipeline Agents, Agent Role Matrix) — Pass 14 (`validateProjectContextRegistryMirror`) enforces a row-for-row mirror. Preserve the 8 executor names; they are the `schemas/planner.plan.schema.json` `executor_agent` enum (cross-source drift guard).
3. `canonical-source-matrix.json` — the canonical ownership map. Its `entries[]` must each have a matching row in the `plans/project-context.md` Canonical Source Matrix table (Pass 14 enforces).
4. `rename-allowlist.json` — generation hygiene. Every `active_artifacts` non-glob entry must exist on disk (the allowlist sweep enforces).
5. Run `cd evals && npm test` after any governance edit to catch drift — changes here affect the whole contract surface.

---

## Editing schemas (`schemas/*.json`)

1. `schemas/planner.plan.schema.json` is the immutable plan-format contract. Its `agent` const (`Planner`), `schema_version` const (`1.2.0`), and `executor_agent` enum (8 names) are asserted against `CLAUDE.md` and `governance/project-context-registry.json` by `evals/tests/controlflow-contract-drift.test.mjs`. Edit all three sources together.
2. Update consuming skills + eval scenarios when shape changes.
3. Add or update fixtures in `evals/scenarios/`.
4. Run `cd evals && npm test`.

---

## Contributing to plugins

Changes to files under `plugins/controlflow-codex/` and `plugins/controlflow-claude-code/` require their own validation in addition to the repository eval suite:

**For ControlFlow for Codex (`plugins/controlflow-codex/`):**

1. Run the strict artifact validator to ensure contract compliance:

   ```bash
   powershell -ExecutionPolicy Bypass -NoProfile -File plugins/controlflow-codex/scripts/validate-strict-artifacts.ps1 -RepoRoot . -PlanPath plugins/controlflow-codex/tests/fixtures/strict-plan-lifecycle-valid-plan.md
   ```

**For ControlFlow for Claude Code (`plugins/controlflow-claude-code/`):**

The Claude Code plugin is standalone and hand-maintained (it is intentionally NOT generated by the shared-source generator). It carries **3 skills and 0 subagents**; there is no plugin-local artifact validator or test harness.

1. Run the repository eval suite — it covers the claude-code manifest parity (`evals/tests/plugin-manifest-parity.test.mjs`) and the `CLAUDE.md` contract drift anchors (`evals/tests/controlflow-contract-drift.test.mjs`):

   ```bash
   cd evals && npm test
   ```

2. Run the lightweight local checks described in `plugins/controlflow-claude-code/USAGE.md` (manifest JSON parse + skill frontmatter).

3. If the `claude` CLI is installed, validate the manifest:

   ```bash
   cd plugins/controlflow-claude-code && claude plugin validate
   ```

**For the Cursor plugin (`plugins/controlflow-cursor/`):**

1. **Shared source first:** Edit `plugins/controlflow-shared-source/` when changing workflow skills.
2. **Sync:** Run `plugins/controlflow-cursor/scripts/sync-to-dotcursor.ps1 -RepoRoot . -Force` (shared source → plugin, strips Codex `openai.yaml`).
3. **Cursor overrides:** Host-specific text lives in `plugins/controlflow-shared-source/host-overrides/cursor/`.
4. **Agents:** Edit `plugins/controlflow-cursor/agents/` then run the sync script (or `install-project.ps1` for consumer repos).
5. **Contracts:** Update `evals/scenarios/cursor-plugin/*.json` when adding or renaming skills/agents.
6. Run `cd evals && npm test` before declaring done.

Always run `cd evals && npm test` after plugin edits to catch cross-repo drift.

---

## Proposing changes

- **Bug reports and feature requests:** Open a GitHub Issue describing the problem or proposal clearly.
- **Pull requests:** Fork the repository, create a feature branch, and open a PR against `master`.
  - Every PR must pass `cd evals && npm test`.
  - Describe what you changed and why in the PR description.
  - Reference any related Issues.
- **Architecture decisions:** For architecture-significant changes, follow `docs/agent-engineering/ADR-PROCESS.md`.
- **Breaking changes:** Changes to shared governance files (`governance/`, `schemas/`, `.github/copilot-instructions.md`) affect the whole contract surface — test thoroughly and call this out explicitly in the PR description.

---

## Code of conduct

Be respectful and constructive. This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) v2.1.