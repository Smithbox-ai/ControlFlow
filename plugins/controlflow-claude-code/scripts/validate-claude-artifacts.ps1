param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [string]$PlanPath = "",
    [string]$PluginRoot = "",
    [switch]$RequirePlanAudit,
    [switch]$RequireAssumptionVerifier,
    [switch]$RequireExecutabilityVerifier,
    [switch]$SkipInventory
)

$ErrorActionPreference = "Stop"

$repoRootResolved = (Resolve-Path $RepoRoot).Path

if (-not $PluginRoot) {
    $pluginRootResolved = Join-Path $repoRootResolved "plugins\controlflow-claude-code"
} elseif ([System.IO.Path]::IsPathRooted($PluginRoot)) {
    $pluginRootResolved = $PluginRoot
} else {
    $pluginRootResolved = Join-Path $repoRootResolved $PluginRoot
}

$errors = @()
$passed = @()

# ====================================================================
# SECTION 1: Plugin Root Layout Validation
# Scope: Claude Code plugin only. Does not validate core VS Code agents,
# schemas, governance, or plans/ artifacts unless explicitly passed via
# -PlanPath or -PluginRoot pointing to a Claude plugin fixture path.
# ====================================================================

$manifestPath = Join-Path $pluginRootResolved ".claude-plugin\plugin.json"
if (-not (Test-Path $manifestPath)) {
    $errors += "Missing manifest: .claude-plugin/plugin.json not found under plugin root ($pluginRootResolved)"
} else {
    try {
        Get-Content $manifestPath -Raw | ConvertFrom-Json | Out-Null
        $passed += "Manifest present and valid JSON: .claude-plugin/plugin.json"
    } catch {
        $errors += "Manifest JSON parse error in .claude-plugin/plugin.json: $($_.Exception.Message)"
    }
}

# Functional directories must be at plugin root, NOT inside .claude-plugin/
$forbiddenInsideMeta = @("skills", "agents", "templates", "scripts", "tests")
foreach ($dir in $forbiddenInsideMeta) {
    $badPath = Join-Path $pluginRootResolved ".claude-plugin\$dir"
    if (Test-Path $badPath) {
        $errors += "Misplaced directory: '$dir' must be at plugin root, not inside .claude-plugin/"
    }
}

# Required functional directories at plugin root
$requiredRootDirs = @("skills", "agents")
foreach ($dir in $requiredRootDirs) {
    $dirPath = Join-Path $pluginRootResolved $dir
    if (-not (Test-Path $dirPath)) {
        $errors += "Missing required directory at plugin root: $dir/"
    } else {
        $passed += "Required directory present at plugin root: $dir/"
    }
}

# ====================================================================
# SECTION 2: Skill Inventory and Frontmatter Validation
# ====================================================================

if (-not $SkipInventory) {
    $requiredSkills = @(
        "controlflow-router",
        "controlflow-spec",
        "controlflow-strict-workflow",
        "controlflow-planning",
        "controlflow-plan-audit",
        "controlflow-assumption-verifier",
        "controlflow-executability-verifier",
        "controlflow-orchestration",
        "controlflow-review",
        "controlflow-memory-hygiene"
    )

    $skillNames = @()
    foreach ($skill in $requiredSkills) {
        $skillPath = Join-Path $pluginRootResolved "skills\$skill\SKILL.md"
        if (-not (Test-Path $skillPath)) {
            $errors += "Missing skill file: skills/$skill/SKILL.md"
        } else {
            $content = Get-Content $skillPath -Raw
            if ($content -notmatch "(?m)^description:") {
                $errors += "Skill missing 'description:' frontmatter: skills/$skill/SKILL.md"
            } else {
                $passed += "Skill valid (description present): skills/$skill/SKILL.md"
            }
            if ($content -match "(?m)^name:\s*(.+)$") {
                $skillNames += $Matches[1].Trim()
            }
        }
    }

    # ====================================================================
    # SECTION 3: Agent Inventory and Frontmatter Validation
    # Validates required fields (name, description).
    # Rejects unsupported plugin-agent fields: hooks, mcpServers, permissionMode.
    # ====================================================================

    $requiredAgents = @(
        "controlflow-assumption-verifier.md",
        "controlflow-code-mapper.md",
        "controlflow-code-reviewer.md",
        "controlflow-executability-verifier.md",
        "controlflow-plan-auditor.md",
        "controlflow-researcher.md"
    )

    $forbiddenAgentFields = @("hooks", "mcpServers", "permissionMode")
    $agentNames = @()

    foreach ($agent in $requiredAgents) {
        $agentPath = Join-Path $pluginRootResolved "agents\$agent"
        if (-not (Test-Path $agentPath)) {
            $errors += "Missing agent file: agents/$agent"
        } else {
            $content = Get-Content $agentPath -Raw
            $agentOk = $true
            if ($content -notmatch "(?m)^name:") {
                $errors += "Agent missing 'name:' frontmatter: agents/$agent"
                $agentOk = $false
            }
            if ($content -notmatch "(?m)^description:") {
                $errors += "Agent missing 'description:' frontmatter: agents/$agent"
                $agentOk = $false
            }
            foreach ($field in $forbiddenAgentFields) {
                if ($content -match "(?m)^${field}:") {
                    $errors += "Agent contains unsupported plugin field '$field': agents/$agent"
                    $agentOk = $false
                }
            }
            if ($agentOk) {
                if ($content -match "(?m)^name:\s*(.+)$") {
                    $agentNames += $Matches[1].Trim()
                }
                $passed += "Agent valid (name, description, no forbidden fields): agents/$agent"
            }
        }
    }

    # ====================================================================
    # SECTION 4: Agent/Skill Name Collision Check
    # ====================================================================

    $collisions = @($agentNames | Where-Object { $skillNames -contains $_ })
    if ($collisions.Count -gt 0) {
        foreach ($name in $collisions) {
            $errors += "Agent/skill name collision: '$name' appears in both agent and skill frontmatter"
        }
    } else {
        $passed += "No agent/skill name collisions detected"
    }
}

