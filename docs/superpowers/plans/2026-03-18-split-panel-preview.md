# Split-Panel Preview Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `bookmarks.html` from dual platform-table layout into a two-panel split view: left = unified "MyBookmarks" list, right = info-card preview with thumbnail for the selected bookmark.

**Architecture:** CSS grid splits `<div.app-body>` into 40/60 panels. Left panel renders all bookmarks in a single scrollable list. Right panel renders a rich info card (thumbnail + metadata + actions) when a row is clicked. Thumbnails are fetched at save time: YouTube via `img.youtube.com` (sync), Twitter/Web via `og:image` in background.js (async).

**Tech Stack:** Vanilla JS (ES2020), Chrome Extension MV3, plain CSS custom properties. No build step, no framework.

**Spec:** `docs/superpowers/specs/2026-03-18-split-panel-preview-design.md`

---

## Chunk 1: Data Layer — utils, store, manifest, background

### Task 1: Add `extractYouTubeId()` to utils.js

**Files:**
- Modify: `utils.js` (after `detectPlatform`, before `formatDate`)

- [ ] **Step 1: Add the function**

Insert after the closing brace of `detectPlatform` (around line 49):

```js
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
```

- [ ] **Step 2: Export the function**

In the `exportedUtils` object (around line 242), add:

```js
extractYouTubeId,
```

- [ ] **Step 3: Verify in browser console**

Open `bookmarks.html` in browser. In DevTools console run:
```js
MyBookmarkUtils.extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
// Expected: "dQw4w9WgXcQ"
MyBookmarkUtils.extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')
// Expected: "dQw4w9WgXcQ"
MyBookmarkUtils.extractYouTubeId('https://youtube.com/shorts/abc123')
// Expected: "abc123"
MyBookmarkUtils.extractYouTubeId('https://twitter.com/user/status/1')
// Expected: null
```

- [ ] **Step 4: Commit**

```bash
git add utils.js
git commit -m "feat(utils): add extractYouTubeId helper"
```

---

### Task 2: Add `thumbnail` field to `normalizeBookmark()` in utils.js

**Files:**
- Modify: `utils.js` (inside `normalizeBookmark`, return object around line 140)

- [ ] **Step 1: Update the return object**

In `normalizeBookmark()`, change the return statement to include `thumbnail`:

```js
return {
  id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : generateId(),
  url,
  title,
  platform: detectPlatform(url),
  createdAt,
  checked: typeof item.checked === 'boolean' ? item.checked : false,
  note: typeof item.note === 'string' ? item.note.trim() : '',
  tags: sanitizeTags(item.tags),
  thumbnail: typeof item.thumbnail === 'string' && item.thumbnail.trim() ? item.thumbnail.trim() : null
};
```

- [ ] **Step 2: Verify in browser console**

```js
MyBookmarkUtils.normalizeBookmark({ url: 'https://example.com', title: 'Test' }).thumbnail
// Expected: null

MyBookmarkUtils.normalizeBookmark({ url: 'https://example.com', title: 'Test', thumbnail: 'https://img.example.com/t.jpg' }).thumbnail
// Expected: "https://img.example.com/t.jpg"

// Import preserves existing thumbnail:
MyBookmarkUtils.normalizeBookmark({ url: 'https://example.com', title: 'T', thumbnail: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' }).thumbnail
// Expected: "https://i.ytimg.com/vi/abc/hqdefault.jpg"
```

- [ ] **Step 3: Commit**

```bash
git add utils.js
git commit -m "feat(utils): add thumbnail field to normalizeBookmark"
```

---

### Task 3: Add `updateThumbnail()` to store.js

**Files:**
- Modify: `store.js` (after `removeTag` function, before the return/export object)

- [ ] **Step 1: Add the function**

Find where other `mutateState` functions end (around line 211 where `importBookmarks` is) and add after it:

```js
  async function updateThumbnail(id, thumbnailUrl, storageArea) {
    return mutateState(storageArea, bookmarks => {
      const bm = bookmarks.find(b => b.id === id);
      if (!bm) return; // deleted before fetch completed — no-op
      bm.thumbnail = thumbnailUrl;
    });
  }
```

- [ ] **Step 2: Export the function**

In the returned API object at the bottom of store.js, add `updateThumbnail` alongside the other exported methods:

```js
updateThumbnail,
```

- [ ] **Step 3: Verify**

Open `bookmarks.html` in browser. In DevTools console:
```js
// Check the method exists
typeof BookmarkStore.updateThumbnail
// Expected: "function"
```

- [ ] **Step 4: Commit**

