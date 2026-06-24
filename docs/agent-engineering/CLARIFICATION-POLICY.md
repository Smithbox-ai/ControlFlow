# Clarification Policy

## Purpose

Define when clarification must be requested vs. when a reasonable assumption should be recorded and the work should proceed. In the slim Copilot-first model, clarification happens at two layers:

1. **Planning time — the Planner handles ambiguity.** `@controlflow-planner` (`.github/agents/controlflow-planner.agent.md`) runs an Idea Interview when the request is vague, asking only the questions whose answers change scope, behavior, architecture, or destructive-risk handling. The Planner is the sole shipped ControlFlow agent that asks clarifying questions.
2. **Mid-execution — native Copilot handles it.** During phase execution, native Copilot's native approvals / ask-questions surface handles clarification. ControlFlow does not ship an orchestration conductor that intercepts `NEEDS_INPUT` — the retired Orchestrator role is gone. If a mid-execution blocker requires a replan, native Copilot re-invokes the Planner.

The `clarification-request.schema.json` contract remains as documentation of the structured clarification shape the Planner (and any custom agent you add) uses when presenting options.

## Ownership

- **Planner (`@controlflow-planner`):** runs the Idea Interview at planning time. Presents 2–3 concrete options with architecture implications, affected files, and a recommended option. This is the only shipped ControlFlow surface that asks clarifying questions.
- **Native Copilot (mid-execution):** handles clarification during phase execution via its native approvals / ask-questions surface. ControlFlow does not intercept this.
- **Custom agents you add under `.github/agents/`:** may ask clarifying questions via native Copilot approvals. Follow the Planner's pattern (concrete options, affected files, recommendation).

The retired Orchestrator role previously acted as the conductor that extracted `NEEDS_INPUT` from acting subagents and re-presented it to the user. That conductor is gone; mid-execution clarification is native Copilot's job.

## Mandatory clarification classes

The following ambiguity classes REQUIRE clarification before proceeding (the Planner enforces these at planning time):

### 1. Scope ambiguity

- The request could be interpreted as two or more materially different scopes.
- Example: "refactor the auth module" — does this mean the API layer, the database layer, or both?

### 2. Architecture fork

- The task requires choosing between two or more architectural approaches with different trade-offs.
- Example: centralized vs distributed state management; monolith vs microservice split.

### 3. User preference decision

- The choice affects user experience, naming conventions, or workflow style with no objectively correct answer.
- Example: tabs vs spaces in a new project; which UI framework to use.

### 4. Destructive-risk approval

- The action is destructive or irreversible and affects shared resources.
- Example: dropping a database table; force-pushing to main; deleting production config.

### 5. Repository structure change

- The change alters the project's directory structure, build system, or dependency management approach.
- Example: moving from monorepo to multi-repo; changing package manager.

## Non-clarification cases (do NOT ask)

- Questions answerable by reading the codebase.
- Implementation details with a single obviously correct approach.
- Style decisions already covered by existing linting/formatting config.
- Cases where all options have equivalent outcomes.

## Clarification format

### Planner (Idea Interview)

Present **2–3 concrete options** with:

- Architecture implications for each option.
- Affected files/components.
- Recommended option with rationale.

Stop the interview once the remaining unknowns can be recorded as bounded assumptions without changing scope. Do not over-interview a clear request — record a bounded assumption and move on.

### Structured clarification request (contract documentation)

When a clarification is recorded as a structured object (for plan artifacts or custom agents), the shape is defined by `schemas/clarification-request.schema.json`:

- `options`: 2–3 concrete options, each with `pros`, `cons`, and `affected_files`.
- `impact_analysis`: what changes if the wrong option is chosen.
- `recommended_option`: the recommended option identifier (e.g., `"A"`).
- `recommended_option_rationale`: explanation of why that option is preferred.

This schema is contract documentation and an eval fixture reference — it is not a runtime-validated inter-agent message in the slim model. Native Copilot surfaces the options to the user via its native approvals/ask-questions UI; the user's selection flows back into the plan or the executing phase.

## Threshold rule

Clarification is mandatory ONLY when the ambiguity would **materially change the output** (different files modified, different architecture, different user-facing behavior). If all options lead to equivalent outcomes, make a reasonable assumption, record it as a bounded assumption in the plan, and proceed.

## Mid-execution clarification and replan

If a blocker surfaces during execution that the plan did not anticipate:

1. Native Copilot surfaces the question via its native approvals/ask-questions surface.
2. If the answer fits within the current plan's scope, native Copilot proceeds.
3. If the answer changes scope, architecture, or destructive-risk handling, re-invoke `@controlflow-planner` for a targeted replan. The Planner updates the plan artifact and the verify gate re-runs.

There is no retired Orchestrator in this loop — the Planner and native Copilot cover it directly.

## See also

- `.github/agents/controlflow-planner.agent.md` — the Planner's Idea Interview.
- `schemas/clarification-request.schema.json` — the structured clarification contract (documentation).
- [`PROMPT-BEHAVIOR-CONTRACT.md`](PROMPT-BEHAVIOR-CONTRACT.md) — evidence discipline and abstention invariants.
- [`NATIVE-DELEGATION-BOUNDARY.md`](NATIVE-DELEGATION-BOUNDARY.md) — which capabilities ControlFlow delegates to native Copilot.