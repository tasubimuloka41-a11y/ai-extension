// Service Worker для расширения

importScripts(
  'agent-memory.js',
  'browser-automation.js',
  'agent.js',
  'colab-automation.js',
  'ollama-models.js',
  'telegram-integration.js'
);

const DEFAULT_Gemma_API_URL = 'http://localhost:11435'; // Ollama по умолчанию (порт 11435)

let agent = null;
let telegramBot = null;
let telegramListening = false;

// Инициализация агента
async function initAgent() {
  if (!agent) {
    agent = new AutonomousAgent();
    await agent.loadState();

    // Если были незавершенные задачи, продолжить
    if (agent.taskQueue.length > 0 && !agent.isRunning) {
      agent.start();
    }
  }

  return agent;
}

// Обработка сообщений от popup и content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'sendToGemma') {
    handleGemmaRequest(request.message, request.accessToken)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Асинхронный ответ
  }

  if (request.type === 'uploadFile') {
    handleFileUpload(
      request.fileName,
      request.fileData,
      request.fileType,
      request.accessToken
    )
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'openInPanel') {
    handleOpenInPanel(request.url);
    sendResponse({ success: true });
    return true;
  }

  // Обработка сообщений агента
  if (request.type === 'agent_add_task') {
    handleAgentTask(request.task)
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'agent_get_status') {
    handleAgentStatus()
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'agent_stop') {
    handleAgentStop()
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'agent_clear') {
    handleAgentClear()
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'agent_get_history') {
    handleAgentHistory()
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'capture_screenshot') {
    handleCaptureScreenshot(request.tabId)
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'execute_browser_action') {
    handleExecuteBrowserAction(request.action, request.tabId)
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'autonomous_browser_task') {
    handleAutonomousBrowserTask(request.task)
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'agent_get_memory_stats') {
    handleGetMemoryStats()
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'agent_clear_memory') {
    handleClearMemory(request.keepSuccessful)
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'agent_export_memory') {
    handleExportMemory()
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'colab_create_code') {
    handleColabCreateCode(request.task)
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'colab_add_code') {
    handleColabAddCode(request.tabId, request.code)
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'get_models') {
    handleGetModels()
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'set_model') {
    handleSetModel(request.modelName)
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  // Обработчики для Telegram
  if (request.type === 'telegram_init') {
    handleTelegramInit(request.token)
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'telegram_start') {
    handleTelegramStart()
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'telegram_stop') {
    handleTelegramStop()
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  if (request.type === 'telegram_get_status') {
    handleTelegramStatus()
      .then(response => sendResponse(response))
      .catch(error =>
        sendResponse({ success: false, error: error.message })
      );
    return true;
  }

  return false;
});

// Обработчики для моделей
async function handleGetModels() {
  try {
    const ollama = new OllamaModels();
    const result = await ollama.getModels();
    return result;
  } catch (error) {
    return { success: false, error: error.message, models: [] };
  }
}

