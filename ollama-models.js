// Управление моделями Ollama

class OllamaModels {
  constructor() {
    this.apiUrl = 'http://localhost:11435';
  }

  // Получить список моделей
  async getModels() {
    try {
      const response = await fetch(`${this.apiUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        models: data.models || []
      };
    } catch (error) {
      console.error('Ошибка получения списка моделей:', error);
      return {
        success: false,
        error: error.message,
        models: []
      };
    }
  }

  // Получить информацию о модели
  async getModelInfo(modelName) {
    try {
      const response = await fetch(`${this.apiUrl}/api/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modelName
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        info: data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Проверить доступность Ollama
  async checkAvailability() {
    try {
      const response = await fetch(`${this.apiUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

