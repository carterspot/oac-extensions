# build-plugin.ps1 — package a single plugin into dist/<id>-<timestamp>.zip
# Usage:   .\tools\build-plugin.ps1 <plugin-id>
# Example: .\tools\build-plugin.ps1 com-company-vertWaterfall
#
# Output ZIP layout (forward-slash entries — required by OAC):
#   resourcefolder.lst.json
#   customviz/<plugin-id>/...

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$PluginId
)

$ErrorActionPreference = 'Stop'

$repoRoot   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$pluginSrc  = Join-Path $repoRoot "src\customviz\$PluginId"
$resList    = Join-Path $repoRoot 'resourcefolder.lst.json'
$distDir    = Join-Path $repoRoot 'dist'
$stageDir   = Join-Path $distDir "_stage_$PluginId"

if (-not (Test-Path $pluginSrc)) {
    Write-Error "Plugin not found: $pluginSrc"
}
if (-not (Test-Path $resList)) {
    Write-Error "Missing resourcefolder.lst.json at repo root: $resList"
}

if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir -Force | Out-Null }
if (Test-Path $stageDir) { Remove-Item -Recurse -Force $stageDir }
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

# Stage layout
Copy-Item $resList $stageDir -Force
$stagePlugin = Join-Path $stageDir "customviz\$PluginId"
New-Item -ItemType Directory -Path $stagePlugin -Force | Out-Null
Copy-Item -Path "$pluginSrc\*" -Destination $stagePlugin -Recurse -Force -Exclude '*.backup*'

# ZIP with forward-slash entries
$timestamp = Get-Date -Format 'yyyyMMdd-HHmm'
$zipPath   = Join-Path $distDir "$PluginId-$timestamp.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    Get-ChildItem -Path $stageDir -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($stageDir.Length + 1).Replace('\', '/')
        $entry = $archive.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
        $stream = $entry.Open()
        try {
            $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
            $stream.Write($bytes, 0, $bytes.Length)
        } finally { $stream.Dispose() }
    }
} finally { $archive.Dispose() }

# Clean up stage
Remove-Item -Recurse -Force $stageDir

Write-Host "Built: $zipPath ($((Get-Item $zipPath).Length) bytes)"
Write-Host ""
Write-Host "Entries:"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $zip.Entries | ForEach-Object { "  {0,8}  {1}" -f $_.Length, $_.FullName }
} finally { $zip.Dispose() }
