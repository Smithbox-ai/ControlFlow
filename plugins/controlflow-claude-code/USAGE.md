# ControlFlow for Claude Code - Usage

Version: 1.0.0

## Local Development Installation

To load this plugin from a local directory during development:

1. Open a Claude Code session.
2. Load the plugin from this directory:

   ```sh
   claude --plugin-dir ./plugins/controlflow-claude-code
   ```

3. Verify it loaded by invoking a skill:

   ```text
   /controlflow-claude-code:controlflow-plan
   ```

## Plugin Marketplace Installation

The repo-root `.claude-plugin/marketplace.json` registers this plugin for a local
marketplace at version 1.0.0. To install it via the marketplace (instead of the
`--plugin-dir` dev workflow above):

1. Register the repo as a marketplace (run from repo root):

   ```sh
   claude plugin marketplace add ./  --scope user
   ```

   `--scope user` installs globally into `~/.claude` (available in every project).
   Use `--scope project` to scope it to the current project only, or `--scope local`
   for a one-off local registration. The marketplace name is `controlflow-marketplace`
   (defined in `.claude-plugin/marketplace.json`).

2. Install the plugin (default scope is `user` = global in `~/.claude`):

   ```sh
   claude plugin install controlflow-claude-code@controlflow-marketplace
   ```

3. Verify it is installed and enabled:

   ```sh
   claude plugin list
   ```

After install, the three skills are available in every session as
`/controlflow-claude-code:controlflow-plan`,
`/controlflow-claude-code:controlflow-verify`, and
`/controlflow-claude-code:controlflow-review` (no restart needed for a new session).
To update after pulling repo changes, re-run `claude plugin install ...` (marketplace
reads the current working tree). To remove: `claude plugin uninstall
controlflow-claude-code@controlflow-marketplace`.

## Validating the Plugin Locally

JSON manifest parse check (run from repo root):

```powershell
   powershell -Command "Get-Content plugins/controlflow-claude-code/.claude-plugin/plugin.json | ConvertFrom-Json"
```

Skill frontmatter check (run from repo root):

```powershell
   powershell -Command "Get-ChildItem plugins/controlflow-claude-code/skills -Recurse -Filter SKILL.md | ForEach-Object { $content = Get-Content $_ -Raw; if ($content -notmatch 'name:' -or $content -notmatch 'description:') { throw ('Missing required frontmatter in: ' + $_.FullName) } }"
```

There are **no plugin agents** in 1.0.0 (verification runs inline), so there is no
`agents/` directory and no agent-frontmatter check.

Claude Code native validation (requires claude CLI):

```sh
   cd plugins/controlflow-claude-code && claude plugin validate
```

## Skill Invocation Reference

Skills are invoked using the namespaced slash syntax:

```text
/controlflow-claude-code:{skill-name}
```

The three skills:

```text
/controlflow-claude-code:controlflow-plan     # generate a plan in the shared ControlFlow format
/controlflow-claude-code:controlflow-verify   # inline adversarial plan verification (zero subagents)
/controlflow-claude-code:controlflow-review    # evidence-backed review, layered over native /code-review
```

Typical MEDIUM/LARGE flow (routing lives in the repo `CLAUDE.md`):

```text
/controlflow-claude-code:controlflow-plan      # plan -> plans/<task-slug>-plan.md
/controlflow-claude-code:controlflow-verify    # verdict -> plans/artifacts/<task-slug>/verify-verdict.md
# ... implement ...
/controlflow-claude-code:controlflow-review     # review the diff against the plan
```

## Verification Artifacts

`controlflow-verify` writes a single combined verdict to
`plans/artifacts/{task-slug}/verify-verdict.md` (structural audit + mirage findings +
executability verdict + overall APPROVED/NEEDS_REVISION/REJECTED). There are no separate
per-verifier report templates in 1.0.0.

## Repo-Wide Verification

The canonical repo verification command (runs the full offline eval suite, which includes
the CLAUDE.md drift anchors and plugin manifest parity):

```sh
   cd evals && npm test
```