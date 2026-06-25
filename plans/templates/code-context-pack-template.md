# Code Context Pack Template

Use this for CodeMapper output when an executor needs a small, restartable code map.

## Code Context Pack: {Scope}

**Artifact Type:** CodeContextPack
**schema_version:** 1.0.0
**Trace ID:** optional UUID

### Entry Points

- File, symbol, and line for starting investigation.

### Top Files

- File, purpose, and read priority: must_read, reference_only, or avoid_unless_needed.

### Symbols

- Important symbols with file and line.

### Call Paths

- Named path through the relevant code flow.

### Hotspots

- Files or symbols with correctness, compatibility, or scope risk.

### Expand When

- Conditions that justify opening more files beyond this compact pack.
