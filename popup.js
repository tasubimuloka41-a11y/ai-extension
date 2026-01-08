// Основной скрипт для popup интерфейса

let accessToken = null;

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
  initializeEventListeners();
  await loadSettings();
  await loadSelectedModel();
  await initAgentUI();
  await initTelegramUI();
  startAgentStatusPolling();
});

function initializeEventListeners() {
  const sendBtn = document.getElementById('sendBtn');
  const messageInput = document.getElementById('messageInput');
  const fileUploadBtn = document.getElementById('fileUploadBtn');
  const fileInput = document.getElementById('fileInput');
  const settingsBtn = document.getElementById('settingsBtn');
  const modelSelectBtn = document.getElementById('modelSelectBtn');
  const closeModelSelector = document.getElementById('closeModelSelector');
  const refreshModelsBtn = document.getElementById('refreshModelsBtn');
  const agentToggleBtn = document.getElementById('agentToggleBtn');

  sendBtn.addEventListener('click', handleSendMessage);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  fileUploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileUpload);
  const colabBtn = document.getElementById('colabBtn');
  if (colabBtn) {
    colabBtn.addEventListener('click', handleColabOpen);
  }
  settingsBtn.addEventListener('click', handleSettings);
  agentToggleBtn.addEventListener('click', toggleAgentPanel);
  
  const telegramBtn = document.getElementById('telegramBtn');
  const closeTelegramPanel = document.getElementById('closeTelegramPanel');
  const saveTelegramTokenBtn = document.getElementById('saveTelegramTokenBtn');
  const startTelegramBtn = document.getElementById('startTelegramBtn');
  const stopTelegramBtn = document.getElementById('stopTelegramBtn');
  const agentExitBtn = document.getElementById('agentExitBtn');
  
  if (telegramBtn) {
    telegramBtn.addEventListener('click', showTelegramPanel);
  }
  if (closeTelegramPanel) {
    closeTelegramPanel.addEventListener('click', hideTelegramPanel);
  }
  if (saveTelegramTokenBtn) {
    saveTelegramTokenBtn.addEventListener('click', handleSaveTelegramToken);
  }
  if (startTelegramBtn) {
    startTelegramBtn.addEventListener('click', handleStartTelegram);
  }
  if (stopTelegramBtn) {
    stopTelegramBtn.addEventListener('click', handleStopTelegram);
  }
  if (agentExitBtn) {
    agentExitBtn.addEventListener('click', handleExitAgentMode);
  }
  
  if (modelSelectBtn) {
    modelSelectBtn.addEventListener('click', showModelSelector);
  }
  if (closeModelSelector) {
    closeModelSelector.addEventListener('click', hideModelSelector);
  }
  if (refreshModelsBtn) {
    refreshModelsBtn.addEventListener('click', loadModelsList);
  }
  
  // Клик вне селектора закрывает его
  document.addEventListener('click', (e) => {
    const selector = document.getElementById('modelSelector');
    if (selector && !selector.contains(e.target) && e.target !== modelSelectBtn) {
      hideModelSelector();
    }
  });
  
  // Автономное выполнение задач
  const executeAutonomousTaskBtn = document.getElementById('executeAutonomousTaskBtn');
  const autonomousTaskInput = document.getElementById('autonomousTaskInput');
  const autonomousTaskUrl = document.getElementById('autonomousTaskUrl');
  
  executeAutonomousTaskBtn.addEventListener('click', handleExecuteAutonomousTask);
  autonomousTaskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleExecuteAutonomousTask();
    }
  });
}

async function loadSettings() {
  const result = await chrome.storage.local.get(['gemmaApiUrl', 'gemmaPort']);
  if (result.gemmaApiUrl) {
    // Настройки загружены
  }
}

async function loadSelectedModel() {
  const result = await chrome.storage.local.get(['selectedModel']);
  const modelName = result.selectedModel || 'gemma3:12b';
  const modelNameElement = document.getElementById('modelName');
  if (modelNameElement) {
    modelNameElement.textContent = modelName;
  }
}

