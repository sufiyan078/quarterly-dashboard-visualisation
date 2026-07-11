[CmdletBinding()]
param (
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet('snapshot', 'revert', 'list')]
    [string]$Action,

    [Parameter(Mandatory=$false, Position=1)]
    [string]$Version,

    [Parameter(Mandatory=$false, Position=2)]
    [string]$Description
)

# Enable colored output helpers
function Write-Header ($text) {
    Write-Host "`n=== $text ===" -ForegroundColor Cyan
}

function Write-Success ($text) {
    Write-Host "[SUCCESS] $text" -ForegroundColor Green
}

function Write-Info ($text) {
    Write-Host "[INFO] $text" -ForegroundColor Gray
}

function Write-WarningMsg ($text) {
    Write-Host "[WARNING] $text" -ForegroundColor Yellow
}

function Write-Err ($text) {
    Write-Host "[ERROR] $text" -ForegroundColor Red
}

# Resolve script path
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($null -eq $ScriptDir -or $ScriptDir -eq "") {
    $ScriptDir = Get-Location
}

$VersionsDir = Join-Path $ScriptDir "versions"

# Exclude lists for copying/deleting
$excludeDirs = @('node_modules', '.next', 'out', '.git', 'versions', '.vercel')
$excludeFiles = @('tsconfig.tsbuildinfo', 'next-env.d.ts')

function Copy-ProjectFiles ($src, $dest) {
    if (-not (Test-Path $dest)) {
        New-Item -ItemType Directory -Path $dest | Out-Null
    }
    
    Get-ChildItem -Path $src | Where-Object {
        if ($_.PSIsContainer) {
            $_.Name -notin $excludeDirs
        } else {
            $_.Name -notin $excludeFiles
        }
    } | ForEach-Object {
        $destPath = Join-Path $dest $_.Name
        Copy-Item -Path $_.FullName -Destination $destPath -Recurse -Force
    }
}

function Clean-ProjectRoot ($root) {
    Get-ChildItem -Path $root | Where-Object {
        if ($_.PSIsContainer) {
            $_.Name -notin $excludeDirs
        } else {
            $_.Name -notin $excludeFiles -and $_.Name -ne "manage-versions.ps1"
        }
    } | ForEach-Object {
        Remove-Item -Path $_.FullName -Recurse -Force
    }
}

