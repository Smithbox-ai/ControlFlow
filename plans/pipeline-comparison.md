# Pipeline Comparison: Orchestrator vs bishx

This document maps the Orchestrator agent pipeline against the bishx reference pipeline, identifying feature parity, gaps, and adaptations.

## 1 — Pipeline Diagrams

### Orchestrator Pipeline (Current)

```text
User Request
    │
    ▼
Idea Interview Gate (Planner — if request is vague/abstract)
    │
    ▼
Clarification Gate (Planner — mandatory clarification classes)
    │
    ▼
Research Gate (Researcher / CodeMapper — as needed)
    │
    ▼
Complexity Gate (TRIVIAL / SMALL / MEDIUM / LARGE)
    │
    ▼
Plan Generation (Planner)
    │
    ▼
Plan Approval (User — WAITING_APPROVAL)
    │
    ▼
Plan Review Gate (PlanAuditor — conditional: 3+ phases OR confidence < 0.9 OR high-risk)
    ├── APPROVED ────────────────────────────────────────────────────────┐
    ├── NEEDS_REVISION → (Planner replan) ────────────────────────────┤
    └── REJECTED → User decision                                        │
                                                                        ▼
                                              Implementation Loop (per phase, per wave)
                                                        │
                                                        ▼
                                               PreFlect Gate (scope drift, safety)
                                                        │
                                                        ▼
                                   Phase Executor (CoreImplementer / UIImplementer / PlatformEngineer /
                                                   TechnicalWriter per executor_agent field)
                                                        │
                                                        ▼
                                            AssumptionVerifier Gate (AssumptionVerifier-subagent — MEDIUM/LARGE)
                                                        │
                                                        ▼
                                            ExecutabilityVerifier Gate (ExecutabilityVerifier-subagent — LARGE)
                                                        │
                                                        ▼
                                            Code Review (CodeReviewer — all tiers)
                                                        │
                                                        ├── APPROVED → Commit prompt (User)
                                                        └── NEEDS_REVISION → Retry loop (max 5)
                                                                    │
                                                        ▼ (next phase / wave)
                                                        │
                                                        ▼
                                               Completion Gate
                                                        │
                                                        ▼
                                         Session Outcome Logging
                                                        │
                                                        ▼
                                          Completion Summary (User)
```

### bishx Reference Pipeline

```text
User Idea
    │
    ▼
Idea Decomposition (bishx Idea-to-Prompt skill)
    │
    ▼
Prompt Structuring
    │
    ▼
Planning (bishx Planner)
    │
    ▼
Plan Review ×N (bishx ReviewLoop — iterative until convergence)
    │
    ▼
Execution (bishx Executor)
    │
    ▼
Test (bishx TestRunner)
    │
    ▼
Audit (bishx Auditor — post-execution completeness and integration checks)
```

## 2 — Feature-by-Feature Comparison

