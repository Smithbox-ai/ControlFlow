# PART-SPEC Compliance Gaps

Audit date: 2026-04-01
Checklist version: 9-item (includes clarification triggers and tool-routing rules)

## Summary

| Agent | Compliant | Gaps | Target Phase |
|-------|-----------|------|-------------|
| Atlas | ✅ | None | Complete |
| Prometheus | ✅ | None | Complete |
| Oracle | ✅ | None (resolved: PreFlect, approval gate N/A statement, tool-routing rules) | Complete |
| Scout | ✅ | None (resolved: PreFlect, approval gate N/A statement) | Complete |
| Code-Review | ✅ | None (resolved: PreFlect, approval gate N/A statement) | Complete |
| Challenger | ✅ | None (resolved: clarification delegation statement confirmed present) | Complete |
| Sisyphus | ✅ | None (resolved: approval gate statement, tool-routing rules) | Complete |
| Frontend-Engineer | ✅ | None (resolved: approval gate statement, tool-routing rules) | Complete |
| DevOps | ✅ | None (resolved: clarification triggers, tool-routing rules) | Complete |
| DocWriter | ✅ | None (resolved: approval gate statement, tool-routing rules) | Complete |
| BrowserTester | ✅ | None (resolved: approval gate statement, tool-routing rules) | Complete |
| Skeptic | ✅ | None | Complete |
| DryRun | ✅ | None | Complete |

Compliance rate: 13/13 (100%) against 9-item checklist

## Recently Resolved Gaps

### Semantic Risk Discovery (NEW, 2026-04-02)
Root cause: Challenger trigger criteria were purely structural (phase count, confidence, destructive scope). Plans could pass all structural checks while silently omitting non-functional risk analysis (data volume, performance, lock contention). Real-world case: forecast adjustment API plan omitted large-table load analysis; required separate manual review before v2 plan was safe for execution.

Changes applied across 5 phases:
- **`schemas/prometheus.plan.schema.json`** bumped to `1.2.0`. Added required `risk_review` array: 7 semantic risk categories (`data_volume`, `performance`, `concurrency`, `access_control`, `migration_rollback`, `dependency`, `operability`), each with `applicability`, `impact`, `evidence_source`, and `disposition` fields.
- **`Prometheus.agent.md`**: Added Mandatory Workflow step `0.5` — Semantic Risk Discovery Gate with per-category detection heuristics. Updated PreFlect checklist with item 4 (semantic risk completeness). Added `### Semantic Risk Review` table to plan markdown template. Added quality standard 11 (risk-reviewed).
- **`Atlas.agent.md`**: Extended `PLAN_REVIEW` trigger condition with 4th rule: any `risk_review` entry with `applicability: applicable` AND `impact: HIGH` AND `disposition != resolved` triggers Challenger regardless of phase count or confidence. Added deterministic `focus_areas` derivation mapping from risk category to Challenger focus area.
- **`Challenger-subagent.agent.md`**: Added audit dimension 8 — Performance & Data Volume Audit. Covers unbounded queries, algorithm complexity, pagination gaps, missing benchmark targets, and lock contention risks. Evidence gap rule: emit `scope_gap` MINOR when codebase artifacts are unavailable (do NOT ABSTAIN).
- **`schemas/challenger.plan-audit.schema.json`** bumped to `1.2.0`. Added optional `audit_scope` field recording `requested_focus_areas` and `covered_dimensions`.
- **`docs/agent-engineering/RELIABILITY-GATES.md`**: Added Section 9 — Semantic Risk Coverage with required controls and acceptance gate.
- **`plans/project-context.md`**: Added Semantic Risk Taxonomy table; updated Typical Workflow Challenger description.
- **Eval scenarios**: Created `evals/scenarios/prometheus-large-data-risk-discovery.json` (3 inputs). Updated `prometheus-schema-output.json`, `prometheus-ambiguity-plus-schema.json` (add `risk_review_present` assertions). Updated `challenger-adversarial-detection.json` (add unbounded-query case + `audit_scope` assertion). Updated `atlas-challenger-integration.json` (add 2 semantic risk trigger/skip cases + 2 assertions).
- **`evals/validate.mjs`**: Pass 2 now verifies Prometheus scenarios assert `risk_review_present`.

### Adversarial Plan Review (NEW)
- Added `Challenger-subagent.agent.md` as adversarial plan auditor.
- Schema: `schemas/challenger.plan-audit.schema.json`.
- Atlas state machine extended with conditional `PLAN_REVIEW` gate.
- Trigger policy: 3+ phases, confidence < 0.9, or high-risk/destructive scope.
- Max 2 Challenger→Prometheus revision rounds before user escalation.

