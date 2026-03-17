/**
 * popup.js - MyBookmark Eklentisi Ana Popup Mantığı
 *
 * Bağımlılıklar: utils.js (generateId, detectPlatform, formatDate,
 *                           createBookmark, validateBookmark, matchesSearch,
 *                           shortUrl, escapeHtml)
 */

// ─── DOM Referansları ──────────────────────────────────────────────────────

const el = {
  bookmarkList:    document.getElementById('bookmark-list'),
  emptyState:      document.getElementById('empty-state'),
  btnSave:         document.getElementById('btn-save'),
  btnExport:       document.getElementById('btn-export'),
  btnImport:       document.getElementById('btn-import'),
  importFile:      document.getElementById('import-file'),
  searchInput:     document.getElementById('search-input'),
  platformFilter:  document.getElementById('platform-filter'),
  pendingOnly:     document.getElementById('pending-only'),
  statTotal:       document.getElementById('stat-total'),
  statPending:     document.getElementById('stat-pending'),
  statDone:        document.getElementById('stat-done'),
  toastContainer:  document.getElementById('toast-container'),
  platformTabs:    document.getElementById('platform-tabs'),
  // Kaydet paneli
  savePanel:       document.getElementById('save-panel'),
  panelTagInput:   document.getElementById('panel-tag-input'),
  panelTagsList:   document.getElementById('panel-tags-list'),
  panelSuggestions:document.getElementById('panel-suggestions'),
  btnPanelSave:    document.getElementById('btn-panel-save'),
  btnPanelCancel:  document.getElementById('btn-panel-cancel'),
};

// ─── Uygulama Durumu ───────────────────────────────────────────────────────

/** @type {Array<object>} Tüm kayıtlar (en yeniden eskiye sıralı) */
let allBookmarks = [];

/** @type {Object.<string,number>} Etiket kullanım sayacı — storage'da kalıcı */
let tagUsage = {};

// ─── STORAGE İŞLEMLERİ ────────────────────────────────────────────────────

/**
 * Kayıtları chrome.storage.local'dan yükler ve UI'yi günceller.
 */
async function loadBookmarks() {
  try {
    const data = await chrome.storage.local.get(['bookmarks', 'tagUsage']);
    allBookmarks = sortByDate(data.bookmarks || []);
    tagUsage     = data.tagUsage || {};
  } catch (err) {
    console.error('[MyBookmark] Yükleme hatası:', err);
    allBookmarks = [];
    tagUsage     = {};
    showToast('Veriler yüklenirken hata oluştu.', 'error');
  }
  renderAll();
}

/**
 * Mevcut allBookmarks dizisini storage'a kaydeder.
 */
async function persistBookmarks() {
  await chrome.storage.local.set({ bookmarks: allBookmarks });
}

/**
 * Etiket kullanım sayaçlarını storage'a kaydeder.
 */
async function persistTagUsage() {
  await chrome.storage.local.set({ tagUsage });
}

/**
 * Diziyi createdAt'e göre en yeniden eskiye sıralar.
 * @param {Array} arr
 * @returns {Array}
 */
