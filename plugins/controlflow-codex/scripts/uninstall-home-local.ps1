param(
    [string]$HomeRoot = $HOME,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$pluginName = "controlflow-codex"
$targetPlugin = Join-Path (Join-Path $HomeRoot "plugins") $pluginName
$marketplacePath = Join-Path (Join-Path $HomeRoot ".agents\plugins") "marketplace.json"

if ((Test-Path $targetPlugin) -and -not $Force) {
    $answer = Read-Host "Remove $targetPlugin? Type YES to continue"
    if ($answer -ne "YES") {
        Write-Output "Uninstall cancelled."
        exit 0
    }
}

if (Test-Path $targetPlugin) {
    Remove-Item -LiteralPath $targetPlugin -Recurse -Force
    Write-Output "Removed $targetPlugin"
} else {
    Write-Output "Plugin directory not found at $targetPlugin"
}

if (Test-Path $marketplacePath) {
    $marketplace = Get-Content $marketplacePath -Raw | ConvertFrom-Json
    $plugins = @($marketplace.plugins | Where-Object { $_.name -ne $pluginName })
    if ($null -eq $marketplace.PSObject.Properties["plugins"]) {
        $marketplace | Add-Member -NotePropertyName plugins -NotePropertyValue $plugins -Force
    } else {
        $marketplace.plugins = $plugins
    }
    $marketplace | ConvertTo-Json -Depth 8 | Set-Content $marketplacePath
    Write-Output "Removed $pluginName marketplace entry from $marketplacePath"
} else {
    Write-Output "Marketplace file not found at $marketplacePath"
}
