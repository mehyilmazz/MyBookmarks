# Sidebar Klasörler — Tasarım Dokümanı

**Tarih:** 2026-03-19
**Proje:** MyBookmarks Chrome Extension
**Konu:** Gizlenebilir/yeniden boyutlandırılabilir sol sidebar + tag tabanlı klasör sistemi + drag & drop

---

## Özet

Bookmark listesinin soluna, navbar altından başlayan bir sidebar eklenir. Sidebar, klasörler içerir. Klasörler aslında tag etiketleridir — bir klasöre bookmark sürüklendiğinde o bookmark'ın tag listesi `BookmarkStore`'un dışa aktarılan API'si üzerinden güncellenir. Mevcut tag sistemi değişmez; klasörler onun üstüne bir UI katmanı olarak çalışır.

---

## 1. Veri Modeli

### Klasörler
`chrome.storage.local`'da `folders` anahtarı altında saklanır. `BookmarkStore.getState()` yalnızca `bookmarks` ve `tagUsage` anahtarlarını okur; `folders` anahtarı `sidebar.js` tarafından `chrome.storage.local.set/get` ile doğrudan ve bağımsız yönetilir (iki ayrı depolama yazımı — atomik değil, ancak bağımsız işlemler olduğundan kabul edilebilir).

```json
{
  "folders": [
    { "id": "uuid-1", "name": "React", "createdAt": 1742000000000 },
    { "id": "uuid-2", "name": "Design", "createdAt": 1742000001000 }
  ]
}
```

- `id`: `crypto.randomUUID()` ile üretilir
- `name`: Kullanıcının girdiği değer, `trim()` uygulanarak saklanır; lowercase uygulanmaz
- `createdAt`: ms
- **Yeniden adlandırma bu kapsam dışındadır**

