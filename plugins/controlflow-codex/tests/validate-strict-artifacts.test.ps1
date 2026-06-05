param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
)

$ErrorActionPreference = "Continue"

$repoRootResolved = (Resolve-Path $RepoRoot).Path
$validatorPath = Join-Path $repoRootResolved "plugins/controlflow-codex/scripts/validate-strict-artifacts.ps1"
$generatedAssetsValidatorPath = Join-Path $repoRootResolved "plugins/controlflow-shared-source/scripts/validate-generated-assets.ps1"
$validFixturePath = "plugins/controlflow-codex/tests/fixtures/strict-plan-lifecycle-valid-plan.md"
$invalidFixturePath = "plugins/controlflow-codex/tests/fixtures/strict-plan-lifecycle-missing-sections-plan.md"
$reorderedFixturePath = "plugins/controlflow-codex/tests/fixtures/strict-plan-lifecycle-reordered-plan.md"
$tierMissingFixturePath = "plugins/controlflow-codex/tests/fixtures/strict-plan-tier-missing-review-plan.md"

# Fixed required lifecycle section list — must match template, fixtures, and validator exactly.
$requiredLifecycleSections = @(
    "## Progress",
    "## Discoveries",
    "## Decision Log",
    "## Outcomes",
    "## Idempotence & Recovery"
)

$passed = 0
$failed = 0

