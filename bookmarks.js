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
let selectedIds   = new Set();  // Seçili kayıt ID'leri (bulk)
let isSelectMode  = false;      // Toplu seçim modu aktif mi?
let viewMode      = 'list';     // 'list' | 'feed'
let selectedId    = null;       // Önizleme panelinde gösterilen kayıt ID'si
const LIST_PAGE_SIZE = 25;
let visibleCount  = LIST_PAGE_SIZE; // Listede gösterilen kayıt sayısı
let activeFilters = {
  search:   '',
  platform: '',
  status:   'pending',
  sort:     'newest'
};

// ─── DOM Referansları ──────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const DOM = {
  bmList:        $('bm-list'),
  emptyState:    $('empty-state'),
  resultsLabel:  $('results-label'),
  previewEmpty:  $('preview-empty'),
  previewCard:   $('preview-card'),
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
    tw:    $('s-tw'),
    yt:    $('s-yt'),
    other: $('s-other')
  }
};

// ─── Başlatma ─────────────────────────────────────────────────────────────

async function init() {
  await loadState();
  renderAll();
  setupEventListeners();

  // Dışarıdan yapılan değişiklikleri (popup, context menu) yakala
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && changes.bookmarks) {
      await loadState();
      for (const id of selectedIds) {
        if (!allBookmarks.find(b => b.id === id)) selectedIds.delete(id);
      }
      renderAll();
    }
  });

  // Sekme tekrar aktif olduğunda storage'dan taze veriyi yükle
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    await loadState();
    renderAll();
  });
}

function resetVisibleCount() {
  visibleCount = LIST_PAGE_SIZE;
}

async function loadState() {
  const state = await BookmarkStore.getState();
  allBookmarks = state.bookmarks;
}

// ─── Filtreleme & Sıralama ────────────────────────────────────────────────

function getFilteredBase() {
  return BookmarkStore.sortBookmarks(
    BookmarkStore.filterBookmarks(allBookmarks, {
      search: activeFilters.search,
      status: activeFilters.status
    }),
    activeFilters.sort
  );
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
  const tw    = allBookmarks.filter(b => b.platform === 'X/Twitter').length;
  const yt    = allBookmarks.filter(b => b.platform === 'YouTube').length;
  const other = allBookmarks.filter(b => b.platform === 'Diğer').length;

  if (DOM.stats.tw)    DOM.stats.tw.textContent    = tw;
  if (DOM.stats.yt)    DOM.stats.yt.textContent    = yt;
  if (DOM.stats.other) DOM.stats.other.textContent = other;
}

function renderGrid() {
  if (viewMode === 'feed') {
    DOM.bmList.innerHTML = '';
    renderFeed();
    return;
  }
  renderListView();
}

function renderListView() {
  DOM.bmList.innerHTML = '';

  const filtered = getFiltered();

  if (DOM.resultsLabel) {
    DOM.resultsLabel.textContent = `${filtered.length} kayıt`;
  }

  if (filtered.length === 0) {
    DOM.emptyState.style.display = 'flex';
    DOM.bmList.style.display     = 'none';
    if (selectedId && !filtered.find(b => b.id === selectedId)) {
      selectedId = null;
      renderPreview(null);
    }
    return;
  }

  DOM.emptyState.style.display = 'none';
  DOM.bmList.style.display     = 'block';

  if (selectedId && !filtered.find(b => b.id === selectedId)) {
    selectedId = null;
    renderPreview(null);
  }

  const visible = filtered.slice(0, visibleCount);
  visible.forEach((bm, i) => DOM.bmList.appendChild(buildListItem(bm, i)));

  if (filtered.length > visibleCount) {
    const footer = document.createElement('div');
    footer.className = 'bm-list-footer';
    const btn = document.createElement('button');
    btn.className = 'load-more-btn';
    btn.type = 'button';
    btn.textContent = `Daha Fazla Yükle (${filtered.length - visibleCount} kaldı)`;
    btn.addEventListener('click', () => {
      visibleCount += LIST_PAGE_SIZE;
      renderListView();
    });
    footer.appendChild(btn);
    DOM.bmList.appendChild(footer);
  }
}