### Prometheus Mermaid Visualization (NEW)
- Prometheus now requires Architecture Visualization section for 3+ phase plans.
- Allowed diagram types: `flowchart TD`, `sequenceDiagram`, `stateDiagram-v2`.
- Schema extended with optional `diagrams` array in `schemas/prometheus.plan.schema.json`.

### Shared Clarification Contract (NEW)
- Created `schemas/clarification-request.schema.json` as canonical shared contract.
- 5 acting agent schemas now reference shared contract via `$ref`.
- Oracle and Scout intentionally excluded (no `NEEDS_INPUT` status in their enum).

### Atlas Retry Reliability (NEW)
- Added Retry Reliability Policy to `Atlas.agent.md`.
- Added Section 7 (Retry Reliability) to `docs/agent-engineering/RELIABILITY-GATES.md`.
- Covers: silent failure detection, retry budgets, per-wave throttling, exponential backoff signaling, escalation thresholds.

### Token Optimization — Shared Policies (NEW, 2026-04-01)
- Created `.github/copilot-instructions.md` with shared Continuity, Failure Classification, NOTES.md baseline, and governance doc index.
- Removed identical `### Continuity` section from all 11 agent files.
- Removed standard Failure Classification block from 6 execution/review agents (Code-Review, Sisyphus, DevOps, BrowserTester, Frontend-Engineer, DocWriter). Challenger retains a deviation note (no `transient`).
- Pruned misplaced Resources entries: PART-SPEC/RELIABILITY-GATES removed from Explorer, BrowserTester, DocWriter, Oracle; CLARIFICATION-POLICY removed from Explorer, BrowserTester, DocWriter, Oracle, Challenger, Code-Review, Sisyphus, DevOps, Frontend-Engineer; TOOL-ROUTING removed from Code-Review; MIGRATION-CORE-FIRST moved from Atlas to DevOps.
- Updated PART-SPEC.md Section 2 to state shared policy rule.
- Estimated savings: ~150–200 tokens per agent, ~1200–1600 tokens across a full 8-agent pipeline call.

### bishx Mechanism Adoption (FINAL STATE, 2026-04-01)
Four mechanisms from the bishx multi-agent planning system were evaluated. Two were adopted after structural analysis; two were rejected.

**Adopted (active in Atlas):**
1. **Executability Audit** — Challenger now simulates cold-start execution on the first 3 plan tasks. Encoded in `challenger.plan-audit.schema.json` as `executability_checklist`. Prompt addition: ~6 lines in Challenger. Gate: any task that fails executability → MAJOR finding minimum.
4. **Validated Blocking Findings** — Code-Review now classifies each CRITICAL/MAJOR issue as `confirmed`/`rejected`/`unvalidated` and emits `validated_blocking_issues`. Atlas blocks only on confirmed blockers. Encoded in `code-review.verdict.schema.json` as `validation_status` per issue and `validated_blocking_issues` array. Prompt addition: ~3 lines in Code-Review, ~2 lines in Atlas.

**Adopted in Modernization (2026-04-04) — previously rejected, now implemented:**
2. **Ceiling Scores** — ADOPTED in Atlas Modernization (Phase 2). Cross-validated ceilings are now active between Skeptic, Challenger, and DryRun agent streams. When multiple review agents are present (MEDIUM/LARGE tier), each agent bounds specific scoring dimensions based on evidence it produces. Single source of truth: `docs/agent-engineering/SCORING-SPEC.md` — Cross-Validated Ceilings section. The original rejection reason (single Challenger stream) no longer applies because Skeptic and DryRun now provide distinct evidence streams.
3. **Repeat-Finding Escalation** — ADOPTED as Regression Tracking in Atlas Modernization (Phase 8). Verified items from previous plan-review iterations are tracked via `plans/templates/verified-items-template.md`. Any item verified in iteration N that fails in iteration N+1 becomes an automatic BLOCKING regression issue, regardless of severity. This provides repeat-finding escalation within the 5-iteration review loop. Single source of truth: `docs/agent-engineering/SCORING-SPEC.md` — Regression Detection Rules.