function sortByDate(arr) {
  return [...arr].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ─── CRUD İŞLEMLERİ ───────────────────────────────────────────────────────

/**
 * Aktif sekmenin URL ve başlığını alarak kayıt ekler.
 */
async function saveCurrentTab() {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (err) {
    showToast('Sekme bilgisi alınamadı.', 'error');
    return;
  }

  if (!tab?.url) {
    showToast('Aktif sekme bulunamadı.', 'error');
    return;
  }

  // Chrome dahili ve kısıtlı sayfalar kaydedilemez
  if (isRestrictedUrl(tab.url)) {
    showToast('Bu sayfa kaydedilemez (sistem sayfası).', 'warning');
    return;
  }

  // Her zaman storage'dan taze veri oku — loadBookmarks() tamamlanmadan
  // tıklanırsa allBookmarks=[] olabileceğinden race condition oluşur;
  // storage'dan okuyarak garantilenmiş güncel listeye ekliyoruz.
  const stored = await chrome.storage.local.get(['bookmarks', 'tagUsage']);
  const freshBookmarks = sortByDate(stored.bookmarks || []);
  tagUsage = stored.tagUsage || {};

  // Duplicate kontrolü (storage'daki gerçek listeye karşı)
  if (freshBookmarks.some(b => b.url === tab.url)) {
    showToast('Bu sayfa zaten kayıtlı!', 'warning');
    return;
  }

  const bookmark = createBookmark(tab.url, tab.title);
  freshBookmarks.unshift(bookmark);
  allBookmarks = freshBookmarks;

  await chrome.storage.local.set({ bookmarks: freshBookmarks });
  renderAll();
  showToast('Sayfa başarıyla kaydedildi!', 'success');
}

/**
 * Verilen ID'ye sahip kaydı siler.
 * @param {string} id
 */
async function deleteBookmark(id) {
  allBookmarks = allBookmarks.filter(b => b.id !== id);
  await persistBookmarks();
  renderAll();
  showToast('Kayıt silindi.', 'info');
}

/**
 * Kaydın "kontrol edildi" durumunu tersine çevirir.
 * @param {string} id
 */
async function toggleChecked(id) {
  const bm = allBookmarks.find(b => b.id === id);
  if (!bm) return;
  bm.checked = !bm.checked;
  await persistBookmarks();
  renderAll();
  showToast(
    bm.checked ? 'Tamamlandı olarak işaretlendi.' : 'Tekrar bekliyor olarak işaretlendi.',
    'success'
  );
}

/**
 * Kaydın notunu günceller.
 * @param {string} id
 * @param {string} note
 */
async function updateNote(id, note) {
  const bm = allBookmarks.find(b => b.id === id);
  if (!bm) return;
  bm.note = note.trim();
  await persistBookmarks();
  showToast('Not kaydedildi.', 'success');
}

/**
 * Kayda yeni bir tag ekler.
 * @param {string} id
 * @param {string} tag
 */
async function addTag(id, tag) {
  const bm = allBookmarks.find(b => b.id === id);
  if (!bm) return;
  const trimmed = tag.trim();
  if (!trimmed) return;
  if (bm.tags.includes(trimmed)) {
    showToast('Bu tag zaten ekli.', 'warning');
    return;
  }
  bm.tags.push(trimmed);
  await persistBookmarks();
  renderAll();
}

/**
 * Kayıttan belirli bir tag'i kaldırır.
 * @param {string} id
 * @param {number} tagIndex
 */
async function removeTag(id, tagIndex) {
  const bm = allBookmarks.find(b => b.id === id);
  if (!bm) return;
  bm.tags.splice(tagIndex, 1);
  await persistBookmarks();
  renderAll();
}

// ─── FİLTRELEME ───────────────────────────────────────────────────────────

/**
 * Aktif filtrelere göre bookmark listesini döner.
 * @returns {Array}
 */
function getFiltered() {
  const query    = el.searchInput.value;
  const platform = el.platformFilter.value;
  const pending  = el.pendingOnly.checked;

  return allBookmarks.filter(bm => {
    if (platform && bm.platform !== platform)   return false;
    if (pending  && bm.checked)                 return false;
    if (!matchesSearch(bm, query))              return false;
    return true;
  });
}

// ─── RENDER ───────────────────────────────────────────────────────────────

/**
 * İstatistikleri ve listeyi yeniden çizer.
 */
function renderAll() {
  updateStats();
  renderList();
}

/**
 * Sayaç kartlarını ve sekme rozetlerini günceller.
 */
function updateStats() {
  const total = allBookmarks.length;
  const done  = allBookmarks.filter(b => b.checked).length;
  if (el.statTotal)   el.statTotal.textContent   = total;
  if (el.statPending) el.statPending.textContent = total - done;
  if (el.statDone)    el.statDone.textContent    = done;
  updateTabCounts();
}

/**
 * Platform sekmelerindeki kayıt sayılarını günceller.
 */
function updateTabCounts() {
  const all     = allBookmarks.length;
  const twitter = allBookmarks.filter(b => b.platform === 'X/Twitter').length;
  const youtube = allBookmarks.filter(b => b.platform === 'YouTube').length;
  const other   = allBookmarks.filter(b => b.platform === 'Diğer').length;
  const pending = allBookmarks.filter(b => !b.checked).length;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('tab-count-all',     all);
  set('tab-count-twitter', twitter);
  set('tab-count-youtube', youtube);
  set('tab-count-other',   other);
  set('tab-count-pending', pending);
}

/**
 * Filtrelenmiş kayıt listesini DOM'a yazar.
 */
function renderList() {
  // Mevcut kartları temizle (empty-state hariç)
  el.bookmarkList.querySelectorAll('.bookmark-card').forEach(c => c.remove());

  const filtered = getFiltered();

  if (filtered.length === 0) {
    el.emptyState.style.display = 'flex';
    return;
  }
  el.emptyState.style.display = 'none';

  const frag = document.createDocumentFragment();
  filtered.forEach(bm => frag.appendChild(buildCard(bm)));
  el.bookmarkList.appendChild(frag);
}

/**
 * Platform rozeti CSS sınıfını döner.
 * @param {string} platform
 * @returns {string}
 */
function platformBadgeClass(platform) {
  const map = { 'X/Twitter': 'badge-twitter', 'YouTube': 'badge-youtube' };
  return map[platform] || 'badge-other';
}

/**
 * Bir bookmark nesnesi için kart DOM elemanı oluşturur.
 * @param {object} bm
 * @returns {HTMLElement}
 */
function buildCard(bm) {
  const card = document.createElement('div');
  card.className = `bookmark-card${bm.checked ? ' checked' : ''}`;
  card.dataset.id = bm.id;
  card.dataset.platform = bm.platform; // CSS [data-platform] seçicileri için

  // Tag'leri HTML olarak hazırla
  const tagsHTML = bm.tags.length > 0
    ? bm.tags.map((t, i) =>
        `<span class="tag">${escapeHtml(t)}<button class="tag-remove" data-i="${i}" title="Tag'i sil" aria-label="Tag sil">×</button></span>`
      ).join('')
    : '';

  card.innerHTML = `
    <div class="card-header">
      <span class="platform-badge ${platformBadgeClass(bm.platform)}">${escapeHtml(bm.platform)}</span>
      <span class="card-date">${formatDate(bm.createdAt)}</span>
    </div>

    <div class="card-title" title="${escapeHtml(bm.url)}">${escapeHtml(bm.title)}</div>
    <div class="card-url">${escapeHtml(shortUrl(bm.url))}</div>

    <div class="card-note-section">
      <textarea
        class="note-input"
        placeholder="Not ekle…"
        aria-label="Not"
      >${escapeHtml(bm.note)}</textarea>
    </div>

    <div class="card-tags">
      <div class="tags-list">${tagsHTML}</div>
      <div class="tag-input-row">
        <input
          type="text"
          class="tag-input"
          placeholder="Tag ekle, Enter'a bas…"
          maxlength="30"
          aria-label="Tag ekle"
        >
        <button class="btn-add-tag" title="Tag ekle">+ Tag</button>
      </div>
    </div>

    <div class="card-actions">
      <button class="btn-action btn-open"       title="Yeni sekmede aç">Aç</button>
      <button class="btn-action btn-toggle"     title="${bm.checked ? 'Bekliyor yap' : 'Tamamlandı yap'}">${bm.checked ? 'Geri Al' : 'Tamamlandı'}</button>
      <button class="btn-action btn-save-note"  title="Notu kaydet">Kaydet</button>
      <button class="btn-action btn-delete"     title="Kaydı sil">Sil</button>
    </div>
  `;

  bindCardEvents(card, bm.id, bm.url);
  return card;
}

/**
 * Kart üzerindeki tüm event listener'ları bağlar.
 * @param {HTMLElement} card
 * @param {string} id
 * @param {string} url
 */
function bindCardEvents(card, id, url) {
  // Yeni sekmede aç
  card.querySelector('.btn-open').onclick = () => {
    chrome.tabs.create({ url });
  };

  // Tamamlandı / Geri Al
  card.querySelector('.btn-toggle').onclick = () => toggleChecked(id);

  // Sil
  card.querySelector('.btn-delete').onclick = () => {
    if (window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
      deleteBookmark(id);
    }
  };

  // Notu kaydet
  card.querySelector('.btn-save-note').onclick = () => {
    updateNote(id, card.querySelector('.note-input').value);
  };

  // Tag ekle (buton tıklama ve Enter)
  const tagInput  = card.querySelector('.tag-input');
  const doAddTag  = () => {
    const val = tagInput.value.trim();
    if (val) { addTag(id, val); tagInput.value = ''; }
  };
  card.querySelector('.btn-add-tag').onclick = doAddTag;
  tagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doAddTag(); }
  });

  // Tag sil (event delegation)
  card.querySelector('.tags-list').addEventListener('click', e => {
    if (e.target.classList.contains('tag-remove')) {
      removeTag(id, Number(e.target.dataset.i));
    }
  });
}

