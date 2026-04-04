# Clarification Policy

## Purpose
Define when agents must ask for user clarification vs making reasonable assumptions.

## Ownership
- **askQuestions owners:** Planner, Orchestrator.
- **Acting subagents** (CoreImplementer, UIImplementer, PlatformEngineer, TechnicalWriter, BrowserTester): Return structured `NEEDS_INPUT` status with `clarification_request` to the conductor (Orchestrator). Do not attempt direct user interaction.
- **Read-only agents** (Researcher, CodeMapper): Do not expose `NEEDS_INPUT`. Return only `COMPLETE` or `ABSTAIN`. Surface insufficient evidence in findings, not clarification requests.

## Mandatory Clarification Classes

The following ambiguity classes REQUIRE user clarification before proceeding:

### 1. Scope Ambiguity
- The request could be interpreted as two or more materially different scopes.
- Example: "refactor the auth module" — does this mean the API layer, the database layer, or both?

### 2. Architecture Fork
- The task requires choosing between two or more architectural approaches with different trade-offs.
- Example: centralized vs distributed state management; monolith vs microservice split.

### 3. User Preference Decision
- The choice affects user experience, naming conventions, or workflow style with no objectively correct answer.
- Example: tabs vs spaces in a new project; which UI framework to use.

### 4. Destructive-Risk Approval
- The action is destructive or irreversible and affects shared resources.
- Example: dropping a database table; force-pushing to main; deleting production config.

### 5. Repository Structure Change
- The change alters the project's directory structure, build system, or dependency management approach.
- Example: moving from monorepo to multi-repo; changing package manager.

## Non-Clarification Cases (Do NOT Ask)

- Questions answerable by reading the codebase.
- Implementation details with a single obviously correct approach.
- Style decisions already covered by existing linting/formatting config.
- Cases where all options have equivalent outcomes.

## Clarification Format

### For agents with askQuestions (Planner, Orchestrator):
Present **2–3 concrete options** with:
- Architecture implications for each option.
- Affected files/components.
- Recommended option with rationale.

### For agents without askQuestions (all subagents):
Return `NEEDS_INPUT` status with `clarification_request` object:
```json
{
  "options": [
    {
      "id": "A",
      "description": "Option description",
      "pros": ["..."],
      "cons": ["..."],
      "affected_files": ["..."]
    }
  ],
  "impact_analysis": "What changes if wrong option is chosen",
  "recommended_option": "A"
}
```
Orchestrator will extract this and present to the user via `askQuestions`.

## Threshold Rule
Clarification is mandatory ONLY when the ambiguity would **materially change the output** (different files modified, different architecture, different user-facing behavior). If all options lead to equivalent outcomes, make a reasonable assumption and proceed.

## Subagent Clarification Handoff

When a subagent's status would be `NEEDS_INPUT`, return a structured `clarification_request` in the execution report. Required fields:
- `options`: 2–3 concrete options, each with pros, cons, and `affected_files`.
- `impact_analysis`: what changes if the wrong option is chosen.
- `recommended_option`: the agent’s recommendation with rationale.

Orchestrator extracts this and calls `vscode/askQuestions`, then retries with the user’s selection. Full contract: `schemas/clarification-request.schema.json`. Do not attempt direct user interaction.
