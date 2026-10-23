// ==========================================
// НАСТРОЙКИ И ДАННЫЕ ПРОВАЙДЕРОВ
// ==========================================
const PROXY_URL = "https://chat-ai-proxy.otoipi6.workers.dev";
const GROQ_GAS_URL = "https://script.google.com/macros/s/ТВОЙ_ID/exec"; 

const PROVIDER_MODELS = {
  groq: [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b'
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
const newChatBtn = document.getElementById('newChatBtn');
const chatHistoryContainer = document.getElementById('chatHistory');
const clearAllBtn = document.getElementById('clearAllBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const micBtn = document.getElementById('micBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// ==========================================
// ЛОГИКА ВЫПАДАЮЩИХ СПИСКОВ
// ==========================================
function updateModelList() {
  if (!providerSelect || !modelSelect) return;
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

if (providerSelect) {
  providerSelect.value = "groq"; 
  providerSelect.addEventListener('change', updateModelList);
  updateModelList(); 
  
  if (modelSelect && modelSelect.options.length > 0) {
    modelSelect.selectedIndex = 0; 
  }
}

// ==========================================
// УПРАВЛЕНИЕ ИСТОРИЕЙ ЧАТОВ
// ==========================================
let currentChatId = null;
let chats = JSON.parse(localStorage.getItem('chat_history')) || [];

function renderChatHistory() {
  if (!chatHistoryContainer) return;
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

    const menuBtn = wrapper.querySelector('.chat-item-menu');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showContextMenu(e, chat.id);
    });

    chatHistoryContainer.appendChild(wrapper);
  });
}

