@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0.."

if "%PORT%"=="" set "PORT=5173"
if "%HOST_PASSWORD%"=="" set "HOST_PASSWORD=123456"
set "MIN_NODE_MAJOR=20"

echo.
echo [BangBangCai] Start booth game
echo ------------------------------

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Running installer...
  call scripts\install-env.cmd
  if errorlevel 1 goto :install_failed
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Running installer...
  call scripts\install-env.cmd
  if errorlevel 1 goto :install_failed
)

for /f %%M in ('node -p "parseInt(process.versions.node,10)"') do set "NODE_MAJOR=%%M"
if "!NODE_MAJOR!"=="" goto :repair_env
if !NODE_MAJOR! LSS !MIN_NODE_MAJOR! goto :repair_env
goto :env_ok

:repair_env
echo Node.js environment needs repair. Running installer...
call scripts\install-env.cmd
if errorlevel 1 goto :install_failed

:env_ok
if not exist "node_modules" (
  echo node_modules not found. Installing dependencies...
  if exist package-lock.json (
    call npm.cmd ci
    if errorlevel 1 call npm.cmd install
  ) else (
    call npm.cmd install
  )
  if errorlevel 1 goto :deps_failed
)

echo Building latest version...
call npm.cmd run build
if errorlevel 1 goto :build_failed

echo.
echo Launching server on port %PORT%...
start "BangBangCai Server" cmd /k "cd /d ""%CD%"" && set ""PORT=%PORT%"" && set ""HOST_PASSWORD=%HOST_PASSWORD%"" && node server.mjs --booth"

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/player"
start "" "http://127.0.0.1:%PORT%/login"

echo.
echo Player: http://127.0.0.1:%PORT%/player
echo Host:   http://127.0.0.1:%PORT%/host
echo Setup:  http://127.0.0.1:%PORT%/settings
echo QR:     http://127.0.0.1:%PORT%/qr
echo Host password: %HOST_PASSWORD%
echo.
echo A server window has been opened. Close that window to stop the game.
echo.
pause
exit /b 0

:install_failed
echo Environment installation/repair failed.
echo Please run scripts\install-env.cmd manually.
echo.
pause
exit /b 1

:deps_failed
echo Dependency installation failed.
echo.
pause
exit /b 1

:build_failed
echo Build failed. Server not started.
echo.
pause
exit /b 1