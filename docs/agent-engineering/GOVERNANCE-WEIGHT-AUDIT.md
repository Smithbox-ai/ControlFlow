# Governance Weight Audit

> **Purpose:** Identify token overhead caused by redundant, low-value, or complexity-conditional content in agent prompts. Recommend targeted reductions that do not sacrifice safety gates.
>
> Scope: `Orchestrator.agent.md`, `Planner.agent.md`.
> Analysis date: 2026-04-01.

## Methodology

Token estimates are approximate: **1 line ≈ 15 tokens** (mixed prose + YAML/JSON). File sizes measured from current workspace state. Redundancy is classified against `.github/copilot-instructions.md` (shared policies) and `plans/project-context.md` (agent role matrix, now available).

---

## Orchestrator.agent.md — Token Footprint by Section

| Section | Lines | Est. Tokens | Notes |
|---------|-------|------------|-------|
| Mission + Scope | 14 | 210 | Load-bearing |
| Deterministic Contracts | 5 | 75 | Load-bearing |
| State Machine | 20 | 300 | Load-bearing, non-redundant |
| Planning vs Acting Split | 6 | 90 | Load-bearing |
| PreFlect | 10 | 150 | Load-bearing |
| Human Approval Gate | 8 | 120 | Load-bearing |
| Clarification Triggers + NEEDS_INPUT Routing | 22 | 330 | Load-bearing |
| Context Compaction | 5 | 75 | Load-bearing |
| Agentic Memory Policy | 8 | 120 | Load-bearing |
| State Tracking + Todo Protocol | 22 | 330 | Load-bearing |
| Resources list | 10 | 150 | Load-bearing |
| Tools (all sub-sections) | 15 | 225 | Load-bearing |
| Execution Protocol | 70 | 1,050 | Load-bearing, but has redundant subsections (see below) |
| Phase Verification Checklist | 8 | 120 | Load-bearing |
| Delegation Heuristics | 10 | 150 | **Partially redundant** — project-context.md now has decision tree |
| Stopping Rules | 8 | 120 | Load-bearing |
| **Subagent Delegation Contracts** | **15** | **225** | **Redundant** — duplicates agent role matrix in project-context.md |
| Wave-Aware Execution | 8 | 120 | Complexity-conditional (only relevant for 3+ phase plans) |
| Failure Classification Handling | 14 | 210 | **Partially redundant** — copilot-instructions.md has the enum |
| **Retry Reliability Policy** | **22** | **330** | Complexity-conditional (parallel execution, rate limits) |
| Batch Approval | 8 | 120 | Complexity-conditional (multi-wave plans) |
| Output Requirements (plan templates) | 60 | 900 | **High overhead** — templates duplicated in Planner |

**Total estimated: ~313 lines ≈ 4,695 tokens** *(updated 2026-04-04 post-template externalization; original pre-modernization estimate was ~350 lines ≈ 5,250 tokens)*

---

## Planner.agent.md — Token Footprint by Section

| Section | Lines | Est. Tokens | Notes |
|---------|-------|------------|-------|
| Mission + Scope | 12 | 180 | Load-bearing |
| Mandatory Workflow Procedure | 12 | 180 | Load-bearing |
| Clarification Policy pointer | 6 | 90 | Load-bearing |
| Abstention Policy | 8 | 120 | Load-bearing |
| PreFlect | 8 | 120 | Load-bearing |
| Context Compaction + Memory | 15 | 225 | Load-bearing |
| Resources list | 10 | 150 | Load-bearing |
| Tools (all sub-sections) | 30 | 450 | Load-bearing |
| **Plan Document Template** | **55** | **825** | **High overhead** — present here AND referenced in Orchestrator output templates |
| Plan Quality Standards | 12 | 180 | Partially redundant with template requirements |
| Research Scaling | 8 | 120 | Useful heuristic, not redundant |
| Non-Negotiable Rules | 10 | 150 | Load-bearing |

**Total estimated: ~185 lines ≈ 2,775 tokens**

---

## Findings

### Finding 1: Subagent Delegation Contracts — Redundant (HIGH VALUE)

**Location:** `Orchestrator.agent.md` — `### Subagent Delegation Contracts`  
**Lines:** ~15 | **Tokens:** ~225  

The list maps each agent name to its role and expected deliverable. This information is now fully covered by the Agent Role Matrix in `plans/project-context.md`, which Orchestrator reads at session start (referenced in Resources).

**Recommendation:** Replace the full list with a single pointer:
```
For agent descriptions, roles, and expected deliverables, see `plans/project-context.md` — Agent Role Matrix.
```
**Token savings: ~200 tokens** (keep ~25 for the pointer).

---

### Finding 2: Failure Classification Detail — Partially Redundant (MEDIUM VALUE)

**Location:** `Orchestrator.agent.md` — `### Failure Classification Handling`  
**Lines:** ~14 | **Tokens:** ~210  

The table (transient/fixable/needs_replan/escalate with actions and max retries) duplicates the Failure Classification enum already in `.github/copilot-instructions.md`. However, the `Max Retries` column and routing action specifics are Orchestrator-specific.

**Recommendation:** Keep the routing table but remove the introductory prose (2 lines) that re-explains the four classes already defined in shared instructions.  
**Token savings: ~30 tokens** (marginal, but clean).

---

### Finding 3: Output Requirements Templates — Significant Overhead (MEDIUM VALUE, HIGH RISK)

**Location:** `Planner.agent.md` — `### Plan Document Template` (~55 lines)  
**Location:** `Orchestrator.agent.md` — `### Plan File Template`, `### Phase Completion Template`, `### Plan Completion Template` (~60 lines combined)

