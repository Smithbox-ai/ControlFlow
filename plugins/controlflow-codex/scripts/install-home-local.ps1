param(
    [string]$HomeRoot = $HOME,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$pluginName = "controlflow-codex"
$sourceRoot = Split-Path -Parent $PSScriptRoot
$sourcePlugin = $sourceRoot
$targetPluginsDir = Join-Path $HomeRoot "plugins"
$targetPlugin = Join-Path $targetPluginsDir $pluginName
$marketplaceDir = Join-Path $HomeRoot ".agents\plugins"
$marketplacePath = Join-Path $marketplaceDir "marketplace.json"

New-Item -ItemType Directory -Path $targetPluginsDir -Force | Out-Null
New-Item -ItemType Directory -Path $marketplaceDir -Force | Out-Null

if ((Test-Path $targetPlugin) -and -not $Force) {
    throw "Target plugin already exists at $targetPlugin. Re-run with -Force to replace it."
}

if (Test-Path $targetPlugin) {
    Remove-Item -LiteralPath $targetPlugin -Recurse -Force
}

Copy-Item -LiteralPath $sourcePlugin -Destination $targetPlugin -Recurse -Force

if (Test-Path $marketplacePath) {
    $marketplace = Get-Content $marketplacePath -Raw | ConvertFrom-Json
} else {
    $marketplace = [pscustomobject]@{
        name = "local-personal"
        interface = [pscustomobject]@{
            displayName = "Local Personal Plugins"
        }
        plugins = @()
    }
}

if (-not $marketplace.plugins) {
    $marketplace | Add-Member -NotePropertyName plugins -NotePropertyValue @() -Force
}

$existing = @($marketplace.plugins | Where-Object { $_.name -eq $pluginName })
$updatedPlugins = @($marketplace.plugins | Where-Object { $_.name -ne $pluginName })
$updatedPlugins += [pscustomobject]@{
    name = $pluginName
    source = [pscustomobject]@{
        source = "local"
        path = "./plugins/$pluginName"
    }
    policy = [pscustomobject]@{
        installation = "AVAILABLE"
        authentication = "ON_INSTALL"
    }
    category = "Coding"
}

$marketplace.plugins = $updatedPlugins
$marketplace | ConvertTo-Json -Depth 8 | Set-Content $marketplacePath

Write-Output "Installed $pluginName to $targetPlugin"
Write-Output "Updated marketplace at $marketplacePath"
if ($existing.Count -gt 0) {
    Write-Output "Existing marketplace entry was replaced."
}
