# ControlFlow for Codex

**Version:** 0.6.0

This repo-local plugin ports the parts of ControlFlow that transfer cleanly into [OpenAI Codex CLI](https://github.com/openai/codex):

- workflow-centric strict entry point
- spec-before-plan capture
- phased planning
- strict plan artifacts
- pre-execution plan review
- cold-start executability review
- complexity-aware execution discipline
- evidence-backed review
- semantic risk checks
- failure taxonomy
- memory hygiene

It intentionally does **not** try to recreate VS Code Copilot-specific prompt contracts, fixed agent rosters, or tool names that do not exist in Codex.

See also: [ControlFlow for Codex section in the main README](../../README.md#controlflow-for-codex-plugin) and the plugin [CHANGELOG](CHANGELOG.md).

## Included Skills

| Skill | Codex invocation | Analogous ControlFlow role |
| ----- | ---------------- | ------------------------- |
| `controlflow-router` | `$controlflow-router` | Entry-point dispatcher |
| `controlflow-spec` | `$controlflow-spec` | Spec-before-plan capture |
| `controlflow-strict-workflow` | `$controlflow-strict-workflow` | Orchestrator (full workflow) |
| `controlflow-planning` | `$controlflow-planning` | Planner |
| `controlflow-plan-audit` | `$controlflow-plan-audit` | PlanAuditor |
| `controlflow-assumption-verifier` | `$controlflow-assumption-verifier` | AssumptionVerifier |
| `controlflow-executability-verifier` | `$controlflow-executability-verifier` | ExecutabilityVerifier |
| `controlflow-orchestration` | `$controlflow-orchestration` | Orchestrator (execution path) |
| `controlflow-review` | `$controlflow-review` | CodeReviewer |
| `controlflow-memory-hygiene` | `$controlflow-memory-hygiene` | Memory hygiene |

## Slash-Alias Mapping

These are aliases-as-mental-mappings for human readability, not executable slash commands.

| Mental shortcut | Skill invocation |
| --- | --- |
| `/spec` | `$controlflow-spec` |
| `/plan` | `$controlflow-planning` |
| `/review` | `$controlflow-review` |
| `/ship` | `$controlflow-strict-workflow` |

These slash forms are documentation aliases for human readability. The plugin's actual invocation surface is the namespaced `$controlflow-*` skill names.

## When to Use This Plugin

ControlFlow-Codex is intentionally opt-in. It should add structure when Codex would otherwise be asked to manage a multi-step repository change from loose chat context alone.

Use ControlFlow-Codex when:

- the task is `SMALL` or larger
- the change spans multiple files, phases, or ownership boundaries
- planning, review gates, rollback notes, or durable artifacts would reduce risk
- migrations, refactors, semantic-risk checks, or execution handoffs matter
- you want a reproducible audit trail under `plans/` and `plans/artifacts/`

Skip ControlFlow-Codex and prompt Codex directly when:

- the task is truly `TRIVIAL` (single-file, obvious, low-risk)
- a direct edit is faster than creating plan artifacts
- you are prototyping throwaway code or exploring an idea casually
- you already know the exact one-off skill you need, such as `$controlflow-review`

The plugin does not install global hooks or replace Codex defaults. Its skills are namespaced as `$controlflow-*` and should be invoked only when that extra workflow discipline is useful.

## Selective Core Parity

ControlFlow-Codex follows a machine-checked selective portability contract in [`../controlflow-shared-source/core-portability-matrix.json`](../controlflow-shared-source/core-portability-matrix.json). The contract adapts host-neutral workflow behavior without copying core prompt prose or pretending that every VS Code runtime surface exists in Codex.

Portable adaptations include context-packet refresh, pre-wave cache recommendations, diagnosis before fixable retry, one approval per ordinary wave, transient-wave throttling, revision/regression tracking, and aggregate final review.

Intentional divergences include `model_unavailable`, VS Code model routing, tool grants, the fixed agent roster, session telemetry, compaction, and budget enforcement.

## Strict Mode

The current version supports a stricter ControlFlow-style path for non-trivial work:

- planning writes Markdown artifacts to `plans/<task-slug>-plan.md` by default
- `controlflow-spec` captures requirements, scope, acceptance criteria, constraints, success metrics, and open questions before planning when those details are not yet stable
- plan files use a ControlFlow-style section structure
- `controlflow-plan-audit` reviews plans before execution for `SMALL+` work
- `controlflow-assumption-verifier` checks for mirages and assumption-fact confusion before execution for `MEDIUM+` work and unresolved high-risk plans
- `controlflow-executability-verifier` simulates cold-start execution for `LARGE` work and other cases where executability confidence is weak; uses `skills/controlflow-executability-verifier/references/executability-checklist.md` for the 8-point checklist and TDD walk-through
- `controlflow-strict-workflow` acts as the single recommended entry point when you want the full ControlFlow-Codex orchestration path instead of manually stitching skills together
- wave execution refreshes context packets, checks recent related artifacts, and uses one approval request per ordinary wave while preserving separate destructive/high-risk gates
- final review compares aggregate changed scope to the approved plan, reconciles out-of-scope changes, and filters previously resolved findings

## Installation Shape

- Plugin manifest: `.codex-plugin/plugin.json`
- Marketplace entry: `~/.agents/plugins/marketplace.json` (written by installer)
- Skill folders: `./skills/`
- Artifact templates: `./templates/`
- Home-local installer: `./scripts/install-home-local.ps1`
- Local validator: `./scripts/validate-strict-artifacts.ps1`

## Installation

```powershell
# From the repository root
powershell -ExecutionPolicy Bypass -File plugins/controlflow-codex/scripts/install-home-local.ps1

# Re-install (replace existing)
powershell -ExecutionPolicy Bypass -File plugins/controlflow-codex/scripts/install-home-local.ps1 -Force
```

The installer copies the plugin to `~/plugins/controlflow-codex/` and registers it in `~/.agents/plugins/marketplace.json`.

## Uninstalling

```powershell
# From the repository root
powershell -ExecutionPolicy Bypass -File plugins/controlflow-codex/scripts/uninstall-home-local.ps1

# Remove without prompting
powershell -ExecutionPolicy Bypass -File plugins/controlflow-codex/scripts/uninstall-home-local.ps1 -Force
```

The uninstaller removes `~/plugins/controlflow-codex/` and removes the `controlflow-codex` marketplace entry from `~/.agents/plugins/marketplace.json`. After uninstalling, `$controlflow-*` skills are no longer available in Codex.

## Notes

- The manifest metadata is usable as-is, but author/contact branding is intentionally generic and can be customized later.
- The workflow references are written for Codex, but the strict planner and plan-review flow now intentionally track the original ControlFlow structure much more closely.
- To install into your personal Codex home, run `scripts/install-home-local.ps1` from this plugin directory.
- Keep using native Codex for trivial changes; the plugin is meant for work where structured plans and review gates pay for themselves.
- For a practical prompt catalog in Russian, read `USAGE.md`.

## ExecPlan-Compatible Lifecycle Discipline

Strict Codex plans in this plugin include five required lifecycle sections at the end of every non-trivial plan artifact:

- **Progress** — phase-by-phase status updated during execution.
- **Discoveries** — unexpected findings recorded as they surface.
- **Decision Log** — key execution decisions with rationale.
- **Outcomes** — final state: achieved, deferred, and residual risks.
- **Idempotence & Recovery** — which phases are safe to re-run and how to restart after interruption.

These sections are inspired by OpenAI ExecPlan living-document discipline but are a ControlFlow-native adaptation. They preserve ControlFlow artifact paths, no-fenced-code-block rules, strict plan dialect, and review-gated execution. This is not a literal import of OpenAI's `PLANS.md` format; the section names, validator enforcement, and plan template are defined and maintained within this plugin.

The local validator at `scripts/validate-strict-artifacts.ps1` enforces these five headings as standalone headings in the documented order for ControlFlow-Codex strict-plan artifacts. It does not validate core VS Code Planner artifacts.

Use `-StrictReviewByTier` to infer review artifacts from the plan: `SMALL` requires plan audit, `MEDIUM` adds assumption verification, and `LARGE` adds executability verification. Any applicable unresolved `HIGH` semantic risk also requires assumption verification. Existing `-RequirePlanAudit`, `-RequireAssumptionVerifier`, and `-RequireExecutabilityVerifier` switches remain supported as additive compatibility controls.
