// Скрипт для панели просмотра ссылок

let currentUrl = null;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  
  // Слушать сообщения от background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'loadUrl') {
      loadUrl(request.url);
    }
  });
});

function initializeEventListeners() {
  const backBtn = document.getElementById('backBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const closeBtn = document.getElementById('closeBtn');
  const contentFrame = document.getElementById('contentFrame');

  backBtn.addEventListener('click', () => {
    if (contentFrame.contentWindow) {
      contentFrame.contentWindow.history.back();
    }
  });

  refreshBtn.addEventListener('click', () => {
    if (currentUrl) {
      loadUrl(currentUrl);
    }
  });

  closeBtn.addEventListener('click', () => {
    window.close();
  });

  // Обработка загрузки iframe
  contentFrame.addEventListener('load', () => {
    hideLoading();
  });
}

function loadUrl(url) {
  currentUrl = url;
  const contentFrame = document.getElementById('contentFrame');
  const loadingIndicator = document.getElementById('loadingIndicator');
  
  showLoading();
  
  // Загрузить URL в iframe
  contentFrame.src = url;
}

function showLoading() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  loadingIndicator.classList.remove('hidden');
}

function hideLoading() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  loadingIndicator.classList.add('hidden');
}

