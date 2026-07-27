import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import chatService from '../../../services/chatService';
import { createChatHubConnection } from '../../../services/chatRealtimeService';
import './Chat.css';

const PAGE_SIZE = 30;

function getDisplayName(participant) {
  return participant?.displayName || participant?.email || 'ReTrade User';
}

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRoomTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) return formatTime(value);
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function initials(name) {
  if (!name) return 'RT';
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export default function Chat({ basePath = '/chat' }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [connectionReady, setConnectionReady] = useState(false);
  const connectionRef = useRef(null);
  const messagesRef = useRef(null);
  const bottomRef = useRef(null);
  const imageInputRef = useRef(null);
  const activeRoomRef = useRef(roomId);
  const skipNextAutoScrollRef = useRef(false);

  useEffect(() => {
    activeRoomRef.current = roomId;
  }, [roomId]);

  const activeRoom = useMemo(
    () => rooms.find((room) => room.roomId === roomId) || null,
    [rooms, roomId]
  );

  const loadRooms = useCallback(async () => {
    if (!user) return;
    setRoomsLoading(true);
    try {
      const data = await chatService.getRooms();
      const list = Array.isArray(data) ? data : [];
      setRooms(list);
      if (!roomId && list.length > 0) {
        navigate(`${basePath}/${list[0].roomId}`, { replace: true });
      }
    } catch (error) {
      const msg = error.response?.data || error.message || 'Failed to load conversations.';
      showToast(String(msg), 'error');
    } finally {
      setRoomsLoading(false);
    }
  }, [basePath, navigate, roomId, showToast, user]);

  const loadMessages = useCallback(async (targetRoomId, targetPage = 1, appendOlder = false) => {
    if (!targetRoomId) return;
    if (appendOlder) setOlderLoading(true);
    else setMessagesLoading(true);

    try {
      const data = await chatService.getMessages(targetRoomId, targetPage, PAGE_SIZE);
      const list = Array.isArray(data) ? data : [];

      if (appendOlder) {
        skipNextAutoScrollRef.current = true;
      }

      setMessages((current) => {
        if (!appendOlder) return list;
        const existingIds = new Set(current.map((item) => item.chatId));
        return [...list.filter((item) => !existingIds.has(item.chatId)), ...current];
      });
      setHasMore(list.length === PAGE_SIZE);
      setPage(targetPage);

      if (targetPage === 1) {
        await chatService.markAsRead(targetRoomId);
        setRooms((current) => current.map((room) =>
          room.roomId === targetRoomId ? { ...room, unreadCount: 0 } : room
        ));
      }
    } catch (error) {
      const msg = error.response?.data || error.message || 'Failed to load messages.';
      showToast(String(msg), 'error');
    } finally {
      setMessagesLoading(false);
      setOlderLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!authLoading && user) {
      loadRooms();
    }
  }, [authLoading, loadRooms, user]);

  useEffect(() => {
    if (roomId) {
      loadMessages(roomId, 1, false);
    } else {
      setMessages([]);
    }
  }, [loadMessages, roomId]);

  useEffect(() => {
    if (!user) return undefined;

    const connection = createChatHubConnection();
    connectionRef.current = connection;
    let disposed = false;

    const upsertMessage = (message) => {
      setMessages((current) => {
        if (activeRoomRef.current !== message.roomId) return current;
        if (current.some((item) => item.chatId === message.chatId)) return current;
        return [...current, message];
      });

      setRooms((current) => current.map((room) => {
        if (room.roomId !== message.roomId) return room;
        const isOwnMessage = message.senderId === user.userId;
        const isActive = activeRoomRef.current === message.roomId;
        return {
          ...room,
          lastMessage: message,
          unreadCount: isOwnMessage || isActive ? room.unreadCount : (room.unreadCount || 0) + 1,
          updatedAt: message.createdAt || new Date().toISOString(),
        };
      }));

      if (activeRoomRef.current === message.roomId && message.senderId !== user.userId) {
        chatService.markAsRead(message.roomId).catch(() => {});
      }
    };

    const handleNotification = (payload) => {
      const message = payload?.message || payload?.Message;
      if (!message || activeRoomRef.current === message.roomId) return;
      setRooms((current) => current.map((room) => (
        room.roomId === message.roomId
          ? {
              ...room,
              lastMessage: message,
              unreadCount: (room.unreadCount || 0) + 1,
              updatedAt: message.createdAt || new Date().toISOString(),
            }
          : room
      )));
    };

    const handleMessagesRead = (payload) => {
      const readerId = payload?.readerId || payload?.ReaderId;
      if (!readerId || readerId === user.userId) return;
      setMessages((current) => current.map((message) =>
        message.senderId === user.userId ? { ...message, isRead: true, readAt: payload.readAt || payload.ReadAt } : message
      ));
    };

    connection.on('ReceiveMessage', upsertMessage);
    connection.on('ChatNotification', handleNotification);
    connection.on('MessagesRead', handleMessagesRead);

    const start = async () => {
      try {
        await connection.start();
        if (!disposed) {
          await connection.invoke('JoinUserNotifications');
          setConnectionReady(true);
        }
      } catch (error) {
        console.error('Failed to connect chat hub:', error);
      }
    };

    start();

    return () => {
      disposed = true;
      setConnectionReady(false);
      connection.off('ReceiveMessage', upsertMessage);
      connection.off('ChatNotification', handleNotification);
      connection.off('MessagesRead', handleMessagesRead);
      connection.stop().catch(() => {});
    };
  }, [user]);

  useEffect(() => {
    const connection = connectionRef.current;
    if (!connectionReady || !connection || !roomId) return undefined;

    connection.invoke('JoinRoom', roomId).catch(() => {});
    return () => {
      connection.invoke('LeaveRoom', roomId).catch(() => {});
    };
  }, [connectionReady, roomId]);

  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }

    const container = messagesRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages.length, roomId]);

  const handleLoadOlder = () => {
    if (!roomId || olderLoading || !hasMore) return;
    loadMessages(roomId, page + 1, true);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const text = messageText.trim();
    if (!roomId || !text || sending) return;

    setSending(true);
    try {
      const message = await chatService.sendMessage(roomId, text);
      setMessageText('');
      setMessages((current) => (
        current.some((item) => item.chatId === message.chatId) ? current : [...current, message]
      ));
      setRooms((current) => current.map((room) =>
        room.roomId === roomId ? { ...room, lastMessage: message, updatedAt: message.createdAt } : room
      ));
    } catch (error) {
      const msg = error.response?.data || error.message || 'Failed to send message.';
      showToast(String(msg), 'error');
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!roomId || !file || uploadingImage) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file.', 'warning');
      return;
    }

    setUploadingImage(true);
    try {
      const result = await chatService.uploadImage(file);
      if (!result?.imageUrl) {
        throw new Error('Image upload failed.');
      }

      const message = await chatService.sendMessage(roomId, result.imageUrl, 'Image');
      setMessages((current) => (
        current.some((item) => item.chatId === message.chatId) ? current : [...current, message]
      ));
      setRooms((current) => current.map((room) =>
        room.roomId === roomId ? { ...room, lastMessage: message, updatedAt: message.createdAt } : room
      ));
    } catch (error) {
      const msg = error.response?.data || error.message || 'Failed to send image.';
      showToast(String(msg), 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="chat-page">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div>
            <span className="chat-kicker">Messages</span>
            <h1>Conversations</h1>
          </div>
          <button type="button" className="chat-refresh-btn" onClick={loadRooms} title="Refresh">
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>

        <div className="chat-room-list">
          {roomsLoading ? (
            <div className="chat-state">Loading conversations...</div>
          ) : rooms.length === 0 ? (
            <div className="chat-empty-list">
              <span className="material-symbols-outlined">forum</span>
              <strong>No conversations yet</strong>
              <p>Start from a product page by contacting the seller.</p>
            </div>
          ) : (
            rooms.map((room) => {
              const title = getDisplayName(room.otherParticipant) || room.productName || 'Conversation';
              const active = room.roomId === roomId;
              return (
                <button
                  type="button"
                  key={room.roomId}
                  className={`chat-room-item ${active ? 'active' : ''}`}
                  onClick={() => navigate(`${basePath}/${room.roomId}`)}
                >
                  <div className="chat-room-avatar">
                    {room.productImageUrl ? <img src={room.productImageUrl} alt={room.productName || 'Product'} /> : initials(title)}
                  </div>
                  <div className="chat-room-main">
                    <div className="chat-room-topline">
                      <span>{title}</span>
                      <time>{formatRoomTime(room.lastMessage?.createdAt || room.updatedAt)}</time>
                    </div>
                    <div className="chat-room-product">{room.productName || 'Support conversation'}</div>
                    <div className="chat-room-preview">
                      {room.lastMessage?.messageType === 'Image' ? 'Image' : (room.lastMessage?.message || 'No messages yet')}
                    </div>
                  </div>
                  {room.unreadCount > 0 && <span className="chat-unread-badge">{room.unreadCount}</span>}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="chat-panel">
        {!roomId ? (
          <div className="chat-no-room">
            <span className="material-symbols-outlined">mark_unread_chat_alt</span>
            <h2>Select a conversation</h2>
            <p>Your real-time messages will appear here.</p>
          </div>
        ) : (
          <>
            <header className="chat-panel-header">
              <div className="chat-peer-avatar">
                {activeRoom?.productImageUrl ? (
                  <img src={activeRoom.productImageUrl} alt={activeRoom.productName || 'Product'} />
                ) : (
                  initials(getDisplayName(activeRoom?.otherParticipant))
                )}
              </div>
              <div>
                <h2>{getDisplayName(activeRoom?.otherParticipant)}</h2>
                <p>{activeRoom?.productName || 'Conversation'}</p>
              </div>
              <div className={`chat-live-pill ${connectionReady ? 'online' : ''}`}>
                <span />
                {connectionReady ? 'Live' : 'Connecting'}
              </div>
            </header>

            <div className="chat-messages" ref={messagesRef}>
              {hasMore && messages.length > 0 && (
                <button type="button" className="chat-load-more" onClick={handleLoadOlder} disabled={olderLoading}>
                  {olderLoading ? 'Loading...' : 'Load older messages'}
                </button>
              )}

              {messagesLoading ? (
                <div className="chat-state">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="chat-empty-thread">
                  <span className="material-symbols-outlined">chat_bubble</span>
                  <strong>Start the conversation</strong>
                  <p>Send a message about delivery, condition, negotiation, or support.</p>
                </div>
              ) : (
                messages.map((message) => {
                  const mine = message.senderId === user?.userId;
                  return (
                    <div key={message.chatId} className={`chat-message-row ${mine ? 'mine' : 'theirs'}`}>
                      {!mine && (
                        <div className="chat-message-avatar">
                          {message.senderAvatarUrl ? <img src={message.senderAvatarUrl} alt={message.senderName || 'Sender'} /> : initials(message.senderName)}
                        </div>
                      )}
                      <div className="chat-message-bubble">
                        {message.messageType === 'Image' ? (
                          <a href={message.message} target="_blank" rel="noreferrer" className="chat-image-link">
                            <img src={message.message} alt="Chat attachment" className="chat-message-image" />
                          </a>
                        ) : (
                          <p>{message.message}</p>
                        )}
                        <div className="chat-message-meta">
                          <time>{formatTime(message.createdAt)}</time>
                          {mine && (
                            <span className="material-symbols-outlined">
                              {message.isRead ? 'done_all' : 'done'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form className="chat-composer" onSubmit={handleSend}>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="chat-image-input"
                onChange={handleImageSelect}
              />
              <button
                type="button"
                className="chat-attach-btn"
                disabled={!roomId || uploadingImage}
                onClick={() => imageInputRef.current?.click()}
                title="Send image"
              >
                <span className="material-symbols-outlined">{uploadingImage ? 'hourglass_empty' : 'image'}</span>
              </button>
              <textarea
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder="Write a message..."
                maxLength={2000}
                rows={1}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend(event);
                  }
                }}
              />
              <button type="submit" disabled={!messageText.trim() || sending}>
                <span className="material-symbols-outlined">{sending ? 'hourglass_empty' : 'send'}</span>
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
