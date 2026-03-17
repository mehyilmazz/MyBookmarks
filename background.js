/**
 * background.js - Service Worker (Manifest V3)
 *
 * Sorumluluklar:
 *  1. Context menü kayıtlarını oluşturmak (eklenti kurulumunda)
 *  2. Context menüden tetiklenen kayıt işlemlerini gerçekleştirmek
 *
 * Not: Popup'taki "Bu sayfayı kaydet" butonu doğrudan popup.js üzerinden
 * chrome.storage.local ile çalışır; bu service worker'a mesaj göndermez.
 * Bu sayede kod tekrarı önlenir ve service worker uyku durumundan etkilenmez.
 */

// ─── Sabitler ──────────────────────────────────────────────────────────────

const MENU_SAVE_PAGE = 'mybookmark-save-page';
const MENU_SAVE_LINK = 'mybookmark-save-link';

// ─── Kurulum ───────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  // Sayfa içeriği üzerine sağ tık menüsü
  chrome.contextMenus.create({
    id: MENU_SAVE_PAGE,
    title: 'Daha sonra kontrol için kaydet',
    contexts: ['page', 'selection', 'image', 'video', 'audio', 'frame']
  });

  // Link üzerine sağ tık menüsü
  chrome.contextMenus.create({
    id: MENU_SAVE_LINK,
    title: 'Bu linki daha sonra kontrol için kaydet',
    contexts: ['link']
  });
});

// ─── Context Menü Tıklama ──────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let url, title;

  if (info.menuItemId === MENU_SAVE_LINK && info.linkUrl) {
    // Link üzerine tıklandıysa, linkin URL'sini al
    url = info.linkUrl;
    title = info.linkText?.trim() || url;
  } else {
    // Sayfa üzerine tıklandıysa, aktif sayfanın URL'sini al
    url = tab?.url || info.pageUrl;
    title = tab?.title?.trim() || url;
  }

  // Chrome dahili sayfaları kaydedilemez
  if (!url || isRestrictedUrl(url)) return;

  await saveBookmark(url, title);
});

// ─── Yardımcı Fonksiyonlar ─────────────────────────────────────────────────

/**
 * Kısıtlı (kaydedilemeyen) bir URL olup olmadığını kontrol eder.
 * @param {string} url
 * @returns {boolean}
 */
function isRestrictedUrl(url) {
  return (
    url.startsWith('chrome://') ||
    url.startsWith('about:') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('brave://')
  );
}

/**
 * Verilen URL ve başlıkla yeni bir bookmark oluşturup storage'a kaydeder.
 * Duplicate varsa sessizce geçer.
 * @param {string} url
 * @param {string} title
 * @returns {Promise<{success: boolean, duplicate?: boolean}>}
 */
async function saveBookmark(url, title) {
  try {
    const data = await chrome.storage.local.get('bookmarks');
    const bookmarks = data.bookmarks || [];

    // Aynı URL zaten varsa kaydetme
    if (bookmarks.some(b => b.url === url)) {
      return { success: false, duplicate: true };
    }

    const newBookmark = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
      url,
      title: (title || url).trim(),
      platform: detectPlatform(url),
      createdAt: new Date().toISOString(),
      checked: false,
      note: '',
      tags: []
    };

    // En başa ekle (en yeni üstte)
    bookmarks.unshift(newBookmark);
    await chrome.storage.local.set({ bookmarks });

    return { success: true, bookmark: newBookmark };
  } catch (err) {
    console.error('[MyBookmark] Kayıt hatası:', err);
    return { success: false, error: err.message };
  }
}

/**
 * URL'ye göre platformu tespit eder.
 * (utils.js service worker'da import edilemez; bu yüzden burada tekrar tanımlandı.)
 * @param {string} url
 * @returns {string}
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
