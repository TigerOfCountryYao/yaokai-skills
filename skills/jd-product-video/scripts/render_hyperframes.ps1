[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectDir,
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    [ValidateSet("draft", "standard", "high")]
    [string]$Quality = "high",
    [ValidateSet("24", "30", "60")]
    [string]$Fps = "30"
)

$ErrorActionPreference = "Stop"
$resolvedProject = (Resolve-Path -LiteralPath $ProjectDir).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutput) | Out-Null

function Invoke-HyperFrames([string[]]$Arguments) {
    & npx hyperframes @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "HyperFrames command failed: npx hyperframes $($Arguments -join ' ')"
    }
}

Invoke-HyperFrames @("doctor")
Push-Location -LiteralPath $resolvedProject
try {
    Invoke-HyperFrames @("lint", ".")
    Invoke-HyperFrames @("validate", ".")
    Invoke-HyperFrames @("inspect", ".", "--samples", "15", "--strict")
    Invoke-HyperFrames @("render", "--output", $resolvedOutput, "--quality", $Quality, "--fps", $Fps, "--strict-all")
}
finally {
    Pop-Location
}

Write-Output $resolvedOutput

