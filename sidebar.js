/* sidebar.js — Klasör Sidebar Modülü */
'use strict';

window.SidebarModule = (function () {
  let _folders = [];
  let _activeFolderName = null;
  let _storageArea = null;

  function _getStorage() {
    if (_storageArea) return _storageArea;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) return chrome.storage.local;
    throw new Error('Storage bulunamadı');
  }

  // ─── Klasör Depolama ───────────────────────────────────────────────

  async function loadFolders() {
    const result = await _getStorage().get(['folders']);
    _folders = Array.isArray(result.folders) ? result.folders : [];
    return _folders;
  }

  async function saveFolders(list) {
    _folders = list;
    await _getStorage().set({ folders: list });
  }

  // ─── CRUD ─────────────────────────────────────────────────────────

  async function createFolder(name) {
    const trimmed = (typeof name === 'string' ? name : '').trim();
    if (!trimmed) return { success: false, reason: 'empty' };
    if (trimmed.length > 30) return { success: false, reason: 'too-long' };
    if (trimmed.toLowerCase() === 'tümü') return { success: false, reason: 'reserved' };
    if (_folders.some(f => f.name.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, reason: 'duplicate' };
    }
    const folder = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : (Date.now().toString(36) + Math.random().toString(36).slice(2)),
      name: trimmed,
      createdAt: Date.now()
    };
    await saveFolders([..._folders, folder]);
    return { success: true, folder };
  }

  async function deleteFolder(id) {
    const folder = _folders.find(f => f.id === id);
    if (!folder) return;
    await BookmarkStore.removeTagByName(folder.name, _storageArea);
    await saveFolders(_folders.filter(f => f.id !== id));
    if (_activeFolderName === folder.name) {
      _activeFolderName = null;
      document.dispatchEvent(new CustomEvent('folder-select', { detail: { folderName: null } }));
    }
  }

  async function moveToFolder(bookmarkId, targetFolderName, storageArea) {
    const allFolderNames = _folders.map(f => f.name);
    await BookmarkStore.moveBookmarkToFolder(bookmarkId, allFolderNames, targetFolderName, storageArea || _storageArea);
  }

  // ─── Sayaç ────────────────────────────────────────────────────────

  function getFolderBookmarkCount(folderName, allBookmarks) {
    if (folderName === null) return allBookmarks.length;
    return allBookmarks.filter(b => Array.isArray(b.tags) && b.tags.includes(folderName)).length;
  }

  // ─── Render ───────────────────────────────────────────────────────

  function setActiveFolderName(name) {
    _activeFolderName = name;
    const tumuHeader = document.getElementById('sidebar-tumu-item');
    if (tumuHeader) tumuHeader.classList.toggle('is-active', name === null);
    document.querySelectorAll('.folder-item').forEach(li => {
      const folder = _folders.find(f => f.id === li.dataset.folderId);
      li.classList.toggle('is-active', folder ? folder.name === name : false);
    });
  }

  function highlightFolderForBookmark(bm) {
    document.querySelectorAll('.folder-item.is-bookmark-active').forEach(el => el.classList.remove('is-bookmark-active'));
    const tumuHeader = document.getElementById('sidebar-tumu-item');
    if (tumuHeader) tumuHeader.classList.remove('is-bookmark-active');
    if (!bm) return;
    const bmFolderNames = new Set((bm.tags || []).filter(t => _folders.some(f => f.name === t)));
    if (bmFolderNames.size === 0) {
      if (tumuHeader) tumuHeader.classList.add('is-bookmark-active');
      return;
    }
    document.querySelectorAll('.folder-item').forEach(li => {
      const folder = _folders.find(f => f.id === li.dataset.folderId);
      if (folder && bmFolderNames.has(folder.name)) li.classList.add('is-bookmark-active');
    });
  }

  function renderSidebar(allBookmarks) {
    const list = document.querySelector('.folder-list');
    if (!list) return;

    // Header Tümü sayacı
    const tumuCountEl = document.getElementById('sidebar-tumu-count');
    if (tumuCountEl) tumuCountEl.textContent = getFolderBookmarkCount(null, allBookmarks);

    // Klasör item'larını temizle
    list.querySelectorAll('.folder-item').forEach(el => el.remove());

    // Her klasör için li oluştur
    _folders.forEach(folder => {
      const li = _buildFolderItem(folder, allBookmarks);
      list.appendChild(li);
    });

    // Aktif durumu güncelle
    setActiveFolderName(_activeFolderName);
  }

  function _buildFolderItem(folder, allBookmarks) {
    const li = document.createElement('li');
    li.className = 'folder-item';
    li.dataset.folderId = folder.id;

    const count = getFolderBookmarkCount(folder.name, allBookmarks);
    const esc = MyBookmarkUtils.escapeHtml;

    li.innerHTML = `
      <span class="folder-icon">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
        </svg>
      </span>
      <span class="folder-name">${esc(folder.name)}</span>
      <span class="folder-count">${count}</span>
      <button class="folder-delete" title="Klasörü sil" data-id="${folder.id}" type="button">
        <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
          <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" clip-rule="evenodd"/>
        </svg>
      </button>
    `;

    // Tıklama
    li.addEventListener('click', e => {
      if (e.target.closest('.folder-delete')) return;
      _activeFolderName = folder.name;
      setActiveFolderName(folder.name);
      document.dispatchEvent(new CustomEvent('folder-select', { detail: { folderName: folder.name } }));
    });

    // Silme
    li.querySelector('.folder-delete').addEventListener('click', async e => {
      e.stopPropagation();
      const confirmed = await _confirmDelete(folder.name);
      if (confirmed) await deleteFolder(folder.id);
    });

    // Drag over/drop
    li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('drag-over'); });
    li.addEventListener('dragleave', e => {
      if (!li.contains(e.relatedTarget)) li.classList.remove('drag-over');
    });
    li.addEventListener('drop', async e => {
      e.preventDefault();
      li.classList.remove('drag-over');
      const bookmarkId = e.dataTransfer.getData('text/plain');
      if (!bookmarkId) return;
      await moveToFolder(bookmarkId, folder.name, _storageArea);
      // onChanged.bookmarks in bookmarks.js handles re-render
    });

    return li;
  }

  // ─── Resize ───────────────────────────────────────────────────────

  function initResize() {
    const resizer = document.getElementById('sidebar-resizer');
    const sidebar = document.getElementById('sidebar');
    if (!resizer || !sidebar) return;

    resizer.addEventListener('mousedown', e => {
      e.preventDefault();
      resizer.classList.add('is-resizing');
      const startX = e.clientX;
      const startW = sidebar.offsetWidth;

      const onMove = ev => {
        const w = Math.min(350, Math.max(150, startW + (ev.clientX - startX)));
        sidebar.style.width = w + 'px';
      };
      const onUp = ev => {
        resizer.classList.remove('is-resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const w = Math.min(350, Math.max(150, startW + (ev.clientX - startX)));
        _getStorage().set({ sidebarWidth: w });
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ─── Collapse ─────────────────────────────────────────────────────

  function initCollapse() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const resizer = document.getElementById('sidebar-resizer');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', () => {
      const willCollapse = !sidebar.hidden;
      sidebar.hidden = willCollapse;
      if (resizer) resizer.hidden = willCollapse;
      toggle.classList.toggle('is-collapsed', willCollapse);
      _getStorage().set({ sidebarCollapsed: willCollapse });
    });
  }

  // ─── Onay Diyaloğu ────────────────────────────────────────────────

  function _confirmDelete(folderName) {
    return new Promise(resolve => {
      const esc = MyBookmarkUtils.escapeHtml;
      const overlay = document.createElement('div');
      overlay.className = 'sidebar-confirm-overlay';
      overlay.innerHTML = `
        <div class="sidebar-confirm-box">
          <p class="sidebar-confirm-msg"><strong>${esc(folderName)}</strong> klasörü silinsin mi?</p>
          <p class="sidebar-confirm-sub">Yer imleri silinmez, yalnızca klasör etiketi kaldırılır.</p>
          <div class="sidebar-confirm-actions">
            <button class="sidebar-confirm-cancel">İptal</button>
            <button class="sidebar-confirm-ok">Sil</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      function cleanup(result) {
        document.body.removeChild(overlay);
        resolve(result);
      }

      overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
      overlay.querySelector('.sidebar-confirm-cancel').addEventListener('click', () => cleanup(false));
      overlay.querySelector('.sidebar-confirm-ok').addEventListener('click', () => cleanup(true));
      overlay.querySelector('.sidebar-confirm-cancel').focus();
    });
  }

  // ─── Yeni Klasör Input ────────────────────────────────────────────

  function _initNewFolderInput() {
    const btn = document.getElementById('new-folder-btn');
    const inputRow = document.getElementById('new-folder-input-row');
    const input = document.getElementById('new-folder-input');
    const errorEl = document.getElementById('new-folder-error');
    if (!btn || !inputRow || !input) return;

    btn.addEventListener('click', () => {
      inputRow.hidden = false;
      input.value = '';
      if (errorEl) errorEl.hidden = true;
      input.classList.remove('is-error');
      input.focus();
    });

    const doCreate = async () => {
      if (errorEl) errorEl.hidden = true;
      input.classList.remove('is-error');
      const result = await createFolder(input.value);
      if (result.success) {
        inputRow.hidden = true;
        _activeFolderName = result.folder.name;
        // onChanged.folders triggers re-render in bookmarks.js;
        // but we also immediately render to avoid blank state
        await loadFolders();
        renderSidebar(window.__allBookmarks__ || []);
        setActiveFolderName(result.folder.name);
        document.dispatchEvent(new CustomEvent('folder-select', { detail: { folderName: result.folder.name } }));
      } else if (result.reason === 'duplicate') {
        input.classList.add('is-error');
        if (errorEl) errorEl.hidden = false;
      }
    };

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); doCreate(); }
      if (e.key === 'Escape') { inputRow.hidden = true; }
    });

    document.addEventListener('mousedown', e => {
      if (inputRow.hidden) return;
      if (!inputRow.contains(e.target) && e.target !== btn) {
        inputRow.hidden = true;
        if (errorEl) errorEl.hidden = true;
        input.classList.remove('is-error');
      }
    });
  }

  // ─── Tümü Item ────────────────────────────────────────────────────

  function _initTumuItem() {
    const tumuItem = document.querySelector('[data-folder-id="__all__"]');
    if (!tumuItem) return;

    tumuItem.addEventListener('click', e => {
      if (e.target.closest('#new-folder-btn')) return;
      _activeFolderName = null;
      setActiveFolderName(null);
      document.dispatchEvent(new CustomEvent('folder-select', { detail: { folderName: null } }));
    });

    tumuItem.addEventListener('dragover', e => { e.preventDefault(); tumuItem.classList.add('drag-over'); });
    tumuItem.addEventListener('dragleave', e => {
      if (!tumuItem.contains(e.relatedTarget)) tumuItem.classList.remove('drag-over');
    });
    tumuItem.addEventListener('drop', async e => {
      e.preventDefault();
      tumuItem.classList.remove('drag-over');
      const bookmarkId = e.dataTransfer.getData('text/plain');
      if (!bookmarkId) return;
      await moveToFolder(bookmarkId, '', _storageArea);
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────

  async function init(storageArea) {
    _storageArea = storageArea || null;

    const storage = _getStorage();
    const prefs = await storage.get(['sidebarWidth', 'sidebarCollapsed']);

    const sidebar = document.getElementById('sidebar');
    const resizer = document.getElementById('sidebar-resizer');

    if (sidebar && prefs.sidebarWidth) {
      sidebar.style.width = prefs.sidebarWidth + 'px';
    }
    if (sidebar && prefs.sidebarCollapsed) {
      sidebar.hidden = true;
      if (resizer) resizer.hidden = true;
      const toggle = document.getElementById('sidebar-toggle');
      if (toggle) toggle.classList.add('is-collapsed');
    }

    await loadFolders();
    renderSidebar([]);
    initResize();
    initCollapse();
    _initNewFolderInput();
    _initTumuItem();
  }

  // ─── Public API ───────────────────────────────────────────────────

  return {
    init,
    loadFolders,
    renderSidebar,
    createFolder,
    deleteFolder,
    moveToFolder,
    getFolderBookmarkCount,
    setActiveFolderName,
    highlightFolderForBookmark,
  };
})();
