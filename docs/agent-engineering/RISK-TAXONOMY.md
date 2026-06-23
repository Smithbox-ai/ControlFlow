# Risk Taxonomy (Semantic + Audit Dimensions)

Canonical risk taxonomy for ControlFlow. Replaces the inline 7-row semantic risk table at `plans/project-context.md`. That call site references this doc. Pass 14 (`validateCanonicalSourceMatrixContract`) keeps the canonical-source-matrix in lock-step with `plans/project-context.md`.

## Semantic Risk Categories

Seven mandatory risk categories evaluated by Planner during planning:

| Category | Description | Example Plan Phases |
| --- | --- | --- |
| data_volume | Data scale and pagination concerns | Bulk data migrations, pagination-bearing APIs, batch processing phases |
| performance | Query paths, algorithmic complexity | Hot-path optimizations, index additions, algorithmic rewrites |
| concurrency | Parallel execution safety | Background workers, parallel phase execution, shared state changes |
| access_control | Data visibility and authorization | New endpoints, ownership model changes, role transitions |
| migration_rollback | Schema and data migration safety | DB schema changes, data transforms, file format changes |
| dependency | External service and package contracts | External API integrations, new packages, version upgrades |
| operability | Deployment and observability | New services, infrastructure changes, monitoring gaps |

## Audit Dimensions

For each plan, evaluate against these dimensions:

1. **Security Audit**
   - Untrusted input parsing without validation.
   - Privilege escalation risks in tool grants.
   - Secrets or credentials in plan artifacts.
   - Missing authentication/authorization checks.

2. **Architecture Audit**
   - Circular dependencies between phases.
   - File collision risks between phases that edit the same files.
   - Missing inter-phase contracts for dependent data.
   - Scope creep: phases that exceed their stated objective.

3. **Dependency Conflict Detection**
   - Phases that modify overlapping files.
   - External dependency additions without version pinning.
   - Missing `dependencies` field for phases that require prior phase output.

4. **Test Coverage Assessment**
   - Phases without tests or acceptance criteria.
   - Tautological test strategies (tests that cannot fail).
   - Missing edge case coverage for error paths.

5. **Destructive Risk Assessment**
   - Irreversible operations without rollback plan.
   - Bulk schema/contract rewrites without incremental migration.
   - Production data exposure or deletion risks.

6. **Contract Violation Check**
   - Output schemas referenced but not defined.
   - Status enums inconsistent with consuming agents.
   - Missing `$ref` for shared contract fragments.

7. **Executability Audit**
   - Simulate executing the first 3 tasks from the plan artifact alone (no prior context).
   - For each task, verify: concrete file paths present, input/output contracts defined, verification commands specified, acceptance criteria objectively testable.
   - A task FAILS if a fresh executor would be blocked without additional clarification.
   - MUST populate `executability_checklist` per schema. If any task fails, raise at minimum a MAJOR finding.

8. **Performance & Data Volume Audit** — Activate when `audit_scope.requested_focus_areas` includes `performance`, or any plan `risk_review` entry has `category: data_volume` or `category: performance` with `applicability: applicable` and `impact: HIGH`/`MEDIUM`. Evaluate: dataset cardinality, algorithm/query complexity (O(n²) loops, missing indexes), pagination/streaming for large datasets, benchmark/load-test planning, and lock/contention risks. Evidence gap: if performance artifacts are absent, emit a `scope_gap` MINOR finding — do NOT return `ABSTAIN`.

## Cross-Reference

When a semantic `risk_review` entry triggers the audit phase, `controlflow-verify` Phase 1 (Audit) maps the risk category to audit focus areas using the `controlflow-verify Phase 1 (Audit) Focus Area Mapping` table in `plans/project-context.md`. The inline verify role for Phase 1 is `PlanAuditor-subagent` (performed inline by the skill — not a shipped agent). The semantic risk categories and the audit dimensions are complementary: the categories tell the Planner what to think about when planning, while the audit dimensions tell the verify phase what to check when reviewing. There is no Orchestrator in the slim model — the retired conductor's routing surface is gone, and the verify skill performs the audit inline.

## See also

- `plans/project-context.md` — the Semantic Risk Taxonomy table and the controlflow-verify Phase 1 (Audit) focus-area mapping.
- `governance/canonical-source-matrix.json` — the `Semantic-risk taxonomy` row points to this doc (lock-step mirror enforced by Pass 14).
- [`NATIVE-DELEGATION-BOUNDARY.md`](NATIVE-DELEGATION-BOUNDARY.md) — the verify skill is part of ControlFlow's non-native value-add.
