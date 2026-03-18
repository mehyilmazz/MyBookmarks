/**
 * popup.js - MyBookmark popup mantigi
 *
 * Bu surum popup tarafinda yalnizca ortak store katmanini kullanir.
 * Kaydetme kurallari, duplicate kontrolu ve tag sayaclari store.js icinde tutulur.
 */

const el = {
  btnSave: document.getElementById('btn-save'),
  btnArchive: document.getElementById('btn-archive'),
  statTotal: document.getElementById('stat-total'),
  statPending: document.getElementById('stat-pending'),
  statDone: document.getElementById('stat-done'),
  toastContainer: document.getElementById('toast-container')
};

let allBookmarks = [];

async function loadBookmarks() {
  try {
    const state = await BookmarkStore.getState();
    allBookmarks = state.bookmarks;
    updateStats();
  } catch (error) {
    console.error('[MyBookmark] Popup yükleme hatası:', error);
    showToast('Veriler yüklenirken hata oluştu.', 'error');
  }
}

function updateStats() {
  const total = allBookmarks.length;
  const done = allBookmarks.filter(bookmark => bookmark.checked).length;

  if (el.statTotal) el.statTotal.textContent = total;
  if (el.statPending) el.statPending.textContent = total - done;
  if (el.statDone) el.statDone.textContent = done;
}

async function saveCurrentTab() {
  let tab;

  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (error) {
    showToast('Sekme bilgisi alınamadı.', 'error');
    return;
  }

  if (!tab?.url) {
    showToast('Aktif sekme bulunamadı.', 'error');
    return;
  }

  const result = await BookmarkStore.saveBookmark({
    url: tab.url,
    title: tab.title
  });

  if (!result.success) {
    if (result.reason === 'duplicate') {
      showToast('Bu sayfa zaten kayıtlı.', 'warning');
      return;
    }

    if (result.reason === 'restricted') {
      showToast('Bu sayfa kaydedilemez.', 'warning');
      return;
    }

    showToast('Kayıt sırasında hata oluştu.', 'error');
    return;
  }

  allBookmarks = result.bookmarks;
  updateStats();
  showToast('Sayfa başarıyla kaydedildi.', 'success');

  // Live DOM'dan thumbnail çek (sayfanın kendisi açık olduğu için güvenilir)
  if (result.bookmark?.id && tab.id) {
    try {
      const [{ result: thumbnail }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const og = document.querySelector('meta[property="og:image"]');
          if (og?.content) return og.content;
          const tw = document.querySelector('meta[name="twitter:image"]');
          if (tw?.content) return tw.content;
          const tweetImg = document.querySelector(
            '[data-testid="tweetPhoto"] img, [data-testid="tweet-img"] img, ' +
            '[data-testid="card.layoutSmall.media"] img, [data-testid="card.layoutLarge.media"] img'
          );
          if (tweetImg?.src?.includes('pbs.twimg.com')) return tweetImg.src;
          return null;
        }
      });
      if (thumbnail) {
        await BookmarkStore.updateThumbnail(result.bookmark.id, thumbnail);
      }
    } catch {
      // executeScript erişilemez (chrome://, file://, kısıtlı sayfa) — sessizce geç
    }
  }
}

function showToast(message, type = 'info', duration = 2800) {
  if (!el.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  el.toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
  });

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

function openArchive() {
  chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') });
}

function bindEvents() {
  el.btnSave?.addEventListener('click', saveCurrentTab);
  el.btnArchive?.addEventListener('click', openArchive);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.bookmarks) return;
    loadBookmarks();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadBookmarks();
});
