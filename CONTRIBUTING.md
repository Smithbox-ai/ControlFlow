# Contributing to ControlFlow

Thank you for your interest in contributing! This guide covers the key contribution paths.

## Table of Contents

- [Running the eval suite](#running-the-eval-suite)
- [Adding a new agent](#adding-a-new-agent)
- [Editing an existing agent](#editing-an-existing-agent)
- [Adding skills](#adding-skills)
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

5. **Register the agent in governance files**:
   - Add it to `governance/agent-grants.json` with its canonical tool grants.
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

## Proposing changes

- **Bug reports and feature requests:** Open a GitHub Issue describing the problem or proposal clearly.
- **Pull requests:** Fork the repository, create a feature branch, and open a PR against `master`.
  - Every PR must pass `cd evals && npm test`.
  - Describe what you changed and why in the PR description.
  - Reference any related Issues.
- **Breaking changes:** Changes to shared governance files (`governance/`, `schemas/`, `.github/copilot-instructions.md`) affect all agents — test thoroughly and call this out explicitly in the PR description.

---

## Code of conduct

Be respectful and constructive. This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) v2.1.