async function handleColabOpen() {
  try {
    updateStatus('Открытие Google Colab...');
    const response = await chrome.runtime.sendMessage({
      type: 'colab_create_code',
      task: prompt('Опиши задачу для выполнения в Colab:') || 'Создать новый ноутбук'
    });
    
    if (response.success) {
      updateStatus('Colab открыт, код добавлен');
      addMessage('assistant', `✅ Colab открыт! Код добавлен:\n\`\`\`python\n${response.code.substring(0, 200)}...\n\`\`\``);
    } else {
      updateStatus(`Ошибка: ${response.error}`);
      addMessage('assistant', `❌ Ошибка: ${response.error}`);
    }
  } catch (error) {
    console.error('Ошибка открытия Colab:', error);
    updateStatus(`Ошибка: ${error.message}`);
  }
}

async function handleSendMessage() {
  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value.trim();
  
  if (!message) return;

  // Добавить сообщение пользователя в чат
  addMessage('user', message);
  messageInput.value = '';
  
  // Показать индикатор загрузки
  const loadingId = showLoading();

  try {
    // Отправить запрос в background script
    const response = await chrome.runtime.sendMessage({
      type: 'sendToGemma',
      message: message,
      accessToken: accessToken
    });

    // Убрать индикатор загрузки
    hideLoading(loadingId);

    if (response.error) {
      addMessage('assistant', `Ошибка: ${response.error}`);
    } else {
      addMessage('assistant', response.text);
      
      // Если в ответе есть ссылки, обработать их
      if (response.links && response.links.length > 0) {
        processLinks(response.links);
      }
    }
  } catch (error) {
    hideLoading(loadingId);
    addMessage('assistant', `Ошибка соединения: ${error.message}`);
  }
}

function addMessage(role, content) {
  const messages = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = content;
  
  // Обработка ссылок в тексте
  const linkRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(linkRegex);
  contentDiv.innerHTML = parts.map(part => {
    if (linkRegex.test(part)) {
      return `<a href="${part}" target="_blank" class="link">${part}</a>`;
    }
    return part;
  }).join('');
  
  const timeDiv = document.createElement('div');
  timeDiv.className = 'message-time';
  timeDiv.textContent = new Date().toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  messageDiv.appendChild(contentDiv);
  messageDiv.appendChild(timeDiv);
  messages.appendChild(messageDiv);
  
  // Прокрутить вниз
  messages.scrollTop = messages.scrollHeight;
}

function showLoading() {
  const messages = document.getElementById('messages');
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant loading';
  loadingDiv.id = 'loading-indicator';
  loadingDiv.innerHTML = `
    <div class="loading-dot"></div>
    <div class="loading-dot"></div>
    <div class="loading-dot"></div>
  `;
  messages.appendChild(loadingDiv);
  messages.scrollTop = messages.scrollHeight;
  return 'loading-indicator';
}

function hideLoading(loadingId) {
  const loading = document.getElementById(loadingId);
  if (loading) {
    loading.remove();
  }
}

function processLinks(links) {
  // Добавить кнопки для открытия ссылок в панели
  links.forEach(link => {
    // Можно добавить UI для открытия ссылок
  });
}

