const assert = require('node:assert/strict');

const utils = require('../utils.js');
const store = require('../store.js');

function createStorage(seed = {}) {
  let data = {
    bookmarks: [],
    tagUsage: {},
    ...seed
  };

  return {
    async get(keys) {
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map(key => [key, data[key]]));
      }

      if (typeof keys === 'string') {
        return { [keys]: data[keys] };
      }

      return { ...data };
    },
    async set(next) {
      data = { ...data, ...next };
    },
    dump() {
      return JSON.parse(JSON.stringify(data));
    }
  };
}

const tests = [
  {
    name: 'escapeAttribute çift tirnak ve HTML karakterlerini kacirir',
    run() {
      assert.equal(
        utils.escapeAttribute('"tehlikeli"<script>&'),
        '&quot;tehlikeli&quot;&lt;script&gt;&amp;'
      );
    }
  },
  {
    name: 'validateBookmark desteklenmeyen URL ve bozuk tag listesini reddeder',
    run() {
      assert.equal(utils.validateBookmark({ url: 'javascript:alert(1)' }), false);
      assert.equal(utils.validateBookmark({ url: 'https://example.com', tags: ['ok', 42] }), false);
      assert.equal(utils.validateBookmark({ url: 'https://example.com', title: 'Geçerli', tags: ['ok'] }), true);
    }
  },
  {
    name: 'saveBookmark duplicate kontrolu yapar ve tag sayacini rebuild eder',
    async run() {
      const storage = createStorage();

      const first = await store.saveBookmark({
        url: 'https://example.com/a',
        title: 'A',
        tags: ['alpha', 'beta', 'alpha']
      }, storage);

      assert.equal(first.success, true);
      assert.deepEqual(first.tagUsage, { alpha: 1, beta: 1 });

      const duplicate = await store.saveBookmark({
        url: 'https://example.com/a',
        title: 'A tekrar'
      }, storage);

      assert.equal(duplicate.success, false);
      assert.equal(duplicate.reason, 'duplicate');
      assert.equal(storage.dump().bookmarks.length, 1);
    }
  },
  {
    name: 'importBookmarks invalid ve duplicate kayitlari ayiklar',
    async run() {
      const storage = createStorage({
        bookmarks: [
          utils.normalizeBookmark({
            id: 'seed-1',
            url: 'https://example.com/existing',
            title: 'Existing',
            tags: ['seed']
          })
        ]
      });

      const result = await store.importBookmarks([
        { url: 'https://example.com/existing', title: 'Dup' },
        { url: 'https://example.com/new', title: 'New', tags: ['news'] },
        { url: 'data:text/html,boom', title: 'Bad' },
        { url: 'https://example.com/bad-tags', tags: ['ok', 12] }
      ], storage);

      assert.equal(result.added, 1);
      assert.equal(result.duplicates, 1);
      assert.equal(result.invalid, 2);
      assert.equal(result.bookmarks.length, 2);
      assert.deepEqual(result.tagUsage, { news: 1, seed: 1 });
    }
  },
  {
    name: 'filterBookmarks ve sortBookmarks ortak kurallari uygular',
    run() {
      const bookmarks = [
        utils.normalizeBookmark({
          id: '1',
          url: 'https://x.com/a',
          title: 'Beta',
          checked: false,
          createdAt: '2024-01-02T00:00:00.000Z',
          tags: ['thread']
        }),
        utils.normalizeBookmark({
          id: '2',
          url: 'https://example.com/b',
          title: 'Alpha',
          checked: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          tags: ['note']
        })
      ];

      const pendingTwitter = store.filterBookmarks(bookmarks, {
        platform: 'X/Twitter',
        status: 'pending',
        search: 'beta'
      });

      assert.equal(pendingTwitter.length, 1);
      assert.equal(pendingTwitter[0].id, '1');

      const sortedByTitle = store.sortBookmarks(bookmarks, 'title');
      assert.deepEqual(sortedByTitle.map(bookmark => bookmark.id), ['2', '1']);
    }
  },
  {
    name: 'bulk islemler secili kayitlari gunceller ve siler',
    async run() {
      const storage = createStorage({
        bookmarks: [
          utils.normalizeBookmark({ id: '1', url: 'https://example.com/1', title: 'One' }),
          utils.normalizeBookmark({ id: '2', url: 'https://example.com/2', title: 'Two' }),
          utils.normalizeBookmark({ id: '3', url: 'https://example.com/3', title: 'Three' })
        ]
      });

      const checkedState = await store.bulkSetChecked(['1', '3'], true, storage);
      assert.equal(checkedState.bookmarks.find(bookmark => bookmark.id === '1').checked, true);
      assert.equal(checkedState.bookmarks.find(bookmark => bookmark.id === '2').checked, false);

      const deletedState = await store.bulkDelete(['2'], storage);
      assert.deepEqual(
        deletedState.bookmarks.map(bookmark => bookmark.id).sort(),
        ['1', '3']
      );
    }
  },
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
];

async function run() {
  for (const test of tests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});


