# PART-SPEC Compliance Gaps

Audit date: 2026-03-30
Checklist version: 9-item (includes clarification triggers and tool-routing rules)

## Summary

| Agent | Compliant | Gaps | Target Phase |
|-------|-----------|------|-------------|
| Atlas | ✅ | None (resolved: clarification triggers, tool-routing, PLAN_REVIEW gate, retry reliability) | Complete |
| Prometheus | ✅ | None (resolved: PreFlect, approval gate, askQuestions framing, Context7, tool-routing, Mermaid visualization) | Complete |
| Oracle | ❌ | Missing PreFlect; approval gate N/A not stated; no tool-routing rules for fetch/githubRepo | Phase 3a |
| Explorer | ❌ | Missing PreFlect; approval gate N/A not stated | Phase 3a |
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
- Oracle and Explorer intentionally excluded (no `NEEDS_INPUT` status in their enum).

### Atlas Retry Reliability (NEW)
- Added Retry Reliability Policy to `Atlas.agent.md`.
- Added Section 7 (Retry Reliability) to `docs/agent-engineering/RELIABILITY-GATES.md`.
- Covers: silent failure detection, retry budgets, per-wave throttling, exponential backoff signaling, escalation thresholds.

## Gap Details

### Missing PreFlect (4 agents)

| Agent | Notes | Fix |
|-------|-------|-----|
| Prometheus | Has "Scope Clarification Protocol" but no PreFlect risk evaluation | Add PreFlect section in Archive |
| Oracle | Research-only agent, still needs PreFlect for evidence confidence | Add PreFlect section |
| Explorer | Read-only discovery agent, needs PreFlect for scope validation | Add PreFlect section |
| Code-Review | Has "Mandatory Verification Gates" but not PreFlect pre-action risk eval | Add PreFlect section |

### Missing Human Approval Gates (8 agents)

| Agent | Notes | Fix |
|-------|-------|-----|
| Prometheus | Planning-only; destructive actions delegated to Atlas. Gate not explicitly stated. | Add explicit statement: "Approval gates: delegated to Atlas (planning-only agent)" |
| Oracle | Research-only; no destructive actions possible with granted tools. | Add explicit statement: "Approval gates: N/A (read-only research agent)" |
| Explorer | Discovery-only; no destructive actions possible with granted tools. | Add explicit statement: "Approval gates: N/A (read-only discovery agent)" |
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

Note: Explorer and Code-Review have no external tools granted — compliant by exclusion.

### Additional Findings

- **Uncertainty Protocol contradiction**: 5 acting agents (Sisyphus, Frontend-Engineer, DevOps, DocWriter, BrowserTester) define "STOP immediately and present 2–3 options" in Uncertainty Protocol, but none of them have askQuestions access. All must return structured NEEDS_INPUT with `clarification_request` for Atlas to present. Target: Phase 3a.
- **askQuestions negative framing**: Prometheus uses askQuestions with negative pre-ABSTAIN framing and repeats prohibition twice. Target: Phase 2.
- **Context7 phantom grant**: Prometheus has Context7 tools in frontmatter but zero body references. Target: Phase 2.
