# Sidebar Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible, resizable sidebar with tag-based folders + drag & drop to move bookmarks between folders.

**Architecture:** Folders are persisted in `chrome.storage.local` as a separate `folders` key. Each folder maps to a tag name on bookmarks — the sidebar is a UI layer on top of the existing tag system. A new `sidebar.js` module owns all sidebar logic; `bookmarks.js` is updated minimally to wire in the folder filter and drag events.

**Tech Stack:** Vanilla JS (no frameworks), Chrome Extension APIs, HTML5 Drag & Drop API, CSS custom properties (existing dark theme).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `store.js` | Modify | Add `removeTagByName`, `moveBookmarkToFolder` |
| `bookmarks.html` | Modify | Add sidebar DOM, toggle button, `<script src="sidebar.js">` |
| `bookmarks.css` | Modify | Sidebar layout + folder item + drag + resize styles |
| `sidebar.js` | **Create** | All sidebar logic: CRUD, render, drag/drop, resize, collapse |
| `bookmarks.js` | Modify | `activeFilters.folder`, `getFiltered()`, dragstart/dragend, event listeners |
| `tests/run-tests.js` | Modify | Tests for the two new `store.js` functions |

---

## Task 1: store.js — `removeTagByName` + `moveBookmarkToFolder`

**Files:**
- Modify: `store.js:265-282` (the `return {}` block)
- Modify: `tests/run-tests.js` (add tests at the end of the `tests` array)

- [ ] **Step 1: Write failing tests**

Add these two test objects to the `tests` array in `tests/run-tests.js`, before the final closing `];`:

```js
{
  name: 'removeTagByName: tum bookmarklardan belirtilen tag kaldirilir',
  async run() {
    const storage = createStorage({
      bookmarks: [
        { id: 'b1', url: 'https://a.com', title: 'A', platform: 'Diğer', createdAt: new Date().toISOString(), checked: false, favorite: false, note: '', tags: ['react', 'work'], thumbnail: null },
        { id: 'b2', url: 'https://b.com', title: 'B', platform: 'Diğer', createdAt: new Date().toISOString(), checked: false, favorite: false, note: '', tags: ['design'], thumbnail: null },
        { id: 'b3', url: 'https://c.com', title: 'C', platform: 'Diğer', createdAt: new Date().toISOString(), checked: false, favorite: false, note: '', tags: ['react'], thumbnail: null },
      ]
    });
    await store.removeTagByName('react', storage);
    const state = await store.getState(storage);
    assert.deepEqual(state.bookmarks.find(b => b.id === 'b1').tags, ['work']);
    assert.deepEqual(state.bookmarks.find(b => b.id === 'b2').tags, ['design']);
    assert.deepEqual(state.bookmarks.find(b => b.id === 'b3').tags, []);
  }
},
{
  name: 'moveBookmarkToFolder: eski klasor tagleri cikarilir, yeni tag eklenir',
  async run() {
    const storage = createStorage({
      bookmarks: [
        { id: 'bx', url: 'https://x.com', title: 'X', platform: 'Diğer', createdAt: new Date().toISOString(), checked: false, favorite: false, note: '', tags: ['react', 'misc'], thumbnail: null },
      ]
    });
    const allFolderNames = ['react', 'design', 'work'];
    await store.moveBookmarkToFolder('bx', allFolderNames, 'design', storage);
    const state = await store.getState(storage);
    const tags = state.bookmarks.find(b => b.id === 'bx').tags;
    assert.ok(!tags.includes('react'), 'eski klasor tagi kalmalamali');
    assert.ok(tags.includes('design'), 'yeni klasor tagi eklenmeli');
    assert.ok(tags.includes('misc'), 'klasor olmayan tag korunmali');
  }
},
{
  name: 'moveBookmarkToFolder: Tumuye tasima tum klasor taglerini kaldirir',
  async run() {
    const storage = createStorage({
      bookmarks: [
        { id: 'by', url: 'https://y.com', title: 'Y', platform: 'Diğer', createdAt: new Date().toISOString(), checked: false, favorite: false, note: '', tags: ['react', 'misc'], thumbnail: null },
      ]
    });
    await store.moveBookmarkToFolder('by', ['react', 'design'], '', storage);
    const state = await store.getState(storage);
    const tags = state.bookmarks.find(b => b.id === 'by').tags;
    assert.ok(!tags.includes('react'), 'klasor tagi kalmalamali');
    assert.ok(tags.includes('misc'), 'klasor olmayan tag korunmali');
  }
},
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node tests/run-tests.js
```
Expected: FAIL — `store.removeTagByName is not a function`

