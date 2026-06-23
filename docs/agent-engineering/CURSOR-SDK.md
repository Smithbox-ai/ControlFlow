# Cursor SDK (Optional ControlFlow Validation)

ControlFlow's primary Cursor integration is the `plugins/controlflow-cursor/` plugin (Project Rules, workflow Skills, agents). See [CURSOR-SUPPORT.md](CURSOR-SUPPORT.md) for the plugin surface. The legacy root `.cursor/` mirror is retired.

The [Cursor SDK](https://cursor.com/docs/sdk/overview) (`@cursor/sdk` / `cursor-sdk`) can run agents programmatically for **CI validation** or scripted plan review — not as a replacement for the in-IDE plugin or the VS Code Copilot runtime.

## When to use

- Validate that a `plans/*-plan.md` artifact is internally consistent after a human or agent authored it.
- Run a read-only audit prompt in CI when merging plan changes.
- Automate smoke checks that reference ControlFlow skills by name in the prompt.

## When not to use

- Replacing in-IDE execution for implementer phases (use Cursor Agent mode + the plugin's agents locally).
- Expecting `agent/runSubagent` or VS Code `@controlflow-planner` semantics. Cursor does not support those VS Code surfaces.

## Example (TypeScript, validate-only)

```typescript
import { Agent } from "@cursor/sdk";

const result = await Agent.prompt(
  [
    "Read plans/my-task-plan.md.",
    "Follow the controlflow-verify structural-audit discipline.",
    "Return APPROVED or NEEDS_REVISION with cited plan sections only.",
    "Do not modify files.",
  ].join("\n"),
  {
    apiKey: process.env.CURSOR_API_KEY!,
    model: { id: "composer-2.5" },
    local: { cwd: process.cwd() },
  },
);

if (result.status !== "completed") {
  process.exit(1);
}
```

## Example (Python)

```python
import os
from cursor_sdk import Agent, AgentOptions, LocalAgentOptions

result = Agent.prompt(
    "Audit plans/my-task-plan.md using controlflow-verify rules. Read-only.",
    AgentOptions(
        api_key=os.environ["CURSOR_API_KEY"],
        model="composer-2.5",
        local=LocalAgentOptions(cwd=os.getcwd()),
    ),
)
```

## CI guidance

- Store `CURSOR_API_KEY` as a repository secret.
- Prefer read-only prompts for gates; implementation belongs in IDE workflows.
- Keep deterministic structural checks in `cd evals && npm test`; use the SDK for discretionary narrative audit only when needed.

## References

- Cursor SDK docs: https://cursor.com/docs/sdk/typescript
- Plugin usage: `plugins/controlflow-cursor/USAGE.md`
- Strict artifact script: `plugins/controlflow-cursor/scripts/validate-strict-artifacts.ps1`