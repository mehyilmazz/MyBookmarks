/**
 * utils.js - Yardımcı fonksiyonlar
 * Hem popup.js hem de gerektiğinde diğer modüller tarafından kullanılır.
 */

/**
 * Benzersiz bir ID üretir (timestamp + random).
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

/**
 * URL'ye göre platformu tespit eder.
 * @param {string} url
 * @returns {'X/Twitter' | 'YouTube' | 'Diğer'}
 */
function detectPlatform(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    if (hostname === 'twitter.com' || hostname === 'x.com') return 'X/Twitter';
    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') return 'YouTube';
    return 'Diğer';
  } catch {
    return 'Diğer';
  }
}

/**
 * ISO tarih stringini Türkçe formatında gösterir.
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

/**
 * Yeni bir bookmark nesnesi oluşturur.
 * @param {string} url
 * @param {string} title
 * @returns {object}
 */
function createBookmark(url, title) {
  return {
    id: generateId(),
    url: url || '',
    title: (title || url || 'Başlıksız').trim(),
    platform: detectPlatform(url),
    createdAt: new Date().toISOString(),
    checked: false,
    note: '',
    tags: []
  };
}

/**
 * Bir nesnenin geçerli bookmark formatında olup olmadığını kontrol eder.
 * @param {any} item
 * @returns {boolean}
 */
function validateBookmark(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.url === 'string' &&
    item.url.length > 0 &&
    typeof item.title === 'string' &&
    typeof item.platform === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.checked === 'boolean' &&
    typeof item.note === 'string' &&
    Array.isArray(item.tags)
  );
}

/**
 * Bir bookmark'ın verilen arama terimiyle eşleşip eşleşmediğini kontrol eder.
 * Başlık, URL, not ve taglar içinde arar.
 * @param {object} bookmark
 * @param {string} query
 * @returns {boolean}
 */
function matchesSearch(bookmark, query) {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    bookmark.title.toLowerCase().includes(q) ||
    bookmark.url.toLowerCase().includes(q) ||
    bookmark.note.toLowerCase().includes(q) ||
    bookmark.tags.some(tag => tag.toLowerCase().includes(q))
  );
}

/**
 * URL'yi kısaltılmış haliyle döner (sadece host + path).
 * @param {string} url
 * @param {number} maxLen
 * @returns {string}
 */
function shortUrl(url, maxLen = 55) {
  try {
    const u = new URL(url);
    const s = u.hostname + u.pathname;
    return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen - 1) + '…' : url;
  }
}

/**
 * HTML özel karakterlerini güvenli şekilde encode eder (XSS önleme).
 * @param {any} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(text ?? '')));
  return div.innerHTML;
}
