param(
  [switch]$DisableScheduledTask
)

$ErrorActionPreference = 'Stop'
$SyncDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptPath = Join-Path $SyncDir 'watch-sync.mjs'
$PidFile = Join-Path $SyncDir 'sync.pid'
$LockFile = Join-Path $SyncDir 'sync.lock'

$procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*watch-sync.mjs*' -and $_.CommandLine -notlike '*--once*' }

$stopped = 0
foreach ($p in $procs) {
  try {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
    Write-Host "Stopped ScholarShield Auto-Sync watcher (PID $($p.ProcessId))."
    $stopped++
  } catch {
    Write-Warning "Could not stop PID $($p.ProcessId): $_"
  }
}

if ($stopped -eq 0) {
  Write-Host "ScholarShield Auto-Sync watcher is not currently running."
}

Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
Remove-Item -Path $LockFile -Force -ErrorAction SilentlyContinue

if ($DisableScheduledTask) {
  schtasks /Change /TN "ScholarShield Auto-Sync" /DISABLE 2>&1 | Out-Host
}

