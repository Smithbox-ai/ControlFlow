# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅        |

## Reporting a Vulnerability

If you discover a security vulnerability in ControlFlow — including but not limited to prompt injection vectors, privilege escalation through tool grants, or governance bypass — please report it responsibly.

**Do NOT open a public issue.**

Instead, use [GitHub's private vulnerability reporting](https://github.com/Smithbox-ai/ControlFlow/security/advisories/new) or email the maintainers directly.

### What to include
- Description of the vulnerability
- Which agent(s) or governance file(s) are affected
- Steps to reproduce
- Potential impact

### Response timeline
- **Acknowledgment:** within 48 hours
- **Assessment:** within 7 days
- **Fix or mitigation:** as soon as possible, depending on severity

## Security Architecture

ControlFlow incorporates several layers of security by design:

- **Least-privilege tool grants** — each agent receives only the tools required by its role, declared in frontmatter and enforced by body-level routing rules (`governance/tool-grants.json`)
- **Human approval gates** — destructive or irreversible operations require explicit user confirmation
- **Agent delegation roster** — Orchestrator and Planner may only delegate to project-internal agents documented in `plans/project-context.md`; external agents are prohibited
- **Security skill pattern** — `skills/patterns/security-patterns.md` covers auth, input validation, injection prevention, and secrets management
- **377 offline eval checks** — structural, behavioral, orchestration, and drift-detection validations run without live agents on every PR
