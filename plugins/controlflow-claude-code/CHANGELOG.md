# Changelog - ControlFlow for Claude Code

All notable changes to this plugin will be documented here.

Format: Added / Changed / Fixed / Removed per release.

## [0.1.0] - 2026-05-11

### Added

- Plugin skeleton under plugins/controlflow-claude-code/
- Manifest at .claude-plugin/plugin.json with name, version, description, author, repository, license, and keywords
- README.md and USAGE.md initial shells
- Report templates: plan-audit-report-template.md, assumption-verifier-report-template.md, executability-verifier-report-template.md
- Planning reference files: plan-template.md, complexity-tiers.md, semantic-risk-taxonomy.md, controlflow-portability.md, planner-output-contract.md
- Skills (Phase 3): ten ControlFlow workflow skills adapted for Claude Code native slash invocation
- Agents (Phase 4): six selected plugin agents for isolated audit, research, and review work (including `controlflow-assumption-verifier-agent` and `controlflow-executability-verifier-agent`)
- Validator and tests (Phase 5): validate-claude-artifacts.ps1, test suite, and fixtures
- Documentation (Phase 6): README.md, USAGE.md, and integrated project docs