- [ ] **Step 3: Add `removeTagByName` and `moveBookmarkToFolder` to `store.js`**

Add these two functions before the `return {` line (around line 265):

```js
async function removeTagByName(tagName, storageArea) {
  return mutateState(storageArea, bookmarks => {
    bookmarks.forEach(bm => {
      const idx = bm.tags.indexOf(tagName);
      if (idx !== -1) bm.tags.splice(idx, 1);
    });
  });
}

async function moveBookmarkToFolder(id, allFolderNames, targetFolderName, storageArea) {
  return mutateState(storageArea, bookmarks => {
    const bm = bookmarks.find(b => b.id === id);
    if (!bm) return { success: false, reason: 'not-found' };
    bm.tags = bm.tags.filter(t => !allFolderNames.includes(t));
    if (targetFolderName) bm.tags.push(targetFolderName);
    return { success: true };
  });
}
```

Then add both to the `return {}` block:

```js
return {
  addTag,
  bulkDelete,
  bulkSetChecked,
  commitState,
  deleteBookmark,
  filterBookmarks,
  getState,
  importBookmarks,
  moveBookmarkToFolder,
  rebuildTagUsage,
  removeTag,
  removeTagByName,
  saveBookmark,
  sortBookmarks,
  toggleChecked,
  toggleFavorite,
  updateNote,
  updateThumbnail
};
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
node tests/run-tests.js
```
Expected: All tests PASS including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add store.js tests/run-tests.js
git commit -m "feat(store): add removeTagByName and moveBookmarkToFolder"
```

---

## Task 2: bookmarks.html — Sidebar DOM Structure

**Files:**
- Modify: `bookmarks.html`

- [ ] **Step 1: Add sidebar-toggle button to the header**

In `bookmarks.html`, find the `<div class="header-brand">` block and add the toggle button right before `<div class="header-search">`:

```html
    <button id="sidebar-toggle" class="sidebar-toggle-btn" title="Klasörleri Göster/Gizle">
      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
        <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
      </svg>
    </button>
```

- [ ] **Step 2: Add sidebar HTML before `.panel-list`**

In `bookmarks.html`, find `<!-- ═══════════════════ APP BODY ═══════════════════ -->` section. Replace:

```html
  <!-- ═══════════════════ APP BODY ═══════════════════ -->
  <div class="app-body">

    <!-- ── Sol Panel: MyBookmarks Listesi ── -->
    <div class="panel-list" id="panel-list">
```

With:

```html
  <!-- ═══════════════════ APP BODY ═══════════════════ -->
  <div class="app-body">

    <!-- ── Sidebar: Klasörler ── -->
    <div id="sidebar">
      <div class="sidebar-header">Klasörler</div>
      <ul class="folder-list">
        <li class="folder-item is-active" data-folder-id="__all__">
          <span class="folder-icon">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
          </span>
          <span class="folder-name">Tümü</span>
          <span class="folder-count"></span>
        </li>
      </ul>
      <div id="new-folder-input-row" hidden>
        <input id="new-folder-input" type="text" maxlength="30" placeholder="Klasör adı…" autocomplete="off">
        <span class="new-folder-error" id="new-folder-error" hidden>Bu isim zaten var</span>
      </div>
      <button id="new-folder-btn" class="new-folder-btn">
        <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
        Yeni Klasör
      </button>
    </div>

    <!-- ── Sidebar Resize Tutacağı ── -->
    <div id="sidebar-resizer" class="sidebar-resizer"></div>

    <!-- ── Sol Panel: MyBookmarks Listesi ── -->
    <div class="panel-list" id="panel-list">
