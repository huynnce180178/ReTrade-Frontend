import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import assistantChatService from '../../../services/assistantChatService';
import './AssistantChat.css';

const SESSION_KEY = 'retrade_assistant_session_id';
const I18N_CONTENT_PREFIX = 'i18n:';

function formatCurrency(value) {
  if (value === null || value === undefined) return 'Liên hệ';
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
  const { t } = useLanguage();
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY));
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am ReTrade AI Assistant. What product or price range are you looking for today?',
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
        content: 'Mình đã mở một cuộc trò chuyện mới. Bạn muốn tìm sản phẩm nào trên ReTrade?',
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
          content: response?.content || 'Mình chưa có câu trả lời phù hợp. Bạn thử hỏi lại ngắn gọn hơn nhé.',
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
          content: 'Xin lỗi, hiện mình chưa kết nối được với trợ lý AI. Bạn thử lại sau ít phút nhé.',
          products: [],
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const translateAssistantContent = (content) => {
    if (!content?.startsWith(I18N_CONTENT_PREFIX)) {
      return content;
    }

    return t(content.slice(I18N_CONTENT_PREFIX.length));
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
            <p>Hỏi về sản phẩm, tầm giá, tình trạng hàng và gợi ý mua sắm.</p>
          </div>
          <button type="button" className="assistant-new-chat-btn" onClick={handleNewChat}>
            <span className="material-symbols-outlined">add_comment</span>
            Trò chuyện mới
          </button>
        </header>

        <div className="assistant-messages">
          {loadingHistory ? (
            <div className="assistant-state">Đang tải lịch sử trò chuyện...</div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`assistant-message-row ${message.role === 'user' ? 'mine' : 'assistant'}`}>
                {message.role !== 'user' && (
                  <span className="assistant-message-icon">
                    <span className="material-symbols-outlined">auto_awesome</span>
                  </span>
                )}
                <div className="assistant-message-bubble">
                  <p>{translateAssistantContent(message.content)}</p>
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
                              <img src={product.mainImageUrl} alt={product.name || 'Sản phẩm'} />
                            ) : (
                              <span className="material-symbols-outlined">inventory_2</span>
                            )}
                          </div>
                          <div className="assistant-product-info">
                            <strong>{product.name || 'Sản phẩm ReTrade'}</strong>
                            <span>{product.categoryName || 'Chưa có danh mục'}</span>
                            <b>{formatCurrency(product.price)}</b>
                            <small>{product.condition || 'Chưa xác định'} • Còn {product.stockQuantity ?? 0}</small>
                          </div>
                          <div className="assistant-product-action">
                            <span>Xem</span>
                            <span className="material-symbols-outlined">chevron_right</span>
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
            placeholder="e.g., Find a phone under 5,000,000 VND..."
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
