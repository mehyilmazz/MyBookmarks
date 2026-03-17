/**
 * bookmarks.js — MyBookmark Arşiv Sayfası
 *
 * Bağımlılıklar: utils.js (generateId, detectPlatform, formatDate,
 *                           createBookmark, validateBookmark, matchesSearch,
 *                           shortUrl, escapeHtml)
 */
'use strict';

// ─── Durum ────────────────────────────────────────────────────────────────

let allBookmarks  = [];         // Tüm kayıtlar
let selectedIds   = new Set();  // Seçili kayıt ID'leri
let isSelectMode  = false;      // Toplu seçim modu aktif mi?
let viewMode      = 'list';     // 'list' | 'feed'
let activeFilters = {
  search:   '',
  platform: '',     // '' | 'X/Twitter' | 'YouTube' | 'Diğer'
  status:   'pending',  // '' | 'pending' | 'done'
  sort:     'newest'
};

// ─── DOM Referansları ──────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const DOM = {
  grid:          $('card-grid'),
  emptyState:    $('empty-state'),
  resultsLabel:  $('results-label'),
  searchInput:   $('search-input'),
  sortSelect:    $('sort-select'),
  bulkBar:       $('bulk-bar'),
  bulkCount:     $('bulk-count'),
  btnSelectMode: $('btn-select-mode'),
  btnSelectAll:  $('btn-select-all'),
  btnSelectNone: $('btn-select-none'),
  selectedCount: $('selected-count'),
  selectControls: $('select-controls'),
  importFile:    $('import-file'),
  stats: {
    total:   $('s-total'),
    pending: $('s-pending'),
    done:    $('s-done'),
    tw:      $('s-tw'),
    yt:      $('s-yt'),
    other:   $('s-other')
  }
};

// ─── Başlatma ─────────────────────────────────────────────────────────────

async function init() {
  const data = await chrome.storage.local.get('bookmarks');
  allBookmarks = data.bookmarks || [];
  renderAll();
  setupEventListeners();

  // Dışarıdan yapılan değişiklikleri (popup, context menu) yakala
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.bookmarks) {
      allBookmarks = changes.bookmarks.newValue || [];
      for (const id of selectedIds) {
        if (!allBookmarks.find(b => b.id === id)) selectedIds.delete(id);
      }
      renderAll();
    }
  });

  // Sekme tekrar aktif olduğunda storage'dan taze veriyi yükle
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    const data = await chrome.storage.local.get('bookmarks');
    allBookmarks = data.bookmarks || [];
    renderAll();
  });
}

// ─── Filtreleme & Sıralama ────────────────────────────────────────────────

