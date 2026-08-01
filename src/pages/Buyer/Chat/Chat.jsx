import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import chatService from '../../../services/chatService';
import { createChatHubConnection } from '../../../services/chatRealtimeService';
import productService from '../../../services/productService';
import './Chat.css';

const PAGE_SIZE = 30;
const QUICK_REACTIONS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F60A}', '\u{1F525}', '\u{1F389}'];

const EMOJI_CATEGORIES = [
  {
    id: 'popular',
    nameVi: 'Phổ biến',
    nameEn: 'Popular',
    emojis: ['👍', '❤️', '😊', '🔥', '🎉', '👏', '🙏', '💯', '✨', '⭐', '😍', '🥰', '😂', '🤣', '🤝', '🤝'],
  },
  {
    id: 'faces',
    nameVi: 'Biểu cảm',
    nameEn: 'Faces',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '😜', '🤪', '😎', '🤓', '🧐', '🤔', '🫣', '🤫', '🫡', '😳', '🥺', '😭', '😤', '😡', '😴', '🥳'],
  },
  {
    id: 'hands',
    nameVi: 'Bàn tay',
    nameEn: 'Hands',
    emojis: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🖐️', '✋', '🖖', '👋', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪'],
  },
  {
    id: 'trade',
    nameVi: 'Giao dịch',
    nameEn: 'Trade',
    emojis: ['📦', '🛍️', '🏷️', '💰', '💵', '💳', '🎁', '🚚', '🛒', '💡', '🚀', '⭐', '💬', '📢', '✅', '❌', '❓', '❗'],
  },
];


function getDisplayName(participant) {
  return participant?.displayName || participant?.email || 'ReTrade User';
}

function formatTime(value, language) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRoomTime(value, language) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) return formatTime(value, language);
  return date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit' });
}

