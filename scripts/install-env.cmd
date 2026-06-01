@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0.."

echo.
echo [BangBangCai] Install environment
echo --------------------------------
set "MIN_NODE_MAJOR=20"
set "NEED_NODE=0"

where node >nul 2>nul
if errorlevel 1 (
  set "NEED_NODE=1"
) else (
  for /f %%M in ('node -p "parseInt(process.versions.node,10)"') do set "NODE_MAJOR=%%M"
  if "!NODE_MAJOR!"=="" (
    set "NEED_NODE=1"
  ) else if !NODE_MAJOR! LSS !MIN_NODE_MAJOR! (
    echo Node.js version is too old:
    node -v
    echo Node.js !MIN_NODE_MAJOR! or newer is required.
    set "NEED_NODE=1"
  )
)

if "!NEED_NODE!"=="1" (
  echo Node.js is missing or outdated.
  where winget >nul 2>nul
  if not errorlevel 1 (
    echo Installing/Updating Node.js LTS with winget...
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
      echo winget install failed, trying MSI fallback...
      goto :install_node_msi
    )
    goto :node_install_done
  ) else (
    echo winget not found, trying MSI fallback...
    goto :install_node_msi
  )
)
goto :after_node_install

:install_node_msi
set "NODE_MSI_URL=https://nodejs.org/dist/latest-v20.x/node-v20.20.2-x64.msi"
set "NODE_MSI_PATH=%TEMP%\node-lts-x64.msi"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '%NODE_MSI_URL%' -OutFile '%NODE_MSI_PATH%' -UseBasicParsing; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo Failed to download Node.js MSI.
  echo Please install Node.js LTS manually: https://nodejs.org/
  echo.
  pause
  exit /b 1
)
echo Installing Node.js silently...
msiexec /i "%NODE_MSI_PATH%" /qn /norestart
if errorlevel 1 (
  echo Silent MSI install failed.
  echo Please run this installer manually: %NODE_MSI_PATH%
  echo.
  pause
  exit /b 1
)
del /q "%NODE_MSI_PATH%" >nul 2>nul
goto :node_install_done

:node_install_done
if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%ProgramFiles(x86)%\nodejs" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"

:after_node_install
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm was not found after Node.js installation.
  echo Close this window and run install-env.cmd again.
  echo.
  pause
  exit /b 1
)

for /f %%M in ('node -p "parseInt(process.versions.node,10)"') do set "NODE_MAJOR=%%M"
if "!NODE_MAJOR!"=="" (
  echo Failed to detect Node.js version.
  pause
  exit /b 1
)
if !NODE_MAJOR! LSS !MIN_NODE_MAJOR! (
  echo Node.js is still too old:
  node -v
  echo Please install Node.js !MIN_NODE_MAJOR! or newer and run again.
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
if exist package-lock.json (
  echo Detected package-lock.json, using npm ci...
  call npm.cmd ci
  if errorlevel 1 (
    echo npm ci failed, falling back to npm install...
    call npm.cmd install
  )
) else (
  call npm.cmd install
)
if errorlevel 1 (
  echo Dependency installation failed.
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
echo Use scripts\start-booth.cmd for booth mode.
echo Use scripts\start-solo.cmd for solo mode.
echo.
pause