## What does this PR do?
Brief description of the change.

## Related Issue
Closes #

## Type of Change
- [ ] Bug fix
- [ ] New skill or agent prompt
- [ ] Skill/agent prompt or contract modification
- [ ] Schema change
- [ ] Governance/policy update
- [ ] Eval scenario addition
- [ ] Documentation

## Verification
- [ ] `cd evals && npm test` passes (full offline suite)
- [ ] `npm run test:structural` passes
- [ ] `npm run test:behavior` passes
- [ ] No broken references (F8 integrity)

## Checklist
- [ ] `.github/skills/controlflow-{plan,verify,review}/` frontmatter (name + description) valid if a skill changed
- [ ] `.github/agents/controlflow-planner.agent.md` updated if the planner changed
- [ ] `plans/project-context.md` updated if the slim surface changed
- [ ] `skills/index.md` updated if a pattern was added/modified
- [ ] CHANGELOG.md updated
