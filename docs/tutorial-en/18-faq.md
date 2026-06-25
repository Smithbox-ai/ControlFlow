# Chapter 18 — FAQ

Frequently asked questions, grouped by category.

---

## Conceptual Questions (1–10)

**Q1. What is the difference between AssumptionVerifier and PlanAuditor?**

PlanAuditor reviews **design**: is the architecture correct, are risks covered, is rollback planned? AssumptionVerifier checks **factual accuracy**: are the claims the plan makes actually true? A plan can be architecturally sound but contain false claims about the codebase (e.g., referencing a method that doesn't exist). These are different axes, which is why both reviewers run in parallel on MEDIUM/LARGE tiers.

---

**Q2. What is the difference between ABSTAIN and REPLAN_REQUIRED?**

- **ABSTAIN** (from a reviewer or Planner): "I cannot assess with sufficient confidence." Does **not** block the pipeline; logged as uncertainty.
- **REPLAN_REQUIRED** (from Planner only): "The requirements are contradictory or missing; planning cannot proceed." **Blocks** progress — the user must clarify requirements.

ABSTAIN is an epistemic signal. REPLAN_REQUIRED is a hard blocker.

---

**Q3. Why doesn't the Planner invoke reviewers itself?**

Separation of concerns. Planner is a **planning** agent: it creates plans. Reviewers are **adversarial**. The Orchestrator governs PLAN_REVIEW — it knows when and which reviewers to dispatch based on tier, trigger conditions, and governance configuration. Planner doesn't need to know this logic; it focuses on plan quality.

---

**Q4. Why is PLAN_REVIEW not in the `workflow_state` enum?**

`workflow_state` in `orchestrator.gate-event.schema.json` reflects the actual state machine nodes: PLANNING, WAITING_APPROVAL, ACTING, REVIEWING, COMPLETE. PLAN_REVIEW is a **sub-phase** of the pipeline described in the Orchestrator prompt — it is not a distinct machine state; it runs inside ACTING setup. Conflating them would make the schema incorrect.

---

**Q5. What is the difference between `failure_classification` and `clarification_request`?**

- **failure_classification** (transient/fixable/needs_replan/escalate): describes the **type of failure** for automated retry routing. Used when something went **wrong**.
- **clarification_request** (via NEEDS_INPUT): the agent **does not have enough information** to proceed. Not a failure — a question for the user.

They may appear together if a task fails **because** the agent needs more context, but they serve different purposes and take different routing paths.

---

**Q6. Why does "governance beats prompt"?**

Governance files (`governance/*.json`) are **explicit contracts** checked into the repository. Agent prompts contain **default behavior** and heuristics. When they conflict, governance files win because:
1. They are versioned and auditable.
2. They can be updated without editing 13 agent files.
3. They are a single source of truth for operational policies.

---

**Q7. Why are skills Markdown files rather than code?**

Skills provide **guidance and patterns** for an LLM agent — they are part of the prompt context, not executable code. An agent reads a skill file the same way a developer reads a coding standard: it informs decision-making. Making them executable code would require a runtime environment the system intentionally avoids.

---

**Q8. Why ≤3 skills per phase?**

More skills in the context create noise and token overhead. Skills are most effective when they are laser-focused on the specific domain of the current phase. If a phase seems to require >3 skills — it is likely too broad and should be decomposed into smaller phases.

---

**Q9. Why do PlanAuditor and AssumptionVerifier exclude `transient`?**

Because their failures are **structural** by nature. If PlanAuditor finds a problem, it found a real issue in the plan — not a timeout. If AssumptionVerifier identifies a mirage, it is a real factual gap — not a network error. Retrying identically (transient logic) would produce the same result. These agents' failures are always `fixable`, `needs_replan`, or `escalate`.

---

**Q10. Is "plan arrival = implicit approval"?**

**No.** A plan artifact received via `plan_path` from Planner is a **reviewable input**. It enters the same PLAN_REVIEW trigger evaluation as any other plan. Trigger conditions in `governance/runtime-policy.json` are authoritative; the presence of a `plan_path` handoff does not bypass them.

---

## Technical Questions (11–20)

**Q11. What is the canonical verification command?**

```bash
cd evals && npm test
```

Must be run from the `evals/` directory, **not** the repo root. Runs ~410 offline checks. No LLM calls, no network.

---

**Q12. What should the Orchestrator do if `executor_agent` is missing from a phase?**

Route the plan back through `REPLAN` to Planner and **stop** the implementation batch until the phase is reissued with an explicit `executor_agent`. Inferring silently is forbidden.

---

**Q13. How does regression tracking work?**

At `iteration_index > 1`, the Orchestrator passes reviewers a list of **verified items** from the previous iteration. If a previously verified item now fails → **automatic BLOCKING regression issue**, regardless of severity. This prevents "whack-a-mole" where fixing one issue breaks another.

---

**Q14. What happens after `escalate`?**

The Orchestrator transitions to `WAITING_APPROVAL` and presents the accumulated failure evidence to the user. The user makes one of these decisions:
- Cancel the task.
- Provide clarification and allow a retry.
- Escalate for human manual intervention.

There are **0 automatic retries** for `escalate`.

---

**Q15. What is the difference between per-task and reusable artifacts?**

- **Per-task** (`plans/artifacts/<task-slug>/`): task-specific history, revision logs, deliverables. Not reusable across tasks.
- **Reusable** (`skills/patterns/`, `schemas/`, `governance/`): shared across all tasks. Changes affect all consumers.

NOTES.md is **active-objective state** — not per-task history.

---

**Q16. What are the 4 PreFlect risk classes?**

1. **High-risk-destructive** — the action destroys or irreversibly alters data.
2. **Scope-drift** — the action exceeds the plan scope.
3. **Assumption** — the agent is acting on an unverified premise.
4. **Dependency** — a prerequisite for the action is not yet met.

Decision: `GO` / `PAUSE` / `ABORT`.

---

**Q17. When does the final review gate activate?**

Per `governance/runtime-policy.json` → `final_review_gate`, when at least one is true:
- `enabled_by_default: true`.
- `complexity_tier` is in `auto_trigger_tiers`.
- The user explicitly requested a final review.

---

**Q18. Who owns the fix cycle in the final review?**

Always the **executor**, never the reviewer (CodeReviewer). The fix executor is the phase with the **highest** `phase_id` whose `files[]` contains the affected file. Maximum 1 fix cycle per file.

---

**Q19. Why does trace_id use UUID v4?**

UUID v4 is randomly generated, collision-resistant, and does not encode time or host information (unlike v1/v7). This makes it safe for log correlation across distributed or concurrent agent sessions without leaking system metadata.

---

**Q20. Why is `additionalProperties: false` in all schemas?**

To enforce a **closed contract**: any unknown field is an error, not silently ignored. This catches:
- Misnamed fields (typos in field names).
- Outdated payloads (field removed but still sent).
- Schema drift (agent emits a field that hasn't been reviewed).

---

## Operational Questions (21–25)

**Q21. What should I do if CI fails?**

1. Run `cd evals && npm test` locally.
2. Read the failing pass and error message.
3. For Pass 4 (P.A.R.T.): check section order in the relevant `*.agent.md`.
4. For Pass 2 (scenarios): validate the scenario JSON against the schema.
5. For Pass 4b (companion rules): find the companion rule in `drift-checks.mjs` and check what is missing.
6. Fix the issue, re-run, confirm it passes.

---

**Q22. How do I change the model for a specific task type?**

Edit `governance/model-routing.json`. Update the relevant `task_type_routing` or `tier_routing` entry. Run `cd evals && npm test` to verify the change doesn't break anything. Check if any agent prompts reference the old model name and update them.

---

**Q23. Can I skip an approval gate?**

**No.** Skipping an approval gate is a contract violation equivalent to skipping a gate. The Orchestrator prompt states: "Violating a stopping rule is equivalent to skipping a gate." This is a non-negotiable rule.

---

**Q24. What are the 7 semantic risk categories?**

From `planner.plan.schema.json` → `risk_review.items.properties.category.enum`:
1. `data_volume`
2. `performance`
3. `concurrency`
4. `access_control`
5. `migration_rollback`
6. `dependency`
7. `operability`

---

**Q25. What is the process for adding a new agent?**

Follow the agent-contribution process in `CONTRIBUTING.md`. In summary:
1. Create `<Name>.agent.md` (P.A.R.T. order).
2. Create `schemas/<name>.schema.json`.
3. Add eval scenarios in `evals/scenarios/<name>/`.
4. Register in `plans/project-context.md`.

Also update `governance/agent-grants.json` and `governance/tool-grants.json` with the new agent's tool profile.

---

## Philosophical Questions (26–28)

**Q26. Why is the process so strict if LLMs are flexible?**

LLMs are powerful but unreliable for long multi-step tasks without structure. Strict process ensures:
- **Reproducibility** — same input, predictable behavior.
- **Auditability** — every decision is traceable via gate events.
- **Safety** — destructive operations require human approval.
- **Debuggability** — when something goes wrong, the taxonomy tells you exactly where and why.

Flexibility is preserved where it matters (Planner idea interview, skill content); structure governs where failures are costly.

---

**Q27. Why is there no auto-merge or auto-deploy?**

ControlFlow is a **prompt/governance/eval repository**. There is no compiled product and no runtime deployment. Commits affect agent behavior, schemas, and governance — changes that require human review. Auto-merge would bypass the code review and approval gates that are central to the system's safety model.

---

**Q28. Can ControlFlow be used outside this repository?**

The patterns (P.A.R.T., failure taxonomy, memory architecture, review pipeline, skill system) are general and can be adapted. However, the governance files, schemas, and eval harness are tightly coupled to the 13 specific agents in this repository. Adapting to a different agent system requires reviewing all cross-references and rewriting the eval harness for the new agent contracts.

---

## See Also

- [Chapter 00 — Introduction](00-introduction.md)
- [Chapter 16 — Exercises](16-exercises.md)
- [Chapter 17 — Glossary](17-glossary.md)
- [plans/project-context.md](../../plans/project-context.md)
- [docs/agent-engineering/](../agent-engineering/)
