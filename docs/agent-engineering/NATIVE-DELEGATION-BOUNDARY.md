# Native Delegation Boundary — ControlFlow for VS Code Copilot

> **Purpose.** This is the canonical record of what GitHub Copilot provides natively (as of June 2026) versus what ControlFlow keeps as its irreducible value-add. The rule is simple: **ControlFlow ships no surface that duplicates a native Copilot capability.** Where Copilot is native, ControlFlow delegates; where Copilot is not native, ControlFlow keeps.

This document is the audit artifact referenced by the refactoring spec (§2.3) and the Phase 4 acceptance criterion: an audit checklist confirms **zero** ControlFlow surfaces duplicate a native Copilot capability.

## 1. The delegation table

Research restricted to official GitHub/VS Code docs and 2025–2026 changelog announcements. All items are GA unless noted.

| ControlFlow surface | Copilot native now? | Delegation |
|---|---|---|
| Custom agents via `@-mention` (`.agent.md`) | ✅ GA (VS Code 1.106+, Feb 2026) | **Delegate** — ControlFlow's `.agent.md` is already a Copilot agent |
| Subagent dispatch + parallelism | ✅ GA default-on (Feb 24 2026) | **Delegate** — drop the Orchestrator dispatch state machine |
| Plan mode (`/plan`: Discovery → Alignment → Design → Refinement) | ✅ GA | **Layer over** — keep the CF plan *format*; use native discovery |
| Code review (agentic, Low/Medium, AGENTS.md + skills + MCP) | ✅ GA (Mar 5 2026) | **Delegate the mechanical pass** — keep the CF scope-drift + evidence layer |
| Skills library (`.github/skills/` — one `SKILL.md` per skill) | ✅ GA (portable across VS Code / CLI / cloud / review) | **Use** — ship ControlFlow as skills |
| MCP, model selection, approvals, custom instructions | ✅ GA | **Delegate** |
| Schema-enforced plan format + 7-category semantic risk | ❌ not native | **Keep** |
| Adversarial verify (`APPROVED` / `NEEDS_REVISION` / `REJECTED`, mirage, cold-start) | ❌ not native | **Keep** |
| Tier-gated workflow policy (`TRIVIAL` / `SMALL` / `MEDIUM` / `LARGE`) | ❌ not native | **Keep** |
| Plan-vs-implementation scope-drift comparison | ❌ not native | **Keep** |
| Contract-drift eval suite | ❌ not native | **Keep** |

### How to read the table

- **Delegate** — Copilot does this natively and well. ControlFlow does not ship a competing surface. The legacy ControlFlow surface here is retired (Phase 3).
- **Layer over** — Copilot does the broad activity natively; ControlFlow keeps a thin discipline layer on top that Copilot does not provide (the schema-anchored plan *format*, the scope-drift + evidence *layer*). The layer must add something native lacks, or it is deleted.
- **Use** — the capability is the delivery vehicle. ControlFlow ships as `.github/skills/` because Copilot natively loads skills.
- **Keep** — Copilot does not provide this. It is ControlFlow's reason to exist.

## 2. What ControlFlow ships (the slim surface)

After the refactor, the entire shipped ControlFlow surface for VS Code Copilot is:

- `.github/agents/controlflow-planner.agent.md` — one `@controlflow-planner` custom agent (Copilot Auto model picker, no `model:` frontmatter). Produces the plan; hands execution to native Copilot.
- `.github/skills/controlflow-plan/`, `.github/skills/controlflow-verify/`, `.github/skills/controlflow-review/` — three skills (plan → verify → review).
- `.github/copilot-instructions.md` — the shared routing stub.

That is the full shipped surface. There are **no shipped subagents**. The `executor_agent` names in plans (CodeMapper-subagent, Researcher-subagent, CoreImplementer-subagent, UIImplementer-subagent, PlatformEngineer-subagent, TechnicalWriter-subagent, BrowserTester-subagent, CodeReviewer-subagent) and the three inline verify roles (PlanAuditor, AssumptionVerifier, ExecutabilityVerifier) are **conceptual role labels** the Planner assigns in plan phases and native Copilot executes inline — not shipped agent files. See `plans/project-context.md` for the role taxonomy.

## 3. Audit checklist — zero duplication

The Phase 3 delegation-boundary audit walked every shipped surface and confirmed none duplicates a native Copilot capability. The checklist (re-run on any change to the shipped surface):

- [ ] `.github/agents/controlflow-planner.agent.md` — produces plans; does not re-implement native `/plan` discovery, native subagent dispatch, native approvals, or native model selection. ✅
- [ ] `.github/skills/controlflow-plan/` — schema-anchored plan *format* (not native); uses native discovery. Does not ship a planner subagent. ✅
- [ ] `.github/skills/controlflow-verify/` — adversarial verify (not native); runs inline. Does not ship verifier subagents. ✅
- [ ] `.github/skills/controlflow-review/` — scope-drift + evidence + proactive-vulnerability layer (not native); delegates the mechanical/style review pass to native Copilot code review. ✅
- [ ] `.github/copilot-instructions.md` — routing stub; does not re-implement native custom-instructions, MCP, or approval mechanics. ✅
- [ ] `governance/runtime-policy.json` — three surviving blocks (`review_pipeline_by_tier`, `semantic_risk_policy`, `verdict_routing`), all "Keep" rows. No retired `model-routing` / `tool-grants` / `agent-grants` / retry-budget / wave-dispatch surfaces. ✅
- [ ] `governance/project-context-registry.json` — role roster + matrix only; no tool-grant or model-routing rows. ✅
- [ ] `skills/patterns/` — value-add patterns only (see §5); no pattern duplicates a native capability. ✅