# ====================================================================
# SECTION 5: Plan Lifecycle Validation
# Only runs when -PlanPath is provided. Validates the specified plan file.
# Does not reach into plans/ for core VS Code Planner artifacts unless
# the caller explicitly provides a Claude plugin fixture path.
# ====================================================================

if ($PlanPath) {
    $planResolved = if ([System.IO.Path]::IsPathRooted($PlanPath)) {
        $PlanPath
    } else {
        Join-Path $repoRootResolved $PlanPath
    }

    if (-not (Test-Path $planResolved)) {
        $errors += "Plan file not found: $planResolved"
    } else {
        $planContent = Get-Content $planResolved -Raw

        # Required base plan sections (ControlFlow strict plan contract)
        $planSections = @(
            "# Plan:",
            "**Status:**",
            "**Agent:**",
            "**Schema Version:**",
            "**Complexity Tier:**",
            "**Confidence:**",
            "## Context & Analysis",
            "## Design Decisions",
            "## Implementation Phases",
            "## Inter-Phase Contracts",
            "## Open Questions",
            "## Risks",
            "## Semantic Risk Review",
            "## Success Criteria",
            "## Handoff",
            "## Notes for Orchestration"
        )

        foreach ($section in $planSections) {
            if ($planContent -notmatch [regex]::Escape($section)) {
                $errors += "Plan missing required base section: '$section'"
            }
        }

        # Fixed ControlFlow lifecycle headings for strict plans.
        # This list must match the plan template, valid fixture, and test harness exactly.
        $lifecycleSections = @(
            "## Progress",
            "## Discoveries",
            "## Decision Log",
            "## Outcomes",
            "## Idempotence & Recovery"
        )

        $missingLifecycle = @()
        foreach ($section in $lifecycleSections) {
            if ($planContent -notmatch [regex]::Escape($section)) {
                $missingLifecycle += $section
            }
        }

        if ($missingLifecycle.Count -gt 0) {
            foreach ($missing in $missingLifecycle) {
                $errors += "Plan missing required lifecycle section: '$missing'"
            }
        } else {
            $passed += "Plan contains all 5 required lifecycle sections"
        }

        # Derive task slug and artifact root from plan filename.
        # Review artifacts are expected in a subdirectory named <slug>
        # alongside the plan file (same parent directory).
        $planLeaf = Split-Path $planResolved -Leaf
        if ($planLeaf -notmatch '^(?<slug>.+)-plan\.md$') {
            $errors += "Plan filename must end with '-plan.md': $planLeaf"
        } else {
            $taskSlug = $Matches['slug']
            $planParentDir = Split-Path $planResolved -Parent
            $artifactRoot = Join-Path $planParentDir $taskSlug

            $artifactChecks = @()
            if ($RequirePlanAudit) {
                $artifactChecks += [pscustomobject]@{
                    Path     = Join-Path $artifactRoot "plan-audit.md"
                    Sections = @("# Plan Audit Report", "**Status:**", "## Findings", "## Risk Summary", "## Recommendation", "## Evidence")
                    Label    = "plan-audit.md"
                }
            }
            if ($RequireAssumptionVerifier) {
                $artifactChecks += [pscustomobject]@{
                    Path     = Join-Path $artifactRoot "assumption-verifier.md"
                    Sections = @("# Assumption Verifier Report", "**Status:**", "## Mirages Found", "## Dimensional Scores", "## Summary", "## Evidence")
                    Label    = "assumption-verifier.md"
                }
            }
            if ($RequireExecutabilityVerifier) {
                $artifactChecks += [pscustomobject]@{
                    Path     = Join-Path $artifactRoot "executability-verifier.md"
                    Sections = @("# Executability Verifier Report", "**Status:**", "## Tasks Simulated", "## Per-Task Checklist", "## Walkthrough Summary", "## Recommendation")
                    Label    = "executability-verifier.md"
                }
            }

            foreach ($artifact in $artifactChecks) {
                if (-not (Test-Path $artifact.Path)) {
                    $errors += "Missing review artifact: $($artifact.Label) (expected at $($artifact.Path))"
                } else {
                    $artifactContent = Get-Content $artifact.Path -Raw
                    $artOk = $true
                    foreach ($section in $artifact.Sections) {
                        if ($artifactContent -notmatch [regex]::Escape($section)) {
                            $errors += "Review artifact '$($artifact.Label)' missing required section: '$section'"
                            $artOk = $false
                        }
                    }
                    if ($artOk) {
                        $passed += "Review artifact valid: $($artifact.Label)"
                    }
                }
            }
        }
    }
}

# ====================================================================
# FINAL OUTPUT
# ====================================================================

foreach ($p in $passed) {
    Write-Output "PASS: $p"
}

if ($errors.Count -gt 0) {
    Write-Output ""
    foreach ($e in $errors) {
        Write-Output "FAIL: $e"
    }
    Write-Output ""
    Write-Output "validate-claude-artifacts.ps1: $($errors.Count) validation error(s) found"
    exit 1
}

Write-Output ""
Write-Output "VALID: All Claude plugin artifact checks passed ($($passed.Count) checks)"
exit 0
