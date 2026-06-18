# Mirage Pattern Catalog

Use these patterns when checking whether a plan is grounded in repository reality.

## Presence Mirages

- P1 **Phantom API**: a function, hook, or method is referenced but does not exist as
   claimed.
- P2 **Version Mismatch**: the plan assumes library behavior that the installed version may
   not support.
- P3 **Pattern Mismatch**: the plan assumes conventions that conflict with the codebase.
- P4 **Missing Dependency**: the plan depends on a library or tool that is not present.
- P5 **File Path Hallucination**: the plan names files or directories that are not there.
- P6 **Schema Mismatch**: the plan describes a data shape that conflicts with the actual
   schema.
- P7 **Integration Fantasy**: the plan assumes systems connect in ways the repository does
   not show.
- P8 **Scope Creep**: the plan includes tasks not traceable to the request.
- P9 **Test Infrastructure Mismatch**: the plan assumes the wrong test framework or
   pattern.
- P10 **Concurrency Blindness**: the plan ignores shared mutable state or collision risk in
    parallel work.

## Absence Mirages

- A11 **Missing Error Path**: the plan only covers the happy path.
- A12 **Missing Validation**: unsafe or unchecked input paths are ignored.
- A13 **Missing Edge Case**: empty, null, zero, boundary, or fallback behavior is omitted.
- A14 **Missing Requirement**: the request implies behavior that no phase actually delivers.
- A15 **Missing Cleanup**: resources or temporary state are created but never cleaned up.
- A16 **Missing Migration**: schema or contract changes appear without migration or rollback
    planning.
- A17 **Missing Security Boundary**: sensitive operations lack explicit access or safety
    boundaries.
