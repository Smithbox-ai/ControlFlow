# ТЗ — ControlFlow Slim Copilot-First Refactor

- **Date:** 2026-06-22
- **Status:** Approved (design phase)
- **Branch:** `redesign/controlflow-claude-code-standalone`
- **Target release:** v1.0 (breaking)
- **Author:** brainstorming session (user + assistant)

---

## 1. Goal & Scope

### Goal
Collapse ControlFlow's 13-agent VS Code Copilot Chat orchestration into a thin, non-duplicating layer over Copilot's native agent capabilities, while preserving its irreducible value-add: the schema-enforced plan format, adversarial verification, the 7-category semantic-risk taxonomy, plan-vs-implementation scope-drift review, and the contract-drift eval suite.

### Primary success criterion
A documented **native-vs-ControlFlow delegation boundary** in which **zero** ControlFlow surfaces duplicate a capability that GitHub Copilot now provides natively (as of June 2026).

### Scope
- **In scope:** the Copilot-primary surface, which becomes the **canonical** form of the project.
- **Sequencing:** Copilot-first — refactor the Copilot surface, **then** sync the codex/cursor plugins from the new canonical form.
- **Posture:** breaking change, new major version (v1.0). Existing plans in `plans/archive/` are kept as history; tutorials, governance, and evals are rewritten under the new contract.
- **Out of scope:** net-new features; changes to the plan-format schema itself (it remains the stable contract).

---

## 2. Background & Current State

### 2.1 Current architecture (13-agent, VS Code Copilot Chat)
ControlFlow's primary harness is **VS Code Copilot Chat**. The repo-root `*.agent.md` files are Copilot Chat custom agents (`@Planner`, `@Orchestrator`, 13 total), enabled via `chat.customAgentInSubagent`. `.github/copilot-instructions.md` is the always-on policy file Copilot loads.

- **13 agents, ~2,160 lines / ~30k tokens** of agent markdown: `Orchestrator.agent.md` (413) + `Planner.agent.md` (205) + 11 `*-subagent.agent.md` (1,542).
- **Heavy orchestration surface:** state machine (`PLANNING`→`WAITING_APPROVAL`→`PLAN_REVIEW`→`ACTING`→`REVIEWING`→`COMPLETE`), dispatch protocol, subagent routing, todo lifecycle, approval gates, retry/backoff, wave execution, gate events, context packets, compaction, `NEEDS_INPUT` routing, `PreFlect` gate, session-outcome telemetry, revision-mode plumbing — plus `governance/runtime-policy.json` retry/wave/compaction knobs and `docs/agent-engineering/*` orchestration docs.
- **Unique value-add:** schema-anchored plan format (YAML header + 10 sections + 5 lifecycle sections + 7-category semantic-risk taxonomy + Mermaid rules); 17-pattern mirage taxonomy + 5-dimension scoring (`AssumptionVerifier`); executability cold-start simulation (`ExecutabilityVerifier`); `PlanAuditor` verdict rules with cross-validated ceilings; failure taxonomy; regression gate; `CodeReviewer` 4-step issue-validation protocol; Idea Interview + Clarification gates; tier-gated workflow; P.A.R.T spec; governance grants trio; scoring spec; offline eval suite.

### 2.2 The slim Claude Code plugin (proven prototype)
`plugins/controlflow-claude-code/` (v0.2.0, 979 lines, 17 files, 3 skills, 0 subagents) already proves the target pattern: schema-sourced skill bodies (read `schemas/planner.plan.schema.json` + `plans/templates/plan-document-template.md` at invoke time), inline adversarial verify with no subagents, tier-gated phase selection, "layer over native `/code-review`" stance, folded orchestration as a prose reference doc. Seven patterns transfer directly to the Copilot surface.

### 2.3 Copilot native capabilities (June 2026) — the delegation boundary
Research restricted to official GitHub/VS Code docs and 2025–2026 changelog announcements. All GA unless noted.

