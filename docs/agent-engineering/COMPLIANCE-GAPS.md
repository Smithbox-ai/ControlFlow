# PART-SPEC Compliance Gaps

Audit date: 2026-03-30
Checklist version: 9-item (includes clarification triggers and tool-routing rules)

## Summary

| Agent | Compliant | Gaps | Target Phase |
|-------|-----------|------|-------------|
| Atlas | ✅ | None (resolved: clarification triggers, tool-routing, PLAN_REVIEW gate, retry reliability) | Complete |
| Prometheus | ✅ | None (resolved: PreFlect, approval gate, askQuestions framing, Context7, tool-routing, Mermaid visualization) | Complete |
| Oracle | ❌ | Missing PreFlect; approval gate N/A not stated; no tool-routing rules for fetch/githubRepo | Phase 3a |
| Scout | ❌ | Missing PreFlect; approval gate N/A not stated | Phase 3a |
| Code-Review | ❌ | Missing PreFlect; no user approval gate (has verification gates only) | Phase 3a |
| Challenger | ✅ | None (new agent, built to spec) | Complete |
| Sisyphus | ❌ | Missing user approval gate; no tool-routing rules for fetch/githubRepo | Phase 3a |
| Frontend-Engineer | ❌ | Missing user approval gate; no tool-routing rules for fetch/githubRepo | Phase 3a |
| DevOps | ❌ | No clarification triggers (has Uncertainty Protocol but no askQuestions); no tool-routing rules for fetch/githubRepo | Phase 3a |
| DocWriter | ❌ | Missing user approval gate; no tool-routing rules for fetch/githubRepo | Phase 3a |
| BrowserTester | ❌ | Missing user approval gate; no tool-routing rules for fetch/githubRepo | Phase 3a |

Compliance rate: 3/11 (27%) against 9-item checklist

## Recently Resolved Gaps

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

**Rejected (removed, 2026-04-01):**
2. **Ceiling Scores** — REJECTED for Atlas. In bishx, ceilings are cross-validated between 4-6 independent reviewer streams (Skeptic, TDD, Completeness reviewers each bound separate dimensions). Atlas has no equivalent multi-stream structure; a single Challenger agent cannot cross-validate its own dimension scores. Ceiling fields added prompt/schema complexity without a structural signal source. Removed from `challenger.plan-audit.schema.json` and Challenger prompt.
3. **Repeat-Finding Escalation** — REJECTED for Atlas. In bishx, escalation runs across up to 10 planning iterations. Atlas caps at 2 Challenger→Prometheus rounds, with existing retry budgets and escalation thresholds already covering stop conditions. Recurrence escalation duplicated existing controls more than it added net value. Removed from `atlas.gate-event.schema.json`, `atlas.delegation-protocol.schema.json`, Challenger findings schema, and Atlas prompt.

**Explicitly NOT Adopted (with rationale):**
- **Persistent hook/session architecture** — bishx uses shell hooks (`stop-hook.sh`, `discover-skills.sh`) for persistent state across sessions. Atlas runs in VS Code Copilot agent context which has no equivalent shell lifecycle hooks. NOTES.md policy covers the same need.
- **10-iteration revision loops** — bishx allows up to 10 planning iterations. Atlas caps at 2 Challenger→Prometheus rounds to prevent endless loops. Existing retry budgets and escalation thresholds provide sufficient loop-stop controls.
- **10 separate reviewer agents** — bishx splits planning review into 6 specialist agents (Skeptic, TDD, Completeness, Integration, Security, Performance) plus Critic and Dry-Run Simulator. Atlas consolidates this into Challenger (adversarial auditor) and Code-Review (post-implementation verifier). Fewer agents → less orchestration overhead and context fragmentation.
- **bd (beads) task tracker integration** — bishx uses a local CLI tool (`bd`) for task tracking. Atlas uses the VS Code `#todos` tool which is natively integrated.

## Gap Details

### Missing PreFlect (4 agents)

