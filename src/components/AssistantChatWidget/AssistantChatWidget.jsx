import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import assistantChatService from '../../services/assistantChatService';
import wishlistService from '../../services/wishlistService';
import { useToast } from '../../context/ToastContext';
import './AssistantChatWidget.css';

const SESSION_KEY = 'retrade_assistant_session_id';

function formatCurrency(value) {
  if (value === null || value === undefined) return 'Contact';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTextNode(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    let cleanLine = line.trim();
    if (cleanLine.startsWith('* ') || cleanLine.startsWith('- ')) {
      cleanLine = '• ' + cleanLine.substring(2);
    }
    cleanLine = cleanLine.replace(/^\*\s*/, '');

    const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
    const formattedParts = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    return (
      <React.Fragment key={lineIdx}>
        {formattedParts}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

function renderFormattedContent(content) {
  if (!content) return null;

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      elements.push(formatTextNode(content.substring(lastIndex, match.index)));
    }

    const title = match[1];
    const url = match[2];

    if (url.startsWith('/')) {
      elements.push(
        <Link key={`${url}-${match.index}`} to={url} className="assistant-widget-nav-btn">
          <span>{title}</span>
          <span className="material-symbols-outlined">arrow_forward</span>
        </Link>
      );
    } else {
      elements.push(
        <a key={`${url}-${match.index}`} href={url} target="_blank" rel="noopener noreferrer" className="assistant-widget-nav-btn">
          <span>{title}</span>
          <span className="material-symbols-outlined">open_in_new</span>
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    elements.push(formatTextNode(content.substring(lastIndex)));
  }

  return elements.length > 0 ? elements : formatTextNode(content);
}

const QUICK_SUGGESTIONS = [
  { label: 'My Orders', query: 'Check my orders' },
  { label: 'Auction Guide', query: 'How to participate in auctions on ReTrade?' },
  { label: 'Sell Item', query: 'I want to sell a second-hand product on ReTrade' },
  { label: 'Latest Products', query: 'Show me the latest products on ReTrade' },
  { label: 'My Wishlist', query: 'View my wishlist items' },
];

export default function AssistantChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY));
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [wishlistSet, setWishlistSet] = useState(new Set());
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am ReTrade AI Assistant. How can I help you find products, check orders, or guide you today?',
      products: [],
    },
  ]);
  
  const bottomRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

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

  const handleToggleWishlist = async (e, productId) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (wishlistSet.has(productId)) {
        setWishlistSet((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        toast?.info?.('Removed from wishlist');
      } else {
        await wishlistService.addToWishlist(productId);
        setWishlistSet((prev) => new Set(prev).add(productId));
        toast?.success?.('Added to wishlist!');
      }
    } catch {
      toast?.error?.('Please login to manage wishlist.');
    }
  };

  const handleBuyNow = (e, productId) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/checkout/${productId}`);
  };

  const sendQuery = async (textToSend) => {
    const text = textToSend.trim();
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
          content: response?.content || 'I could not find a suitable response. Please try again.',
          products: Array.isArray(response?.products) ? response.products : [],
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I am currently unable to connect to the AI assistant. Please try again later.',
          products: [],
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSend = (event) => {
    event.preventDefault();
    sendQuery(messageText);
  };

  const handleNewChat = () => {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setMessages([
      {
        id: 'welcome-new',
        role: 'assistant',
        content: 'Started a new conversation. How can I help you today?',
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
              <div className="assistant-widget-avatar-head">
                <span className="material-symbols-outlined">robot</span>
                <span className="assistant-widget-online-dot" />
              </div>
              <div className="assistant-widget-header-title">
                <strong>ReTrade Assistant</strong>
                <span>AI Shopping Assistant</span>
              </div>
            </div>
            <div className="assistant-widget-actions">
              <button type="button" onClick={handleNewChat} title="Start new conversation">
                <span className="material-symbols-outlined">autorenew</span>
              </button>
              <button type="button" onClick={() => setOpen(false)} title="Close window">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </header>

          <div className="assistant-widget-messages">
            {messages.map((message) => (
              <div key={message.id} className={`assistant-widget-row ${message.role === 'user' ? 'mine' : 'bot'}`}>
                {message.role !== 'user' && (
                  <div className="assistant-widget-avatar bot-avatar">
                    <span className="material-symbols-outlined">robot</span>
                  </div>
                )}

                <div className="assistant-widget-bubble">
                  <div className="assistant-widget-text">
                    {renderFormattedContent(message.content)}
                  </div>

                  {message.products?.length > 0 && (
                    <div className="assistant-widget-product-list">
                      <div className="assistant-widget-product-header">
                        <span className="material-symbols-outlined">local_offer</span>
                        RECOMMENDED PRODUCTS
                      </div>
                      {message.products.slice(0, 3).map((product) => (
                        <div key={product.productId} className="assistant-widget-product-card-container">
                          <Link to={`/product/${product.productId}`} className="assistant-widget-product-card">
                            <div className="assistant-widget-product-img">
                              {product.mainImageUrl ? (
                                <img src={product.mainImageUrl} alt={product.name || 'Product'} />
                              ) : (
                                <div className="assistant-widget-img-placeholder">
                                  <span className="material-symbols-outlined">image</span>
                                </div>
                              )}
                            </div>
                            <div className="assistant-widget-product-meta">
                              <span className="product-title">{product.name || 'ReTrade Product'}</span>
                              <span className="product-price">{formatCurrency(product.price)}</span>
                            </div>
                          </Link>
                          <div className="assistant-widget-product-card-actions">
                            <button
                              type="button"
                              className={`assistant-widget-action-icon wishlist-btn ${wishlistSet.has(product.productId) ? 'active' : ''}`}
                              title={wishlistSet.has(product.productId) ? 'In Wishlist' : 'Add to Wishlist'}
                              onClick={(e) => handleToggleWishlist(e, product.productId)}
                            >
                              <span className="material-symbols-outlined">
                                {wishlistSet.has(product.productId) ? 'favorite' : 'favorite_border'}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="assistant-widget-action-icon buy-btn"
                              title="Buy Now"
                              onClick={(e) => handleBuyNow(e, product.productId)}
                            >
                              <span className="material-symbols-outlined">bolt</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="assistant-widget-avatar user-avatar">
                    <span className="material-symbols-outlined">person</span>
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="assistant-widget-row bot">
                <div className="assistant-widget-avatar bot-avatar">
                  <span className="material-symbols-outlined">robot</span>
                </div>
                <div className="assistant-widget-bubble typing-bubble">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="assistant-widget-chips">
            {QUICK_SUGGESTIONS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className="assistant-widget-chip-btn"
                disabled={sending}
                onClick={() => sendQuery(chip.query)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <form className="assistant-widget-footer" onSubmit={handleSend}>
            <input
              type="text"
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="Type a question or select a suggestion..."
              maxLength={2000}
            />
            <button type="submit" disabled={!messageText.trim() || sending} title="Send message">
              <span className="material-symbols-outlined">{sending ? 'sync' : 'send'}</span>
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="assistant-widget-toggle-btn"
        onClick={() => setOpen((current) => !current)}
        aria-label="ReTrade AI Assistant"
      >
        <span className="material-symbols-outlined">{open ? 'expand_more' : 'robot'}</span>
      </button>
    </div>
  );
}