The plan document template is defined in Planner (~55 lines) and an equivalent structure is in Orchestrator output requirements. These templates are essential for plan quality but represent ~900 tokens of overhead per invocation.

**Recommendation (advisory only, do not implement without plan):** Extract templates to the shared `plans/templates/` directory and replace in-prompt content with a file reference. This is the highest-impact reduction but carries non-trivial risk — if agents fail to load the external file, plan output quality degrades silently.  
**Potential token savings: ~800–900 tokens**  
**Risk:** Medium — template availability depends on the agent reading from `plans/templates/` successfully before generating output.  
**Decision:** Do NOT implement without evaluating how often plan generation fails when referenced files are unavailable.

---

### Finding 4: Delegation Heuristics — Partially Redundant (LOW VALUE)

**Location:** `Orchestrator.agent.md` — `### Delegation Heuristics`  
**Lines:** ~10 | **Tokens:** ~150  

The decision tree ("Handle directly" vs "Delegate to subagent" based on complexity thresholds) is useful operational guidance. It is NOT duplicated in project-context.md (the project-context decision tree is about which agent to invoke, not when to delegate vs handle). This section is load-bearing.

**Recommendation:** No change.

---

### Finding 5: Complexity-Conditional Sections — Lite-Mode Candidate (MEDIUM VALUE)

**Location:** `Orchestrator.agent.md` — Wave-Aware Execution (8 lines), Retry Reliability Policy (22 lines), Batch Approval (8 lines)

These sections are only exercised when plans have multiple waves, parallel agents, or rate-limit conditions. For single-phase, single-agent tasks, they add ~330 tokens that will never be used.

**Recommendation (advisory):** These sections cannot be safely removed from the Orchestrator prompt without creating a separate "lite" agent. The most practical path if lightweight execution matters is to **bypass Orchestrator entirely** for single-phase tasks: invoke CoreImplementer or the appropriate specialized agent directly. Orchestrator is optimized for multi-phase orchestration; using it for single-agent tasks is like loading a factory for a one-off request.  
**Net savings if bypassing Orchestrator for single tasks:** ~5,250 tokens (entire Orchestrator prompt).

---

## Lite-Mode Recommendation

> Use Orchestrator only when you actually need orchestration.

| Task Complexity | Recommended Invocation | Est. Prompt Overhead |
|---|---|---|
| Single action (1 file, obvious implementation) | Invoke specialized agent directly (CoreImplementer, TechnicalWriter, etc.) | ~300–800 tokens |
| 1-phase plan (clear scope, no cross-cutting) | Invoke Planner for plan, then specialized agent directly | ~3,000 tokens |
| 2-phase sequential (no parallel agents) | Invoke Planner + Orchestrator, plan has 2 phases → PlanAuditor skipped, Mermaid skipped, Batch Approval trivial | ~8,000–10,000 tokens |
| 3+ phases or cross-cutting concern | Full Orchestrator pipeline as designed | ~10,000–20,000+ tokens |

The system is already lite-mode-aware for 1–2 phase plans: PlanAuditor is skipped (conditional on 3+ phases), Mermaid is skipped (conditional on 3+ phases), and Batch Approval is trivial for a single wave. The main optimization remaining is architectural — choose the right entry point.

---

## Post-Modernization Token Impact (2026-04-04)

### Template Externalization Savings
Orchestrator embedded templates (~100 lines, ~1,500 tokens) replaced with file references (~5 lines, ~75 tokens).
**Net savings: ~1,425 tokens per Orchestrator invocation.**

Planner Plan Document Template (~55 lines, ~825 tokens) replaced with file reference (~2 lines, ~30 tokens).
**Net savings: ~795 tokens per Planner invocation.**

### New Agent Overhead
| Agent | Lines | Est. Tokens | Dispatch Frequency |
|-------|-------|------------|-------------------|
| AssumptionVerifier-subagent | ~131 | ~1,965 | Conditional (MEDIUM/LARGE tier only) |
| ExecutabilityVerifier-subagent | ~136 | ~2,040 | Conditional (LARGE tier only) |

### New Sections Added to Existing Agents
| Agent | Section | Lines | Est. Tokens |
|-------|---------|-------|------------|
| Orchestrator | Iterative Review Loop, Complexity Routing, Observability | ~60 | ~900 |
| PlanAuditor | Quantitative Scoring Protocol | ~20 | ~300 |
| CodeReviewer | Expanded Issue Validation, Scoring Protocol | ~30 | ~450 |
| Planner | Complexity Gate, Skill Selection | ~15 | ~225 |

### Net Assessment
- Template savings offset most new section additions.
- New agents (AssumptionVerifier, ExecutabilityVerifier) are dispatched conditionally — TRIVIAL/SMALL tasks incur zero overhead.
- For LARGE tasks (full pipeline): net increase ~2,000-3,000 tokens from new agents, partially offset by ~2,200 tokens in template savings.
- Recommendation: the complexity gate ensures lightweight tasks use minimal resources.

## Actionable Recommendations (Safe to Implement)

| Finding | Action | Files | Token Savings |
|---------|--------|-------|--------------|
| 1 — Subagent Delegation Contracts | Replace with project-context.md pointer | `Orchestrator.agent.md` | ~200 tokens |
| 2 — Failure Classification intro | Remove 2-line re-explanation of shared enum | `Orchestrator.agent.md` | ~30 tokens |

**Total safe savings: ~230 tokens per Orchestrator invocation.**

## Advisory Recommendations (Require Planning)

| Finding | Action | Risk | Token Savings |
|---------|--------|------|--------------|
| 3 — Plan templates | Extract to `plans/templates/` | Medium | ~800–900 tokens |
| 5 — Lite-mode bypass | Use specialized agents directly for simple tasks | Low | ~5,000+ tokens (bypassing Orchestrator) |
