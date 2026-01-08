// Автономный агент для выполнения задач

class AutonomousAgent {
  constructor() {
    this.taskQueue = [];
    this.isRunning = false;
    this.currentTask = null;
    this.context = {
      visitedUrls: new Set(),
      downloadedFiles: [],
      analysisResults: [],
      conversationHistory: []
    };
    this.maxDepth = 5; // Максимальная глубина переходов по ссылкам
    this.currentDepth = 0;
    this.browserAutomation = null; // Инициализируется при первом использовании
    this.memory = null; // Система памяти
    this.learningEnabled = true; // Включено ли обучение
  }

  // Инициализация памяти
  async initMemory() {
    if (!this.memory) {
      if (typeof AgentMemory !== 'undefined') {
        this.memory = new AgentMemory();
        await this.memory.init();
      } else {
        console.warn('AgentMemory не загружен, обучение отключено');
      }
    }
    return this.memory;
  }

  // Инициализация browser automation
  async initBrowserAutomation() {
    if (!this.browserAutomation) {
      // BrowserAutomation должен быть загружен через importScripts в background.js
      if (typeof BrowserAutomation !== 'undefined') {
        this.browserAutomation = new BrowserAutomation();
      } else {
        throw new Error('BrowserAutomation не загружен. Убедитесь, что browser-automation.js загружен в background.js');
      }
    }
    return this.browserAutomation;
  }

