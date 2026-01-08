# Быстрая установка расширения
# Простой скрипт для PowerShell

Write-Host "========================================" -ForegroundColor Green
Write-Host "Gemma AI Assistant - Быстрая установка" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Получить текущую директорию
$currentDir = (Get-Location).Path
Write-Host "Директория проекта: $currentDir" -ForegroundColor Cyan
Write-Host ""

# Проверка основных файлов
Write-Host "Проверка файлов..." -ForegroundColor Yellow
$required = @("manifest.json", "popup.html", "background.js")
$missing = @()

foreach ($file in $required) {
    if (Test-Path $file) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file" -ForegroundColor Red
        $missing += $file
    }
}

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "Ошибка: Не найдены файлы: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "Убедитесь, что вы находитесь в правильной директории." -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host ""
Write-Host "✓ Все необходимые файлы найдены!" -ForegroundColor Green
Write-Host ""

# Инструкции
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Инструкция по установке:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Откройте браузер:" -ForegroundColor White
Write-Host "   Chrome: chrome://extensions/" -ForegroundColor Yellow
Write-Host "   Edge:   edge://extensions/" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Включите 'Режим разработчика' (Developer mode)" -ForegroundColor White
Write-Host ""
Write-Host "3. Нажмите 'Загрузить распакованное расширение' (Load unpacked)" -ForegroundColor White
Write-Host ""
Write-Host "4. Выберите эту директорию:" -ForegroundColor White
Write-Host "   $currentDir" -ForegroundColor Cyan
Write-Host ""

# Открыть директорию
$open = Read-Host "Открыть директорию в проводнике? (y/n)"
if ($open -eq "y" -or $open -eq "Y") {
    explorer .
}

# Открыть страницу расширений
$openBrowser = Read-Host "Открыть страницу расширений? (1=Chrome, 2=Edge, n=нет)"
if ($openBrowser -eq "1") {
    Start-Process "chrome://extensions/"
} elseif ($openBrowser -eq "2") {
    Start-Process "edge://extensions/"
}

Write-Host ""
Write-Host "Готово! Следуйте инструкциям выше." -ForegroundColor Green
Write-Host ""

pause

