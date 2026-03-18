# Split-Panel Preview Layout — Design Spec

**Date:** 2026-03-18
**Project:** MyBookmark Chrome Extension v1.2
**Status:** Approved

---

## Overview

Redesign the `bookmarks.html` archive page from a dual-table layout (Twitter and YouTube side-by-side) into a two-panel split layout:

- **Left panel:** "MyBookmarks" — a single unified list of all bookmarks
- **Right panel:** Preview — an info card for the selected bookmark

---

## Problem

The current layout separates bookmarks into platform-specific tables (Twitter + YouTube side-by-side, Other full-width). This wastes space and makes it hard to scan all bookmarks at once. There is no preview panel.

---

## Goals

1. Unify all bookmarks into a single scrollable list
2. Show a rich info card preview when a bookmark is selected
3. Display thumbnails: YouTube via `img.youtube.com`, Twitter/Web via `og:image`
4. Fetch and persist thumbnails at save time (not lazily)

---

## Out of Scope

- Real embeds (`<iframe>`, `<blockquote class="twitter-tweet">`)
- Mobile / responsive breakpoints (not requested)
- Popup page changes (`popup.html`, `popup.js`)

---

## Architecture

### Layout

```
bookmarks.html
├── <header.app-header>        (unchanged)
├── <div.filter-bar>           (unchanged)
└── <div.app-body>             ← NEW: CSS grid, two columns ~40/60
    ├── <div.panel-list>       ← Left: unified bookmark list
    └── <div.panel-preview>    ← Right: selected bookmark preview
```

`<main class="main">` is replaced by `<div class="app-body">`.

### CSS Grid

The existing header is 60px and the filter bar is 44px (measured from current CSS variables `--header-h` and `--filter-bar-h`).

```css
.app-body {
  display: grid;
  grid-template-columns: 2fr 3fr;  /* ~40/60 */
  gap: 0;
  height: calc(100vh - var(--header-h) - var(--filter-bar-h));
  overflow: hidden;
}
.panel-list    { overflow-y: auto; border-right: 1px solid var(--border); }
.panel-preview { overflow-y: auto; }
```

`--header-h: 60px` and `--filter-bar-h: 44px` already exist in `bookmarks.css` — use them as-is. Do not add `--filter-h`.

---

## Left Panel — MyBookmarks

### Header

- Title: "MyBookmarks" with bookmark icon and accent color
- Results count label (existing `#results-label` moved here)

### List Items

Each bookmark row renders as:
```
[platform dot] [title — truncated]         [date] [status icon]
```

- Platform dot: Twitter blue / YouTube red / Other purple
- Title: single line, ellipsis
- Date: formatted with `formatDate()`
- Status icon: checkmark if `checked`, empty circle if pending
- Selected state: accent-color left border + subtle background highlight
- Click (normal mode) → sets `selectedId`, triggers preview panel update
- Click (selection mode) → toggles checkbox (existing behavior); does NOT trigger preview
- Existing delete button on hover (preserved)
- Existing selection mode / checkboxes (preserved)

### Pagination

Replace the per-platform `visibleCounts` object (`{ 'X/Twitter': 25, 'YouTube': 25, 'Diğer': 25 }`) with a single integer `visibleCount = 25`. Reset `visibleCount` to 25 whenever filters or search query change. The "Daha Fazla Yükle" button increments `visibleCount` by 25.

### Empty State

Existing `#empty-state` div moved into `.panel-list`.

### Selected Item and Filter Interaction

If the currently selected bookmark becomes hidden by an active filter or search change, reset the preview panel to empty state (`selectedId = null`). This prevents stale previews.

---

## Right Panel — Preview

### Empty State (nothing selected)

```
┌─────────────────────────────┐
│                             │
│   [bookmark icon, muted]    │
│   Bir kayıt seçin           │  ← grey, centered
│                             │
└─────────────────────────────┘
```

### Populated State (bookmark selected)

```
┌─────────────────────────────┐
│  [Thumbnail — 16:9]         │  ← image or platform color + icon
│  [platform badge overlay]   │
├─────────────────────────────┤
│  Title (2-line clamp)       │
│  🔗 short URL               │
│  📅 date  •  platform badge │
├─────────────────────────────┤
│  Not: …                     │  ← only if note exists
│  [tag] [tag] [tag]          │  ← only if tags exist
├─────────────────────────────┤
│  [Aç]  [Tamamlandı]  [Sil]  │
└─────────────────────────────┘
```

#### Thumbnail Logic

| Platform | Source | Fallback |
|----------|--------|----------|
| YouTube  | `https://img.youtube.com/vi/{VIDEO_ID}/hqdefault.jpg` | Platform color + ▶ icon |
| Twitter/X | `og:image` fetched via background script (see Thumbnail Fetch section) | Platform color + 𝕏 icon |
| Other    | `og:image` fetched via background script (see Thumbnail Fetch section) | Platform color + 🌐 icon |

#### Action Buttons

- **Aç** → `chrome.tabs.create({ url })` (existing behavior)
- **Tamamlandı / Bekliyor** → `store.toggleChecked(id)` → triggers full `renderAll()` re-render (consistent with existing mutation pattern); after re-render, re-select the same `selectedId` so the preview stays visible with updated state
- **Sil** → `store.deleteBookmark(id)` → `renderAll()` re-render → preview resets to empty state (`selectedId = null`)

---

## Data Model Change

Add `thumbnail` field to bookmark object:

