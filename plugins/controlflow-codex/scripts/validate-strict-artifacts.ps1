param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [Parameter(Mandatory = $true)]
    [string]$PlanPath,

    [switch]$RequirePlanAudit,
    [switch]$RequireAssumptionVerifier,
    [switch]$RequireExecutabilityVerifier,
    [switch]$StrictReviewByTier
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

function Test-UnresolvedHighRisk([string]$Content) {
    foreach ($line in ($Content -split "`r?`n")) {
        if ($line -notmatch '^\s*\|') {
            continue
        }

        $columns = @($line.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim().Trim('`') })
        if ($columns.Count -lt 5) {
            continue
        }

        $applicability = $columns[1].ToLowerInvariant()
        $impact = $columns[2].ToUpperInvariant()
        $disposition = $columns[4].ToLowerInvariant()
        if (($applicability -eq "applicable") -and
            ($impact -eq "HIGH") -and
            ($disposition -notin @("resolved", "not_applicable"))) {
            return $true
        }
    }

    return $false
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
$lifecyclePositions = @()
foreach ($section in $lifecycleSections) {
    $headingPattern = "(?m)^" + [regex]::Escape($section) + "\s*$"
    $matches = [regex]::Matches($planContent, $headingPattern)
    if ($matches.Count -eq 0) {
        $missingLifecycle += $section
    } else {
        $lifecyclePositions += [pscustomobject]@{
            Heading = $section
            Index = $matches[0].Index
        }
    }
}
if ($missingLifecycle.Count -gt 0) {
    foreach ($missing in $missingLifecycle) {
        Write-Output "Missing required lifecycle section: '$missing'"
    }
    throw "ControlFlow-Codex strict plan is missing $($missingLifecycle.Count) required lifecycle section(s) in: $planResolved"
}

$orderErrors = @()
for ($i = 1; $i -lt $lifecyclePositions.Count; $i++) {
    if ($lifecyclePositions[$i - 1].Index -ge $lifecyclePositions[$i].Index) {
        $orderErrors += "'$($lifecyclePositions[$i].Heading)' must appear after '$($lifecyclePositions[$i - 1].Heading)'"
    }
}
if ($orderErrors.Count -gt 0) {
    foreach ($orderError in $orderErrors) {
        Write-Output "Lifecycle section out of order: $orderError"
    }
    throw "ControlFlow-Codex strict plan lifecycle sections are out of order in: $planResolved"
}

$needsPlanAudit = $RequirePlanAudit.IsPresent
$needsAssumptionVerifier = $RequireAssumptionVerifier.IsPresent
$needsExecutabilityVerifier = $RequireExecutabilityVerifier.IsPresent

if ($StrictReviewByTier) {
    $tierMatch = [regex]::Match(
        $planContent,
        '(?mi)^\*\*Complexity Tier:\*\*\s*`?(TRIVIAL|SMALL|MEDIUM|LARGE)`?\s*$'
    )
    if (-not $tierMatch.Success) {
        throw "Strict review-by-tier validation requires a parseable Complexity Tier in: $planResolved"
    }

    $complexityTier = $tierMatch.Groups[1].Value.ToUpperInvariant()
    switch ($complexityTier) {
        "SMALL" {
            $needsPlanAudit = $true
        }
        "MEDIUM" {
            $needsPlanAudit = $true
            $needsAssumptionVerifier = $true
        }
        "LARGE" {
            $needsPlanAudit = $true
            $needsAssumptionVerifier = $true
            $needsExecutabilityVerifier = $true
        }
    }

    if (Test-UnresolvedHighRisk $planContent) {
        $needsAssumptionVerifier = $true
    }

    Write-Output "Strict review-by-tier: tier=$complexityTier plan_audit=$needsPlanAudit assumption_verifier=$needsAssumptionVerifier executability_verifier=$needsExecutabilityVerifier"
}

$artifactChecks = @()
if ($needsPlanAudit) {
    $artifactChecks += [pscustomobject]@{
        Path = Join-Path $artifactRoot "plan-audit.md"
        Sections = @("# Plan Audit Report", "**Status:**", "## Findings", "## Risk Summary", "## Recommendation", "## Evidence")
    }
}
if ($needsAssumptionVerifier) {
    $artifactChecks += [pscustomobject]@{
        Path = Join-Path $artifactRoot "assumption-verifier.md"
        Sections = @("# Assumption Verifier Report", "**Status:**", "## Mirages Found", "## Dimensional Scores", "## Summary", "## Evidence")
    }
}
if ($needsExecutabilityVerifier) {
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
