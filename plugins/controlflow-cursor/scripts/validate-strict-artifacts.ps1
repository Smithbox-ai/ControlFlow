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
$codexScript = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\controlflow-codex\scripts\validate-strict-artifacts.ps1"))

if (-not (Test-Path $codexScript -PathType Leaf)) {
    throw "Missing Codex validator: $codexScript"
}

$validatorArgs = @(
    "-RepoRoot", $RepoRoot,
    "-PlanPath", $PlanPath
)
if ($RequirePlanAudit) { $validatorArgs += "-RequirePlanAudit" }
if ($RequireAssumptionVerifier) { $validatorArgs += "-RequireAssumptionVerifier" }
if ($RequireExecutabilityVerifier) { $validatorArgs += "-RequireExecutabilityVerifier" }

& $codexScript @validatorArgs
exit $LASTEXITCODE