```

- [ ] **Step 3: Add `sidebar.js` script tag**

In `bookmarks.html`, find:
```html
  <script src="utils.js?v=2"></script>
  <script src="store.js?v=2"></script>
  <script src="bookmarks.js?v=22"></script>
```

Replace with:
```html
  <script src="utils.js?v=2"></script>
  <script src="store.js?v=2"></script>
  <script src="sidebar.js?v=1"></script>
  <script src="bookmarks.js?v=22"></script>
```

- [ ] **Step 4: Commit**

```bash
git add bookmarks.html
git commit -m "feat(html): add sidebar DOM structure and toggle button"
```

---

## Task 3: bookmarks.css — Sidebar Styles

**Files:**
- Modify: `bookmarks.css` (append at the end)

- [ ] **Step 1: Add sidebar CSS at the end of `bookmarks.css`**

```css
/* ─── Sidebar Toggle Button ────────────────────────────────────────── */
.sidebar-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-2);
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  margin-right: 8px;
}
.sidebar-toggle-btn:hover {
  background: var(--surface-2);
  border-color: var(--border-hover);
  color: var(--text);
}
.sidebar-toggle-btn.is-collapsed {
  color: var(--text-3);
}

/* ─── Sidebar Layout ─────────────────────────────────────────────── */
#sidebar {
  width: 200px;
  min-width: 150px;
  max-width: 350px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow: hidden;
  transition: width 0.0s;
}

#sidebar-resizer {
  width: 4px;
  flex-shrink: 0;
  background: transparent;
  cursor: col-resize;
  transition: background 0.15s;
  position: relative;
  z-index: 2;
}
#sidebar-resizer:hover,
#sidebar-resizer.is-resizing {
  background: var(--accent-dim);
}

.sidebar-header {
  padding: 14px 14px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
  flex-shrink: 0;
}

/* ─── Folder List ────────────────────────────────────────────────── */
.folder-list {
  list-style: none;
  margin: 0;
  padding: 0 6px;
  overflow-y: auto;
  flex: 1;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 8px;
  border-radius: 7px;
  cursor: pointer;
  user-select: none;
  color: var(--text-2);
  font-size: 13px;
  position: relative;
  transition: background 0.12s, color 0.12s;
}
.folder-item:hover {
  background: var(--surface-2);
  color: var(--text);
}
.folder-item.is-active {
  background: var(--accent-dim);
  color: var(--accent);
  font-weight: 500;
}
.folder-item.drag-over {
  background: var(--accent-muted);
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.folder-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--text-3);
}
.folder-item.is-active .folder-icon {
  color: var(--accent);
}

.folder-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-count {
  font-size: 11px;
  color: var(--text-3);
  min-width: 16px;
  text-align: right;
  flex-shrink: 0;
}

.folder-delete {
  display: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-3);
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 0.12s, color 0.12s;
}
.folder-item:hover .folder-delete {
  display: flex;
}
.folder-delete:hover {
  background: var(--danger-dim);
  color: var(--danger);
}

/* ─── New Folder Input ───────────────────────────────────────────── */
#new-folder-input-row {
  padding: 6px 10px 2px;
  flex-shrink: 0;
}

#new-folder-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
  font-family: var(--font);
}
#new-folder-input:focus {
  border-color: var(--border-focus);
}
#new-folder-input.is-error {
  border-color: var(--danger);
  animation: shake 0.3s ease;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.new-folder-error {
  display: block;
  font-size: 11px;
  color: var(--danger);
  padding: 3px 2px 0;
}

.new-folder-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 6px 10px 10px;
  padding: 6px 10px;
  background: transparent;
  border: 1px dashed var(--border);
  border-radius: 7px;
  color: var(--text-3);
  font-size: 12px;
  cursor: pointer;
  font-family: var(--font);
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  flex-shrink: 0;
}
.new-folder-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-dim);
}

