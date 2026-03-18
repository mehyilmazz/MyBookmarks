/**
 * utils.js - Yardimci fonksiyonlar
 * Hem popup.js hem de diger moduller tarafindan kullanilir.
 */

const URL_PROTOCOL_RESTRICTED = [
  'chrome:',
  'about:',
  'chrome-extension:',
  'edge:',
  'brave:',
  'data:',
  'file:',
  'javascript:'
];

const URL_PROTOCOL_ALLOWED = new Set(['http:', 'https:']);

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * Benzersiz bir ID uretir (timestamp + random).
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

/**
 * URL'ye gore platformu tespit eder.
 * @param {string} url
 * @returns {'X/Twitter' | 'YouTube' | 'Diğer'}
 */
function detectPlatform(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    if (hostname === 'twitter.com' || hostname === 'x.com') return 'X/Twitter';
    if (hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'youtu.be') return 'YouTube';
    return 'Diğer';
  } catch {
    return 'Diğer';
  }
}

/**
 * YouTube URL'sinden video ID'sini cikarir.
 * youtube.com/watch?v=ID, youtube.com/embed/ID,
 * youtube.com/shorts/ID, youtu.be/ID, m.youtube.com/watch?v=ID
 * @param {string} url
 * @returns {string|null}
 */
function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1) || null;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname.startsWith('/watch'))  return u.searchParams.get('v');
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;
      if (u.pathname.startsWith('/shorts/'))return u.pathname.split('/')[2] || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * ISO tarih stringini Turkce formatta gosterir.
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
 * URL'nin desteklenen bir bookmark adresi olup olmadigini kontrol eder.
 * Yalnizca http/https kabul edilir.
 * @param {string} url
 * @returns {boolean}
 */
function isSupportedUrl(url) {
  try {
    const parsed = new URL(String(url ?? '').trim());
    return URL_PROTOCOL_ALLOWED.has(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * URL'nin kaydedilemez veya acilmasi riskli bir adres olup olmadigini kontrol eder.
 * @param {string} url
 * @returns {boolean}
 */
function isRestrictedUrl(url) {
  try {
    const parsed = new URL(String(url ?? '').trim());
    return URL_PROTOCOL_RESTRICTED.includes(parsed.protocol) || !URL_PROTOCOL_ALLOWED.has(parsed.protocol);
  } catch {
    return true;
  }
}

/**
 * Tag dizisini temizler, kirpar ve uniq yapar.
 * @param {unknown} tags
 * @returns {string[]}
 */
function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];

  const seen = new Set();
  const normalized = [];

  tags.forEach(tag => {
    if (typeof tag !== 'string') return;
    const trimmed = tag.trim().slice(0, 30);
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    normalized.push(trimmed);
  });

  return normalized;
}

/**
 * Bookmark verisini tam formata normalize eder.
 * @param {any} item
 * @returns {object|null}
 */
function normalizeBookmark(item) {
  if (!item || typeof item !== 'object') return null;

  const url = typeof item.url === 'string' ? item.url.trim() : '';
  if (!isSupportedUrl(url)) return null;

  const createdAt = typeof item.createdAt === 'string' && !Number.isNaN(Date.parse(item.createdAt))
    ? new Date(item.createdAt).toISOString()
    : new Date().toISOString();

  const title = typeof item.title === 'string' && item.title.trim()
    ? item.title.trim()
    : url;

  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : generateId(),
    url,
    title,
    platform: detectPlatform(url),
    createdAt,
    checked: typeof item.checked === 'boolean' ? item.checked : false,
    note: typeof item.note === 'string' ? item.note.trim() : '',
    tags: sanitizeTags(item.tags)
  };
}

/**
 * Yeni bir bookmark nesnesi olusturur.
 * @param {string} url
 * @param {string} title
 * @returns {object}
 */
function createBookmark(url, title) {
  return normalizeBookmark({
    id: generateId(),
    url,
    title: title || url,
    createdAt: new Date().toISOString(),
    checked: false,
    note: '',
    tags: []
  });
}

/**
 * Bir nesnenin ice aktarma icin gecerli bookmark formatinda olup olmadigini kontrol eder.
 * @param {any} item
 * @returns {boolean}
 */
function validateBookmark(item) {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.url !== 'string' || !isSupportedUrl(item.url)) return false;
  if (item.id != null && typeof item.id !== 'string') return false;
  if (item.title != null && typeof item.title !== 'string') return false;
  if (item.platform != null && typeof item.platform !== 'string') return false;
  if (item.createdAt != null && (typeof item.createdAt !== 'string' || Number.isNaN(Date.parse(item.createdAt)))) return false;
  if (item.checked != null && typeof item.checked !== 'boolean') return false;
  if (item.note != null && typeof item.note !== 'string') return false;
  if (item.tags != null && (!Array.isArray(item.tags) || item.tags.some(tag => typeof tag !== 'string'))) return false;

  return normalizeBookmark(item) !== null;
}

/**
 * Bir bookmark'in verilen arama terimiyle eslesip eslesmedigini kontrol eder.
 * Baslik, URL, not ve taglar icinde arar.
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
 * URL'yi kisaltilmis haliyle doner (sadece host + path).
 * @param {string} url
 * @param {number} maxLen
 * @returns {string}
 */
function shortUrl(url, maxLen = 55) {
  try {
    const parsed = new URL(url);
    const short = parsed.hostname + parsed.pathname;
    return short.length > maxLen ? short.slice(0, maxLen - 1) + '...' : short;
  } catch {
    const raw = String(url ?? '');
    return raw.length > maxLen ? raw.slice(0, maxLen - 1) + '...' : raw;
  }
}

/**
 * HTML metin icerigini guvenli sekilde encode eder.
 * @param {any} text
 * @returns {string}
 */
function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, char => HTML_ESCAPE_MAP[char]);
}

/**
 * HTML attribute icerigini guvenli sekilde encode eder.
 * @param {any} text
 * @returns {string}
 */
function escapeAttribute(text) {
  return escapeHtml(text);
}

const exportedUtils = {
  createBookmark,
  detectPlatform,
  escapeAttribute,
  extractYouTubeId,
  escapeHtml,
  formatDate,
  generateId,
  isRestrictedUrl,
  isSupportedUrl,
  matchesSearch,
  normalizeBookmark,
  sanitizeTags,
  shortUrl,
  validateBookmark
};

if (typeof globalThis !== 'undefined') {
  globalThis.MyBookmarkUtils = exportedUtils;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exportedUtils;
}
