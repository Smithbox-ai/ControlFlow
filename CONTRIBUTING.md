# Contributing to ControlFlow

Thank you for your interest in contributing! This guide covers the key contribution paths.

## Table of Contents

- [Contributing to ControlFlow](#contributing-to-controlflow)
  - [Table of Contents](#table-of-contents)
  - [Running the eval suite](#running-the-eval-suite)
  - [Adding a new agent](#adding-a-new-agent)
  - [Editing an existing agent](#editing-an-existing-agent)
  - [Adding skills](#adding-skills)
  - [Adding or modifying eval scenarios and validator passes](#adding-or-modifying-eval-scenarios-and-validator-passes)
  - [Editing governance configuration (`governance/*.json`)](#editing-governance-configuration-governancejson)
  - [Proposing changes](#proposing-changes)
  - [Code of conduct](#code-of-conduct)

---

## Running the eval suite

The eval suite is the canonical offline quality gate. It validates schema compliance, P.A.R.T contract structure, tool grant consistency, behavioral invariants, orchestration handoff discipline, drift checks, NOTES.md hygiene, archive behavior, and structural fingerprint coverage across all 13 agents — without invoking live agents.

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

For behavioral and orchestration regressions only:

```bash
npm run test:behavior
```

---

## Adding a new agent

1. **Create the agent file** at repo root: `<Name>.agent.md` or `<Name>-subagent.agent.md`.

2. **Follow P.A.R.T structure** — every agent file must have exactly these top-level sections in order:
   - `## Prompt` — mission, scope, deterministic output contracts, Non-Negotiable Rules
   - `## Archive` — memory policies, context compaction rules
   - `## Resources` — file references loaded on-demand
   - `## Tools` — allowed/disallowed tools with routing rules

   See `docs/agent-engineering/PART-SPEC.md` for the full specification.

3. **Create a JSON Schema contract** in `schemas/<name>-output.schema.json`. Schema files serve as documentation contracts and eval references.

4. **Add eval scenarios** in `evals/scenarios/` that cover:
   - At least one happy-path execution
   - `ABSTAIN` / `NEEDS_INPUT` / failure classification behavior
   - Tool routing compliance if the agent uses external tools

5. **Register the agent in governance files** (see AGENTS.md §4 editing checklist):
   - Add it to `governance/agent-grants.json` with its canonical agent/tool grants.
   - Add it to `governance/tool-grants.json` when the agent's tool surface changes — the eval suite enforces consistency.
   - Update `governance/runtime-policy.json` and `governance/rename-allowlist.json` where relevant (e.g. review routing/retry knobs or rename permissions).
   - Add it to `plans/project-context.md` (agent roster table).

6. **Update `README.md`**:
   - Add a row to the appropriate agent table (Primary Agents or Specialized Subagents).
   - Update the agent count badge if you bump past 13.

7. **Run the full eval suite** and fix any failures before opening a PR.

---

## Editing an existing agent

1. Read the current agent file carefully. Understand the Non-Negotiable Rules, clarification contract, and tool routing section before making changes.
2. Run `cd evals && npm test` **before and after** your edit to confirm no regressions.
3. If you change output contracts (status values, required fields, failure classifications), update the corresponding schema in `schemas/` and any eval scenarios that assert those fields. `model_unavailable` is a first-class routing classification; PlanAuditor and AssumptionVerifier exclude `transient`, while ExecutabilityVerifier can use all five current values.
4. If you change tool grants in frontmatter, update `governance/agent-grants.json` to match — the eval suite enforces consistency between the two.

---

## Adding skills

Skills are reusable domain pattern snippets that Planner selects per phase and implementation agents load at execution time. They live in `skills/patterns/*.md`.

1. Create `skills/patterns/<topic>.md` following the style of existing patterns.
2. Register the new file in `skills/index.md`.
3. Run `cd evals && npm test` — Pass 5 validates that every `skills/patterns/` file is registered in the index and every index entry resolves to a real file.

For project-wide orchestration audits, prefer `skills/patterns/orchestration-audit-playbook.md` as the audit-specific checklist. It complements the completeness, integration, and LLM behavior skills by focusing on traceability, schema/prompt/grant alignment, hidden-defect triage, validation gates, and phase-boundary memory hygiene.

---

## Adding or modifying eval scenarios and validator passes

The eval suite is the only verification gate (`cd evals && npm test`).

1. Scenario fixtures live in `evals/scenarios/`; add or edit the fixture that exercises the behavior, validated against the matching schema in `schemas/`.
2. Validator passes live in `evals/validate.mjs` (structural/schema/P.A.R.T) and drift checks in `evals/drift-checks.mjs`. Add a pass only when an existing one cannot express the contract; keep new passes offline and network-free.
3. Run `cd evals && npm test` (or the faster `test:structural` / `test:behavior`) and confirm green before opening a PR. See `evals/README.md` for pass descriptions.

---

## Editing governance configuration (`governance/*.json`)

1. Most knobs in `governance/` are referenced by Orchestrator/Planner prompt text — re-read the consumers and update the prompt wording when knob semantics change (per AGENTS.md §4).
2. Keep grants consistent: `governance/agent-grants.json` and `governance/tool-grants.json` are enforced against agent frontmatter by the eval suite.
3. Run `cd evals && npm test` after any governance edit to catch drift — changes here affect all agents.

---

## Contributing to Plugins (Claude Code)

Changes to files under `plugins/controlflow-claude-code/` require their own validation in addition to the repository eval suite:


**For ControlFlow for Claude Code (`plugins/controlflow-claude-code/`):**

The Claude Code plugin is standalone and hand-maintained (it is intentionally NOT generated by the shared-source generator). It carries **3 skills and 0 subagents**; there is no plugin-local artifact validator or test harness.

1. Run the repository eval suite — it covers the claude-code manifest parity (`evals/tests/plugin-manifest-parity.test.mjs`) and the CLAUDE.md contract drift anchors (`evals/tests/controlflow-contract-drift.test.mjs`):

   ```bash
   cd evals && npm test
   ```

2. Run the lightweight local checks described in `plugins/controlflow-claude-code/USAGE.md` (manifest JSON parse + skill frontmatter).

3. If the `claude` CLI is installed, validate the manifest:

   ```bash
   cd plugins/controlflow-claude-code && claude plugin validate
   ```

Always run `cd evals && npm test` after plugin edits to catch cross-repo drift.

---

## Editing Cursor Rules (`.cursor/rules`)

When editing `.cursor/rules`, ensure the following:

1. **Frontmatter is valid:** Check that frontmatter starts with `---`, has a closing `---`, and includes at least one of `alwaysApply`, `description`, or `globs`.
2. **Line budget respected:** Keep rules concise and within 500 lines.
3. **Canonical references:** Point to canonical ControlFlow files (e.g. `.github/copilot-instructions.md`, `plans/project-context.md`) instead of copying policy content.
4. **Run structural validation:** After editing, run `cd evals && npm test` to ensure no project-wide structural contracts were accidentally broken.

## Editing Cursor Plugin (skills, agents, package)

1. **Shared source first:** Edit `plugins/controlflow-shared-source/` when changing workflow skills.
2. **Sync:** Run `plugins/controlflow-cursor/scripts/sync-to-dotcursor.ps1 -RepoRoot . -Force` (shared source → plugin → `.cursor/`, strips Codex `openai.yaml`).
3. **Cursor overrides:** Host-specific text lives in `plugins/controlflow-shared-source/host-overrides/cursor/`.
4. **Subagents:** Edit `plugins/controlflow-cursor/agents/` then run `sync-to-dotcursor.ps1` (or `install-project.ps1` for consumer repos).
5. **Contracts:** Update `evals/scenarios/cursor-plugin/*.json` when adding or renaming skills/agents.
6. **Do not** add VS Code tool grants for Cursor-only surfaces.
7. Run `cd evals && npm test` before declaring done.

---

## Proposing changes

- **Bug reports and feature requests:** Open a GitHub Issue describing the problem or proposal clearly.
- **Pull requests:** Fork the repository, create a feature branch, and open a PR against `master`.
  - Every PR must pass `cd evals && npm test`.
  - Describe what you changed and why in the PR description.
  - Reference any related Issues.
- **Architecture decisions:** For architecture-significant changes, follow `docs/agent-engineering/ADR-PROCESS.md`.
- **Breaking changes:** Changes to shared governance files (`governance/`, `schemas/`, `.github/copilot-instructions.md`) affect all agents — test thoroughly and call this out explicitly in the PR description.

---

## Code of conduct

Be respectful and constructive. This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) v2.1.
