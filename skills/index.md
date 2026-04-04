# Skill Library Index

## Purpose
Reusable domain-specific patterns for agent consumption. Prometheus selects relevant skills during planning and includes them as `skill_references` in phase definitions. Implementation agents load referenced skills before starting work.

## Discovery Protocol
1. Prometheus reads this index during planning (Step 0.8 — after Complexity Gate).
2. Match task domain keywords against the Domain column below.
3. Select ≤3 most relevant skills based on task context.
4. Include selected skill file paths in each applicable phase's `skill_references` array.
5. Implementation agents read referenced skill files before executing phase tasks.

## Domain Mapping

| Domain | Skill File | Applicable Agents | Keywords |
|--------|-----------|-------------------|----------|
| Testing | `skills/patterns/tdd-patterns.md` | Sisyphus, Frontend-Engineer, Code-Review | test, TDD, coverage, assertion, spec |
| Error Handling | `skills/patterns/error-handling-patterns.md` | Sisyphus, Frontend-Engineer, DevOps | error, exception, retry, fallback, boundary |
| Security | `skills/patterns/security-patterns.md` | Sisyphus, Frontend-Engineer, Code-Review, Challenger | auth, input validation, injection, XSS, CSRF, secrets |
| Performance | `skills/patterns/performance-patterns.md` | Sisyphus, Frontend-Engineer, Code-Review, Challenger | query, N+1, pagination, cache, batch, index |
| Completeness | `skills/patterns/completeness-traceability.md` | Prometheus, Challenger, Code-Review | requirements, coverage, traceability, orphan, RTM, scope |
| Integration | `skills/patterns/integration-validator.md` | Prometheus, Challenger, Sisyphus | dependency, contract, interface, collision, compatibility, wave |
| Idea-to-Prompt | `skills/patterns/idea-to-prompt.md` | Prometheus | idea, vague, abstract, brainstorm, concept, interview |

## Loading Protocol
- **Planning phase:** Prometheus includes `skill_references: ["skills/patterns/<domain>.md"]` in phase definition.
- **Execution phase:** Implementation agent reads each referenced skill file via `read/readFile` before starting work.
- **Review phase:** Code-Review and Challenger reference applicable skills when evaluating implementation quality.

## Adding New Skills
1. Create a new pattern file in `skills/patterns/`.
2. Add an entry to the Domain Mapping table above.
3. Run `evals/validate.mjs` to verify consistency.
