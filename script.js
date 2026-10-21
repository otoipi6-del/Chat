// DOM Elements
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const messagesContainer = document.getElementById('messagesContainer');
    const typingIndicator = document.getElementById('typingIndicator');

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
      
      // Enable/disable send button based on input
      sendButton.disabled = this.value.trim() === '';
    });

    // Send message on Enter (Shift+Enter for new line)
    messageInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.disabled) {
          sendMessage();
        }
      }
    });

    // Send button click handler
    sendButton.addEventListener('click', sendMessage);

    // Function to send a message
    function sendMessage() {
      const messageText = messageInput.value.trim();
      if (messageText === '') return;

      // Add user message to chat
      addMessage('user', messageText, 'You');
      
      // Clear input
      messageInput.value = '';
      messageInput.style.height = 'auto';
      sendButton.disabled = true;
      
      // Show typing indicator
      typingIndicator.style.display = 'flex';
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      // Simulate AI response after delay
      setTimeout(() => {
        typingIndicator.style.display = 'none';
        const aiResponse = generateAIResponse(messageText);
        addMessage('ai', aiResponse, 'DeepSeek');
      }, 1500);
    }

    // Function to add a message to the chat
    function addMessage(sender, text, senderName) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message';
      
      const isAI = sender === 'ai';
      
      messageDiv.innerHTML = `
        <div class="avatar ${isAI ? 'ai-avatar' : 'user-avatar'}">${isAI ? '<i class="fas fa-robot"></i>' : 'JD'}</div>
        <div class="message-content">
          <div class="message-header">
            <div class="sender-name">${senderName}</div>
            <div class="message-time">${getCurrentTime()}</div>
          </div>
          <div class="message-text ${isAI ? 'ai-message' : 'user-message'}">
            ${formatMessageText(text)}
          </div>
        </div>
      `;
      
      messagesContainer.insertBefore(messageDiv, typingIndicator);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Helper function to format message text (simple formatting for demo)
    function formatMessageText(text) {
      // Convert line breaks to <br>
      return text.replace(/\n/g, '<br>');
    }

    // Helper function to get current time in HH:MM AM/PM format
    function getCurrentTime() {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      return `${hours}:${minutes} ${ampm}`;
    }

    // Simple AI response generator (for demo)
    function generateAIResponse(userMessage) {
      const responses = [
        "I understand you're asking about JavaScript learning. The key is consistent practice and building projects.",
        "That's a great question! JavaScript can be learned effectively by focusing on practical applications.",
        "Based on your query, I recommend starting with core concepts before moving to frameworks.",
        "Many learners find success with a structured approach. Would you like me to outline a study plan?",
        "JavaScript mastery comes from understanding both theory and practice. Let me suggest some exercises."
      ];
      
      // Simple keyword-based response
      if (userMessage.toLowerCase().includes('resource') || userMessage.toLowerCase().includes('learn')) {
        return `For learning resources, I recommend:<br><br>
                - MDN Web Docs (comprehensive reference)<br>
                - freeCodeCamp (interactive tutorials)<br>
                - Eloquent JavaScript (free online book)<br><br>
                Practice daily with small coding challenges to reinforce concepts.`;
      }
      
      if (userMessage.toLowerCase().includes('time') || userMessage.toLowerCase().includes('long')) {
        return `The time needed to learn JavaScript depends on your background:<br><br>
                - Basic proficiency: 2-3 months with daily practice<br>
                - Intermediate level: 6 months with project work<br>
                - Advanced concepts: 1+ year of consistent learning<br><br>
                Focus on understanding rather than rushing through topics.`;
      }
      
      // Default random response
      return responses[Math.floor(Math.random() * responses.length)];
    }

    // Chat history item click handler
    document.querySelectorAll('.chat-item').forEach(item => {
      item.addEventListener('click', function() {
        document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        // In a real app, this would load the selected conversation
      });
    });

    // New chat button handler
    document.querySelector('.new-chat-btn').addEventListener('click', function() {
      // In a real app, this would start a new conversation
      alert('Starting a new chat...');
    });