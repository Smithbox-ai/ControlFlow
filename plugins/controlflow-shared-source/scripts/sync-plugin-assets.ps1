param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [Alias("Host")]
    [ValidateSet("all", "codex", "claude_code", "cursor")]
    [string]$TargetHost = "all",

    [switch]$Write
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

function Resolve-Directory([string]$Path, [string]$Label) {
    if (-not (Test-Path $Path -PathType Container)) {
        throw "Missing required directory for ${Label}: $Path"
    }
    return (Resolve-Path $Path).Path
}

function Get-NormalizedRelativePath([string]$RelativePath, [string]$Label) {
    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        throw "Empty relative path for ${Label}"
    }
    if ([System.IO.Path]::IsPathRooted($RelativePath)) {
        throw "Absolute paths are not allowed for ${Label}: $RelativePath"
    }

    $segments = $RelativePath -split '[\\/]'
    foreach ($segment in $segments) {
        if ($segment -eq "..") {
            throw "Parent path traversal is not allowed for ${Label}: $RelativePath"
        }
    }

    return ($RelativePath -replace '/', [System.IO.Path]::DirectorySeparatorChar)
}

function Join-SafeRelativePath([string]$Root, [string]$RelativePath, [string]$Label) {
    $rootFull = [System.IO.Path]::GetFullPath($Root)
    $normalized = Get-NormalizedRelativePath $RelativePath $Label
    $combined = [System.IO.Path]::GetFullPath((Join-Path $rootFull $normalized))
    $rootPrefix = $rootFull.TrimEnd([char[]]@([char]92, [char]47)) + [System.IO.Path]::DirectorySeparatorChar

    if (($combined -ne $rootFull) -and (-not $combined.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase))) {
        throw "Resolved path escaped ${Label} root: $RelativePath"
    }

    return $combined
}

function Get-RelativePath([string]$BasePath, [string]$Path) {
    $baseFull = [System.IO.Path]::GetFullPath($BasePath).TrimEnd([char[]]@([char]92, [char]47)) + [System.IO.Path]::DirectorySeparatorChar
    $pathFull = [System.IO.Path]::GetFullPath($Path)
    $baseUri = New-Object System.Uri($baseFull)
    $pathUri = New-Object System.Uri($pathFull)
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($pathUri).ToString()).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Get-DisplayPath([string]$RepoRootPath, [string]$Path) {
    return (Get-RelativePath $RepoRootPath $Path).Replace([char]92, [char]47)
}

function Get-HostNames([string]$RequestedHost) {
    if ($RequestedHost -eq "all") {
        return @("codex", "claude_code", "cursor")
    }
    return @($RequestedHost)
}

function Get-HostPluginRoot([string]$RepoRootPath, [string]$HostName) {
    switch ($HostName) {
        "codex" { return Join-Path $RepoRootPath "plugins\controlflow-codex" }
        "claude_code" { return Join-Path $RepoRootPath "plugins\controlflow-claude-code" }
        "cursor" { return Join-Path $RepoRootPath "plugins\controlflow-cursor" }
        default { throw "Unsupported host: $HostName" }
    }
}

function Get-HostOverrideRoot([string]$SharedRootPath, [string]$HostName) {
    switch ($HostName) {
        "codex" { return Join-Path $SharedRootPath "host-overrides\codex" }
        "claude_code" { return Join-Path $SharedRootPath "host-overrides\claude-code" }
        "cursor" { return Join-Path $SharedRootPath "host-overrides\cursor" }
        default { throw "Unsupported host: $HostName" }
    }
}

function Add-ExpectedFilesFromPath([string]$InputPath, [string]$DestinationPath, [hashtable]$ExpectedFiles) {
    if (Test-Path $InputPath -PathType Leaf) {
        $ExpectedFiles[$DestinationPath] = $InputPath
        return
    }

    if (-not (Test-Path $InputPath -PathType Container)) {
        throw "Expected source or override path does not exist: $InputPath"
    }

    $files = Get-ChildItem -Path $InputPath -Recurse -File | Sort-Object FullName
    foreach ($file in $files) {
        $relative = Get-RelativePath $InputPath $file.FullName
        $dest = Join-SafeRelativePath $DestinationPath $relative "generated target"
        $ExpectedFiles[$dest] = $file.FullName
    }
}

