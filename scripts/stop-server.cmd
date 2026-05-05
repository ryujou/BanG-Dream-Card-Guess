@echo off
setlocal

if "%PORT%"=="" set "PORT=5173"

echo.
echo [BangBangCai] Stop local server
echo -------------------------------
echo Port: %PORT%

powershell -NoProfile -ExecutionPolicy Bypass -Command "$port = [int]$env:PORT; $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if (-not $owners) { Write-Host 'No server is listening on this port.'; exit 0 }; foreach ($owner in $owners) { Write-Host ('Stopping process ' + $owner); Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 500; if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { Write-Error 'Server is still listening.'; exit 1 } else { Write-Host 'Server stopped.' }"

echo.
pause
