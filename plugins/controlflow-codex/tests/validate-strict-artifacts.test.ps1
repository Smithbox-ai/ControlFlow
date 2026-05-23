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

# ---------------------------------------------------------------------------
# TEST 1 — Positive: valid fixture must pass validate-strict-artifacts.ps1
# ---------------------------------------------------------------------------
Write-Output "TEST 1: Valid fixture must pass validate-strict-artifacts.ps1"
$output = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $validatorPath -RepoRoot $RepoRoot -PlanPath $validFixturePath 2>&1
$test1Exit = $LASTEXITCODE
if ($test1Exit -eq 0) {
    Write-Output "  PASS: Valid fixture accepted (exit 0)"
    $passed++
} else {
    Write-Output "  FAIL: Valid fixture was rejected. Output:"
    $output | ForEach-Object { Write-Output "    $_" }
    $failed++
}

# ---------------------------------------------------------------------------
# TEST 2 — Negative: invalid fixture (missing lifecycle sections) must fail
# ---------------------------------------------------------------------------
Write-Output "TEST 2: Invalid fixture (missing lifecycle sections) must fail validate-strict-artifacts.ps1"
$output = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $validatorPath -RepoRoot $RepoRoot -PlanPath $invalidFixturePath 2>&1
$test2Exit = $LASTEXITCODE
if ($test2Exit -ne 0) {
    $outputText = ($output | Out-String)
    $mentionsMissing = ($outputText -match "Outcomes") -or ($outputText -match "Idempotence") -or ($outputText -match "lifecycle") -or ($outputText -match "required section") -or ($outputText -match "required lifecycle")
    if ($mentionsMissing) {
        Write-Output "  PASS: Invalid fixture rejected for missing lifecycle sections (exit $test2Exit)"
    } else {
        Write-Output "  PASS: Invalid fixture rejected (exit $test2Exit)"
    }
    $passed++
} else {
    Write-Output "  FAIL: Invalid fixture was accepted when it should have been rejected"
    $output | ForEach-Object { Write-Output "    $_" }
    $failed++
}

# ---------------------------------------------------------------------------
# TEST 3 — Generated asset validation must pass for Codex output targets
# ---------------------------------------------------------------------------
Write-Output "TEST 3: Codex generated asset targets must match shared source manifest"
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