### Klasör ↔ Bookmark İlişkisi
- Bir bookmark hangi klasördeyse `tags` dizisinde o klasörün tam `name` değeri bulunur (büyük-küçük harf duyarlı, trim'lenmiş)
- "Tümü" sanal bir klasördür, herhangi bir tag'e karşılık gelmez; DOM'da `data-folder-id="__all__"` sentinel değeri kullanılır
- Bir bookmark yalnızca **bir** klasörde olabilir (taşıma semantiği)

### Duplicate Kontrolü
Yeni klasör adı için: `inputName.trim().toLowerCase()` mevcut tüm `folder.name.toLowerCase()` değerleriyle karşılaştırılır. Eşleşme varsa oluşturma engellenir. Saklanan `name` her zaman orijinal-büyük-küçük harf'li, trim'lenmiş değerdir.

### Taşıma Kuralı
`BookmarkStore.moveBookmarkToFolder(id, allFolderNames, targetFolderName, storageArea)` çağrısı yapılır (yeni dışa aktarılan fonksiyon, detay §4.1). Bu fonksiyon içeride `mutateState` kullanır:
1. `tags`'den mevcut tüm klasör isimleri (`allFolderNames` dizisi) çıkarılır (indeks bazlı kaldırma)
2. `targetFolderName` boş değilse `tags`'e eklenir

"Tümü"ne (`targetFolderName = ''`) taşındığında yalnızca 1. adım uygulanır.

### Klasör Silme
Üç ayrı, sıralı adım:
1. `BookmarkStore.removeTagByName(folderName, storageArea)` çağrısı (yeni dışa aktarılan fonksiyon, §4.1) — tüm bookmark'lardan bu tag kaldırılır
2. `saveFolders(updatedList)` — `folders` dizisinden klasör kaldırılır, chrome.storage'a yazılır
3. Eğer aktif filtre silinen klasörse "Tümü"ne dönülür

### `loadFolders()` Güvenli Okuma
`chrome.storage.local.get(['folders'])` sonucunda `folders` anahtarı `undefined` olursa `[]` döner. Dev mode şiminde de aynı davranış beklenir; şimde ayrıca `folders: []` eklemek gerekmez çünkü `undefined` yolu zaten ele alınmıştır.

---

## 2. Kullanıcı Arayüzü

### HTML Yapısı (`bookmarks.html`)
Mevcut `.app-body` içinde iki panelli flex düzeni genişletilir. Sidebar en sola eklenir:

```html
<div class="app-body">
  <div id="sidebar">
    <div class="sidebar-header">Klasörler</div>
    <ul class="folder-list">
      <li class="folder-item is-active" data-folder-id="__all__">
        <span class="folder-icon">📁</span>
        <span class="folder-name">Tümü</span>
        <span class="folder-count"></span>
      </li>
      <!-- dinamik klasörler buraya render edilir -->
    </ul>
    <button id="new-folder-btn">+ Yeni Klasör</button>
    <div id="new-folder-input-row" hidden>
      <input id="new-folder-input" type="text" maxlength="30" placeholder="Klasör adı…">
    </div>
  </div>
  <div id="sidebar-resizer"></div>
  <div class="panel-list">...</div>
  <div class="panel-resizer">...</div>
  <div class="panel-preview">...</div>
</div>
```

Toggle butonu navbar'a eklenir: `<button id="sidebar-toggle" title="Klasörler">≡</button>`

`sidebar.js`, `bookmarks.html`'e `<script src="sidebar.js"></script>` olarak eklenir. `manifest.json`'a eklenmez.

### Boyut & Konum
- Sidebar, navbar'ın hemen altından başlar, sayfa yüksekliği boyunca uzanır
- Varsayılan genişlik: `200px` | Min: `150px` | Max: `350px`
- Genişlik `chrome.storage.local`'da `sidebarWidth` olarak saklanır
- Collapse durumu `chrome.storage.local`'da `sidebarCollapsed` olarak saklanır
- Sidebar kapatıldığında `#sidebar` ve `#sidebar-resizer` gizlenir; liste+önizleme tam genişliğe geçer; toggle butonu görünür kalır

### Etkileşimler
- **Klasör tıklama:** `folder-select` eventi yayar, aktif klasör highlight olur, `visibleCount` sıfırlanır
- **Hover:** çöp kutusu ikonu belirir ("Tümü" hariç)
- **Silme:** onay istenmeden silinir (geri alınamaz)
- **+ Yeni Klasör:** inline input görünür, Enter ile kaydedilir, Escape ile iptal edilir
- **Resize:** `#sidebar-resizer`'a `mousedown` → `mousemove` → `mouseup`

---

## 3. Drag & Drop

> **Kapsam notu:** Drag & drop yalnızca **liste görünümünde** (`bm-list-item` sınıflı öğeler) desteklenir. Feed görünümünde (`feed-item`) drag & drop intentionally devre dışıdır.

### Sürükleme Başlangıcı (`dragstart`)
- Liste görünümündeki `bm-list-item` elemanlarına `draggable="true"` eklenir
- `e.dataTransfer.setData('text/plain', bm.id)` ile ID aktarılır
- Satıra `is-dragging` CSS sınıfı eklenir (`opacity: 0.5`)

### Klasör Üzerinde (`dragover`)
- `e.preventDefault()` ile drop'a izin verilir
- Klasör `<li>` öğesine `drag-over` CSS sınıfı eklenir (sol kenarda renkli çizgi + hafif arka plan)

### Bırakma (`drop`)
- `e.dataTransfer.getData('text/plain')` ile bookmark ID alınır
- Hedef `<li>`'nin `data-folder-id` okunur
  - `"__all__"` → `targetFolderName = ''`
  - diğer → `folders` listesinde bu ID'li klasörün `name` değeri
- `SidebarModule.moveToFolder(bookmarkId, targetFolderName, storageArea)` çağrılır (bu fonksiyon `BookmarkStore.moveBookmarkToFolder` kullanır)
- `drag-over` sınıfı temizlenir
- `SidebarModule.renderSidebar(allBookmarks)` ile sidebar sayaçları güncellenir
- `renderList()` çağrılarak ana liste yeniden render edilir (aksi hâlde taşınan bookmark mevcut klasör filtresinde görünmeye devam eder)

### Sidebar Kapalıyken
- `#sidebar` gizli olduğu için drop hedefleri (`folder-item`) DOM'da mevcut değildir; drop tamamlanamaz
- Drag başlatılabilir ama tamamlanamaz — kullanıcı toggle ile sidebar'ı açabilir

---

## 4. Modül Mimarisi

### 4.1 `store.js`'e Eklenen İki Yeni Dışa Aktarılan Fonksiyon

`mutateState` iç fonksiyon olarak kalır, dışa aktarılmaz. Bunun yerine iki yeni sarmalayıcı eklenir ve `return` bloğuna eklenir:

```js
// Tüm bookmark'lardan belirli bir tag'i kaldırır (folder silme için)
async function removeTagByName(tagName, storageArea) {
  return mutateState(storageArea, bookmarks => {
    bookmarks.forEach(bm => {
      const idx = bm.tags.indexOf(tagName);
      if (idx !== -1) bm.tags.splice(idx, 1);
    });
  });
}

// Bookmark'ı klasörler arasında taşır (tüm klasör tag'lerini temizle, yenisini ekle)
async function moveBookmarkToFolder(id, allFolderNames, targetFolderName, storageArea) {
  return mutateState(storageArea, bookmarks => {
    const bm = bookmarks.find(b => b.id === id);
    // not-found durumunda mutator {} döner; mutateState commitState'i yine de çağırır
    // (gereksiz yazım — diğer store fonksiyonlarıyla tutarlı davranış; kabul edilebilir)
    if (!bm) return { success: false, reason: 'not-found' };
    bm.tags = bm.tags.filter(t => !allFolderNames.includes(t));
    if (targetFolderName) bm.tags.push(targetFolderName);
    return { success: true };
  });
}
```

Bu iki fonksiyon `store.js`'in `return {}` bloğuna eklenir.

### 4.2 Yeni Dosya: `sidebar.js`

**Dışa aktarılan nesne:** `window.SidebarModule`

**Fonksiyonlar:**

| Fonksiyon | Açıklama |
|-----------|----------|
| `init(storageArea)` | Sidebar'ı başlatır: loadFolders, render, event'leri bağla |
| `loadFolders()` | chrome.storage.local'dan `folders` okur; yoksa `[]` |
| `saveFolders(list)` | Güncel `folders` dizisini chrome.storage.local'a yazar |
| `createFolder(name)` | Duplicate kontrolü (case-insensitive), oluşturur, kaydeder |
| `deleteFolder(id, storageArea)` | `BookmarkStore.removeTagByName` + `saveFolders` |
| `moveToFolder(bookmarkId, targetFolderName, storageArea)` | `BookmarkStore.moveBookmarkToFolder` çağırır |
| `renderSidebar(allBookmarks)` | Klasör listesini ve sayaçları günceller |
| `initResize()` | `#sidebar-resizer` mousedown/mousemove/mouseup |
| `initCollapse()` | `#sidebar-toggle` click, durumu kaydeder |
| `getFolderBookmarkCount(folderName, allBookmarks)` | Sayaç hesapla; `folderName === null` ise `allBookmarks.length` döner ("Tümü" toplam sayısı) |
| `setActiveFolderName(name)` | Aktif klasörü highlight'lar (`null` = Tümü) |

**Yayılan Event:**
```js
document.dispatchEvent(new CustomEvent('folder-select', {
  detail: { folderName: null | 'React' }
  // folderName === null → "Tümü" seçildi
}));
```

### 4.3 `bookmarks.js`'deki Değişiklikler (minimal)

```js
// activeFilters'a eklenir:
activeFilters.folder = null; // null = Tümü

// getFiltered() içine eklenir.
// NOT: search ve status filtreleri BookmarkStore.filterBookmarks() içinde birlikte çalışır;
// platform ve onlyFavorites sonra uygulanır; folder en sona eklenir. Tümü AND kesişimi.
if (activeFilters.folder) {
  list = list.filter(b => b.tags.includes(activeFilters.folder));
}
// Klasör değişikliği platform/search/favorites/status filtrelerini sıfırlamaz.

// bm-list-item oluşturulurken eklenir (liste görünümü, feed'e eklenmez):
row.setAttribute('draggable', 'true');
row.addEventListener('dragstart', e => {
  e.dataTransfer.setData('text/plain', bm.id);
  row.classList.add('is-dragging');
});
row.addEventListener('dragend', () => row.classList.remove('is-dragging'));

// folder-select event dinleyici (init sırasında bir kez bağlanır):
document.addEventListener('folder-select', e => {
  activeFilters.folder = e.detail.folderName;
  visibleCount = LIST_PAGE_SIZE; // mevcut sabit adı
  renderList();
});

// chrome.storage.onChanged dinleyicisine eklenir:
if (changes.folders) {
  // folders değiştiğinde (cross-tab/dış kaynak) bookmarks yeniden yüklenir
  // sonra sidebar render edilir; böylece sayaçlar güncel allBookmarks ile hesaplanır
  const state = await BookmarkStore.getState(storageArea);
  allBookmarks = state.bookmarks;
  SidebarModule.renderSidebar(allBookmarks);
}

// visibilitychange handler'ına eklenir (renderAll() çağrısından sonra):
SidebarModule.renderSidebar(allBookmarks);
```

---

## 5. Dosya Değişiklik Özeti

| Dosya | Değişiklik Türü | Kapsam |
|-------|----------------|--------|
| `sidebar.js` | **Yeni** | Tüm sidebar mantığı |
| `store.js` | Güncelleme (minimal) | `removeTagByName`, `moveBookmarkToFolder` eklenir ve dışa aktarılır |
| `bookmarks.html` | Güncelleme | `<script src="sidebar.js">`, sidebar DOM yapısı, toggle butonu, `.app-body` layout genişletme |
| `bookmarks.css` | Güncelleme | Sidebar stilleri (layout, klasör item, hover, aktif, drag-over, resize tutacağı, collapse) |
| `bookmarks.js` | Güncelleme (minimal) | `activeFilters.folder`, `getFiltered()`, `bm-list-item` dragstart/dragend, `folder-select` dinleyici, `onChanged` + `visibilitychange` güncelleme |

---

## 6. Kısıtlar & Kenar Durumlar

- Duplicate klasör adı yasak: `inputName.trim().toLowerCase()` mevcut tüm `folder.name.toLowerCase()` değerleriyle karşılaştırılır; saklanan `name` orijinal-büyük-küçük harf'li trim'lenmiş değerdir
- Klasör adı boş olamaz (trim sonrası), max 30 karakter
- "Tümü" ismi rezerve — `inputName.trim().toLowerCase() === 'tümü'` ise oluşturma engellenir
- Drag & drop yalnızca liste görünümünde çalışır; feed görünümünde intentionally yoktur
- `#sidebar` kapalıyken drop hedefleri görünmez; drop tamamlanamaz; `data-folder-id="__all__"` sentinel "Tümü" için kullanılır
- Bozuk eski veri (bookmark'ta birden fazla klasör tag'i): `moveBookmarkToFolder` tümünü temizler, `getFolderBookmarkCount` her eşleşen klasörde sayar
- Yeniden adlandırma kapsam dışı
- Cross-tab/cross-context folder sync `onChanged.folders` ile ele alınır; `getState()` yeniden çağrılarak güncel bookmarks yüklenir. `deleteFolder` hem `bookmarks` hem `folders` anahtarını değiştirdiğinden her ikisi için de `onChanged` handler tetiklenebilir — bu çift render kabul edilebilir (her render idempotent, fark göze çarpmaz)
- `crypto.randomUUID()` Chrome extension context'te güvenle kullanılabilir; mevcut `generateId()` (utils.js) ile bilinçli olarak diverge edilmektedir — `sidebar.js` UUID formatına ihtiyaç duymaz, `generateId()` de kullanılabilir; implementer tercih edebilir
- `BookmarkStore.mutateState` iç fonksiyon olarak kalır; `sidebar.js` yalnızca dışa aktarılan `removeTagByName` ve `moveBookmarkToFolder` fonksiyonlarını kullanır
- `removeTagByName` ve `moveBookmarkToFolder` büyük-küçük harf duyarlı `indexOf`/`includes` kullanır; bu doğrudur çünkü klasör adları oluşturulurken case-insensitive duplicate kontrolü yapılır (iki farklı case'de aynı ad mevcut olamaz)
- `sidebarWidth` ve `sidebarCollapsed` storage anahtarları mevcut `panelListWidth` ile aynı flat camelCase konvansiyonunu izler
