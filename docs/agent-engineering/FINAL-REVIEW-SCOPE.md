# Final Review Scope (`review_scope=final`)

Authoritative scope for CodeReviewer-subagent when dispatched with `review_scope: 'final'` (Orchestrator Completion Gate). Mirrored from `RELIABILITY-GATES.md#issue-validation-protocol` and `CodeReviewer-subagent.agent.md` §5.1-5.4. Pass 13 (`review_scope=final Bidirectional Coupling`) validates that this text matches the agent's anchor.

### Final Scope (`review_scope=final`)

Triggered when Orchestrator dispatches CodeReviewer at the Completion Gate with `review_scope: "final"`. This is a holistic pass over the entire plan's aggregate diff — not a repeat of per-phase review.

#### 5.1 Prepare

Orchestrator injects into the delegation prompt:
- `changed_files[]` — aggregate of all files modified/created across every completed phase, normalized by Orchestrator from executor reports (`CoreImplementer → changes[].file`, `UIImplementer → ui_changes[].file`, `TechnicalWriter → docs_created[].path + docs_updated[].path`, `PlatformEngineer → changes[].file`).
- `plan_phases_snapshot[]` — array of `{phase_id, files[]}` extracted from the Planner plan artifact, representing each phase's originally planned file set.

Do NOT self-source these from `plans/artifacts/` — use only the Orchestrator-injected context and `search` tools. `read/readFile` is permitted for navigating cited code locations during issue validation, but NOT for self-sourcing plan phase artifacts.

#### 5.2 Execute Checks

Run the following checks across all files in `changed_files[]`:

1. **Coverage** — Every file in `changed_files[]` is accounted for in at least one `plan_phases_snapshot[].files` entry, OR flagged as out-of-scope.
2. **Security** — Full `search/textSearch` audit across all changed files for secrets, hardcoded keys, SQL injection patterns, XSS vectors, PII exposure. Populate `security_checks` normally.
3. **Quality** — Lint, type-safety, and test-coverage signals for all changed files.
4. **Integration** — Verify that contracts between phases are satisfied: outputs referenced by downstream phases exist and match expected shapes.
5. **Architecture** — Simplicity, anti-abstraction, integration-first principles across the aggregate change set.

#### 5.3 Detect Out-of-Scope Changes

Compare `changed_files[]` against the union of all `plan_phases_snapshot[].files`:
- Any file in `changed_files[]` NOT present in any `plan_phases_snapshot[].files` → add to `out_of_scope_changes[]`.
- Any file in any `plan_phases_snapshot[].files` NOT present in `changed_files[]` → mark as `status: "missing"` in `planned_vs_actual[]`.
- Files present in both → mark as `status: "present"`.

**Novelty filter (mandatory):** When `review_scope=final`, Orchestrator injects `prior_phase_findings[]` (each entry: `{ phase_id, review_scope, status, issues, validated_blocking_issues }`) into the delegation payload. Use this array — not `plans/artifacts/` file reads — as the reference for already-surfaced findings. Only report findings in `issues[]` and `validated_blocking_issues[]` that were NOT already surfaced and resolved in the injected `prior_phase_findings[]`. Duplicate findings already addressed in prior phase reviews must be omitted. New findings that cross phase boundaries or emerge only from the holistic view are the primary target.

#### 5.4 Output

Populate the standard verdict schema fields plus:
- `review_scope: "final"`
- `final_review_summary`: `{ files_reviewed, prd_compliance_score, security_audit_pass, quality_checks_pass, contract_verification_pass }`
- `changed_files_analysis`: `{ planned_vs_actual[], out_of_scope_changes[] }`

CodeReviewer **NEVER** owns fix cycles. If blocking findings exist, return them in `validated_blocking_issues[]` and set status to `NEEDS_REVISION`. Orchestrator will dispatch the original phase executor for remediation.

## See also

- [RELIABILITY-GATES.md](RELIABILITY-GATES.md) — shared verification, evidence, scoring reproducibility, and regression rules (including the issue-validation protocol).
- [SCORING-SPEC.md](SCORING-SPEC.md) — code-level dimensions, weights, percentage math, and verdict thresholds.
- [code-reviewer.verdict.schema.json](../../schemas/code-reviewer.verdict.schema.json) — verdict contract (Pass 13 enforces bidirectional `review_scope=final` coupling with this file).
