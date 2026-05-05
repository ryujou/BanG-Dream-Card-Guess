@echo off
setlocal

cd /d "%~dp0.."

echo.
echo [BangBangCai] Install environment
echo --------------------------------

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  where winget >nul 2>nul
  if errorlevel 1 (
    echo winget was not found. Please install Node.js LTS manually:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
  )

  echo Installing Node.js LTS with winget...
  winget install -e --id OpenJS.NodeJS.LTS
  if errorlevel 1 (
    echo Node.js installation failed.
    echo Please install Node.js LTS manually: https://nodejs.org/
    echo.
    pause
    exit /b 1
  )

  if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Close this window and run install-env.cmd again after Node.js installation finishes.
  echo.
  pause
  exit /b 1
)

echo Node:
node -v
echo npm:
npm.cmd -v

echo.
echo Installing project dependencies...
call npm.cmd install
if errorlevel 1 (
  echo npm install failed.
  echo.
  pause
  exit /b 1
)

echo.
echo Building web files...
call npm.cmd run build
if errorlevel 1 (
  echo Build failed.
  echo.
  pause
  exit /b 1
)

echo.
echo Environment is ready.
echo Use scripts\start-booth.cmd for booth mode or scripts\start-solo.cmd for solo mode.
echo.
pause
