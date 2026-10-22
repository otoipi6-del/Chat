// ==========================================
// НАСТРОЙКИ И ДАННЫЕ ПРОВАЙДЕРОВ
// ==========================================
const PROXY_URL = "https://chat-ai-proxy.otoipi6.workers.dev";

const PROVIDER_MODELS = {
  groq: [
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'openai/gpt-oss-120b',
    'qwen/qwen3-32b'
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner'
  ],
  openrouter: [
    'openrouter/free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-31b-it:free'
  ]
};

// ==========================================
// DOM ЭЛЕМЕНТЫ
// ==========================================
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const messagesContainer = document.getElementById('messagesContainer');
const typingIndicator = document.getElementById('typingIndicator');
const providerSelect = document.getElementById('providerSelect');
const modelSelect = document.getElementById('modelSelect');
const welcomeScreen = document.getElementById('welcomeScreen');
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistory = document.getElementById('chatHistory');

// ==========================================
// ЛОГИКА ВЫПАДАЮЩИХ СПИСКОВ
// ==========================================
function updateModelList() {
  const provider = providerSelect.value;
  const models = PROVIDER_MODELS[provider] || [];
  
  modelSelect.innerHTML = '';
  
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    modelSelect.appendChild(option);
  });
}

providerSelect.addEventListener('change', updateModelList);
updateModelList();

// ==========================================
// СОХРАНЕНИЕ ВВЕДЕННОГО ТЕКСТА (LocalStorage)
// ==========================================
// При загрузке страницы восстанавливаем текст
const savedInput = localStorage.getItem('draftMessage');
if (savedInput) {
  messageInput.value = savedInput;
  messageInput.style.height = 'auto';
  messageInput.style.height = (messageInput.scrollHeight) + 'px';
  sendButton.disabled = savedInput.trim() === '';
}

messageInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
  sendButton.disabled = this.value.trim() === '';
  
  // Сохраняем текст при каждом вводе
  localStorage.setItem('draftMessage', this.value);
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
// БОКОВАЯ ПАНЕЛЬ (Сайдбар)
// ==========================================
openSidebarBtn.addEventListener('click', () => {
  sidebar.classList.remove('hidden');
});

closeSidebarBtn.addEventListener('click', () => {
  sidebar.classList.add('hidden');
});

// Обработка кнопки "New Chat"
newChatBtn.addEventListener('click', () => {
  messagesContainer.innerHTML = `
    <div class="welcome-screen" id="welcomeScreen">
      <div class="welcome-icon"><i class="fas fa-robot"></i></div>
      <h1>Здравствуйте!</h1>
      <p>Чем я могу вам помочь?</p>
    </div>
    <div class="typing-indicator" id="typingIndicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  // Обновляем ссылки на элементы после очистки
  window.location.reload(); // Самый простой способ сбросить состояние (можно доработать позже)
});

// ==========================================
// ОСНОВНАЯ ЛОГИКА ЧАТА
// ==========================================
async function sendMessage() {
  const messageText = messageInput.value.trim();
  if (messageText === '') return;

  // Убираем приветствие при первом сообщении
  if (welcomeScreen) {
    welcomeScreen.style.display = 'none';
  }

  addMessage('user', messageText, 'Вы');

  messageInput.value = '';
  localStorage.removeItem('draftMessage'); // Очищаем черновик
  messageInput.style.height = 'auto';
  sendButton.disabled = true;

  typingIndicator.style.display = 'flex';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const selectedProvider = providerSelect.value;
    const selectedModel = modelSelect.value;

    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: selectedProvider,
        model: selectedModel,
        messages: [{ role: "user", content: messageText }],
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }

    const data = await response.json();
    
    let aiResponse = "Не удалось извлечь ответ.";
    if (data.choices && data.choices[0] && data.choices[0].message) {
        aiResponse = data.choices[0].message.content;
    } else if (data.error) {
        throw new Error(data.error);
    }

    typingIndicator.style.display = 'none';
    addMessage('ai', aiResponse, 'chat-ai');

  } catch (error) {
    typingIndicator.style.display = 'none';
    // Изменили System на chat-ai
    addMessage('ai', `Произошла ошибка: ${error.message}.`, 'chat-ai');
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

  const formattedText = text.replace(/\n/g, '<br>');

  let actionButtonsHtml = '';
  if (isAI) {
    actionButtonsHtml = `
      <div class="message-actions">
        <button class="action-btn copy-btn" title="Копировать">
          <i class="fas fa-copy"></i> Копировать
        </button>
        <button class="action-btn docx-btn" title="Скачать DOCX">
          <i class="fas fa-file-word"></i> Скачать DOCX
        </button>
      </div>
    `;
  }

  // Убрали аватар для пользователя, оставили только имя и текст
  messageDiv.innerHTML = `
    <div class="message-header">
      <div class="sender-name">${senderName}</div>
      <div class="message-time">${getCurrentTime()}</div>
    </div>
    <div class="message-body">
      <div class="message-text ${isAI ? 'ai-message' : 'user-message'}">
        ${formattedText}
      </div>
      ${actionButtonsHtml}
    </div>
  `;

  if (isAI) {
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
  // Вернули AM/PM для совместимости с оригинальным дизайном
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}
