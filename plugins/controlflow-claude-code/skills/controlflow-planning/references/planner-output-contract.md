# Planner Output Contract

Use this strict contract when writing plan artifacts in Claude Code sessions.

## Default Save Path

- `plans/<task-slug>-plan.md`

## Required Header

Every plan must open with these fields:

- Status
- Agent (label: controlflow-planning)
- Schema Version (1.2.0)
- Complexity Tier
- Confidence (0.0-1.0)
- Abstain (is_abstaining: false or true with reasons)
- Summary (one paragraph)

## Allowed Status Values

- `READY_FOR_EXECUTION`
- `ABSTAIN`
- `REPLAN_REQUIRED`

## Review Pipeline Before Execution

Invoke these skills after saving the plan and before starting implementation:

- TRIVIAL: may execute directly if the user did not request a formal review
- SMALL: run `/controlflow-claude-code:controlflow-plan-audit`
- MEDIUM: run plan-audit and `/controlflow-claude-code:controlflow-assumption-verifier`
- LARGE: run plan-audit, assumption-verifier, and `/controlflow-claude-code:controlflow-executability-verifier`
- Unresolved HIGH semantic risk: always include assumption-verifier regardless of tier

## Non-Negotiables

- Do not inline the entire plan in chat when a file artifact is required.
- Do not skip any of the 7 semantic risk categories in the Semantic Risk Review section.
- Do not mark a plan READY_FOR_EXECUTION when confidence is below 0.9.
- Do not claim evidence that has not been verified in the repository.
- Do not start implementation before the required review skills have returned APPROVED or PASS.

## Artifact Naming

- Plans: `plans/<task-slug>-plan.md`
- Research packets: `plans/artifacts/<task-slug>/research-packet.md`
- Audit reports: `plans/artifacts/<task-slug>/plan-audit.md`
- Assumption reports: `plans/artifacts/<task-slug>/assumption-verifier.md`
- Executability reports: `plans/artifacts/<task-slug>/executability-verifier.md`
