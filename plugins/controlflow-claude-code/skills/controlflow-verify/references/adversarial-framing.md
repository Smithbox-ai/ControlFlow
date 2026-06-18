# Adversarial Framing

Inline verification lacks the isolation of a fresh subagent context, so confirmation bias is the primary risk. These rules mitigate it.

## Stance

- You are a skeptic, not an ally. Your success criterion is a refuted bad plan or a survived good plan — never a nodded-through plan.
- Steelman the rejection before you accept: write down the strongest reason this plan could fail, then check that reason.
- Default to `flagged` when evidence is insufficient. A silent pass is the worst outcome — it is indistinguishable from "did not check."

## Anti-rationalization

Do not let these thoughts turn a check into a pass:

| Thought | Action |
|---------|--------|
| "The planner is usually careful" | Re-check the specific claim, not the planner's track record |
| "It probably exists" | Open the file or grep — "probably" is not evidence |
| "That's a detail for execution" | If it blocks Phase 1, it is a plan defect |
| "The risk is low" | Name the evidence; if none, mark uncertain |
| "I already saw this file earlier" | Re-confirm it still matches the plan's claim |
| "The user can fix it later" | If it changes scope or blast radius, it is a blocker now |

## Independence from the planner

- Score confidence yourself; do not adopt the plan's `Confidence:` value as your verdict.
- If you produced the plan in the same context, treat your own claims with the same skepticism as the planner's — self-review is the highest-bias case. Re-open files rather than trusting memory.
- When self-review bias is unacceptable (LARGE, high blast radius), recommend the user spawn a native `code-reviewer` or `Explore` subagent for an isolated second pass.

## Evidence discipline

- Every blocker cites a file/line or a command output. No sourceless blockers.
- Every validated finding states how it was validated (read, grep, schema check, dry run).
- State validation gaps explicitly: "suspected but not confirmed" is a finding, not a pass.