async function handleFileUpload(event) {
  const files = event.target.files;
  if (files.length === 0) return;

  updateStatus(`Загрузка ${files.length} файл(ов)...`);

  for (const file of files) {
    try {
      const fileData = await readFileAsBase64(file);
      
      // Отправить файл в background для обработки
      const response = await chrome.runtime.sendMessage({
        type: 'uploadFile',
        fileName: file.name,
        fileData: fileData,
        fileType: file.type,
        accessToken: accessToken
      });

      if (response.success) {
        addMessage('assistant', `Файл "${file.name}" успешно загружен${response.driveUrl ? ' на Google Drive' : ''}`);
      } else {
        addMessage('assistant', `Ошибка загрузки файла "${file.name}": ${response.error}`);
      }
    } catch (error) {
      addMessage('assistant', `Ошибка обработки файла "${file.name}": ${error.message}`);
    }
  }

  // Очистить input
  event.target.value = '';
  updateStatus('Готов к работе');
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleSettings() {
  // Получить текущие настройки
  const result = await chrome.storage.local.get(['gemmaApiUrl', 'gemmaPort']);
  const currentUrl = result.gemmaApiUrl || 'http://localhost:8000';
  
  // Открыть окно настроек
  const apiUrl = prompt('Введите URL API для Gemma 3 12B:', currentUrl);
  if (apiUrl !== null) {
    if (apiUrl.trim()) {
      await chrome.storage.local.set({ gemmaApiUrl: apiUrl.trim() });
      updateStatus('Настройки сохранены');
    } else {
      updateStatus('URL не может быть пустым');
    }
  }
}

function updateStatus(text) {
  const statusText = document.getElementById('statusText');
  statusText.textContent = text;
  setTimeout(() => {
    statusText.textContent = 'Готов к работе';
  }, 3000);
}

// ========== Функции для выбора модели ==========

async function showModelSelector() {
  const selector = document.getElementById('modelSelector');
  if (selector) {
    selector.classList.remove('hidden');
    await loadModelsList();
  }
}

function hideModelSelector() {
  const selector = document.getElementById('modelSelector');
  if (selector) {
    selector.classList.add('hidden');
  }
}

async function loadModelsList() {
  const modelsList = document.getElementById('modelsList');
  if (!modelsList) return;

  modelsList.innerHTML = '<div class="loading-models">Загрузка моделей...</div>';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'get_models' });
    
    if (response.success && response.models && response.models.length > 0) {
      const { selectedModel } = await chrome.storage.local.get(['selectedModel']);
      const currentModel = selectedModel || 'gemma3:12b';

      modelsList.innerHTML = response.models.map(model => {
        const isSelected = model.name === currentModel;
        const size = formatSize(model.size);
        const date = formatDate(model.modified_at);

        return `
          <div class="model-item ${isSelected ? 'selected' : ''}" data-model="${model.name}">
            <div class="model-item-info">
              <div class="model-item-name">${model.name}</div>
              <div class="model-item-details">
                <span class="model-item-size">${size}</span>
                <span class="model-item-date">${date}</span>
              </div>
            </div>
            ${isSelected ? '<span class="model-item-check">✓</span>' : ''}
          </div>
        `;
      }).join('');

      // Добавить обработчики кликов
      modelsList.querySelectorAll('.model-item').forEach(item => {
        item.addEventListener('click', async () => {
          const modelName = item.dataset.model;
          await selectModel(modelName);
        });
      });
    } else {
      modelsList.innerHTML = `<div class="loading-models">${response.error || 'Модели не найдены'}</div>`;
    }
  } catch (error) {
    modelsList.innerHTML = `<div class="loading-models">Ошибка: ${error.message}</div>`;
  }
}

async function selectModel(modelName) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'set_model',
      modelName: modelName
    });

    if (response.success) {
      await loadSelectedModel();
      hideModelSelector();
      updateStatus(`Модель изменена на: ${modelName}`);
      addMessage('assistant', `✅ Модель изменена на: ${modelName}`);
    } else {
      updateStatus(`Ошибка: ${response.error}`);
    }
  } catch (error) {
    console.error('Ошибка выбора модели:', error);
    updateStatus(`Ошибка: ${error.message}`);
  }
}

