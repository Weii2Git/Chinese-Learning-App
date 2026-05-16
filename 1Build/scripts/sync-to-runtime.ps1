# Syncs source files from 1Build to 2RuntimeProject
# Run from the 1Build folder or parent folder

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildDir = Split-Path -Parent $scriptDir
$runtimeDir = Join-Path (Split-Path -Parent $buildDir) "2RuntimeProject"

Write-Host "Syncing from: $buildDir"
Write-Host "Syncing to:   $runtimeDir"
Write-Host ""

# Folders to sync
$foldersToSync = @("src", "public", "data", "scripts")

foreach ($folder in $foldersToSync) {
    $source = Join-Path $buildDir $folder
    $dest = Join-Path $runtimeDir $folder
    
    if (Test-Path $source) {
        # Remove old destination folder and copy fresh
        if (Test-Path $dest) {
            Remove-Item -Recurse -Force $dest
        }
        Copy-Item -Recurse $source $dest
        Write-Host "[OK] Synced $folder"
    } else {
        Write-Host "[SKIP] $folder not found in 1Build"
    }
}

# Root-level files to sync
$filesToSync = @("Characters list.txt")

foreach ($file in $filesToSync) {
    $source = Join-Path $buildDir $file
    $dest = Join-Path $runtimeDir $file
    if (Test-Path $source) {
        Copy-Item -Force $source $dest
        Write-Host "[OK] Synced $file"
    } else {
        Write-Host "[SKIP] $file not found in 1Build"
    }
}

Write-Host ""
Write-Host "Sync complete. Run 'npm run dev' in 2RuntimeProject to test."