// ─── EXPORT / IMPORT ──────────────────────────────────────────────────────

/**
 * Tüm kayıtları JSON dosyası olarak indirir.
 */
function exportData() {
  if (!allBookmarks.length) {
    showToast('Dışa aktarılacak kayıt yok.', 'warning');
    return;
  }

  const json  = JSON.stringify(allBookmarks, null, 2);
  const fname = `mybookmark-${new Date().toISOString().slice(0, 10)}.json`;
  const blob  = new Blob([json], { type: 'application/json' });
  const link  = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(blob),
    download: fname
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 100);
  showToast(`${allBookmarks.length} kayıt dışa aktarıldı.`, 'success');
}

/**
 * Kullanıcının seçtiği JSON dosyasını içe aktarır.
 * @param {File} file
 */
function importData(file) {
  const reader = new FileReader();
  reader.onload = async ({ target }) => {
    let parsed;

    // JSON parse
    try {
      parsed = JSON.parse(target.result);
    } catch {
      showToast('Geçersiz JSON dosyası! İçerik okunamadı.', 'error');
      return;
    }

    // Format doğrulama
    if (!Array.isArray(parsed)) {
      showToast('Hatalı format: veri bir dizi (array) olmalı.', 'error');
      return;
    }

    // Her öğeyi doğrula
    const valid   = parsed.filter(validateBookmark);
    const invalid = parsed.length - valid.length;

    if (valid.length === 0) {
      showToast('Geçerli kayıt bulunamadı. Dosyayı kontrol edin.', 'error');
      return;
    }

    // Duplicate kontrolü (URL bazlı)
    const existingUrls = new Set(allBookmarks.map(b => b.url));
    const newOnes      = valid.filter(b => !existingUrls.has(b.url));
    const dupes        = valid.length - newOnes.length;

    allBookmarks = sortByDate([...newOnes, ...allBookmarks]);

    // Import edilen bookmarkların taglarını tagUsage'a ekle
    newOnes.forEach(b => (b.tags || []).forEach(t => {
      tagUsage[t] = (tagUsage[t] || 0) + 1;
    }));
    await chrome.storage.local.set({ bookmarks: allBookmarks, tagUsage });

    renderAll();

    // Özet mesaj
    const parts = [`${newOnes.length} kayıt içe aktarıldı.`];
    if (dupes)   parts.push(`${dupes} tekrar atlandı.`);
    if (invalid) parts.push(`${invalid} geçersiz kayıt yoksayıldı.`);
    showToast(parts.join(' '), 'success');
  };

  reader.onerror = () => showToast('Dosya okunamadı.', 'error');
  reader.readAsText(file, 'utf-8');
}

