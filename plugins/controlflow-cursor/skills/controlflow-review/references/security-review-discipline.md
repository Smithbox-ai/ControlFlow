# Security Review Discipline

Use this reference only when `controlflow-review` or `controlflow-verify` enters a
security-focused pass on a plan that touches authentication, authorization, secrets,
or trust boundaries. General security review — finding and explaining auth,
authorization, injection, crypto, and dependency issues — belongs to native host
review (Codex `/review`); consume its results. This reference only adds the
ControlFlow-specific anti-noise rules below.

## Confidence Threshold

- **Flag an issue as a security vulnerability only when confidence is > 80%.**
- Below that threshold: record as an observation or suggested follow-up, not as a blocking finding.

This avoids review noise and keeps the signal of "this is a real vulnerability" meaningful.

## Explicit Exclusion List

Do NOT flag the following categories during a security review pass — they belong to other review modes or are out of scope:

- Denial-of-service (DoS) without a concrete exploitation chain
- Secrets-on-disk (a separate hygiene concern)
- Rate-limiting gaps without a concrete abuse scenario
- Theoretical issues with no realistic exploitation path
- Style or formatting issues

## When to Use This Reference

| Situation | Use |
| --- | --- |
| User asks for a security review specifically | Native `/review`, then this reference for plan conformance |
| Plan touches authentication, authorization, secrets, or trust boundaries | This reference during `controlflow-verify` |
| General code review with security only as one dimension | Apply the threshold and exclusion list, but do not gate the whole review on it |
| Ordinary refactor with no trust-boundary impact | Skip this reference |