**Result:** zero shipped ControlFlow surfaces duplicate a native Copilot capability. Every "Delegate" row is retired; every "Layer over" row adds a non-native discipline; every "Keep" row has no native equivalent.

## 4. Native feature uncertainties (de-risked in the Phase 0 spike)

- **`@-mention` invocation in VS Code Chat** — confirmed for Visual Studio 2026; strongly implied for VS Code but not screenshot-confirmed in VS Code docs. **Design degrades gracefully:** the GA-confirmed invocation path is selecting `controlflow-planner` from the Copilot Chat **agents dropdown** in Agent mode. `@controlflow-planner` is a nice-to-have if it surfaces. README quick-start defaults to the dropdown path.
- **Copilot `hooks` (the `.github/hooks/` surface)** — experimental in VS Code, GA on CLI / GitHub.com. **Design degrades gracefully:** ControlFlow skills work without hooks; hooks are an optional enhancement, not a dependency.

When a native feature is uncertain, the slim model depends only on the confirmed subset and treats the rest as optional.

## 5. Recreating a specialized agent as a native Copilot custom agent

The refactor retires the 13 specialized `*.agent.md` files. Their *personas* (BrowserTester, UIImplementer, PlatformEngineer) are not lost — the value-add patterns they embodied remain in `skills/patterns/`. If you want a specialized persona back, recreate it as a **native Copilot custom agent** (a new file under `.github/agents/`) and have `controlflow-planner` assign it as a phase `executor_agent`. The planner treats any agent file under `.github/agents/` as a valid conceptual executor role.

### Recipe

1. Create a new agent file under `.github/agents/` with Copilot agent frontmatter (`name`, `description`, `tools`). Do **not** add `model:` — let the Copilot Auto picker choose, or pin a model only if the role demands it.
2. In the prompt body, cite the value-add `skills/patterns/` files the persona should load (the former static binding). Example for a BrowserTester recreation:

   ```text
   ## Resources
   - skills/patterns/tdd-patterns.md
   - skills/patterns/debugging-discipline.md
   - skills/patterns/error-handling-patterns.md
   ```

3. Write the persona's discipline as prose (abstain when no executable harness is supplied; evidence over assertion; stop-the-line on regression). The pattern files carry the reusable discipline; the agent file carries the persona.
4. The Planner can now assign `<role>-subagent` (or whatever name you choose) as a phase `executor_agent`. Execution is native Copilot.

### Worked examples (the retired personas)

| Retired persona | Value-add patterns that survive in `skills/patterns/` | Recreate as |
|---|---|---|
| BrowserTester-subagent | `tdd-patterns`, `debugging-discipline`, `error-handling-patterns` | a `browser-tester` agent under `.github/agents/` that loads those patterns + abstains without an executable harness |
| UIImplementer-subagent | `tdd-patterns`, `code-simplification`, `error-handling-patterns` | a `ui-implementer` agent under `.github/agents/` |
| PlatformEngineer-subagent | `error-handling-patterns`, `debugging-discipline`, `integration-validator` | a `platform-engineer` agent under `.github/agents/` |
| Researcher-subagent | `source-grounding`, `completeness-traceability` | a `researcher` agent under `.github/agents/` |
| CodeMapper-subagent | `completeness-traceability`, `code-simplification` | a `code-mapper` agent under `.github/agents/` (read-only — restrict `tools:` to `read`, `search`) |
| TechnicalWriter-subagent | `completeness-traceability`, `llm-behavior-guidelines` | a `technical-writer` agent under `.github/agents/` |
| CodeReviewer-subagent | `security-review-discipline`, `decision-challenge`, `llm-behavior-guidelines` | optional — `controlflow-review` already layers this over native code review; recreate only if you want a dedicated review persona |

The three verifiers (PlanAuditor, AssumptionVerifier, ExecutabilityVerifier) are **not** recreated as agents — they are the inline phases of the `controlflow-verify` skill, which is the non-native value-add.

## 6. The boundary, restated

ControlFlow keeps the five things Copilot does not have — the schema-enforced plan format, adversarial verify, the tier-gated policy, scope-drift review, and the contract-drift eval suite — and delivers them as one agent plus three skills over native Copilot. Everything else is delegated. If a future Copilot release makes any "Keep" row native, the corresponding ControlFlow surface is retired and this document is updated.

## Sources

- GitHub Copilot custom agents (`@-mention`, `.agent.md`) — VS Code 1.106+ release notes (Feb 2026).
- Copilot subagent dispatch + parallelism — default-on announcement (Feb 24 2026).
- Copilot Plan mode (`/plan`) — GA.
- Copilot agentic code review (Low/Medium, AGENTS.md + skills + MCP) — GA (Mar 5 2026).
- Copilot skills library (`.github/skills/`, portable VS Code / CLI / cloud / review) — GA.
- Copilot MCP, model selection, approvals, custom instructions — GA.
- `@-mention` in VS Code Chat and `hooks` experimental status — confirmed in the Phase 0 spike against official docs; design degrades gracefully (§4).