function initials(name) {
  if (!name) return 'RT';
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function getRoomTitle(room, t, customTitles = {}) {
  if (!room) return t ? t('chat.conversations') : 'Conversations';
  if (customTitles[room.roomId]) return customTitles[room.roomId];
  if (room.roomType === 'Business' || !room.productId) {
    return t ? t('chat.direct_chat') : 'Direct Conversation';
  }
  return room.productName || getDisplayName(room.otherParticipant) || (t ? t('chat.conversations') : 'Conversations');
}

function getRoomSubtitle(room, t) {
  if (!room) return '';
  if (room.roomType === 'Business' || !room.productId) return t ? t('chat.direct_chat_sub') : 'General Queries';
  return getDisplayName(room.otherParticipant);
}


function getMessagePreview(message, t) {
  if (!message) return t ? t('chat.no_messages') : 'No messages yet';
  if (message.isRecalled || message.messageType === 'Recall') return t ? t('chat.message_recalled') : 'Message recalled';
  if (message.messageType === 'Image') return t ? t('chat.image_attachment') : '[Image]';
  return message.message || (t ? t('chat.no_messages') : 'No messages yet');
}


function shouldShowProductIntro(message, room) {
  return room?.roomType === 'Product' && message?.messageType === 'Auto' && room.productName;
}

export default function Chat({ basePath = '/chat' }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t, language, formatCurrency } = useLanguage();
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
  const [productDetailsById, setProductDetailsById] = useState({});
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

  const [customTitles, setCustomTitles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('retrade_chat_custom_titles') || '{}');
    } catch {
      return {};
    }
  });
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [creatingDirectChat, setCreatingDirectChat] = useState(false);
  const [activeMenuChatId, setActiveMenuChatId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('popular');
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stagedImages, setStagedImages] = useState([]);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [editingImageIndex, setEditingImageIndex] = useState(null);
  const [isClearChatModalOpen, setIsClearChatModalOpen] = useState(false);

  const handleClearChatHistory = useCallback(async () => {
    if (!activeRoom?.roomId) return;
    try {
      await chatService.clearRoomMessages(activeRoom.roomId);
      setMessages((prev) => prev.filter((m) => m.messageType === 'Auto' || m.chatType === 'Auto'));
      setIsClearChatModalOpen(false);
      showToast(t('chat.clear_chat_success'), 'success');
    } catch {
      // Fallback: If bulk endpoint isn't loaded by running backend, delete non-Auto messages using individual delete endpoint
      try {
        const nonAutoMessages = messages.filter((m) => m.messageType !== 'Auto' && m.chatType !== 'Auto');
        if (nonAutoMessages.length > 0) {
          await Promise.allSettled(
            nonAutoMessages.map((m) => chatService.deleteMessage(activeRoom.roomId, m.chatId))
          );
        }
        setMessages((prev) => prev.filter((m) => m.messageType === 'Auto' || m.chatType === 'Auto'));
        setIsClearChatModalOpen(false);
        showToast(t('chat.clear_chat_success'), 'success');
      } catch {
        showToast(t('chat.clear_chat_failed'), 'error');
      }
    }
  }, [activeRoom, messages, t, showToast]);





  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuChatId(null);
      setShowEmojiPicker(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleCopyMessageText = useCallback((text) => {
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(t('chat.message_copied'), 'success');
      }).catch(() => {});
    }
    setActiveMenuChatId(null);
  }, [showToast, t]);

  const handleDownloadImage = useCallback(async (url) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `retrade_photo_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  }, []);



  const filteredMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];
    if (!searchQuery || !searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase().trim();
    return messages.filter((m) => {
      if (!m || !m.message) return false;
      return String(m.message).toLowerCase().includes(q);
    });
  }, [messages, searchQuery]);

  const sharedImages = useMemo(() => {
    if (!Array.isArray(messages)) return [];
    return messages.filter((m) => {
      if (!m || m.isRecalled) return false;
      if (m.messageType === 'Image') return true;
      const str = String(m.message || '');
      return str.startsWith('http') || str.includes('/uploads/') || str.match(/\.(jpeg|jpg|png|webp|gif)(\?.*)?$/i);
    });
  }, [messages]);



  const [expandedPartners, setExpandedPartners] = useState({});

  const { partnerGroups, systemRooms } = useMemo(() => {
    const sys = [];
    const map = new Map();

    for (const room of rooms) {
      const partnerId = room.otherParticipant?.userId || room.otherParticipant?.email;
      if (!partnerId) {
        sys.push(room);
        continue;
      }

      if (!map.has(partnerId)) {
        map.set(partnerId, {
          partnerId,
          partner: room.otherParticipant,
          rooms: [],
          totalUnreadCount: 0,
          latestTime: 0,
          latestMessage: null,
        });
      }

      const group = map.get(partnerId);
      group.rooms.push(room);
      group.totalUnreadCount += room.unreadCount || 0;

      const roomTime = new Date(room.lastMessage?.createdAt || room.updatedAt || 0).getTime();
      if (roomTime > group.latestTime) {
        group.latestTime = roomTime;
        group.latestMessage = room.lastMessage;
      }
    }

    const groups = Array.from(map.values()).map((g) => {
      const businessRoom = g.rooms.find((r) => r.roomType === 'Business' || !r.productId) || null;
      const productRooms = g.rooms.filter((r) => r.roomType !== 'Business' && r.productId);

      productRooms.sort((a, b) => {
        const timeA = new Date(a.lastMessage?.createdAt || a.updatedAt || 0).getTime();
        const timeB = new Date(b.lastMessage?.createdAt || b.updatedAt || 0).getTime();
        return timeB - timeA;
      });

      return {
        ...g,
        businessRoom,
        productRooms,
      };
    });

    groups.sort((a, b) => b.latestTime - a.latestTime);

    return { partnerGroups: groups, systemRooms: sys };
  }, [rooms]);

  useEffect(() => {
    if (!roomId || partnerGroups.length === 0) return;
    const matchingGroup = partnerGroups.find((g) => g.rooms.some((r) => r.roomId === roomId));
    if (matchingGroup) {
      setExpandedPartners((prev) => ({
        ...prev,
        [matchingGroup.partnerId]: true,
      }));
    }
  }, [roomId, partnerGroups]);

  const togglePartnerExpand = (partnerId) => {
    setExpandedPartners((prev) => {
      const isCurrentlyExpanded = prev[partnerId] !== undefined
        ? prev[partnerId]
        : partnerGroups.find((g) => g.partnerId === partnerId)?.rooms.some((r) => r.roomId === roomId);
      return {
        ...prev,
        [partnerId]: !isCurrentlyExpanded,
      };
    });
  };

  const saveCustomTitle = (targetRoomId, newTitle) => {
    setCustomTitles((prev) => {
      const updated = { ...prev };
      if (newTitle && newTitle.trim()) {
        updated[targetRoomId] = newTitle.trim();
      } else {
        delete updated[targetRoomId];
      }
      localStorage.setItem('retrade_chat_custom_titles', JSON.stringify(updated));
      return updated;
    });
    showToast(t('chat.room_renamed_success'), 'success');
    setIsRenameModalOpen(false);
  };

  const handleOpenOrCreateDirectChat = async (partnerId, existingBusinessRoom) => {
    if (existingBusinessRoom) {
      navigate(`${basePath}/${existingBusinessRoom.roomId}`);
      return;
    }

    setCreatingDirectChat(true);
    try {
      const room = await chatService.createRoom({ sellerId: partnerId, productId: null });
      if (room?.roomId) {
        setRooms((prev) => (prev.some((r) => r.roomId === room.roomId) ? prev : [room, ...prev]));
        navigate(`${basePath}/${room.roomId}`);
      }
    } catch (error) {
      const msg = error.response?.data || error.message || t('common.error_occurred');
      showToast(String(msg), 'error');
    } finally {
      setCreatingDirectChat(false);
    }
  };




  const getProductPrice = useCallback((room) => {
    if (!room?.productId) return null;
    return room.productPrice ?? productDetailsById[room.productId]?.price ?? null;
  }, [productDetailsById]);

  useEffect(() => {
    if (!activeRoom?.productId || activeRoom.productPrice !== undefined || productDetailsById[activeRoom.productId]) {
      return undefined;
    }

    let disposed = false;
    productService.getById(activeRoom.productId)
      .then((product) => {
        if (disposed || !product) return;
        setProductDetailsById((current) => ({
          ...current,
          [activeRoom.productId]: product,
        }));
      })
      .catch(() => {});

    return () => {
      disposed = true;
    };
  }, [activeRoom?.productId, activeRoom?.productPrice, productDetailsById]);

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
      const msg = error.response?.data || error.message || t('chat.load_conversations_error');
      showToast(String(msg), 'error');
    } finally {
      setRoomsLoading(false);
    }
  }, [basePath, navigate, roomId, showToast, user, t]);

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
        setMessages((current) => current.map((msg) => ({ ...msg, isRead: true })));
      }

    } catch (error) {
      const msg = error.response?.data || error.message || t('chat.load_messages_error');
      showToast(String(msg), 'error');
    } finally {
      setMessagesLoading(false);
      setOlderLoading(false);
    }
  }, [showToast, t]);


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

    const handleMessageRecalled = (message) => {
      if (!message?.chatId) return;
      setMessages((current) => current.map((item) =>
        item.chatId === message.chatId ? { ...item, ...message, isRecalled: true } : item
      ));
      setRooms((current) => current.map((room) =>
        room.roomId === message.roomId && room.lastMessage?.chatId === message.chatId
          ? { ...room, lastMessage: { ...room.lastMessage, ...message, isRecalled: true } }
          : room
      ));
    };

    const handleMessageDeleted = (payload) => {
      const chatId = payload?.chatId || payload?.ChatId;
      const payloadRoomId = payload?.roomId || payload?.RoomId;
      if (!chatId || payloadRoomId !== activeRoomRef.current) return;
      setMessages((current) => current.filter((message) => message.chatId !== chatId));
    };

    connection.on('ReceiveMessage', upsertMessage);
    connection.on('ChatNotification', handleNotification);
    connection.on('MessagesRead', handleMessagesRead);
    connection.on('MessageRecalled', handleMessageRecalled);
    connection.on('MessageDeleted', handleMessageDeleted);

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
      connection.off('MessageRecalled', handleMessageRecalled);
      connection.off('MessageDeleted', handleMessageDeleted);
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
    if (event) event.preventDefault();
    const text = messageText.trim();
    const hasStaged = stagedImages.length > 0;
    if (!roomId || (!text && !hasStaged) || sending || uploadingImage) return;

    setSending(true);
    try {
      // 1. Send staged images sequentially
      if (hasStaged) {
        setUploadingImage(true);
        for (const item of stagedImages) {
          let fileToSend = item.file;
          if (item.previewUrl.startsWith('data:image')) {
            const res = await fetch(item.previewUrl);
            const blob = await res.blob();
            fileToSend = new File([blob], `annotated_${Date.now()}.png`, { type: 'image/png' });
          }
          const result = await chatService.uploadImage(fileToSend);
          if (result?.imageUrl) {
            const message = await chatService.sendMessage(roomId, result.imageUrl, 'Image');
            setMessages((current) => (
              current.some((i) => i.chatId === message.chatId) ? current : [...current, message]
            ));
            setRooms((current) => current.map((room) =>
              room.roomId === roomId ? { ...room, lastMessage: message, updatedAt: message.createdAt } : room
            ));
          }
        }
        setStagedImages([]);
        setUploadingImage(false);
      }

      // 2. Send text message
      if (text) {
        const message = await chatService.sendMessage(roomId, text, 'Text');
        setMessageText('');
        setMessages((current) => (
          current.some((item) => item.chatId === message.chatId) ? current : [...current, message]
        ));
        setRooms((current) => current.map((room) =>
          room.roomId === roomId ? { ...room, lastMessage: message, updatedAt: message.createdAt } : room
        ));
      }
    } catch (error) {
      const msg = error.response?.data || error.message || t('chat.send_message_error');
      showToast(String(msg), 'error');
    } finally {
      setSending(false);
      setUploadingImage(false);
    }
  };

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const validFiles = files.filter((f) => f.type.startsWith('image/'));
    if (validFiles.length < files.length) {
      showToast(t('chat.select_image_warning'), 'warning');
    }

    const newItems = validFiles.map((file) => ({
      id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setStagedImages((prev) => [...prev, ...newItems]);
  };


  const handleDeleteMessage = async (message) => {
    if (!roomId || !message?.chatId) return;

    try {
      await chatService.deleteMessage(roomId, message.chatId);
      setMessages((current) => current.filter((item) => item.chatId !== message.chatId));
      setRooms((current) => current.map((room) =>
        room.roomId === roomId && room.lastMessage?.chatId === message.chatId
          ? { ...room, lastMessage: null }
          : room
      ));
    } catch (error) {
      const msg = error.response?.data || error.message || t('chat.delete_message_error');
      showToast(String(msg), 'error');
    }
  };

  const handleRecallMessage = async (message) => {
    if (!roomId || !message?.chatId) return;

    try {
      const recalled = await chatService.recallMessage(roomId, message.chatId);
      setMessages((current) => current.map((item) =>
        item.chatId === recalled.chatId ? { ...item, ...recalled, isRecalled: true } : item
      ));
      setRooms((current) => current.map((room) =>
        room.roomId === roomId && room.lastMessage?.chatId === recalled.chatId
          ? { ...room, lastMessage: { ...room.lastMessage, ...recalled, isRecalled: true } }
          : room
      ));
    } catch (error) {
      const msg = error.response?.data || error.message || t('chat.recall_message_error');
      showToast(String(msg), 'error');
    }
  };


  const handleQuickReaction = (reaction) => {
    setMessageText((current) => `${current}${current ? ' ' : ''}${reaction}`);
  };

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={`chat-page ${showInfoSidebar && activeRoom ? 'has-right-sidebar' : ''}`}>

      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div>
            <span className="chat-kicker">{t('nav.chat')}</span>
            <h1>{t('chat.conversations')}</h1>
          </div>
          <button type="button" className="chat-refresh-btn" onClick={loadRooms} title={t('chat.refresh')}>
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>

        <div className="chat-room-list">
          {roomsLoading ? (
            <div className="chat-state">{t('chat.loading_conversations')}</div>
          ) : rooms.length === 0 ? (
            <div className="chat-empty-list">
              <span className="material-symbols-outlined">forum</span>
              <strong>{t('chat.no_conversations')}</strong>
              <p>{t('chat.start_from_product')}</p>
            </div>
          ) : (
            <>
              {/* Grouped Partner Rooms */}
              {partnerGroups.map((group) => {
                const partnerName = getDisplayName(group.partner);
                const isExpanded = expandedPartners[group.partnerId] !== undefined
                  ? expandedPartners[group.partnerId]
                  : group.rooms.some((r) => r.roomId === roomId);

                const hasActiveChild = group.rooms.some((r) => r.roomId === roomId);
                const businessRoom = group.businessRoom;
                const productRooms = group.productRooms;

                return (
                  <div key={group.partnerId} className={`chat-partner-group ${hasActiveChild ? 'has-active' : ''}`}>
                    <div
                      className={`chat-partner-header ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => togglePartnerExpand(group.partnerId)}
                    >
                      <div className="chat-room-avatar">
                        {group.partner?.avatarUrl ? (
                          <img src={group.partner.avatarUrl} alt={partnerName} />
                        ) : (
                          initials(partnerName)
                        )}
                      </div>
                      <div className="chat-room-main">
                        <div className="chat-room-topline">
                          <span>{partnerName}</span>
                          <time>{formatRoomTime(group.latestMessage?.createdAt || group.latestTime, language)}</time>
                        </div>
                        <div className="chat-partner-subtitle">
                          <span className="chat-partner-count">
                            {t('chat.products_count', { count: productRooms.length })}
                          </span>
                        </div>
                        <div className="chat-room-preview">{getMessagePreview(group.latestMessage, t)}</div>
                      </div>
                      <div className="chat-partner-actions">
                        {group.totalUnreadCount > 0 && (
                          <span className="chat-unread-badge">{group.totalUnreadCount}</span>
                        )}
                        <span className="material-symbols-outlined chat-expand-chevron">
                          {isExpanded ? 'expand_more' : 'chevron_right'}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="chat-sub-room-list">
                        {/* 1. Direct Business Chat Item at Top */}
                        <button
                          type="button"
                          className={`chat-sub-room-item direct-chat ${businessRoom && businessRoom.roomId === roomId ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOrCreateDirectChat(group.partnerId, businessRoom);
                          }}
                        >
                          <div className="chat-sub-room-avatar direct">
                            <span className="material-symbols-outlined">forum</span>
                          </div>
                          <div className="chat-sub-room-main">
                            <div className="chat-sub-room-topline">
                              <span className="chat-sub-room-name">
                                {businessRoom ? getRoomTitle(businessRoom, t, customTitles) : t('chat.direct_chat')}
                              </span>
                              <time>{businessRoom ? formatRoomTime(businessRoom.lastMessage?.createdAt || businessRoom.updatedAt, language) : ''}</time>
                            </div>
                            <div className="chat-room-preview">
                              {businessRoom ? getMessagePreview(businessRoom.lastMessage, t) : t('chat.direct_chat_sub')}
                            </div>
                          </div>
                          {businessRoom && businessRoom.unreadCount > 0 && (
                            <span className="chat-unread-badge sub">{businessRoom.unreadCount}</span>
                          )}
                        </button>

                        {/* 2. Product Chat Items */}
                        {productRooms.map((room) => {
                          const active = room.roomId === roomId;
                          return (
                            <button
                              type="button"
                              key={room.roomId}
                              className={`chat-sub-room-item ${active ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`${basePath}/${room.roomId}`);
                              }}
                            >
                              <div className="chat-sub-room-avatar">
                                {room.productImageUrl ? (
                                  <img src={room.productImageUrl} alt={room.productName || 'Product'} />
                                ) : (
                                  <span className="material-symbols-outlined">inventory_2</span>
                                )}
                              </div>
                              <div className="chat-sub-room-main">
                                <div className="chat-sub-room-topline">
                                  <span className="chat-sub-room-name">{getRoomTitle(room, t, customTitles)}</span>
                                  <time>{formatRoomTime(room.lastMessage?.createdAt || room.updatedAt, language)}</time>
                                </div>
                                <div className="chat-room-preview">{getMessagePreview(room.lastMessage, t)}</div>
                              </div>
                              {room.unreadCount > 0 && <span className="chat-unread-badge sub">{room.unreadCount}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

        </div>
      </aside>

      <section className="chat-panel">
        {!roomId ? (
          <div className="chat-no-room">
            <span className="material-symbols-outlined">mark_unread_chat_alt</span>
            <h2>{t('chat.select_conversation')}</h2>
            <p>{t('chat.realtime_messages_appear_here')}</p>
          </div>
        ) : (
          <>
            <header className="chat-panel-header">
              <div className="chat-peer-avatar">
                {activeRoom?.productImageUrl ? (
                  <img src={activeRoom.productImageUrl} alt={activeRoom.productName || getRoomTitle(activeRoom, t, customTitles)} />
                ) : (
                  initials(getRoomTitle(activeRoom, t, customTitles))
                )}
              </div>
              <div className="chat-header-info">
                <div className="chat-header-title-row">
                  <h2>{getRoomTitle(activeRoom, t, customTitles)}</h2>
                  <button
                    type="button"
                    className="chat-rename-btn"
                    onClick={() => {
                      setRenameInput(customTitles[activeRoom.roomId] || '');
                      setIsRenameModalOpen(true);
                    }}
                    title={t('chat.rename_room')}
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                </div>
                <p>
                  {activeRoom?.roomType === 'Business' || !activeRoom?.productId
                    ? t('chat.direct_chat_sub')
                    : t('chat.chat_with_user', { name: getDisplayName(activeRoom?.otherParticipant) })}
                </p>
              </div>
              <div className="chat-header-actions">
                <div className={`chat-live-pill ${connectionReady ? 'online' : ''}`}>
                  <span />
                  {connectionReady ? t('chat.online') : t('chat.connecting')}
                </div>
                <button
                  type="button"
                  className={`chat-info-toggle-btn ${showInfoSidebar ? 'active' : ''}`}
                  onClick={() => setShowInfoSidebar(!showInfoSidebar)}
                  title={t('chat.conversation_info')}
                >
                  <span className="material-symbols-outlined notranslate" translate="no">info</span>
                </button>
              </div>
            </header>

            <div className="chat-messages" ref={messagesRef}>
              {hasMore && messages.length > 0 && (
                <button type="button" className="chat-load-more" onClick={handleLoadOlder} disabled={olderLoading}>
                  {olderLoading ? t('common.loading') : t('chat.load_older')}
                </button>
              )}

              {messagesLoading ? (
                <div className="chat-state">{t('chat.loading_messages')}</div>
              ) : filteredMessages.length === 0 ? (
                <div className="chat-empty-thread">
                  <span className="material-symbols-outlined">chat_bubble</span>
                  <strong>{searchQuery ? t('chat.no_matching_messages') : t('chat.start_conversation')}</strong>
                  <p>{searchQuery ? t('chat.try_different_keyword') : t('chat.start_conversation_desc')}</p>
                </div>
              ) : (
                filteredMessages.map((message) => {
                  const mine = message.senderId === user?.userId;
                  const productPrice = shouldShowProductIntro(message, activeRoom) ? getProductPrice(activeRoom) : null;
                  const isImageMsg = message.messageType === 'Image';

                  return (
                    <div
                      key={message.chatId}
                      className={`chat-message-row ${mine ? 'mine' : 'theirs'}`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveMenuChatId(activeMenuChatId === message.chatId ? null : message.chatId);
                      }}
                    >
                      {!mine && (
                        <div className="chat-message-avatar">
                          {message.senderAvatarUrl ? <img src={message.senderAvatarUrl} alt={message.senderName || 'Sender'} /> : initials(message.senderName)}
                        </div>
                      )}

                      <div className="chat-message-content-wrapper">
                        <div className="chat-message-bubble-row">
                          {mine && (
                            <div className="chat-message-menu-wrapper">
                              <button
                                type="button"
                                className="chat-message-menu-trigger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuChatId(activeMenuChatId === message.chatId ? null : message.chatId);
                                }}
                                title={t('chat.actions')}
                              >
                                <span className="material-symbols-outlined notranslate" translate="no">more_horiz</span>
                              </button>

                              {activeMenuChatId === message.chatId && (
                                <div className="chat-message-dropdown" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="chat-dropdown-item"
                                    onClick={() => handleCopyMessageText(message.message)}
                                  >
                                    <span className="material-symbols-outlined">content_copy</span>
                                    <span>{t('chat.copy_message')}</span>
                                  </button>
                                  {mine && message.canRecall && !message.isRecalled && (
                                    <button
                                      type="button"
                                      className="chat-dropdown-item recall"
                                      onClick={() => {
                                        setActiveMenuChatId(null);
                                        handleRecallMessage(message);
                                      }}
                                    >
                                      <span className="material-symbols-outlined">undo</span>
                                      <span>{t('chat.recall')}</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="chat-dropdown-item delete"
                                    onClick={() => {
                                      setActiveMenuChatId(null);
                                      handleDeleteMessage(message);
                                    }}
                                  >
                                    <span className="material-symbols-outlined">delete_outline</span>
                                    <span>{t('common.delete')}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <div className={`chat-message-bubble ${isImageMsg ? 'is-image' : ''}`}>
                            {shouldShowProductIntro(message, activeRoom) && (
                              <div className="chat-product-intro-card">
                                <div className="chat-product-intro-image">
                                  {activeRoom.productImageUrl ? (
                                    <img src={activeRoom.productImageUrl} alt={activeRoom.productName || 'Product'} />
                                  ) : (
                                    <span className="material-symbols-outlined">inventory_2</span>
                                  )}
                                </div>
                                <div className="chat-product-intro-info">
                                  <span>{t('chat.interested_product')}</span>
                                  <strong>{activeRoom.productName}</strong>
                                  {productPrice !== null && productPrice !== undefined && (
                                    <b>{formatCurrency(productPrice)}</b>
                                  )}
                                </div>
                              </div>
                            )}

                            {message.isRecalled || message.messageType === 'Recall' ? (
                              <p className="chat-message-recalled">{t('chat.message_recalled')}</p>
                            ) : isImageMsg ? (
                              <div className="chat-image-wrapper" onClick={() => setPreviewImageUrl(message.message)}>
                                <img src={message.message} alt="Chat attachment" className="chat-message-image" />
                              </div>
                            ) : (
                              <p>{message.message}</p>
                            )}
                          </div>

                          {!mine && (
                            <div className="chat-message-menu-wrapper">
                              <button
                                type="button"
                                className="chat-message-menu-trigger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuChatId(activeMenuChatId === message.chatId ? null : message.chatId);
                                }}
                                title={t('chat.actions')}
                              >
                                <span className="material-symbols-outlined notranslate" translate="no">more_horiz</span>
                              </button>

                              {activeMenuChatId === message.chatId && (
                                <div className="chat-message-dropdown" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="chat-dropdown-item"
                                    onClick={() => handleCopyMessageText(message.message)}
                                  >
                                    <span className="material-symbols-outlined">content_copy</span>
                                    <span>{t('chat.copy_message')}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="chat-dropdown-item delete"
                                    onClick={() => {
                                      setActiveMenuChatId(null);
                                      handleDeleteMessage(message);
                                    }}
                                  >
                                    <span className="material-symbols-outlined">delete_outline</span>
                                    <span>{t('common.delete')}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Timestamp & Read Checkmarks OUTSIDE the bubble */}
                        <div className="chat-message-meta-outside">
                          <time>{formatTime(message.createdAt, language)}</time>
                          {mine && (
                            <span
                              className={`material-symbols-outlined chat-read-status ${message.isRead ? 'read' : 'unread'}`}
                              title={message.isRead ? t('chat.read_status') : t('chat.sent_status')}
                            >
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

            {/* Draft Staged Images Preview Bar (Positioned ABOVE composer input) */}
            {stagedImages.length > 0 && (
              <div className="chat-staging-bar">
                <div className="chat-staging-header">
                  <span>{t('chat.photos_count', { count: stagedImages.length })}</span>
                  <button
                    type="button"
                    className="chat-staging-clear-all"
                    onClick={() => setStagedImages([])}
                  >
                    {t('chat.clear_all')}
                  </button>
                </div>


                <div className="chat-staging-items">
                  {stagedImages.map((item, index) => (
                    <div key={item.id} className="chat-staging-card">
                      <img
                        src={item.previewUrl}
                        alt={`Draft ${index + 1}`}
                        onClick={() => setPreviewImageUrl(item.previewUrl)}
                      />
                      <div className="chat-staging-card-overlay">
                        <button
                          type="button"
                          className="chat-staging-btn edit"
                          onClick={() => setEditingImageIndex(index)}
                          title={t('chat.draw_edit_image')}
                        >
                          <span className="material-symbols-outlined notranslate" translate="no">edit</span>
                        </button>
                        <button
                          type="button"
                          className="chat-staging-btn delete"
                          onClick={() => setStagedImages((prev) => prev.filter((i) => i.id !== item.id))}
                          title={t('chat.remove_photo')}
                        >
                          <span className="material-symbols-outlined notranslate" translate="no">close</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="chat-staging-add-more"
                    onClick={() => imageInputRef.current?.click()}
                    title={t('chat.add_photo')}
                  >
                    <span className="material-symbols-outlined notranslate" translate="no">add</span>
                  </button>
                </div>
              </div>
            )}

            <form className="chat-composer" onSubmit={handleSend}>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="chat-image-input"
                onChange={handleImageSelect}
              />

              <div className="chat-composer-tools">
                <button
                  type="button"
                  className="chat-attach-btn"
                  disabled={!roomId || uploadingImage}
                  onClick={() => imageInputRef.current?.click()}
                  title={t('chat.send_image')}
                >
                  <span className="material-symbols-outlined">{uploadingImage ? 'hourglass_empty' : 'image'}</span>
                </button>

                <div className="chat-emoji-picker-wrapper">
                  <button
                    type="button"
                    className={`chat-emoji-picker-toggle ${showEmojiPicker ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmojiPicker(!showEmojiPicker);
                    }}
                    title={t('chat.emoji_library')}
                  >
                    <span className="material-symbols-outlined notranslate" translate="no">add_reaction</span>
                  </button>

                  {/* Expanded Emoji Picker Popup */}
                  {showEmojiPicker && (
                    <div className="chat-emoji-picker-popup" onClick={(e) => e.stopPropagation()}>
                      <div className="chat-emoji-picker-header">
                        <span>{t('chat.emoji_library')}</span>
                      </div>
                      <div className="chat-emoji-picker-tabs">
                        {EMOJI_CATEGORIES.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            className={`chat-emoji-tab ${activeEmojiCategory === cat.id ? 'active' : ''}`}
                            onClick={() => setActiveEmojiCategory(cat.id)}
                          >
                            {language === 'vi' ? cat.nameVi : cat.nameEn}
                          </button>
                        ))}
                      </div>
                      <div className="chat-emoji-grid">
                        {EMOJI_CATEGORIES.find((cat) => cat.id === activeEmojiCategory)?.emojis.map((emoji, index) => (
                          <button
                            key={`${emoji}-${index}`}
                            type="button"
                            className="chat-emoji-item"
                            onClick={() => handleQuickReaction(emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <textarea
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder={t('chat.write_message_placeholder')}
                maxLength={2000}
                rows={1}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend(event);
                  }
                }}
              />
              <button type="submit" className="chat-send-btn" disabled={(!messageText.trim() && stagedImages.length === 0) || sending || uploadingImage}>
                <span className="material-symbols-outlined">{(sending || uploadingImage) ? 'hourglass_empty' : 'send'}</span>
              </button>
            </form>


          </>
        )}
      </section>


      {/* Right Info Sidebar (Search Messages & Shared Media) */}
      {showInfoSidebar && activeRoom && (
        <aside className="chat-info-sidebar">
          <div className="chat-info-header">
            <h3>{t('chat.conversation_info')}</h3>
            <button
              type="button"
              className="chat-info-close"
              onClick={() => setShowInfoSidebar(false)}
              title={t('common.close')}
            >
              <span className="material-symbols-outlined notranslate" translate="no">close</span>
            </button>
          </div>

          <div className="chat-info-body">
            {/* Active Partner Profile */}
            <div className="chat-info-profile">
              <div className="chat-info-avatar">
                {activeRoom.productImageUrl ? (
                  <img src={activeRoom.productImageUrl} alt={getRoomTitle(activeRoom, t, customTitles)} />
                ) : (
                  initials(getRoomTitle(activeRoom, t, customTitles))
                )}
              </div>
              <h4>{getRoomTitle(activeRoom, t, customTitles)}</h4>
              <p>
                {activeRoom.roomType === 'Business' || !activeRoom.productId
                  ? t('chat.direct_chat_sub')
                  : activeRoom.productName || getDisplayName(activeRoom.otherParticipant)}
              </p>
            </div>

            {/* 1. Search Messages in Conversation */}
            <div className="chat-info-section">
              <div className="chat-info-section-title">
                <span className="material-symbols-outlined notranslate" translate="no">search</span>
                <span>{t('chat.search_messages')}</span>
              </div>
              <div className="chat-info-search-box">
                <span className="material-symbols-outlined notranslate" translate="no">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('chat.search_keyword_placeholder')}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')}>
                    <span className="material-symbols-outlined notranslate" translate="no">close</span>
                  </button>
                )}
              </div>
              {searchQuery && (
                <div className="chat-info-search-results">
                  <span>
                    {t('chat.found_messages_count', { count: filteredMessages.length })}
                  </span>
                </div>
              )}
            </div>

            {/* 2. Shared Media & Sent Photos Gallery */}
            <div className="chat-info-section">
              <div className="chat-info-section-title">
                <span className="material-symbols-outlined notranslate" translate="no">photo_library</span>
                <span>{t('chat.shared_photos')} ({sharedImages.length})</span>
              </div>

              {sharedImages.length === 0 ? (
                <div className="chat-info-empty-media">
                  <span className="material-symbols-outlined notranslate" translate="no">hide_image</span>
                  <p>{t('chat.no_photos_shared')}</p>
                </div>
              ) : (
                <div className="chat-info-media-grid">
                  {sharedImages.map((imgMsg) => (
                    <div
                      key={imgMsg.chatId}
                      className="chat-info-media-item"
                      onClick={() => setPreviewImageUrl(imgMsg.message)}
                      title={formatTime(imgMsg.createdAt, language)}
                    >
                      <img src={imgMsg.message} alt="Shared media" />
                    </div>
                  ))}

                </div>
              )}
            </div>

            {/* 3. Delete All Messages / Clear Chat History Button */}
            <div className="chat-info-danger-zone">
              <button
                type="button"
                className="chat-info-danger-btn"
                onClick={() => setIsClearChatModalOpen(true)}
              >
                <span className="material-symbols-outlined notranslate" translate="no">delete_sweep</span>
                <span>{t('chat.clear_chat_history')}</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Clear Chat Confirmation Modal */}
      {isClearChatModalOpen && activeRoom && (
        <div className="chat-modal-overlay" onClick={() => setIsClearChatModalOpen(false)}>
          <div className="chat-modal-content danger" onClick={(e) => e.stopPropagation()}>
            <div className="chat-modal-header danger">
              <span className="material-symbols-outlined notranslate" translate="no">delete_sweep</span>
              <h3>{t('chat.clear_chat_history')}</h3>
            </div>
            <p>{t('chat.clear_chat_prompt')}</p>
            <div className="chat-modal-actions">
              <button
                type="button"
                className="chat-modal-btn cancel"
                onClick={() => setIsClearChatModalOpen(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="chat-modal-btn delete"
                onClick={handleClearChatHistory}
              >
                {t('chat.clear_all_btn')}
              </button>
            </div>
          </div>
        </div>
      )}





      {/* Rename Room Modal */}
      {isRenameModalOpen && activeRoom && (
        <div className="chat-modal-overlay" onClick={() => setIsRenameModalOpen(false)}>
          <div className="chat-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="chat-modal-header">
              <span className="material-symbols-outlined">edit_note</span>
              <h3>{t('chat.rename_modal_title')}</h3>
            </div>
            <p>{t('chat.rename_prompt')}</p>
            <input
              type="text"
              className="chat-modal-input"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder={getRoomTitle(activeRoom, t, {})}
              maxLength={50}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveCustomTitle(activeRoom.roomId, renameInput);
                }
              }}
            />
            <div className="chat-modal-actions">
              <button
                type="button"
                className="chat-modal-btn reset"
                onClick={() => saveCustomTitle(activeRoom.roomId, '')}
              >
                {t('chat.reset_title')}
              </button>
              <button
                type="button"
                className="chat-modal-btn cancel"
                onClick={() => setIsRenameModalOpen(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="chat-modal-btn save"
                onClick={() => saveCustomTitle(activeRoom.roomId, renameInput)}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Image Viewer Modal */}

      {previewImageUrl && (
        <div className="chat-image-lightbox-modal" onClick={() => setPreviewImageUrl(null)}>
          <div className="chat-lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="chat-lightbox-btn"
              onClick={() => handleDownloadImage(previewImageUrl)}
              title={t('chat.download_image')}
            >
              <span className="material-symbols-outlined notranslate" translate="no">download</span>
            </button>

            <a
              href={previewImageUrl}
              target="_blank"
              rel="noreferrer"
              className="chat-lightbox-btn"
              title={t('chat.open_in_new_tab')}
            >
              <span className="material-symbols-outlined notranslate" translate="no">open_in_new</span>
            </a>
            <button
              type="button"
              className="chat-lightbox-btn close"
              onClick={() => setPreviewImageUrl(null)}
              title={t('common.close')}
            >
              <span className="material-symbols-outlined notranslate" translate="no">close</span>
            </button>
          </div>
          <div className="chat-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={previewImageUrl} alt="Full resolution view" />
          </div>
        </div>
      )}

      {/* Canvas Drawing Image Editor Modal */}
      {editingImageIndex !== null && stagedImages[editingImageIndex] && (
        <CanvasImageEditor
          imageUrl={stagedImages[editingImageIndex].previewUrl}
          t={t}
          onClose={() => setEditingImageIndex(null)}
          onSave={(newPreviewUrl) => {
            setStagedImages((prev) =>
              prev.map((item, idx) =>
                idx === editingImageIndex ? { ...item, previewUrl: newPreviewUrl } : item
              )
            );
            setEditingImageIndex(null);
          }}
        />
      )}
    </div>
  );
}

function CanvasImageEditor({ imageUrl, onSave, onClose, t }) {
  const canvasRef = useRef(null);
  const [brushColor, setBrushColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      const maxWidth = 760;
      const maxHeight = 480;
      let w = img.width;
      let h = img.height;
      if (w > maxWidth || h > maxHeight) {
        const ratio = Math.min(maxWidth / w, maxHeight / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      setHistory([canvas.toDataURL('image/png')]);
    };
  }, [imageUrl]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const handleStartDraw = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handleDraw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleStopDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setHistory((prev) => [...prev, canvas.toDataURL('image/png')]);
    }
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    const lastState = newHistory[newHistory.length - 1];
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = lastState;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  };

  const handleReset = () => {
    if (history.length <= 1) return;
    const baseState = history[0];
    setHistory([baseState]);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = baseState;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'));
  };

  const colors = ['#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ffffff', '#000000'];

  return (
    <div className="chat-canvas-editor-overlay" onClick={onClose}>
      <div className="chat-canvas-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chat-canvas-editor-header">
          <div className="chat-canvas-title">
            <span className="material-symbols-outlined notranslate" translate="no">edit</span>
            <h3>{t ? t('chat.draw_annotate_title') : 'Draw & Annotate Photo'}</h3>
          </div>
          <button type="button" className="chat-canvas-close" onClick={onClose}>
            <span className="material-symbols-outlined notranslate" translate="no">close</span>
          </button>
        </div>

        <div className="chat-canvas-workspace">
          <canvas
            ref={canvasRef}
            onMouseDown={handleStartDraw}
            onMouseMove={handleDraw}
            onMouseUp={handleStopDraw}
            onMouseLeave={handleStopDraw}
            onTouchStart={handleStartDraw}
            onTouchMove={handleDraw}
            onTouchEnd={handleStopDraw}
          />
        </div>

        <div className="chat-canvas-toolbar">
          <div className="chat-canvas-colors">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                className={`chat-color-swatch ${brushColor === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setBrushColor(c)}
              />
            ))}
          </div>

          <div className="chat-canvas-sizes">
            <span className="material-symbols-outlined notranslate" translate="no">brush</span>
            <input
              type="range"
              min="2"
              max="16"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />
          </div>

          <div className="chat-canvas-actions">
            <button
              type="button"
              className="chat-canvas-btn undo"
              onClick={handleUndo}
              disabled={history.length <= 1}
              title={t ? t('chat.undo') : 'Undo'}
            >
              <span className="material-symbols-outlined notranslate" translate="no">undo</span>
            </button>
            <button
              type="button"
              className="chat-canvas-btn reset"
              onClick={handleReset}
              disabled={history.length <= 1}
              title={t ? t('chat.reset') : 'Reset'}
            >
              <span className="material-symbols-outlined notranslate" translate="no">refresh</span>
            </button>
            <button
              type="button"
              className="chat-canvas-btn apply"
              onClick={handleApply}
            >
              <span className="material-symbols-outlined notranslate" translate="no">check</span>
              <span>{t ? t('chat.apply_save') : 'Save edits'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