function showContextMenu(e, chatId) {
  const existingMenu = document.querySelector('.chat-context-menu');
  if (existingMenu) existingMenu.remove();

  const menu = document.createElement('div');
  menu.className = 'chat-context-menu';
  menu.innerHTML = `<button id="deleteChatBtn"><i class="fas fa-trash"></i> Удалить</button>`;
  
  const rect = e.target.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY}px`;
  menu.style.left = `${rect.left - 100 + window.scrollX}px`;

  document.body.appendChild(menu);

  document.getElementById('deleteChatBtn').addEventListener('click', () => {
    deleteChat(chatId);
    menu.remove();
  });

  setTimeout(() => {
    document.addEventListener('click', function closeMenu(ev) {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 10);
}

function deleteChat(id) {
  chats = chats.filter(c => c.id !== id);
  saveChats();
  if (currentChatId === id) {
    currentChatId = null;
    clearMessagesUI();
  }
  renderChatHistory();
}

function loadChat(id) {
  const chat = chats.find(c => c.id === id);
  if (!chat) return;
  currentChatId = id;
  renderChatHistory();
  clearMessagesUI();
  chat.messages.forEach(msg => addMessageToUI(msg.sender, msg.text, msg.senderName, false));
  if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
  if (window.innerWidth <= 768) closeSidebar();
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
  if (!messagesContainer) return;
  const messages = messagesContainer.querySelectorAll('.message-wrapper');
  messages.forEach(msg => msg.remove());
  if (welcomeScreen) welcomeScreen.style.display = 'flex';
}

// ==========================================
// СОХРАНЕНИЕ ВВЕДЕННОГО ТЕКСТА
// ==========================================
if (messageInput && sendButton) {
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
      if (!sendButton.disabled) sendMessage();
    }
  });
  sendButton.addEventListener('click', sendMessage);
}

// ==========================================
// БОКОВАЯ ПАНЕЛЬ (САЙДБАР)
// ==========================================
window.openSidebar = function() {
  if (!sidebar || !openSidebarBtn) return;
  sidebar.classList.remove('hidden');
  openSidebarBtn.innerHTML = '<i class="fas fa-times" style="color: var(--primary);"></i>';
}

window.closeSidebar = function() {
  if (!sidebar || !openSidebarBtn) return;
  sidebar.classList.add('hidden');
  openSidebarBtn.innerHTML = '<i class="fas fa-bars"></i>';
}

if (openSidebarBtn) {
  openSidebarBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (sidebar.classList.contains('hidden')) openSidebar();
    else closeSidebar();
  });
}

document.addEventListener('click', (e) => {
  if (!sidebar || !openSidebarBtn) return;
  if (!sidebar.classList.contains('hidden') && 
      !sidebar.contains(e.target) && 
      !openSidebarBtn.contains(e.target)) {
    closeSidebar();
  }
});

if (newChatBtn) {
  newChatBtn.addEventListener('click', () => {
    currentChatId = null;
    clearMessagesUI();
    renderChatHistory();
    if (window.innerWidth <= 768) closeSidebar();
    if (messageInput) messageInput.focus();
  });
}

if (clearAllBtn) {
  clearAllBtn.addEventListener('click', () => {
    if (confirm('Вы уверены, что хотите удалить все чаты?')) {
      chats = [];
      currentChatId = null;
      saveChats();
      renderChatHistory();
      clearMessagesUI();
      if (window.innerWidth <= 768) closeSidebar();
    }
  });
}

// ==========================================
// РАБОТА С ФАЙЛАМИ И ГОЛОСОМ
// ==========================================
if (attachBtn && fileInput) {
  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      messageInput.value += ` [Файл: ${file.name}] `;
      messageInput.dispatchEvent(new Event('input'));
      messageInput.focus();
    }
  });
}

if (micBtn) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    micBtn.addEventListener('click', () => {
      recognition.start();
      micBtn.style.color = 'red';
    });

    recognition.addEventListener('result', (event) => {
      const speechToText = event.results[0][0].transcript;
      messageInput.value += (messageInput.value ? ' ' : '') + speechToText;
      messageInput.dispatchEvent(new Event('input'));
    });

    recognition.addEventListener('end', () => micBtn.style.color = '');
    recognition.addEventListener('error', (event) => {
      alert('Ошибка распознавания речи: ' + event.error);
      micBtn.style.color = '';
    });
  } else {
    micBtn.addEventListener('click', () => alert('Ваш браузер не поддерживает голосовой ввод.'));
  }
}

// ==========================================
// ПЕРЕКЛЮЧЕНИЕ ТЕМЫ
// ==========================================
if (themeToggleBtn) {
  const currentTheme = localStorage.getItem('theme');
  if (currentTheme === 'dark') {
    document.body.classList.add('dark-theme');
    themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
  }

  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    
    if (document.body.classList.contains('dark-theme')) {
      localStorage.setItem('theme', 'dark');
      themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
      localStorage.setItem('theme', 'light');
      themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
  });
}

// ==========================================
// ОСНОВНАЯ ЛОГИКА ЧАТА
// ==========================================
async function sendMessage() {
  if (!messageInput) return;
  const messageText = messageInput.value.trim();
  if (messageText === '') return;

  if (!currentChatId) {
    currentChatId = Date.now().toString();
    chats.unshift({ id: currentChatId, title: 'Новый чат', messages: [] });
  }

  if (welcomeScreen) welcomeScreen.style.display = 'none';
  addMessageToUI('user', messageText, 'Вы');
  updateCurrentChat('user', messageText, 'Вы');

  messageInput.value = '';
  localStorage.removeItem('draftMessage');
  messageInput.style.height = 'auto';
  if (sendButton) sendButton.disabled = true;
  if (typingIndicator) typingIndicator.style.display = 'flex';
  if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const selectedProvider = providerSelect ? providerSelect.value : 'groq';
    const selectedModel = modelSelect ? modelSelect.value : 'openai/gpt-oss-120b';
    const currentChat = chats.find(c => c.id === currentChatId);
    const contextMessages = currentChat.messages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }));

    let response;

    if (selectedProvider === 'groq') {
      response = await fetch(GROQ_GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ model: selectedModel, messages: contextMessages }),
      });
    } else {
      response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          messages: contextMessages,
          stream: false
        }),
      });
    }

    if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
    const data = await response.json();
    
    let aiResponse = "Не удалось извлечь ответ.";
    if (data.choices && data.choices[0] && data.choices[0].message) {
        aiResponse = data.choices[0].message.content;
    } else if (data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
    }

    if (typingIndicator) typingIndicator.style.display = 'none';
    addMessageToUI('ai', aiResponse, 'chat-ai');
    updateCurrentChat('ai', aiResponse, 'chat-ai');

  } catch (error) {
    if (typingIndicator) typingIndicator.style.display = 'none';
    addMessageToUI('ai', `Произошла ошибка: ${error.message}.`, 'chat-ai');
    updateCurrentChat('ai', `Произошла ошибка: ${error.message}.`, 'chat-ai');
    console.error(error);
  }
}

// ==========================================
// ФУНКЦИИ ОТОБРАЖЕНИЯ
// ==========================================
function addMessageToUI(sender, text, senderName, scroll = true) {
  if (!messagesContainer || !typingIndicator) return;
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
        <button class="action-btn copy-btn" title="Копировать"><i class="fas fa-copy"></i> Копировать</button>
        <button class="action-btn docx-btn" title="Скачать DOCX"><i class="fas fa-file-word"></i> Скачать DOCX</button>
      </div>
    `;
  }

  messageDiv.innerHTML = `
    <div class="message-header">
      <div class="sender-name">${senderName}</div>
      <div class="message-time">${getCurrentTime()}</div>
    </div>
    <div class="message-body">
      <div class="message-text">${formattedText}</div>
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
  if (scroll) messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert('Текст скопирован в буфер обмена!');
  } catch (err) { alert('Не удалось скопировать текст.'); }
}

function downloadAsDocx(text) {
  if (typeof htmlDocx === 'undefined') { alert('Библиотека для создания DOCX не загружена.'); return; }
  const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><p>${text.replace(/\n/g, "</p><p>")}</p></body></html>`;
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
  } catch (err) { alert('Не удалось создать файл DOCX.'); }
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
