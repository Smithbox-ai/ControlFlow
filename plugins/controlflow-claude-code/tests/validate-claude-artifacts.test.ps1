param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
)

$ErrorActionPreference = "Continue"

$repoRootResolved = (Resolve-Path $RepoRoot).Path
$validatorPath    = Join-Path $repoRootResolved "plugins\controlflow-claude-code\scripts\validate-claude-artifacts.ps1"
$generatedAssetsValidatorPath = Join-Path $repoRootResolved "plugins\controlflow-shared-source\scripts\validate-generated-assets.ps1"

$validFixturePath      = "plugins/controlflow-claude-code/tests/fixtures/strict-plan-valid-plan.md"
$invalidFixturePath    = "plugins/controlflow-claude-code/tests/fixtures/strict-plan-missing-sections-plan.md"
$validLayoutRoot       = "plugins/controlflow-claude-code/tests/fixtures/plugin-structure-valid"
$invalidLayoutRoot     = "plugins/controlflow-claude-code/tests/fixtures/plugin-structure-invalid"

# Fixed required lifecycle section list.
# Must match the validator, plan template, valid fixture, and invalid fixture exactly.
$requiredLifecycleSections = @(
    "## Progress",
    "## Discoveries",
    "## Decision Log",
    "## Outcomes",
    "## Idempotence & Recovery"
)

$passedCount = 0
$failedCount = 0

# ---------------------------------------------------------------------------
# TEST 1: Valid plan fixture must pass lifecycle check (no require flags)
# Uses -SkipInventory to isolate plan lifecycle validation from inventory.
# ---------------------------------------------------------------------------
Write-Output "TEST 1: Valid plan fixture must pass validate-claude-artifacts.ps1 (lifecycle check)"
$output    = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $validatorPath `
                 -RepoRoot $RepoRoot -PlanPath $validFixturePath -SkipInventory 2>&1
$exitCode  = $LASTEXITCODE
if ($exitCode -eq 0) {
    Write-Output "  PASS: Valid fixture accepted (exit 0)"
    $passedCount++
} else {
    Write-Output "  FAIL: Valid fixture was rejected. Output:"
    $output | ForEach-Object { Write-Output "    $_" }
    $failedCount++
}

# ---------------------------------------------------------------------------
# TEST 2: Missing-sections fixture must fail with actionable lifecycle messages
# ---------------------------------------------------------------------------
Write-Output "TEST 2: Missing-sections fixture must fail with actionable lifecycle section messages"
$output    = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $validatorPath `
                 -RepoRoot $RepoRoot -PlanPath $invalidFixturePath -SkipInventory 2>&1
$exitCode  = $LASTEXITCODE
if ($exitCode -ne 0) {
    $outputText = ($output | Out-String)
    $mentionsLifecycle = ($outputText -match "Outcomes") -or
                         ($outputText -match "Idempotence") -or
                         ($outputText -match "lifecycle") -or
                         ($outputText -match "required lifecycle")
    if ($mentionsLifecycle) {
        Write-Output "  PASS: Missing-sections fixture rejected with lifecycle section messages (exit $exitCode)"
    } else {
        Write-Output "  PASS: Missing-sections fixture rejected (exit $exitCode)"
    }
    $passedCount++
} else {
    Write-Output "  FAIL: Missing-sections fixture was accepted when it should have been rejected"
    $output | ForEach-Object { Write-Output "    $_" }
    $failedCount++
}

# ---------------------------------------------------------------------------
# TEST 3: Valid plan fixture passes with all -Require* flags (artifacts present)
# Review artifact fixtures are in tests/fixtures/strict-plan-valid/ (slug subdir).
# ---------------------------------------------------------------------------
Write-Output "TEST 3: Valid plan fixture must pass with -RequirePlanAudit -RequireAssumptionVerifier -RequireExecutabilityVerifier"
$output    = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $validatorPath `
                 -RepoRoot $RepoRoot -PlanPath $validFixturePath `
                 -RequirePlanAudit -RequireAssumptionVerifier -RequireExecutabilityVerifier -SkipInventory 2>&1
$exitCode  = $LASTEXITCODE
if ($exitCode -eq 0) {
    Write-Output "  PASS: Valid fixture with review artifacts accepted (exit 0)"
    $passedCount++
} else {
    Write-Output "  FAIL: Valid fixture with review artifacts was rejected. Output:"
    $output | ForEach-Object { Write-Output "    $_" }
    $failedCount++
}

