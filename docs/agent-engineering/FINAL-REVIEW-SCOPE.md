# Final Review Scope (`review_scope=final`)

Authoritative scope for the `controlflow-review` final pass over the aggregate diff of a completed plan. In the slim Copilot-first model, final review is the `controlflow-review` skill layered over native Copilot code review — there is no Orchestrator Completion Gate and no Orchestrator-injected context. The skill reads the plan artifact and the aggregate diff directly.

## When it runs

The final pass runs after implementation is complete, over the entire plan's aggregate diff — not a repeat of per-phase review. It is the post-implementation half of the plan → verify → review pipeline:

```
plan → controlflow-verify (APPROVED) → native Copilot executes phases → controlflow-review (final pass over the aggregate diff)
```

For SMALL+ work, `controlflow-review` runs after implementation. The final pass is the holistic scope-drift + evidence + proactive-vulnerability layer over native Copilot's mechanical review pass.

## 1. Prepare

The `controlflow-review` skill gathers from the plan artifact and the working tree (no Orchestrator injection — the skill self-sources from the plan and `search` tools):

- `changed_files[]` — aggregate of all files modified/created across every completed phase. The skill derives this from the plan's lifecycle sections (`Progress`, `Outcomes`) and the working-tree diff.
- `plan_phases_snapshot[]` — array of `{phase_id, files[]}` extracted from the Planner plan artifact's Implementation Phases section, representing each phase's originally planned file set.

Use `search` tools and the plan artifact. `read` is permitted for navigating cited code locations during issue validation.

## 2. Execute checks

Run the following checks across all files in `changed_files[]`:

1. **Coverage** — Every file in `changed_files[]` is accounted for in at least one `plan_phases_snapshot[].files` entry, OR flagged as out-of-scope.
2. **Security** — Full `search/textSearch` audit across all changed files for secrets, hardcoded keys, SQL injection patterns, XSS vectors, PII exposure. Populate `security_checks` per the verdict schema.
3. **Quality** — Lint, type-safety, and test-coverage signals for all changed files.
4. **Integration** — Verify that contracts between phases are satisfied: outputs referenced by downstream phases exist and match expected shapes.
5. **Architecture** — Simplicity, anti-abstraction, integration-first principles across the aggregate change set.

## 3. Detect out-of-scope changes (plan-vs-implementation scope drift)

Compare `changed_files[]` against the union of all `plan_phases_snapshot[].files`:

- Any file in `changed_files[]` NOT present in any `plan_phases_snapshot[].files` → add to `out_of_scope_changes[]`.
- Any file in any `plan_phases_snapshot[].files` NOT present in `changed_files[]` → mark as `status: "missing"` in `planned_vs_actual[]`.
- Files present in both → mark as `status: "present"`.

**Novelty filter (mandatory):** Use the per-phase findings already recorded in the plan's lifecycle sections (`Discoveries`, `Outcomes`) as the reference for already-surfaced findings. Only report findings that were NOT already surfaced and resolved in those prior phase records. Duplicate findings already addressed in prior phase reviews must be omitted. New findings that cross phase boundaries or emerge only from the holistic view are the primary target of the final pass.

## 4. Output

Populate the verdict schema fields (see `schemas/code-reviewer.verdict.schema.json`) plus:

- `review_scope: "final"`
- `final_review_summary`: `{ files_reviewed, prd_compliance_score, security_audit_pass, quality_checks_pass, contract_verification_pass }`
- `changed_files_analysis`: `{ planned_vs_actual[], out_of_scope_changes[] }`

`controlflow-review` **NEVER** owns fix cycles. If blocking findings exist, return them in `validated_blocking_issues[]` and set status to `NEEDS_REVISION`. The user re-invokes the Planner for a targeted replan, or native Copilot remediates inline.

## See also

- [`SCORING-SPEC.md`](SCORING-SPEC.md) — code-level dimensions, weights, percentage math, and verdict thresholds.
- `schemas/code-reviewer.verdict.schema.json` — the verdict contract (documentation + eval fixture reference).
- [`NATIVE-DELEGATION-BOUNDARY.md`](NATIVE-DELEGATION-BOUNDARY.md) — `controlflow-review` layers over native Copilot code review; it does not duplicate the mechanical pass.
- [`RISK-TAXONOMY.md`](RISK-TAXONOMY.md) — the 7 semantic-risk categories evaluated during planning.