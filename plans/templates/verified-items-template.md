# Verified Items Registry

Tracks items verified during iterative plan review. Used for regression detection across review iterations.

## Format

| Item ID | Description | First Verified (Iteration) | Last Verified (Iteration) | Status |
|---|---|---|---|---|
| P1-S1 | Phase 1 Step 1: Schema file paths exist | 1 | 2 | VERIFIED |
| P2-S3 | Phase 2 Step 3: API contract matches spec | 1 | 1 | REGRESSED |

## Status Values
- **VERIFIED** — Item confirmed correct in the most recent iteration.
- **REGRESSED** — Item was previously VERIFIED but failed in a subsequent iteration. Automatic BLOCKING issue.

## Usage Protocol
1. After first PlanAuditor/AssumptionVerifier review, populate this registry with all verified claims.
2. On subsequent iterations, re-check all previously verified items.
3. Any item changing from VERIFIED to failing → mark as REGRESSED.
4. REGRESSED items become automatic BLOCKING issues that must be resolved before plan approval.
5. New items from revised plan sections are added with their first-verified iteration number.
