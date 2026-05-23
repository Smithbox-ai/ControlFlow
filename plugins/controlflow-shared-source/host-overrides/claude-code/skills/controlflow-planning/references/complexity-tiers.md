# Complexity Tiers

## TRIVIAL

- Usually 1-2 files
- Single concern
- Low blast radius
- Often safe to handle without a separate plan artifact

## SMALL

- Usually 3-5 files
- One domain or subsystem
- A short inline plan or saved artifact is usually enough

## MEDIUM

- Usually 6-14 files, or multiple concerns even if the file count is lower
- Save a durable plan artifact
- Run explicit risk review
- Expect at least one verification or review checkpoint

## LARGE

- Usually 15+ files, or a smaller change with system-wide or high-impact risk
- Save a durable plan artifact
- Add research or spike phases before implementation when uncertainty is material
- Use stronger approval and review discipline

## Override Rule

If any unresolved risk is both applicable and high impact, treat the task as LARGE for
planning discipline even when the raw file count is smaller.

## Review Pipeline by Tier

- TRIVIAL: may execute directly if the user did not ask for a saved plan review
- SMALL: run `/controlflow-claude-code:controlflow-plan-audit`
- MEDIUM: run plan-audit and `/controlflow-claude-code:controlflow-assumption-verifier`
- LARGE: run plan-audit, assumption-verifier, and `/controlflow-claude-code:controlflow-executability-verifier`
