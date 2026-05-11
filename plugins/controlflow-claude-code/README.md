# ControlFlow for Claude Code

Version: 0.1.0

ControlFlow is a portable workflow system for non-trivial coding tasks. This plugin brings
ControlFlow's planning, review, and orchestration discipline to Claude Code via namespaced
skills and selected plugin agents.

## What This Plugin Provides

- Workflow skills invoked as `/controlflow-claude-code:<skill-name>`
- Selected plugin agents for isolated auditing, research, mapping, and review work
- Report templates and planning reference documents

## Skills (V1)

| Skill | Invocation | Purpose |
| --- | --- | --- |
| controlflow-router | /controlflow-claude-code:controlflow-router | Entry routing: decides whether to proceed directly or engage planning |
| controlflow-spec | /controlflow-claude-code:controlflow-spec | Spec-before-plan capture |
| controlflow-strict-workflow | /controlflow-claude-code:controlflow-strict-workflow | Full strict workflow entry point |
| controlflow-planning | /controlflow-claude-code:controlflow-planning | Strict phased planning |
| controlflow-plan-audit | /controlflow-claude-code:controlflow-plan-audit | Plan audit pass |
| controlflow-assumption-verifier | /controlflow-claude-code:controlflow-assumption-verifier | Mirage and assumption detection |
| controlflow-executability-verifier | /controlflow-claude-code:controlflow-executability-verifier | Cold-start executability simulation |
| controlflow-orchestration | /controlflow-claude-code:controlflow-orchestration | Execution discipline and gate management |
| controlflow-review | /controlflow-claude-code:controlflow-review | Evidence-backed implementation review |
| controlflow-memory-hygiene | /controlflow-claude-code:controlflow-memory-hygiene | Memory and artifact hygiene |

## Agents (V1)

Six focused plugin agents for isolated analysis work. Invoke via Claude Code agent dispatch.

- controlflow-code-mapper: read-only codebase discovery
- controlflow-researcher: evidence-based research
- controlflow-plan-auditor: plan structure and risk audit
- controlflow-assumption-verifier-agent: mirage and assumption verification
- controlflow-executability-verifier-agent: cold-start plan simulation
- controlflow-code-reviewer: implementation review and quality gate

## Installation

See USAGE.md for local development installation and plugin marketplace instructions.

## Requirements

- Claude Code with plugin support
- No external runtime dependencies

## Related

- Codex plugin sibling: plugins/controlflow-codex (VS Code Copilot / Codex)
- [ControlFlow repo](https://github.com/Smithbox-ai/ControlFlow)
