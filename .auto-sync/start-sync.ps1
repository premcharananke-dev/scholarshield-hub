param(
  [switch]$Foreground,
  [switch]$Once,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$SyncDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptPath = Join-Path $SyncDir 'watch-sync.mjs'
$PidFile = Join-Path $SyncDir 'sync.pid'
$NodeExe = if (Test-Path 'C:\Program Files\nodejs\node.exe') { 'C:\Program Files\nodejs\node.exe' } else { (Get-Command node).Source }

function Get-RunningWatcherProcess {
  if (Test-Path $PidFile) {
    $raw = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $parsedPid = 0
    if ($raw -and [int]::TryParse($raw.Trim(), [ref]$parsedPid) -and $parsedPid -gt 0) {
      $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $parsedPid" -ErrorAction SilentlyContinue
      if ($proc -and $proc.CommandLine -like '*watch-sync.mjs*') {
        return $proc
      }
    }
  }
  return Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$ScriptPath*" -and $_.CommandLine -notlike '*--once*' } |
    Select-Object -First 1
}

if ($Once) {
  $nodeArgs = @($ScriptPath, '--once')
  if ($DryRun) { $nodeArgs += '--dry-run' }
  & $NodeExe @nodeArgs
  exit $LASTEXITCODE
}

$existing = Get-RunningWatcherProcess
if ($existing) {
  Write-Host "ScholarShield Auto-Sync watcher is already running (PID $($existing.ProcessId))."
  exit 0
}

if ($Foreground) {
  & $NodeExe $ScriptPath
  exit $LASTEXITCODE
}

$proc = Start-Process -FilePath $NodeExe `
  -ArgumentList "`"$ScriptPath`" --silent" `
  -WorkingDirectory (Split-Path -Parent $SyncDir) `
  -WindowStyle Hidden `
  -PassThru

Start-Sleep -Milliseconds 800
$live = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
if ($live) {
  Write-Host "Started ScholarShield Auto-Sync watcher in background (PID $($proc.Id))."
  Write-Host "Logs: $(Join-Path $SyncDir 'sync.log')"
  exit 0
} else {
  Write-Error "Failed to start ScholarShield Auto-Sync watcher. Check $(Join-Path $SyncDir 'sync.log')."
  exit 1
}
