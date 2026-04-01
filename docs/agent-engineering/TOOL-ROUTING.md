# Tool Routing Policy

## Purpose
Define deterministic rules for when agents should use local search, external fetch, or MCP-backed documentation tools.

## Decision Matrix

| Condition | Tool | Priority |
|-----------|------|----------|
| File content, code structure, project config | Local search/read tools | ALWAYS first |
| GitHub issues, PRs, repo context | `web/githubRepo` | When task references external repo context |
| Third-party library behavior, API docs | `web/fetch` or Context7 | When local search insufficient |
| Framework best practices, current versions | Context7 (`resolve-library-id` → `get-library-docs`) | When planning depends on third-party behavior |
| General web research | `web/fetch` | Only when no structured source available |

## Routing Rules

### Rule 1: Local-First
Always search the local codebase before using any external tool. External sources supplement, not replace, local evidence.

### Rule 2: External-Doc Mandatory Cases
External documentation lookup is **mandatory** before finalizing output when:
- The task involves a third-party library/framework not already documented in the codebase.
- The plan depends on API behavior that cannot be verified from local code alone.
- The user explicitly references an external resource, standard, or specification.

### Rule 3: Context7/MCP Routing (Prometheus)
When Prometheus has Context7 tools granted:
1. If the plan involves a third-party library: call `resolve-library-id` first.
2. If library ID resolves: call `get-library-docs` to fetch current documentation.
3. Use fetched docs to validate plan assumptions before finalizing phases.
4. If library ID does not resolve: fall back to `web/fetch` or `web/githubRepo`.

### Rule 4: No Phantom Grants
If a tool is listed in an agent's YAML frontmatter `tools:` array, the agent's body instructions MUST include routing rules for that tool. A tool that appears only in frontmatter with no body reference is a compliance gap.

Prefer least-privilege grants: do not grant tools solely for speculative future use. Frontmatter should expose the minimum tool surface needed by the current role contract and body instructions.

### Rule 5: Role-Specific Restrictions

| Agent | fetch | githubRepo | Context7 | Notes |
|-------|-------|-----------|----------|-------|
| Atlas | ✅ | ✅ | ❌ | Orchestration; delegates research |
| Prometheus | ✅ | ✅ | ✅ | Planning; use Context7 for library docs |
| Oracle | ✅ | ❌ | ❌ | Deep research; fetch for evidence |
| Scout | ❌ | ❌ | ❌ | Read-only local discovery |
| Code-Review | ❌ | ❌ | ❌ | Verification only |
| Challenger | ❌ | ❌ | ❌ | Read-only plan audit; local codebase cross-reference only |
| Sisyphus | ✅ | ✅ | ❌ | Implementation; fetch for API reference |
| Frontend-Engineer | ✅ | ✅ | ❌ | Implementation; fetch for component docs |
| DevOps | ✅ | ✅ | ❌ | Infrastructure; fetch for provider docs |
| DocWriter | ✅ | ❌ | ❌ | Documentation; fetch for external refs |
| BrowserTester | ✅ | ❌ | ❌ | Testing; fetch for test framework docs |
