# Chapter 18 — FAQ

Frequently asked questions about the slim ControlFlow model, grouped by category.

---

## Conceptual Questions (1–10)

**Q1. What is the difference between AssumptionVerifier-subagent and PlanAuditor-subagent?**

`PlanAuditor-subagent` (verify phase 1) reviews **design**: is the architecture sound, are risks covered, is rollback planned, does the artifact conform to the schema? `AssumptionVerifier-subagent` (verify phase 2) checks **factual accuracy**: are the claims the plan makes actually true (do referenced files/symbols exist, are assumptions bounded)? A plan can be architecturally sound but contain false claims about the codebase. These are different axes, which is why both phases run on MEDIUM+ tiers. Both are inline phases of `controlflow-verify` — not dispatched subagents.

---

**Q2. What is the difference between ABSTAIN and REPLAN_REQUIRED?**

- **ABSTAIN** (from the Planner): "I cannot assess with sufficient confidence." Does **not** block the pipeline; logged as uncertainty.
- **REPLAN_REQUIRED** (from the Planner): "The requirements are contradictory or missing; planning cannot proceed." **Blocks** progress — the user must clarify requirements.

ABSTAIN is an epistemic signal. REPLAN_REQUIRED is a hard blocker.

---

**Q3. Why doesn't the Planner invoke `controlflow-verify` itself?**

Separation of concerns. The Planner is a **planning** agent: it produces the artifact and hands off. `controlflow-verify` is **adversarial**: it tries to refute the plan. The user runs verify as a separate gate so the Planner cannot approve its own work. The Planner does not need to know the tier-gated phase depth; it focuses on plan quality.

---

**Q4. Why is there no `Orchestrator` agent file in the slim model?**

The Orchestrator is **retired** as a shipped agent. The legacy state machine (`PLANNING` / `WAITING_APPROVAL` / `PLAN_REVIEW` / `ACTING` / `REVIEWING` / `COMPLETE`), dispatch, waves, and gates are gone. As of February 2026, Copilot does all of this natively: subagent dispatch + parallelism is GA, `/plan` mode is GA, agentic code review is GA, approvals + custom instructions are GA. Keeping a ControlFlow dispatch state machine on top would duplicate native capabilities — exactly what the slim model forbids. The Planner + native Copilot cover orchestration; the plan → verify → review pipeline is what "orchestration" now means. See `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`.

---

**Q5. What is the difference between `failure_classification` and mid-execution clarification?**

- **`failure_classification`** (`transient` / `fixable` / `needs_replan` / `escalate` / `model_unavailable`): describes the **type of failure** for routing. Recorded in plan lifecycle sections. Retry routing is native Copilot's job; `needs_replan` re-enters the ControlFlow pipeline via the Planner.
- **Mid-execution clarification**: native Copilot's ask-questions surface surfaces a question to the user. Not a failure — a question. If the answer changes file scope, user-visible behavior, architecture, or destructive-risk handling, the user re-invokes `@controlflow-planner` for a targeted replan.

---

**Q6. Why does "governance beats prompt"?**

Governance files (`governance/*.json`) are **explicit contracts** checked into the repository. Agent prompts contain **default behavior** and heuristics. When they conflict, governance files win because:
1. They are versioned and auditable.
2. They can be updated without editing every custom agent prompt.
3. They are a single source of truth for operational policies (tier-gated verify depth, semantic-risk policy, verdict routing).

---

**Q7. Why are skills Markdown files rather than code?**

Skills provide **guidance and patterns** for an LLM agent — they are part of the prompt context, not executable code. An agent reads a skill file the same way a developer reads a coding standard: it informs decision-making. Making them executable code would require a runtime environment the slim model intentionally avoids (ControlFlow is a prompt/governance/eval layer over native Copilot, not a runtime).

---

**Q8. Why ≤3 skills per phase?**

More skills in the context create noise and token overhead. Skills are most effective when they are laser-focused on the specific domain of the current phase. If a phase seems to require more than three — it is likely too broad and should be decomposed into smaller phases.

---

**Q9. Why do PlanAuditor-subagent and AssumptionVerifier-subagent exclude `transient`?**

