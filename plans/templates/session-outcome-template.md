# Session Outcome Template

## Usage

Copy this block into `plans/session-outcomes.md` after completing a plan execution. Fill every field. Archive old entries when the log exceeds 50 entries.

---

## Entry

**Plan ID:** `<plan file name, e.g. atlas-evolution-plan>`  
**Date:** `<ISO date>`  
**Complexity Tier:** `TRIVIAL | SMALL | MEDIUM | LARGE`  
**Total Phases:** `<planned> / <completed>`  

### Review Pipeline

| Agent | Result | Notes |
| --- | --- | --- |
| AssumptionVerifier-subagent | COMPLETE / ABSTAIN | Mirages found: `<N>` |
| PlanAuditor-subagent | APPROVED / NEEDS_REVISION / REJECTED | Final score: `<N>%` |
| ExecutabilityVerifier-subagent | PASS / WARN / FAIL / N/A | Blocked tasks: `<N>` |
| CodeReviewer-subagent | APPROVED / NEEDS_REVISION / FAILED | Validated blocking issues: `<N>` |

**Total review iterations:** `<N>` / `<max>`  
**Convergence:** `Converged | Stagnation detected | Max iterations reached`  

### Outcome

**Status:** `SUCCESS | PARTIAL | FAILED`  
**CodeReviewer false positive rate:** `<rejected> / <total CRITICAL+MAJOR>` (`<pct>%`)  

### Lessons Learned

1. `<lesson 1>`
2. `<lesson 2>` *(optional)*
3. `<lesson 3>` *(optional)*

---
<!-- Archive entries older than 50 when the log grows large -->