**Explicitly NOT Adopted (with rationale):**
- **Persistent hook/session architecture** — bishx uses shell hooks (`stop-hook.sh`, `discover-skills.sh`) for persistent state across sessions. Atlas runs in VS Code Copilot agent context which has no equivalent shell lifecycle hooks. NOTES.md policy covers the same need.
- **10-iteration revision loops** — bishx allows up to 10 planning iterations. Atlas caps at 5 iterations with convergence detection (stagnation: <5% improvement over 2 consecutive iterations). Existing retry budgets and per-phase escalation thresholds provide sufficient loop-stop controls.
- **10 separate reviewer agents** — bishx splits planning review into 6 specialist agents (Skeptic, TDD, Completeness, Integration, Security, Performance) plus Critic and Dry-Run Simulator. Atlas consolidates this into Challenger (adversarial auditor) and Code-Review (post-implementation verifier). Fewer agents → less orchestration overhead and context fragmentation.
- **bd (beads) task tracker integration** — bishx uses a local CLI tool (`bd`) for task tracking. Atlas uses the VS Code `#todos` tool which is natively integrated.

### Phase 3a Completion (2026-04-01)

All 8 agents previously targeted for Phase 3a now meet the 9-item checklist:

- **Oracle**: Added PreFlect section (Archive), explicit `Approval gates: N/A` statement (Tools), External Tool Routing rules (Tools).
- **Scout**: Added PreFlect section (Archive), explicit `Approval gates: N/A` statement (Tools).
- **Code-Review**: Added PreFlect section (Archive), explicit `Approval gates: N/A` statement (Tools), Clarification role statement (Non-Negotiable Rules).
- **Sisyphus**: Added Human Approval Gates statement (Tools), External Tool Routing rules (Tools), Uncertainty Protocol → `NEEDS_INPUT` delegation (Non-Negotiable Rules).
- **Frontend-Engineer**: Added Human Approval Gates statement (Tools), External Tool Routing rules (Tools), Uncertainty Protocol → `NEEDS_INPUT` delegation (Non-Negotiable Rules).
- **DevOps**: Added full Approval Gates table (Prompt), External Tool Routing rules (Tools), Uncertainty Protocol → `NEEDS_INPUT` delegation (Non-Negotiable Rules).
- **DocWriter**: Added Human Approval Gates statement (Tools), External Tool Routing rules (Tools), Uncertainty Protocol → `NEEDS_INPUT` delegation (Non-Negotiable Rules).
- **BrowserTester**: Added Human Approval Gates statement (Tools), External Tool Routing rules (Tools), Uncertainty Protocol → `NEEDS_INPUT` delegation (Non-Negotiable Rules).

### Atlas Modernization (2026-04-04)

Comprehensive modernization of the Atlas agent system. Changes across 9 phases:

1. **New Agents:** Skeptic-subagent (17 mirage detection patterns, quantitative scoring), DryRun-subagent (cold-start plan executability simulation with 8-point checklist and 7-step walkthrough).
2. **Quantitative Scoring:** 7-dimension weighted scoring system for Challenger (plan-level) and 5-dimension for Code-Review (code-level). Cross-validated ceilings between Skeptic, Challenger, and DryRun. Single source of truth: `docs/agent-engineering/SCORING-SPEC.md`.
3. **5-Iteration Plan Review Loop:** Atlas PLAN_REVIEW upgraded from 2 to 5 max iterations with convergence detection (stagnation threshold: <5% improvement over 2 consecutive iterations).
4. **Complexity Gate:** Prometheus classifies tasks as TRIVIAL/SMALL/MEDIUM/LARGE. Atlas adjusts pipeline depth accordingly (TRIVIAL skips review entirely, LARGE forces full pipeline).
5. **Template Externalization:** Embedded templates extracted to `plans/templates/` (4 files). Reduces Atlas token overhead by ~800-900 tokens per invocation.
6. **Skill Library:** `skills/` directory with index and 4 domain pattern files (TDD, error handling, security, performance). Prometheus selects relevant skills during planning.
7. **Per-Issue Validation:** Code-Review now executes 4-step validation protocol for CRITICAL/MAJOR findings. False positives documented with rejection reasons.
8. **Regression Tracking:** Verified items tracked across plan review iterations. Regressions automatically become BLOCKING issues.
9. **Observability:** trace_id (UUID v4) propagated through all gate events and delegation payloads for log correlation.

Agent count: 11 → 13. Schema count: 13 → 15. Eval scenario count: 29 → 35.

## Gap Details

No remaining gaps. All 13 agents are fully compliant with the 9-item P.A.R.T checklist. (Agent count increased from 11 → 13 in modernization 2026-04-04 with the addition of Skeptic-subagent and DryRun-subagent.)
