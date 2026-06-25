param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [Alias("Host")]
    [ValidateSet("all", "cursor")]
    [string]$TargetHost = "all"
)

$ErrorActionPreference = "Stop"

$repoRootResolved = (Resolve-Path $RepoRoot).Path
$syncScript = Join-Path $repoRootResolved "plugins\controlflow-shared-source\scripts\sync-plugin-assets.ps1"

if (-not (Test-Path $syncScript -PathType Leaf)) {
    throw "Missing sync script: $syncScript"
}

& $syncScript -RepoRoot $repoRootResolved -Host $TargetHost
exit $LASTEXITCODE
