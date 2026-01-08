// Интеграция с Telegram Bot API

class TelegramIntegration {
  constructor() {
    this.botToken = null;
    this.isRunning = false;
    this.updateInterval = null;
    this.lastUpdateId = 0;
    this.apiUrl = 'https://api.telegram.org/bot';
  }

  // Инициализация с токеном
  async init(botToken) {
    this.botToken = botToken;
    this.apiUrl = `https://api.telegram.org/bot${botToken}/`;
    
    // Проверить токен
    const isValid = await this.checkToken();
    if (!isValid) {
      throw new Error('Неверный токен бота');
    }
    
    return true;
  }

  // Проверить токен
  async checkToken() {
    try {
      const response = await fetch(`${this.apiUrl}getMe`);
      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      return false;
    }
  }

  // Получить информацию о боте
  async getBotInfo() {
    try {
      const response = await fetch(`${this.apiUrl}getMe`);
      const data = await response.json();
      if (data.ok) {
        return { success: true, bot: data.result };
      }
      return { success: false, error: 'Ошибка получения информации' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Получить обновления (новые сообщения)
  async getUpdates() {
    try {
      const response = await fetch(`${this.apiUrl}getUpdates?offset=${this.lastUpdateId + 1}&timeout=10`);
      const data = await response.json();
      
      if (data.ok && data.result && data.result.length > 0) {
        // Обновить lastUpdateId
        this.lastUpdateId = Math.max(...data.result.map(u => u.update_id));
        return { success: true, updates: data.result };
      }
      
      return { success: true, updates: [] };
    } catch (error) {
      return { success: false, error: error.message, updates: [] };
    }
  }

  // Отправить сообщение
  async sendMessage(chatId, text, options = {}) {
    try {
      const params = new URLSearchParams({
        chat_id: chatId,
        text: text,
        parse_mode: options.parseMode || 'HTML',
        ...options
      });

      const response = await fetch(`${this.apiUrl}sendMessage?${params}`);
      const data = await response.json();
      
      if (data.ok) {
        return { success: true, message: data.result };
      }
      
      return { success: false, error: data.description || 'Ошибка отправки' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Запустить прослушивание сообщений
  async startListening(callback) {
    if (this.isRunning) {
      return { success: false, error: 'Уже запущено' };
    }

    if (!this.botToken) {
      return { success: false, error: 'Токен не установлен' };
    }

    this.isRunning = true;
    
    // Получать обновления каждые 2 секунды
    this.updateInterval = setInterval(async () => {
      const result = await this.getUpdates();
      
      if (result.success && result.updates) {
        for (const update of result.updates) {
          if (update.message) {
            const message = update.message;
            const chatId = message.chat.id;
            const text = message.text;
            const from = message.from;
            
            // Вызвать callback с сообщением
            if (callback) {
              await callback({
                chatId,
                text,
                from,
                messageId: message.message_id,
                updateId: update.update_id
              });
            }
          }
        }
      }
    }, 2000);

    return { success: true };
  }

  // Остановить прослушивание
  stopListening() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
  }

  // Обработать сообщение и отправить ответ через AI
  async processMessage(message, aiResponseCallback) {
    try {
      const { chatId, text } = message;
      
      // Получить ответ от AI
      let aiResponse = '';
      if (aiResponseCallback) {
        aiResponse = await aiResponseCallback(text);
      }
      
      // Отправить ответ в Telegram
      if (aiResponse) {
        const result = await this.sendMessage(chatId, aiResponse);
        return result;
      }
      
      return { success: false, error: 'Нет ответа от AI' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

