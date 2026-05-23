# Claude Code Host Overrides

This directory contains Claude Code overlays for declared shared skill and template targets.

The overlay preserves Claude Code invocation syntax, frontmatter wording, and line wrapping while allowing the generator to validate the output tree deterministically.

Use `generation-overrides.json` for small host-specific insertions that can be derived from canonical source. Keep full files under `skills/` or `templates/` only when the host wording differs throughout the asset.