function formatSize(bytes) {
  if (!bytes) return 'Неизвестно';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatDate(dateString) {
  if (!dateString) return 'Неизвестно';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  if (days < 7) return `${days} дней назад`;
  if (days < 30) return `${Math.floor(days / 7)} недель назад`;
  return `${Math.floor(days / 30)} месяцев назад`;
}

// ========== Функции для выхода из автономного режима ==========

function handleExitAgentMode() {
  const agentPanel = document.getElementById('agentPanel');
  if (agentPanel) {
    agentPanel.classList.add('hidden');
    agentPanelVisible = false;
    updateStatus('Выход из режима агента');
  }
}

// ========== Функции для Telegram интеграции ==========

async function initTelegramUI() {
  await updateTelegramStatus();
  
  // Загрузить сохраненный токен
  const { telegramBotToken } = await chrome.storage.local.get(['telegramBotToken']);
  if (telegramBotToken) {
    const tokenInput = document.getElementById('telegramTokenInput');
    if (tokenInput) {
      tokenInput.value = '••••••••' + telegramBotToken.slice(-4);
    }
    
    // Попробовать получить информацию о боте
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'telegram_init',
        token: telegramBotToken
      });
      
      if (response.success && response.botInfo) {
        showBotInfo(response.botInfo);
      }
    } catch (error) {
      console.error('Ошибка инициализации Telegram:', error);
    }
  }
  
  // Слушать сообщения от Telegram
  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'telegram_message_received') {
      displayTelegramMessage(request.message);
    }
  });
}

async function updateTelegramStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'telegram_get_status' });
    if (response.success) {
      const telegramStatus = document.getElementById('telegramStatus');
      const startBtn = document.getElementById('startTelegramBtn');
      const stopBtn = document.getElementById('stopTelegramBtn');
      
      if (response.isListening) {
        if (telegramStatus) {
          telegramStatus.classList.remove('hidden');
          telegramStatus.classList.add('active');
        }
        if (startBtn) startBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.remove('hidden');
      } else {
        if (telegramStatus) {
          telegramStatus.classList.remove('active');
        }
        if (startBtn) startBtn.classList.remove('hidden');
        if (stopBtn) stopBtn.classList.add('hidden');
      }
    }
  } catch (error) {
    console.error('Ошибка обновления статуса Telegram:', error);
  }
}

function showTelegramPanel() {
  const panel = document.getElementById('telegramPanel');
  if (panel) {
    panel.classList.remove('hidden');
  }
}

function hideTelegramPanel() {
  const panel = document.getElementById('telegramPanel');
  if (panel) {
    panel.classList.add('hidden');
  }
}

async function handleSaveTelegramToken() {
  const tokenInput = document.getElementById('telegramTokenInput');
  const token = tokenInput.value.trim();
  
  if (!token) {
    updateStatus('Введите токен бота');
    return;
  }
  
  try {
    updateStatus('Проверка токена...');
    const response = await chrome.runtime.sendMessage({
      type: 'telegram_init',
      token: token
    });
    
    if (response.success) {
      updateStatus('Токен сохранен');
      showBotInfo(response.botInfo);
      addMessage('assistant', '✅ Telegram бот подключен!');
    } else {
      updateStatus(`Ошибка: ${response.error}`);
      addMessage('assistant', `❌ Ошибка: ${response.error}`);
    }
  } catch (error) {
    updateStatus(`Ошибка: ${error.message}`);
  }
}

function showBotInfo(botInfo) {
  const botInfoDiv = document.getElementById('telegramBotInfo');
  const botName = document.getElementById('botName');
  const botUsername = document.getElementById('botUsername');
  
  if (botInfoDiv) botInfoDiv.classList.remove('hidden');
  if (botName) botName.textContent = botInfo.first_name || '-';
  if (botUsername) botUsername.textContent = '@' + (botInfo.username || '-');
}

async function handleStartTelegram() {
  try {
    updateStatus('Запуск Telegram бота...');
    const response = await chrome.runtime.sendMessage({ type: 'telegram_start' });
    
    if (response.success) {
      updateStatus('Telegram бот запущен');
      await updateTelegramStatus();
      addMessage('assistant', '✅ Telegram бот запущен! Теперь он будет отвечать на сообщения.');
    } else {
      updateStatus(`Ошибка: ${response.error}`);
      addMessage('assistant', `❌ Ошибка запуска: ${response.error}`);
    }
  } catch (error) {
    updateStatus(`Ошибка: ${error.message}`);
  }
}

async function handleStopTelegram() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'telegram_stop' });
    
    if (response.success) {
      updateStatus('Telegram бот остановлен');
      await updateTelegramStatus();
      addMessage('assistant', '⏹ Telegram бот остановлен');
    } else {
      updateStatus(`Ошибка: ${response.error}`);
    }
  } catch (error) {
    updateStatus(`Ошибка: ${error.message}`);
  }
}

