// ==========================================
// НАСТРОЙКИ
// ==========================================
// URL твоего Cloudflare Worker
const PROXY_URL = "https://chat-ai-proxy.otoipi6.workers.dev";

// Выбранный провайдер (по умолчанию deepseek)
// В будущем это можно будет менять через выпадающий список в интерфейсе
let currentProvider = "deepseek"; 

// ==========================================
// DOM ЭЛЕМЕНТЫ
// ==========================================
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const messagesContainer = document.getElementById('messagesContainer');
const typingIndicator = document.getElementById('typingIndicator');

// ==========================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ==========================================
messageInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
  sendButton.disabled = this.value.trim() === '';
});

messageInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendButton.disabled) {
      sendMessage();
    }
  }
});

sendButton.addEventListener('click', sendMessage);

// ==========================================
// ОСНОВНАЯ ЛОГИКА ЧАТА
// ==========================================
async function sendMessage() {
  const messageText = messageInput.value.trim();
  if (messageText === '') return;

  addMessage('user', messageText, 'You');

  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendButton.disabled = true;

  typingIndicator.style.display = 'flex';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    // Определяем модель в зависимости от провайдера
    let modelName = "";
    if (currentProvider === "groq") {
      modelName = "llama-3.3-70b-versatile";
    } else if (currentProvider === "openrouter") {
      modelName = "openrouter/free"; // бесплатная модель
    } else {
      modelName = "deepseek-chat";
    }

    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: currentProvider,
        model: modelName,
        messages: [{ role: "user", content: messageText }],
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }

    const data = await response.json();
    
    // Извлекаем текст ответа
    const aiResponse = data.choices[0].message.content;

    typingIndicator.style.display = 'none';
    addMessage('ai', aiResponse, 'chat-ai');

  } catch (error) {
    typingIndicator.style.display = 'none';
    addMessage('ai', `Произошла ошибка: ${error.message}. Проверьте настройки прокси.`, 'System');
    console.error(error);
  }
}

// ==========================================
// ФУНКЦИИ ОТОБРАЖЕНИЯ
// ==========================================
function addMessage(sender, text, senderName) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';
  const isAI = sender === 'ai';
  const isSystem = senderName === 'System';

  const formattedText = text.replace(/\n/g, '<br>');

  let actionButtonsHtml = '';
  if (isAI && !isSystem) {
    actionButtonsHtml = `
      <div class="message-actions" style="margin-top: 10px; display: flex; gap: 10px;">
        <button class="action-btn copy-btn" title="Копировать" style="background: none; border: 1px solid #ccc; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">
          <i class="fas fa-copy"></i> Копировать
        </button>
        <button class="action-btn docx-btn" title="Скачать DOCX" style="background: none; border: 1px solid #ccc; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">
          <i class="fas fa-file-word"></i> Скачать DOCX
        </button>
      </div>
    `;
  }

  messageDiv.innerHTML = `
    <div class="avatar ${isAI ? 'ai-avatar' : 'user-avatar'}">${isAI ? '<i class="fas fa-robot"></i>' : 'JD'}</div>
    <div class="message-content">
      <div class="message-header">
        <div class="sender-name">${senderName}</div>
        <div class="message-time">${getCurrentTime()}</div>
      </div>
      <div class="message-text ${isAI ? 'ai-message' : 'user-message'}">
        ${formattedText}
      </div>
      ${actionButtonsHtml}
    </div>
  `;

  if (isAI && !isSystem) {
    const copyBtn = messageDiv.querySelector('.copy-btn');
    const docxBtn = messageDiv.querySelector('.docx-btn');

    copyBtn.addEventListener('click', () => copyToClipboard(text));
    docxBtn.addEventListener('click', () => downloadAsDocx(text));
  }

  messagesContainer.insertBefore(messageDiv, typingIndicator);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert('Текст скопирован в буфер обмена!');
  } catch (err) {
    console.error('Ошибка копирования:', err);
    alert('Не удалось скопировать текст.');
  }
}

function downloadAsDocx(text) {
  if (typeof htmlDocx === 'undefined') {
    alert('Библиотека для создания DOCX не загружена.');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body>
      <p>${text.replace(/\n/g, "</p><p>")}</p>
    </body>
    </html>
  `;
  
  try {
    const blob = htmlDocx.asBlob(htmlContent);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-ai_Response_${Date.now()}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Ошибка создания DOCX:', err);
    alert('Не удалось создать файл DOCX.');
  }
}

function getCurrentTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

document.querySelector('.new-chat-btn').addEventListener('click', function() {
  const messages = messagesContainer.querySelectorAll('.message');
  messages.forEach(msg => msg.remove());
  document.querySelector('.chat-title').textContent = "New Chat";
});
