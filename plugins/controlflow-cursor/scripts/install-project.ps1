param(
    [Parameter(Mandatory = $true)]
    [string]$TargetRepo,

    [switch]$Force
)

$ErrorActionPreference = "Stop"

$pluginRoot = Split-Path $PSScriptRoot -Parent
$targetRoot = (Resolve-Path $TargetRepo).Path

function Copy-Tree([string]$Source, [string]$Dest) {
    if (-not (Test-Path $Source)) {
        throw "Missing source: $Source"
    }
    if (Test-Path $Dest) {
        if (-not $Force) {
            throw "Destination exists: $Dest. Use -Force to replace."
        }
        Remove-Item -LiteralPath $Dest -Recurse -Force
    }
    Copy-Item -LiteralPath $Source -Destination $Dest -Recurse -Force
}

$cursorDir = Join-Path $targetRoot ".cursor"
New-Item -ItemType Directory -Path $cursorDir -Force | Out-Null

Copy-Tree (Join-Path $pluginRoot "skills") (Join-Path $cursorDir "skills")
Copy-Tree (Join-Path $pluginRoot "agents") (Join-Path $cursorDir "agents")

$plansDir = Join-Path $targetRoot "plans"
$artifactsDir = Join-Path $plansDir "artifacts"
New-Item -ItemType Directory -Path $artifactsDir -Force | Out-Null

Write-Output "Installed ControlFlow-Cursor to $targetRoot"
Write-Output "  .cursor/skills (3 slim skills: plan, verify, review)"
Write-Output "  .cursor/agents (controlflow-planner)"
Write-Output "  plans/artifacts/ scaffold"
Write-Output "Usage: see plugins/controlflow-cursor/USAGE.md"
