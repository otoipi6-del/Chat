// ==========================================
// НАСТРОЙКИ
// ==========================================
// ВАЖНО: Сюда мы вставим URL вашего Cloudflare Worker на следующем шаге.
// Пока оставляем заглушку, чтобы код не ломался.
const PROXY_URL = "https://ВАШ_WORKER_URL.workers.dev"; 

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

  // 1. Добавляем сообщение пользователя
  addMessage('user', messageText, 'You');

  // 2. Очищаем поле ввода
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendButton.disabled = true;

  // 3. Показываем индикатор набора текста
  typingIndicator.style.display = 'flex';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    // 4. Отправляем запрос на Cloudflare Worker
    // (Временно используется заглушка, если PROXY_URL не заменен, будет ошибка)
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "deepseek-chat", // Модель по умолчанию
        messages: [{ role: "user", content: messageText }],
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }

    const data = await response.json();
    
    // Извлекаем текст ответа из структуры ответа DeepSeek/OpenAI
    const aiResponse = data.choices[0].message.content;

    // 5. Скрываем индикатор и добавляем ответ
    typingIndicator.style.display = 'none';
    addMessage('ai', aiResponse, 'AIChat');

  } catch (error) {
    // Обработка ошибок (например, если Worker не настроен)
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

  // Форматируем текст (заменяем переносы строк на <br>)
  const formattedText = text.replace(/\n/g, '<br>');

  // Для AI-сообщений добавляем кнопки копирования и скачивания
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

  // Привязываем события к кнопкам (если это AI-сообщение)
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
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (Копирование и DOCX)
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

  // Формируем простой HTML для документа
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
    a.download = `AIChat_Response_${Date.now()}.docx`;
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

// Обработчик кнопки "New Chat" (очистка чата)
document.querySelector('.new-chat-btn').addEventListener('click', function() {
  // Очищаем контейнер сообщений, оставляя только индикатор
  const messages = messagesContainer.querySelectorAll('.message');
  messages.forEach(msg => msg.remove());
  
  // Сбрасываем заголовок
  document.querySelector('.chat-title').textContent = "New Chat";
});
