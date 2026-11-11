$SyncDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path $SyncDir 'sync.pid'
$StatusFile = Join-Path $SyncDir 'sync-status.json'
$LogFile = Join-Path $SyncDir 'sync.log'

$procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*watch-sync.mjs*' -and $_.CommandLine -notlike '*--once*' }

Write-Host "=== ScholarShield Auto-Sync Status ==="
if ($procs) {
  foreach ($p in $procs) {
    Write-Host "Watcher Process : RUNNING (PID $($p.ProcessId))"
  }
} else {
  Write-Host "Watcher Process : STOPPED"
}

Write-Host ""
Write-Host "=== Windows Task Scheduler ==="
$taskOut = schtasks /Query /TN "ScholarShield Auto-Sync" /FO LIST /V 2>&1
if ($LASTEXITCODE -eq 0) {
  $taskOut | Where-Object { $_ -match '^(TaskName|Status|Scheduled Task State|Last Run Time|Last Result|Next Run Time):' } | ForEach-Object { Write-Host $_ }
} else {
  Write-Host "Scheduled Task  : NOT REGISTERED"
}

if (Test-Path $StatusFile) {
  Write-Host ""
  Write-Host "=== Last Recorded Sync State ==="
  Get-Content $StatusFile | Write-Host
}

if (Test-Path $LogFile) {
  Write-Host ""
  Write-Host "=== Recent Log (last 10 lines) ==="
  Get-Content $LogFile -Tail 10 | Write-Host
}

