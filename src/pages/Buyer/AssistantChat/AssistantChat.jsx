import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import wishlistService from '../../../services/wishlistService';
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

function formatTextNode(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    let cleanLine = line.trim();
    if (cleanLine.startsWith('### ') || cleanLine.startsWith('## ') || cleanLine.startsWith('# ')) {
      const headingText = cleanLine.replace(/^#+\s*/, '');
      return (
        <div key={lineIdx} className="assistant-product-title-header">
          {headingText}
        </div>
      );
    }

    const boldRegex = /\*\*([^*]+)\*\*/g;
    const parts = [];
    let lastIdx = 0;
    let bMatch;

    while ((bMatch = boldRegex.exec(cleanLine)) !== null) {
      if (bMatch.index > lastIdx) {
        parts.push(cleanLine.substring(lastIdx, bMatch.index));
      }
      parts.push(<strong key={`b-${lineIdx}-${bMatch.index}`}>{bMatch[1]}</strong>);
      lastIdx = bMatch.index + bMatch[0].length;
    }

    if (lastIdx < cleanLine.length) {
      parts.push(cleanLine.substring(lastIdx));
    }

    return (
      <React.Fragment key={`line-${lineIdx}`}>
        {parts}
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
        <div key={`img-${url}-${match.index}`} className="assistant-inline-img-wrapper">
          <img src={url} alt={title} className="assistant-inline-img" onError={(e) => { e.target.style.display = 'none'; }} />
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
            className={`assistant-nav-btn${buttonTypeClass}`}
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
            className={`assistant-nav-btn${buttonTypeClass}`}
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
            <Link to={url} className={`assistant-nav-btn${buttonTypeClass}`}>
              <span className="material-symbols-outlined">{icon}</span>
              <span>{displayTitle}</span>
            </Link>
            {productId && !hasWishlist && (
              <button
                type="button"
                className="assistant-nav-btn wishlist"
                onClick={(e) => handlers.onWishlist ? handlers.onWishlist(productId, e) : null}
              >
                <span className="material-symbols-outlined">favorite</span>
                <span>{currentLanguage === 'en' ? 'Add to Wishlist' : 'Thêm yêu thích'}</span>
              </button>
            )}
            {productId && !hasBuyNow && (
              <button
                type="button"
                className="assistant-nav-btn buy"
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
        <a key={`${url}-${match.index}`} href={url} target="_blank" rel="noopener noreferrer" className="assistant-nav-btn">
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

function mapHistoryMessage(message) {
  return {
    id: message.messageId,
    role: message.role === 'model' || message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content || '',
    createdAt: message.createdAt,
    products: Array.isArray(message.products) ? message.products : [],
  };
}

export default function AssistantChat() {
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
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
                  <div className="assistant-formatted-content">
                    {renderFormattedContent(
                      translateAssistantContent(message.content),
                      language,
                      { onWishlist: handleDirectWishlist, onBuyNow: handleDirectBuyNow }
                    )}
                  </div>
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
