# Verify Phases — Detailed Checks

The skill SKILL.md defines the three phases and tier gating. This file holds the detailed checklists. Read `mirage-patterns.md` alongside phase 2.

## Phase 1 — Structural Audit (detailed)

Map each check to a section of the plan; fail fast on structural errors.

1. Referenced files/paths real? Verify in repo (open or grep).
2. Clear objectives; no scope overlap between same-wave phases? Each phase independent.
3. Same-wave phases writing to the same files or contracts? Flag the collision.
4. Acceptance criteria objectively testable? Not vague ("handle errors", "make it secure").
5. Verification commands concrete enough for a fresh executor? No guessing required.
6. Destructive/migration-heavy phase has rollback/recovery guidance? HIGH blast radius → `human_approved_if_required`; MEDIUM → `safety_clear`.
7. Missing dependency assumptions, version constraints, unpinned APIs? All pinned or flagged.
8. Minimum Viable Change Ladder applied before proposing a new abstraction, new dependency, or generated surface?
9. Fresh executor blocked by ambiguity in phases 1–3? Phase 1 should execute without asking.
10. Plan promises scope that the listed phases never implement?
11. Security/access-control/operability concerns deserve stronger gates than shown?

## Phase 2 — Assumption / Mirage Check (detailed)

Apply the [mirage-patterns.md](mirage-patterns.md) catalog. For each plan claim that names a file, function, schema, dependency, or integration point, pick the matching pattern and check it against the repo.

Presence mirages (P1–P10): phantom API, version mismatch, pattern mismatch, missing dependency, file-path hallucination, schema mismatch, integration fantasy, scope creep, test-infra mismatch, concurrency blindness.

Absence mirages (A11–A17): missing error path, missing validation, missing edge case, missing requirement, missing cleanup, missing migration, missing security boundary.

For each mirage found: record the claim, the pattern, the evidence (what you checked), and whether it is confirmed real, refuted, or unconfirmable. Unconfirmable → `uncertain`, not pass.

## Phase 3 — Executability Cold-Start Simulation (detailed)

Walk through executing the plan as if you had never seen the repo.

1. Read only the plan. For Phase 1, is every file path, command, and acceptance check concrete enough to act on without a question? List any missing prerequisite.
2. For each inter-phase contract: is the upstream deliverable format explicit, and does the downstream phase state how it validates the deliverable?
3. For each destructive phase: is rollback/recovery a concrete sequence, not a gesture? If a phase can leave the repo in a broken state, require `human_approved_if_required`.
4. For each quality gate: is it automatable? A manual-only gate fails the "all verification automatable" rule.
5. For each wave: is write ownership disjoint? Overlapping writes in the same wave are a concurrency blocker.

Output: a per-phase executability verdict (executable / blocked-with-reason) that feeds the overall verdict.