switch ($Action) {
    'snapshot' {
        if ([string]::IsNullOrEmpty($Version)) {
            Write-Err "Version is required for snapshot. Example: v0.1"
            exit 1
        }
        
        # Normalize version name: ensure it starts with 'v' and is lowercase/standard
        if (-not $Version.StartsWith("v")) {
            $Version = "v$Version"
        }
        
        if ([string]::IsNullOrEmpty($Description)) {
            Write-Err "Description is required for snapshot."
            exit 1
        }
        
        $TargetDir = Join-Path $VersionsDir $Version
        
        if (Test-Path $TargetDir) {
            Write-WarningMsg "Version $Version already exists as a snapshot."
            $choice = Read-Host "Do you want to overwrite it? (y/N)"
            if ($choice -ne "y" -and $choice -ne "Y") {
                Write-Info "Snapshot aborted."
                exit 0
            }
            Remove-Item -Path $TargetDir -Recurse -Force
        }
        
        Write-Header "Creating Snapshot for $Version"
        Write-Info "Copying source files to $TargetDir..."
        Copy-ProjectFiles $ScriptDir $TargetDir
        
        # Modify package.json version if it exists
        $pkgPath = Join-Path $ScriptDir "package.json"
        if (Test-Path $pkgPath) {
            Write-Info "Updating package.json version..."
            $pkgJson = Get-Content $pkgPath -Raw | ConvertFrom-Json
            # strip 'v' prefix for package.json semver
            $semver = $Version.Substring(1)
            # Add patch version if only major.minor
            if ($semver -match "^\d+\.\d+$") {
                $semver = "$semver.0"
            }
            $pkgJson.version = $semver
            $jsonString = $pkgJson | ConvertTo-Json -Depth 100
            [System.IO.File]::WriteAllText($pkgPath, $jsonString)
            
            # Copy package.json to backup as well so they match
            Copy-Item -Path $pkgPath -Destination (Join-Path $TargetDir "package.json") -Force
        }
        
        # Git Commit and Tagging
        Write-Info "Updating Git..."
        git add -A
        git commit -m "Release ${Version}: $Description"
        
        # Check if tag already exists and delete if overwriting
        $tagExists = git tag -l $Version
        if ($tagExists) {
            git tag -d $Version | Out-Null
        }
        git tag -a $Version -m "Release ${Version}: $Description"
        
        Write-Success "Version $Version snapshot successfully created at $TargetDir"
        Write-Success "Git tag '$Version' added."
    }
    
    'revert' {
        if ([string]::IsNullOrEmpty($Version)) {
            Write-Err "Version is required for revert. Example: v0.1"
            exit 1
        }
        
        if (-not $Version.StartsWith("v")) {
            $Version = "v$Version"
        }
        
        $TargetDir = Join-Path $VersionsDir $Version
        
        if (-not (Test-Path $TargetDir)) {
            Write-Err "Version snapshot directory $TargetDir does not exist."
            exit 1
        }
        
        Write-Header "Reverting Codebase to $Version"
        Write-WarningMsg "This will replace all workspace files with files from $Version snapshot."
        Write-WarningMsg "Your node_modules, .next, and git history will be kept intact."
        $choice = Read-Host "Are you absolutely sure you want to proceed? (y/N)"
        if ($choice -ne "y" -and $choice -ne "Y") {
            Write-Info "Revert aborted."
            exit 0
        }
        
        # Create a temporary backup of current state just in case
        $tempBackupName = "revert-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        $tempBackupDir = Join-Path $VersionsDir $tempBackupName
        Write-Info "Creating temporary backup of current files at $tempBackupDir..."
        Copy-ProjectFiles $ScriptDir $tempBackupDir
        
        Write-Info "Cleaning current workspace files..."
        Clean-ProjectRoot $ScriptDir
        
        Write-Info "Restoring files from snapshot $Version..."
        # Copy from snapshot back to root
        Get-ChildItem -Path $TargetDir | ForEach-Object {
            $destPath = Join-Path $ScriptDir $_.Name
            Copy-Item -Path $_.FullName -Destination $destPath -Recurse -Force
        }
        
        Write-Info "Updating Git commit..."
        git add -A
        git commit -m "Reverted workspace to $Version"
        
        Write-Success "Codebase reverted to $Version successfully."
        Write-Success "A safety backup of the pre-revert state was saved to $tempBackupDir."
    }
    
    'list' {
        Write-Header "Available Version Snapshots"
        if (-not (Test-Path $VersionsDir)) {
            Write-Info "No versions folder found. No snapshots created yet."
        } else {
            $snapshots = Get-ChildItem -Path $VersionsDir | Where-Object { $_.PSIsContainer -and $_.Name -like "v*" }
            if ($snapshots.Count -eq 0 -or $null -eq $snapshots) {
                Write-Info "No snapshots found."
            } else {
                foreach ($s in $snapshots) {
                    $created = $s.CreationTime.ToString("yyyy-MM-dd HH:mm:ss")
                    # Try to extract description from Git tag if possible
                    $desc = ""
                    try {
                        $desc = git tag -n1 -l $s.Name
                        if ($desc) {
                            $desc = $desc.Trim()
                        }
                    } catch {}
                    Write-Host " - $($s.Name) (Created: $created) -> $desc" -ForegroundColor Green
                }
            }
        }
        
        # Display CHANGELOG summary if available
        $changelogPath = Join-Path $ScriptDir "CHANGELOG.md"
        if (Test-Path $changelogPath) {
            Write-Header "Changelog Summary (Recent Entries)"
            Get-Content $changelogPath -Head 25 | ForEach-Object { Write-Host $_ }
        }
    }
}