```bash
git add store.js
git commit -m "feat(store): add updateThumbnail method"
```

---

### Task 4: Add `host_permissions` to manifest.json

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Add host_permissions**

After the `"permissions"` array, add:

```json
"host_permissions": [
  "<all_urls>"
],
```

The full manifest after change:
```json
{
  "manifest_version": 3,
  "name": "MyBookmark - Daha Sonra Kontrol Et",
  "description": "Twitter/X ve YouTube içeriklerini tek tıkla kaydet, daha sonra kontrol et. Lokal, hızlı, sade.",
  "version": "1.0.0",

  "permissions": [
    "storage",
    "tabs",
    "contextMenus",
    "activeTab"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "background": {
    "service_worker": "background.js"
  },

  "action": {
    "default_popup": "popup.html",
    "default_title": "MyBookmark",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },

  "options_ui": {
    "page": "bookmarks.html",
    "open_in_tab": true
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add manifest.json
git commit -m "feat(manifest): add host_permissions for og:image fetch"
```

---

### Task 5: Add `fetchOgImage` handler to background.js

**Files:**
- Modify: `background.js`

- [ ] **Step 1: Add the message handler**

Append at the end of `background.js` (after the existing `contextMenus.onClicked` listener):

```js
// ─── Thumbnail: og:image fetch ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'fetchOgImage') return false;

  fetch(msg.url, { redirect: 'follow' })
    .then(r => r.text())
    .then(html => {
      // og:image in both attribute orderings
      const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
             || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      sendResponse({ thumbnail: m ? m[1] : null });
    })
    .catch(() => sendResponse({ thumbnail: null }));

  return true; // keep message channel open for async sendResponse
});
```

- [ ] **Step 2: Reload extension in Chrome**

Go to `chrome://extensions` → find MyBookmark → click the reload (↺) button.

- [ ] **Step 3: Verify in extension background console**

Go to `chrome://extensions` → MyBookmark → "Service Worker" link → DevTools opens.

In the background service worker DevTools console, test manually:
```js
fetch('https://github.com').then(r => r.text()).then(html => {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  console.log(m ? m[1] : 'not found');
})
// Should log a GitHub og:image URL (e.g. https://github.githubassets.com/...)
```

- [ ] **Step 4: Commit**

```bash
git add background.js
git commit -m "feat(background): add fetchOgImage message handler"
```

---

## Chunk 2: HTML Restructure + Dev Mode

### Task 6: Restructure bookmarks.html — replace `<main>` with two-panel body

**Files:**
- Modify: `bookmarks.html`

- [ ] **Step 1: Replace the `<main>` block**

Find and replace the entire `<main>` block (lines 117–133):

**Remove:**
```html
  <!-- ═══════════════════ MAIN ═══════════════════ -->
  <main class="main">
    <p id="results-label" class="results-label"></p>

    <div class="card-grid" id="card-grid"></div>

    <div class="empty-state" id="empty-state" style="display:none">
      <div class="empty-glyph">
        <svg viewBox="0 0 64 64" fill="none">
          <path d="M16 8C16 6.89543 16.8954 6 18 6H46C47.1046 6 48 6.89543 48 8V58L32 50L16 58V8Z"
                stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <p class="empty-title">Kayıt bulunamadı</p>
      <p class="empty-sub">Filtrelerinizi değiştirin ya da arama terimini temizleyin</p>
    </div>

  </main>
```

**Add:**
```html
  <!-- ═══════════════════ APP BODY ═══════════════════ -->
  <div class="app-body">

    <!-- ── Sol Panel: MyBookmarks Listesi ── -->
    <div class="panel-list" id="panel-list">
      <div class="panel-list__header">
        <div class="panel-list__title">
          <svg class="panel-list__icon" viewBox="0 0 24 24" fill="none">
            <path d="M5 4C5 3.44772 5.44772 3 6 3H18C18.5523 3 19 3.44772 19 4V21L12 17.5L5 21V4Z"
                  fill="var(--accent)" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <span>MyBookmarks</span>
        </div>
        <p id="results-label" class="results-label"></p>
      </div>

      <div class="bm-list" id="bm-list"></div>

      <div class="empty-state" id="empty-state" style="display:none">
        <div class="empty-glyph">
          <svg viewBox="0 0 64 64" fill="none">
            <path d="M16 8C16 6.89543 16.8954 6 18 6H46C47.1046 6 48 6.89543 48 8V58L32 50L16 58V8Z"
                  stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <p class="empty-title">Kayıt bulunamadı</p>
        <p class="empty-sub">Filtrelerinizi değiştirin ya da arama terimini temizleyin</p>
      </div>
    </div>

    <!-- ── Sağ Panel: Önizleme ── -->
    <div class="panel-preview" id="panel-preview">
      <div class="preview-empty" id="preview-empty">
        <svg viewBox="0 0 24 24" fill="none" width="40" height="40">
          <path d="M5 4C5 3.44772 5.44772 3 6 3H18C18.5523 3 19 3.44772 19 4V21L12 17.5L5 21V4Z"
                stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <p>Bir kayıt seçin</p>
      </div>
      <div class="preview-card" id="preview-card" style="display:none"></div>
    </div>

  </div>
```

