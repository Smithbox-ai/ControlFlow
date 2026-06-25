# Complexity Tiers

## TRIVIAL

- Usually 1–2 files, one concern, and low blast radius.
- Use native Codex directly; no plan artifact is required unless requested.

## SMALL

- Usually 3–5 files in one domain or subsystem.
- Save a plan artifact and run `controlflow-verify` phase 1.

## MEDIUM

- Usually 6–14 files or multiple concerns.
- Save a durable plan and run verify phases 1–2.

## LARGE

- Usually 15+ files or a smaller task with system-wide or high-impact risk.
- Save a durable plan and run verify phases 1–3.
- Add research or a spike before implementation when material uncertainty remains.

## Override Rule

Any unresolved semantic risk with `applicability: applicable` and `impact: HIGH` forces
`LARGE` regardless of file count.