Because their failures are **structural** by nature. If `PlanAuditor-subagent` finds a problem, it found a real issue in the plan — not a timeout. If `AssumptionVerifier-subagent` identifies a mirage, it is a real factual gap — not a network error. Retrying identically (transient logic) would produce the same result. These phases' failures are always `fixable`, `needs_replan`, or `escalate`.

---

**Q10. Is "plan arrival = implicit approval"?**

**No.** A plan artifact at `plans/<task-slug>-plan.md` is a **reviewable input**. The user must run `/controlflow-verify` (on SMALL+ work) and receive `APPROVED` before implementation begins. The presence of a plan artifact does not bypass the verify gate.

---

## Technical Questions (11–20)

**Q11. What is the canonical verification command?**

```bash
cd evals && npm test
```

Must be run from the `evals/` directory, **not** the repo root. Runs offline checks: structural validation, prompt-behavior contracts, drift detection, tutorial parity, skill discoverability, capability matrix, plugin manifest parity, contract-drift, and doc-count consistency. No LLM calls, no network.

---

**Q12. What happens if `executor_agent` is missing from a phase?**

`controlflow-verify` phase 1 (structural audit) flags it as a structural failure → `NEEDS_REVISION`. The plan is sent back to the Planner; the phase must be reissued with an explicit `executor_agent` from the eight-name enum. Inferring silently is forbidden.

---

**Q13. Where does the role taxonomy live?**

The single source of truth is `governance/project-context-registry.json`. A human-readable mirror is in `plans/project-context.md` (the Phase Executor Agents, Review Pipeline Agents, and Agent Role Matrix tables). The Pass 14 drift check (`validateProjectContextRegistryMirror`) verifies them row-for-row. Do not hand-edit the mirror independently of the registry.

---

**Q14. What happens after `escalate`?**

Native Copilot stops and presents the accumulated failure evidence to the user. The user makes one of these decisions:
- Cancel the task.
- Provide clarification and allow a retry.
- Escalate for human manual intervention.

There are **zero automatic retries** for `escalate`.

---

**Q15. What is the difference between per-task and reusable artifacts?**

- **Per-task** (`plans/artifacts/<task-slug>/`): task-specific history, revision logs, deliverables. Not reusable across tasks.
- **Reusable** (`skills/patterns/`, `schemas/`, `governance/`): shared across all tasks. Changes affect all consumers.

`NOTES.md` is **active-objective state** — not per-task history.

---

**Q16. What are the 4 PreFlect risk classes?**

1. **High-risk-destructive** — the action destroys or irreversibly alters data.
2. **Scope-drift** — the action exceeds the plan scope.
3. **Assumption** — the agent is acting on an unverified premise.
4. **Dependency** — a prerequisite for the action is not yet met.

Decision: `GO` / `PAUSE` / `ABORT`. The pattern lives at `skills/patterns/preflect-core.md`.

---

**Q17. When does the HIGH-risk override fire?**

When a `risk_review` entry has `applicability: applicable` AND `impact: HIGH` AND `disposition` not `resolved`, the plan is treated as `LARGE` for verify depth regardless of file count — all three verify phases run. The rule is encoded in `governance/runtime-policy.json` → `semantic_risk_policy`.

---

**Q18. Who owns the fix cycle when `controlflow-review` finds scope drift?**

Always the **user or a new plan phase**, never `controlflow-review` itself. `controlflow-review` labels findings (severity, confidence, file, line, user impact, validation method); it does not fix them. If the fix changes file scope, the user re-invokes `@controlflow-planner` for a targeted replan; otherwise native Copilot applies the fix and re-review is at the user's discretion.

---

**Q19. Why is there no `governance/model-routing.json` or `governance/tool-grants.json`?**

Both are **retired**. Model selection is delegated to native Copilot (the Auto model picker; pin a model only if a role demands it). Tool access is declared per-agent in `tools:` frontmatter when you recreate a specialized agent under `.github/agents/`; there is no central tool-access grant file to synchronize. The slim model ships no surface duplicating a native Copilot capability. See `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`.

---

**Q20. Why is `additionalProperties: false` in all schemas?**