// ─── TOAST BİLDİRİMLERİ ───────────────────────────────────────────────────

/**
 * Ekranın altında kısa süreli bir bildirim gösterir.
 * @param {string} msg
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {number} duration  Milisaniye cinsinden gösterim süresi
 */
function showToast(msg, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  el.toastContainer.appendChild(toast);

  // Animasyonlu göster
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
  });

  // Belirtilen süre sonra kaldır
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

// ─── YARDIMCI ─────────────────────────────────────────────────────────────

/**
 * URL'nin kayıt dışı bir sistem sayfası olup olmadığını kontrol eder.
 * @param {string} url
 * @returns {boolean}
 */
function isRestrictedUrl(url) {
  return (
    url.startsWith('chrome://')          ||
    url.startsWith('about:')             ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://')            ||
    url.startsWith('brave://')
  );
}

// ─── KAYDET PANELİ ────────────────────────────────────────────────────────

let panelTags = [];
let panelTab  = null;

async function openSavePanel(tab) {
  panelTab  = tab;
  panelTags = [];
  el.btnSave.disabled = true;
  el.panelTagInput.value = '';
  renderPanelTags();

  // Storage'dan taze veri çek — timing sorunlarını önler
  try {
    const data = await chrome.storage.local.get(['bookmarks', 'tagUsage']);
    allBookmarks = sortByDate(data.bookmarks || []);
    tagUsage     = data.tagUsage || {};
  } catch {}

  renderPanelSuggestions();
  el.savePanel.hidden = false;
  el.panelTagInput.focus();
}

