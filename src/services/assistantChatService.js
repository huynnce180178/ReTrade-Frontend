import api from './api';

const assistantChatService = {
  sendMessage: (message, sessionId = null, language = 'en') =>
    api.post('/assistant/chat', { message, sessionId, language }, { timeout: 18000 }).then((response) => response.data),
  getHistory: (sessionId) =>
    api.get(`/assistant/chat/${sessionId}`, { timeout: 10000 }).then((response) => response.data),
};

export default assistantChatService;
