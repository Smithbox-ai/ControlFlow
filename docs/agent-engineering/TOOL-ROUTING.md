# Tool Routing Policy

## Purpose

Define deterministic rules for when agents should use local search, external fetch, or MCP-backed documentation tools.

## Decision Matrix

| Condition | Tool | Priority |
| ----------- | ------ | ---------- |
| File content, code structure, project config | Local search/read tools | ALWAYS first |
| GitHub issues, PRs, repo context | `web/githubRepo` | When task references external repo context |
| Third-party library behavior, API docs | `web/fetch` or Context7 | When local search insufficient |
| Framework best practices, current versions | Context7 (`resolve-library-id` -> `get-library-docs`) | When planning depends on third-party behavior |
| General web research | `web/fetch` | Only when no structured source available |

## Routing Rules

### Rule 1: Local-First

Always search the local codebase before using any external tool. External sources supplement, not replace, local evidence.

### Rule 2: External-Doc Mandatory Cases

External documentation lookup is **mandatory** before finalizing output when:

- The task involves a third-party library/framework not already documented in the codebase.
- The plan depends on API behavior that cannot be verified from local code alone.
- The user explicitly references an external resource, standard, or specification.

### Rule 3: Context7/MCP Routing (Planner)

When Planner has Context7 tools granted:

1. If the plan involves a third-party library: call `resolve-library-id` first.
2. If library ID resolves: call `get-library-docs` to fetch current documentation.
3. Use fetched docs to validate plan assumptions before finalizing phases.
4. If library ID does not resolve: fall back to `web/fetch` or `web/githubRepo`.

### Rule 4: No Phantom Grants

If a tool is listed in an agent's YAML frontmatter `tools:` array, the agent's body instructions MUST include routing rules for that tool. A tool that appears only in frontmatter with no body reference is a compliance gap.

Prefer least-privilege grants: do not grant tools solely for speculative future use. Frontmatter should expose the minimum tool surface needed by the current role contract and body instructions.

### Rule 5: Role-Specific Restrictions

| Agent | fetch | githubRepo | Context7 | Notes |
| ------- | ------- | ----------- | ---------- | ------- |
| Orchestrator | yes | yes | no | Orchestration; delegates research |
| Planner | yes | yes | yes | Planning; use Context7 for library docs |
| Researcher | yes | no | no | Deep research; fetch for evidence |
| CodeMapper | no | no | no | Read-only local discovery |
| CodeReviewer | no | no | no | Verification only; final review uses injected `prior_phase_findings[]` for novelty filtering |
| PlanAuditor | no | no | no | Read-only plan audit; local codebase cross-reference only |
| CoreImplementer | yes | yes | no | Implementation; fetch for API reference |
| UIImplementer | yes | yes | no | Implementation; fetch for component docs |
| PlatformEngineer | yes | yes | no | Infrastructure; fetch for provider docs |
| TechnicalWriter | yes | no | no | Documentation; fetch for external refs |
| BrowserTester | yes | no | no | Testing; fetch for health checks, URL verification, and test framework docs |
| AssumptionVerifier | no | no | no | Read-only local mirage detection |
| ExecutabilityVerifier | no | no | no | Read-only local executability simulation |

### Rule 6 - Tool Output Spill

Tool outputs exceeding in-context thresholds should be spilled to the directory declared by `tool_output_policy.spill_directory_template` in `governance/runtime-policy.json`, keeping only the path + summary in the agent context. See [MEMORY-ARCHITECTURE.md](MEMORY-ARCHITECTURE.md) L4. Orchestrator performs a whole-directory purge of this cache at the Completion Gate.

### Rule 7 - Feasibility Boundaries

- BrowserTester is script/harness-based. It may run provided executable browser test scripts or harnesses through its command/task grants, but it must return `ABSTAIN` when no executable browser test harness or script is supplied. It must not claim direct browser-session control unsupported by the provided harness.
- CodeReviewer final review must use Orchestrator-injected `prior_phase_findings[]` for novelty filtering. It must not self-source prior phase plans or artifacts from `plans/artifacts/` to decide whether a finding is new.

### Rule 8 - Resource Path Resolution Fallback

Agent resource paths are workspace-relative by default. When a file listed in an agent's `## Resources` section is not found in the active workspace root:

1. Retry the read using the absolute prefix `{{VSCODE_USER_PROMPTS_FOLDER}}/` — e.g. `{{VSCODE_USER_PROMPTS_FOLDER}}/governance/model-routing.json`.
2. If still not found, log the missing path in the gate event and continue with `confidence` reduced by 0.1 per missing critical file.
3. Never fabricate file contents. Never silently proceed as if a missing governance file contained default values.
4. **Applies to:** `governance/`, `schemas/`, `plans/project-context.md`, `docs/agent-engineering/`, `skills/` — any path referenced in a `## Resources` section of any agent file.

This rule resolves the gap when agents are loaded as global prompts (from `User/prompts/`) but the active workspace does not contain the ControlFlow governance tree. It is intentionally duplicated in `.github/copilot-instructions.md` so the fallback is available before this file itself can be loaded.

### Rule 9 - Cursor IDE Support Does Not Change VS Code Tool Grants

Cursor IDE support uses `.cursor/rules/`, `.cursor/skills/`, and `.cursor/agents/` (and the portable package `plugins/controlflow-cursor/`). It does not:

- Add new entries to `governance/tool-grants.json` or `governance/agent-grants.json`.
- Grant Cursor access to VS Code-specific capabilities such as `agent/runSubagent`.
- Require new model-routing roles or executor agents in `plans/project-context.md`.

Cursor subagents use Cursor-native tools (Read, Grep, Shell, Task, MCP). They do not inherit VS Code `tools:` frontmatter from `*.agent.md`.

When updating Cursor assets, verify frontmatter against official Cursor documentation (`https://cursor.com/docs/rules`, `https://cursor.com/docs/subagents`, `https://cursor.com/docs/skills`) before editing. Local-first rule (Rule 1) still applies. The authoritative governance document is `docs/agent-engineering/CURSOR-SUPPORT.md`.