- [ ] **Step 2: Update the CSS version query string**

Change `bookmarks.css?v=14` to `bookmarks.css?v=15` and `bookmarks.js?v=14` to `bookmarks.js?v=15` in the `<head>` and end of `<body>`.

- [ ] **Step 3: Open in browser, verify structure**

Open `bookmarks.html` in browser. The page should be broken visually (no CSS yet) but the DOM structure should be correct. In DevTools Elements tab, confirm:
- `div.app-body` exists with two children: `div.panel-list` and `div.panel-preview`
- `div#bm-list` is inside `div.panel-list` (replaces `div#card-grid`)
- `div#preview-empty` and `div#preview-card` are inside `div.panel-preview`

- [ ] **Step 4: Commit**

```bash
git add bookmarks.html
git commit -m "feat(html): replace main with two-panel app-body layout"
```

---

### Task 7: Update SAMPLE data and chrome stub in bookmarks.html

**Files:**
- Modify: `bookmarks.html` (inline `<script>` block, lines 163–216)

- [ ] **Step 1: Add `thumbnail` to SAMPLE items**

In the `const SAMPLE = [...]` array, update each item:

```js
const SAMPLE = [
  { id:'a1', url:'https://x.com/elonmusk/status/1234567890', title:'Elon Musk: The future of AI is here — thread on autonomous systems and what comes next', platform:'X/Twitter', createdAt:new Date(Date.now()-1000*60*8).toISOString(), checked:false, note:'İlginç thread, takip et', tags:['AI','thread'], thumbnail:null },
  { id:'a2', url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title:'Rick Astley - Never Gonna Give You Up (Official Music Video)', platform:'YouTube', createdAt:new Date(Date.now()-1000*60*60*2).toISOString(), checked:false, note:'', tags:['müzik'], thumbnail:'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg' },
  { id:'a3', url:'https://x.com/naval/status/9876543210', title:'Naval: How to get rich without getting lucky — mega thread on wealth building', platform:'X/Twitter', createdAt:new Date(Date.now()-1000*60*60*5).toISOString(), checked:true, note:'Okundu, tekrar bakılacak', tags:['finance','must-read'], thumbnail:null },
  { id:'a4', url:'https://www.youtube.com/watch?v=abc123xyz', title:'System Design Interview – An Insider\'s Guide | Full Course 2024', platform:'YouTube', createdAt:new Date(Date.now()-1000*60*60*24).toISOString(), checked:false, note:'Yarın izle', tags:['dev','system-design'], thumbnail:'https://img.youtube.com/vi/abc123xyz/hqdefault.jpg' },
  { id:'a5', url:'https://github.com/anthropics/claude-code', title:'anthropics/claude-code: Claude Code — AI coding assistant for terminals', platform:'Diğer', createdAt:new Date(Date.now()-1000*60*60*48).toISOString(), checked:false, note:'', tags:['github','tools'], thumbnail:null },
];
```

- [ ] **Step 2: Add `sendMessage` to chrome stub**

In the `window.chrome = { ... }` object, find:
```js
runtime: { getURL: s=>s },
```
Replace with:
```js
runtime: {
  getURL: s => s,
  sendMessage: (msg, cb) => {
    // Dev modda og:image fetch yapılmaz — thumbnail null kalır
    if (typeof cb === 'function') cb({ thumbnail: null });
    return Promise.resolve({ thumbnail: null });
  },
  lastError: null,
},
```

- [ ] **Step 3: Commit**

```bash
git add bookmarks.html
git commit -m "feat(html): add thumbnail field to SAMPLE data and extend chrome stub"
```

---

## Chunk 3: CSS — Split Layout + Panel Styles

### Task 8: Add split layout and panel CSS to bookmarks.css

**Files:**
- Modify: `bookmarks.css` (append new sections at the end, before any existing `@media` queries)

