$ErrorActionPreference = 'Stop'
$SyncDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StopScript = Join-Path $SyncDir 'stop-sync.ps1'

& $StopScript
Unregister-ScheduledTask -TaskName 'ScholarShield Auto-Sync' -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Unregistered Windows Task Scheduler task 'ScholarShield Auto-Sync'."
