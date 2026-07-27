import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import assistantChatService from '../../../services/assistantChatService';
import './AssistantChat.css';

const SESSION_KEY = 'retrade_assistant_session_id';

function formatCurrency(value) {
  if (value === null || value === undefined) return 'Lien he';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapHistoryMessage(message) {
  return {
    id: message.messageId,
    role: message.role === 'model' || message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content || '',
    createdAt: message.createdAt,
    products: [],
  };
}

export default function AssistantChat() {
  const { showToast } = useToast();
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY));
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Chao ban, minh la tro ly ReTrade. Ban can tim san pham nao, khoang gia bao nhieu?',
      products: [],
      createdAt: new Date().toISOString(),
    },
  ]);
  const [messageText, setMessageText] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;

    let disposed = false;
    setLoadingHistory(true);
    assistantChatService.getHistory(sessionId)
      .then((history) => {
        if (disposed) return;
        const list = Array.isArray(history) ? history.map(mapHistoryMessage) : [];
        if (list.length > 0) {
          setMessages(list);
        }
      })
      .catch(() => {
        localStorage.removeItem(SESSION_KEY);
        setSessionId(null);
      })
      .finally(() => {
        if (!disposed) setLoadingHistory(false);
      });

    return () => {
      disposed = true;
    };
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  const handleNewChat = () => {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Minh da mo mot cuoc tro chuyen moi. Ban muon tim san pham nao tren ReTrade?',
        products: [],
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const text = messageText.trim();
    if (!text || sending) return;

    const userMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      products: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage]);
    setMessageText('');
    setSending(true);

    try {
      const response = await assistantChatService.sendMessage(text, sessionId);
      if (response?.sessionId && response.sessionId !== sessionId) {
        localStorage.setItem(SESSION_KEY, response.sessionId);
        setSessionId(response.sessionId);
      }

      setMessages((current) => [
        ...current,
        {
          id: response?.messageId || `assistant-${Date.now()}`,
          role: 'assistant',
          content: response?.content || 'Minh chua co cau tra loi phu hop. Ban thu hoi lai ngan gon hon nhe.',
          products: Array.isArray(response?.products) ? response.products : [],
          createdAt: response?.createdAt || new Date().toISOString(),
        },
      ]);
    } catch (error) {
      const msg = error.response?.data || error.message || 'Assistant chat failed.';
      showToast(String(msg), 'error');
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Xin loi, hien minh chua ket noi duoc voi tro ly AI. Ban thu lai sau it phut nhe.',
          products: [],
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="assistant-chat-page">
      <section className="assistant-chat-panel">
        <header className="assistant-chat-header">
          <div className="assistant-avatar">
            <span className="material-symbols-outlined">auto_awesome</span>
          </div>
          <div>
            <span className="assistant-kicker">ReTrade AI</span>
            <h1>Gemini Assistant</h1>
            <p>Hoi ve san pham, tam gia, tinh trang hang va goi y mua sam.</p>
          </div>
          <button type="button" className="assistant-new-chat-btn" onClick={handleNewChat}>
            <span className="material-symbols-outlined">add_comment</span>
            New chat
          </button>
        </header>

        <div className="assistant-messages">
          {loadingHistory ? (
            <div className="assistant-state">Loading assistant history...</div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`assistant-message-row ${message.role === 'user' ? 'mine' : 'assistant'}`}>
                {message.role !== 'user' && (
                  <span className="assistant-message-icon">
                    <span className="material-symbols-outlined">auto_awesome</span>
                  </span>
                )}
                <div className="assistant-message-bubble">
                  <p>{message.content}</p>
                  {message.products?.length > 0 && (
                    <div className="assistant-products">
                      {message.products.map((product) => (
                        <Link
                          key={product.productId}
                          to={`/product/${product.productId}`}
                          className="assistant-product-card"
                        >
                          <div className="assistant-product-image">
                            {product.mainImageUrl ? (
                              <img src={product.mainImageUrl} alt={product.name || 'Product'} />
                            ) : (
                              <span className="material-symbols-outlined">inventory_2</span>
                            )}
                          </div>
                          <div className="assistant-product-info">
                            <strong>{product.name || 'San pham ReTrade'}</strong>
                            <span>{product.categoryName || 'Chua co danh muc'}</span>
                            <b>{formatCurrency(product.price)}</b>
                            <small>{product.condition || 'Condition unknown'} - Con {product.stockQuantity ?? 0}</small>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  <time>{formatTime(message.createdAt)}</time>
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="assistant-message-row assistant">
              <span className="assistant-message-icon">
                <span className="material-symbols-outlined">auto_awesome</span>
              </span>
              <div className="assistant-message-bubble assistant-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form className="assistant-composer" onSubmit={handleSend}>
          <textarea
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder="Vi du: Tim giup toi dien thoai duoi 5 trieu..."
            rows={1}
            maxLength={2000}
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
      </section>
    </div>
  );
}
