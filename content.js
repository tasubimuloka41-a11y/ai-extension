// Content script для работы со ссылками на страницах

// Слушать сообщения от background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'extractLinks') {
    const links = extractAllLinks();
    sendResponse({ links });
  }
});

// Извлечение всех ссылок со страницы
function extractAllLinks() {
  const links = [];
  const anchorElements = document.querySelectorAll('a[href]');
  
  anchorElements.forEach(anchor => {
    const href = anchor.href;
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      links.push({
        url: href,
        text: anchor.textContent.trim() || href,
        title: anchor.title || ''
      });
    }
  });
  
  return links;
}

// Автоматическое обнаружение ссылок в тексте страницы
function detectLinksInText() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const links = [];
  let node;

  while (node = walker.nextNode()) {
    const text = node.textContent;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      links.push({
        url: match[0],
        text: match[0],
        context: text.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50)
      });
    }
  }

  return links;
}

