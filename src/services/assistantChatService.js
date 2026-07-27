import api from './api';

const assistantChatService = {
  sendMessage: (message, sessionId = null) =>
    api.post('/assistant/chat', { message, sessionId }, { timeout: 18000 }).then((response) => response.data),
  getHistory: (sessionId) =>
    api.get(`/assistant/chat/${sessionId}`, { timeout: 10000 }).then((response) => response.data),
};

export default assistantChatService;