| Feature | bishx | Orchestrator (Current) | Notes |
| --- | --- | --- | --- |
| Idea decomposition interview | ✅ Native skill | ✅ Planner skill (idea-to-prompt.md) | Adopted as a Planner skill |
| Structured planning | ✅ | ✅ Planner + schema | Orchestrator adds JSON schema contract |
| Iterative plan review | ✅ ReviewLoop | ✅ PlanAuditor + Planner loop (max 5) | Orchestrator enforces convergence detection |
| Execution | ✅ Executor | ✅ CoreImplementer / Frontend / PlatformEngineer | Orchestrator routes by `executor_agent` field |
| Post-execution test | ✅ TestRunner | ✅ BrowserTester (E2E) + CodeReviewer | Orchestrator code review includes test evidence |
| Post-execution audit | ✅ Auditor | ✅ AssumptionVerifier-subagent | Orchestrator separates audit into its own agent |
| Dry-run / executability check | ❌ Not present | ✅ ExecutabilityVerifier-subagent | Orchestrator-only: cold-start simulation |
| Complexity-based routing | ❌ Not present | ✅ TRIVIAL/SMALL/MEDIUM/LARGE gate | Orchestrator-only: tier-gated review pipeline |
| VS Code integration | ❌ | ✅ Native `.agent.md` + frontmatter | Orchestrator-only: VS Code Copilot Agent Mode |
| Structured agent contracts (P.A.R.T.) | ❌ | ✅ PART-SPEC + validator | Orchestrator-only: mandatory section structure |
| Tool least-privilege manifest | ❌ | ✅ governance/tool-grants.json | Orchestrator-only: drift detection per agent |
| Governance-as-code | Partial | ✅ governance/ directory | Orchestrator formalizes policy in JSON |
| Session telemetry / outcome log | ❌ | ✅ plans/session-outcomes.md | Orchestrator-only: persistent flat-file log |
| Schema-validated delegation | ❌ | ✅ orchestrator.delegation-protocol.schema.json | Orchestrator-only: structured subagent calls |
| Eval scenario harness | ❌ | ✅ evals/validate.mjs (106 checks) | Orchestrator-only: structural validation suite |
| Clarification policy | Implicit | ✅ CLARIFICATION-POLICY.md | Orchestrator formalizes trigger classes |
| Approval gate (human-in-the-loop) | Partial | ✅ WAITING_APPROVAL state machine | Orchestrator explicit stop-rule enforcement |
| State machine (PLANNING→ACTING→REVIEWING) | Implicit | ✅ Explicit Orchestrator state machine | Orchestrator codifies transitions |
| Semantic risk taxonomy | ❌ | ✅ plans/project-context.md | Orchestrator-only: structured risk review |
| Skill library (indexed patterns) | ✅ | ✅ skills/index.md + patterns/ (7 skills) | Orchestrator adopted bishx skill architecture |
| Completeness traceability skill | ✅ | ✅ completeness-traceability.md | Adopted from bishx |
| Integration validator skill | ✅ | ✅ integration-validator.md | Adopted from bishx |
| Quantitative scoring | ❌ | ✅ SCORING-SPEC.md | Orchestrator-only: numeric confidence/quality scores |

## 3 — What Orchestrator Has That bishx Doesn't

1. **VS Code native integration** — `.agent.md` agent mode, frontmatter tool grants, no shell hooks or process spawning.
2. **P.A.R.T. section contract** — Every agent is validated for mandatory Prompt/Archive/Resources/Tools sections in order.
3. **Governance-as-code** — `governance/tool-grants.json` enforces tool least-privilege per agent; `governance/runtime-policy.json` externalizes Orchestrator operational knobs.
4. **Schema-validated delegation** — Delegation contracts use `orchestrator.delegation-protocol.schema.json`; all subagent outputs are schema-validated.
5. **Structural eval harness** — `evals/validate.mjs` runs 106 checks (schema compilation, scenario integrity, reference integrity, tool-grant drift, P.A.R.T. order, skill library consistency) in ~1 second.
6. **Complexity-gated review pipeline** — TRIVIAL plans skip adversarial review; LARGE plans get full PlanAuditor+AssumptionVerifier+ExecutabilityVerifier treatment.
7. **ExecutabilityVerifier-subagent** — Dedicated cold-start executability simulation before implementation begins.
8. **Session telemetry** — `plans/session-outcomes.md` provides a flat-file episodic memory workaround for VS Code's no-persistent-state constraint.
9. **Quantitative scoring** — `SCORING-SPEC.md` defines numeric thresholds for confidence, code quality, and review acceptance.

## 4 — What bishx Has That Orchestrator Has Adopted as Skills

| bishx Capability | Orchestrator Adoption |
| --- | --- |
| Idea-to-Prompt interview protocol | `skills/patterns/idea-to-prompt.md` + Planner step -1 |
| Completeness Validator (RTM checks) | `skills/patterns/completeness-traceability.md` |
| Integration Validator (dependency/contract checks) | `skills/patterns/integration-validator.md` |

## 5 — Known Gaps (Items Not Yet Adopted)

| Gap | Blocker | Future Path |
| --- | --- | --- |
| Vector store episodic memory | VS Code has no built-in vector store | Flat-file workaround; upgrade if VS Code adds persistent agent memory |
| Dynamic model dispatch | VS Code `model:` frontmatter is static | User can override via UI; no programmatic alternative exists |
| True runtime plugin registration | Requires VS Code extension API | Not planned; auto-discovery via `governance/tool-grants.json` is the ceiling |
| Semantic eval runner | No in-repo runner for behavioral assertions | Scenarios are executable contracts; pending external infrastructure |
