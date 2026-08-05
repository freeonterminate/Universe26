@echo off
setlocal
cd /d "%~dp0"

echo [Universe25] Windows launcher

echo Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not available in PATH.
  echo Install Node.js LTS from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

echo Checking npm...
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is not installed or not available in PATH.
  echo Reinstall Node.js LTS from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

echo Starting Universe25 simulator...
echo The browser should open automatically. If it does not, open the Local URL printed below.
call npm run start -- --open
pause
