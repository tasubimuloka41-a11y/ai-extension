# Инструкция по загрузке на GitHub

## Шаг 1: Создать репозиторий на GitHub

1. Открой https://github.com
2. Нажми "New repository" (или "Создать репозиторий")
3. Название: `gemma-ai-browser-extension`
4. Описание: `Автономный AI ассистент для браузера с поддержкой локальных моделей Ollama`
5. Выбери: **Private** (приватный) или **Public** (публичный)
6. НЕ создавай README, .gitignore, лицензию (уже есть)
7. Нажми "Create repository"

## Шаг 2: Загрузить код

Выполни эти команды в PowerShell (в папке проекта):

```powershell
# Перейти в папку проекта
cd "C:\Users\Drozd\Desktop\gemma-ai-browser-extension"

# Добавить удаленный репозиторий (замени USERNAME на свой GitHub username)
git remote add origin https://github.com/USERNAME/gemma-ai-browser-extension.git

# Загрузить код
git branch -M main
git push -u origin main
```

## Шаг 3: Если нужна авторизация

Если GitHub попросит авторизацию:

1. Используй Personal Access Token вместо пароля
2. Или используй GitHub CLI: `gh auth login`

## Быстрая команда (если репозиторий уже создан):

```powershell
cd "C:\Users\Drozd\Desktop\gemma-ai-browser-extension"
git remote add origin https://github.com/ТВОЙ_USERNAME/gemma-ai-browser-extension.git
git branch -M main
git push -u origin main
```

## Альтернатива: Через GitHub Desktop

1. Установи GitHub Desktop: https://desktop.github.com/
2. Открой GitHub Desktop
3. File → Add Local Repository
4. Выбери папку: `C:\Users\Drozd\Desktop\gemma-ai-browser-extension`
5. Publish repository

## Что будет загружено:

✅ Все основные файлы расширения
✅ Документация (README, инструкции)
✅ Скрипты установки
❌ Временные файлы (игнорируются через .gitignore)
❌ Личные настройки

