@echo off
setlocal

cd /d "%~dp0.."

if "%PORT%"=="" set "PORT=5173"

echo.
echo [BangBangCai] Start booth game
echo ------------------------------

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Run scripts\install-env.cmd first.
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Run scripts\install-env.cmd first.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo node_modules was not found. Installing dependencies first...
  call npm.cmd install
  if errorlevel 1 (
    echo npm install failed.
    echo.
    pause
    exit /b 1
  )
)

echo Building web files...
call npm.cmd run build
if errorlevel 1 (
  echo Build failed.
  echo.
  pause
  exit /b 1
)

echo.
echo Launching server on port %PORT%...
start "BangBangCai Server" cmd /k "cd /d ""%CD%"" && set PORT=%PORT% && node server.mjs --booth"

timeout /t 2 /nobreak >nul

start "" "http://127.0.0.1:%PORT%/player"
start "" "http://127.0.0.1:%PORT%/login"

echo.
echo Player: http://127.0.0.1:%PORT%/player
echo Host:   http://127.0.0.1:%PORT%/host
echo Setup:  http://127.0.0.1:%PORT%/settings
echo.
echo A server window has been opened. Close that window to stop the game.
echo.
pause