| ControlFlow surface | Copilot native now? | Delegation |
|---|---|---|
| Custom agents via `@-mention` (`.agent.md`) | ✅ GA (VS Code 1.106+, Feb 2026) | **Delegate** — ControlFlow's `*.agent.md` are already Copilot agents |
| Subagent dispatch + parallelism | ✅ GA default-on (Feb 24 2026) | **Delegate** — drop Orchestrator dispatch |
| Plan mode (`/plan`: Discovery→Alignment→Design→Refinement) | ✅ GA | **Layer over** — keep CF plan *format*, use native discovery |
| Code review (agentic, Low/Medium, AGENTS.md+skills+MCP) | ✅ GA (Mar 5 2026) | **Delegate mechanical pass** — keep CF scope-drift/evidence layer |
| Skills library (`.github/skills/<name>/SKILL.md`) | ✅ GA (portable VS Code/CLI/cloud/review) | **Use** — ship CF as skills |
| MCP, model selection, approvals, custom-instructions | ✅ GA | **Delegate** |
| Schema-enforced plan format + 7-category semantic-risk | ❌ not native | **Keep** |
| Adversarial verify (APPROVED/NEEDS_REVISION/REJECTED, mirage, cold-start) | ❌ not native | **Keep** |
| Tier-gated workflow policy (TRIVIAL/SMALL/MEDIUM/LARGE) | ❌ not native | **Keep** |
| Plan-vs-implementation scope-drift comparison | ❌ not native | **Keep** |
| Contract-drift eval suite | ❌ not native | **Keep** |

**Native feature uncertainties (spike in Phase 0):** `@-mention` invocation in VS Code Chat is confirmed for Visual Studio 2026 and strongly implied for VS Code but not screenshot-confirmed in VS Code docs; Copilot `hooks` (`.github/hooks/*.json`) are experimental in VS Code, GA on CLI/GitHub.com.

---

## 3. Target Architecture

The canonical ControlFlow surface lives at **Copilot-native locations**: `.github/agents/`, `.github/skills/`, `.github/copilot-instructions.md` — not at repo root and not in `plugins/controlflow-shared-source/`. The `controlflow-shared-source` generator is **inverted** from "source of truth" to "sync-OUT emitter" from the Copilot canonical form.