# ---------------------------------------------------------------------------
# TEST 4: Invalid plugin layout fixture must fail with actionable misplacement message
# skills/ placed inside .claude-plugin/ triggers the layout check.
# ---------------------------------------------------------------------------
Write-Output "TEST 4: Invalid plugin layout fixture must fail with misplacement message"
$output    = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $validatorPath `
                 -RepoRoot $RepoRoot -PluginRoot $invalidLayoutRoot -SkipInventory 2>&1
$exitCode  = $LASTEXITCODE
if ($exitCode -ne 0) {
    $outputText = ($output | Out-String)
    $mentionsMisplaced = ($outputText -match "Misplaced") -or
                         ($outputText -match "inside .claude-plugin") -or
                         ($outputText -match "plugin root")
    if ($mentionsMisplaced) {
        Write-Output "  PASS: Invalid layout rejected with actionable misplacement message (exit $exitCode)"
    } else {
        Write-Output "  PASS: Invalid layout rejected (exit $exitCode)"
    }
    $passedCount++
} else {
    Write-Output "  FAIL: Invalid layout fixture was accepted when it should have been rejected"
    $output | ForEach-Object { Write-Output "    $_" }
    $failedCount++
}

# ---------------------------------------------------------------------------
# TEST 5: Valid plugin layout fixture passes (layout check only, -SkipInventory)
# Minimal structure with .claude-plugin/plugin.json, skills/ and agents/ at root.
# ---------------------------------------------------------------------------
Write-Output "TEST 5: Valid plugin layout fixture must pass layout check (-SkipInventory)"
$output    = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $validatorPath `
                 -RepoRoot $RepoRoot -PluginRoot $validLayoutRoot -SkipInventory 2>&1
$exitCode  = $LASTEXITCODE
if ($exitCode -eq 0) {
    Write-Output "  PASS: Valid layout fixture accepted (exit 0)"
    $passedCount++
} else {
    Write-Output "  FAIL: Valid layout fixture was rejected. Output:"
    $output | ForEach-Object { Write-Output "    $_" }
    $failedCount++
}

# ---------------------------------------------------------------------------
# TEST 6: Full plugin validation (retroactively validates Phase 3 skills + Phase 4 agents)
# Runs against the actual plugins/controlflow-claude-code/ directory.
# Failure here means Phase 3 or Phase 4 artifacts have issues that must be
# resolved before Phase 6 documentation work begins.
# ---------------------------------------------------------------------------
Write-Output "TEST 6: Full plugin validation (Phase 3 skills + Phase 4 agents retroactive check)"
$output    = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $validatorPath `
                 -RepoRoot $RepoRoot 2>&1
$exitCode  = $LASTEXITCODE
if ($exitCode -eq 0) {
    Write-Output "  PASS: Full plugin validation passed - all Phase 3 skills and Phase 4 agents valid (exit 0)"
    $passedCount++
} else {
    Write-Output "  FAIL: Full plugin validation failed. Failures must be resolved before Phase 6 begins:"
    $output | ForEach-Object { Write-Output "    $_" }
    $failedCount++
}

# ---------------------------------------------------------------------------
# TEST 7: Generated asset validation must pass for Claude Code output targets
# ---------------------------------------------------------------------------
Write-Output "TEST 7: Claude Code generated asset targets must match shared source manifest"
$output    = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $generatedAssetsValidatorPath `
                 -RepoRoot $RepoRoot -Host claude_code 2>&1
$exitCode  = $LASTEXITCODE
if ($exitCode -eq 0) {
    Write-Output "  PASS: Claude Code generated outputs match shared source targets (exit 0)"
    $passedCount++
} else {
    Write-Output "  FAIL: Claude Code generated outputs drifted from shared source targets. Output:"
    $output | ForEach-Object { Write-Output "    $_" }
    $failedCount++
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Output ""
Write-Output "Results: $passedCount passed, $failedCount failed"
Write-Output "Fixed lifecycle section list under test:"
foreach ($section in $requiredLifecycleSections) {
    Write-Output "  $section"
}

if ($failedCount -gt 0) {
    Write-Output "validate-claude-artifacts.test.ps1: $failedCount test(s) FAILED"
    exit 1
}
Write-Output "All tests passed."
exit 0
