import api from './api';

const chatService = {
  getRooms: () => api.get('/Chat/rooms').then((response) => response.data),
  getOrCreateRoom: (productId) => api.post('/Chat/rooms', { productId }).then((response) => response.data),
  getOrCreateSellerRoom: (sellerId) => api.post('/Chat/rooms', { sellerId }).then((response) => response.data),
  getMessages: (roomId, page = 1, limit = 30) =>
    api.get(`/Chat/${roomId}/messages`, { params: { page, limit } }).then((response) => response.data),
  sendMessage: (roomId, message, messageType = 'Text') =>
    api.post(`/Chat/${roomId}/messages`, { message, messageType }).then((response) => response.data),
  deleteMessage: (roomId, messageId) =>
    api.delete(`/Chat/${roomId}/messages/${messageId}`).then((response) => response.data),
  clearRoomMessages: (roomId) =>
    api.delete(`/Chat/${roomId}/messages`).then((response) => response.data),

  recallMessage: (roomId, messageId) =>
    api.post(`/Chat/${roomId}/messages/${messageId}/recall`).then((response) => response.data),
  markAsRead: (roomId) => api.put(`/Chat/${roomId}/read`).then((response) => response.data),
  uploadImage: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/Chat/upload-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((response) => response.data);
  },
};

export default chatService;