function displayTelegramMessage(messageData) {
  const messagesDiv = document.getElementById('telegramMessages');
  if (!messagesDiv) return;
  
  // Убрать информационное сообщение
  const infoMsg = messagesDiv.querySelector('.telegram-message-info');
  if (infoMsg) infoMsg.remove();
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'telegram-message';
  messageDiv.innerHTML = `
    <div class="telegram-message-header">
      <span>От: ${messageData.from.first_name || messageData.from.username || 'Неизвестно'}</span>
      <span>${new Date().toLocaleTimeString('ru-RU')}</span>
    </div>
    <div class="telegram-message-text">
      <strong>Вопрос:</strong> ${messageData.text}<br>
      <strong>Ответ:</strong> ${messageData.response}
    </div>
  `;
  
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  
  // Также добавить в основной чат
  addMessage('user', `[Telegram] ${messageData.text}`);
  addMessage('assistant', messageData.response);
}

// Обработка ссылок в сообщениях
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('link')) {
    e.preventDefault();
    const url = e.target.href;
    // Открыть ссылку в панели
    chrome.runtime.sendMessage({
      type: 'openInPanel',
      url: url
    });
  }
  
  // Обработка быстрых действий агента
  if (e.target.classList.contains('quick-action-btn')) {
    const action = e.target.dataset.action;
    handleQuickAction(action);
  }
});

// ========== Функции для автономного агента ==========

let agentPanelVisible = false;
let agentStatusInterval = null;

async function initAgentUI() {
  const agentPanel = document.getElementById('agentPanel');
  const agentStopBtn = document.getElementById('agentStopBtn');
  const agentClearBtn = document.getElementById('agentClearBtn');
  const memoryStatsBtn = document.getElementById('memoryStatsBtn');
  const clearMemoryBtn = document.getElementById('clearMemoryBtn');
  const exportMemoryBtn = document.getElementById('exportMemoryBtn');
  
  agentStopBtn.addEventListener('click', handleAgentStop);
  agentClearBtn.addEventListener('click', handleAgentClear);
  memoryStatsBtn.addEventListener('click', showMemoryStats);
  clearMemoryBtn.addEventListener('click', handleClearMemory);
  exportMemoryBtn.addEventListener('click', handleExportMemory);
  
  await updateAgentStatus();
  await updateMemoryStats();
  
  // Обновлять статистику памяти каждые 5 секунд
  setInterval(updateMemoryStats, 5000);
}

function toggleAgentPanel() {
  const agentPanel = document.getElementById('agentPanel');
  agentPanelVisible = !agentPanelVisible;
  
  if (agentPanelVisible) {
    agentPanel.classList.remove('hidden');
  } else {
    agentPanel.classList.add('hidden');
  }
}

async function updateAgentStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'agent_get_status' });
    
    if (response.success) {
      const stats = response.stats;
      
      // Обновить индикатор статуса
      const agentStatus = document.getElementById('agentStatus');
      const agentStatusText = document.getElementById('agentStatusText');
      
      if (stats.isRunning) {
        agentStatus.classList.add('running');
        agentStatus.classList.remove('idle');
        agentStatusText.textContent = 'Работает';
      } else {
        agentStatus.classList.add('idle');
        agentStatus.classList.remove('running');
        agentStatusText.textContent = 'Остановлен';
      }
      
      // Обновить статистику
      document.getElementById('queueCount').textContent = stats.queueLength;
      document.getElementById('visitedCount').textContent = stats.visitedUrls;
      document.getElementById('filesCount').textContent = stats.downloadedFiles;
    }
  } catch (error) {
    console.error('Ошибка обновления статуса агента:', error);
  }
}

function startAgentStatusPolling() {
  // Обновлять статус каждые 2 секунды
  agentStatusInterval = setInterval(updateAgentStatus, 2000);
}

// ========== Функции для памяти и обучения ==========

