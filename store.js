(function (global, factory) {
  const api = factory(global.MyBookmarkUtils || (typeof require === 'function' ? require('./utils.js') : null));

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.BookmarkStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (utils) {
  if (!utils) {
    throw new Error('MyBookmark utils yüklenmeden store kullanılamaz.');
  }

  function getStorage(storageArea) {
    if (storageArea) return storageArea;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) return chrome.storage.local;
    throw new Error('Kullanılabilir storage alanı bulunamadı.');
  }

  function normalizeCollection(items) {
    if (!Array.isArray(items)) return [];
    return items
      .map(item => utils.normalizeBookmark(item))
      .filter(Boolean);
  }

  function rebuildTagUsage(bookmarks) {
    const usage = {};
    bookmarks.forEach(bookmark => {
      bookmark.tags.forEach(tag => {
        usage[tag] = (usage[tag] || 0) + 1;
      });
    });
    return usage;
  }

  function sortBookmarks(bookmarks, sort = 'newest') {
    const list = [...bookmarks];

    switch (sort) {
      case 'oldest':
        list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'platform':
        list.sort((a, b) => a.platform.localeCompare(b.platform, 'tr'));
        break;
      case 'pending':
        list.sort((a, b) => (a.checked ? 1 : 0) - (b.checked ? 1 : 0));
        break;
      case 'title':
        list.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
        break;
      case 'newest':
      default:
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    return list;
  }

  function filterBookmarks(bookmarks, filters = {}) {
    const {
      search = '',
      platform = '',
      status = ''
    } = filters;

    return bookmarks.filter(bookmark => {
      if (platform && bookmark.platform !== platform) return false;
      if (status === 'pending' && bookmark.checked) return false;
      if (status === 'done' && !bookmark.checked) return false;
      if (!utils.matchesSearch(bookmark, search)) return false;
      return true;
    });
  }

  async function getState(storageArea) {
    const storage = getStorage(storageArea);
    const data = await storage.get(['bookmarks', 'tagUsage']);
    const bookmarks = sortBookmarks(normalizeCollection(data.bookmarks), 'newest');
    const tagUsage = rebuildTagUsage(bookmarks);
    return { bookmarks, tagUsage };
  }

  async function commitState(storageArea, bookmarks) {
    const storage = getStorage(storageArea);
    const normalized = sortBookmarks(normalizeCollection(bookmarks), 'newest');
    const tagUsage = rebuildTagUsage(normalized);
    await storage.set({ bookmarks: normalized, tagUsage });
    return { bookmarks: normalized, tagUsage };
  }

  async function mutateState(storageArea, mutator) {
    const current = await getState(storageArea);
    const draft = current.bookmarks.map(bookmark => ({
      ...bookmark,
      tags: [...bookmark.tags]
    }));

    const meta = await mutator(draft, current) || {};
    const state = await commitState(storageArea, draft);
    return { ...meta, ...state };
  }

  async function saveBookmark(input, storageArea) {
    const url = typeof input?.url === 'string' ? input.url.trim() : '';
    if (!url || utils.isRestrictedUrl(url)) {
      return { success: false, reason: 'restricted' };
    }

    return mutateState(storageArea, bookmarks => {
      if (bookmarks.some(bookmark => bookmark.url === url)) {
        return { success: false, duplicate: true, reason: 'duplicate' };
      }

      const bookmark = utils.createBookmark(url, input?.title || url);
      if (!bookmark) {
        return { success: false, reason: 'invalid' };
      }

      bookmark.note = typeof input?.note === 'string' ? input.note.trim() : '';
      bookmark.tags = utils.sanitizeTags(input?.tags);
      bookmarks.unshift(bookmark);

      return { success: true, bookmark };
    });
  }

  async function deleteBookmark(id, storageArea) {
    return mutateState(storageArea, bookmarks => {
      const next = bookmarks.filter(bookmark => bookmark.id !== id);
      bookmarks.length = 0;
      bookmarks.push(...next);
      return { success: true };
    });
  }

  async function toggleChecked(id, storageArea) {
    return mutateState(storageArea, bookmarks => {
      const bookmark = bookmarks.find(item => item.id === id);
      if (!bookmark) return { success: false, reason: 'not-found' };
      bookmark.checked = !bookmark.checked;
      return { success: true, bookmark };
    });
  }

  async function toggleFavorite(id, storageArea) {
    return mutateState(storageArea, bookmarks => {
      const bookmark = bookmarks.find(item => item.id === id);
      if (!bookmark) return { success: false, reason: 'not-found' };
      bookmark.favorite = !bookmark.favorite;
      return { success: true, bookmark };
    });
  }

  async function updateNote(id, note, storageArea) {
    return mutateState(storageArea, bookmarks => {
      const bookmark = bookmarks.find(item => item.id === id);
      if (!bookmark) return { success: false, reason: 'not-found' };
      bookmark.note = String(note ?? '').trim();
      return { success: true, bookmark };
    });
  }

  async function addTag(id, tag, storageArea) {
    return mutateState(storageArea, bookmarks => {
      const bookmark = bookmarks.find(item => item.id === id);
      if (!bookmark) return { success: false, reason: 'not-found' };

      const normalizedTag = utils.sanitizeTags([tag])[0];
      if (!normalizedTag) return { success: false, reason: 'invalid-tag' };
      if (bookmark.tags.includes(normalizedTag)) return { success: false, duplicate: true, reason: 'duplicate-tag' };

      bookmark.tags.push(normalizedTag);
      return { success: true, bookmark };
    });
  }

  async function removeTag(id, tagIndex, storageArea) {
    return mutateState(storageArea, bookmarks => {
      const bookmark = bookmarks.find(item => item.id === id);
      if (!bookmark) return { success: false, reason: 'not-found' };
      if (tagIndex < 0 || tagIndex >= bookmark.tags.length) return { success: false, reason: 'invalid-index' };

      bookmark.tags.splice(tagIndex, 1);
      return { success: true, bookmark };
    });
  }

  async function bulkSetChecked(ids, checked, storageArea) {
    const selected = new Set(ids || []);

    return mutateState(storageArea, bookmarks => {
      bookmarks.forEach(bookmark => {
        if (selected.has(bookmark.id)) {
          bookmark.checked = checked;
        }
      });
      return { success: true };
    });
  }

  async function bulkDelete(ids, storageArea) {
    const selected = new Set(ids || []);

    return mutateState(storageArea, bookmarks => {
      const next = bookmarks.filter(bookmark => !selected.has(bookmark.id));
      bookmarks.length = 0;
      bookmarks.push(...next);
      return { success: true };
    });
  }

  async function importBookmarks(items, storageArea) {
    if (!Array.isArray(items)) {
      return { success: false, reason: 'invalid-format', added: 0, duplicates: 0, invalid: 0 };
    }

    return mutateState(storageArea, bookmarks => {
      const existingUrls = new Set(bookmarks.map(bookmark => bookmark.url));
      let added = 0;
      let duplicates = 0;
      let invalid = 0;

      items.forEach(item => {
        if (!utils.validateBookmark(item)) {
          invalid += 1;
          return;
        }

        const normalized = utils.normalizeBookmark(item);
        if (!normalized) {
          invalid += 1;
          return;
        }

        if (existingUrls.has(normalized.url)) {
          duplicates += 1;
          return;
        }

        existingUrls.add(normalized.url);
        bookmarks.unshift(normalized);
        added += 1;
      });

      return {
        success: added > 0,
        added,
        duplicates,
        invalid
      };
    });
  }

  async function updateThumbnail(id, thumbnailUrl, storageArea) {
    return mutateState(storageArea, bookmarks => {
      const bm = bookmarks.find(b => b.id === id);
      if (!bm) return; // deleted before fetch completed — no-op
      bm.thumbnail = (typeof thumbnailUrl === 'string' && thumbnailUrl.trim()) ? thumbnailUrl.trim() : null;
    });
  }

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
});
