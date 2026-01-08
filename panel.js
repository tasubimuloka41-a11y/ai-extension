// Script for panel link viewing
let currentUrl = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'loadUrl') {
      loadUrl(request.url);
    }
  });
});

function initializeEventListeners() {
  const backBtn = document.getElementById('backBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const colabBtn = document.getElementById('colabBtn');
  const agentToggleBtn = document.getElementById('agentToggleBtn');
  const modelSelectBtn = document.getElementById('modelSelectBtn');
  const contentFrame = document.getElementById('contentFrame');

  // Back button - navigate in iframe history
  backBtn.addEventListener('click', () => {
    if (contentFrame.contentWindow) {
      contentFrame.contentWindow.history.back();
    }
  });

  // Refresh button - reload current URL
  refreshBtn.addEventListener('click', () => {
    if (currentUrl) {
      loadUrl(currentUrl);
    }
  });

  // Colab button - open Google Colab in iframe
  colabBtn.addEventListener('click', () => {
    loadUrl('https://colab.research.google.com');
  });

  // Agent toggle button - open agent interface
  agentToggleBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({type: 'toggleAgent'});
  });

  // Model select button - open model selection
  modelSelectBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({type: 'selectModel'});
  });

  // Handle iframe load event
  contentFrame.addEventListener('load', () => {
    hideLoading();
  });
}

// Load URL in iframe
function loadUrl(url) {
  currentUrl = url;
  const contentFrame = document.getElementById('contentFrame');
  const loadingIndicator = document.getElementById('loadingIndicator');

  showLoading();
  contentFrame.src = url;
}

function showLoading() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'flex';
  }
}

function hideLoading() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
  }
}