async function updateMemoryStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'agent_get_memory_stats' });
    
    if (response.success && response.stats) {
      const stats = response.stats;
      
      document.getElementById('memoryExperiencesCount').textContent = stats.totalExperiences;
      document.getElementById('memorySuccessRate').textContent = 
        `${(stats.successRate * 100).toFixed(0)}%`;
    }
  } catch (error) {
    console.error('Ошибка обновления статистики памяти:', error);
  }
}

async function showMemoryStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'agent_get_memory_stats' });
    
    if (response.success && response.stats) {
      const stats = response.stats;
      const message = `📊 Статистика памяти:

Всего опыта: ${stats.totalExperiences}
Успешных: ${stats.successful}
Неудачных: ${stats.failed}
Успешность: ${(stats.successRate * 100).toFixed(1)}%
Уникальных задач: ${stats.uniqueTasks}
Уникальных URL: ${stats.uniqueUrls}
Размер памяти: ${(stats.memorySize / 1024).toFixed(2)} KB

${stats.oldestExperience ? `Старейший опыт: ${new Date(stats.oldestExperience).toLocaleDateString()}` : ''}
${stats.newestExperience ? `Новейший опыт: ${new Date(stats.newestExperience).toLocaleDateString()}` : ''}`;
      
      addMessage('assistant', message);
    } else {
      addMessage('assistant', 'Память не инициализирована или пуста');
    }
  } catch (error) {
    console.error('Ошибка получения статистики памяти:', error);
    addMessage('assistant', `Ошибка: ${error.message}`);
  }
}

async function handleClearMemory() {
  const keepSuccessful = confirm('Очистить память?\n\nНажмите OK для полной очистки\nОтмена - сохранить только успешные опыты');
  
  if (confirm(`Вы уверены? ${keepSuccessful ? 'Будут сохранены только успешные опыты.' : 'Вся память будет удалена.'}`)) {
    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'agent_clear_memory',
        keepSuccessful: keepSuccessful
      });
      
      if (response.success) {
        updateStatus(keepSuccessful ? 'Память очищена (успешные опыты сохранены)' : 'Память полностью очищена');
        await updateMemoryStats();
        addMessage('assistant', keepSuccessful 
          ? '✅ Память очищена. Успешные опыты сохранены для обучения.'
          : '✅ Память полностью очищена.');
      } else {
        updateStatus(`Ошибка: ${response.error}`);
      }
    } catch (error) {
      console.error('Ошибка очистки памяти:', error);
      updateStatus(`Ошибка: ${error.message}`);
    }
  }
}

async function handleExportMemory() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'agent_export_memory' });
    
    if (response.success && response.data) {
      // Создать blob и скачать
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agent-memory-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      updateStatus('Память экспортирована');
      addMessage('assistant', '✅ Память экспортирована в файл JSON');
    } else {
      updateStatus(`Ошибка: ${response.error || 'Не удалось экспортировать'}`);
    }
  } catch (error) {
    console.error('Ошибка экспорта памяти:', error);
    updateStatus(`Ошибка: ${error.message}`);
  }
}

async function handleQuickAction(action) {
  switch (action) {
    case 'analyze_url':
      const url = prompt('Введите URL для анализа:');
      if (url) {
        await addAgentTask({
          type: 'analyze_url',
          url: url,
          options: { autoFollow: false }
        });
      }
      break;
      
    case 'follow_links':
      const startUrl = prompt('Введите начальный URL:');
      const maxLinks = parseInt(prompt('Максимум ссылок (по умолчанию 10):') || '10');
      if (startUrl) {
        await addAgentTask({
          type: 'follow_links',
          startUrl: startUrl,
          maxLinks: maxLinks,
          depth: 0
        });
      }
      break;
      
    case 'search_analyze':
      const query = prompt('Введите поисковый запрос:');
      if (query) {
        await addAgentTask({
          type: 'search_and_analyze',
          query: query,
          options: { maxResults: 5 }
        });
      }
      break;
      
    case 'download_file':
      const fileUrl = prompt('Введите URL файла для скачивания:');
      if (fileUrl) {
        await addAgentTask({
          type: 'download_file',
          url: fileUrl,
          options: { saveToDrive: true }
        });
      }
      break;
  }
  
  updateAgentStatus();
}

