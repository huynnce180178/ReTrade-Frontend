import api from './api';

const assistantChatService = {
  sendMessage: (message, imageBase64 = null, sessionId = null, language = 'en') =>
    api.post('/assistant/chat', { message, imageBase64, sessionId, language }, { timeout: 25000 }).then((response) => response.data),
  getHistory: (sessionId) =>
    api.get(`/assistant/chat/${sessionId}`, { timeout: 10000 }).then((response) => response.data),
};

export default assistantChatService;
