/**
 * Helper to translate notification title and message dynamically based on selected language.
 * Keeps specific dynamic data (Order IDs, Product titles, User names, Amounts) intact.
 */
export function formatNotificationContent(rawTitle, rawMessage, language) {
  if (language !== 'vi' || !rawTitle) {
    return {
      translatedTitle: rawTitle || 'Notification',
      translatedMessage: rawMessage || '',
    };
  }

  let title = rawTitle;
  let message = rawMessage || '';

  // Title Dictionary Mapping
  const titleMap = {
    'Order Placed': 'Đã Đặt Hàng',
    'Order Status Updated': 'Cập Nhật Trạng Thái Đơn Hàng',
    'Order Completed': 'Hoàn Tất Đơn Hàng',
    'Order Cancelled': 'Đã Hủy Đơn Hàng',
    'New Order': 'Đơn Hàng Mới',
    'New Bid': 'Lượt Ra Giá Mới',
    'Outbid Alert': 'Cảnh Báo Bị Vượt Giá',
    'Auction Ended': 'Phiên Đấu Giá Kết Thúc',
    'Auction Won': 'Thắng Đấu Giá',
    'Offer Received': 'Nhận Được Đề Xuất Giá',
    'Offer Accepted': 'Đề Xuất Giá Đã Được Duyệt',
    'Offer Rejected': 'Đề Xuất Giá Bị Từ Chối',
    'Payment Successful': 'Thanh Toán Thành Công',
    'Deposit Refunded': 'Đã Hoàn Tiền Cọc',
    'Account Notification': 'Thông Báo Tài Khoản',
    'System Announcement': 'Thông Báo Hệ Thống',
    'Voucher Unlocked': 'Voucher Mới Được Mở Khóa',
    'Review Received': 'Nhận Được Đánh Giá Mới',
  };

  if (titleMap[title]) {
    title = titleMap[title];
  }

  // Exact & Dynamic Pattern Translations
  const orderPlacedMatch = message.match(/^Your order #(\w+) for "(.*?)" has been placed successfully\.$/i);
  if (orderPlacedMatch) {
    message = `Đơn hàng #${orderPlacedMatch[1]} cho "${orderPlacedMatch[2]}" của bạn đã được đặt thành công.`;
    return { translatedTitle: title, translatedMessage: message };
  }

  const orderStatusMatch = message.match(/^Your order #(\w+) status has been updated to (\w+)\.$/i);
  if (orderStatusMatch) {
    const statusMap = {
      Pending: 'Đang xử lý',
      Confirmed: 'Đã xác nhận',
      Shipping: 'Đang giao hàng',
      Delivered: 'Đã giao hàng',
      Completed: 'Hoàn thành',
      Cancelled: 'Đã hủy',
    };
    const stLabel = statusMap[orderStatusMatch[2]] || orderStatusMatch[2];
    message = `Trạng thái đơn hàng #${orderStatusMatch[1]} của bạn đã được cập nhật thành ${stLabel}.`;
    return { translatedTitle: title, translatedMessage: message };
  }

  const outbidMatch = message.match(/^You have been outbid on "(.*?)". Current highest bid is (.*?)\.$/i);
  if (outbidMatch) {
    message = `Bạn đã bị vượt giá ở sản phẩm "${outbidMatch[1]}". Giá cao nhất hiện tại là ${outbidMatch[2]}.`;
    return { translatedTitle: title, translatedMessage: message };
  }

  const auctionWonMatch = message.match(/^Congratulations! You won the auction for "(.*?)" with a bid of (.*?)\.$/i);
  if (auctionWonMatch) {
    message = `Chúc mừng! Bạn đã thắng phiên đấu giá "${auctionWonMatch[1]}" với giá ${auctionWonMatch[2]}.`;
    return { translatedTitle: title, translatedMessage: message };
  }

  // Generic Substring Replacements (fallback for any other notifications)
  message = message
    .replace(/^Your order #/gi, 'Đơn hàng #')
    .replace(/for "(.*?)"/gi, 'cho "$1"')
    .replace(/\s+has been placed successfully\./gi, ' đã được đặt thành công.')
    .replace(/\s+has been completed\./gi, ' đã hoàn tất.')
    .replace(/\s+has been cancelled\./gi, ' đã bị hủy.')
    .replace(/\s+has been shipped\./gi, ' đã được giao cho đơn vị vận chuyển.')
    .replace(/\s+has been delivered\./gi, ' đã được giao thành công.')
    .replace(/\s+has been accepted\./gi, ' đã được chấp nhận.')
    .replace(/\s+has been rejected\./gi, ' đã bị từ chối.')
    .replace(/\s+has ended\./gi, ' đã kết thúc.')
    .replace(/^You have received a new offer/gi, 'Bạn đã nhận được đề xuất trả giá mới')
    .replace(/^Your offer for/gi, 'Đề xuất trả giá của bạn cho');

  return { translatedTitle: title, translatedMessage: message };
}

/**
 * Formats notification creation timestamp into localized relative or clean date-time format.
 * Examples: "Vừa xong", "5 phút trước", "2 giờ trước", "Hôm qua 14:30", "08/08 14:30"
 */
export function formatNotificationTime(dateStr, language) {
  if (!dateStr) return language === 'vi' ? 'Vừa xong' : 'Just now';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return language === 'vi' ? 'Vừa xong' : 'Just now';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return language === 'vi' ? 'Vừa xong' : 'Just now';
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return language === 'vi' ? `${diffMin} phút trước` : `${diffMin}m ago`;
  }

  const diffHour = Math.floor(diffMin / 60);
  const isToday = now.getDate() === date.getDate() &&
                  now.getMonth() === date.getMonth() &&
                  now.getFullYear() === date.getFullYear();

  if (isToday) {
    return language === 'vi' ? `${diffHour} giờ trước` : `${diffHour}h ago`;
  }

  const isYesterday = (new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString() === date.toDateString());
  const timeStr = date.toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (isYesterday) {
    return language === 'vi' ? `Hôm qua ${timeStr}` : `Yesterday ${timeStr}`;
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  if (year === now.getFullYear()) {
    return `${day}/${month} ${timeStr}`;
  }

  return `${day}/${month}/${year} ${timeStr}`;
}
