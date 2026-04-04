# Scoring Specification

## Purpose
Unified quantitative scoring system shared by PlanAuditor, AssumptionVerifier, and CodeReviewer agents. All scoring dimensions, formulas, cross-validation rules, and verdict thresholds are defined here as the single source of truth.

## Scoring Dimensions

### Plan-Level Scoring (PlanAuditor & AssumptionVerifier)

| # | Dimension | Weight | Description | When Active |
|---|-----------|--------|-------------|-------------|
| 1 | Correctness | 3.0 | Plan logic matches requirements; no phantom APIs or invalid assumptions | Always |
| 2 | Completeness | 2.5 | All requirements addressed; no orphaned or missing features | Always |
| 3 | Executability | 2.5 | Tasks are specific enough for cold-start execution (ExecutabilityVerifier score if available) | Always |
| 4 | TDD Quality | 1.5 | Test strategy precedes implementation; concrete test inputs/outputs specified | Always |
| 5 | Security | 1.5 | No untrusted input parsing, privilege escalation, or secrets exposure | Conditional: active when plan touches auth, API endpoints, data storage, or user input |
| 6 | Performance | 1.0 | No unbounded queries, N+1 patterns, or missing pagination for large datasets | Conditional: active when plan touches queries, aggregations, or data-intensive operations |
| 7 | Code Quality | 0.5 | Plan follows project conventions; no unnecessary complexity | Always |

**Total active weight (all dimensions):** 12.5
**Total active weight (excluding conditionals):** 10.0

### Code-Level Scoring (CodeReviewer)

| # | Dimension | Weight | Description |
|---|-----------|--------|-------------|
| 1 | Correctness | 3.0 | Implementation matches plan specification; no logic errors |
| 2 | Completeness | 2.5 | All planned changes implemented; no missing files or functions |
| 3 | Test Quality | 2.0 | Tests are meaningful, cover edge cases, and fail for the right reasons |
| 4 | Code Quality | 1.5 | Clean, idiomatic, follows project conventions |
| 5 | Security | 1.0 | OWASP Top 10 compliance; input validation; no secrets |

**Total weight:** 10.0

## Scoring Formula

```
weighted_sum = Σ(raw_score_i × weight_i) for each ACTIVE dimension
max_possible = Σ(5.0 × weight_i) for each ACTIVE dimension
percentage = (weighted_sum / max_possible) × 100
```

Each `raw_score` is an integer from 0 to 5, clamped: no dimension may exceed 5 or fall below 0.

## Cross-Validated Ceilings

Ceilings limit a dimension's effective score based on evidence from other agents. Applied ONLY when the evidence source data is available; otherwise raw score stands.

| Dimension | Ceiling Source | Ceiling Rule |
|-----------|---------------|--------------|
| Correctness | AssumptionVerifier mirage count | 0 mirages → cap 5; 1 mirage → cap 4; 2-3 mirages → cap 3; 4+ mirages → cap 2 |
| Completeness | Orphaned requirements (AssumptionVerifier absence mirages) | 0 orphans → cap 5; 1 → cap 4; 2-3 → cap 3; 4+ → cap 2 |
| Executability | ExecutabilityVerifier blocked tasks | 0 blocked → cap 5; 1 blocked → cap 3; 2+ blocked → cap 1 |

When a ceiling is applied: `ceiling_applied: true`, `ceiling_source: "<agent> <metric>"`.

## Verdict Thresholds

### Plan-Level (PlanAuditor)
| Percentage | Blocking Issues | Verdict |
|------------|-----------------|---------|
| ≥ 75% | 0 CRITICAL, ≤ 2 MAJOR | APPROVED |
| 60–74% | OR ≥ 75% with > 2 MAJOR | NEEDS_REVISION |
| < 60% | OR any unresolved CRITICAL | REJECTED |

### Code-Level (CodeReviewer)
| Percentage | Blocking Issues | Verdict |
|------------|-----------------|---------|
| ≥ 75% | 0 confirmed CRITICAL/MAJOR | APPROVED |
| 60–74% | OR confirmed MAJOR only | NEEDS_REVISION |
| < 60% | OR confirmed CRITICAL | FAILED |

### AssumptionVerifier
| Percentage | Confidence | Verdict |
|------------|------------|---------|
| ≥ 80% | ≥ 0.7 | COMPLETE (plan safe) |
| < 80% | ≥ 0.7 | COMPLETE (mirages found) |
| any | < 0.7 | ABSTAIN |

## Regression Detection Rules

Used during iterative plan review (up to 5 iterations):
1. Items verified in iteration N that fail in iteration N+1 are **regressions**.
2. A regression automatically becomes a BLOCKING issue regardless of severity.
3. Regressions are tracked via the Verified Items Registry (`plans/templates/verified-items-template.md`).
4. Format: item_id, description, first_verified_iteration, last_verified_iteration, status (VERIFIED/REGRESSED).

## Confidence Threshold
A final audit confidence below **0.7** must trigger `ABSTAIN` regardless of individual dimension scores.
