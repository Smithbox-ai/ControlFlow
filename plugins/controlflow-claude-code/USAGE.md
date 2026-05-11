# ControlFlow for Claude Code - Usage

Version: 0.1.0

## Local Development Installation

To load this plugin from a local directory during development:

1. Open a Claude Code session.
2. Load the plugin from this directory:

   ```sh
   claude --plugin-dir ./plugins/controlflow-claude-code
   ```

3. Verify it loaded by listing available skills:

   ```text
   /controlflow-claude-code:controlflow-router
   ```

## Plugin Marketplace Installation

Marketplace distribution is deferred for v0.1.0. Use the local `--plugin-dir`
workflow above while the plugin is validated for broader distribution.

## Validating the Plugin Locally

JSON manifest parse check (run from repo root):

```powershell
   powershell -Command "Get-Content plugins/controlflow-claude-code/.claude-plugin/plugin.json | ConvertFrom-Json"
```

Skill frontmatter check (run from repo root):

```powershell
   powershell -Command "Get-ChildItem plugins/controlflow-claude-code/skills -Recurse -Filter SKILL.md | ForEach-Object { $content = Get-Content $_ -Raw; if ($content -notmatch 'description:') { throw ('Missing description frontmatter in: ' + $_.FullName) } }"
```

Agent frontmatter check (run from repo root):

```powershell
   powershell -Command "Get-ChildItem plugins/controlflow-claude-code/agents -Filter '*.md' | ForEach-Object { $content = Get-Content $_ -Raw; if ($content -notmatch 'name:' -or $content -notmatch 'description:') { throw ('Missing required frontmatter in agent: ' + $_.FullName) } }"
```

Full plugin validator (available after Phase 5):

```powershell
   powershell -ExecutionPolicy Bypass -NoProfile -File plugins/controlflow-claude-code/tests/validate-claude-artifacts.test.ps1 -RepoRoot .
```

Claude Code native validation (requires claude CLI):

```sh
   cd plugins/controlflow-claude-code && claude plugin validate
```

## Skill Invocation Reference

Skills are invoked using the namespaced slash syntax:

```text
/controlflow-claude-code:{skill-name}
```

Example: to start a planning session, run:

```text
   /controlflow-claude-code:controlflow-planning
```

Example: to run a plan audit after the plan is saved, run:

```text
   /controlflow-claude-code:controlflow-plan-audit
```

## Report Templates

Report templates are in templates/. Use them as starting structures for audit and
verification outputs. Final reports should be saved to plans/artifacts/{task-slug}/.

## Repo-Wide Verification

The canonical repo verification command (runs the full offline eval suite):

```sh
   cd evals && npm test
```
