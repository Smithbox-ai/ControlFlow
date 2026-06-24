param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
)

$ErrorActionPreference = "Continue"

$repoRootResolved = (Resolve-Path $RepoRoot).Path
$validatorPath = Join-Path $repoRootResolved "plugins\controlflow-shared-source\scripts\validate-generated-assets.ps1"
$syncPath = Join-Path $repoRootResolved "plugins\controlflow-shared-source\scripts\sync-plugin-assets.ps1"
$driftTarget = Join-Path $repoRootResolved "plugins\controlflow-codex\skills\controlflow-plan\SKILL.md"

$passedCount = 0
$failedCount = 0

function Get-Sha256([string]$Path) {
    return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

function Write-TestOutput([object[]]$Output) {
    $Output | ForEach-Object { Write-Output "    $_" }
}

# ---------------------------------------------------------------------------
# TEST 1: Current generated outputs must validate without writes.
# ---------------------------------------------------------------------------
Write-Output "TEST 1: Generated asset validation must pass without writes"
$output = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $validatorPath -RepoRoot $RepoRoot 2>&1
$exitCode = $LASTEXITCODE
if ($exitCode -eq 0) {
    Write-Output "  PASS: Generated outputs match declared shared source targets (exit 0)"
    $passedCount++
} else {
    Write-Output "  FAIL: Generated outputs did not validate. Output:"
    Write-TestOutput $output
    $failedCount++
}

# ---------------------------------------------------------------------------
# TEST 2: Validation mode must detect drift and leave the drifted file untouched.
# ---------------------------------------------------------------------------
Write-Output "TEST 2: Validation mode detects drift without writing"
$originalBytes = [System.IO.File]::ReadAllBytes($driftTarget)
$originalHash = Get-Sha256 $driftTarget
$driftBytes = $originalBytes + [System.Text.Encoding]::ASCII.GetBytes("`nPHASE5_GENERATED_ASSET_DRIFT_TEST")
$driftHash = $null
try {
    [System.IO.File]::WriteAllBytes($driftTarget, $driftBytes)
    $driftHash = Get-Sha256 $driftTarget
    $output = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $validatorPath -RepoRoot $RepoRoot -Host codex 2>&1
    $exitCode = $LASTEXITCODE
    $afterValidationHash = Get-Sha256 $driftTarget

    if (($exitCode -ne 0) -and ($afterValidationHash -eq $driftHash)) {
        Write-Output "  PASS: Drift was rejected and validation mode did not rewrite the file (exit $exitCode)"
        $passedCount++
    } else {
        Write-Output "  FAIL: Drift validation behavior was incorrect"
        Write-Output "    exit=$exitCode driftHash=$driftHash afterValidationHash=$afterValidationHash"
        Write-TestOutput $output
        $failedCount++
    }

    $output = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $syncPath -RepoRoot $RepoRoot -Host codex -Write 2>&1
    $exitCode = $LASTEXITCODE
    $afterWriteHash = Get-Sha256 $driftTarget
    if (($exitCode -eq 0) -and ($afterWriteHash -eq $originalHash)) {
        Write-Output "  PASS: Write mode restored the declared generated target (exit 0)"
        $passedCount++
    } else {
        Write-Output "  FAIL: Write mode did not restore the declared generated target"
        Write-Output "    exit=$exitCode originalHash=$originalHash afterWriteHash=$afterWriteHash"
        Write-TestOutput $output
        $failedCount++
    }
} finally {
    [System.IO.File]::WriteAllBytes($driftTarget, $originalBytes)
}

# ---------------------------------------------------------------------------
# TEST 3: Write mode must not delete unmanaged files.
# ---------------------------------------------------------------------------
Write-Output "TEST 3: Write mode must preserve unmanaged files"
$unmanagedPath = Join-Path $repoRootResolved "plugins\controlflow-codex\skills\.shared-source-unmanaged-test.tmp"
try {
    Set-Content -Path $unmanagedPath -Value "unmanaged" -NoNewline
    $output = powershell.exe -ExecutionPolicy Bypass -NoProfile -File $syncPath -RepoRoot $RepoRoot -Host codex -Write 2>&1
    $exitCode = $LASTEXITCODE
    if (($exitCode -eq 0) -and (Test-Path $unmanagedPath -PathType Leaf)) {
        Write-Output "  PASS: Unmanaged file preserved by write mode (exit 0)"
        $passedCount++
    } else {
        Write-Output "  FAIL: Unmanaged file was not preserved by write mode"
        Write-TestOutput $output
        $failedCount++
    }
} finally {
    if (Test-Path $unmanagedPath) {
        Remove-Item -Path $unmanagedPath -Force
    }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Output ""
Write-Output "Results: $passedCount passed, $failedCount failed"

if ($failedCount -gt 0) {
    Write-Output "validate-generated-assets.test.ps1: $failedCount test(s) FAILED"
    exit 1
}

Write-Output "All tests passed."
exit 0