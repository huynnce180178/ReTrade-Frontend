import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import assistantChatService from '../../services/assistantChatService';
import wishlistService from '../../services/wishlistService';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import './AssistantChatWidget.css';

const SESSION_KEY = 'retrade_assistant_session_id';

const isProductUnavailable = (product) => (
  product?.status === 'SoldOut' ||
  product?.status === 'Sold' ||
  product?.status === 'Inactive' ||
  Number(product?.stockQuantity ?? 0) <= 0
);

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

export default function AssistantChatWidget() {
  const { t, language, formatCurrency } = useLanguage();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY));
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [wishlistSet, setWishlistSet] = useState(new Set());
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: t('chat.assistant_welcome'),
      products: [],
    },
  ]);
  
  const bottomRef = useRef(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const QUICK_SUGGESTIONS = language === 'vi' ? [
    { label: t('history.purchase_title'), query: 'Kiểm tra lịch sử mua hàng của tôi trên ReTrade' },
    { label: t('auction.title'), query: 'Làm sao để tham gia đấu giá trên ReTrade?' },
    { label: t('home.start_selling'), query: 'Tôi muốn đăng bán sản phẩm đồ cũ trên ReTrade' },
    { label: t('home.featured_products'), query: 'Cho tôi xem danh sách các sản phẩm mới nhất' },
    { label: t('nav.wishlist'), query: 'Xem danh sách sản phẩm yêu thích của tôi' },
  ] : [
    { label: t('history.purchase_title'), query: 'Check my purchase history on ReTrade' },
    { label: t('auction.title'), query: 'How to participate in auctions on ReTrade?' },
    { label: t('home.start_selling'), query: 'I want to sell a second-hand product on ReTrade' },
    { label: t('home.featured_products'), query: 'Show me the latest products on ReTrade' },
    { label: t('nav.wishlist'), query: 'View my wishlist items' },
  ];

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

  const handleToggleWishlist = async (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    const productId = product?.productId;
    if (!productId) return;
    try {
      if (wishlistSet.has(productId)) {
        setWishlistSet((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        showToast(t('product.remove_from_wishlist'), 'info');
      } else {
        if (isProductUnavailable(product)) {
          showToast(t('product.out_of_stock'), 'warning');
          return;
        }
        await wishlistService.addToWishlist(productId);
        setWishlistSet((prev) => new Set(prev).add(productId));
        showToast(t('product.add_to_wishlist'), 'success');
      }
    } catch {
      showToast(t('auth.login_title'), 'error');
    }
  };

  const handleBuyNow = (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    if (isProductUnavailable(product)) {
      showToast(t('product.out_of_stock'), 'warning');
      return;
    }
    navigate(`/checkout/${product.productId}`);
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
      // Append language hint for Gemini API if in Vietnamese mode
      const queryWithLang = language === 'vi' ? `${text} (Vui lòng trả lời hoàn toàn bằng Tiếng Việt)` : text;
      const response = await assistantChatService.sendMessage(queryWithLang, sessionId);
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
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: t('common.error_occurred'),
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
        content: t('chat.assistant_welcome'),
        products: [],
      },
    ]);
  };

  return (
    <div className={`assistant-widget ${open ? 'open' : ''}`}>
      {open && (
        <section className="assistant-widget-panel" aria-label={t('chat.assistant_title')}>
          <header className="assistant-widget-header">
            <div className="assistant-widget-brand">
              <div className="assistant-widget-avatar-head">
                <span className="material-symbols-outlined">robot</span>
                <span className="assistant-widget-online-dot" />
              </div>
              <div className="assistant-widget-header-title">
                <strong>{t('chat.assistant_title')}</strong>
                <span>AI Shopping Assistant</span>
              </div>
            </div>
            <div className="assistant-widget-actions">
              <button type="button" onClick={handleNewChat} title={t('common.reset')}>
                <span className="material-symbols-outlined">autorenew</span>
              </button>
              <button type="button" onClick={() => setOpen(false)} title={t('common.close')}>
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
                        <span className="material-symbols-outlined">shopping_bag</span>
                        {t('product.related_products')}
                      </div>
                      {message.products.slice(0, 5).map((product) => {
                        const outOfStock = isProductUnavailable(product);
                        return (
                        <div key={product.productId} className={`assistant-widget-product-card-container ${outOfStock ? 'out-of-stock' : ''}`}>
                          <Link to={`/product/${product.productId}`} className="assistant-widget-product-card">
                            <div className="assistant-widget-product-img">
                              {product.mainImageUrl ? (
                                <img src={product.mainImageUrl} alt={product.name || 'Product'} />
                              ) : (
                                <div className="assistant-widget-img-placeholder">
                                  <span className="material-symbols-outlined">inventory_2</span>
                                </div>
                              )}
                            </div>
                            <div className="assistant-widget-product-meta">
                              <span className="product-title">{product.name || 'ReTrade Product'}</span>
                              <span className="product-price">{formatCurrency(product.price)}</span>
                              <small style={{ color: '#059669', fontWeight: 600, fontSize: '11px', marginTop: '2px' }}>
                                {outOfStock ? t('product.out_of_stock') : `${t('common.view_detail')} →`}
                              </small>
                            </div>
                          </Link>
                          <div className="assistant-widget-product-card-actions">
                            <button
                              type="button"
                              className={`assistant-widget-action-icon wishlist-btn ${wishlistSet.has(product.productId) ? 'active' : ''}`}
                              title={outOfStock && !wishlistSet.has(product.productId) ? t('product.out_of_stock') : wishlistSet.has(product.productId) ? t('product.remove_from_wishlist') : t('product.add_to_wishlist')}
                              onClick={(e) => handleToggleWishlist(e, product)}
                              disabled={outOfStock && !wishlistSet.has(product.productId)}
                            >
                              <span className="material-symbols-outlined">
                                {wishlistSet.has(product.productId) ? 'favorite' : 'favorite_border'}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="assistant-widget-action-icon buy-btn"
                              title={outOfStock ? t('product.out_of_stock') : t('product.buy_now')}
                              onClick={(e) => handleBuyNow(e, product)}
                              disabled={outOfStock}
                            >
                              <span className="material-symbols-outlined">bolt</span>
                            </button>
                          </div>
                        </div>
                        );
                      })}
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
              placeholder={t('chat.type_message')}
              maxLength={2000}
            />
            <button type="submit" disabled={!messageText.trim() || sending} title={t('chat.send')}>
              <span className="material-symbols-outlined">{sending ? 'sync' : 'send'}</span>
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="assistant-widget-toggle-btn"
        onClick={() => setOpen((current) => !current)}
        aria-label={t('chat.assistant_title')}
      >
        <span className="material-symbols-outlined">{open ? 'expand_more' : 'robot'}</span>
      </button>
    </div>
  );
}
