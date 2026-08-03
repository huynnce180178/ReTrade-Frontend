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
  const { t, language } = useLanguage();
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY));
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'i18n:chat.assistant_welcome',
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
        content: 'i18n:chat.assistant_welcome',
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
      const response = await assistantChatService.sendMessage(text, sessionId, language);
      if (response?.sessionId && response.sessionId !== sessionId) {
        localStorage.setItem(SESSION_KEY, response.sessionId);
        setSessionId(response.sessionId);
      }

      setMessages((current) => [
        ...current,
        {
          id: response?.messageId || `assistant-${Date.now()}`,
          role: 'assistant',
          content: response?.content || t('common.error_occurred'),
          products: Array.isArray(response?.products) ? response.products : [],
          createdAt: response?.createdAt || new Date().toISOString(),
        },
      ]);
    } catch (error) {
      const msg = error.response?.data || error.message || t('common.error_occurred');
      showToast(String(msg), 'error');
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: t('common.error_occurred'),
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
            <h1>{t('chat.assistant_title')}</h1>
            <p>{t('chat.assistant_page_desc')}</p>
          </div>
          <button type="button" className="assistant-new-chat-btn" onClick={handleNewChat}>
            <span className="material-symbols-outlined">add_comment</span>
            {t('chat.new_chat')}
          </button>
        </header>

        <div className="assistant-messages">
          {loadingHistory ? (
            <div className="assistant-state">{t('chat.loading_history')}</div>
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
                              <img src={product.mainImageUrl} alt={product.name || t('common.product_image')} />
                            ) : (
                              <span className="material-symbols-outlined">inventory_2</span>
                            )}
                          </div>
                          <div className="assistant-product-info">
                            <strong>{product.name || t('common.unnamed_product')}</strong>
                            <span>{product.categoryName || t('common.not_available')}</span>
                            <b>{formatCurrency(product.price)}</b>
                            <small>{product.condition || t('common.unknown')} • {t('common.quantity')}: {product.stockQuantity ?? 0}</small>
                          </div>
                          <div className="assistant-product-action">
                            <span>{t('common.view_detail')}</span>
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
            placeholder={t('chat.type_message')}
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