/* ─── Drag Source ────────────────────────────────────────────────── */
.bm-row.is-dragging {
  opacity: 0.45;
  cursor: grabbing;
}
```

- [ ] **Step 2: Commit**

```bash
git add bookmarks.css
git commit -m "feat(css): add sidebar styles"
```

---

## Task 4: sidebar.js — Create the Module

**Files:**
- Create: `sidebar.js`

Note: `sidebar.js` uses `BookmarkStore` (loaded before it via `store.js` script tag) and `escapeHtml` from `utils.js`. `window.SidebarModule` is exposed for `bookmarks.js`.

- [ ] **Step 1: Create `sidebar.js`**

```js
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
    document.querySelectorAll('.folder-item').forEach(li => {
      const fid = li.dataset.folderId;
      if (fid === '__all__') {
        li.classList.toggle('is-active', name === null);
      } else {
        const folder = _folders.find(f => f.id === fid);
        li.classList.toggle('is-active', folder ? folder.name === name : false);
      }
    });
  }

  function renderSidebar(allBookmarks) {
    const list = document.querySelector('.folder-list');
    if (!list) return;

    // Tümü sayacı
    const allCountEl = list.querySelector('[data-folder-id="__all__"] .folder-count');
    if (allCountEl) allCountEl.textContent = getFolderBookmarkCount(null, allBookmarks);

    // Dinamik klasör item'larını temizle
    list.querySelectorAll('.folder-item:not([data-folder-id="__all__"])').forEach(el => el.remove());

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
      await deleteFolder(folder.id);
      // bookmarks.js onChanged chain will re-render sidebar
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
  }

  // ─── Tümü Item ────────────────────────────────────────────────────

  function _initTumuItem() {
    const tumuItem = document.querySelector('[data-folder-id="__all__"]');
    if (!tumuItem) return;

    tumuItem.addEventListener('click', () => {
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
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add sidebar.js
git commit -m "feat: add sidebar.js module (folders, drag/drop, resize, collapse)"
```

---

## Task 5: bookmarks.js — Wire In Folder Filter & Drag Events

**Files:**
- Modify: `bookmarks.js`

This task has 5 small changes. Apply them one by one.

### 5a: Add `folder` to `activeFilters` and `getFiltered()`

- [ ] **Step 1: Add `folder: null` to `activeFilters`**

Find (around line 31):
```js
let activeFilters = {
  search:        '',
  platform:      '',
  status:        'pending',
  sort:          'newest',
  onlyFavorites: false
};
```

Replace with:
```js
let activeFilters = {
  search:        '',
  platform:      '',
  status:        'pending',
  sort:          'newest',
  onlyFavorites: false,
  folder:        null
};
```

- [ ] **Step 2: Add folder filter to `getFiltered()`**

Find (around line 127):
```js
function getFiltered() {
  let list = getFilteredBase();
  if (activeFilters.platform)      list = list.filter(b => b.platform === activeFilters.platform);
  if (activeFilters.onlyFavorites) list = list.filter(b => b.favorite === true);
  return list;
}
```

Replace with:
```js
function getFiltered() {
  let list = getFilteredBase();
  if (activeFilters.platform)      list = list.filter(b => b.platform === activeFilters.platform);
  if (activeFilters.onlyFavorites) list = list.filter(b => b.favorite === true);
  if (activeFilters.folder)        list = list.filter(b => b.tags.includes(activeFilters.folder));
  return list;
}
```

### 5b: Share `allBookmarks` with `sidebar.js`

- [ ] **Step 3: Expose `allBookmarks` on window for sidebar**

Find the `loadState` function:
```js
async function loadState() {
  const state = await BookmarkStore.getState();
  allBookmarks = state.bookmarks;
}
```

Replace with:
```js
async function loadState() {
  const state = await BookmarkStore.getState();
  allBookmarks = state.bookmarks;
  window.__allBookmarks__ = allBookmarks;
}
```

### 5c: Add `draggable` and drag events to list rows

- [ ] **Step 4: Add drag support to `buildTableRow`**

Find in `buildTableRow` (around line 628):
```js
  const row = document.createElement('tr');
  row.className = ['bm-row', bm.checked ? 'is-done' : '', selectedIds.has(bm.id) ? 'is-selected' : ''].filter(Boolean).join(' ');
  row.dataset.id = bm.id;
  row.style.animationDelay = `${Math.min(index * 15, 200)}ms`;
```

Replace with:
```js
  const row = document.createElement('tr');
  row.className = ['bm-row', bm.checked ? 'is-done' : '', selectedIds.has(bm.id) ? 'is-selected' : ''].filter(Boolean).join(' ');
  row.dataset.id = bm.id;
  row.style.animationDelay = `${Math.min(index * 15, 200)}ms`;
  row.setAttribute('draggable', 'true');
  row.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', bm.id);
    row.classList.add('is-dragging');
  });
  row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
```

### 5d: Add `folder-select` event listener in `init()`

- [ ] **Step 5: Add listener after `setupEventListeners()` call in `init()`**

Find in `init()`:
```js
  await loadState();
  renderAll();
  setupEventListeners();
  initPanelResize();
```

Replace with:
```js
  await loadState();
  renderAll();
  setupEventListeners();
  initPanelResize();
  await SidebarModule.init();
  SidebarModule.renderSidebar(allBookmarks);

  document.addEventListener('folder-select', e => {
    activeFilters.folder = e.detail.folderName;
    visibleCount = LIST_PAGE_SIZE;
    renderAll();
  });
```

### 5e: Update `onChanged` and `visibilitychange` to refresh sidebar

- [ ] **Step 6: Update `onChanged` listener — add sidebar refresh for both `bookmarks` and `folders` changes**

Find (around line 75):
```js
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && changes.bookmarks) {
      const prev = changes.bookmarks.oldValue || [];
      const next = changes.bookmarks.newValue || [];
      await loadState();
```

Make two changes: (a) after `await loadState();` add `SidebarModule.renderSidebar(allBookmarks);`, and (b) add a separate `changes.folders` branch inside the same listener for cross-tab folder sync.

The full updated listener opening looks like this (only showing the first few lines of the existing handler + the new `changes.folders` block; leave the rest of the existing handler body unchanged):

```js
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && changes.bookmarks) {
      const prev = changes.bookmarks.oldValue || [];
      const next = changes.bookmarks.newValue || [];
      await loadState();
      SidebarModule.renderSidebar(allBookmarks);
      // ... (rest of existing bookmarks handler unchanged) ...
    }
    if (area === 'local' && changes.folders) {
      await SidebarModule.loadFolders();
      SidebarModule.renderSidebar(allBookmarks);
    }
  });
