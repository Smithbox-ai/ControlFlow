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
