# Complexity Tiers

## TRIVIAL

- Usually 1–2 files, single concern, low blast radius.
- No plan artifact required; describe steps inline.

## SMALL

- Usually 3–5 files, one domain or subsystem.
- Save a plan artifact; run verify phase 1 (structural audit).

## MEDIUM

- Usually 6–14 files, or multiple concerns even if file count is lower.
- Save a durable artifact; run verify phases 1–2 (audit + assumption/mirage).
- Expect at least one verification or review checkpoint.

## LARGE

- Usually 15+ files, or a smaller change with system-wide or high-impact risk.
- Save a durable artifact; run verify phases 1–3 (audit + mirage + executability cold-start).
- Add research or spike phases before implementation when uncertainty is material.
- Include `flowchart TD` + `sequenceDiagram`.

## Override Rule

If any unresolved risk is both applicable and HIGH impact, treat the task as LARGE for planning discipline even when the raw file count is smaller.

## Verify Route by Tier

- TRIVIAL: skip verification.
- SMALL: `/controlflow-verify` phase 1.
- MEDIUM: `controlflow-verify` phases 1–2.
- LARGE: `controlflow-verify` phases 1–3.