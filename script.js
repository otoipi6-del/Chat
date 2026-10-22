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
const chatHistoryContainer = document.getElementById('chatHistory');

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

providerSelect.value = "openrouter";
providerSelect.addEventListener('change', updateModelList);
updateModelList();

// ==========================================
// УПРАВЛЕНИЕ ИСТОРИЕЙ ЧАТОВ
// ==========================================
let currentChatId = null;
let chats = JSON.parse(localStorage.getItem('chat_history')) || [];

function renderChatHistory() {
  chatHistoryContainer.innerHTML = '';
  
  const validChats = chats.filter(chat => chat.messages.length > 0);
  
  validChats.forEach(chat => {
    const wrapper = document.createElement('div');
    wrapper.className = `chat-item-wrapper ${chat.id === currentChatId ? 'active' : ''}`;
    wrapper.dataset.id = chat.id;
    
    wrapper.innerHTML = `
      <span class="chat-item-text">${chat.title}</span>
      <button class="chat-item-menu"><i class="fas fa-ellipsis-h"></i></button>
    `;
    
    wrapper.addEventListener('click', (e) => {
      if (e.target.closest('.chat-item-menu')) return;
      loadChat(chat.id);
    });

    chatHistoryContainer.appendChild(wrapper);
  });
}

function loadChat(id) {
  const chat = chats.find(c => c.id === id);
  if (!chat) return;
  
  currentChatId = id;
  renderChatHistory();
  clearMessagesUI();
  
  chat.messages.forEach(msg => {
    addMessageToUI(msg.sender, msg.text, msg.senderName, false);
  });
  
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Закрываем сайдбар на мобильных при выборе чата
  if (window.innerWidth <= 768) {
    sidebar.classList.add('hidden');
  }
}

function saveChats() {
  localStorage.setItem('chat_history', JSON.stringify(chats));
}

function updateCurrentChat(sender, text, senderName) {
  if (!currentChatId) return;
  
  const chat = chats.find(c => c.id === currentChatId);
  if (chat) {
    chat.messages.push({ sender, text, senderName });
    
    if (chat.messages.length === 1 && sender === 'user') {
      chat.title = text.substring(0, 25) + (text.length > 25 ? '...' : '');
      renderChatHistory();
    }
    
    saveChats();
  }
}

function clearMessagesUI() {
  const messages = messagesContainer.querySelectorAll('.message-wrapper');
  messages.forEach(msg => msg.remove());
  
  if (welcomeScreen) {
    welcomeScreen.style.display = 'flex';
  }
}

// ==========================================
// СОХРАНЕНИЕ ВВЕДЕННОГО ТЕКСТА
// ==========================================
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
// БОКОВАЯ ПАНЕЛЬ
// ==========================================
openSidebarBtn.addEventListener('click', () => {
  sidebar.classList.remove('hidden');
});

closeSidebarBtn.addEventListener('click', () => {
  sidebar.classList.add('hidden');
});

newChatBtn.addEventListener('click', () => {
  currentChatId = null;
  clearMessagesUI();
  renderChatHistory();
  
  if (window.innerWidth <= 768) {
    sidebar.classList.add('hidden');
  }
  
  messageInput.focus();
});

// ==========================================
// ОСНОВНАЯ ЛОГИКА ЧАТА
// ==========================================
async function sendMessage() {
  const messageText = messageInput.value.trim();
  if (messageText === '') return;

  if (!currentChatId) {
    currentChatId = Date.now().toString();
    chats.unshift({
      id: currentChatId,
      title: 'Новый чат',
      messages: []
    });
  }

  if (welcomeScreen) {
    welcomeScreen.style.display = 'none';
  }

  addMessageToUI('user', messageText, 'Вы');
  updateCurrentChat('user', messageText, 'Вы');

  messageInput.value = '';
  localStorage.removeItem('draftMessage');
  messageInput.style.height = 'auto';
  sendButton.disabled = true;

  typingIndicator.style.display = 'flex';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const selectedProvider = providerSelect.value;
    const selectedModel = modelSelect.value;

    const currentChat = chats.find(c => c.id === currentChatId);
    const contextMessages = currentChat.messages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }));

    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: selectedProvider,
        model: selectedModel,
        messages: contextMessages,
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
    addMessageToUI('ai', aiResponse, 'chat-ai');
    updateCurrentChat('ai', aiResponse, 'chat-ai');

  } catch (error) {
    typingIndicator.style.display = 'none';
    addMessageToUI('ai', `Произошла ошибка: ${error.message}.`, 'chat-ai');
    updateCurrentChat('ai', `Произошла ошибка: ${error.message}.`, 'chat-ai');
    console.error(error);
  }
}

// ==========================================
// ФУНКЦИИ ОТОБРАЖЕНИЯ
// ==========================================
function addMessageToUI(sender, text, senderName, scroll = true) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper';

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  
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

  messageDiv.innerHTML = `
    <div class="message-header">
      <div class="sender-name">${senderName}</div>
      <div class="message-time">${getCurrentTime()}</div>
    </div>
    <div class="message-body">
      <div class="message-text">
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

  wrapper.appendChild(messageDiv);
  messagesContainer.insertBefore(wrapper, typingIndicator);
  
  if (scroll) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
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
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// ==========================================
// ИНИЦИАЛИЗАЦИЯ
// ==========================================
renderChatHistory();
clearMessagesUI();