function buildListItem(bm, index) {
  const platCls = getPlatformClass(bm.platform);

  const item = document.createElement('div');
  item.className = [
    'bm-list-item',
    bm.checked ? 'is-done' : '',
    selectedIds.has(bm.id) ? 'is-checked-select' : '',
    bm.id === selectedId  ? 'is-selected-preview' : ''
  ].filter(Boolean).join(' ');
  item.dataset.id = bm.id;
  item.style.animationDelay = `${Math.min(index * 10, 150)}ms`;

  const statusIcon = bm.checked
    ? `<svg class="bm-li-status bm-li-status--done" viewBox="0 0 16 16" fill="currentColor"><path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>`
    : `<svg class="bm-li-status" viewBox="0 0 16 16" fill="currentColor"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/></svg>`;

  item.innerHTML = `
    <div class="bm-li-checkbox" aria-hidden="true">
      <svg viewBox="0 0 12 12" fill="currentColor" width="10" height="10"><path d="M10.28 1.28L3.989 7.575 1.695 5.28A1 1 0 0 0 .28 6.695l3 3a1 1 0 0 0 1.414 0l7-7A1 1 0 0 0 10.28 1.28z"/></svg>
    </div>
    <div class="bm-li-dot bm-li-dot--${platCls}"></div>
    <div class="bm-li-body">
      <div class="bm-li-title" title="${escapeAttribute(bm.title)}">${escapeHtml(bm.title)}</div>
      <div class="bm-li-meta">
        <span class="bm-li-date">${formatDate(bm.createdAt)}</span>
        ${statusIcon}
      </div>
    </div>
    <button class="bm-li-delete" title="Sil" type="button">
      <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" clip-rule="evenodd"/></svg>
    </button>
  `;

  item.addEventListener('click', e => {
    if (e.target.closest('.bm-li-delete')) return;
    if (isSelectMode) {
      toggleSelect(bm.id, !selectedIds.has(bm.id));
    } else {
      selectBookmark(bm.id);
    }
  });

  item.querySelector('.bm-li-delete').addEventListener('click', e => {
    e.stopPropagation();
    if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) deleteBookmark(bm.id);
  });

  return item;
}

// ─── Feed Görünümü ────────────────────────────────────────────────────────

function renderFeed() {
  const filtered = getFiltered();
  if (DOM.resultsLabel) DOM.resultsLabel.textContent = `${filtered.length} kayıt • feed görünümü`;
  if (filtered.length === 0) {
    DOM.emptyState.style.display = 'flex';
    DOM.bmList.style.display     = 'none';
    return;
  }
  DOM.emptyState.style.display = 'none';
  DOM.bmList.style.display = 'block';

  const list = document.createElement('div');
  list.className = 'feed-list';
  filtered.forEach((bm, i) => list.appendChild(buildFeedItem(bm, i)));
  DOM.bmList.appendChild(list);
}

// ─── Önizleme ─────────────────────────────────────────────────────────────

function selectBookmark(id) {
  selectedId = id;
  DOM.bmList.querySelectorAll('.bm-list-item').forEach(el => {
    el.classList.toggle('is-selected-preview', el.dataset.id === id);
  });
  const bm = allBookmarks.find(b => b.id === id);
  renderPreview(bm || null);
}