  // Добавить задачу в очередь
  async addTask(task) {
    const taskWithId = {
      id: Date.now() + Math.random(),
      ...task,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    this.taskQueue.push(taskWithId);
    await this.saveState();
    
    if (!this.isRunning) {
      this.start();
    }
    
    return taskWithId.id;
  }

  // Запустить выполнение задач
  async start() {
    if (this.isRunning) return;
    
    // Инициализировать память
    await this.initMemory();
    
    // Восстановить состояние из памяти
    await this.restoreStateFromMemory();
    
    this.isRunning = true;
    console.log('🤖 Автономный агент запущен');
    
    while (this.taskQueue.length > 0 && this.isRunning) {
      const task = this.taskQueue.shift();
      this.currentTask = task;
      
      const startTime = Date.now();
      
      try {
        task.status = 'running';
        await this.saveState();
        
        // Получить знания из памяти для улучшения выполнения
        let knowledge = null;
        if (this.memory && this.learningEnabled) {
          knowledge = await this.memory.getKnowledgeForTask(task);
          console.log('📚 Использование знаний из памяти:', knowledge);
        }
        
        // Выполнить задачу с использованием знаний
        const result = await this.executeTask(task, knowledge);
        result.executionTime = Date.now() - startTime;
        
        task.status = 'completed';
        task.result = result;
        task.completedAt = new Date().toISOString();
        
        // Сохранить опыт в память для обучения
        if (this.memory && this.learningEnabled) {
          await this.memory.saveExperience(task, result, {
            pageInfo: result.pageInfo,
            visitedUrls: Array.from(this.context.visitedUrls)
          });
          console.log('💾 Опыт сохранен в память');
        }
        
        // Если задача порождает новые задачи, добавить их
        if (result.nextTasks && result.nextTasks.length > 0) {
          for (const nextTask of result.nextTasks) {
            await this.addTask(nextTask);
          }
        }
        
      } catch (error) {
        console.error('Ошибка выполнения задачи:', error);
        task.status = 'failed';
        task.error = error.message;
        
        // Сохранить неудачный опыт для обучения
        if (this.memory && this.learningEnabled) {
          await this.memory.saveExperience(task, {
            success: false,
            error: error.message,
            executionTime: Date.now() - startTime
          }, {
            visitedUrls: Array.from(this.context.visitedUrls)
          });
        }
      }
      
      await this.saveState();
      await this.saveStateToMemory();
      this.currentTask = null;
      
      // Небольшая задержка между задачами
      await this.sleep(1000);
    }
    
    this.isRunning = false;
    await this.saveStateToMemory();
    console.log('🤖 Автономный агент остановлен');
  }

  // Остановить выполнение
  stop() {
    this.isRunning = false;
  }

  // Выполнить задачу
  async executeTask(task, knowledge = null) {
    console.log(`Выполнение задачи: ${task.type}`, task);
    if (knowledge) {
      console.log('📚 Используются знания из памяти');
    }
    
    switch (task.type) {
      case 'analyze_url':
        return await this.analyzeUrl(task.url, task.options);
      
      case 'follow_links':
        return await this.followLinks(task.startUrl, task.maxLinks, task.depth);
      
      case 'download_file':
        return await this.downloadFile(task.url, task.options);
      
      case 'search_and_analyze':
        return await this.searchAndAnalyze(task.query, task.options);
      
      case 'extract_data':
        return await this.extractData(task.url, task.selectors);
      
      case 'chain':
        return await this.executeChain(task.tasks);
      
      case 'autonomous_browser_task':
        return await this.executeAutonomousBrowserTask(task);
      
      default:
        throw new Error(`Неизвестный тип задачи: ${task.type}`);
    }
  }

  // Выполнить автономную задачу в браузере
  async executeAutonomousBrowserTask(task, knowledge = null) {
    try {
      const automation = await this.initBrowserAutomation();
      if (!automation) {
        throw new Error('Browser automation не инициализирован');
      }

      // Если указан URL, перейти на него
      if (task.url) {
        await automation.navigate(task.url);
        await this.sleep(2000); // Подождать загрузки
      }

      // Использовать знания из памяти для улучшения промпта
      let enhancedPrompt = task.prompt || `Выполни следующую задачу на веб-странице: ${task.description || task.goal}. Проанализируй экран, определи необходимые действия и выполни их.`;
      
      if (knowledge && knowledge.recommendedActions && knowledge.recommendedActions.length > 0) {
        enhancedPrompt += `\n\nРекомендации на основе прошлого опыта:\n`;
        knowledge.recommendedActions.forEach((rec, i) => {
          enhancedPrompt += `${i + 1}. Попробуй ${rec.type}${rec.selector ? ` на элемент ${rec.selector}` : ''} (уверенность: ${(rec.confidence * 100).toFixed(0)}%)\n`;
        });
      }
      
      if (knowledge && knowledge.commonMistakes && knowledge.commonMistakes.length > 0) {
        enhancedPrompt += `\n\nИзбегай следующих ошибок:\n`;
        knowledge.commonMistakes.slice(0, 3).forEach((mistake, i) => {
          enhancedPrompt += `${i + 1}. ${mistake.action} (ошибка ${mistake.count} раз)\n`;
        });
      }

      // Выполнить автономную задачу
      const result = await automation.executeAutonomousTask({
        description: task.description || task.goal,
        goal: task.goal,
        prompt: enhancedPrompt,
        searchText: task.searchText,
        actions: task.actions,
        knowledge: knowledge // Передать знания в автоматизацию
      });

      // Сохранить скриншоты в контекст
      if (result.finalScreenshot) {
        this.context.analysisResults.push({
          type: 'autonomous_task',
          task: task.description || task.goal,
          screenshot: result.finalScreenshot.dataUrl,
          steps: result.steps,
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: result.success,
        result,
        message: result.success ? 'Задача выполнена успешно' : `Ошибка: ${result.error}`
      };
    } catch (error) {
      console.error('Ошибка выполнения автономной задачи:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Анализ URL
  async analyzeUrl(url, options = {}) {
    if (this.context.visitedUrls.has(url)) {
      return { message: 'URL уже посещен', url, skipped: true };
    }
    
    this.context.visitedUrls.add(url);
    
    try {
      // Открыть страницу в фоновой вкладке
      const tab = await chrome.tabs.create({ url, active: false });
      
      // Дождаться загрузки
      await this.waitForTabLoad(tab.id);
      
      // Получить содержимое страницы
      const pageContent = await this.getPageContent(tab.id);
      
      // Отправить на анализ в модель
      const analysis = await this.analyzeWithAI(pageContent, url, options);
      
      // Извлечь ссылки
      const links = await this.extractLinksFromTab(tab.id);
      
      // Закрыть вкладку
      await chrome.tabs.remove(tab.id);
      
      const result = {
        url,
        title: pageContent.title,
        content: pageContent.text.substring(0, 5000), // Ограничение длины
        links: links.slice(0, 20), // Первые 20 ссылок
        analysis,
        timestamp: new Date().toISOString()
      };
      
      this.context.analysisResults.push(result);
      
      return {
        success: true,
        result,
        nextTasks: options.autoFollow ? links.slice(0, options.maxFollow || 5).map(link => ({
          type: 'analyze_url',
          url: link.url,
          options: { ...options, depth: (options.depth || 0) + 1 }
        })) : []
      };
      
    } catch (error) {
      console.error(`Ошибка анализа URL ${url}:`, error);
      return { success: false, error: error.message, url };
    }
  }

  // Переход по ссылкам
  async followLinks(startUrl, maxLinks = 10, depth = 0) {
    if (depth >= this.maxDepth) {
      return { message: 'Достигнута максимальная глубина', depth };
    }
    
    const result = await this.analyzeUrl(startUrl, {
      autoFollow: true,
      maxFollow: maxLinks,
      depth
    });
    
    return result;
  }

  // Скачать файл
  async downloadFile(url, options = {}) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const fileName = options.fileName || this.extractFileName(url, response);
      
      // Конвертировать в base64
      const base64 = await this.blobToBase64(blob);
      
      // Если подключен Google Drive, загрузить туда
      const { driveAccessToken } = await chrome.storage.local.get(['driveAccessToken']);
      
      if (driveAccessToken && options.saveToDrive !== false) {
        const uploadResult = await this.uploadToDrive(fileName, base64, blob.type, driveAccessToken);
        
        this.context.downloadedFiles.push({
          url,
          fileName,
          driveUrl: uploadResult.driveUrl,
          timestamp: new Date().toISOString()
        });
        
        return {
          success: true,
          fileName,
          driveUrl: uploadResult.driveUrl,
          size: blob.size
        };
      } else {
        // Сохранить информацию о файле
        this.context.downloadedFiles.push({
          url,
          fileName,
          size: blob.size,
          timestamp: new Date().toISOString()
        });
        
        return {
          success: true,
          fileName,
          size: blob.size,
          data: base64.substring(0, 100) + '...' // Только превью
        };
      }
      
    } catch (error) {
      console.error(`Ошибка скачивания файла ${url}:`, error);
      return { success: false, error: error.message, url };
    }
  }

  // Поиск и анализ
  async searchAndAnalyze(query, options = {}) {
    // Использовать поисковую систему (например, DuckDuckGo или Google)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const tab = await chrome.tabs.create({ url: searchUrl, active: false });
    await this.waitForTabLoad(tab.id);
    
    const pageContent = await this.getPageContent(tab.id);
    const links = await this.extractLinksFromTab(tab.id);
    
    // Фильтровать ссылки результатов поиска
    const resultLinks = links.filter(link => 
      !link.url.includes('duckduckgo.com') && 
      !link.url.includes('javascript:')
    ).slice(0, options.maxResults || 5);
    
    await chrome.tabs.remove(tab.id);
    
    // Создать задачи для анализа результатов
    const nextTasks = resultLinks.map(link => ({
      type: 'analyze_url',
      url: link.url,
      options: { depth: 0 }
    }));
    
    return {
      success: true,
      query,
      results: resultLinks,
      nextTasks
    };
  }

  // Извлечь данные со страницы
  async extractData(url, selectors = {}) {
    const tab = await chrome.tabs.create({ url, active: false });
    await this.waitForTabLoad(tab.id);
    
    try {
      const extracted = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (selectors) => {
          const data = {};
          
          if (selectors.title) {
            data.title = document.title;
          }
          
          if (selectors.text) {
            data.text = document.body.innerText;
          }
          
          if (selectors.links) {
            data.links = Array.from(document.querySelectorAll('a[href]'))
              .map(a => ({ url: a.href, text: a.textContent.trim() }));
          }
          
          if (selectors.images) {
            data.images = Array.from(document.querySelectorAll('img[src]'))
              .map(img => ({ url: img.src, alt: img.alt }));
          }
          
          if (selectors.custom) {
            data.custom = {};
            for (const [key, selector] of Object.entries(selectors.custom)) {
              const elements = document.querySelectorAll(selector);
              data.custom[key] = Array.from(elements).map(el => el.textContent.trim());
            }
          }
          
          return data;
        },
        args: [selectors]
      });
      
      await chrome.tabs.remove(tab.id);
      
      return {
        success: true,
        url,
        data: extracted[0].result,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      await chrome.tabs.remove(tab.id);
      throw error;
    }
  }

  // Выполнить цепочку задач
  async executeChain(tasks) {
    const results = [];
    
    for (const task of tasks) {
      const result = await this.executeTask(task);
      results.push(result);
      
      // Если задача провалилась и требуется остановка
      if (!result.success && task.stopOnError) {
        break;
      }
    }
    
    return {
      success: true,
      results,
      completed: results.filter(r => r.success).length,
      total: tasks.length
    };
  }

  // Вспомогательные методы
  async waitForTabLoad(tabId, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const listener = (updatedTabId, info) => {
        if (updatedTabId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        } else if (Date.now() - startTime > timeout) {
          chrome.tabs.onUpdated.removeListener(listener);
          reject(new Error('Timeout ожидания загрузки вкладки'));
        }
      };
      
      chrome.tabs.onUpdated.addListener(listener);
      
      // Проверить текущее состояние
      chrome.tabs.get(tabId).then(tab => {
        if (tab.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });
  }

  async getPageContent(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return {
          title: document.title,
          url: window.location.href,
          text: document.body.innerText,
          html: document.documentElement.outerHTML.substring(0, 50000) // Ограничение
        };
      }
    });
    
    return results[0].result;
  }

  async extractLinksFromTab(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => ({
            url: a.href,
            text: a.textContent.trim(),
            title: a.title
          }))
          .filter(link => link.url.startsWith('http'));
      }
    });
    
    return results[0].result || [];
  }

  async analyzeWithAI(content, url, options = {}) {
    const { gemmaApiUrl } = await chrome.storage.local.get(['gemmaApiUrl']);
    const apiUrl = gemmaApiUrl || 'http://localhost:8000';
    
    const prompt = options.prompt || `Проанализируй содержимое веб-страницы:
URL: ${url}
Заголовок: ${content.title}
Текст: ${content.text.substring(0, 3000)}

Предоставь краткий анализ: основная тема, ключевые моменты, полезная информация.`;

    try {
      const response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemma-3-12b',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || data.response || 'Анализ недоступен';
      
    } catch (error) {
      console.error('Ошибка анализа с AI:', error);
      return `Ошибка анализа: ${error.message}`;
    }
  }

  extractFileName(url, response) {
    // Попытаться получить имя из Content-Disposition
    const contentDisposition = response.headers.get('Content-Disposition');
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+?)"?$/i);
      if (match) return match[1];
    }
    
    // Или из URL
    const urlPath = new URL(url).pathname;
    const fileName = urlPath.split('/').pop();
    return fileName || 'download';
  }

  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async uploadToDrive(fileName, fileData, fileType, accessToken) {
    const base64Data = fileData.split(',')[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    const metadata = { name: fileName, mimeType: fileType };

    const createResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': fileType,
        'X-Upload-Content-Length': binaryData.length.toString()
      },
      body: JSON.stringify(metadata)
    });

    if (!createResponse.ok) {
      throw new Error(`Ошибка создания файла: ${createResponse.status}`);
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
      throw new Error(`Ошибка загрузки: ${uploadResponse.status}`);
    }

    const result = await uploadResponse.json();
    return {
      driveUrl: `https://drive.google.com/file/d/${result.id}/view`,
      fileId: result.id
    };
  }

  async saveState() {
    await chrome.storage.local.set({
      agentState: {
        taskQueue: this.taskQueue,
        context: {
          visitedUrls: Array.from(this.context.visitedUrls),
          downloadedFiles: this.context.downloadedFiles,
          analysisResults: this.context.analysisResults
        },
        isRunning: this.isRunning,
        currentTask: this.currentTask,
        savedAt: new Date().toISOString()
      }
    });
  }

  async loadState() {
    const { agentState } = await chrome.storage.local.get(['agentState']);
    if (agentState) {
      this.taskQueue = agentState.taskQueue || [];
      this.context.visitedUrls = new Set(agentState.context?.visitedUrls || []);
      this.context.downloadedFiles = agentState.context?.downloadedFiles || [];
      this.context.analysisResults = agentState.context?.analysisResults || [];
      this.isRunning = agentState.isRunning || false;
      this.currentTask = agentState.currentTask || null;
    }
  }

  // Сохранить состояние в память
  async saveStateToMemory() {
    if (this.memory) {
      await this.memory.saveAgentState({
        taskQueue: this.taskQueue,
        context: {
          visitedUrls: Array.from(this.context.visitedUrls),
          downloadedFiles: this.context.downloadedFiles,
          analysisResults: this.context.analysisResults.length // Только количество для экономии места
        },
        isRunning: this.isRunning,
        currentTask: this.currentTask ? {
          type: this.currentTask.type,
          description: this.currentTask.description,
          status: this.currentTask.status
        } : null
      });
    }
  }

  // Восстановить состояние из памяти
  async restoreStateFromMemory() {
    if (this.memory) {
      const savedState = await this.memory.loadAgentState();
      if (savedState) {
        console.log('🔄 Восстановление состояния из памяти...');
        
        // Восстановить очередь задач, если она была сохранена
        if (savedState.taskQueue && savedState.taskQueue.length > 0) {
          // Восстановить только незавершенные задачи
          const pendingTasks = savedState.taskQueue.filter(
            task => task.status === 'pending' || task.status === 'running'
          );
          if (pendingTasks.length > 0) {
            this.taskQueue = [...this.taskQueue, ...pendingTasks];
            console.log(`📋 Восстановлено ${pendingTasks.length} задач из памяти`);
          }
        }
        
        // Восстановить контекст
        if (savedState.context) {
          if (savedState.context.visitedUrls) {
            savedState.context.visitedUrls.forEach(url => 
              this.context.visitedUrls.add(url)
            );
          }
          if (savedState.context.downloadedFiles) {
            this.context.downloadedFiles = [
              ...this.context.downloadedFiles,
              ...savedState.context.downloadedFiles
            ];
          }
        }
        
        console.log('✅ Состояние восстановлено из памяти');
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Получить статистику
  getStats() {
    return {
      queueLength: this.taskQueue.length,
      isRunning: this.isRunning,
      visitedUrls: this.context.visitedUrls.size,
      downloadedFiles: this.context.downloadedFiles.length,
      analysisResults: this.context.analysisResults.length,
      currentTask: this.currentTask
    };
  }

  // Очистить историю
  clearHistory() {
    this.context.visitedUrls.clear();
    this.context.downloadedFiles = [];
    this.context.analysisResults = [];
    this.saveState();
  }
}

// Класс доступен глобально для importScripts