```

Find the closing `});` of the `onChanged.addListener` call (after the `renderAll()` call and thumbnail fetch loop) and insert the `changes.folders` block before it.

- [ ] **Step 7: Add sidebar refresh to `visibilitychange` listener**

Find:
```js
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    await loadState();
    resetVisibleCount();
    renderAll();
  });
```

Replace with:
```js
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    await loadState();
    resetVisibleCount();
    renderAll();
    SidebarModule.renderSidebar(allBookmarks);
  });
```

- [ ] **Step 8: Run the extension in the browser (dev mode) and verify**

Open `bookmarks.html` directly in browser (or load as Chrome extension).
- [ ] Sidebar appears on the left with "Tümü" folder
- [ ] "+ Yeni Klasör" creates a folder
- [ ] Clicking a folder filters the list
- [ ] Dragging a list row to a folder moves it (tag is added to bookmark)
- [ ] Deleting a folder removes the tag from all bookmarks
- [ ] Sidebar can be collapsed/expanded via toggle button
- [ ] Sidebar width can be resized via drag handle
- [ ] Width and collapse state persist after page reload

- [ ] **Step 9: Commit**

```bash
git add bookmarks.js
git commit -m "feat(bookmarks): integrate sidebar folder filter and drag events"
```

---

## Task 6: Final Integration Commit & Push

- [ ] **Step 1: Run all tests**

```bash
node tests/run-tests.js
```
Expected: All tests PASS.

- [ ] **Step 2: Push to remote**

```bash
git push origin main
```
