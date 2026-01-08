# Скрипт установки и запуска расширения Gemma AI Assistant
# Для PowerShell

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Gemma 3 12B AI Assistant - Установка" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка наличия Git
Write-Host "[1/5] Проверка Git..." -ForegroundColor Yellow
try {
    $gitVersion = git --version
    Write-Host "✓ Git установлен: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Git не найден. Установите Git с https://git-scm.com/" -ForegroundColor Red
    exit 1
}

# Создание директории для проекта
Write-Host ""
Write-Host "[2/5] Создание директории проекта..." -ForegroundColor Yellow
$projectDir = "$env:USERPROFILE\Desktop\gemma-ai-extension"
if (Test-Path $projectDir) {
    Write-Host "✓ Директория уже существует: $projectDir" -ForegroundColor Green
    $overwrite = Read-Host "Перезаписать? (y/n)"
    if ($overwrite -eq "y") {
        Remove-Item -Path $projectDir -Recurse -Force
        New-Item -ItemType Directory -Path $projectDir -Force | Out-Null
        Write-Host "✓ Директория пересоздана" -ForegroundColor Green
    }
} else {
    New-Item -ItemType Directory -Path $projectDir -Force | Out-Null
    Write-Host "✓ Директория создана: $projectDir" -ForegroundColor Green
}

# Клонирование репозитория (если есть URL)
Write-Host ""
Write-Host "[3/5] Клонирование репозитория..." -ForegroundColor Yellow
$repoUrl = Read-Host "Введите URL репозитория GitHub (или нажмите Enter для пропуска)"
if ($repoUrl) {
    Set-Location $projectDir
    try {
        git clone $repoUrl .
        Write-Host "✓ Репозиторий склонирован" -ForegroundColor Green
    } catch {
        Write-Host "✗ Ошибка клонирования: $_" -ForegroundColor Red
        Write-Host "Продолжаем с текущей директорией..." -ForegroundColor Yellow
    }
} else {
    Write-Host "Пропущено. Используйте текущую директорию." -ForegroundColor Yellow
}

# Проверка файлов
Write-Host ""
Write-Host "[4/5] Проверка файлов..." -ForegroundColor Yellow
$requiredFiles = @("manifest.json", "popup.html", "background.js", "agent.js")
$allPresent = $true

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file" -ForegroundColor Green
    } else {
        Write-Host "✗ $file не найден" -ForegroundColor Red
        $allPresent = $false
    }
}

if (-not $allPresent) {
    Write-Host ""
    Write-Host "✗ Не все необходимые файлы найдены!" -ForegroundColor Red
    Write-Host "Убедитесь, что вы находитесь в правильной директории." -ForegroundColor Yellow
    exit 1
}

# Проверка иконок
Write-Host ""
Write-Host "Проверка иконок..." -ForegroundColor Yellow
$iconFiles = @("icons\icon16.png", "icons\icon48.png", "icons\icon128.png")
$iconsPresent = $true

foreach ($icon in $iconFiles) {
    if (Test-Path $icon) {
        Write-Host "✓ $icon" -ForegroundColor Green
    } else {
        Write-Host "⚠ $icon не найден (создайте иконки)" -ForegroundColor Yellow
        $iconsPresent = $false
    }
}

if (-not $iconsPresent) {
    Write-Host ""
    Write-Host "⚠ Внимание: Иконки не найдены!" -ForegroundColor Yellow
    Write-Host "Создайте иконки 16x16, 48x48, 128x128 пикселей в папке icons\" -ForegroundColor Yellow
    Write-Host "Или используйте онлайн генератор: https://www.favicon-generator.org/" -ForegroundColor Yellow
}

# Инструкции по установке
Write-Host ""
Write-Host "[5/5] Инструкции по установке в браузер" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Следующие шаги:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Откройте Chrome или Edge" -ForegroundColor White
Write-Host "2. Перейдите на:" -ForegroundColor White
Write-Host "   Chrome: chrome://extensions/" -ForegroundColor Cyan
Write-Host "   Edge:   edge://extensions/" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Включите 'Режим разработчика' (Developer mode)" -ForegroundColor White
Write-Host "4. Нажмите 'Загрузить распакованное расширение' (Load unpacked)" -ForegroundColor White
Write-Host "5. Выберите директорию:" -ForegroundColor White
Write-Host "   $((Get-Location).Path)" -ForegroundColor Cyan
Write-Host ""
Write-Host "6. Настройте расширение:" -ForegroundColor White
Write-Host "   - Откройте расширение" -ForegroundColor White
Write-Host "   - Нажмите настройки (шестеренка)" -ForegroundColor White
Write-Host "   - Введите URL вашего API (например: http://localhost:8000)" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Готово! Расширение установлено." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Открыть директорию в проводнике
$openExplorer = Read-Host "Открыть директорию в проводнике? (y/n)"
if ($openExplorer -eq "y") {
    explorer .
}

# Открыть страницу расширений
$openExtensions = Read-Host "Открыть страницу расширений в браузере? (y/n)"
if ($openExtensions -eq "y") {
    $browser = Read-Host "Выберите браузер (1=Chrome, 2=Edge)"
    if ($browser -eq "1") {
        Start-Process "chrome://extensions/"
    } elseif ($browser -eq "2") {
        Start-Process "edge://extensions/"
    }
}

