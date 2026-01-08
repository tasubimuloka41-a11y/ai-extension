# Gemma AI Extension - Auto Loader for Chrome
# Скрипт для загрузки расширения в Chrome из GitHub

param(
    [string]$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe",
    [string]$ExtensionPath = "$PSScriptRoot"
)

Write-Host "" -ForegroundColor Cyan
Write-Host "=== Gemma 3 12B AI Extension Loader ===" -ForegroundColor Cyan
Write-Host ""

# Check if extension folder exists
if (-not (Test-Path $ExtensionPath)) {
    Write-Host "ERROR: Extension folder not found!" -ForegroundColor Red
    Write-Host "Path: $ExtensionPath" -ForegroundColor Yellow
    exit 1
}

# Check if manifest.json exists
if (-not (Test-Path "$ExtensionPath\manifest.json")) {
    Write-Host "ERROR: manifest.json not found!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Extension found at: $ExtensionPath" -ForegroundColor Green
Write-Host ""

# Check if Chrome exists
if (-not (Test-Path $ChromePath)) {
    Write-Host "WARNING: Chrome not found at: $ChromePath" -ForegroundColor Yellow
    Write-Host "Please specify the correct path to chrome.exe" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "[OK] Chrome found at: $ChromePath" -ForegroundColor Green
Write-Host ""
Write-Host "=== INSTRUCTIONS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Chrome will open to: chrome://extensions/" -ForegroundColor White
Write-Host "2. Enable 'Developer mode' (toggle in top-right corner)" -ForegroundColor White
Write-Host "3. Click 'Load unpacked'" -ForegroundColor White
Write-Host "4. Select folder: $ExtensionPath" -ForegroundColor White
Write-Host ""
Write-Host "Opening Chrome..." -ForegroundColor Yellow
Write-Host ""

# Open Chrome to extensions page
& $ChromePath "chrome://extensions/"

Write-Host "[OK] Chrome should open now!" -ForegroundColor Green
Write-Host "Load the extension manually from the folder above." -ForegroundColor Green
Write-Host ""
