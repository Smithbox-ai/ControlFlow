param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [Parameter(Mandatory = $true)]
    [string]$PlanPath,

    [switch]$RequirePlanAudit,
    [switch]$RequireAssumptionVerifier,
    [switch]$RequireExecutabilityVerifier
)

$ErrorActionPreference = "Stop"

function Read-Text([string]$Path) {
    if (-not (Test-Path $Path)) {
        throw "Missing file: $Path"
    }
    return Get-Content $Path -Raw
}

function Assert-Contains([string]$Content, [string]$Needle, [string]$Label) {
    if ($Content -notmatch [regex]::Escape($Needle)) {
        throw "Missing required section '$Label'"
    }
}

$repoRootResolved = (Resolve-Path $RepoRoot).Path
$planResolved = if ([System.IO.Path]::IsPathRooted($PlanPath)) { $PlanPath } else { Join-Path $repoRootResolved $PlanPath }
$planContent = Read-Text $planResolved

$planSections = @(
    "# Plan:",
    "**Status:**",
    "**Agent:**",
    "**Schema Version:**",
    "**Complexity Tier:**",
    "**Confidence:**",
    "## Context & Analysis",
    "## Design Decisions",
    "## Implementation Phases",
    "## Inter-Phase Contracts",
    "## Open Questions",
    "## Risks",
    "## Semantic Risk Review",
    "## Success Criteria",
    "## Handoff",
    "## Notes for Orchestration"
)

foreach ($section in $planSections) {
    Assert-Contains $planContent $section $section
}

$planLeaf = Split-Path $planResolved -Leaf
if ($planLeaf -notmatch '^(?<slug>.+)-plan\.md$') {
    throw "Plan filename must end with '-plan.md': $planLeaf"
}
$taskSlug = $Matches['slug']
$artifactRoot = Join-Path $repoRootResolved "plans/artifacts/$taskSlug"

# Lifecycle section enforcement for ControlFlow-Codex strict plans only.
# Scope: Codex strict-plan artifacts validated by this script.
# Does not apply to core VS Code Planner artifacts unless Phase 7 explicitly adds and tests that support.
# The five required headings must match the plan template, valid fixture, invalid fixture, and test harness exactly.
$lifecycleSections = @(
    "## Progress",
    "## Discoveries",
    "## Decision Log",
    "## Outcomes",
    "## Idempotence & Recovery"
)

$missingLifecycle = @()
foreach ($section in $lifecycleSections) {
    if ($planContent -notmatch [regex]::Escape($section)) {
        $missingLifecycle += $section
    }
}
if ($missingLifecycle.Count -gt 0) {
    foreach ($missing in $missingLifecycle) {
        Write-Output "Missing required lifecycle section: '$missing'"
    }
    throw "ControlFlow-Codex strict plan is missing $($missingLifecycle.Count) required lifecycle section(s) in: $planResolved"
}

$artifactChecks = @()
if ($RequirePlanAudit) {
    $artifactChecks += [pscustomobject]@{
        Path = Join-Path $artifactRoot "plan-audit.md"
        Sections = @("# Plan Audit Report", "**Status:**", "## Findings", "## Risk Summary", "## Recommendation", "## Evidence")
    }
}
if ($RequireAssumptionVerifier) {
    $artifactChecks += [pscustomobject]@{
        Path = Join-Path $artifactRoot "assumption-verifier.md"
        Sections = @("# Assumption Verifier Report", "**Status:**", "## Mirages Found", "## Dimensional Scores", "## Summary", "## Evidence")
    }
}
if ($RequireExecutabilityVerifier) {
    $artifactChecks += [pscustomobject]@{
        Path = Join-Path $artifactRoot "executability-verifier.md"
        Sections = @("# Executability Verifier Report", "**Status:**", "## Tasks Simulated", "## Per-Task Checklist", "## Walkthrough Summary", "## Recommendation")
    }
}

foreach ($artifact in $artifactChecks) {
    $artifactContent = Read-Text $artifact.Path
    foreach ($section in $artifact.Sections) {
        Assert-Contains $artifactContent $section $section
    }
}

Write-Output "VALID plan: $planResolved"
foreach ($artifact in $artifactChecks) {
    Write-Output "VALID artifact: $($artifact.Path)"
}
