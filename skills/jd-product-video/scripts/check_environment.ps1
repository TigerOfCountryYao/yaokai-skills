[CmdletBinding()]
param(
    [ValidateSet("None", "EdgeTTS", "MiniMax")]
    [string]$TtsMode = "None",
    [string[]]$RequiredSecretEnv = @()
)

$ErrorActionPreference = "Stop"
$failures = [System.Collections.Generic.List[string]]::new()

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        $failures.Add("Missing command: $Name")
        return $false
    }
    return $true
}

if (Require-Command "node") {
    $nodeVersion = (& node --version).Trim()
    if ($nodeVersion -notmatch '^v(\d+)') {
        $failures.Add("Cannot parse Node.js version: $nodeVersion")
    }
    elseif ([int]$Matches[1] -lt 22) {
        $failures.Add("Node.js 22 or newer is required; found: $nodeVersion")
    }
    else {
        Write-Output "Node.js: $nodeVersion"
    }
}

if (Require-Command "ffmpeg") {
    $ffmpegVersion = (& ffmpeg -version | Select-Object -First 1).Trim()
    Write-Output "FFmpeg: $ffmpegVersion"
}

if (Require-Command "npx") {
    & npx hyperframes doctor
    if ($LASTEXITCODE -ne 0) {
        $failures.Add("HyperFrames environment check failed")
    }
    else {
        Write-Output "HyperFrames: available"
    }
}

if ($TtsMode -eq "EdgeTTS") {
    if (Require-Command "python") {
        & python -c "import edge_tts"
        if ($LASTEXITCODE -ne 0) {
            $failures.Add("Python package edge-tts is not installed")
        }
        else {
            Write-Output "Edge TTS: available"
        }
    }
}

foreach ($variableName in $RequiredSecretEnv) {
    if ([string]::IsNullOrWhiteSpace($variableName)) {
        $failures.Add("Required secret environment variable name cannot be empty")
        continue
    }
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($variableName))) {
        $failures.Add("Required secret environment variable is missing from this process: $variableName")
    }
    else {
        Write-Output "Secret environment variable is present: $variableName"
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output "Environment check passed."