```js
{
  id: string,
  url: string,
  title: string,
  platform: 'X/Twitter' | 'YouTube' | 'Diğer',
  createdAt: ISO string,
  checked: boolean,
  note: string,
  tags: string[],
  thumbnail: string | null   // ← NEW
}
```

`normalizeBookmark()` in `utils.js` updated to include `thumbnail: item.thumbnail ?? null` — import preserves existing thumbnail values if present, defaults to `null` otherwise.

---

## Thumbnail Fetch Flow

```
User saves bookmark
  │
  ├─ bookmarks.js calls store.saveBookmark(input)
  │     └─ returns saved bookmark with thumbnail: null
  │
  ├─ bookmarks.js calls getThumbnail(bookmark):
  │     ├─ YouTube? → extractYouTubeId(url) → thumbnail = img.youtube.com URL (sync, no fetch)
  │     │              store.updateThumbnail(id, thumbnailUrl)
  │     │
  │     └─ Twitter / Other? → chrome.runtime.sendMessage({ action: 'fetchOgImage', url })
  │                              └─ background.js fetches the page, parses og:image meta tag
  │                                    ├─ success → store.updateThumbnail(id, ogImageUrl)
  │                                    └─ failure → thumbnail stays null (silent, no error shown)
  │
  └─ renderAll() reflects updated thumbnail in preview if this bookmark is selected
```

**Important:** Thumbnail fetch is initiated in `bookmarks.js` (UI layer), not in `store.js` (data layer). `store.js` only handles storage reads and writes.

### YouTube Video ID Extraction (`extractYouTubeId`)

Handles all common URL forms:
- `youtube.com/watch?v={id}`
- `youtube.com/embed/{id}`
- `youtube.com/shorts/{id}`
- `youtu.be/{id}`
- `m.youtube.com/watch?v={id}`

Returns the video ID string, or `null` if not found.

### Background Script — `fetchOgImage`

`background.js` listens for `{ action: 'fetchOgImage', url }` messages:

```js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'fetchOgImage') {
    fetch(msg.url)
      .then(r => r.text())
      .then(html => {
        const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                   || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        sendResponse({ thumbnail: match ? match[1] : null });
      })
      .catch(() => sendResponse({ thumbnail: null }));
    return true; // keep channel open for async response
  }
});
```

In Manifest V3, background service workers can issue cross-origin `fetch` requests when the target origin is covered by `host_permissions`. `manifest.json` must declare `"host_permissions": ["<all_urls>"]`. Without this, the fetch will be blocked.

Note: Twitter/X applies bot-detection on many requests; `og:image` fetch may return `null` in some cases. This is acceptable — the fallback platform color + icon will be shown.

### `store.updateThumbnail(id, url)`

Follows the existing `mutateState` factory pattern in `store.js`:

```js
async function updateThumbnail(id, url, storageArea) {
  return mutateState(storageArea, bookmarks => {
    const bm = bookmarks.find(b => b.id === id);
    if (!bm) return; // bookmark was deleted before fetch completed — no-op
    bm.thumbnail = url;
  });
}
```

Expose via the returned API object alongside existing methods.

---

## Dev-Mode Sample Data & Chrome Stub

The inline `SAMPLE` array in `bookmarks.html` (used when `chrome.storage` is unavailable) must be updated to include `thumbnail` values:

- YouTube entries: set `thumbnail` to a valid `img.youtube.com` URL using the video ID in the sample URL
- Twitter/Other entries: set `thumbnail: null`

The existing dev-mode `window.chrome` stub defines `runtime: { getURL: s => s }` but has no `sendMessage`. The stub must be extended to handle the `fetchOgImage` message so dev-mode thumbnail initiation does not throw:

```js
runtime: {
  getURL: s => s,
  sendMessage: (msg, cb) => {
    // In dev mode, og:image fetch is skipped — thumbnail stays null
    if (typeof cb === 'function') cb({ thumbnail: null });
    return Promise.resolve({ thumbnail: null });
  },
  lastError: null,
},
```

`bookmarks.js` must also guard against `chrome.runtime.lastError` after `sendMessage` and use the promise/callback correctly (Chrome 99+ supports awaiting `sendMessage`; using a callback is safer for broader compatibility).

---

## Files Changed

| File | Change |
|------|--------|
| `bookmarks.html` | Replace `<main>` with `<div.app-body>` + two panels; update SAMPLE data with `thumbnail` field |
| `bookmarks.css` | Add split layout, panel styles, preview card styles, list item selected state; add `--header-h`/`--filter-h` CSS vars if missing |
| `bookmarks.js` | Remove platform tables; add unified list render; replace `visibleCounts` with `visibleCount`; add `selectedId` state; add preview render; add click handler; add `getThumbnail()` initiator |
| `background.js` | Add `fetchOgImage` message handler |
| `utils.js` | Add `extractYouTubeId(url)` helper; update `normalizeBookmark()` to include `thumbnail` field |
| `store.js` | Add `thumbnail` field default in save; add `updateThumbnail(id, url)` method |
| `manifest.json` | Add `"host_permissions": ["<all_urls>"]` for cross-origin fetch in background script |

---

## Preserved Behavior

- Header: search, import, export, select mode buttons
- Filter bar: platform filter, status filter, sort, view toggle (feed/list)
- Bulk action bar: mark done, mark pending, export selected, delete
- Selection mode with checkboxes (click in selection mode selects, does not open preview)
- Feed view (existing, unchanged)
- Toast notifications
- All keyboard shortcuts
