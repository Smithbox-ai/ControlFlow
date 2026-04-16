## What does this PR do?
Brief description of the change.

## Related Issue
Closes #

## Type of Change
- [ ] Bug fix
- [ ] New agent or skill
- [ ] Agent prompt/contract modification
- [ ] Schema change
- [ ] Governance/policy update
- [ ] Eval scenario addition
- [ ] Documentation

## Verification
- [ ] `cd evals && npm test` passes (all 370+ checks)
- [ ] `npm run test:structural` passes
- [ ] `npm run test:behavior` passes
- [ ] No broken references (F8 integrity)

## Checklist
- [ ] P.A.R.T section order maintained (Prompt → Archive → Resources → Tools)
- [ ] Tool grants updated in `governance/tool-grants.json` if agent tools changed
- [ ] Agent grants updated in `governance/agent-grants.json` if delegation changed
- [ ] `plans/project-context.md` updated if agent roster changed
- [ ] `skills/index.md` updated if skill added/modified
- [ ] CHANGELOG.md updated