- [ ] **Step 1: Add app-body grid and panel base styles**

Append to `bookmarks.css`:

```css
/* ═══════════════════════════════════════════════════
   APP BODY — Split Panel Layout
═══════════════════════════════════════════════════ */

.app-body {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 0;
  height: calc(100vh - var(--header-h) - var(--filter-bar-h));
  overflow: hidden;
}

/* ── Sol Panel ── */
.panel-list {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--border);
}

.panel-list__header {
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.panel-list__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 6px;
}

.panel-list__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.panel-list .results-label {
  font-size: 11px;
  color: var(--text-3);
  margin: 0;
}

.bm-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

/* ── Sağ Panel ── */
.panel-preview {
  overflow-y: auto;
  background: var(--surface);
}
```

- [ ] **Step 2: Add unified list item styles**

Continue appending to `bookmarks.css`:

```css
/* ═══════════════════════════════════════════════════
   UNIFIED LIST ITEMS (Sol Panel)
═══════════════════════════════════════════════════ */

.bm-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 120ms, border-color 120ms;
  animation: fadeInRow 180ms ease both;
  position: relative;
}

.bm-list-item:hover {
  background: var(--surface-2);
}

.bm-list-item.is-selected-preview {
  background: var(--surface-2);
  border-left-color: var(--accent);
}

.bm-list-item.is-done .bm-li-title {
  opacity: 0.5;
  text-decoration: line-through;
}

.bm-li-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bm-li-dot--tw    { background: #1d9bf0; }
.bm-li-dot--yt    { background: #ff4040; }
.bm-li-dot--other { background: #a78bfa; }

.bm-li-body {
  flex: 1;
  min-width: 0;
}

.bm-li-title {
  font-size: 12.5px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.bm-li-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.bm-li-date {
  font-size: 10.5px;
  color: var(--text-3);
}

.bm-li-status {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--text-3);
}

.bm-li-status--done {
  color: #4ade80;
}

.bm-li-delete {
  opacity: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-3);
  padding: 3px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: opacity 100ms, color 100ms;
  flex-shrink: 0;
}

.bm-list-item:hover .bm-li-delete {
  opacity: 1;
}

.bm-li-delete:hover {
  color: #ff4040;
}

/* Checkbox — selection mode */
.bm-li-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1.5px solid var(--border-2);
  background: transparent;
  flex-shrink: 0;
  display: none;
  align-items: center;
  justify-content: center;
}

.select-mode .bm-li-checkbox {
  display: flex;
}

.bm-list-item.is-checked-select .bm-li-checkbox {
  background: var(--accent);
  border-color: var(--accent);
}

/* Load more */
.bm-list-footer {
  padding: 10px 14px;
  text-align: center;
}

.load-more-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 7px;
  color: var(--text-2);
  font-size: 12px;
  padding: 6px 16px;
  cursor: pointer;
  transition: background 120ms, border-color 120ms;
}

.load-more-btn:hover {
  background: var(--surface-2);
  border-color: var(--border-2);
}
```

- [ ] **Step 3: Add preview panel card styles**

Continue appending:

```css
/* ═══════════════════════════════════════════════════
   PREVIEW PANEL (Sağ Panel)
═══════════════════════════════════════════════════ */

/* Boş durum */
.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-3);
  opacity: 0.5;
}

.preview-empty p {
  font-size: 13px;
  margin: 0;
}

/* Kart */
.preview-card {
  padding: 20px;
  animation: fadeInRow 200ms ease both;
}

/* Thumbnail */
.pv-thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
  position: relative;
  margin-bottom: 16px;
}

.pv-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pv-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-3);
}

.pv-thumb-placeholder--tw    { background: color-mix(in srgb, #1d9bf0 15%, var(--surface-2)); }
.pv-thumb-placeholder--yt    { background: color-mix(in srgb, #ff4040 15%, var(--surface-2)); }
.pv-thumb-placeholder--other { background: color-mix(in srgb, #a78bfa 15%, var(--surface-2)); }

.pv-thumb-placeholder svg {
  opacity: 0.4;
}

.pv-plat-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.pv-plat-badge--tw    { background: rgba(29,155,240,.25); color:#1d9bf0; }
.pv-plat-badge--yt    { background: rgba(255,64,64,.25);  color:#ff4040; }
.pv-plat-badge--other { background: rgba(167,139,250,.25);color:#a78bfa; }

/* İçerik */
.pv-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0 0 8px;
}

.pv-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-bottom: 12px;
}

.pv-meta-item {
  font-size: 11.5px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  gap: 4px;
}

.pv-url {
  font-size: 11.5px;
  color: var(--text-3);
  word-break: break-all;
  margin-bottom: 14px;
}

.pv-url a {
  color: inherit;
  text-decoration: none;
}

.pv-url a:hover {
  color: var(--text-2);
  text-decoration: underline;
}

/* Not */
.pv-note-section {
  background: var(--surface-2);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.pv-note-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-bottom: 4px;
}

.pv-note-text {
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Etiketler */
.pv-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

/* Aksiyon butonları */
.pv-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pv-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 12.5px;
  cursor: pointer;
  transition: background 120ms, border-color 120ms, color 120ms;
}

.pv-btn:hover {
  background: var(--surface-3, var(--surface));
  border-color: var(--border-2);
  color: var(--text);
}

.pv-btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.pv-btn--primary:hover {
  opacity: .88;
}

.pv-btn--danger:hover {
  background: rgba(255,64,64,.12);
  border-color: #ff4040;
  color: #ff4040;
}

.pv-divider {
  height: 1px;
  background: var(--border);
  margin: 14px 0;
}
```

