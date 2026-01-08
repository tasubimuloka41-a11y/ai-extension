// Система автономного управления браузером с захватом экрана

class BrowserAutomation {
  constructor() {
    this.currentTabId = null;
    this.screenshotHistory = [];
    this.actionHistory = [];
    this.maxScreenshots = 50; // Ограничение истории скриншотов
  }

  // Захват экрана текущей вкладки
  async captureScreenshot(tabId = null) {
    try {
      if (!tabId) {
        // Получить активную вкладку
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
          throw new Error('Нет активной вкладки');
        }
        tabId = tabs[0].id;
      }

      this.currentTabId = tabId;

      // Захватить видимую область вкладки
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 100
      });

      const screenshot = {
        tabId: tabId,
        dataUrl: dataUrl,
        timestamp: new Date().toISOString(),
        url: (await chrome.tabs.get(tabId)).url
      };

      // Сохранить в историю
      this.screenshotHistory.push(screenshot);
      if (this.screenshotHistory.length > this.maxScreenshots) {
        this.screenshotHistory.shift();
      }

      return screenshot;
    } catch (error) {
      console.error('Ошибка захвата экрана:', error);
      throw error;
    }
  }

  // Анализ скриншота с помощью AI (vision)
  async analyzeScreenshot(screenshot, prompt = 'Опиши, что видно на экране. Определи интерактивные элементы (кнопки, поля ввода, ссылки) и их расположение.') {
    try {
      const { gemmaApiUrl } = await chrome.storage.local.get(['gemmaApiUrl']);
      const apiUrl = gemmaApiUrl || 'http://localhost:8000';

      // Конвертировать data URL в base64
      const base64Image = screenshot.dataUrl.split(',')[1];

      // Отправить запрос с изображением
      const response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemma-3-12b',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: screenshot.dataUrl
                  }
                }
              ]
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      let analysis = 'Анализ недоступен';
      
      if (data.choices && data.choices[0]) {
        analysis = data.choices[0].message?.content || analysis;
      } else if (data.response) {
        analysis = data.response;
      }

      return {
        analysis,
        screenshot,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Ошибка анализа скриншота:', error);
      // Fallback: попробовать без vision, только с текстовым описанием
      return {
        analysis: `Ошибка vision анализа: ${error.message}. Попробуйте использовать текстовый анализ страницы.`,
        screenshot,
        error: error.message
      };
    }
  }

  // Выполнить действие на странице
  async executeAction(action) {
    try {
      if (!this.currentTabId) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
          throw new Error('Нет активной вкладки');
        }
        this.currentTabId = tabs[0].id;
      }

      const result = await chrome.scripting.executeScript({
        target: { tabId: this.currentTabId },
        func: (action) => {
          return executeBrowserAction(action);
        },
        args: [action]
      });

      const actionResult = {
        action,
        result: result[0].result,
        timestamp: new Date().toISOString(),
        success: result[0].result.success !== false
      };

      this.actionHistory.push(actionResult);
      
      // Небольшая задержка после действия
      await this.sleep(500);

      return actionResult;
    } catch (error) {
      console.error('Ошибка выполнения действия:', error);
      return {
        action,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Клик по координатам или селектору
  async click(selectorOrCoords, options = {}) {
    const action = {
      type: 'click',
      target: selectorOrCoords,
      options
    };
    return await this.executeAction(action);
  }

  // Ввод текста
  async typeText(selector, text, options = {}) {
    const action = {
      type: 'type',
      selector,
      text,
      options
    };
    return await this.executeAction(action);
  }

  // Навигация
  async navigate(url) {
    if (!this.currentTabId) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new Error('Нет активной вкладки');
      }
      this.currentTabId = tabs[0].id;
    }

    await chrome.tabs.update(this.currentTabId, { url });
    await this.waitForPageLoad(this.currentTabId);
    return { success: true, url };
  }

  // Скролл
  async scroll(direction = 'down', amount = 500) {
    const action = {
      type: 'scroll',
      direction,
      amount
    };
    return await this.executeAction(action);
  }

  // Ожидание загрузки страницы
  async waitForPageLoad(tabId, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const listener = (updatedTabId, info) => {
        if (updatedTabId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        } else if (Date.now() - startTime > timeout) {
          chrome.tabs.onUpdated.removeListener(listener);
          reject(new Error('Timeout ожидания загрузки'));
        }
      };
      
      chrome.tabs.onUpdated.addListener(listener);
      
      chrome.tabs.get(tabId).then(tab => {
        if (tab.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });
  }

  // Получить информацию о странице
  async getPageInfo(tabId = null) {
    if (!tabId) {
      tabId = this.currentTabId;
    }
    if (!tabId) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new Error('Нет активной вкладки');
      }
      tabId = tabs[0].id;
    }

    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return {
          title: document.title,
          url: window.location.href,
          elements: {
            buttons: Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')).map((el, i) => ({
              index: i,
              text: el.textContent.trim() || el.value || el.ariaLabel || '',
              selector: generateSelector(el),
              bounds: el.getBoundingClientRect()
            })),
            inputs: Array.from(document.querySelectorAll('input, textarea, select')).map((el, i) => ({
              index: i,
              type: el.type || el.tagName.toLowerCase(),
              placeholder: el.placeholder || '',
              name: el.name || '',
              selector: generateSelector(el),
              bounds: el.getBoundingClientRect()
            })),
            links: Array.from(document.querySelectorAll('a[href]')).slice(0, 20).map((el, i) => ({
              index: i,
              text: el.textContent.trim(),
              href: el.href,
              selector: generateSelector(el),
              bounds: el.getBoundingClientRect()
            }))
          }
        };
      }
    });

    return result[0].result;
  }

  // Автономное выполнение задачи с vision
  async executeAutonomousTask(task) {
    const steps = [];
    
    try {
      // 1. Захватить экран
      const screenshot = await this.captureScreenshot();
      steps.push({ type: 'screenshot', data: screenshot });

      // 2. Проанализировать с AI
      const analysis = await this.analyzeScreenshot(screenshot, task.prompt || 'Проанализируй экран и определи, какие действия нужно выполнить для выполнения задачи.');
      steps.push({ type: 'analysis', data: analysis });

      // 3. Получить информацию о странице
      const pageInfo = await this.getPageInfo();
      steps.push({ type: 'pageInfo', data: pageInfo });

      // 4. Определить действия на основе анализа
      const actions = await this.determineActions(task, analysis, pageInfo);
      steps.push({ type: 'actions', data: actions });

      // 5. Выполнить действия
      const results = [];
      for (const action of actions) {
        const result = await this.executeAction(action);
        results.push(result);
        steps.push({ type: 'action_result', data: result });

        // Захватить экран после действия для проверки результата
        await this.sleep(1000);
        const newScreenshot = await this.captureScreenshot();
        const newAnalysis = await this.analyzeScreenshot(newScreenshot, 'Проверь, изменилось ли что-то на экране после действия.');
        steps.push({ type: 'verification', data: { screenshot: newScreenshot, analysis: newAnalysis } });
      }

      return {
        success: true,
        steps,
        results,
        finalScreenshot: await this.captureScreenshot()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        steps
      };
    }
  }

  // Определить действия на основе анализа
  async determineActions(task, analysis, pageInfo) {
    // Использовать AI для определения действий
    const { gemmaApiUrl } = await chrome.storage.local.get(['gemmaApiUrl']);
    const apiUrl = gemmaApiUrl || 'http://localhost:8000';

    const prompt = `На основе анализа экрана определи последовательность действий для выполнения задачи: "${task.description || task.goal}"

Анализ экрана: ${analysis.analysis}

Доступные элементы на странице:
Кнопки: ${JSON.stringify(pageInfo.elements.buttons.map(b => ({ text: b.text, selector: b.selector })))}
Поля ввода: ${JSON.stringify(pageInfo.elements.inputs.map(i => ({ type: i.type, placeholder: i.placeholder, name: i.name, selector: i.selector })))}
Ссылки: ${JSON.stringify(pageInfo.elements.links.map(l => ({ text: l.text, href: l.href, selector: l.selector })))}

Верни JSON массив действий в формате:
[
  {"type": "click", "selector": "селектор элемента"},
  {"type": "type", "selector": "селектор поля", "text": "текст для ввода"},
  {"type": "scroll", "direction": "down", "amount": 500},
  {"type": "wait", "duration": 2000}
]`;

    try {
      const response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemma-3-12b',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      let actionsText = data.choices?.[0]?.message?.content || data.response || '[]';
      
      // Извлечь JSON из ответа
      const jsonMatch = actionsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        actionsText = jsonMatch[0];
      }

      const actions = JSON.parse(actionsText);
      return Array.isArray(actions) ? actions : [];
    } catch (error) {
      console.error('Ошибка определения действий:', error);
      // Fallback: простые действия на основе задачи
      return this.generateFallbackActions(task, pageInfo);
    }
  }

  // Генерация простых действий (fallback)
  generateFallbackActions(task, pageInfo) {
    const actions = [];
    
    // Если есть поле поиска, ввести текст
    if (task.searchText) {
      const searchInput = pageInfo.elements.inputs.find(i => 
        i.type === 'text' || i.type === 'search' || i.placeholder.toLowerCase().includes('search')
      );
      if (searchInput) {
        actions.push({
          type: 'type',
          selector: searchInput.selector,
          text: task.searchText
        });
      }
    }

    // Если есть кнопка отправки, кликнуть
    const submitButton = pageInfo.elements.buttons.find(b => 
      b.text.toLowerCase().includes('submit') || 
      b.text.toLowerCase().includes('search') ||
      b.text.toLowerCase().includes('отправить') ||
      b.text.toLowerCase().includes('найти')
    );
    if (submitButton) {
      actions.push({
        type: 'click',
        selector: submitButton.selector
      });
    }

    return actions;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Функция для выполнения в контексте страницы
function executeBrowserAction(action) {
  try {
    switch (action.type) {
      case 'click':
        if (typeof action.target === 'string') {
          // Селектор
          const element = document.querySelector(action.target);
          if (element) {
            element.click();
            return { success: true, element: action.target };
          } else {
            return { success: false, error: 'Элемент не найден', selector: action.target };
          }
        } else if (action.target.x !== undefined && action.target.y !== undefined) {
          // Координаты
          const element = document.elementFromPoint(action.target.x, action.target.y);
          if (element) {
            element.click();
            return { success: true, coordinates: action.target };
          } else {
            return { success: false, error: 'Элемент не найден по координатам' };
          }
        }
        break;

      case 'type':
        const inputElement = document.querySelector(action.selector);
        if (inputElement) {
          inputElement.focus();
          inputElement.value = action.text;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          inputElement.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, selector: action.selector, text: action.text };
        } else {
          return { success: false, error: 'Поле ввода не найдено', selector: action.selector };
        }
        break;

      case 'scroll':
        const scrollAmount = action.amount || 500;
        if (action.direction === 'down') {
          window.scrollBy(0, scrollAmount);
        } else if (action.direction === 'up') {
          window.scrollBy(0, -scrollAmount);
        } else if (action.direction === 'left') {
          window.scrollBy(-scrollAmount, 0);
        } else if (action.direction === 'right') {
          window.scrollBy(scrollAmount, 0);
        }
        return { success: true, direction: action.direction, amount: scrollAmount };
        break;

      case 'wait':
        // Ожидание обрабатывается на уровне агента
        return { success: true, duration: action.duration };
        break;

      default:
        return { success: false, error: `Неизвестный тип действия: ${action.type}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Генерация селектора для элемента
function generateSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className) {
    const classes = element.className.split(' ').filter(c => c).join('.');
    if (classes) {
      return `${element.tagName.toLowerCase()}.${classes}`;
    }
  }
  
  // XPath как fallback
  const path = [];
  while (element && element.nodeType === Node.ELEMENT_NODE) {
    let selector = element.tagName.toLowerCase();
    if (element.id) {
      path.unshift(`#${element.id}`);
      break;
    }
    if (element.className) {
      selector += `.${element.className.split(' ').filter(c => c)[0]}`;
    }
    path.unshift(selector);
    element = element.parentElement;
  }
  
  return path.join(' > ') || element.tagName.toLowerCase();
}

// Экспорт для использования в background.js
if (typeof window === 'undefined') {
  // В service worker контексте
}

