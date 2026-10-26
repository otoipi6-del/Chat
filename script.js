// ==========================================
// НАСТРОЙКИ И ДАННЫЕ ПРОВАЙДЕРОВ
// ==========================================
const PROXY_URL = "https://chat-ai-proxy.otoipi6.workers.dev";
const GROQ_GAS_URL = "https://script.google.com/macros/s/AKfycbxP2fjnGgAPBezXQQpnVzLPJwjGVVB-POlL942mxAGxeBpYgkeroacf3FPNhXwBWuXu8A/exec"; // НЕ ЗАБУДЬ ВСТАВИТЬ СВОЙ URL!

const PROVIDER_MODELS = {
  groq: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  openrouter: ['openrouter/free', 'nvidia/nemotron-3-super-120b-a12b:free', 'google/gemma-4-31b-it:free']
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
const welcomeText = document.getElementById('welcomeText');
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistoryContainer = document.getElementById('chatHistory');
const clearAllBtn = document.getElementById('clearAllBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const micBtn = document.getElementById('micBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const modeSwitcher = document.getElementById('modeSwitcher');

// Переменные для управления запросом
let isGenerating = false;
let abortController = null;
let currentMode = 'chat'; // 'chat' или 'image'

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
// ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ (ЧАТ / КАРТИНКИ)
// ==========================================
if (modeSwitcher) {
  modeSwitcher.addEventListener('click', (e) => {
    if (e.target.classList.contains('mode-btn')) {
      const mode = e.target.dataset.mode;
      
      if (mode === currentMode) return;
      
      currentMode = mode;
      
      modeSwitcher.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      
      if (currentMode === 'image') {
        messageInput.placeholder = "Опишите картинку, которую хотите создать...";
        welcomeText.textContent = "Опишите картинку, и я её нарисую!";
      } else {
        messageInput.placeholder = "Message chat-ai...";
        welcomeText.textContent = "Чем я могу вам помочь?";
      }
      
      messageInput.value = '';
      messageInput.style.height = 'auto';
      sendButton.disabled = true;
    }
  });
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
  menu.innerHTML = `
    <button id="downloadChatBtn"><i class="fas fa-download"></i> Скачать DOCX</button>
    <button id="renameChatBtn"><i class="fas fa-pen"></i> Переименовать</button>
    <button id="deleteChatBtn" style="color: #dc2626;"><i class="fas fa-trash"></i> Удалить</button>
  `;
  
  const rect = e.target.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY}px`;
  menu.style.left = `${rect.left - 120 + window.scrollX}px`;

  document.body.appendChild(menu);

  document.getElementById('downloadChatBtn').addEventListener('click', () => {
    downloadFullChat(chatId);
    menu.remove();
  });

  document.getElementById('renameChatBtn').addEventListener('click', () => {
    renameChat(chatId);
    menu.remove();
  });

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

function renameChat(chatId) {
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;

  const newTitle = prompt('Введите новое название для чата:', chat.title);
  
  if (newTitle && newTitle.trim() !== '') {
    chat.title = newTitle.trim();
    saveChats();
    renderChatHistory();
  }
}

function downloadFullChat(chatId) {
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;

  let htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${chat.title}</title></head><body>`;
  htmlContent += `<h1>${chat.title}</h1>`;
  
  chat.messages.forEach(msg => {
    const role = msg.sender === 'user' ? 'Вы' : 'chat-ai';
    const formattedText = msg.text.replace(/\n/g, '<br>');
    htmlContent += `<p><strong>${role}:</strong><br>${formattedText}</p><hr>`;
  });
  
  htmlContent += `</body></html>`;

  try {
    const blob = htmlDocx.asBlob(htmlContent);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-ai_${chat.title.replace(/[^a-zа-я0-9]/gi, '_')}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Ошибка создания DOCX:', err);
    alert('Не удалось создать файл DOCX.');
  }
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
    if (!isGenerating) {
        sendButton.disabled = this.value.trim() === '';
    }
    localStorage.setItem('draftMessage', this.value);
  });
  messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendButton.disabled && !isGenerating) sendMessage();
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
// ОСНОВНАЯ ЛОГИКА ЧАТА (С ПОДДЕРЖКОЙ СТОП)
// ==========================================
async function sendMessage() {
  if (isGenerating) {
    if (abortController) abortController.abort();
    return;
  }

  if (!messageInput) return;
  const messageText = messageInput.value.trim();
  if (messageText === '') return;

  // Если выбран режим "Картинки"
  if (currentMode === 'image') {
    await generateImage(messageText);
    return;
  }

  // ИНАЧЕ - ОБЫЧНЫЙ ЧАТ
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
  
  // Включаем режим генерации
  isGenerating = true;
  sendButton.disabled = false; 
  sendButton.innerHTML = '<i class="fas fa-square"></i>';
  sendButton.style.backgroundColor = '#9ca3af'; 
  
  if (typingIndicator) typingIndicator.style.display = 'flex';
  if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;

  abortController = new AbortController();

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
        signal: abortController.signal
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
        signal: abortController.signal
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
    if (error.name === 'AbortError') {
        console.log('Запрос отменен пользователем');
        addMessageToUI('ai', 'Генерация ответа остановлена.', 'chat-ai');
    } else {
        addMessageToUI('ai', `Произошла ошибка: ${error.message}.`, 'chat-ai');
        updateCurrentChat('ai', `Произошла ошибка: ${error.message}.`, 'chat-ai');
        console.error(error);
    }
  } finally {
    isGenerating = false;
    abortController = null;
    if (typingIndicator) typingIndicator.style.display = 'none';
    sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
    sendButton.style.backgroundColor = ''; 
    sendButton.disabled = messageInput.value.trim() === '';
  }
}

