# Структура проекта расширения

```
gemma-ai-extension/
├── manifest.json          # Манифест расширения Chrome/Edge
├── popup.html             # Главный интерфейс расширения
├── popup.js               # JavaScript логика интерфейса
├── styles.css             # Стили главного интерфейса
├── background.js          # Service Worker для фоновых задач
├── content.js             # Content Script для работы со страницами
├── panel.html             # HTML панели для просмотра ссылок
├── panel.js               # JavaScript панели
├── panel.css              # Стили панели
├── icons/                 # Папка с иконками
│   ├── icon16.png         # Иконка 16x16 (обязательно)
│   ├── icon48.png         # Иконка 48x48 (обязательно)
│   └── icon128.png        # Иконка 128x128 (обязательно)
├── README.md              # Основная документация
├── SETUP.md               # Инструкция по настройке
└── PROJECT_STRUCTURE.md   # Этот файл
```

## Описание файлов

### manifest.json
Манифест расширения определяет:
- Название, версию, описание
- Разрешения (storage, tabs, identity и т.д.)
- OAuth настройки для Google Drive
- Точки входа (popup, background, content scripts)

### popup.html / popup.js / styles.css
Главный интерфейс расширения:
- Большое окно ввода
- Темный фон с градиентом
- Кнопки для загрузки файлов и подключения Google Drive
- Чат с историей сообщений

### background.js
Service Worker для:
- Коммуникации с локальной моделью Gemma 3 12B
- Загрузки файлов на Google Drive
- Управления панелями и вкладками

### content.js
Content Script для:
- Извлечения ссылок со страниц
- Взаимодействия с контентом страниц

### panel.html / panel.js / panel.css
Панель для просмотра ссылок:
- Открытие ссылок в iframe
- Навигация (назад, обновить, закрыть)
- Темный интерфейс в стиле расширения

## Требования

- Chrome/Edge браузер (Manifest V3)
- Локальная модель Gemma 3 12B с API сервером
- Google Cloud проект с включенным Drive API (опционально)

## Следующие шаги

1. Создайте иконки (см. SETUP.md)
2. Настройте Google Drive API (см. SETUP.md)
3. Установите расширение в браузере
4. Настройте URL API модели
5. Начните использовать!

