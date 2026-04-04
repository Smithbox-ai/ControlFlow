# Skill Library Index

## Purpose
Reusable domain-specific patterns for agent consumption. Planner selects relevant skills during planning and includes them as `skill_references` in phase definitions. Implementation agents load referenced skills before starting work.

## Discovery Protocol
1. Planner reads this index during planning (Step 5 — after Complexity Gate).
2. Match task domain keywords against the Domain column below.
3. Select ≤3 most relevant skills based on task context.
4. Include selected skill file paths in each applicable phase's `skill_references` array.
5. Implementation agents read referenced skill files before executing phase tasks.

## Domain Mapping

| Domain | Skill File | Applicable Agents | Keywords |
|--------|-----------|-------------------|----------|
| Testing | `skills/patterns/tdd-patterns.md` | CoreImplementer, UIImplementer, CodeReviewer | test, TDD, coverage, assertion, spec |
| Error Handling | `skills/patterns/error-handling-patterns.md` | CoreImplementer, UIImplementer, PlatformEngineer | error, exception, retry, fallback, boundary |
| Security | `skills/patterns/security-patterns.md` | CoreImplementer, UIImplementer, CodeReviewer, PlanAuditor | auth, input validation, injection, XSS, CSRF, secrets |
| Performance | `skills/patterns/performance-patterns.md` | CoreImplementer, UIImplementer, CodeReviewer, PlanAuditor | query, N+1, pagination, cache, batch, index |
| Completeness | `skills/patterns/completeness-traceability.md` | Planner, PlanAuditor, CodeReviewer | requirements, coverage, traceability, orphan, RTM, scope |
| Integration | `skills/patterns/integration-validator.md` | Planner, PlanAuditor, CoreImplementer | dependency, contract, interface, collision, compatibility, wave |
| Idea-to-Prompt | `skills/patterns/idea-to-prompt.md` | Planner | idea, vague, abstract, brainstorm, concept, interview |

## Loading Protocol
- **Planning phase:** Planner includes `skill_references: ["skills/patterns/<domain>.md"]` in phase definition.
- **Execution phase:** Implementation agent reads each referenced skill file via `read/readFile` before starting work.
- **Review phase:** CodeReviewer and PlanAuditor reference applicable skills when evaluating implementation quality.

## Adding New Skills
1. Create a new pattern file in `skills/patterns/`.
2. Add an entry to the Domain Mapping table above.
3. Run `evals/validate.mjs` to verify consistency.