// ==========================================
// ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЙ (TOGETHER AI ЧЕРЕЗ WORKER)
// ==========================================
async function generateImage(prompt) {
  if (welcomeScreen) welcomeScreen.style.display = 'none';
  
  // Добавляем сообщение пользователя
  addMessageToUI('user', prompt, 'Вы');
  
  // Очищаем поле ввода
  messageInput.value = '';
  localStorage.removeItem('draftMessage');
  messageInput.style.height = 'auto';
  
  // Показываем индикатор загрузки
  isGenerating = true;
  sendButton.disabled = true;
  sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  if (typingIndicator) typingIndicator.style.display = 'flex';
  if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    // Отправляем запрос на наш Worker, который добавит ключ Together AI
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'together',
        prompt: prompt
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Ошибка сервера: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Together AI возвращает URL картинки в data.choices[0].image_urls[0] или похожем формате
    // В зависимости от версии API, но чаще всего это массив
    let imageUrl = null;
    if (data.data && data.data[0] && data.data[0].url) {
        imageUrl = data.data[0].url;
    } else if (data.choices && data.choices[0] && data.choices[0].image_urls) {
        imageUrl = data.choices[0].image_urls[0];
    } else if (data.image_url) {
        imageUrl = data.image_url;
    }

    if (!imageUrl) {
        throw new Error("Не удалось получить URL картинки от Together AI");
    }

    if (typingIndicator) typingIndicator.style.display = 'none';
    
    // Добавляем сообщение с картинкой
    addImageToUI('ai', imageUrl, 'chat-ai');
    
  } catch (error) {
    if (typingIndicator) typingIndicator.style.display = 'none';
    addMessageToUI('ai', `Не удалось создать картинку: ${error.message}.`, 'chat-ai');
  } finally {
    isGenerating = false;
    sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
    sendButton.style.backgroundColor = ''; 
    sendButton.disabled = messageInput.value.trim() === '';
  }
}

// ==========================================
// ФУНКЦИИ ОТОБРАЖЕНИЯ
// ==========================================
function addMessageToUI(sender, text, senderName, scroll = true) {
  if (!messagesContainer || !typingIndicator) return;
  
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${sender}`;
  
  const headerDiv = document.createElement('div');
  headerDiv.className = 'message-header';
  headerDiv.innerHTML = `
    <div class="sender-name">${senderName}</div>
    <div class="message-time">${getCurrentTime()}</div>
  `;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message-body'; 
  
  const isAI = sender === 'ai';
  const formattedText = formatMessageText(text);

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
    <div class="message-text">${formattedText}</div>
    ${actionButtonsHtml}
  `;

  if (isAI) {
    const copyBtn = messageDiv.querySelector('.copy-btn');
    const docxBtn = messageDiv.querySelector('.docx-btn');
    copyBtn.addEventListener('click', () => copyToClipboard(text));
    docxBtn.addEventListener('click', () => downloadAsDocx(text));
    
    const codeCopyBtns = messageDiv.querySelectorAll('.code-copy-btn');
    codeCopyBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const code = this.closest('.code-block').querySelector('code').innerText;
            copyToClipboard(code);
        });
    });
  }

  wrapper.appendChild(headerDiv);
  wrapper.appendChild(messageDiv);
  
  messagesContainer.insertBefore(wrapper, typingIndicator);
  if (scroll) messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ФУНКЦИЯ ДЛЯ ДОБАВЛЕНИЯ КАРТИНКИ В ЧАТ
function addImageToUI(sender, imageUrl, senderName, scroll = true) {
  if (!messagesContainer || !typingIndicator) return;
  
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${sender}`;
  
  const headerDiv = document.createElement('div');
  headerDiv.className = 'message-header';
  headerDiv.innerHTML = `
    <div class="sender-name">${senderName}</div>
    <div class="message-time">${getCurrentTime()}</div>
  `;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message-body'; 
  
  // Вставляем картинку
  messageDiv.innerHTML = `
    <img src="${imageUrl}" class="generated-image" alt="Сгенерированное изображение">
    <div class="message-actions">
      <a href="${imageUrl}" download="generated_image.png" class="action-btn"><i class="fas fa-download"></i> Скачать</a>
    </div>
  `;

  wrapper.appendChild(headerDiv);
  wrapper.appendChild(messageDiv);
  
  messagesContainer.insertBefore(wrapper, typingIndicator);
  if (scroll) messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// НОВАЯ ФУНКЦИЯ ДЛЯ ФОРМАТИРОВАНИЯ ТЕКСТА И КОДА
function formatMessageText(text) {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  
  let result = text.replace(codeBlockRegex, (match, lang, code) => {
    const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    return `
      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">${lang || 'code'}</span>
          <button class="code-copy-btn"><i class="fas fa-copy"></i> Копировать</button>
        </div>
        <pre><code>${escapedCode}</code></pre>
      </div>
    `;
  });

  return result.replace(/\n/g, '<br>');
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
