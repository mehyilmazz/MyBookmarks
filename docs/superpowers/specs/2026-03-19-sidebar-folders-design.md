# Sidebar Klasörler — Tasarım Dokümanı

**Tarih:** 2026-03-19
**Proje:** MyBookmarks Chrome Extension
**Konu:** Gizlenebilir/yeniden boyutlandırılabilir sol sidebar + tag tabanlı klasör sistemi + drag & drop

---

## Özet

Bookmark listesinin soluna, navbar altından başlayan bir sidebar eklenir. Sidebar, klasörler içerir. Klasörler aslında tag etiketleridir — bir klasöre bookmark sürüklendiğinde o bookmark'ın tag listesi güncellenir. Mevcut tag sistemi değişmez; klasörler onun üstüne bir UI katmanı olarak çalışır.

---

## 1. Veri Modeli

### Klasörler
`chrome.storage.local`'da `folders` anahtarı altında saklanır:

```json
{
  "folders": [
    { "id": "uuid-1", "name": "React", "createdAt": 1742000000000 },
    { "id": "uuid-2", "name": "Design", "createdAt": 1742000001000 }
  ]
}
```

- `id`: `crypto.randomUUID()` ile üretilir
- `name`: klasörün adı (aynı zamanda bookmark tag'i olarak kullanılır)
- `createdAt`: oluşturulma zamanı (ms)

### Klasör ↔ Bookmark İlişkisi
- Bir bookmark hangi klasördeyse `tags` dizisinde o klasörün `name` değeri bulunur
- "Tümü" sanal bir klasördür, herhangi bir tag'e karşılık gelmez
- Bir bookmark yalnızca **bir** klasörde olabilir (taşıma semantiği)

### Taşıma Kuralı
Bir bookmark klasöre taşındığında:
1. `tags` dizisinden mevcut tüm klasör isimleri çıkarılır
2. Hedef klasörün `name`'i `tags`'e eklenir

"Tümü"ne taşındığında yalnızca 1. adım uygulanır (tag eklenmez).

### Klasör Silme
Klasör silindiğinde:
1. Tüm bookmark'lardan o klasörün tag'i kaldırılır (`store.removeTag`)
2. `folders` dizisinden klasör kaldırılır
3. Eğer aktif filtre silinen klasörse "Tümü"ne dönülür

---

## 2. Kullanıcı Arayüzü

### Sidebar Yapısı
```
[≡]  ← toggle butonu (navbar sol kenarında, her zaman görünür)
┌────────────────────┐  ╎
│  Klasörler         │  ╎
│ ─────────────────  │  ╎
│ 📁 Tümü            │  ╎  ← silinemez, her zaman ilk
│ 📁 React       (4) │  ╎  ← hover'da 🗑 ikonu
│ 📁 Design      (2) │  ╎
│ 📁 İş          (7) │  ╎
│                    │  ╎
│  + Yeni Klasör     │  ╎
└────────────────────┘  ╎
                         ↑ sürüklenebilir resize tutacağı
```

### Boyut & Konum
- Sidebar, navbar'ın hemen altından başlar, sayfa yüksekliği boyunca uzanır
- Varsayılan genişlik: `200px` | Min: `150px` | Max: `350px`
- Genişlik `chrome.storage.local`'da `sidebarWidth` anahtarıyla saklanır
- Collapse durumu `chrome.storage.local`'da `sidebarCollapsed` olarak saklanır
- Sidebar kapatıldığında liste+önizleme tam genişliğe geçer; toggle butonu görünür kalır

### Etkileşimler
- **Klasör tıklama:** listeyi o klasöre göre filtreler, aktif klasör highlight olur
- **Hover:** çöp kutusu ikonu belirir
- **Silme:** onay istenmeden silinir (geri alınamaz)
- **+ Yeni Klasör:** inline input açılır, Enter ile kaydedilir, Escape ile iptal edilir
- **Resize:** sağ kenardaki tutacağa `mousedown` → `mousemove` → `mouseup` ile boyutlandırılır

---

## 3. Drag & Drop

### Sürükleme Başlangıcı (`dragstart`)
- `bm-row` elemanlarına `draggable="true"` eklenir
- `dataTransfer.setData('bookmarkId', bm.id)` ile ID aktarılır
- Sürüklenen satır `opacity: 0.5` ile soluklaşır

### Klasör Üzerinde (`dragover`)
- `event.preventDefault()` ile drop'a izin verilir
- Klasör öğesine `drag-over` CSS sınıfı eklenir (sol kenarda renkli çizgi + hafif arka plan)

### Bırakma (`drop`)
- `dataTransfer.getData('bookmarkId')` ile ID alınır
- `SidebarModule.moveToFolder(bookmarkId, folderId)` çağrılır
- Liste ve sidebar sayaçları yeniden render edilir

### "Tümü"ne Bırakma
- Bookmark'ın tüm klasör tag'leri temizlenir
- Bookmark artık hiçbir klasörde görünmez (sadece "Tümü"nde)

---

## 4. Modül Mimarisi

### Yeni Dosya: `sidebar.js`

**Sorumluluklar:**
- `loadFolders()` / `saveFolders()` — chrome.storage CRUD
- `createFolder(name)` — yeni klasör oluştur
- `deleteFolder(id)` — klasör sil + bookmark tag'lerini temizle
- `moveToFolder(bookmarkId, targetFolderId)` — bookmark'ı taşı
- `renderSidebar()` — sidebar HTML'ini güncelle
- `initResize()` — resize tutacağı event'leri
- `initCollapse()` — gizle/göster toggle
- `getFolderBookmarkCount(folderName, allBookmarks)` — klasör sayacı

**Yayılan Event:**
```js
document.dispatchEvent(new CustomEvent('folder-select', {
  detail: { folderName: null | 'React' }
}));
```

### `bookmarks.js`'deki Değişiklikler (minimal)

```js
// activeFilters'a eklenir:
activeFilters.folder = null; // null = Tümü

// getFiltered() içine eklenir:
if (activeFilters.folder) {
  list = list.filter(b => b.tags.includes(activeFilters.folder));
}

// bm-row'lara eklenir:
row.setAttribute('draggable', 'true');
row.addEventListener('dragstart', e => {
  e.dataTransfer.setData('bookmarkId', bm.id);
});

// Event dinleyici:
document.addEventListener('folder-select', e => {
  activeFilters.folder = e.detail.folderName;
  renderList();
});
```

### `bookmarks.html`'deki Değişiklikler
- Navbar altına sidebar container eklenir: `<div id="sidebar">...</div>`
- Toggle butonu navbar içine eklenir
- Ana içerik alanı (`#main-content`) flex container içine alınır

### `bookmarks.css`'deki Değişiklikler
- Sidebar layout stilleri (flex, genişlik, scroll)
- Klasör item stilleri (hover, aktif, drag-over)
- Resize tutacağı stili
- Collapse animasyonu
- Drag & drop görsel geri bildirimleri

---

## 5. Dosya Değişiklik Özeti

| Dosya | Değişiklik Türü | Kapsam |
|-------|----------------|--------|
| `sidebar.js` | **Yeni** | Tüm sidebar mantığı |
| `bookmarks.html` | Güncelleme | Sidebar container, toggle, layout |
| `bookmarks.css` | Güncelleme | Sidebar stilleri |
| `bookmarks.js` | Güncelleme (minimal) | activeFilters, dragstart, event dinleyici |
| `manifest.json` | Güncelleme | `sidebar.js` script olarak eklenir |

---

## 6. Kısıtlar & Kenar Durumlar

- Aynı isimde iki klasör oluşturulamaz (case-insensitive kontrol)
- Klasör adı boş olamaz, max 30 karakter
- "Tümü" ismi rezerve — kullanıcı bu isimde klasör oluşturamaz
- Sidebar kapalıyken drag & drop çalışmaz (sidebar görünür olmalı)
- Bookmark birden fazla klasör tag'i taşıyorsa (eski veri) ilk bulunan klasörde gösterilir
