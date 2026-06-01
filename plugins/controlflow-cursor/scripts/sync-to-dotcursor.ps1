param(
    [string]$RepoRoot = (Get-Location).Path,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $RepoRoot).Path
$pluginRoot = Join-Path $RepoRoot "plugins\controlflow-cursor"
$sharedSync = Join-Path $RepoRoot "plugins\controlflow-shared-source\scripts\sync-plugin-assets.ps1"

function Remove-CodexSkillArtifacts([string]$SkillsRoot) {
    if (-not (Test-Path $SkillsRoot)) { return }
    Get-ChildItem -Path $SkillsRoot -Recurse -Filter "openai.yaml" -File -ErrorAction SilentlyContinue |
        Remove-Item -Force
    Get-ChildItem -Path $SkillsRoot -Recurse -Directory -Filter "agents" -ErrorAction SilentlyContinue |
        Where-Object { @(Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue).Count -eq 0 } |
        Remove-Item -Recurse -Force
}

function Copy-Tree([string]$Source, [string]$Dest) {
    if (-not (Test-Path $Source)) { throw "Missing source: $Source" }
    if (Test-Path $Dest) {
        if (-not $Force) { throw "Destination exists: $Dest. Use -Force." }
        Remove-Item -LiteralPath $Dest -Recurse -Force
    }
    Copy-Item -LiteralPath $Source -Destination $Dest -Recurse -Force
}

& $sharedSync -RepoRoot $RepoRoot -Host cursor -Write
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$pluginSkills = Join-Path $pluginRoot "skills"
Remove-CodexSkillArtifacts $pluginSkills

$dotCursor = Join-Path $RepoRoot ".cursor"
New-Item -ItemType Directory -Path $dotCursor -Force | Out-Null
Copy-Tree $pluginSkills (Join-Path $dotCursor "skills")
Copy-Tree (Join-Path $pluginRoot "agents") (Join-Path $dotCursor "agents")
Remove-CodexSkillArtifacts (Join-Path $dotCursor "skills")

Write-Output "Synced controlflow-cursor -> .cursor/skills and .cursor/agents (Codex openai.yaml stripped)"