function getFilteredBase() {
  let list = [...allBookmarks];
  const { search, status, sort } = activeFilters;

  if (status === 'pending') list = list.filter(b => !b.checked);
  if (status === 'done')    list = list.filter(b =>  b.checked);

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(b =>
      b.title.toLowerCase().includes(q)         ||
      b.url.toLowerCase().includes(q)            ||
      (b.note || '').toLowerCase().includes(q)   ||
      b.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  switch (sort) {
    case 'newest':  list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    case 'oldest':  list.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
    case 'platform': list.sort((a,b) => a.platform.localeCompare(b.platform, 'tr'));   break;
    case 'pending': list.sort((a,b) => (a.checked?1:0) - (b.checked?1:0));            break;
    case 'title':   list.sort((a,b) => a.title.localeCompare(b.title, 'tr'));          break;
  }

  return list;
}

function getFiltered() {
  let list = getFilteredBase();
  if (activeFilters.platform) list = list.filter(b => b.platform === activeFilters.platform);
  return list;
}

// ─── Render ───────────────────────────────────────────────────────────────

function renderAll() {
  updateStats();
  renderGrid();
  updateBulkBar();
  updateSelectControls();
}

function updateStats() {
  const total   = allBookmarks.length;
  const done    = allBookmarks.filter(b => b.checked).length;
  const pending = total - done;
  const tw      = allBookmarks.filter(b => b.platform === 'X/Twitter').length;
  const yt      = allBookmarks.filter(b => b.platform === 'YouTube').length;
  const other   = allBookmarks.filter(b => b.platform === 'Diğer').length;

  if (DOM.stats.total)   DOM.stats.total.textContent   = total;
  if (DOM.stats.pending) DOM.stats.pending.textContent = pending;
  if (DOM.stats.done)    DOM.stats.done.textContent    = done;
  if (DOM.stats.tw)      DOM.stats.tw.textContent      = tw;
  if (DOM.stats.yt)      DOM.stats.yt.textContent      = yt;
  if (DOM.stats.other)   DOM.stats.other.textContent   = other;
}

function renderGrid() {
  DOM.grid.innerHTML = '';

  if (viewMode === 'feed') {
    renderFeed();
    return;
  }

  // ─── Liste görünümü: 3 platform tablosu ─────────────────────────────
  DOM.grid.style.display = 'block';

  const base           = getFilteredBase();
  const activePlat     = activeFilters.platform;
  const showTw         = !activePlat || activePlat === 'X/Twitter';
  const showYt         = !activePlat || activePlat === 'YouTube';
  const showOther      = !activePlat || activePlat === 'Diğer';

  const tw    = base.filter(b => b.platform === 'X/Twitter');
  const yt    = base.filter(b => b.platform === 'YouTube');
  const other = base.filter(b => b.platform === 'Diğer');

  const total = (showTw ? tw.length : 0) + (showYt ? yt.length : 0) + (showOther ? other.length : 0);
  if (DOM.resultsLabel) DOM.resultsLabel.textContent = `${total} kayıt`;

  if (total === 0) {
    DOM.emptyState.style.display = 'flex';
    DOM.grid.style.display       = 'none';
    return;
  }
  DOM.emptyState.style.display = 'none';

  const wrapper = document.createElement('div');
  wrapper.className = 'platform-sections';

  // Twitter + YouTube yan yana
  if (showTw || showYt) {
    const row = document.createElement('div');
    row.className = 'platform-row';
    if (showTw) row.appendChild(buildPlatformSection('X/Twitter', tw));
    if (showYt) row.appendChild(buildPlatformSection('YouTube',   yt));
    wrapper.appendChild(row);
  }

  // Diğer — tam genişlik
  if (showOther) {
    const sec = buildPlatformSection('Diğer', other);
    sec.classList.add('platform-section--full');
    wrapper.appendChild(sec);
  }

  DOM.grid.appendChild(wrapper);
}

function buildPlatformSection(platform, items) {
  const ICONS = {
    'X/Twitter': `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.632 5.906-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/></svg>`,
    'YouTube':   `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    'Diğer':     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>`,
  };

  const section = document.createElement('div');
  section.className = 'platform-section';

  const label = platform === 'X/Twitter' ? 'Twitter' : platform;
  section.innerHTML = `
    <div class="platform-section__header">
      <span class="platform-section__icon plat-icon--${platform === 'X/Twitter' ? 'tw' : platform === 'YouTube' ? 'yt' : 'other'}">${ICONS[platform] || ''}</span>
      <span class="platform-section__label">${label}</span>
      <span class="platform-section__count">${items.length}</span>
    </div>
  `;

  const table = document.createElement('table');
  table.className = 'bm-table';
  table.innerHTML = `<thead><tr>
    <th class="col-title">Başlık</th>
    <th class="col-date">Tarih</th>
    <th class="col-actions"></th>
  </tr></thead>`;

  const tbody = document.createElement('tbody');
  items.slice(0, 25).forEach((bm, i) => {
    const { row, editRow } = buildTableRow(bm, i);
    tbody.appendChild(row);
    tbody.appendChild(editRow);
  });
  table.appendChild(tbody);
  section.appendChild(table);
  return section;
}

// ─── Feed Görünümü ────────────────────────────────────────────────────────

function renderFeed() {
  const filtered = getFiltered();
  if (DOM.resultsLabel) DOM.resultsLabel.textContent = `${filtered.length} kayıt`;
  if (filtered.length === 0) {
    DOM.emptyState.style.display = 'flex';
    DOM.grid.style.display       = 'none';
    return;
  }
  DOM.emptyState.style.display = 'none';
  DOM.grid.style.display = 'block';

  const list = document.createElement('div');
  list.className = 'feed-list';
  filtered.forEach((bm, i) => list.appendChild(buildFeedItem(bm, i)));
  DOM.grid.appendChild(list);
}

function getYouTubeThumb(url) {
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname.includes('youtube.com')) id = u.searchParams.get('v');
    else if (u.hostname === 'youtu.be')     id = u.pathname.slice(1).split('?')[0];
    if (id) return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  } catch {}
  return null;
}

