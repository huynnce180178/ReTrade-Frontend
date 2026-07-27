import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import assistantChatService from '../../services/assistantChatService';
import './AssistantChatWidget.css';

const SESSION_KEY = 'retrade_assistant_session_id';

function formatCurrency(value) {
  if (value === null || value === undefined) return 'Lien he';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AssistantChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY));
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Chao ban, minh co the tim san pham tren ReTrade cho ban.',
      products: [],
    },
  ]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;

    let disposed = false;
    assistantChatService.getHistory(sessionId)
      .then((history) => {
        if (disposed || !Array.isArray(history) || history.length === 0) return;
        setMessages(history.map((item) => ({
          id: item.messageId,
          role: item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user',
          content: item.content || '',
          products: [],
        })));
      })
      .catch(() => {
        localStorage.removeItem(SESSION_KEY);
        setSessionId(null);
      });

    return () => {
      disposed = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, open, sending]);

  const handleSend = async (event) => {
    event.preventDefault();
    const text = messageText.trim();
    if (!text || sending) return;

    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        role: 'user',
        content: text,
        products: [],
      },
    ]);
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
          content: response?.content || 'Minh chua co cau tra loi phu hop. Ban thu lai nhe.',
          products: Array.isArray(response?.products) ? response.products : [],
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Xin loi, hien minh chua ket noi duoc voi tro ly AI. Ban thu lai sau it phut nhe.',
          products: [],
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleNewChat = () => {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setMessages([
      {
        id: 'welcome-new',
        role: 'assistant',
        content: 'Minh da mo cuoc tro chuyen moi. Ban dang tim san pham nao?',
        products: [],
      },
    ]);
  };

  return (
    <div className={`assistant-widget ${open ? 'open' : ''}`}>
      {open && (
        <section className="assistant-widget-panel" aria-label="ReTrade AI Assistant">
          <header className="assistant-widget-header">
            <div className="assistant-widget-brand">
              <span className="assistant-widget-mark">
                <span className="material-symbols-outlined">auto_awesome</span>
              </span>
              <div>
                <span>ReTrade AI</span>
                <strong>Gemini Assistant</strong>
              </div>
            </div>
            <div className="assistant-widget-actions">
              <button type="button" onClick={handleNewChat} title="New chat">
                <span className="material-symbols-outlined">add_comment</span>
              </button>
              <button type="button" onClick={() => setOpen(false)} title="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </header>

          <div className="assistant-widget-messages">
            {messages.map((message) => (
              <div key={message.id} className={`assistant-widget-row ${message.role === 'user' ? 'mine' : 'bot'}`}>
                {message.role !== 'user' && (
                  <span className="assistant-widget-bot-icon">
                    <span className="material-symbols-outlined">auto_awesome</span>
                  </span>
                )}
                <div className="assistant-widget-message">
                  <p>{message.content}</p>
                  {message.products?.length > 0 && (
                    <div className="assistant-widget-products">
                      {message.products.slice(0, 3).map((product) => (
                        <Link key={product.productId} to={`/product/${product.productId}`} className="assistant-widget-product">
                          {product.mainImageUrl ? (
                            <img src={product.mainImageUrl} alt={product.name || 'Product'} />
                          ) : (
                            <span className="material-symbols-outlined">inventory_2</span>
                          )}
                          <div>
                            <strong>{product.name || 'San pham ReTrade'}</strong>
                            <b>{formatCurrency(product.price)}</b>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="assistant-widget-row bot">
                <span className="assistant-widget-bot-icon">
                  <span className="material-symbols-outlined">auto_awesome</span>
                </span>
                <div className="assistant-widget-message typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form className="assistant-widget-composer" onSubmit={handleSend}>
            <textarea
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="Tim san pham..."
              rows={1}
              maxLength={2000}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend(event);
                }
              }}
            />
            <button type="submit" disabled={!messageText.trim() || sending} title="Send">
              <span className="material-symbols-outlined">{sending ? 'hourglass_empty' : 'send'}</span>
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="assistant-widget-toggle"
        onClick={() => setOpen((current) => !current)}
        aria-label="Open ReTrade AI assistant"
      >
        <span className="material-symbols-outlined">{open ? 'expand_more' : 'auto_awesome'}</span>
      </button>
    </div>
  );
}