To enforce a **closed contract**: any unknown field is an error, not silently ignored. This catches:
- Misnamed fields (typos in field names).
- Outdated payloads (field removed but still sent).
- Schema drift (an agent emits a field that hasn't been reviewed).

In the slim model, schemas are contract documentation + eval fixture references; the closed-contract rule still anchors the eval suite.

---

## Operational Questions (21–25)

**Q21. What should I do if CI fails?**

1. Run `cd evals && npm test` locally (delete `evals/.cache/` first — the cache may mask failures after structural edits).
2. Read the failing pass and error message.
3. For Pass 15 (doc-count): check the allowlisted doc states a count that mismatches disk truth.
4. For Pass 7c (tutorial parity): check the heading aliases in `evals/scenarios/tutorial-parity/allowlist.json`.
5. For Pass 14 (registry mirror): check `governance/project-context-registry.json` vs `plans/project-context.md`.
6. Fix the issue, re-run, confirm it passes.

---

**Q22. How do I pin a model for a specific custom agent?**

By default, **don't** — omit the `model:` line in the agent file's frontmatter so the Copilot Auto model picker selects. If a role genuinely demands a pinned model, add `model:` to that agent's frontmatter only. There is no central model-routing file to edit. The `Model Routing Role` column in the role taxonomy is a conceptual capability tier, not a routing surface.

---

**Q23. Can I skip a verdict gate?**

**No.** Skipping the verify gate (implementing before `APPROVED`) or the review gate (shipping before reviewing findings) is a contract violation. The stopping rules are mandatory pauses: after the plan is written, after verify returns a verdict, and after review returns findings.

---

**Q24. What are the 7 semantic risk categories?**

From `schemas/planner.plan.schema.json` → `risk_review.items.properties.category.enum`:
1. `data_volume`
2. `performance`
3. `concurrency`
4. `access_control`
5. `migration_rollback`
6. `dependency`
7. `operability`

Every non-TRIVIAL plan must include all seven exactly once; use `not_applicable` with justification when a category is irrelevant — never skip a row.

---

**Q25. What is the process for adding a new specialized agent?**

The slim model ships one agent (`@controlflow-planner`). To add a specialized persona, follow `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md §5`:
1. Create a new agent file under `.github/agents/` with Copilot agent frontmatter (`name`, `description`, `tools`). No `model:` by default.
2. In the body, cite the `skills/patterns/` files the persona should load (the former static binding is now Planner-injected).
3. Write the persona's discipline as prose (abstain when no executable harness is supplied; evidence over assertion; stop-the-line on regression).
4. The Planner can now assign that role as a phase `executor_agent`. Execution is native Copilot.

There is no tool-access grant file or model-routing file to update — those governance surfaces are retired.

---

## Philosophical Questions (26–28)

**Q26. Why is the process so strict if LLMs are flexible?**

LLMs are powerful but unreliable for long multi-step tasks without structure. Strict process ensures:
- **Reproducibility** — same input, predictable behavior.
- **Auditability** — every plan, verdict, and finding is a written artifact.
- **Safety** — destructive operations require human approval.
- **Debuggability** — when something goes wrong, the failure taxonomy tells you exactly where and why.

Flexibility is preserved where it matters (Planner Idea Interview, pattern content); structure governs where failures are costly.

---

**Q27. Why is there no auto-merge or auto-deploy?**

ControlFlow is a **prompt/governance/eval layer** over native Copilot. There is no compiled product and no runtime deployment. Commits affect the planner agent, skills, schemas, and governance — changes that require human review. Auto-merge would bypass the verify and review gates that are central to the system's safety model.

---

**Q28. Can ControlFlow be used outside this repository?**

Yes. The slim surface (`.github/agents/`, `.github/skills/`, `.github/copilot-instructions.md`) plus the contracts (`schemas/`, `governance/`, `plans/templates/`, `plans/project-context.md`, `skills/`, `evals/`) is portable. See the Installation section of the root `README.md`. The patterns (plan format, failure taxonomy, memory architecture, verify/review pipeline, skill system) are general and adapt to any Copilot-equipped repo. Because the slim model delegates execution, tool access, and model selection to native Copilot, there is no per-agent runtime to port.

---

## See Also

- [Chapter 00 — Introduction](00-introduction.md)
- [Chapter 16 — Exercises](16-exercises.md)
- [Chapter 17 — Glossary](17-glossary.md)
- [plans/project-context.md](../../plans/project-context.md)
- [docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](../agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)
- [docs/agent-engineering/](../agent-engineering/)