```
┌─ NATIVE COPILOT (delegate, don't reimplement) ─────────────┐
│  custom agents (@-mention) · subagent dispatch · /plan      │
│  code review (agentic) · MCP · model selection · approvals  │
│  skills loader (.github/skills/) · custom-instructions      │
└─────────────────────────────────────────────────────────────┘
┌─ CONTROLFLOW (keep — irreducible value-add) ────────────────┐
│  schema-anchored plan format · 7-cat semantic-risk taxonomy │
│  adversarial verify (3 phases, APPROVED/NEEDS_REVISION/     │
│    REJECTED, mirage + cold-start) · tier-gated workflow     │
│  plan-vs-implementation scope-drift review layer            │
│  contract-drift eval suite                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Components — the slim Copilot surface

| Component | Location | Notes |
|---|---|---|
| `controlflow-plan` skill | `.github/skills/controlflow-plan/SKILL.md` + `references/` | Port from slim plugin. Idea Interview + Clarification gates; schema-sourced; assigns tier; writes `plans/<task-slug>-plan.md` (never inlines plan in chat). |
| `controlflow-verify` skill | `.github/skills/controlflow-verify/SKILL.md` + `references/` | Port from slim plugin. Inline 3-phase adversarial verify (structural audit / assumption+mirage / executability cold-start); verdict `APPROVED`/`NEEDS_REVISION`/`REJECTED`; writes `plans/artifacts/<task-slug>/verify-verdict.md`. |
| `controlflow-review` skill | `.github/skills/controlflow-review/SKILL.md` + `references/` | Port from slim plugin. **Layer over native Copilot code review**: delegate mechanical/style pass to native review; add plan-vs-implementation scope-drift, evidence discipline, proactive vulnerability/error search. |
| `@Planner` custom agent | `.github/agents/controlflow-planner.agent.md` | Thin persona; runs the plan skill + Idea Interview; uses native **handoffs** to delegate implementation (no dispatch protocol, no subagent roster). |
| Routing stub | `.github/copilot-instructions.md` | Tier-gated plan→verify→review; the always-on surface (replaces the repo `CLAUDE.md` routing role for the Copilot surface). |
| Plan contract | `schemas/planner.plan.schema.json` + `plans/templates/plan-document-template.md` | Unchanged single source of truth. |
| Governance (kept) | `governance/project-context-registry.json` + slimmed `governance/runtime-policy.json` | Plan-contract anchors + tier→verify-phases + semantic-risk + verdict routing only. |
| Evals | `evals/` | Rewritten under the new contract. |

**Agent count: 13 → 1** (`@Planner` only). Review is a *skill* layered over native review, not an agent. The three verifiers fold into the verify skill. Implementation, research, and testing are delegated to native Copilot agent mode / subagents / `@-mention`.

### 4.1 Governance cut
- **Keep:** `governance/project-context-registry.json` (plan-contract anchors) and a slimmed `governance/runtime-policy.json` (tier→verify-phases mapping, semantic-risk policy, verdict routing). The contract-drift eval asserts plan-format anchors against these two plus the schema.
- **Remove:** `governance/model-routing.json` (→ native per-agent `model` frontmatter + Copilot Auto), `governance/tool-grants.json` (→ native tool management), `governance/agent-grants.json` (→ no subagent roster to govern), `governance/rename-allowlist.json` (re-evaluate in Phase 2).

---

## 5. What Gets Removed (the dedup)

- `Orchestrator.agent.md` — state machine → native subagent dispatch + `/plan` + native approvals.
- 11 `*-subagent.agent.md` — implementation/research/test/docs subagents → native Copilot agent mode / subagents / `@-mention`; the three verifiers (`PlanAuditor`, `AssumptionVerifier`, `ExecutabilityVerifier`) → folded into the `controlflow-verify` skill.
- `governance/model-routing.json`, `governance/tool-grants.json`, `governance/agent-grants.json` — delegate to native. `governance/rename-allowlist.json` — re-evaluate in Phase 2.
- `governance/runtime-policy.json` retry/wave/compaction/stagnation knobs — native runtime + optional `.github/hooks/`.
- `docs/agent-engineering/` orchestration docs — retire `TOOL-ROUTING.md` (dispatch rules), `RELIABILITY-GATES.md` (wave/gate-event), `OBSERVABILITY.md` (gate events), `MODEL-ROUTING.md`, `MODEL-RESOLUTION-RULE.md`; re-evaluate `MIGRATION-CORE-FIRST.md` (may inform the Phase 5 plugin sync); keep `RISK-TAXONOMY.md`, `CLARIFICATION-POLICY.md`, `MEMORY-ARCHITECTURE.md`, `SCORING-SPEC.md`, `PART-SPEC.md` (slimmed to 1 agent), `PROMPT-BEHAVIOR-CONTRACT.md`.
- `skills/patterns/orchestration-audit-playbook.md` and any patterns duplicating native — prune; keep value-add patterns (`llm-behavior-guidelines`, `idea-to-prompt`, `decision-challenge`, `tdd-patterns`, `source-grounding`, `security-review-discipline`, `spec-driven-development`, `debugging-discipline`, `repo-memory-hygiene`, `reflection-loop`, `preflect-core`, `completeness-traceability`, `budget-tracking`, `code-simplification`, `error-handling-patterns`, `integration-validator`, `performance-patterns`, `memory-promotion-candidates`).
- `.cursor/agents/` + `.cursor/skills/` legacy mirror — freeze, then sync from canonical in Phase 5.
- Repo-root `*.agent.md` — relocate the one kept agent (`@Planner`) to `.github/agents/`; retire the rest.
- `plans/templates/phase-task-card-template.md`, `gate-event-template.md`, `code-context-pack-template.md` — retire (context packets / gate events / phase task cards are orchestration machinery no longer shipped); keep `plan-document-template.md`, `research-brief-template.md`, `spec-template.md`, `session-notes-template.md`, `session-outcome-template.md`, `verified-items-template.md`, `phase-completion-template.md` (re-evaluate), `traceability-index-template.yaml` (re-evaluate).

---

## 6. Data Flow

`user @Planner "task"` → `controlflow-plan` skill (Idea Interview if the request is vague; reads schema/template at invoke time; assigns complexity tier; writes the plan artifact to `plans/<task-slug>-plan.md`) → `controlflow-verify` skill inline (tier-gated phases 1 and/or 2 and/or 3; emits verdict) → if `APPROVED`: the user drives native Copilot agent mode / subagents / `@-mention` to implement → `controlflow-review` skill after implementation (delegates the mechanical/style pass to native Copilot code review; adds scope-drift + evidence + proactive vulnerability layer) → findings. `NEEDS_REVISION` → revise the plan and re-verify. `REJECTED` → replan or abstain. The routing stub in `.github/copilot-instructions.md` ties the sequence together, mirroring how the repo `CLAUDE.md` routes the slim Claude Code plugin.

---

## 7. Sequencing — Copilot-first, then sync

0. **Spike** — confirm exact `.github/skills/` + `.github/agents/` file formats, `@-mention` behavior in VS Code Chat, `/plan` integration points, and Copilot `hooks` availability.
1. **Build slim Copilot canonical surface** — 3 skills + `@Planner` agent + `.github/copilot-instructions.md` routing stub + slimmed governance + schema/template.
2. **Rewrite evals** under the new contract — contract-drift (schema + `project-context-registry.json` + `runtime-policy.json`) + behavior scenarios for the 3 skills; retire orchestrator/subagent/gate-event/model-routing scenarios.
3. **Retire the heavy core** — remove `Orchestrator.agent.md`, the 11 `*-subagent.agent.md`, `model-routing.json`, wave/retry machinery, orchestration docs, `.cursor` legacy, retired templates/patterns.
4. **Update docs** — `README.md`, tutorials (`docs/tutorial-en/`, `docs/tutorial-ru/`), `CONTRIBUTING.md`, `AGENTS.md`; write the native-vs-ControlFlow delegation-boundary doc.
5. **Sync plugins** — rework `plugins/controlflow-shared-source/` as a sync-OUT generator; regenerate `controlflow-codex/` and `controlflow-cursor/` from the new canonical form; verify parity.
6. **Release v1.0.**

---

## 8. Modern Tech Adoption (pattern transfer)

From the slim Claude Code plugin (proven) + Copilot native:
- **Schema-sourced skill bodies** — skills read the canonical schema/template at invoke time; never restate the contract.
- **Inline adversarial verify, no subagents** — adversarial stance + anti-rationalization table compensates for the lack of fresh-context isolation.
- **Tier-gated phase table** — a single table maps SMALL/MEDIUM/LARGE to verify phases; replaces the router skill.
- **Native-tool delegation stance** — "layer over, not replacement"; explicit failure check against duplicating the native pass.
- **Folded orchestration** — a prose reference doc replaces the orchestration skill/agent.
- **Portable reference docs** — mirage taxonomy, evidence discipline, security-review discipline are host-neutral and reused verbatim.
- **Modern model selection** — delegate to Copilot Auto model selection + per-agent `model` frontmatter (GPT-5.x / Claude Opus·Sonnet·Haiku / Gemini).
- **Optional `.github/hooks/`** — for any deterministic gate that remains (e.g., asserting a plan artifact exists before implementation), where Copilot hooks are available.

---

## 9. Error Handling & Verdicts

- **Keep** the failure taxonomy (`transient`/`fixable`/`needs_replan`/`escalate`/`model_unavailable`) as a portable reference consumed by the verify and review skills.
- **Remove** the retry/backoff/wave dispatch machinery — the native Copilot runtime handles retries and parallelism.
- Skills emit verdicts (`APPROVED`/`NEEDS_REVISION`/`REJECTED`); the routing stub in `.github/copilot-instructions.md` defines the response to each verdict.

---

## 10. Testing

`cd evals && npm test`, rewritten:
- **Contract-drift test** asserts plan-format anchors against `schemas/planner.plan.schema.json` + `governance/project-context-registry.json` + `governance/runtime-policy.json`.
- **Behavior scenarios** cover `controlflow-plan` (schema conformance, 7 semantic-risk categories each exactly once, tier classification, Mermaid rules), `controlflow-verify` (mirage detection, executability cold-start, verdict logic, confidence caps), `controlflow-review` (scope-drift, evidence labels, proactive vuln search, native-pass delegation).
- **Retire** all orchestrator/subagent/gate-event/model-routing/context-packet scenarios.
- Offline, no network, no live agents.
- **Manual verification** in real VS Code Copilot Chat (the actual harness): `@Planner` on a sample task end-to-end through plan → verify → implement (native) → review.

---

## 11. Success Criteria (measurable)

- Agent count: **13 → 1** (`@Planner`); custom-agent markdown **~2,160 → < 250 lines**.
- **3 Copilot skills** shipped (`controlflow-plan`/`-verify`/`-review`), schema-sourced.
- **Documented native-vs-ControlFlow delegation boundary**; an audit checklist confirms **zero** ControlFlow surfaces duplicate a native Copilot capability.
- Evals green under the new contract; contract-drift test passes.
- **v1.0 release** with updated `README.md` + tutorials (en/ru).
- codex/cursor plugins synced from canonical; parity verified.

---

## 12. Key Risks

- **Breaking existing users/plans** — mitigation: `plans/archive/` kept as history; migration note in README.
- **Losing specialized subagent personas** (`BrowserTester`, `UIImplementer`, `PlatformEngineer`) — mitigation: document how to recreate each as a native Copilot custom agent if wanted; the value-add patterns they embodied stay in `skills/patterns/`.
- **Copilot native feature uncertainties** — `@-mention` in VS Code Chat not screenshot-confirmed; `hooks` experimental in VS Code — confirmed in the Phase 0 spike; design degrades gracefully (skills work without hooks).
- **codex/cursor sync complexity** — the shared-source generator inversion is non-trivial; mitigation: Phase 5 has its own parity verification.
- **Tutorial rewrite effort** (en + ru, ~19 chapters each) — mitigation: scope the rewrite to architecture/agent-roster/orchestration/planning/review-pipeline/execution-pipeline/skills chapters; others need lighter touches.
- The full 7-category semantic-risk table (`data_volume`, `performance`, `concurrency`, `access_control`, `migration_rollback`, `dependency`, `operability`) is produced in the implementation plan.

---

## 13. Open Questions (resolved during planning)

- Exact `.github/skills/` and `.github/agents/` frontmatter shape Copilot expects (Phase 0 spike).
- Whether to keep a second thin custom agent (e.g., a reviewer persona) or strictly one (`@Planner`) — default: **one**; revisit if Phase 0 finds `@-mention` skill invocation alone is insufficient for discoverability.
- Whether `.github/hooks/` are reliable enough in VS Code to enforce the "plan artifact must exist before implementation" gate — default: **optional**, not required for v1.0.

---

## 14. References (Copilot native capabilities research)

- VS Code Subagents — https://code.visualstudio.com/docs/agents/subagents
- VS Code custom-agents — https://github.com/microsoft/vscode-docs/blob/36ba054f/docs/copilot/customization/custom-agents.md
- VS Code planning (`/plan`) — https://github.com/microsoft/vscode-docs/blob/c775dd9b/docs/copilot/agents/planning.md
- VS Code prompt files — https://github.com/microsoft/vscode-docs/blob/main/docs/copilot/customization/prompt-files.md
- VS Code agent skills — https://github.com/microsoft/vscode-docs/blob/36ba054f/docs/copilot/customization/agent-skills.md
- VS Code context-engineering guide (custom planning agent + plan-template + handoff) — https://github.com/microsoft/vscode-docs/blob/36ba054f/docs/copilot/guides/context-engineering-guide.md
- VS Code custom instructions — https://code.visualstudio.com/docs/agent-customization/custom-instructions
- GitHub Docs — custom-agents-configuration — https://github.com/github/docs/blob/main/content/copilot/reference/custom-agents-configuration.md
- GitHub Docs — customization cheat sheet — https://docs.github.com/en/copilot/reference/customization-cheat-sheet
- GitHub Docs — About Copilot code review — https://docs.github.com/en/copilot/concepts/agents/code-review
- Code review agentic GA (Mar 5 2026) — https://github.blog/changelog/2026-03-05-copilot-code-review-now-runs-on-an-agentic-architecture/
- Code review AGENTS.md support (Jun 18 2026) — https://github.blog/changelog/2026-06-18-copilot-code-review-agents-md-support-and-ui-improvements/
- GitHub Docs — About MCP — https://docs.github.com/en/copilot/concepts/context/mcp
- GitHub Docs — auto model selection — https://docs.github.com/en/copilot/concepts/models/auto-model-selection
- Copilot SDK custom agents — https://github.com/github/copilot-sdk/blob/main/docs/features/custom-agents.md
- Subagent-in-subagent default-on (Feb 24 2026) — https://github.com/microsoft/vscode/issues/297499