- [ ] **Step 4: Verify CSS syntax only at this stage**

At this point in execution order, the HTML has not yet been restructured (Chunk 2, Task 6). The `.app-body`, `.panel-list`, `.panel-preview` classes do not yet exist in the DOM. Do NOT attempt a visual layout check here.

Instead, verify:
1. Open `bookmarks.html` in browser → no CSS parse errors in DevTools Console
2. In DevTools → Elements → `<head>` → click the stylesheet link → confirm the new classes are present in the parsed stylesheet

Full visual layout verification happens at the end of Task 9 (Step 4) after both HTML and CSS are applied.

- [ ] **Step 5: Commit**

```bash
git add bookmarks.css
git commit -m "feat(css): add split panel layout, list item, and preview card styles"
```

---

## Chunk 4: bookmarks.js Refactor

### Task 9: Update state variables and DOM references

**Files:**
- Modify: `bookmarks.js` (top section, lines 1–50)

- [ ] **Step 1: Replace `visibleCounts` with `visibleCount` and add `selectedId`**

Replace the state block (lines 10–23):

```js
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
```

- [ ] **Step 2: Update DOM references**

Replace the `DOM` object (lines 28–50) — `grid` and `emptyState` refs change, new refs added:

```js
const $ = id => document.getElementById(id);
const DOM = {
  bmList:        $('bm-list'),          // ← replaces 'card-grid'
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
```

Note: `s-total`, `s-pending`, `s-done` IDs no longer exist in the new HTML. The existing `updateStats()` function references them with null guards (`if (DOM.stats.total) ...`) — these branches will silently no-op, which is safe. However, replace `updateStats()` entirely with a slimmer version that only updates counts that still have DOM elements:

```js
function updateStats() {
  const tw    = allBookmarks.filter(b => b.platform === 'X/Twitter').length;
  const yt    = allBookmarks.filter(b => b.platform === 'YouTube').length;
  const other = allBookmarks.filter(b => b.platform === 'Diğer').length;

  if (DOM.stats.tw)    DOM.stats.tw.textContent    = tw;
  if (DOM.stats.yt)    DOM.stats.yt.textContent    = yt;
  if (DOM.stats.other) DOM.stats.other.textContent = other;
}
```

- [ ] **Step 3: Remove `createInitialVisibleCounts` and `resetVisibleCounts`, replace with simple reset**

Remove the two functions (lines 78–88) and add:

```js
function resetVisibleCount() {
  visibleCount = LIST_PAGE_SIZE;
}
```

- [ ] **Step 4: Open in browser, verify no JS errors**

Open `bookmarks.html`. Check DevTools Console — should have no errors. The list will be empty (rendering not updated yet). That's expected.

- [ ] **Step 5: Commit**

```bash
git add bookmarks.js
git commit -m "refactor(bookmarks): update state vars and DOM refs for split panel"
```

---

### Task 10: Replace platform table render with unified list

**Files:**
- Modify: `bookmarks.js` (the `renderGrid` and `buildPlatformSection` functions)

- [ ] **Step 1: Replace `renderGrid()` entirely**

Find and replace the entire `renderGrid()` function (lines 138–189):

