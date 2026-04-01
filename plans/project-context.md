# Project Context: Copilot Atlas

> Shared reference consumed by all 11 agents. Every agent that lists `plans/project-context.md` in its Resources section reads this file first.
> Last verified: 2026-04-01

## Project Overview

Copilot Atlas is a multi-agent orchestration system for VS Code Copilot. It adds deterministic **P.A.R.T contracts** (Prompt → Archive → Resources → Tools), strict JSON Schema 2020-12 outputs, and reliability gates to VS Code's custom agent infrastructure.

The system separates concerns into three layers:
- **Orchestration** (Atlas, Prometheus) — planning, gating, approval, delegation.
- **Discovery/Audit** (Oracle, Scout, Challenger, Code-Review) — read-only research and verification.
- **Execution** (Sisyphus, Frontend-Engineer, DevOps, DocWriter, BrowserTester) — acting agents that modify files and run commands.

## Tool Grant Philosophy

- Use least-privilege grants: every agent frontmatter `tools:` list should contain only the tools explicitly routed or required by that agent's body instructions.
- Do not grant tools for hypothetical future workflows. Add them only when the prompt body, evals, and role description all require them.
- Atlas and Prometheus are the only intentionally wider tool surfaces because they orchestrate, clarify, and create top-level artifacts.
- Read-only agents should prefer search/read-only grants and avoid edit/execute capabilities entirely.
- Acting agents should not carry orchestration-only grants such as global todo management unless the prompt explicitly owns that responsibility.

## Agent Role Matrix

| Agent | File | Model | Output Schema | Approval Posture | External Tools | Primary Eval Scenarios |
|-------|------|-------|---------------|------------------|----------------|------------------------|
| **Atlas** | `Atlas.agent.md` | Claude Sonnet 4.6 | `atlas.gate-event.schema.json` | Owns all human approval gates; blocks on destructive/irreversible ops | fetch, githubRepo | consistency-repeatability, wave-execution, failure-retry, atlas-challenger-integration, atlas-retry-backoff, atlas-phase-verification, atlas-todo-orchestration, safety-approval-gate |
| **Prometheus** | `Prometheus.agent.md` | Claude Opus 4.6 | `prometheus.plan.schema.json` | Planning-only; delegates all approvals to Atlas | fetch, githubRepo, Context7 | prometheus-schema-output, prometheus-mermaid-output, prometheus-ambiguity-plus-schema |
| **Oracle** | `Oracle-subagent.agent.md` | GPT-5.4 | `oracle.research-findings.schema.json` | N/A — read-only; no destructive actions | fetch | predictability-abstain, robustness-paraphrase |
| **Scout** | `Scout-subagent.agent.md` | GPT-5.4 mini | `scout.discovery.schema.json` | N/A — read-only; no external access | None | agent-triggering-quality |
| **Code-Review** | `Code-Review-subagent.agent.md` | GPT-5.4 | `code-review.verdict.schema.json` | N/A — verification-only; no edits | None | atlas-phase-verification |
| **Challenger** | `Challenger-subagent.agent.md` | GPT-5.4 | `challenger.plan-audit.schema.json` | N/A — read-only plan auditor | None | challenger-contract, challenger-adversarial-detection, challenger-replan-loop, atlas-challenger-integration |
| **Sisyphus** | `Sisyphus-subagent.agent.md` | Claude Sonnet 4.6 | `sisyphus.execution-report.schema.json` | Escalates destructive ops outside scope to Atlas | fetch, githubRepo | sisyphus-contract |
| **Frontend-Engineer** | `Frontend-Engineer-subagent.agent.md` | Gemini 3.1 Pro (Preview) | `frontend.execution-report.schema.json` | Escalates layout overhauls / design-system changes to Atlas | fetch, githubRepo | frontend-contract |
| **DevOps** | `DevOps-subagent.agent.md` | Claude Sonnet 4.6 | `devops.execution-report.schema.json` | Production and security-sensitive ops require explicit user approval before execution | fetch, githubRepo | devops-contract |
| **DocWriter** | `DocWriter-subagent.agent.md` | Gemini 3.1 Pro (Preview) | `docwriter.execution-report.schema.json` | Documentation-only; approvals delegated to Atlas | fetch | docwriter-contract |
| **BrowserTester** | `BrowserTester-subagent.agent.md` | GPT-5.4 mini | `browser-tester.execution-report.schema.json` | Critical findings escalated to Atlas; no independent remediation | fetch | browser-tester-contract |

## Executor Agent Contract

Prometheus plan phases use a machine-readable `executor_agent` field. Valid values are:

- `Scout-subagent`
- `Oracle-subagent`
- `Sisyphus-subagent`
- `Frontend-Engineer-subagent`
- `DevOps-subagent`
- `DocWriter-subagent`
- `BrowserTester-subagent`
- `Code-Review-subagent`

`executor_agent` names the primary subagent Atlas dispatches for the phase. Atlas treats the field as authoritative and routes legacy phases without `executor_agent` back to Prometheus for replan instead of inferring ownership. `Challenger-subagent` is excluded because Challenger only runs in Atlas's plan-review gate, not normal phase execution.

## Decision Tree — Which Agent to Invoke