| Agent | Notes | Fix |
|-------|-------|-----|
| Prometheus | Has "Scope Clarification Protocol" but no PreFlect risk evaluation | Add PreFlect section in Archive |
| Oracle | Research-only agent, still needs PreFlect for evidence confidence | Add PreFlect section |
| Scout | Read-only discovery agent, needs PreFlect for scope validation | Add PreFlect section |
| Code-Review | Has "Mandatory Verification Gates" but not PreFlect pre-action risk eval | Add PreFlect section |

### Missing Human Approval Gates (8 agents)

| Agent | Notes | Fix |
|-------|-------|-----|
| Prometheus | Planning-only; destructive actions delegated to Atlas. Gate not explicitly stated. | Add explicit statement: "Approval gates: delegated to Atlas (planning-only agent)" |
| Oracle | Research-only; no destructive actions possible with granted tools. | Add explicit statement: "Approval gates: N/A (read-only research agent)" |
| Scout | Discovery-only; no destructive actions possible with granted tools. | Add explicit statement: "Approval gates: N/A (read-only discovery agent)" |
| Code-Review | Has verification gates, not user approval gates. Reviews code but doesn't execute. | Add explicit statement: "Approval gates: N/A (verification-only agent)" |
| Sisyphus | Implementation agent; relies on Atlas for approval but doesn't declare this dependency. | Add approval gate: "Destructive operations outside assigned scope require conductor approval" |
| Frontend-Engineer | Implementation agent; no approval gate for UX-impacting changes. | Add approval gate similar to Sisyphus |
| DocWriter | Documentation agent; no gate for coverage/accuracy review. | Add approval gate: "Approval gates: delegated to conductor (documentation-only agent)" |
| BrowserTester | Testing agent; no gate for escalating critical accessibility/security findings. | Add approval gate: "Approval gates: delegated to conductor for critical finding escalation" |

### Missing Clarification Triggers (10 agents)

| Agent | Notes | Fix |
|-------|-------|-----|
| Atlas | Has askQuestions in frontmatter but no positive clarification triggers in body; no enumerated ambiguity classes | Add clarification triggers per CLARIFICATION-POLICY.md |
| Prometheus | Has askQuestions but frames it negatively as pre-ABSTAIN fallback; repeats prohibition twice | Rewrite to positive triggers per CLARIFICATION-POLICY.md |
| All subagents (8) | No askQuestions; Uncertainty Protocol says "STOP and present" but agents cannot present to user | Replace with structured NEEDS_INPUT + clarification_request delegation |

### Missing Tool-Routing Rules (8 agents)

| Agent | External Tools Granted | Notes | Fix |
|-------|----------------------|-------|-----|
| Atlas | fetch, githubRepo | No routing rules in body | Add per TOOL-ROUTING.md |
| Prometheus | fetch, githubRepo, Context7 | Context7 in frontmatter but zero body references (phantom grant) | Add Context7 routing per TOOL-ROUTING.md |
| Oracle | fetch, githubRepo | No routing rules | Add per TOOL-ROUTING.md |
| Sisyphus | fetch, githubRepo | No routing rules | Add per TOOL-ROUTING.md |
| Frontend-Engineer | fetch, githubRepo | No routing rules | Add per TOOL-ROUTING.md |
| DevOps | fetch, githubRepo | No routing rules | Add per TOOL-ROUTING.md |
| DocWriter | fetch, githubRepo | No routing rules | Add per TOOL-ROUTING.md |
| BrowserTester | fetch, githubRepo | No routing rules | Add per TOOL-ROUTING.md |

Note: Scout and Code-Review have no external tools granted — compliant by exclusion.

### Additional Findings

- **Uncertainty Protocol contradiction**: 5 acting agents (Sisyphus, Frontend-Engineer, DevOps, DocWriter, BrowserTester) define "STOP immediately and present 2–3 options" in Uncertainty Protocol, but none of them have askQuestions access. All must return structured NEEDS_INPUT with `clarification_request` for Atlas to present. Target: Phase 3a.
- **askQuestions negative framing**: Prometheus uses askQuestions with negative pre-ABSTAIN framing and repeats prohibition twice. Target: Phase 2.
- **Context7 phantom grant**: Prometheus has Context7 tools in frontmatter but zero body references. Target: Phase 2.