async function addAgentTask(task) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'agent_add_task',
      task: task
    });
    
    if (response.success) {
      updateStatus(`Задача добавлена: ${task.type}`);
      addMessage('assistant', `✅ Задача "${task.type}" добавлена в очередь агента`);
    } else {
      updateStatus(`Ошибка: ${response.error}`);
      addMessage('assistant', `❌ Ошибка добавления задачи: ${response.error}`);
    }
  } catch (error) {
    console.error('Ошибка добавления задачи:', error);
    updateStatus(`Ошибка: ${error.message}`);
  }
}

async function handleAgentStop() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'agent_stop' });
    if (response.success) {
      updateStatus('Агент остановлен');
      updateAgentStatus();
    }
  } catch (error) {
    console.error('Ошибка остановки агента:', error);
  }
}

async function handleAgentClear() {
  if (confirm('Очистить историю агента? Это удалит все посещенные URL и результаты анализа.')) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'agent_clear' });
      if (response.success) {
        updateStatus('История очищена');
        updateAgentStatus();
      }
    } catch (error) {
      console.error('Ошибка очистки истории:', error);
    }
  }
}

// ========== Функции для автономного выполнения в браузере ==========

async function handleExecuteAutonomousTask() {
  const taskInput = document.getElementById('autonomousTaskInput');
  const urlInput = document.getElementById('autonomousTaskUrl');
  const executeBtn = document.getElementById('executeAutonomousTaskBtn');
  const statusDiv = document.getElementById('autonomousTaskStatus');
  
  const taskDescription = taskInput.value.trim();
  const url = urlInput.value.trim();
  
  if (!taskDescription) {
    showAutonomousStatus('Введите описание задачи', 'error');
    return;
  }
  
  // Отключить кнопку
  executeBtn.disabled = true;
  executeBtn.textContent = 'Выполняется...';
  
  showAutonomousStatus('Задача добавлена в очередь. Агент начинает выполнение...', 'info');
  
  try {
    // Получить текущую вкладку, если URL не указан
    let targetUrl = url;
    if (!targetUrl) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        targetUrl = tabs[0].url;
      }
    }
    
    const response = await chrome.runtime.sendMessage({
      type: 'autonomous_browser_task',
      task: {
        description: taskDescription,
        goal: taskDescription,
        url: targetUrl || undefined,
        prompt: `Выполни следующую задачу на веб-странице: ${taskDescription}. Проанализируй экран, определи необходимые действия и выполни их.`
      }
    });
    
    if (response.success) {
      showAutonomousStatus(`✅ Задача добавлена (ID: ${response.taskId}). Агент выполняет задачу автономно.`, 'success');
      addMessage('assistant', `🤖 Автономная задача запущена: "${taskDescription}"${targetUrl ? ` на ${targetUrl}` : ''}`);
      
      // Очистить поля
      taskInput.value = '';
      urlInput.value = '';
      
      // Обновить статус агента
      setTimeout(updateAgentStatus, 1000);
    } else {
      showAutonomousStatus(`❌ Ошибка: ${response.error}`, 'error');
    }
  } catch (error) {
    console.error('Ошибка выполнения автономной задачи:', error);
    showAutonomousStatus(`❌ Ошибка: ${error.message}`, 'error');
  } finally {
    executeBtn.disabled = false;
    executeBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      Выполнить автономно
    `;
  }
}

function showAutonomousStatus(message, type = 'info') {
  const statusDiv = document.getElementById('autonomousTaskStatus');
  statusDiv.textContent = message;
  statusDiv.className = `autonomous-status ${type}`;
  statusDiv.classList.remove('hidden');
  
  // Автоматически скрыть через 5 секунд для info, 10 для success/error
  const timeout = type === 'info' ? 5000 : 10000;
  setTimeout(() => {
    statusDiv.classList.add('hidden');
  }, timeout);
}