```js
function renderGrid() {
  if (viewMode === 'feed') {
    // Feed view renders into DOM.bmList container directly
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
    // Clear preview if selected item no longer visible
    if (selectedId && !filtered.find(b => b.id === selectedId)) {
      selectedId = null;
      renderPreview(null);
    }
    return;
  }

  DOM.emptyState.style.display = 'none';
  DOM.bmList.style.display     = 'block';

  // Check if currently selected item is still in filtered list
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
    btn.textContent = `Daha fazla göster (${filtered.length - visibleCount} kaldı)`;
    btn.addEventListener('click', () => {
      visibleCount += LIST_PAGE_SIZE;
      renderListView();
    });
    footer.appendChild(btn);
    DOM.bmList.appendChild(footer);
  }
}
```

- [ ] **Step 2: Add `buildListItem()` function**

Add after `renderListView()`:

```js
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

  // Click: selection mode → toggle; normal mode → open preview
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
```

- [ ] **Step 3: Remove `buildPlatformSection()`**

Delete the entire `buildPlatformSection` function (lines 191–248). It is no longer used.

- [ ] **Step 4: Update `renderFeed()` to use `DOM.bmList` instead of `DOM.grid`**

In `renderFeed()`, replace all references to `DOM.grid` with `DOM.bmList`:

```js
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
```

- [ ] **Step 5: Open in browser, verify the list renders**

Open `bookmarks.html`. The left panel should show the 5 sample bookmarks as a unified list. Each row shows a platform dot, title, date, and status icon. No platform tables.

- [ ] **Step 6: Commit**

```bash
git add bookmarks.js
git commit -m "feat(bookmarks): replace platform tables with unified list render"
```

---

### Task 11: Add `renderPreview()` and `selectBookmark()`

**Files:**
- Modify: `bookmarks.js` (add after `renderFeed()`)

- [ ] **Step 1: Add `selectBookmark()` function**

```js
// ─── Önizleme ─────────────────────────────────────────────────────────────

function selectBookmark(id) {
  selectedId = id;

  // Update selected highlight in list
  DOM.bmList.querySelectorAll('.bm-list-item').forEach(el => {
    el.classList.toggle('is-selected-preview', el.dataset.id === id);
  });

  const bm = allBookmarks.find(b => b.id === id);
  renderPreview(bm || null);
}
```

- [ ] **Step 2: Add `renderPreview()` function**

```js
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

  // Thumbnail HTML
  let thumbHTML;
  if (bm.thumbnail) {
    thumbHTML = `
      <div class="pv-thumb">
        <img src="${escapeAttribute(bm.thumbnail)}" alt="" loading="lazy"
             onerror="this.parentElement.innerHTML='<div class=\'pv-thumb-placeholder pv-thumb-placeholder--${platCls}\'>${BIG_PLAT_ICONS[bm.platform] || ''}</div>'">
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

  // Tags HTML
  const tagsHTML = bm.tags.length > 0
    ? `<div class="pv-tags">${bm.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  // Note HTML
  const noteHTML = bm.note
    ? `<div class="pv-note-section"><div class="pv-note-label">Not</div><div class="pv-note-text">${escapeHtml(bm.note)}</div></div>`
    : '';

  const doneLabel = bm.checked ? 'Bekliyor Yap' : 'Tamamlandı';

  DOM.previewCard.innerHTML = `
    ${thumbHTML}
    <h2 class="pv-title" title="${escapeAttribute(bm.title)}">${escapeHtml(bm.title)}</h2>
    <div class="pv-url"><a href="${escapeAttribute(bm.url)}" target="_blank" rel="noopener">${escapeHtml(shortUrl(bm.url, 60))}</a></div>
    <div class="pv-meta">
      <span class="pv-meta-item">📅 ${escapeHtml(formatDate(bm.createdAt))}</span>
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

  // Button events
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
```

- [ ] **Step 3: Add `toggleCheckedAndReselect()` helper**

Add near the other CRUD functions:

```js
async function toggleCheckedAndReselect(id) {
  const state = await BookmarkStore.toggleChecked(id);
  if (!state.success) return;
  allBookmarks = state.bookmarks;
  renderAll();
  // Re-open preview for same bookmark (renderAll clears it)
  if (selectedId === id) {
    const updated = allBookmarks.find(b => b.id === id);
    if (updated) {
      // Re-highlight row
      DOM.bmList.querySelectorAll('.bm-list-item').forEach(el => {
        el.classList.toggle('is-selected-preview', el.dataset.id === id);
      });
      renderPreview(updated);
    }
  }
  showToast(state.bookmark.checked ? 'Tamamlandı olarak işaretlendi.' : 'Tekrar bekliyor olarak işaretlendi.', 'success');
}
```

- [ ] **Step 4: Open in browser, verify preview panel**

Open `bookmarks.html`. Click any bookmark in the left list. The right panel should show:
- Thumbnail (YouTube entries show actual thumbnail image, Twitter/Other show platform color placeholder)
- Title, URL, date, status
- "Aç", "Tamamlandı", "Sil" buttons

Click "Tamamlandı" — bookmark should be marked done, preview should stay open showing updated state.

- [ ] **Step 5: Commit**

```bash
git add bookmarks.js
git commit -m "feat(bookmarks): add renderPreview and selectBookmark"
```

---

### Task 12: Update filter/sort change handlers + `renderAll()`

**Files:**
- Modify: `bookmarks.js` (event listeners and `renderAll`)

- [ ] **Step 1: Update `renderAll()` to preserve `selectedId` after re-render**

Replace `renderAll()`:

```js
function renderAll() {
  updateStats();
  renderGrid();
  updateBulkBar();
  updateSelectControls();
}
```

`renderGrid` → `renderListView` already handles `selectedId` reset when item is filtered out. After `renderListView`, the preview state is consistent.

- [ ] **Step 2: Replace all `resetVisibleCounts()` calls with `resetVisibleCount()`**

Search for all occurrences of `resetVisibleCounts()` in `setupEventListeners()` and replace with `resetVisibleCount()`. There should be ~6 occurrences (search, sort, platform filter, status filter, view-feed, view-list).

- [ ] **Step 3: Also reset `selectedId` on filter/search/sort changes**

Replace the four handlers in `setupEventListeners()` with these updated versions:

```js
// Arama
DOM.searchInput.addEventListener('input', () => {
  activeFilters.search = DOM.searchInput.value;
  selectedId = null;
  resetVisibleCount();
  renderGrid();
  renderPreview(null);
});

