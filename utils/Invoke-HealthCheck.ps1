<# 
.SYNOPSIS
  Simple healthcheck pinger for /api/health with JSONL logging (Windows Task Scheduler friendly).

.DESCRIPTION
  Calls a URL (default: $env:HEALTH_URL or the repo's historical Render URL), records:
  timestamp, url, ok, status, durationMs, error, message, computer, user, PowerShell version.
  Appends one JSON object per line into logs/healthcheck/healthcheck-YYYY-MM-DD.jsonl.

.PARAMETER Url
  Target URL. If omitted, uses $env:HEALTH_URL; if that is empty, uses a default URL.

.PARAMETER TimeoutSec
  Request timeout in seconds. Default: 15.

.PARAMETER LogDir
  Directory to write logs into. Default: <repo>/logs/healthcheck

.PARAMETER FailOnError
  If set, exits with code 2 when the request is not 2xx or throws.

.PARAMETER Quiet
  If set, does not write JSON output to stdout (still logs to file).
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$Url,

  [Parameter(Mandatory = $false)]
  [int]$TimeoutSec = 15,

  [Parameter(Mandatory = $false)]
  [string]$LogDir,

  [Parameter(Mandatory = $false)]
  [ValidateSet('auto', 'curl', 'iwr')]
  [string]$Client = 'auto',

  [Parameter(Mandatory = $false)]
  [switch]$FailOnError,

  [Parameter(Mandatory = $false)]
  [switch]$Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Url)) {
  $Url = [string]$env:HEALTH_URL
}
if ([string]::IsNullOrWhiteSpace($Url)) {
  # Keep consistent with healthcheck/ tray app default in this repo.
  $Url = 'https://scheduler-72fp.onrender.com/api/health'
}

if ([string]::IsNullOrWhiteSpace($LogDir)) {
  # <repo>/utils -> <repo>/logs/healthcheck
  # Avoid Resolve-Path here because the directory may not exist yet.
  $LogDir = Join-Path (Join-Path $PSScriptRoot '..') 'logs\\healthcheck'
}

try {
  # Ensure modern TLS when running on older Windows/.NET defaults.
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {
  # Ignore; best-effort.
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$logFile = Join-Path $LogDir ("healthcheck-{0}.jsonl" -f (Get-Date).ToString('yyyy-MM-dd'))

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$statusCode = $null
$ok = $false
$errType = $null
$errMsg = $null
$clientUsed = $null

try {
  $curlCmd = Get-Command curl.exe -ErrorAction SilentlyContinue
  $useCurl =
    ($Client -eq 'curl') -or
    ($Client -eq 'auto' -and $null -ne $curlCmd)

  if ($useCurl) {
    $clientUsed = 'curl'
    $args = @(
      '-sS',
      '-L',
      '-o', 'NUL',
      '--connect-timeout', [string]$TimeoutSec,
      '--max-time', [string]$TimeoutSec,
      '-w', 'HTTPSTATUS:%{http_code}',
      $Url
    )

    # curl prints -w output to stdout; any errors go to stderr (we capture both for logging).
    $out = & $curlCmd.Source @args 2>&1
    $exit = $LASTEXITCODE

    # Parse HTTPSTATUS:### from output
    $m = [regex]::Match([string]$out, 'HTTPSTATUS:(\d{3})')
    if ($m.Success) {
      $code = [int]$m.Groups[1].Value
      $statusCode = if ($code -eq 0) { $null } else { $code }
      $ok = ($statusCode -ge 200 -and $statusCode -lt 300)
    }

    if (-not $ok) {
      if ($exit -ne 0 -and -not $errType) {
        $errType = "CurlExit_$exit"
        $errMsg = ([string]$out).Trim()
      } elseif (-not $errType -and $statusCode) {
        $errType = 'HttpError'
        $errMsg = "HTTP $statusCode"
      } elseif (-not $errType) {
        $errType = 'CurlError'
        $errMsg = ([string]$out).Trim()
      }
    }
  } else {
    $clientUsed = 'iwr'
    $resp = Invoke-WebRequest -Uri $Url -Method 'GET' -TimeoutSec $TimeoutSec -MaximumRedirection 0 -UseBasicParsing -Headers @{
      'Accept' = '*/*'
      'Cache-Control' = 'no-cache'
    }
    $statusCode = [int]$resp.StatusCode
    $ok = ($statusCode -ge 200 -and $statusCode -lt 300)
  }
} catch [System.Net.WebException] {
  $we = $_.Exception
  $errType = 'WebException'
  $errMsg = $we.Message

  try {
    $r = $we.Response
    if ($r -and ($r -is [System.Net.HttpWebResponse])) {
      $statusCode = [int]$r.StatusCode
    }
  } catch {
    # ignore
  }
} catch {
  $errType = ($_.Exception.GetType().FullName)
  $errMsg = $_.Exception.Message
} finally {
  $sw.Stop()
}

$entry = [pscustomobject]@{
  ts         = (Get-Date).ToString('o')
  url        = $Url
  client     = $clientUsed
  ok         = [bool]$ok
  status     = $statusCode
  durationMs = [int]$sw.ElapsedMilliseconds
  error      = $errType
  message    = $errMsg
  computer   = $env:COMPUTERNAME
  user       = $env:USERNAME
  ps         = $PSVersionTable.PSVersion.ToString()
}

$line = $entry | ConvertTo-Json -Compress

# Append as UTF-8 without BOM (PowerShell 5.1 default encoding is UTF-16LE).
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::AppendAllText($logFile, $line + [Environment]::NewLine, $utf8NoBom)

if (-not $Quiet) {
  Write-Output $line
}

if ($FailOnError -and -not $ok) {
  exit 2
}

exit 0