function Invoke-StrictValidator([string]$Root, [string]$Plan, [string[]]$ExtraArgs = @()) {
    $output = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $validatorPath -RepoRoot $Root -PlanPath $Plan @ExtraArgs 2>&1
    return [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Output = $output
        OutputText = ($output | Out-String)
    }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
    $parent = Split-Path $Path -Parent
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Write-ReviewArtifact([string]$Root, [string]$Slug, [string]$Kind) {
    $artifactRoot = Join-Path $Root "plans/artifacts/$Slug"
    switch ($Kind) {
        "plan-audit" {
            Write-Utf8NoBom (Join-Path $artifactRoot "plan-audit.md") @"
# Plan Audit Report
**Status:** APPROVED
## Findings
None.
## Risk Summary
Low.
## Recommendation
Proceed.
## Evidence
Synthetic fixture.
"@
        }
        "assumption-verifier" {
            Write-Utf8NoBom (Join-Path $artifactRoot "assumption-verifier.md") @"
# Assumption Verifier Report
**Status:** APPROVED
## Mirages Found
None.
## Dimensional Scores
Passing.
## Summary
Approved.
## Evidence
Synthetic fixture.
"@
        }
        "executability-verifier" {
            Write-Utf8NoBom (Join-Path $artifactRoot "executability-verifier.md") @"
# Executability Verifier Report
**Status:** PASS
## Tasks Simulated
One.
## Per-Task Checklist
Passing.
## Walkthrough Summary
Executable.
## Recommendation
Proceed.
"@
        }
    }
}

# ---------------------------------------------------------------------------
# TEST 1 — Positive: valid fixture must pass validate-strict-artifacts.ps1
# ---------------------------------------------------------------------------
Write-Output "TEST 1: Valid fixture must pass validate-strict-artifacts.ps1"
$result = Invoke-StrictValidator $RepoRoot $validFixturePath
if ($result.ExitCode -eq 0) {
    Write-Output "  PASS: Valid fixture accepted (exit 0)"
    $passed++
} else {
    Write-Output "  FAIL: Valid fixture was rejected. Output:"
    $result.Output | ForEach-Object { Write-Output "    $_" }
    $failed++
}

# ---------------------------------------------------------------------------
# TEST 2 — Negative: invalid fixture (missing lifecycle sections) must fail
# ---------------------------------------------------------------------------
Write-Output "TEST 2: Invalid fixture (missing lifecycle sections) must fail validate-strict-artifacts.ps1"
$result = Invoke-StrictValidator $RepoRoot $invalidFixturePath
if ($result.ExitCode -ne 0) {
    $mentionsMissing = ($result.OutputText -match "Outcomes") -or ($result.OutputText -match "Idempotence") -or ($result.OutputText -match "lifecycle") -or ($result.OutputText -match "required section") -or ($result.OutputText -match "required lifecycle")
    if ($mentionsMissing) {
        Write-Output "  PASS: Invalid fixture rejected for missing lifecycle sections (exit $($result.ExitCode))"
    } else {
        Write-Output "  PASS: Invalid fixture rejected (exit $($result.ExitCode))"
    }
    $passed++
} else {
    Write-Output "  FAIL: Invalid fixture was accepted when it should have been rejected"
    $result.Output | ForEach-Object { Write-Output "    $_" }
    $failed++
}

# ---------------------------------------------------------------------------
# TEST 3 — Negative: reordered lifecycle sections must fail
# ---------------------------------------------------------------------------
Write-Output "TEST 3: Reordered lifecycle sections must fail validate-strict-artifacts.ps1"
$result = Invoke-StrictValidator $RepoRoot $reorderedFixturePath
if (($result.ExitCode -ne 0) -and ($result.OutputText -match "out of order")) {
    Write-Output "  PASS: Reordered lifecycle fixture rejected with an order diagnostic"
    $passed++
} else {
    Write-Output "  FAIL: Reordered lifecycle fixture was not rejected for ordering"
    $result.Output | ForEach-Object { Write-Output "    $_" }
    $failed++
}

# ---------------------------------------------------------------------------
# TEST 4 — Negative: strict SMALL tier requires plan-audit artifact
# ---------------------------------------------------------------------------
Write-Output "TEST 4: Strict review-by-tier must reject SMALL fixture without plan-audit"
$result = Invoke-StrictValidator $RepoRoot $tierMissingFixturePath @("-StrictReviewByTier")
if (($result.ExitCode -ne 0) -and ($result.OutputText -match "plan-audit.md")) {
    Write-Output "  PASS: SMALL fixture rejected for missing plan-audit artifact"
    $passed++
} else {
    Write-Output "  FAIL: SMALL fixture was not rejected for missing plan-audit artifact"
    $result.Output | ForEach-Object { Write-Output "    $_" }
    $failed++
}

# ---------------------------------------------------------------------------
# TEST 5 — Table-driven: strict tier matrix accepts the required artifact set
# ---------------------------------------------------------------------------
Write-Output "TEST 5: Strict review-by-tier matrix accepts required artifacts for SMALL/MEDIUM/LARGE"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("controlflow-strict-tier-" + [guid]::NewGuid().ToString("N"))
try {
    $validSource = Get-Content (Join-Path $repoRootResolved $validFixturePath) -Raw
    $tierCases = @(
        [pscustomobject]@{ Tier = "SMALL"; Artifacts = @("plan-audit") },
        [pscustomobject]@{ Tier = "MEDIUM"; Artifacts = @("plan-audit", "assumption-verifier") },
        [pscustomobject]@{ Tier = "LARGE"; Artifacts = @("plan-audit", "assumption-verifier", "executability-verifier") }
    )
    $matrixPass = $true
    foreach ($case in $tierCases) {
        $slug = "strict-tier-" + $case.Tier.ToLowerInvariant()
        $planRel = "plans/$slug-plan.md"
        $planContent = [regex]::Replace($validSource, '(?m)^\*\*Complexity Tier:\*\*.*$', "**Complexity Tier:** $($case.Tier)")
        Write-Utf8NoBom (Join-Path $tempRoot $planRel) $planContent
        foreach ($artifact in $case.Artifacts) {
            Write-ReviewArtifact $tempRoot $slug $artifact
        }
        $result = Invoke-StrictValidator $tempRoot $planRel @("-StrictReviewByTier")
        if ($result.ExitCode -ne 0) {
            $matrixPass = $false
            Write-Output "  Matrix case failed for $($case.Tier):"
            $result.Output | ForEach-Object { Write-Output "    $_" }
        }
    }
    if ($matrixPass) {
        Write-Output "  PASS: SMALL/MEDIUM/LARGE required artifact sets accepted"
        $passed++
    } else {
        Write-Output "  FAIL: One or more tier matrix cases failed"
        $failed++
    }

    $highSlug = "strict-tier-small-high-risk"
    $highPlanRel = "plans/$highSlug-plan.md"
    $highPlan = [regex]::Replace($validSource, '(?m)^\*\*Complexity Tier:\*\*.*$', "**Complexity Tier:** SMALL")
    $highPlan = [regex]::Replace(
        $highPlan,
        '(?m)^\| data_volume \|.*$',
        '| data_volume | applicable | HIGH | synthetic fixture | open_question |'
    )
    Write-Utf8NoBom (Join-Path $tempRoot $highPlanRel) $highPlan
    Write-ReviewArtifact $tempRoot $highSlug "plan-audit"
    $result = Invoke-StrictValidator $tempRoot $highPlanRel @("-StrictReviewByTier")
    if (($result.ExitCode -ne 0) -and ($result.OutputText -match "assumption-verifier.md")) {
        Write-Output "  PASS: Unresolved HIGH risk requires assumption-verifier regardless of SMALL tier"
        $passed++
    } else {
        Write-Output "  FAIL: Unresolved HIGH risk did not require assumption-verifier"
        $result.Output | ForEach-Object { Write-Output "    $_" }
        $failed++
    }
} finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# TEST 6 — Generated asset validation must pass for Codex output targets
# ---------------------------------------------------------------------------
Write-Output "TEST 6: Codex generated asset targets must match shared source manifest"
$output = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $generatedAssetsValidatorPath -RepoRoot $RepoRoot -Host codex 2>&1
$test3Exit = $LASTEXITCODE
if ($test3Exit -eq 0) {
    Write-Output "  PASS: Codex generated outputs match shared source targets (exit 0)"
    $passed++
} else {
    Write-Output "  FAIL: Codex generated outputs drifted from shared source targets. Output:"
    $output | ForEach-Object { Write-Output "    $_" }
    $failed++
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Output ""
Write-Output "Results: $passed passed, $failed failed"
Write-Output "Fixed lifecycle section list under test:"
foreach ($section in $requiredLifecycleSections) {
    Write-Output "  $section"
}

if ($failed -gt 0) {
    Write-Error "validate-strict-artifacts.test.ps1: $failed test(s) FAILED"
    exit 1
}

Write-Output "All tests passed."
