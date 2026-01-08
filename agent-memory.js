// Система памяти и обучения для автономного агента

class AgentMemory {
  constructor() {
    this.memoryKey = 'agentMemory';
    this.maxMemorySize = 1000; // Максимальное количество записей в памяти
    this.learningEnabled = true;
  }

  // Инициализация памяти
  async init() {
    await this.loadMemory();
  }

  // Сохранить опыт выполнения задачи
  async saveExperience(task, result, context = {}) {
    const experience = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      task: {
        type: task.type,
        description: task.description || task.goal,
        url: task.url,
        goal: task.goal
      },
      actions: result.steps || [],
      result: {
        success: result.success,
        error: result.error,
        finalScreenshot: result.finalScreenshot?.dataUrl ? 'saved' : null
      },
      context: {
        pageInfo: context.pageInfo,
        visitedUrls: context.visitedUrls,
        ...context
      },
      performance: {
        stepsCount: result.steps?.length || 0,
        executionTime: result.executionTime || 0,
        successRate: result.success ? 1 : 0
      },
      learnedPatterns: this.extractPatterns(task, result)
    };

    const memory = await this.getMemory();
    memory.experiences.push(experience);
    
    // Ограничить размер памяти
    if (memory.experiences.length > this.maxMemorySize) {
      // Удалить самые старые записи, но сохранить успешные
      memory.experiences.sort((a, b) => {
        if (a.result.success && !b.result.success) return -1;
        if (!a.result.success && b.result.success) return 1;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      memory.experiences = memory.experiences.slice(0, this.maxMemorySize);
    }

    await this.saveMemory(memory);
    return experience;
  }

  // Извлечь паттерны из опыта
  extractPatterns(task, result) {
    const patterns = {
      successfulActions: [],
      failedActions: [],
      commonSelectors: {},
      pageStructures: []
    };

    if (result.steps) {
      result.steps.forEach(step => {
        if (step.type === 'action_result' && step.data) {
          const action = step.data.action;
          const result = step.data.result;
          
          if (result.success) {
            patterns.successfulActions.push({
              type: action.type,
              selector: action.selector || action.target,
              context: action.options
            });
            
            // Сохранить успешные селекторы
            if (action.selector) {
              patterns.commonSelectors[action.selector] = 
                (patterns.commonSelectors[action.selector] || 0) + 1;
            }
          } else {
            patterns.failedActions.push({
              type: action.type,
              selector: action.selector || action.target,
              error: result.error
            });
          }
        }
        
        if (step.type === 'pageInfo' && step.data) {
          patterns.pageStructures.push({
            url: step.data.url,
            elementsCount: {
              buttons: step.data.elements?.buttons?.length || 0,
              inputs: step.data.elements?.inputs?.length || 0,
              links: step.data.elements?.links?.length || 0
            }
          });
        }
      });
    }

    return patterns;
  }

  // Найти похожие задачи в памяти
  async findSimilarExperiences(task, limit = 5) {
    const memory = await this.getMemory();
    const taskDescription = (task.description || task.goal || '').toLowerCase();
    const taskUrl = task.url || '';

    const similar = memory.experiences
      .filter(exp => {
        const expDescription = (exp.task.description || '').toLowerCase();
        const expUrl = exp.task.url || '';
        
        // Проверка по описанию
        const descriptionMatch = taskDescription && expDescription && 
          (expDescription.includes(taskDescription) || taskDescription.includes(expDescription));
        
        // Проверка по URL (домен)
        const urlMatch = taskUrl && expUrl && 
          new URL(taskUrl).hostname === new URL(expUrl).hostname;
        
        return descriptionMatch || urlMatch;
      })
      .sort((a, b) => {
        // Приоритет успешным задачам
        if (a.result.success && !b.result.success) return -1;
        if (!a.result.success && b.result.success) return 1;
        // Затем по дате (новые первыми)
        return new Date(b.timestamp) - new Date(a.timestamp);
      })
      .slice(0, limit);

    return similar;
  }

  // Получить знания для улучшения выполнения
  async getKnowledgeForTask(task) {
    const similarExperiences = await this.findSimilarExperiences(task, 3);
    
    const knowledge = {
      similarTasks: similarExperiences.map(exp => ({
        description: exp.task.description,
        success: exp.result.success,
        actions: exp.learnedPatterns.successfulActions.slice(0, 5),
        commonSelectors: exp.learnedPatterns.commonSelectors
      })),
      bestPractices: this.extractBestPractices(similarExperiences),
      commonMistakes: this.extractCommonMistakes(similarExperiences),
      recommendedActions: this.generateRecommendedActions(similarExperiences, task)
    };

    return knowledge;
  }

  // Извлечь лучшие практики
  extractBestPractices(experiences) {
    const practices = {
      successfulSelectors: {},
      actionSequences: [],
      timing: {
        averageWaitTime: 0,
        averageSteps: 0
      }
    };

    const successful = experiences.filter(exp => exp.result.success);
    
    if (successful.length === 0) return practices;

    // Собрать успешные селекторы
    successful.forEach(exp => {
      Object.entries(exp.learnedPatterns.commonSelectors).forEach(([selector, count]) => {
        practices.successfulSelectors[selector] = 
          (practices.successfulSelectors[selector] || 0) + count;
      });
    });

    // Извлечь успешные последовательности действий
    successful.forEach(exp => {
      if (exp.actions && exp.actions.length > 0) {
        const sequence = exp.actions
          .filter(a => a.type === 'action_result' && a.result?.success)
          .map(a => ({
            type: a.action?.type,
            selector: a.action?.selector || a.action?.target
          }));
        if (sequence.length > 0) {
          practices.actionSequences.push(sequence);
        }
      }
    });

    // Вычислить средние значения
    const totalWaitTime = successful.reduce((sum, exp) => 
      sum + (exp.performance.executionTime || 0), 0);
    practices.timing.averageWaitTime = totalWaitTime / successful.length;
    
    const totalSteps = successful.reduce((sum, exp) => 
      sum + (exp.performance.stepsCount || 0), 0);
    practices.timing.averageSteps = totalSteps / successful.length;

    return practices;
  }

  // Извлечь частые ошибки
  extractCommonMistakes(experiences) {
    const mistakes = {};
    
    experiences.forEach(exp => {
      if (!exp.result.success && exp.learnedPatterns.failedActions) {
        exp.learnedPatterns.failedActions.forEach(failed => {
          const key = `${failed.type}:${failed.selector || 'unknown'}`;
          mistakes[key] = (mistakes[key] || 0) + 1;
        });
      }
    });

    // Отсортировать по частоте
    return Object.entries(mistakes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({ action: key, count }));
  }

  // Сгенерировать рекомендуемые действия
  generateRecommendedActions(experiences, currentTask) {
    const recommendations = [];
    const successful = experiences.filter(exp => exp.result.success);

    if (successful.length === 0) return recommendations;

    // Найти наиболее успешные последовательности действий
    const actionFrequency = {};
    
    successful.forEach(exp => {
      if (exp.actions) {
        exp.actions.forEach((action, index) => {
          if (action.type === 'action_result' && action.result?.success) {
            const actionKey = `${action.action?.type}:${action.action?.selector || 'any'}`;
            if (!actionFrequency[actionKey]) {
              actionFrequency[actionKey] = { count: 0, position: index };
            }
            actionFrequency[actionKey].count++;
          }
        });
      }
    });

    // Преобразовать в рекомендации
    Object.entries(actionFrequency)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .forEach(([key, data]) => {
        const [type, selector] = key.split(':');
        recommendations.push({
          type,
          selector: selector !== 'any' ? selector : null,
          confidence: data.count / successful.length,
          suggestedPosition: data.position
        });
      });

    return recommendations;
  }

  // Сохранить состояние агента
  async saveAgentState(agentState) {
    const memory = await this.getMemory();
    memory.agentState = {
      ...agentState,
      savedAt: new Date().toISOString()
    };
    await this.saveMemory(memory);
  }

  // Загрузить состояние агента
  async loadAgentState() {
    const memory = await this.getMemory();
    return memory.agentState || null;
  }

  // Получить статистику памяти
  async getMemoryStats() {
    const memory = await this.getMemory();
    const experiences = memory.experiences || [];
    
    const successful = experiences.filter(exp => exp.result.success).length;
    const failed = experiences.length - successful;
    
    const uniqueTasks = new Set(experiences.map(exp => exp.task.type)).size;
    const uniqueUrls = new Set(experiences.map(exp => exp.task.url).filter(Boolean)).size;
    
    const avgSuccessRate = experiences.length > 0 
      ? successful / experiences.length 
      : 0;

    return {
      totalExperiences: experiences.length,
      successful,
      failed,
      successRate: avgSuccessRate,
      uniqueTasks,
      uniqueUrls,
      memorySize: JSON.stringify(memory).length,
      oldestExperience: experiences.length > 0 
        ? experiences[experiences.length - 1].timestamp 
        : null,
      newestExperience: experiences.length > 0 
        ? experiences[0].timestamp 
        : null
    };
  }

  // Очистить память
  async clearMemory(keepSuccessful = false) {
    if (keepSuccessful) {
      const memory = await this.getMemory();
      memory.experiences = (memory.experiences || []).filter(exp => exp.result.success);
      await this.saveMemory(memory);
    } else {
      await chrome.storage.local.remove([this.memoryKey]);
      await this.init();
    }
  }

  // Получить память
  async getMemory() {
    const stored = await chrome.storage.local.get([this.memoryKey]);
    if (!stored[this.memoryKey]) {
      return {
        experiences: [],
        agentState: null,
        learnedPatterns: {},
        createdAt: new Date().toISOString()
      };
    }
    return stored[this.memoryKey];
  }

  // Загрузить память
  async loadMemory() {
    return await this.getMemory();
  }

  // Сохранить память
  async saveMemory(memory) {
    await chrome.storage.local.set({
      [this.memoryKey]: memory
    });
  }

  // Экспорт памяти
  async exportMemory() {
    const memory = await this.getMemory();
    return JSON.stringify(memory, null, 2);
  }

  // Импорт памяти
  async importMemory(jsonData) {
    try {
      const memory = JSON.parse(jsonData);
      await this.saveMemory(memory);
      return true;
    } catch (error) {
      console.error('Ошибка импорта памяти:', error);
      return false;
    }
  }
}

