import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import assistantChatService from '../../services/assistantChatService';
import wishlistService from '../../services/wishlistService';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import './AssistantChatWidget.css';

const SESSION_KEY = 'retrade_assistant_session_id';

const isProductUnavailable = (product) => (
  product?.status === 'SoldOut' ||
  product?.status === 'Sold' ||
  product?.status === 'Inactive' ||
  Number(product?.stockQuantity ?? 0) <= 0
);

const I18N_CONTENT_PREFIX = 'i18n:';

function formatTextNode(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    let cleanLine = line.trim();
    if (cleanLine.startsWith('### ') || cleanLine.startsWith('## ') || cleanLine.startsWith('# ')) {
      const headingText = cleanLine.replace(/^#+\s*/, '');
      return (
        <div key={lineIdx} className="assistant-widget-product-title">
          {headingText}
        </div>
      );
    }

    if (cleanLine.startsWith('* ') || cleanLine.startsWith('- ')) {
      cleanLine = `- ${cleanLine.substring(2)}`;
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

function renderFormattedContent(content, currentLanguage = 'vi', handlers = {}) {
  if (!content) return null;

  const linkRegex = /(!?)\[([^\]]+)\]\(([^)]+)\)/g;
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const isImage = match[1] === '!';
    const textStart = match.index;
    if (textStart > lastIndex) {
      elements.push(formatTextNode(content.substring(lastIndex, textStart)));
    }

    const title = match[2];
    const url = match[3];

    if (isImage) {
      elements.push(
        <div key={`img-${url}-${match.index}`} className="assistant-widget-inline-img-wrapper">
          <img src={url} alt={title} className="assistant-widget-inline-img" onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
      );
    } else if (url.startsWith('/')) {
      const lowerTitle = title.toLowerCase();
      let icon = 'arrow_forward';
      let buttonTypeClass = '';
      let displayTitle = title;

      const productIdMatch = url.match(/\/product\/([^\/?#]+)/);
      const productId = productIdMatch ? productIdMatch[1] : null;

      if (lowerTitle.includes('yêu thích') || lowerTitle.includes('wishlist') || url.includes('wishlist')) {
        icon = 'favorite';
        buttonTypeClass = ' wishlist';
        displayTitle = currentLanguage === 'en' ? 'Add to Wishlist' : 'Thêm yêu thích';

        elements.push(
          <button
            key={`${url}-${match.index}`}
            type="button"
            className={`assistant-widget-nav-btn${buttonTypeClass}`}
            onClick={(e) => handlers.onWishlist ? handlers.onWishlist(productId, e) : null}
          >
            <span className="material-symbols-outlined">{icon}</span>
            <span>{displayTitle}</span>
          </button>
        );
      } else if (lowerTitle.includes('mua ngay') || lowerTitle.includes('buy') || url.includes('buy')) {
        icon = 'bolt';
        buttonTypeClass = ' buy';
        displayTitle = currentLanguage === 'en' ? 'Buy Now' : 'Mua ngay';

        elements.push(
          <button
            key={`${url}-${match.index}`}
            type="button"
            className={`assistant-widget-nav-btn${buttonTypeClass}`}
            onClick={(e) => handlers.onBuyNow ? handlers.onBuyNow(productId, e) : null}
          >
            <span className="material-symbols-outlined">{icon}</span>
            <span>{displayTitle}</span>
          </button>
        );
      } else {
        if (lowerTitle.includes('xem chi tiết') || lowerTitle.includes('view detail') || lowerTitle.includes('view details')) {
          icon = 'arrow_forward';
          displayTitle = currentLanguage === 'en' ? 'View Details' : 'Xem chi tiết';
        }

        const restOfContent = content.substring(match.index, match.index + 250);
        const hasWishlist = restOfContent.includes('action=wishlist') || restOfContent.includes('yêu thích') || restOfContent.includes('wishlist');
        const hasBuyNow = restOfContent.includes('action=buy') || restOfContent.includes('mua ngay') || restOfContent.includes('buy now');

        elements.push(
          <React.Fragment key={`prod-btns-${url}-${match.index}`}>
            <Link to={url} className={`assistant-widget-nav-btn${buttonTypeClass}`}>
              <span className="material-symbols-outlined">{icon}</span>
              <span>{displayTitle}</span>
            </Link>
            {productId && !hasWishlist && (
              <button
                type="button"
                className="assistant-widget-nav-btn wishlist"
                onClick={(e) => handlers.onWishlist ? handlers.onWishlist(productId, e) : null}
              >
                <span className="material-symbols-outlined">favorite</span>
                <span>{currentLanguage === 'en' ? 'Add to Wishlist' : 'Thêm yêu thích'}</span>
              </button>
            )}
            {productId && !hasBuyNow && (
              <button
                type="button"
                className="assistant-widget-nav-btn buy"
                onClick={(e) => handlers.onBuyNow ? handlers.onBuyNow(productId, e) : null}
              >
                <span className="material-symbols-outlined">bolt</span>
                <span>{currentLanguage === 'en' ? 'Buy Now' : 'Mua ngay'}</span>
              </button>
            )}
          </React.Fragment>
        );
      }
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
  const { t, formatCurrency, language } = useLanguage();
  const assistantTitle = t('chat.assistant_title');
  const assistantWelcome = t('chat.assistant_welcome');
  const assistantSubtitle = t('chat.assistant_subtitle');
  const assistantTypeMessage = t('chat.type_message');
  const assistantSendTitle = t('chat.send');
  const [open, setOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY));
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [wishlistSet, setWishlistSet] = useState(new Set());
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: assistantWelcome,
      products: [],
    },
  ]);
  
  const bottomRef = useRef(null);
  const imageInputRef = useRef(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();

  const QUICK_SUGGESTIONS = [
    { label: t('history.purchase_title'), query: t('chat.assistant_query_purchase_history') },
    { label: t('chat.chip_recommend_demand') || 'Gợi ý theo nhu cầu', query: t('chat.assistant_query_recommend_demand') || 'Gợi ý sản phẩm phù hợp với nhu cầu của tôi' },
    { label: t('chat.chip_apparel_fashion') || 'Áo khoác & Thời trang', query: t('chat.assistant_query_apparel') || 'Tìm áo khoác và quần áo thời trang mới nhất' },
    { label: t('auction.title'), query: t('chat.assistant_query_auction_help') },
    { label: t('home.start_selling'), query: t('chat.assistant_query_start_selling') },
    { label: t('home.featured_products'), query: t('chat.assistant_query_featured_products') },
    { label: t('nav.wishlist'), query: t('chat.assistant_query_wishlist') },
  ];

  const translateAssistantContent = (content) => {
    if (!content?.startsWith(I18N_CONTENT_PREFIX)) {
      return content;
    }

    return t(content.slice(I18N_CONTENT_PREFIX.length));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      showToast(t('chat.image_too_large') || 'Dung lượng ảnh tối đa 8MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const skipHistoryFetchRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    if (skipHistoryFetchRef.current) {
      skipHistoryFetchRef.current = false;
      return;
    }

    let disposed = false;
    assistantChatService.getHistory(sessionId)
      .then((history) => {
        if (disposed || !Array.isArray(history) || history.length === 0) return;
        setMessages((prevMessages) => {
          return history.map((item) => {
            const existing = prevMessages.find((m) => m.id === item.messageId);
            return {
              id: item.messageId,
              role: item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user',
              content: item.content || '',
              products: existing?.products?.length ? existing.products : (item.products || []),
            };
          });
        });
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

  const sendQuery = async (textToSend, imageToSend = selectedImage) => {
    const text = (textToSend || '').trim();
    if ((!text && !imageToSend) || sending) return;

    const userContent = imageToSend
      ? (text ? `![Attached Image](${imageToSend})\n${text}` : `![Attached Image](${imageToSend})`)
      : text;

    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        role: 'user',
        content: userContent,
        products: [],
      },
    ]);

    setMessageText('');
    setSelectedImage(null);
    setSending(true);

    try {
      const response = await assistantChatService.sendMessage(text, imageToSend, sessionId, language);
      if (response?.sessionId && response.sessionId !== sessionId) {
        localStorage.setItem(SESSION_KEY, response.sessionId);
        skipHistoryFetchRef.current = true;
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
    sendQuery(messageText, selectedImage);
  };

  const handleNewChat = () => {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setMessages([
      {
        id: 'welcome-new',
        role: 'assistant',
        content: assistantWelcome,
        products: [],
      },
    ]);
  };

  const handleDirectWishlist = async (productId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!user) {
      showToast(t('auth.login_title') || (language === 'en' ? 'Please log in to continue' : 'Vui lòng đăng nhập để tiếp tục'), 'warning');
      navigate('/login');
      return;
    }
    if (!productId) return;
    try {
      await wishlistService.addToWishlist(productId);
      setWishlistSet((prev) => new Set(prev).add(productId));
      showToast(t('product.add_to_wishlist') || (language === 'en' ? 'Added to wishlist!' : 'Đã thêm vào danh sách yêu thích!'), 'success');
    } catch (err) {
      const msg = err?.response?.data || err?.message;
      showToast(typeof msg === 'string' ? msg : (language === 'en' ? 'Added to wishlist!' : 'Đã thêm vào danh sách yêu thích!'), 'success');
    }
  };

  const handleDirectBuyNow = (productId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!user) {
      showToast(t('auth.login_title') || (language === 'en' ? 'Please log in to continue' : 'Vui lòng đăng nhập để tiếp tục'), 'warning');
      navigate('/login');
      return;
    }
    if (!productId) return;
    navigate(`/product/${productId}?action=buy`);
  };

  return (
    <div className={`assistant-widget ${open ? 'open' : ''}`}>
      {open && (
        <section className={`assistant-widget-panel ${isMaximized ? 'maximized' : ''}`} aria-label={assistantTitle}>
          <header className="assistant-widget-header">
            <div className="assistant-widget-brand">
              <div className="assistant-widget-avatar-head">
                <span className="material-symbols-outlined">robot</span>
                <span className="assistant-widget-online-dot" />
              </div>
              <div className="assistant-widget-header-title">
                <strong>{assistantTitle}</strong>
                <span>{assistantSubtitle}</span>
              </div>
            </div>
            <div className="assistant-widget-actions">
              <button
                type="button"
                onClick={() => setIsMaximized((prev) => !prev)}
                title={isMaximized ? t('chat.minimize') : t('chat.maximize')}
              >
                <span className="material-symbols-outlined">{isMaximized ? 'close_fullscreen' : 'open_in_full'}</span>
              </button>
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
                    {renderFormattedContent(
                      translateAssistantContent(message.content),
                      language,
                      { onWishlist: handleDirectWishlist, onBuyNow: handleDirectBuyNow }
                    )}
                  </div>
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

          {selectedImage && (
            <div className="assistant-widget-image-preview-bar">
              <div className="assistant-widget-preview-item">
                <img src={selectedImage} alt="Attachment" className="assistant-widget-preview-img" />
                <button
                  type="button"
                  className="assistant-widget-preview-remove"
                  onClick={() => setSelectedImage(null)}
                  title={t('common.delete') || 'Remove Image'}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <span className="assistant-widget-preview-label">{t('chat.image_attached') || 'Đã đính kèm 1 ảnh'}</span>
            </div>
          )}

          <form className="assistant-widget-footer" onSubmit={handleSend}>
            <input
              type="file"
              ref={imageInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageChange}
            />
            <button
              type="button"
              className="assistant-widget-attach-btn"
              onClick={() => imageInputRef.current?.click()}
              title={t('chat.attach_image') || 'Tải ảnh lên'}
              disabled={sending}
            >
              <span className="material-symbols-outlined">add_photo_alternate</span>
            </button>

            <input
              type="text"
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder={assistantTypeMessage}
              maxLength={2000}
            />
            <button type="submit" disabled={(!messageText.trim() && !selectedImage) || sending} title={assistantSendTitle}>
              <span className="material-symbols-outlined">{sending ? 'sync' : 'send'}</span>
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="assistant-widget-toggle-btn"
        onClick={() => setOpen((current) => !current)}
        aria-label={assistantTitle}
      >
        <span className="material-symbols-outlined">{open ? 'expand_more' : 'robot'}</span>
      </button>
    </div>
  );
}