// Sıralama
DOM.sortSelect.addEventListener('change', () => {
  activeFilters.sort = DOM.sortSelect.value;
  selectedId = null;
  resetVisibleCount();
  renderGrid();
  renderPreview(null);
});

// Platform filtre butonları
$('platform-filters').addEventListener('click', e => {
  const btn = e.target.closest('.fbar-btn');
  if (!btn) return;
  $('platform-filters').querySelectorAll('.fbar-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilters.platform = btn.dataset.platform ?? '';
  selectedId = null;
  resetVisibleCount();
  renderGrid();
  renderPreview(null);
});

// Durum filtre butonları
$('status-filters').addEventListener('click', e => {
  const btn = e.target.closest('.fbar-btn');
  if (!btn) return;
  $('status-filters').querySelectorAll('.fbar-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilters.status = btn.dataset.status ?? '';
  selectedId = null;
  resetVisibleCount();
  renderGrid();
  renderPreview(null);
});
```

- [ ] **Step 4: Update `toggleSelect` to use correct DOM selector**

In `toggleSelect()`, replace `DOM.grid.querySelector(...)` with `DOM.bmList.querySelector(...)`:

```js
function toggleSelect(id, selected) {
  if (selected) selectedIds.add(id);
  else          selectedIds.delete(id);
  updateBulkBar();
  updateSelectControls();
  const item = DOM.bmList.querySelector(`[data-id="${id}"]`);
  if (item) item.classList.toggle('is-checked-select', selected);
}
```

- [ ] **Step 5: Update `setSelectMode` to use correct selector**

```js
function setSelectMode(enabled) {
  isSelectMode = enabled;
  DOM.btnSelectMode.classList.toggle('active', enabled);
  DOM.selectControls.style.display = enabled ? 'flex' : 'none';
  document.querySelector('.panel-list').classList.toggle('select-mode', enabled);

  if (!enabled) {
    selectedIds.clear();
    DOM.bmList.querySelectorAll('.bm-list-item, .feed-item').forEach(c => c.classList.remove('is-checked-select', 'is-selected'));
  }

  updateBulkBar();
  updateSelectControls();
}
```

- [ ] **Step 6: Update `btnSelectAll` handler**

```js
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
```

- [ ] **Step 7: Open in browser, full interaction test**

1. Click bookmarks → preview opens ✓
2. Apply platform filter → filtered list updates, preview clears if item hidden ✓
3. Search → filtered, preview clears ✓
4. Enter select mode → clicking rows checks them, does not open preview ✓
5. Bulk delete → list updates, preview clears ✓

- [ ] **Step 8: Commit**

```bash
git add bookmarks.js
git commit -m "feat(bookmarks): wire filter/search to selectedId reset and fix select mode"
```

---

### Task 13: Add `getThumbnail()` — fetch on save

**Files:**
- Modify: `bookmarks.js`

- [ ] **Step 1: Add `getThumbnail()` function**

Add before `setupEventListeners()`:

```js
// ─── Thumbnail ─────────────────────────────────────────────────────────────

async function getThumbnail(bm) {
  if (bm.platform === 'YouTube') {
    const videoId = MyBookmarkUtils.extractYouTubeId(bm.url);
    if (videoId) {
      const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      await BookmarkStore.updateThumbnail(bm.id, thumbUrl);
      // Refresh local cache
      const state = await BookmarkStore.getState();
      allBookmarks = state.bookmarks;
      // If this bookmark is currently selected, refresh preview
      if (selectedId === bm.id) {
        const updated = allBookmarks.find(b => b.id === bm.id);
        if (updated) renderPreview(updated);
      }
    }
    return;
  }

  // Twitter / Other: fetch og:image via background
  chrome.runtime.sendMessage({ action: 'fetchOgImage', url: bm.url }, async (response) => {
    if (chrome.runtime.lastError) return; // background not available (e.g. dev mode)
    const thumb = response?.thumbnail;
    if (!thumb) return;
    await BookmarkStore.updateThumbnail(bm.id, thumb);
    const state = await BookmarkStore.getState();
    allBookmarks = state.bookmarks;
    if (selectedId === bm.id) {
      const updated = allBookmarks.find(b => b.id === bm.id);
      if (updated) renderPreview(updated);
    }
  });
}
```

- [ ] **Step 2: Note where to call `getThumbnail()`**

`getThumbnail` should be called after `BookmarkStore.saveBookmark` completes. However, looking at the current `bookmarks.js`, the bookmark save is triggered from `popup.js`, not from `bookmarks.js`. The `bookmarks.js` page receives storage change events via `chrome.storage.onChanged`.

To handle thumbnails for bookmarks saved via popup/context menu, the `getThumbnail` call must also happen from popup.js (or background.js). For now, wire it in the `chrome.storage.onChanged` handler in `init()`:

In `init()`, update the `chrome.storage.onChanged` handler:

```js
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local' && changes.bookmarks) {
    const prev = changes.bookmarks.oldValue || [];
    const next = changes.bookmarks.newValue || [];
    await loadState();
    // Find newly added bookmarks (in next but not in prev)
    const prevIds = new Set(prev.map(b => b.id));
    const newBookmarks = next.filter(b => !prevIds.has(b.id) && b.thumbnail === null);
    for (const id of selectedIds) {
      if (!allBookmarks.find(b => b.id === id)) selectedIds.delete(id);
    }
    renderAll();
    // Fetch thumbnails for new bookmarks (async, non-blocking)
    for (const bm of newBookmarks) {
      getThumbnail(bm);
    }
  }
});
```

- [ ] **Step 3: Verify thumbnail fetch flow**

In the extension (loaded in Chrome):
1. Save a YouTube URL via popup (e.g. any youtube.com/watch?v=... URL)
2. Open the archive page (bookmarks.html / Options)
3. The bookmark should appear in the list
4. Click it — the right panel should show the YouTube thumbnail within 1-2 seconds (or immediately if already fetched)

For a Twitter URL: the thumbnail may or may not load depending on bot-detection. The fallback platform color placeholder is acceptable.

- [ ] **Step 4: Commit**

```bash
git add bookmarks.js
git commit -m "feat(bookmarks): add getThumbnail fetch on new bookmark save"
```

---

## Final Verification Checklist

- [ ] Left panel shows all bookmarks as a unified list (no platform tables)
- [ ] Platform dots correctly color-coded (blue=Twitter, red=YouTube, purple=Other)
- [ ] Clicking a row opens preview in right panel
- [ ] Preview shows correct thumbnail (YouTube: img.youtube.com, Other: platform color)
- [ ] Preview "Aç" button opens URL in new tab
- [ ] Preview "Tamamlandı" toggles status, preview stays open showing updated state
- [ ] Preview "Sil" deletes bookmark, list updates, preview resets to empty
- [ ] Filter by platform → list filters, preview clears if item hidden
- [ ] Search → list filters, preview clears if item hidden
- [ ] Select mode → clicking rows checks/unchecks, does NOT open preview
- [ ] Bulk delete → works, preview clears
- [ ] Feed view → still works (renders into same container)
- [ ] Load more → shows 25 more items
- [ ] Import/Export → still work
- [ ] No JS errors in DevTools console

```bash
git add bookmarks.html bookmarks.css bookmarks.js utils.js store.js background.js manifest.json
git commit -m "feat: complete split-panel preview layout implementation"
```
