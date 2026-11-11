$ErrorActionPreference = 'Stop'
$SyncDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartScript = Join-Path $SyncDir 'start-sync.ps1'
$TaskName = 'ScholarShield Auto-Sync'
$CurrentUser = "$env:USERDOMAIN\$env:USERNAME"

$Action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$StartScript`""
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUser
$Principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Days 0) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Principal $Principal `
  -Settings $Settings `
  -Description 'Watches D:\prem and safely syncs ScholarShield changes to GitHub main after 60s of quiet time.' `
  -Force | Out-Null

Write-Host "Registered Windows Task Scheduler task '$TaskName' for $CurrentUser (starts automatically on logon)."