function Get-ExpectedFilesForTarget([string]$SharedRootPath, [string]$PluginRootPath, [string]$OverrideRootPath, [object]$Target, [string]$HostName) {
    $hostProperty = $Target.host_outputs.PSObject.Properties[$HostName]
    if ($null -eq $hostProperty) {
        throw "Manifest target '$($Target.source_path)' is missing host output: $HostName"
    }

    $hostOutput = $hostProperty.Value
    if ($null -eq $hostOutput.dest_path) {
        throw "Manifest target '$($Target.source_path)' is missing dest_path for host: $HostName"
    }

    $sourcePath = Join-SafeRelativePath $SharedRootPath $Target.source_path "manifest source_path"
    if (-not (Test-Path $sourcePath)) {
        throw "Manifest source_path does not exist: $($Target.source_path)"
    }

    $destPath = Join-SafeRelativePath $PluginRootPath $hostOutput.dest_path "manifest dest_path"
    $expectedFiles = @{}
    Add-ExpectedFilesFromPath $sourcePath $destPath $expectedFiles

    $hasOverridePath = $hostOutput.PSObject.Properties.Name -contains "override_path"
    if ($hasOverridePath -and -not [string]::IsNullOrWhiteSpace($hostOutput.override_path)) {
        if ($hostOutput.allowed_deltas -ne $true) {
            throw "Manifest target '$($Target.source_path)' declares override_path while allowed_deltas is false for host: $HostName"
        }
        $overridePath = Join-SafeRelativePath $OverrideRootPath $hostOutput.override_path "manifest override_path"
        if (-not (Test-Path $overridePath)) {
            throw "Manifest override_path does not exist for host ${HostName}: $($hostOutput.override_path)"
        }
        Add-ExpectedFilesFromPath $overridePath $destPath $expectedFiles
    }

    return $expectedFiles
}

function Get-Sha256([string]$Path) {
    return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

function Get-Sha256FromBytes([byte[]]$Bytes) {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha256.ComputeHash($Bytes)
        return -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
    } finally {
        $sha256.Dispose()
    }
}

function Get-Utf8NoBomBytes([string]$Text) {
    $encoding = New-Object System.Text.UTF8Encoding($false)
    return $encoding.GetBytes($Text)
}

function Normalize-LineEndings([string]$Text, [string]$LineEnding) {
    $normalized = $Text -replace "`r`n|`r|`n", "`n"
    switch ($LineEnding) {
        "lf" { return $normalized }
        "crlf" { return ($normalized -replace "`n", "`r`n") }
        default { throw "Unsupported content override line_ending: $LineEnding" }
    }
}

function Get-ContentOverrideMap([string]$SharedRootPath, [string]$OverrideRootPath, [string]$HostName) {
    $overrideSpecPath = Join-Path $OverrideRootPath "generation-overrides.json"
    $map = @{}

    if (-not (Test-Path $overrideSpecPath -PathType Leaf)) {
        return $map
    }

    $spec = Get-Content $overrideSpecPath -Raw | ConvertFrom-Json
    if ($spec.version -ne "1.0.0") {
        throw "Unsupported generation override version for host ${HostName}: $($spec.version)"
    }
    if (-not ($spec.PSObject.Properties.Name -contains "files") -or $null -eq $spec.files) {
        throw "Generation override for host ${HostName} must declare files"
    }

    foreach ($fileOverride in @($spec.files)) {
        if ($null -eq $fileOverride.source_path) {
            throw "Generation override for host ${HostName} has a file without source_path"
        }

        $sourcePath = Join-SafeRelativePath $SharedRootPath $fileOverride.source_path "generation override source_path"
        if (-not (Test-Path $sourcePath -PathType Leaf)) {
            throw "Generation override source_path does not exist for host ${HostName}: $($fileOverride.source_path)"
        }

        if ($fileOverride.PSObject.Properties.Name -contains "line_ending") {
            if (($fileOverride.line_ending -ne "lf") -and ($fileOverride.line_ending -ne "crlf")) {
                throw "Unsupported generation override line_ending for host ${HostName}: $($fileOverride.line_ending)"
            }
        }

        if (-not ($fileOverride.PSObject.Properties.Name -contains "insertions") -or @($fileOverride.insertions).Count -eq 0) {
            throw "Generation override for host ${HostName} source '$($fileOverride.source_path)' must declare at least one insertion"
        }

        foreach ($insertion in @($fileOverride.insertions)) {
            if (($null -eq $insertion.after) -or ($null -eq $insertion.text)) {
                throw "Generation override for host ${HostName} source '$($fileOverride.source_path)' has an insertion without after/text"
            }
        }

        $sourceKey = (Get-NormalizedRelativePath $fileOverride.source_path "generation override source_path").Replace([char]92, [char]47)
        if ($map.ContainsKey($sourceKey)) {
            throw "Duplicate generation override for host ${HostName}: $sourceKey"
        }
        $map[$sourceKey] = $fileOverride
    }

    return $map
}

function Get-ContentOverrideBytes([string]$SourcePath, [object]$ContentOverride) {
    $text = [System.IO.File]::ReadAllText($SourcePath)

    foreach ($insertion in @($ContentOverride.insertions)) {
        $anchor = [string]$insertion.after
        if (-not $text.Contains($anchor)) {
            throw "Content override anchor not found in ${SourcePath}: $anchor"
        }

        $text = $text.Replace($anchor, ($anchor + "`n`n" + [string]$insertion.text))
    }

    if ($ContentOverride.PSObject.Properties.Name -contains "line_ending") {
        $text = Normalize-LineEndings $text $ContentOverride.line_ending
    }

    return Get-Utf8NoBomBytes $text
}

