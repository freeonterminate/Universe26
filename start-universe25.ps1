$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

Write-Host "[Universe25] Windows PowerShell launcher"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is not installed or not available in PATH. Install Node.js LTS from https://nodejs.org/ and run this file again."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm is not installed or not available in PATH. Reinstall Node.js LTS from https://nodejs.org/ and run this file again."
}

if (-not (Test-Path -LiteralPath "node_modules")) {
  Write-Host "Installing npm dependencies..."
  npm install
}

Write-Host "Starting Universe25 simulator..."
Write-Host "The browser should open automatically. If it does not, open the Local URL printed below."
npm run start -- --open
