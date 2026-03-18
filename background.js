/**
 * background.js - Service Worker (Manifest V3)
 *
 * Sorumluluklar:
 *  1. Context menu kayitlarini olusturmak
 *  2. Sag tik menulerinden gelen kayit isteklerini ortak store uzerinden islemek
 */

importScripts('utils.js', 'store.js');

const MENU_SAVE_PAGE = 'mybookmark-save-page';
const MENU_SAVE_LINK = 'mybookmark-save-link';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_SAVE_PAGE,
    title: 'Daha sonra kontrol icin kaydet',
    contexts: ['page', 'selection', 'image', 'video', 'audio', 'frame']
  });

  chrome.contextMenus.create({
    id: MENU_SAVE_LINK,
    title: 'Bu linki daha sonra kontrol icin kaydet',
    contexts: ['link']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let url;
  let title;

  if (info.menuItemId === MENU_SAVE_LINK && info.linkUrl) {
    url = info.linkUrl;
    title = info.linkText?.trim() || info.linkUrl;
  } else {
    url = tab?.url || info.pageUrl;
    title = tab?.title?.trim() || url;
  }

  if (!url) return;

  try {
    await BookmarkStore.saveBookmark({ url, title });
  } catch (error) {
    console.error('[MyBookmark] Context menu kayit hatasi:', error);
  }
});

// ─── Thumbnail: og:image fetch ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'fetchOgImage') return false;

  // Only fetch http/https URLs
  if (!msg.url || !MyBookmarkUtils.isSupportedUrl(msg.url)) {
    sendResponse({ thumbnail: null });
    return true;
  }

  fetch(msg.url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Twitterbot/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  })
    .then(r => r.text())
    .then(html => {
      // og:image (both orderings) + twitter:image fallback
      const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
             || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
             || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
             || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
      const raw = m ? m[1].trim() : null;
      const thumb = raw && raw.length <= 2048 ? raw : null;
      sendResponse({ thumbnail: thumb });
    })
    .catch(() => sendResponse({ thumbnail: null }));

  return true; // keep message channel open for async sendResponse
});