function closeSavePanel() {
  el.savePanel.hidden = true;
  el.btnSave.disabled = false;
  panelTags = [];
  panelTab  = null;
}

function renderPanelTags() {
  el.panelTagsList.innerHTML = panelTags
    .map((t, i) =>
      `<span class="tag">${escapeHtml(t)}<button class="tag-remove" data-i="${i}" aria-label="Kaldır">×</button></span>`
    ).join('');
}

function renderPanelSuggestions() {
  const used = new Set(panelTags);

  // tagUsage geçmişi + mevcut bookmark etiketlerini birleştir
  const allKnown = new Set([
    ...Object.keys(tagUsage),
    ...allBookmarks.flatMap(b => b.tags)
  ]);

  // Seçilmemiş etiketleri kullanım sıklığına göre sırala
  const sorted = [...allKnown]
    .filter(t => !used.has(t))
    .sort((a, b) => (tagUsage[b] || 0) - (tagUsage[a] || 0));

  if (!sorted.length) {
    el.panelSuggestions.innerHTML = '<span class="suggestion-hint">Etiket ekleyerek kaydet, sonraki seferde burada görünür</span>';
    return;
  }

  // En çok kullanılan 5 etiket
  el.panelSuggestions.innerHTML = sorted.slice(0, 5)
    .map(t => `<button class="panel-suggestion panel-suggestion--top" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
    .join('');
}

async function confirmSave() {
  if (!panelTab) return;
  el.btnPanelSave.disabled = true;
  try {
    // Storage'dan güncel veriyi oku (in-memory state bayat olabilir)
    const stored = await chrome.storage.local.get(['bookmarks', 'tagUsage']);
    const freshBookmarks = stored.bookmarks || [];
    const freshTagUsage  = stored.tagUsage  || {};

    // Tekrar kayıt kontrolü (storage'daki gerçek listeye karşı)
    if (freshBookmarks.some(b => b.url === panelTab.url)) {
      showToast('Bu sayfa zaten kayıtlı!', 'warning');
      closeSavePanel();
      return;
    }

    const bookmark = createBookmark(panelTab.url, panelTab.title);
    bookmark.tags  = [...panelTags];
    freshBookmarks.unshift(bookmark);
    panelTags.forEach(t => { freshTagUsage[t] = (freshTagUsage[t] || 0) + 1; });

    await chrome.storage.local.set({ bookmarks: freshBookmarks, tagUsage: freshTagUsage });

    // In-memory state'i güncelle
    allBookmarks = sortByDate(freshBookmarks);
    tagUsage     = freshTagUsage;

    renderAll();
    closeSavePanel();
    showToast('Kaydedildi!', 'success');
  } catch (err) {
    el.btnPanelSave.disabled = false;
    showToast('Kayıt sırasında hata oluştu.', 'error');
    console.error('[MyBookmark] confirmSave hatası:', err);
  }
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────

// "Bu sayfayı kaydet" butonu → doğrudan kaydet
el.btnSave.addEventListener('click', () => saveCurrentTab());

// Panel: etiket input → Enter ile ekle
el.panelTagInput?.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const val = el.panelTagInput.value.trim();
  if (val && !panelTags.includes(val)) {
    panelTags.push(val);
    renderPanelTags();
    renderPanelSuggestions();
  }
  el.panelTagInput.value = '';
});

// Panel: tag sil (event delegation)
el.panelTagsList?.addEventListener('click', e => {
  if (!e.target.classList.contains('tag-remove')) return;
  panelTags.splice(Number(e.target.dataset.i), 1);
  renderPanelTags();
  renderPanelSuggestions();
});

// Panel: öneri tıklama
el.panelSuggestions?.addEventListener('click', e => {
  const btn = e.target.closest('.panel-suggestion');
  if (!btn) return;
  const tag = btn.dataset.tag;
  if (!panelTags.includes(tag)) {
    panelTags.push(tag);
    renderPanelTags();
    renderPanelSuggestions();
  }
});

// Panel: onayla / iptal
el.btnPanelSave?.addEventListener('click', confirmSave);
el.btnPanelCancel?.addEventListener('click', closeSavePanel);

// Arşiv butonu (header)
const openArchive = () => chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') });
document.getElementById('btn-archive')?.addEventListener('click', openArchive);

// Export (buton varsa bağla)
el.btnExport?.addEventListener('click', exportData);

// Import (buton varsa bağla)
el.btnImport?.addEventListener('click', () => el.importFile?.click());
el.importFile?.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) {
    importData(file);
    e.target.value = ''; // aynı dosyayı tekrar seçebilmek için sıfırla
  }
});

// Arama & filtreler → listeyi yenile
el.searchInput.addEventListener('input', renderList);
el.platformFilter.addEventListener('change', renderList);
el.pendingOnly.addEventListener('change', renderList);

// ─── DIŞ DEĞİŞİKLİK TAKİBİ ───────────────────────────────────────────────
// Context menüden yapılan kayıtlar background.js tarafından storage'a yazılır.
// Popup açıkken bu değişiklikleri yakalamak için storage change listener kullan.

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.bookmarks) {
    allBookmarks = sortByDate(changes.bookmarks.newValue || []);
    renderAll();
  }
});

// ─── BAŞLATMA ─────────────────────────────────────────────────────────────

// Başlatma popup.html'deki inline script tarafından yapılır

// ─── PLATFORM SEKMELERİ ───────────────────────────────────────────────────

/**
 * Platform sekme tıklamalarını yönetir.
 * data-platform: filtrelenecek platform ("" = tümü)
 * data-pending: "true" ise sadece bekleyenler gösterilir
 */
el.platformTabs?.addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;

  // Aktif sekme stilini güncelle
  el.platformTabs.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');

  // Gizli kontrollere senkronize et → getFiltered() bunları okur
  el.platformFilter.value = btn.dataset.platform || '';
  el.pendingOnly.checked  = btn.dataset.pending === 'true';

  renderList();
});
