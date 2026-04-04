# P.A.R.T Specification (Core)

## Purpose
This specification defines deterministic instruction architecture for ControlFlow agents.

P.A.R.T is mandatory for all core agents:
- `Orchestrator.agent.md`
- `Planner.agent.md`
- `Researcher-subagent.agent.md`
- `CodeMapper-subagent.agent.md`
- `CodeReviewer-subagent.agent.md`
- `PlanAuditor-subagent.agent.md`

P.A.R.T is mandatory for all implementation agents:
- `CoreImplementer-subagent.agent.md`
- `UIImplementer-subagent.agent.md`
- `PlatformEngineer-subagent.agent.md`
- `TechnicalWriter-subagent.agent.md`
- `BrowserTester-subagent.agent.md`

## Section Order (MANDATORY)
1. `## Prompt`
2. `## Archive`
3. `## Resources`
4. `## Tools`

Agents must keep this exact order. Missing or reordered sections are non-compliant.

## 1) Prompt
Required content:
- Role and objective in one paragraph.
- Explicit scope boundaries (`IN` and `OUT`).
- Hard behavior constraints (what the agent must never do).
- Plan vs Act rule:
  - Planning phase: no execution actions.
  - Acting phase: no replanning except controlled `replan` transition.
- Abstention rule:
  - If confidence is below threshold or evidence is insufficient, agent must return `ABSTAIN`.
- Output contract reference:
  - Agent must name the schema file it uses under `schemas/`.

## 2) Archive
Required content:
- Long-horizon continuity policy.
- Compaction policy with trigger conditions:
  - Trigger when token/context budget reaches configured threshold.
  - Preserve only durable architectural decisions, active constraints, unresolved risks.
- Memory notes policy:
  - Notes must be persisted in deterministic structure.
  - Remove stale notes when superseded.
- PreFlect policy:
  - Before acting, agent must compare intended plan against known failure patterns.

**Shared policy rule:** Generic Continuity, Failure Classification enum, and NOTES.md baseline structure are defined in `.github/copilot-instructions.md` (workspace instructions). Agent files must include ONLY domain-specific Archive content: custom PreFlect risks, custom compaction rules, custom memory fields, and any unique protocols (e.g., Health-First Gate, State Tracking, Idempotency Mandate).

## 3) Resources
Required content:
- Domain references used by the agent (repo files, docs, schemas).
- Project conventions source (`project-context.md` when present).
- Reliability gate source (`docs/agent-engineering/RELIABILITY-GATES.md`).
- Safety policy source (human approval gates and destructive action policy).

## 4) Tools
Required content:
- Allowed tools grouped by category.
- Disallowed tool categories for that role.
- Deterministic tool selection rules:
  - Prefer read-only discovery before edits.
  - Prefer just-in-time retrieval over bulk loading.
- Human approval gate triggers for high-risk actions.

## 5) Clarification Triggers (NEW)
Required for agents with `askQuestions` or user-interaction tools:
- Positive trigger list: enumerate ambiguity classes that REQUIRE user clarification.
- Threshold rule: clarification is mandatory only when ambiguity would materially change the output.
- Do not frame clarification as a pre-ABSTAIN fallback only.

Required for agents WITHOUT user-interaction tools:
- Explicit statement that clarification is delegated to the conductor via structured `NEEDS_INPUT` status.

**Reference rule:** Clarification policy content (mandatory classes, trigger logic, format) belongs in `docs/agent-engineering/CLARIFICATION-POLICY.md`. Agent files must use short pointers to the canonical doc, not verbatim repetitions of policy content.

## 6) Tool Routing Rules (NEW)
Required when agent has access to external knowledge tools (fetch, githubRepo, Context7/MCP):
- Deterministic routing rules for when to use local search vs external sources.
- Explicit statement of which tools are mandatory, optional, or disallowed for the agent's role.
- If MCP tools are granted in frontmatter, body instructions must reference them with usage rules.

## Prompt Altitude Rules
- Avoid vague directives (e.g., “do your best”).
- Avoid brittle micro-steps tied to one exact environment.
- Use stable gate-style rules:
  - Preconditions
  - Allowed transitions
  - Required evidence
  - Failure mode (`ABSTAIN` / `NEEDS_REVISION` / `FAILED`)

## Deterministic Status Enums
The following statuses form the baseline vocabulary. Individual schemas may define richer or stricter subsets for their role:
- `APPROVED` / `NEEDS_REVISION` — plan-level review outcomes (PlanAuditor)
- `COMPLETE` / `ABSTAIN` — research and discovery outcomes (Researcher, CodeMapper, AssumptionVerifier)
- `PASS` / `FAIL` / `WARN` — verification outcomes (ExecutabilityVerifier, BrowserTester)
- `READY_FOR_EXECUTION` / `REPLAN_REQUIRED` — planning outcomes (Planner)
- `FAILED` — general execution failure (implementation agents)
- `NEEDS_INPUT` — acting agents only; triggers user clarification routing via Orchestrator

The authoritative enum for each agent is its schema contract in `schemas/`. PART-SPEC vocabulary is a reference summary only.

## Human-in-the-loop Gate
Any destructive or irreversible action must be blocked until explicit user confirmation.
Examples:
- File deletion outside temporary/eval artifacts
- Bulk refactors with contract breaks
- External side effects (financial, production, or data-destructive operations)

## Compliance Checklist
- [ ] P.A.R.T section order is exact
- [ ] Plan/Act split enforced
- [ ] PreFlect checkpoint exists
- [ ] Compaction and memory policies exist
- [ ] Schema-governed output is mandatory
- [ ] Abstention rule implemented
- [ ] Human approval gates implemented (or explicitly stated as N/A with reason)
- [ ] Clarification triggers defined (positive triggers for askQuestions; or NEEDS_INPUT delegation stated)
- [ ] Tool routing rules defined for all granted external-knowledge tools
