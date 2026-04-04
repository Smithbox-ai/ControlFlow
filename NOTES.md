# Active Notes

## Current Task
**Atlas Evolution Plan Hardening** — refine the post-modernization evolution plan before implementation

## Scope Boundaries
- Planning artifacts only; no implementation changes in this step
- Functional, non-mythological naming plan only; no file renames yet
- Preserve strict least-privilege validation while removing JS hardcoding from the validator

## Plan Assumptions
- VS Code Copilot Agent Mode does not support dynamic model routing (static `model:` frontmatter)
- `governance/tool-grants.json` becomes the canonical machine-readable tool policy for validator enforcement
- `governance/runtime-policy.json` stores Atlas operational knobs only; scoring remains in `docs/agent-engineering/SCORING-SPEC.md`, file-count complexity tiers remain in `plans/project-context.md`
- Documentation-heavy phases should route to `DocWriter-subagent` where possible
- Idea-interview scenarios improve coverage, but semantic execution still depends on an external eval runner

## Unresolved Questions
- Behavioral eval semantic testing still requires an external eval runner — structural checks only in-repo today
- Session outcome archival cadence/process remains TBD
- Adaptive model routing deferred until platform supports dynamic dispatch
- Token budget net impact needs post-implementation analysis after the evolution plan lands

## Plan File
`plans/atlas-evolution-plan.md` — 6 phases, 4 waves