async function handleSetModel(modelName) {
  try {
    await chrome.storage.local.set({ selectedModel: modelName });
    return { success: true, modelName };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Обработчики для Telegram
async function handleTelegramInit(token) {
  try {
    if (!telegramBot) {
      telegramBot = new TelegramIntegration();
    }

    await telegramBot.init(token);
    await chrome.storage.local.set({ telegramBotToken: token });
    const botInfo = await telegramBot.getBotInfo();
    return { success: true, botInfo: botInfo.bot };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleTelegramStart() {
  try {
    if (!telegramBot) {
      const { telegramBotToken } = await chrome.storage.local.get([
        'telegramBotToken'
      ]);

      if (!telegramBotToken) {
        return { success: false, error: 'Токен не установлен' };
      }

      telegramBot = new TelegramIntegration();
      await telegramBot.init(telegramBotToken);
    }

    const result = await telegramBot.startListening(async message => {
      const { gemmaApiUrl } = await chrome.storage.local.get(['gemmaApiUrl']);
      const apiUrl = gemmaApiUrl || DEFAULT_Gemma_API_URL;

      const { selectedModel } = await chrome.storage.local.get([
        'selectedModel'
      ]);
      const modelName = selectedModel || 'gemma3:12b';

      const isOllama =
        apiUrl.includes('localhost:11435') ||
        apiUrl.includes('localhost:11434');

      try {
        let response;
        if (isOllama) {
          response = await fetch(`${apiUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modelName,
              messages: [{ role: 'user', content: message.text }],
              stream: false
            })
          });
        } else {
          response = await fetch(`${apiUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modelName,
              messages: [{ role: 'user', content: message.text }],
              temperature: 0.7,
              max_tokens: 2000
            })
          });
        }

        if (response.ok) {
          const data = await response.json();
          let aiResponse = '';

          if (isOllama) {
            aiResponse =
              data.message?.content || data.response || 'Нет ответа';
          } else {
            aiResponse =
              data.choices?.[0]?.message?.content ||
              data.response ||
              'Нет ответа';
          }

          // Отправить ответ в Telegram
          await telegramBot.sendMessage(message.chatId, aiResponse);

          // Отправить уведомление в popup
          chrome.runtime
            .sendMessage({
              type: 'telegram_message_received',
              message: {
                from: message.from,
                text: message.text,
                response: aiResponse
              }
            })
            .catch(() => {});
        } else {
          await telegramBot.sendMessage(
            message.chatId,
            `Ошибка: ${response.status}`
          );
        }
      } catch (error) {
        await telegramBot.sendMessage(
          message.chatId,
          `Ошибка: ${error.message}`
        );
      }
    });

    if (result.success) {
      telegramListening = true;
    }

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleTelegramStop() {
  try {
    if (telegramBot) {
      telegramBot.stopListening();
      telegramListening = false;
      return { success: true };
    }

    return { success: false, error: 'Бот не инициализирован' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleTelegramStatus() {
  try {
    const { telegramBotToken } = await chrome.storage.local.get([
      'telegramBotToken'
    ]);
    return {
      success: true,
      hasToken: !!telegramBotToken,
      isListening: telegramListening
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Обработчики для Colab
async function handleColabCreateCode(task) {
  try {
    const colab = new ColabAutomation();
    const result = await colab.createAndRunCode(
      task.description || task
    );
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleColabAddCode(tabId, code) {
  try {
    const colab = new ColabAutomation();
    const result = await colab.addCodeCell(tabId, code);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Обработчики для системы памяти
async function handleGetMemoryStats() {
  try {
    const agentInstance = await initAgent();
    if (agentInstance.memory) {
      const stats = await agentInstance.memory.getMemoryStats();
      return { success: true, stats };
    }

    return { success: false, error: 'Память не инициализирована' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleClearMemory(keepSuccessful = false) {
  try {
    const agentInstance = await initAgent();
    if (agentInstance.memory) {
      await agentInstance.memory.clearMemory(keepSuccessful);
      return { success: true };
    }

    return { success: false, error: 'Память не инициализирована' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleExportMemory() {
  try {
    const agentInstance = await initAgent();
    if (agentInstance.memory) {
      const exported = await agentInstance.memory.exportMemory();
      return { success: true, data: exported };
    }

    return { success: false, error: 'Память не инициализирована' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Обработчики для browser automation
async function handleCaptureScreenshot(tabId) {
  try {
    const automation = new BrowserAutomation();
    const screenshot = await automation.captureScreenshot(tabId);
    return { success: true, screenshot };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleExecuteBrowserAction(action, tabId) {
  try {
    const automation = new BrowserAutomation();
    if (tabId) {
      automation.currentTabId = tabId;
    }

    const result = await automation.executeAction(action);
    return { success: result.success !== false, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleAutonomousBrowserTask(task) {
  try {
    const agentInstance = await initAgent();
    const taskId = await agentInstance.addTask({
      type: 'autonomous_browser_task',
      ...task
    });
    return { success: true, taskId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Функции для работы с агентом
async function handleAgentTask(task) {
  try {
    const agentInstance = await initAgent();
    const taskId = await agentInstance.addTask(task);
    return { success: true, taskId };
  } catch (error) {
    console.error('Ошибка добавления задачи агента:', error);
    return { success: false, error: error.message };
  }
}

async function handleAgentStatus() {
  try {
    const agentInstance = await initAgent();
    const stats = agentInstance.getStats();
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleAgentStop() {
  try {
    if (agent) {
      agent.stop();
      return { success: true };
    }

    return { success: false, error: 'Агент не инициализирован' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleAgentClear() {
  try {
    if (agent) {
      agent.clearHistory();
      return { success: true };
    }

    return { success: false, error: 'Агент не инициализирован' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleAgentHistory() {
  try {
    const agentInstance = await initAgent();
    return {
      success: true,
      history: {
        visitedUrls: Array.from(agentInstance.context.visitedUrls),
        downloadedFiles: agentInstance.context.downloadedFiles,
        analysisResults: agentInstance.context.analysisResults
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Обработка запросов к Gemma 3 12B
async function handleGemmaRequest(message, accessToken) {
  try {
    const { gemmaApiUrl } = await chrome.storage.local.get([
      'gemmaApiUrl'
    ]);
    const apiUrl = gemmaApiUrl || DEFAULT_Gemma_API_URL;

    const isOllama =
      apiUrl.includes('localhost:11435') ||
      apiUrl.includes('localhost:11434') ||
      apiUrl.includes('127.0.0.1:11435');

    const { selectedModel } = await chrome.storage.local.get([
      'selectedModel'
    ]);
    const modelName = selectedModel || 'gemma3:12b';

    let response;
    let data;

    if (isOllama) {
      response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'user',
              content: message
            }
          ],
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      data = await response.json();
    } else {
      response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gemma-3-12b',
          messages: [
            {
              role: 'user',
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      data = await response.json();
    }

    // Обработка ответа
    let text = 'Нет ответа от модели';

    if (isOllama) {
      if (data.message && data.message.content) {
        text = data.message.content;
      } else if (data.response) {
        text = data.response;
      }
    } else {
      if (data.choices && data.choices[0]) {
        text =
          data.choices[0].message?.content ||
          data.choices[0].text ||
          text;
      } else if (data.response) {
        text = data.response;
      } else if (data.content) {
        text = data.content;
      }
    }

    // Извлечь ссылки из ответа
    const links = extractLinks(text);

    // Если есть ссылки и подключен Google Drive, можно скачать контент
    if (links.length > 0 && accessToken) {
      // Здесь можно добавить логику авто‑скачивания
    }

    return { text, links };
  } catch (error) {
    console.error('Ошибка запроса к Gemma:', error);
    return {
      text: `Ошибка подключения к модели: ${error.message}. Убедитесь, что модель Gemma 3 12B запущена на ${apiUrl}`,
      links: []
    };
  }
}

// Извлечение ссылок из текста
function extractLinks(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

// Обработка загрузки файлов
async function handleFileUpload(
  fileName,
  fileData,
  fileType,
  accessToken
) {
  try {
    if (accessToken) {
      return await uploadToGoogleDrive(
        fileName,
        fileData,
        fileType,
        accessToken
      );
    }

    // Иначе просто считаем, что файл получен
    return {
      success: true,
      message: 'Файл получен'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Загрузка файла на Google Drive
async function uploadToGoogleDrive(
  fileName,
  fileData,
  fileType,
  accessToken
) {
  try {
    const base64Data = fileData.split(',')[1];
    const binaryData = Uint8Array.from(atob(base64Data), c =>
      c.charCodeAt(0)
    );

    const metadata = {
      name: fileName,
      mimeType: fileType
    };

    const createResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': fileType,
          'X-Upload-Content-Length': binaryData.length.toString()
        },
        body: JSON.stringify(metadata)
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(
        `Ошибка создания файла на Google Drive: ${createResponse.status} - ${errorText}`
      );
    }

    const uploadUrl = createResponse.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('Не получен URL для загрузки');
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': fileType,
        'Content-Length': binaryData.length.toString()
      },
      body: binaryData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(
        `Ошибка загрузки данных на Google Drive: ${uploadResponse.status} - ${errorText}`
      );
    }

    const result = await uploadResponse.json();
    const fileUrl = `https://drive.google.com/file/d/${result.id}/view`;

    return {
      success: true,
      driveUrl: fileUrl,
      fileId: result.id
    };
  } catch (error) {
    console.error('Ошибка загрузки на Google Drive:', error);
    throw error;
  }
}

// Открытие ссылки в боковой панели
async function handleOpenInPanel(url) {
  try {
    if (chrome.sidePanel) {
      await chrome.sidePanel.setOptions({
        path: 'panel.html',
        enabled: true
      });

      const currentWindow = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: currentWindow.id });

      setTimeout(async () => {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true
        });

        if (tabs[0]) {
          chrome.tabs
            .sendMessage(tabs[0].id, {
              type: 'loadUrl',
              url: url
            })
            .catch(() => {
              chrome.tabs.create({ url: url });
            });
        }
      }, 500);
    } else {
      chrome.tabs.create({ url: url });
    }
  } catch (error) {
    console.error('Ошибка открытия панели:', error);
    chrome.tabs.create({ url: url });
  }
}

// Обработка установки расширения
chrome.runtime.onInstalled.addListener(() => {
  console.log('Gemma AI Assistant установлен');
  chrome.storage.local.set({
    gemmaApiUrl: DEFAULT_Gemma_API_URL
  });
  initAgent();
});

// Инициализировать агента при запуске
chrome.runtime.onStartup.addListener(() => {
  initAgent();
});
