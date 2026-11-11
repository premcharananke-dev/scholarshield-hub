@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-sync.ps1" %*