function buildFeedItem(bm, index) {
  const item = document.createElement('div');
  item.className = ['feed-item', bm.checked ? 'is-done' : '', selectedIds.has(bm.id) ? 'is-selected' : ''].filter(Boolean).join(' ');
  item.dataset.id = bm.id;
  item.dataset.platform = bm.platform;
  item.style.animationDelay = `${Math.min(index * 8, 160)}ms`;

  const faviconURL = (() => {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(bm.url).origin}&sz=32`; }
    catch { return null; }
  })();

  const platLabel = bm.platform === 'X/Twitter' ? 'Twitter' : bm.platform;
  const platCls   = bm.platform === 'X/Twitter' ? 'tw' : bm.platform === 'YouTube' ? 'yt' : 'other';
  const thumbURL  = bm.platform === 'YouTube' ? getYouTubeThumb(bm.url) : null;

  const PLAT_ICONS = {
    'X/Twitter': `<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.632 5.906-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/></svg>`,
    'YouTube':   `<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    'Diğer':     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>`,
  };

  item.innerHTML = `
    <div class="feed-item__header">
      <div class="feed-item__plat-row">
        ${faviconURL
          ? `<img class="feed-item__favicon" src="${faviconURL}" alt="" loading="lazy">`
          : `<span class="feed-item__plat-icon feed-plat--${platCls}">${PLAT_ICONS[bm.platform] || ''}</span>`}
        <span class="feed-item__plat-name feed-plat--${platCls}">${escapeHtml(platLabel)}</span>
      </div>
      <div class="feed-item__header-end">
        <span class="feed-item__date">${formatDate(bm.createdAt)}</span>
        <button class="row-btn row-btn--delete feed-item__del" title="Sil">
          <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" clip-rule="evenodd"/></svg>
        </button>
      </div>
    </div>
    <div class="feed-item__title">${escapeHtml(bm.title)}</div>
    ${thumbURL ? `<div class="feed-item__thumb-wrap"><img class="feed-item__thumb" src="${thumbURL}" alt="" loading="lazy"></div>` : ''}
    <div class="feed-item__url">${escapeHtml(shortUrl(bm.url))}</div>
  `;

  item.addEventListener('click', e => {
    if (e.target.closest('.feed-item__del')) return;
    if (isSelectMode) { toggleSelect(bm.id, !selectedIds.has(bm.id)); }
    else { chrome.tabs.create({ url: bm.url }); }
  });

  item.querySelector('.feed-item__del').addEventListener('click', e => {
    e.stopPropagation();
    if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) deleteBookmark(bm.id);
  });

  const favicon = item.querySelector('.feed-item__favicon');
  if (favicon) favicon.addEventListener('error', () => favicon.remove(), { once: true });

  const thumb = item.querySelector('.feed-item__thumb');
  if (thumb) thumb.addEventListener('error', () => thumb.closest('.feed-item__thumb-wrap')?.remove(), { once: true });

  return item;
}

// ─── Kart Oluşturma ───────────────────────────────────────────────────────

function platClass(platform) {
  if (platform === 'X/Twitter') return 'plat-tw';
  if (platform === 'YouTube')   return 'plat-yt';
  return 'plat-other';
}

function platBadgeClass(platform) {
  if (platform === 'X/Twitter') return 'plat-badge-tw';
  if (platform === 'YouTube')   return 'plat-badge-yt';
  return 'plat-badge-other';
}

function buildCard(bm, index) {
  const card = document.createElement('article');
  card.className = [
    'bm-card',
    platClass(bm.platform),
    bm.checked       ? 'is-done'     : '',
    selectedIds.has(bm.id) ? 'is-selected' : ''
  ].filter(Boolean).join(' ');

  card.dataset.id = bm.id;
  card.style.animationDelay = `${Math.min(index * 25, 280)}ms`;

  const tagsHTML = bm.tags.slice(0, 5).map(t =>
    `<span class="tag">${escapeHtml(t)}</span>`
  ).join('') + (bm.tags.length > 5 ? `<span class="tag tag-more">+${bm.tags.length - 5}</span>` : '');

  const editTagsHTML = bm.tags.map((t, i) =>
    `<span class="tag tag-removable">${escapeHtml(t)}<button class="tag-rm" data-i="${i}" type="button">×</button></span>`
  ).join('');

  const faviconURL = (() => {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(bm.url).origin}&sz=32`; }
    catch { return null; }
  })();

  card.innerHTML = `
    <div class="card-inner">

      <!-- Body: favicon + title + url (main content) -->
      <div class="card-body">
        <div class="card-favicon-row">
          ${faviconURL ? `<img class="favicon" src="${faviconURL}" alt="" loading="lazy">` : ''}
          <h3 class="card-title" title="${escapeHtml(bm.title)}">${escapeHtml(bm.title)}</h3>
        </div>
      </div>

      <!-- Bottom: foot row -->
      <div class="card-bottom">
        <div class="card-foot-row">
          <div class="card-tags">${tagsHTML}</div>
          <span class="card-date">${formatDate(bm.createdAt)}</span>
        </div>
      </div>

      <!-- Edit panel — sadece tag düzenleme -->
      <div class="card-edit" id="edit-${bm.id}">
        <div class="edit-tags-list">${editTagsHTML}</div>
        <div class="edit-tag-row">
          <input class="tag-input" type="text" placeholder="Tag ekle, Enter'a bas…" maxlength="30">
          <button class="btn-add-tag" type="button">+ Tag</button>
        </div>
      </div>

    </div>

    <!-- Menu butonu (sağ üst, hover'da görünür) -->
    <button class="btn-card-menu" aria-label="İşlemler" title="İşlemler">
      <svg viewBox="0 0 4 16" fill="currentColor" width="14" height="14"><circle cx="2" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/></svg>
    </button>

    <!-- Dropdown menu (outside card-inner to allow overflow) -->
    <div class="card-menu" hidden>
      <button class="cmenu-item cmenu-open">
        <svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z" clip-rule="evenodd"/></svg>
        Aç
      </button>
      <button class="cmenu-item cmenu-edit">
        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
        Düzenle
      </button>
      <div class="cmenu-sep"></div>
      <button class="cmenu-item ${bm.checked ? 'cmenu-undo' : 'cmenu-done'}">
        ${bm.checked
          ? '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg> Geri Al'
          : '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg> Tamamlandı'}
      </button>
      <div class="cmenu-sep"></div>
      <button class="cmenu-item cmenu-delete">
        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" clip-rule="evenodd"/></svg>
        Sil
      </button>
    </div>
  `;

  bindCardEvents(card, bm);
  return card;
}