$repoRootResolved = Resolve-Directory $RepoRoot "repo root"
$sharedRoot = Resolve-Directory (Join-Path $repoRootResolved "plugins\controlflow-shared-source") "shared source root"
$manifestPath = Join-Path $sharedRoot "generation-manifest.json"

if (-not (Test-Path $manifestPath -PathType Leaf)) {
    throw "Missing generation manifest: $manifestPath"
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
if ($manifest.version -ne "1.0.0") {
    throw "Unsupported generation manifest version: $($manifest.version)"
}
if ($null -eq $manifest.targets -or $manifest.targets.Count -eq 0) {
    throw "Generation manifest must declare at least one target"
}

$operation = if ($Write) { "WRITE" } else { "VALIDATE" }
$errors = @()
$checkedCount = 0
$writtenCount = 0

foreach ($hostName in (Get-HostNames $TargetHost)) {
    $pluginRoot = Resolve-Directory (Get-HostPluginRoot $repoRootResolved $hostName) "${hostName} plugin root"
    $overrideRoot = Resolve-Directory (Get-HostOverrideRoot $sharedRoot $hostName) "${hostName} override root"
    $contentOverrideMap = Get-ContentOverrideMap $sharedRoot $overrideRoot $hostName
    $contentOverrideSpecPath = Join-Path $overrideRoot "generation-overrides.json"

    foreach ($target in $manifest.targets) {
        $expectedFiles = Get-ExpectedFilesForTarget $sharedRoot $pluginRoot $overrideRoot $target $hostName
        foreach ($destPath in ($expectedFiles.Keys | Sort-Object)) {
            $sourcePath = $expectedFiles[$destPath]
            $checkedCount++
            $sourceRelativePath = (Get-RelativePath $sharedRoot $sourcePath).Replace([char]92, [char]47)
            $contentOverride = $null
            $expectedBytes = $null
            $sourceDisplay = Get-DisplayPath $repoRootResolved $sourcePath

            if ($contentOverrideMap.ContainsKey($sourceRelativePath)) {
                $contentOverride = $contentOverrideMap[$sourceRelativePath]
                $expectedBytes = Get-ContentOverrideBytes $sourcePath $contentOverride
                $sourceDisplay = "$sourceDisplay + $(Get-DisplayPath $repoRootResolved $contentOverrideSpecPath)"
            }

            $expectedHash = if ($null -ne $expectedBytes) { Get-Sha256FromBytes $expectedBytes } else { Get-Sha256 $sourcePath }

            if ($Write) {
                $alreadyCurrent = $false
                if (Test-Path $destPath -PathType Leaf) {
                    $alreadyCurrent = ((Get-Sha256 $destPath) -eq $expectedHash)
                }

                $parent = Split-Path $destPath -Parent
                if (-not (Test-Path $parent -PathType Container)) {
                    New-Item -ItemType Directory -Force -Path $parent | Out-Null
                }

                if ($alreadyCurrent) {
                    Write-Output "SKIP: $hostName $(Get-DisplayPath $repoRootResolved $destPath) already current"
                } else {
                    if ($null -ne $expectedBytes) {
                        [System.IO.File]::WriteAllBytes($destPath, $expectedBytes)
                    } else {
                        [System.IO.File]::WriteAllBytes($destPath, [System.IO.File]::ReadAllBytes($sourcePath))
                    }
                    $writtenCount++
                    Write-Output "WRITE: $hostName $(Get-DisplayPath $repoRootResolved $destPath) <= $sourceDisplay"
                }
            }

            if (-not (Test-Path $destPath -PathType Leaf)) {
                $errors += "Missing generated output for ${hostName}: $(Get-DisplayPath $repoRootResolved $destPath)"
                continue
            }

            $actualHash = Get-Sha256 $destPath
            if ($expectedHash -ne $actualHash) {
                $errors += "Generated output drift for ${hostName}: $(Get-DisplayPath $repoRootResolved $destPath) expected $expectedHash from $sourceDisplay, actual $actualHash"
            }
        }
    }
}

if ($errors.Count -gt 0) {
    foreach ($errorMessage in $errors) {
        Write-Output "FAIL: $errorMessage"
    }
    Write-Output ""
    Write-Output "${operation}: generated asset check failed with $($errors.Count) error(s) after checking $checkedCount declared output file(s)."
    exit 1
}

if ($Write) {
    Write-Output "VALID: wrote and verified $writtenCount declared generated output file(s)."
} else {
    Write-Output "VALID: verified $checkedCount declared generated output file(s) without writing."
}
exit 0