function renderPreview(bm) {
  if (!bm) {
    DOM.previewEmpty.style.display = '';
    DOM.previewCard.style.display  = 'none';
    DOM.previewCard.innerHTML = '';
    return;
  }

  DOM.previewEmpty.style.display = 'none';
  DOM.previewCard.style.display  = 'block';

  const platCls   = getPlatformClass(bm.platform);
  const platLabel = bm.platform === 'X/Twitter' ? 'Twitter' : bm.platform;

  const PLAT_ICONS = {
    'X/Twitter': `<svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.632 5.906-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/></svg>`,
    'YouTube':   `<svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    'Diğer':     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>`,
  };

  const BIG_PLAT_ICONS = {
    'X/Twitter': `<svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.632 5.906-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/></svg>`,
    'YouTube':   `<svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    'Diğer':     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="36" height="36"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>`,
  };

  let thumbHTML;
  if (bm.thumbnail) {
    thumbHTML = `
      <div class="pv-thumb">
        <img src="${escapeAttribute(bm.thumbnail)}" alt="" loading="lazy"
             onerror="this.parentElement.innerHTML='<div class=\\'pv-thumb-placeholder pv-thumb-placeholder--${platCls}\\'>${(BIG_PLAT_ICONS[bm.platform] || '').replace(/'/g, "\\'")}</div>'">
        <span class="pv-plat-badge pv-plat-badge--${platCls}">${PLAT_ICONS[bm.platform] || ''}${escapeHtml(platLabel)}</span>
      </div>
    `;
  } else {
    thumbHTML = `
      <div class="pv-thumb">
        <div class="pv-thumb-placeholder pv-thumb-placeholder--${platCls}">
          ${BIG_PLAT_ICONS[bm.platform] || ''}
        </div>
        <span class="pv-plat-badge pv-plat-badge--${platCls}">${PLAT_ICONS[bm.platform] || ''}${escapeHtml(platLabel)}</span>
      </div>
    `;
  }

  const tagsHTML = bm.tags.length > 0
    ? `<div class="pv-tags">${bm.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  const noteHTML = bm.note
    ? `<div class="pv-note-section"><div class="pv-note-label">Not</div><div class="pv-note-text">${escapeHtml(bm.note)}</div></div>`
    : '';

  const doneLabel = bm.checked ? 'Bekliyor Yap' : 'Tamamlandı';

  DOM.previewCard.innerHTML = `
    ${thumbHTML}
    <h2 class="pv-title" title="${escapeAttribute(bm.title)}">${escapeHtml(bm.title)}</h2>
    <div class="pv-url">🔗 <a href="${escapeAttribute(bm.url)}" target="_blank" rel="noopener">${escapeHtml(shortUrl(bm.url, 60))}</a></div>
    <div class="pv-meta">
      <span class="pv-meta-item">📅 ${escapeHtml(formatDate(bm.createdAt))}</span>
      <span class="pv-plat-badge pv-plat-badge--${platCls}">${PLAT_ICONS[bm.platform] || ''}${escapeHtml(bm.platform === 'X/Twitter' ? 'Twitter' : bm.platform === 'Diğer' ? 'Web' : bm.platform)}</span>
      ${bm.checked ? '<span class="pv-meta-item" style="color:#4ade80">✓ Tamamlandı</span>' : ''}
    </div>
    <div class="pv-divider"></div>
    ${noteHTML}
    ${tagsHTML}
    <div class="pv-actions">
      <button class="pv-btn pv-btn--primary" data-action="open">
        <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z" clip-rule="evenodd"/></svg>
        Aç
      </button>
      <button class="pv-btn" data-action="toggle-done">
        <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>
        ${escapeHtml(doneLabel)}
      </button>
      <button class="pv-btn pv-btn--danger" data-action="delete">
        <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" clip-rule="evenodd"/></svg>
        Sil
      </button>
    </div>
  `;

  DOM.previewCard.querySelector('[data-action="open"]').addEventListener('click', () => {
    chrome.tabs.create({ url: bm.url });
  });

  DOM.previewCard.querySelector('[data-action="toggle-done"]').addEventListener('click', () => {
    toggleCheckedAndReselect(bm.id);
  });

  DOM.previewCard.querySelector('[data-action="delete"]').addEventListener('click', () => {
    if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
      selectedId = null;
      deleteBookmark(bm.id);
    }
  });
}

function getPlatformClass(platform) {
  return platform === 'X/Twitter' ? 'tw' : platform === 'YouTube' ? 'yt' : 'other';
}

function getSiteMeta(url, platform) {
  const fallbackLabel = platform === 'X/Twitter' ? 'TW' : platform === 'YouTube' ? 'YT' : 'WB';

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const letters = hostname.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();
    return {
      host: hostname,
      initials: letters || fallbackLabel
    };
  } catch {
    return {
      host: 'local',
      initials: fallbackLabel
    };
  }
}

function buildSiteBadge(url, platform, extraClass = '') {
  const meta = getSiteMeta(url, platform);
  const platformClass = getPlatformClass(platform);

  return `<span class="site-badge ${extraClass} site-badge--${platformClass}" title="${escapeAttribute(meta.host)}">${escapeHtml(meta.initials)}</span>`;
}

function buildFeedPreview(bm) {
  const meta = getSiteMeta(bm.url, bm.platform);
  const platformClass = getPlatformClass(bm.platform);
  const platformLabel = bm.platform === 'X/Twitter' ? 'Twitter' : bm.platform;

  return `
    <div class="feed-item__thumb-wrap feed-item__thumb-wrap--placeholder">
      <div class="feed-item__thumb-placeholder feed-thumb--${platformClass}">
        ${buildSiteBadge(bm.url, bm.platform, 'feed-thumb-badge')}
        <div class="feed-item__thumb-meta">
          <strong>${escapeHtml(platformLabel)}</strong>
          <span>${escapeHtml(meta.host)}</span>
        </div>
      </div>
    </div>
  `;
}

function buildFeedItem(bm, index) {
  const item = document.createElement('div');
  item.className = ['feed-item', bm.checked ? 'is-done' : '', selectedIds.has(bm.id) ? 'is-selected' : ''].filter(Boolean).join(' ');
  item.dataset.id = bm.id;
  item.dataset.platform = bm.platform;
  item.style.animationDelay = `${Math.min(index * 8, 160)}ms`;

  const platLabel = bm.platform === 'X/Twitter' ? 'Twitter' : bm.platform;
  const platCls   = getPlatformClass(bm.platform);

  const PLAT_ICONS = {
    'X/Twitter': `<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.632 5.906-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/></svg>`,
    'YouTube':   `<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    'Diğer':     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>`,
  };

  item.innerHTML = `
    <div class="feed-item__header">
      <div class="feed-item__plat-row">
        ${buildSiteBadge(bm.url, bm.platform)}
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
    ${buildFeedPreview(bm)}
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

  card.innerHTML = `
    <div class="card-inner">

      <!-- Body: favicon + title + url (main content) -->
      <div class="card-body">
        <div class="card-favicon-row">
          ${buildSiteBadge(bm.url, bm.platform, 'site-badge--card')}
          <h3 class="card-title" title="${escapeAttribute(bm.title)}">${escapeHtml(bm.title)}</h3>
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
        ${buildSiteBadge(bm.url, bm.platform, 'site-badge--row')}
        <span class="row-title-text" title="${escapeAttribute(bm.title)}">${escapeHtml(bm.title)}</span>
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
  // Liste öğesi görünümünü güncelle
  const item = DOM.bmList.querySelector(`[data-id="${id}"]`);
  if (item) item.classList.toggle('is-checked-select', selected);
}

function setSelectMode(enabled) {
  isSelectMode = enabled;
  DOM.btnSelectMode.classList.toggle('active', enabled);
  DOM.selectControls.style.display = enabled ? 'flex' : 'none';

  if (!enabled) {
    selectedIds.clear();
    DOM.bmList.querySelectorAll('.bm-list-item, .feed-item').forEach(c => c.classList.remove('is-checked-select'));
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
  const state = await BookmarkStore.commitState(null, allBookmarks);
  allBookmarks = state.bookmarks;
}

async function deleteBookmark(id) {
  const state = await BookmarkStore.deleteBookmark(id);
  allBookmarks = state.bookmarks;
  selectedIds.delete(id);
  renderAll();
  showToast('Kayıt silindi.', 'info');
}

async function toggleChecked(id) {
  const state = await BookmarkStore.toggleChecked(id);
  if (!state.success) return;
  allBookmarks = state.bookmarks;
  renderAll();
  showToast(state.bookmark.checked ? 'Tamamlandı olarak işaretlendi.' : 'Tekrar bekliyor olarak işaretlendi.', 'success');
}

async function toggleCheckedAndReselect(id) {
  const state = await BookmarkStore.toggleChecked(id);
  if (!state.success) return;
  allBookmarks = state.bookmarks;
  renderAll();
  if (selectedId === id) {
    const updated = allBookmarks.find(b => b.id === id);
    if (updated) {
      DOM.bmList.querySelectorAll('.bm-list-item').forEach(el => {
        el.classList.toggle('is-selected-preview', el.dataset.id === id);
      });
      renderPreview(updated);
    }
  }
  showToast(state.bookmark.checked ? 'Tamamlandı olarak işaretlendi.' : 'Tekrar bekliyor olarak işaretlendi.', 'success');
}

async function updateNote(id, note) {
  const state = await BookmarkStore.updateNote(id, note);
  if (!state.success) return;
  allBookmarks = state.bookmarks;
  renderAll();
  showToast('Not kaydedildi.', 'success');
}

async function addTag(id, tag) {
  const state = await BookmarkStore.addTag(id, tag);
  if (!state.success) {
    if (state.reason === 'duplicate-tag') showToast('Bu tag zaten ekli.', 'warning');
    return;
  }
  allBookmarks = state.bookmarks;
  renderAll();
}

async function removeTag(id, idx) {
  const state = await BookmarkStore.removeTag(id, idx);
  if (!state.success) return;
  allBookmarks = state.bookmarks;
  renderAll();
}

// ─── Toplu İşlemler ───────────────────────────────────────────────────────

async function bulkSetChecked(checked) {
  if (!selectedIds.size) return;
  const count = selectedIds.size;
  const state = await BookmarkStore.bulkSetChecked([...selectedIds], checked);
  allBookmarks = state.bookmarks;
  renderAll();
  showToast(`${count} kayıt ${checked ? 'tamamlandı' : 'bekliyor'} olarak işaretlendi.`, 'success');
}

async function bulkDelete() {
  if (!selectedIds.size) return;
  const count = selectedIds.size;
  if (!confirm(`${count} kaydı silmek istediğinize emin misiniz?`)) return;
  const state = await BookmarkStore.bulkDelete([...selectedIds]);
  allBookmarks = state.bookmarks;
  selectedIds.clear();
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

    const result = await BookmarkStore.importBookmarks(parsed);
    if (!result.success && result.added === 0) {
      const message = result.reason === 'invalid-format'
        ? 'Hatalı format: dizi bekleniyor.'
        : 'Geçerli kayıt bulunamadı.';
      showToast(message, 'error');
      return;
    }

    allBookmarks = result.bookmarks;
    renderAll();

    const parts = [`${result.added} kayıt içe aktarıldı.`];
    if (result.duplicates) parts.push(`${result.duplicates} tekrar atlandı.`);
    if (result.invalid) parts.push(`${result.invalid} geçersiz yoksayıldı.`);
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
    resetVisibleCount();
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
    resetVisibleCount();
    renderGrid();
  });

  // Platform filtre butonları
  $('platform-filters').addEventListener('click', e => {
    const btn = e.target.closest('.fbar-btn');
    if (!btn) return;
    $('platform-filters').querySelectorAll('.fbar-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilters.platform = btn.dataset.platform ?? '';
    resetVisibleCount();
    renderGrid();
  });

  // Durum filtre butonları
  $('status-filters').addEventListener('click', e => {
    const btn = e.target.closest('.fbar-btn');
    if (!btn) return;
    $('status-filters').querySelectorAll('.fbar-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilters.status = btn.dataset.status ?? '';
    resetVisibleCount();
    renderGrid();
  });

  // Seçim modu
  DOM.btnSelectMode.addEventListener('click', () => setSelectMode(!isSelectMode));

  // Tümünü seç / kaldır
  DOM.btnSelectAll.addEventListener('click', () => {
    const filtered = getFiltered();
    filtered.forEach(b => selectedIds.add(b.id));
    DOM.bmList.querySelectorAll('.bm-list-item, .feed-item').forEach(c => c.classList.add('is-checked-select'));
    updateBulkBar();
    updateSelectControls();
  });

  DOM.btnSelectNone.addEventListener('click', () => {
    selectedIds.clear();
    DOM.bmList.querySelectorAll('.bm-list-item, .feed-item').forEach(c => c.classList.remove('is-checked-select'));
    updateBulkBar();
    updateSelectControls();
  });

  // Görünüm toggle (feed / list)
  $('view-feed').addEventListener('click', () => {
    viewMode = 'feed';
    $('view-feed').classList.add('active');
    $('view-list').classList.remove('active');
    resetVisibleCount();
    renderGrid();
  });

  $('view-list').addEventListener('click', () => {
    viewMode = 'list';
    $('view-list').classList.add('active');
    $('view-feed').classList.remove('active');
    resetVisibleCount();
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