// ─── Tablo Satırı Oluşturma (Liste Görünümü) ──────────────────────────────

function buildTableRow(bm, index) {
  const faviconURL = (() => {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(bm.url).origin}&sz=32`; }
    catch { return null; }
  })();

  const editTagsHTML = bm.tags.map((t, i) =>
    `<span class="tag tag-removable">${escapeHtml(t)}<button class="tag-rm" data-i="${i}" type="button">×</button></span>`
  ).join('');

  const row = document.createElement('tr');
  row.className = ['bm-row', bm.checked ? 'is-done' : '', selectedIds.has(bm.id) ? 'is-selected' : ''].filter(Boolean).join(' ');
  row.dataset.id = bm.id;
  row.style.animationDelay = `${Math.min(index * 15, 200)}ms`;

  row.innerHTML = `
    <td class="col-title">
      <div class="row-title-inner">
        ${faviconURL ? `<img class="favicon" src="${faviconURL}" alt="" loading="lazy">` : ''}
        <span class="row-title-text" title="${escapeHtml(bm.title)}">${escapeHtml(bm.title)}</span>
      </div>
    </td>
    <td class="col-date">${formatDate(bm.createdAt)}</td>
    <td class="col-actions">
      <button class="row-btn row-btn--delete" title="Sil">
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" clip-rule="evenodd"/></svg>
      </button>
    </td>
  `;

  const editRow = document.createElement('tr');
  editRow.className = 'bm-edit-row';
  editRow.dataset.id = bm.id;
  editRow.hidden = true;
  editRow.innerHTML = `
    <td colspan="3">
      <div class="row-edit-content">
        <div class="edit-tags-list">${editTagsHTML}</div>
        <div class="edit-tag-row">
          <input class="tag-input" type="text" placeholder="Tag ekle, Enter'a bas…" maxlength="30">
          <button class="btn-add-tag" type="button">+ Tag</button>
        </div>
      </div>
    </td>
  `;

  bindRowEvents(row, editRow, bm);
  return { row, editRow };
}

function bindRowEvents(row, editRow, bm) {
  const id = bm.id;

  row.addEventListener('click', e => {
    if (e.target.closest('.col-actions')) return;
    if (isSelectMode) { toggleSelect(id, !selectedIds.has(id)); }
    else { chrome.tabs.create({ url: bm.url }); }
  });

  row.querySelector('.row-btn--delete').addEventListener('click', e => {
    e.stopPropagation();
    if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) deleteBookmark(id);
  });

  const tagInput = editRow.querySelector('.tag-input');
  const doAdd    = () => { addTag(id, tagInput.value); tagInput.value = ''; };
  editRow.querySelector('.btn-add-tag').addEventListener('click', doAdd);
  tagInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });

  const favicon = row.querySelector('.favicon');
  if (favicon) favicon.addEventListener('error', () => favicon.remove(), { once: true });

  editRow.querySelector('.edit-tags-list')?.addEventListener('click', e => {
    if (e.target.classList.contains('tag-rm')) removeTag(id, Number(e.target.dataset.i));
  });
}

function closeMenu(card) {
  const menu = card.querySelector('.card-menu');
  if (menu) menu.hidden = true;
  card.classList.remove('menu-open');
  card.querySelector('.btn-card-menu')?.classList.remove('active');
}

function closeAllMenus() {
  document.querySelectorAll('.card-menu:not([hidden])').forEach(m => {
    m.hidden = true;
    m.closest('.bm-card')?.classList.remove('menu-open');
    m.closest('.bm-card')?.querySelector('.btn-card-menu')?.classList.remove('active');
  });
}

function bindCardEvents(card, bm) {
  const id = bm.id;

  // Karta tıklanınca URL aç (menu/edit alanına tıklamalar hariç)
  card.addEventListener('click', e => {
    if (e.target.closest('.btn-card-menu') ||
        e.target.closest('.card-menu')     ||
        e.target.closest('.card-edit'))    return;
    if (isSelectMode) {
      toggleSelect(id, !selectedIds.has(id));
    } else {
      chrome.tabs.create({ url: bm.url });
    }
  });

  // Menu button — toggle dropdown
  const menuBtn = card.querySelector('.btn-card-menu');
  const menu    = card.querySelector('.card-menu');
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = !menu.hidden;
    closeAllMenus();
    if (!isOpen) {
      menu.hidden = false;
      card.classList.add('menu-open');
      menuBtn.classList.add('active');
    }
  });

  // Menu: Aç
  card.querySelector('.cmenu-open').addEventListener('click', () => {
    chrome.tabs.create({ url: bm.url });
    closeMenu(card);
  });

  // Menu: Düzenle (toggle edit panel)
  const editPanel = card.querySelector('.card-edit');
  card.querySelector('.cmenu-edit').addEventListener('click', () => {
    editPanel.classList.toggle('open');
    closeMenu(card);
  });

  // Menu: Tamamlandı / Geri Al
  card.querySelector('.cmenu-done, .cmenu-undo')?.addEventListener('click', () => {
    toggleChecked(id);
    closeMenu(card);
  });

  // Menu: Sil
  card.querySelector('.cmenu-delete').addEventListener('click', () => {
    closeMenu(card);
    if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) deleteBookmark(id);
  });

  // Tag ekle
  const tagInput = card.querySelector('.tag-input');
  const doAdd    = () => { addTag(id, tagInput.value); tagInput.value = ''; };
  card.querySelector('.btn-add-tag').addEventListener('click', doAdd);
  tagInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });

  // Favicon yüklenemezse DOM'dan kaldır (inline onerror CSP'ye aykırı)
  const favicon = card.querySelector('.favicon');
  if (favicon) favicon.addEventListener('error', () => favicon.remove(), { once: true });

  // Tag sil (delegation)
  card.querySelector('.edit-tags-list')?.addEventListener('click', e => {
    if (e.target.classList.contains('tag-rm')) {
      removeTag(id, Number(e.target.dataset.i));
    }
  });
}

// ─── Seçim İşlemleri ──────────────────────────────────────────────────────

function toggleSelect(id, selected) {
  if (selected) selectedIds.add(id);
  else          selectedIds.delete(id);
  updateBulkBar();
  updateSelectControls();
  // Kart görünümünü güncelle
  const card = DOM.grid.querySelector(`[data-id="${id}"]`);
  if (card) card.classList.toggle('is-selected', selected);
}

function setSelectMode(enabled) {
  isSelectMode = enabled;
  DOM.btnSelectMode.classList.toggle('active', enabled);
  DOM.selectControls.style.display = enabled ? 'flex' : 'none';

  if (!enabled) {
    selectedIds.clear();
    DOM.grid.querySelectorAll('.bm-card, .bm-row, .feed-item').forEach(c => c.classList.remove('is-selected'));
  }

  updateBulkBar();
  updateSelectControls();
}

function updateSelectControls() {
  DOM.selectedCount.textContent = selectedIds.size;
}

function updateBulkBar() {
  const count = selectedIds.size;
  DOM.bulkCount.textContent = count;
  DOM.bulkBar.classList.toggle('visible', count > 0);
}

// ─── CRUD ────────────────────────────────────────────────────────────────

async function persistBookmarks() {
  await chrome.storage.local.set({ bookmarks: allBookmarks });
}

async function deleteBookmark(id) {
  allBookmarks = allBookmarks.filter(b => b.id !== id);
  selectedIds.delete(id);
  await persistBookmarks();
  renderAll();
  showToast('Kayıt silindi.', 'info');
}

async function toggleChecked(id) {
  const bm = allBookmarks.find(b => b.id === id);
  if (!bm) return;
  bm.checked = !bm.checked;
  await persistBookmarks();
  renderAll();
  showToast(bm.checked ? 'Tamamlandı olarak işaretlendi.' : 'Tekrar bekliyor olarak işaretlendi.', 'success');
}

async function updateNote(id, note) {
  const bm = allBookmarks.find(b => b.id === id);
  if (!bm) return;
  bm.note = note.trim();
  await persistBookmarks();
  renderAll();
  showToast('Not kaydedildi.', 'success');
}

async function addTag(id, tag) {
  const bm = allBookmarks.find(b => b.id === id);
  if (!bm) return;
  const t = tag.trim();
  if (!t) return;
  if (bm.tags.includes(t)) { showToast('Bu tag zaten ekli.', 'warning'); return; }
  bm.tags.push(t);
  await persistBookmarks();
  renderAll();
}

async function removeTag(id, idx) {
  const bm = allBookmarks.find(b => b.id === id);
  if (!bm) return;
  bm.tags.splice(idx, 1);
  await persistBookmarks();
  renderAll();
}

// ─── Toplu İşlemler ───────────────────────────────────────────────────────

async function bulkSetChecked(checked) {
  if (!selectedIds.size) return;
  allBookmarks.forEach(b => { if (selectedIds.has(b.id)) b.checked = checked; });
  await persistBookmarks();
  renderAll();
  showToast(`${selectedIds.size} kayıt ${checked ? 'tamamlandı' : 'bekliyor'} olarak işaretlendi.`, 'success');
}

async function bulkDelete() {
  if (!selectedIds.size) return;
  const count = selectedIds.size;
  if (!confirm(`${count} kaydı silmek istediğinize emin misiniz?`)) return;
  allBookmarks = allBookmarks.filter(b => !selectedIds.has(b.id));
  selectedIds.clear();
  await persistBookmarks();
  renderAll();
  showToast(`${count} kayıt silindi.`, 'info');
}

function bulkExport() {
  if (!selectedIds.size) return;
  const selected = allBookmarks.filter(b => selectedIds.has(b.id));
  const json  = JSON.stringify(selected, null, 2);
  const fname = `mybookmark-secim-${new Date().toISOString().slice(0,10)}.json`;
  const link  = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([json], { type: 'application/json' })),
    download: fname
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 100);
  showToast(`${selected.length} kayıt dışa aktarıldı.`, 'success');
}

// ─── Export / Import ──────────────────────────────────────────────────────

function exportAll() {
  if (!allBookmarks.length) { showToast('Dışa aktarılacak kayıt yok.', 'warning'); return; }
  const json  = JSON.stringify(allBookmarks, null, 2);
  const fname = `mybookmark-${new Date().toISOString().slice(0,10)}.json`;
  const link  = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([json], { type: 'application/json' })),
    download: fname
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 100);
  showToast(`${allBookmarks.length} kayıt dışa aktarıldı.`, 'success');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = async ({ target }) => {
    let parsed;
    try { parsed = JSON.parse(target.result); }
    catch { showToast('Geçersiz JSON dosyası!', 'error'); return; }

    if (!Array.isArray(parsed)) { showToast('Hatalı format: dizi bekleniyor.', 'error'); return; }

    const valid   = parsed.filter(validateBookmark);
    const invalid = parsed.length - valid.length;
    if (!valid.length) { showToast('Geçerli kayıt bulunamadı.', 'error'); return; }

    const existingUrls = new Set(allBookmarks.map(b => b.url));
    const newOnes      = valid.filter(b => !existingUrls.has(b.url));
    const dupes        = valid.length - newOnes.length;

    allBookmarks = [...newOnes, ...allBookmarks].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    await persistBookmarks();
    renderAll();

    const parts = [`${newOnes.length} kayıt içe aktarıldı.`];
    if (dupes)   parts.push(`${dupes} tekrar atlandı.`);
    if (invalid) parts.push(`${invalid} geçersiz yoksayıldı.`);
    showToast(parts.join(' '), 'success');
  };
  reader.onerror = () => showToast('Dosya okunamadı.', 'error');
  reader.readAsText(file, 'utf-8');
}

// ─── Toast ────────────────────────────────────────────────────────────────

function showToast(msg, type = 'info', ms = 3200) {
  const container = $('toast-container');
  const toast = Object.assign(document.createElement('div'), {
    className: `toast toast-${type}`,
    textContent: msg
  });
  container.appendChild(toast);
  setTimeout(() => toast.style.opacity = '0', ms - 300);
  setTimeout(() => toast.remove(), ms);
}

// ─── Event Listeners ──────────────────────────────────────────────────────

function setupEventListeners() {

  // Arama
  DOM.searchInput.addEventListener('input', () => {
    activeFilters.search = DOM.searchInput.value;
    renderGrid();
  });

  // Global click → menüleri kapat
  document.addEventListener('click', () => { closeAllMenus(); });

  // / tuşu → arama kutusuna odaklan
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== DOM.searchInput) {
      e.preventDefault();
      DOM.searchInput.focus();
      DOM.searchInput.select();
    }
    if (e.key === 'Escape') {
      closeAllMenus();
      if (isSelectMode) setSelectMode(false);
    }
  });

  // Sıralama
  DOM.sortSelect.addEventListener('change', () => {
    activeFilters.sort = DOM.sortSelect.value;
    renderGrid();
  });

  // Platform filtre butonları
  $('platform-filters').addEventListener('click', e => {
    const btn = e.target.closest('.fbar-btn');
    if (!btn) return;
    $('platform-filters').querySelectorAll('.fbar-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilters.platform = btn.dataset.platform ?? '';
    renderGrid();
  });

  // Durum filtre butonları
  $('status-filters').addEventListener('click', e => {
    const btn = e.target.closest('.fbar-btn');
    if (!btn) return;
    $('status-filters').querySelectorAll('.fbar-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilters.status = btn.dataset.status ?? '';
    renderGrid();
  });

  // Seçim modu
  DOM.btnSelectMode.addEventListener('click', () => setSelectMode(!isSelectMode));

  // Tümünü seç / kaldır
  DOM.btnSelectAll.addEventListener('click', () => {
    const filtered = getFiltered();
    filtered.forEach(b => selectedIds.add(b.id));
    DOM.grid.querySelectorAll('.bm-card, .bm-row, .feed-item').forEach(c => c.classList.add('is-selected'));
    updateBulkBar();
    updateSelectControls();
  });

  DOM.btnSelectNone.addEventListener('click', () => {
    selectedIds.clear();
    DOM.grid.querySelectorAll('.bm-card, .bm-row, .feed-item').forEach(c => c.classList.remove('is-selected'));
    updateBulkBar();
    updateSelectControls();
  });

  // Görünüm toggle (feed / list)
  $('view-feed').addEventListener('click', () => {
    viewMode = 'feed';
    $('view-feed').classList.add('active');
    $('view-list').classList.remove('active');
    renderGrid();
  });

  $('view-list').addEventListener('click', () => {
    viewMode = 'list';
    $('view-list').classList.add('active');
    $('view-feed').classList.remove('active');
    renderGrid();
  });

  // Toplu işlem butonları
  $('bulk-done').addEventListener('click', ()   => bulkSetChecked(true));
  $('bulk-pending').addEventListener('click', () => bulkSetChecked(false));
  $('bulk-export').addEventListener('click', ()  => bulkExport());
  $('bulk-delete').addEventListener('click', ()  => bulkDelete());
  $('bulk-cancel').addEventListener('click', ()  => setSelectMode(false));

  // Export
  $('btn-export').addEventListener('click', exportAll);

  // Import
  $('btn-import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) { importData(f); e.target.value = ''; }
  });
}

// ─── Başlat ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);

