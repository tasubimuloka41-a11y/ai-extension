// Автоматизация работы с Google Colab

class ColabAutomation {
  constructor() {
    this.colabUrl = 'https://colab.research.google.com/';
  }

  // Открыть Colab и создать новый ноутбук
  async openColab() {
    try {
      const tab = await chrome.tabs.create({
        url: this.colabUrl,
        active: true
      });
      return { success: true, tabId: tab.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Добавить ячейку с кодом в Colab
  async addCodeCell(tabId, code) {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: (code) => {
          // Найти кнопку добавления ячейки кода
          const addCodeButton = document.querySelector('[aria-label="Add code cell"], .add-code-cell, [data-tooltip="Add code cell"]');
          if (addCodeButton) {
            addCodeButton.click();
            
            // Подождать появления новой ячейки
            setTimeout(() => {
              const cells = document.querySelectorAll('.cell');
              const lastCell = cells[cells.length - 1];
              if (lastCell) {
                const textarea = lastCell.querySelector('textarea, .CodeMirror textarea');
                if (textarea) {
                  textarea.focus();
                  textarea.value = code;
                  textarea.dispatchEvent(new Event('input', { bubbles: true }));
                  
                  // Найти кнопку выполнения
                  const runButton = lastCell.querySelector('[aria-label="Run cell"], .run-cell');
                  if (runButton) {
                    runButton.click();
                  }
                }
              }
            }, 500);
            
            return { success: true };
          }
          return { success: false, error: 'Кнопка добавления ячейки не найдена' };
        },
        args: [code]
      });
      
      return result[0].result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Выполнить код в Colab через AI
  async executeCodeViaAI(code, taskDescription) {
    try {
      // Получить API URL
      const { gemmaApiUrl } = await chrome.storage.local.get(['gemmaApiUrl']);
      const apiUrl = gemmaApiUrl || 'http://localhost:11435';
      
      // Получить выбранную модель
      const { selectedModel } = await chrome.storage.local.get(['selectedModel']);
      const modelName = selectedModel || 'gemma3:12b';
      
      // Проверить, это Ollama или другой API
      const isOllama = apiUrl.includes('localhost:11435') || apiUrl.includes('localhost:11434');
      
      const prompt = `Напиши Python код для Google Colab для следующей задачи: ${taskDescription}

${code ? `Используй этот код как основу:\n\`\`\`python\n${code}\n\`\`\`` : ''}

Верни только код Python без объяснений, готовый для выполнения в Colab.`;

      let response;
      if (isOllama) {
        response = await fetch(`${apiUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            stream: false
          })
        });
      } else {
        response = await fetch(`${apiUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gemma-3-12b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2000
          })
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      let generatedCode = '';
      
      if (isOllama) {
        generatedCode = data.message?.content || data.response || '';
      } else {
        generatedCode = data.choices?.[0]?.message?.content || data.response || '';
      }

      // Извлечь код из markdown блоков если есть
      const codeMatch = generatedCode.match(/```(?:python)?\n([\s\S]*?)```/);
      if (codeMatch) {
        generatedCode = codeMatch[1];
      }

      return { success: true, code: generatedCode };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Автоматически создать и выполнить код в Colab
  async createAndRunCode(taskDescription) {
    try {
      // 1. Открыть Colab
      const colabResult = await this.openColab();
      if (!colabResult.success) {
        return colabResult;
      }

      // 2. Подождать загрузки
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 3. Сгенерировать код через AI
      const codeResult = await this.executeCodeViaAI(null, taskDescription);
      if (!codeResult.success) {
        return codeResult;
      }

      // 4. Добавить код в Colab
      const addResult = await this.addCodeCell(colabResult.tabId, codeResult.code);
      
      return {
        success: true,
        code: codeResult.code,
        tabId: colabResult.tabId
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