```
Task type?
├── Plan a multi-step feature or refactor
│   └── Invoke Prometheus → handoff plan to Atlas
│
├── Execute an approved plan
│   └── Invoke Atlas (it will dispatch subagents per wave)
│
├── Research: find how something works in the codebase
│   └── Invoke Oracle (evidence-backed findings with confidence scores)
│
├── Discover: find files, symbols, usage patterns quickly
│   └── Invoke Scout (parallel search, no external access)
│
├── Implement: backend, core logic, scripts, tooling
│   └── Invoke Sisyphus (TDD-first implementation)
│
├── Implement: UI, components, styling
│   └── Invoke Frontend-Engineer (WCAG + responsive gates)
│
├── Deploy: CI/CD, containers, infrastructure
│   └── Invoke DevOps (idempotency mandate + rollback protocol)
│
├── Document: API docs, architecture docs, walkthroughs
│   └── Invoke DocWriter (parity verification against source)
│
├── Test: E2E browser scenarios, accessibility audit
│   └── Invoke BrowserTester (health-first gate required)
│
├── Review: verify implementation correctness and safety
│   └── Invoke Code-Review (returns schema verdict, blocks only on confirmed issues)
│
└── Audit: adversarial review of an unexecuted plan
    └── Invoke Challenger (APPROVED / NEEDS_REVISION / REJECTED / ABSTAIN)
```

## Typical Workflow

```
User Request
    └── Prometheus (phased plan with waves + Mermaid diagrams)
         └── Atlas (orchestrates wave-based execution)
              ├── [Conditional] Challenger (plan audit for 3+ phase or high-risk plans)
              ├── Wave 1: Foundation         → Scout / Oracle
              ├── Wave 2: Implementation     → Sisyphus + Frontend-Engineer + DevOps (parallel)
              ├── Wave 3: Verification       → Code-Review + BrowserTester (parallel)
              └── Wave 4: Documentation     → DocWriter
```

### Failure Routing Quick Reference

| Classification | Atlas Action | Max Retries |
|---|---|---|
| `transient` | Retry same agent unchanged | 3 |
| `fixable` | Retry same agent with fix hint | 1 |
| `needs_replan` | Delegate to Prometheus for targeted replan | 1 |
| `escalate` | STOP — present to user with evidence | 0 |

## Directory Conventions

```
/
├── *.agent.md              # Agent prompt files (P.A.R.T structure mandatory)
├── .github/
│   └── copilot-instructions.md  # Shared workspace policies (Continuity, Failure Classification, NOTES.md)
├── docs/agent-engineering/
│   ├── PART-SPEC.md        # Agent structure specification and 9-item compliance checklist
│   ├── RELIABILITY-GATES.md # 8 reliability dimensions with acceptance gates
│   ├── CLARIFICATION-POLICY.md # When to use askQuestions vs NEEDS_INPUT
│   ├── TOOL-ROUTING.md     # Deterministic rules for local vs external tool selection
│   ├── COMPLIANCE-GAPS.md  # Audit log of per-agent compliance state
│   └── GOVERNANCE-WEIGHT-AUDIT.md # Token footprint analysis and lite-mode recommendations
├── evals/
│   ├── README.md           # Eval documentation and running instructions
│   ├── package.json        # Node.js harness dependencies
│   ├── validate.mjs        # Structural validation runner (schemas, scenarios, refs, P.A.R.T)
│   └── scenarios/          # JSON fixture files (one per test scenario)
├── plans/
│   ├── project-context.md  # This file — shared context for all agents
│   └── *.md                # Plan artifacts created by Prometheus, completion summaries
└── schemas/
    └── *.schema.json       # JSON Schema 2020-12 output contracts (one per agent or shared)
```

## Schema Conventions

- All schemas use JSON Schema 2020-12 (`"$schema": "https://json-schema.org/draft/2020-12/schema"`).
- All schemas set `"additionalProperties": false` to enforce contract strictness.
- All schemas declare `"required"` arrays explicitly — no implicit required fields.
- The shared `clarification-request.schema.json` is `$ref`-ed by the 5 acting agent schemas (Sisyphus, Frontend-Engineer, DevOps, DocWriter, BrowserTester).
- Atlas does not produce an execution report — it produces `AtlasGateEvent` objects (`atlas.gate-event.schema.json`).
- Prometheus produces a `PrometheusPlan` object (`prometheus.plan.schema.json`) AND a markdown plan file.

## Failure Taxonomy Reference

All agents classify failures into exactly these four classes (defined in `.github/copilot-instructions.md`):

| Class | Meaning | Atlas Routes To |
|-------|---------|-----------------|
| `transient` | Flaky/temporary — retry identical | Same agent (≤3 retries) |
| `fixable` | Small correctable error | Same agent with fix hint (≤1 retry) |
| `needs_replan` | Architecture mismatch | Prometheus (targeted replan) |
| `escalate` | Security/data/unresolvable blocker | User — STOP immediately |

## Shared Policies Reference

Canonical policy documents that agents point to (not duplicate):

| Policy | File | Content |
|--------|------|---------|
| Continuity + NOTES.md baseline | `.github/copilot-instructions.md` | Context reset survival, NOTES.md structure |
| Failure Classification enum | `.github/copilot-instructions.md` | The 4 classes with routing rules |
| P.A.R.T specification | `docs/agent-engineering/PART-SPEC.md` | Section order, compliance checklist |
| Reliability gates | `docs/agent-engineering/RELIABILITY-GATES.md` | 8 dimensions with acceptance gates |
| Clarification rules | `docs/agent-engineering/CLARIFICATION-POLICY.md` | 5 mandatory classes, format, threshold |
| Tool routing rules | `docs/agent-engineering/TOOL-ROUTING.md` | Local-first, external-doc mandatory cases, per-agent matrix |
