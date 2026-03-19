# MyBookmark — Daha Sonra Kontrol Et

> Twitter/X ve YouTube içeriklerini tek tıkla kaydet, güçlü arşivde yönet.

Bir Chrome uzantısı — framework yok, bağımlılık yok, tamamen yerel depolama.

---

## Özellikler

### 🔖 Hızlı Kaydetme
- Araç çubuğu popup'u ile aktif sekmeyi tek tıkla kaydet
- Sağ tık → "Daha sonra kontrol için kaydet" (sayfa, link, resim, video)
- Otomatik platform tespiti: Twitter/X, YouTube, Diğer
- Twitter/X ve YouTube içerikleri için thumbnail otomatik çekilir

### 📚 Arşiv Sayfası
- **3 bölmeli düzen:** Klasör kenar çubuğu · Kayıt listesi · Önizleme paneli
- Tüm bölme genişlikleri sürükle-bırak ile yeniden boyutlandırılabilir
- Liste ve Feed görünüm modları
- Koyu tema

### 🗂️ Klasör Sistemi (Etiket Tabanlı)
- Klasör oluştur / sil (onay diyaloğu ile)
- Kayıtları klasöre sürükle-bırak ile taşı
- Klasörleri sürükle-bırak ile yeniden sırala
- Seçilen kayıt hangi klasördeyse sidebar'da otomatik vurgulanır
- Sidebar gizlenebilir ve genişliği değiştirilebilir

### 🔍 Filtreleme & Arama
- Platform filtresi: Twitter/X, YouTube, Diğer
- Durum filtresi: Bekleyen / Tamamlanan
- Favoriler filtresi ⭐
- Anlık tam metin arama (başlık, URL, not, etiket)
- Sıralama: En Yeni, En Eski, Platforma Göre, Bekleyenler Önce, A→Z

### ✏️ Kayıt Yönetimi
- Satır içi not ve etiket (tag) ekleme
- Görüldü olarak işaretleme
- Favori ekleme / çıkarma
- Toplu seçim: Tümünü seç, Görüldü yap, Dışa aktar, Sil

### 📤 İçe / Dışa Aktarma
- JSON formatında dışa aktar (tümü veya seçilenler)
- JSON dosyasından içe aktar

---

## Ekran Görüntüleri

### Arşiv Sayfası
![Arşiv Sayfası](docs/screenshots/archive.png)

### Popup
![Popup](docs/screenshots/popup.png)

### Klasör Sistemi
![Klasör Sistemi](docs/screenshots/folders.png)

---

## Kurulum

Chrome Web Store'a henüz yüklenmedi. Geliştirici moduyla yükleyin:

### 1. Depoyu indirin

```bash
git clone https://github.com/mehyilmazz/MyBookmarks.git
```

veya sağ üstteki **Code → Download ZIP** ile indirip çıkarın.

### 2. Chrome'da Geliştirici Modunu Açın

1. Chrome adres çubuğuna `chrome://extensions` yazın
2. Sağ üst köşedeki **"Geliştirici modu"** düğmesini açın

### 3. Uzantıyı Yükleyin

1. **"Paketlenmemiş öğe yükle"** butonuna tıklayın
2. İndirdiğiniz `MyBookmarks/` klasörünü seçin
3. Araç çubuğunda **MyBookmark** ikonu belirir

---

## Kullanım

### Kayıt Ekleme

**Popup ile:**
1. Araç çubuğundaki 🔖 ikonuna tıklayın
2. Başlık/not ekleyip **"Kaydet"** butonuna basın

**Sağ Tık Menüsü ile:**
- Herhangi bir sayfada: Sağ tık → **"Daha sonra kontrol için kaydet"**
- Bir link üzerinde: Sağ tık → **"Bu linki daha sonra kontrol için kaydet"**

### Arşivi Açma

- Popup'ta **"Arşiv"** butonuna tıklayın
- veya `chrome://extensions` → MyBookmark → **"Seçenekler"**

### Klasör Kullanımı

| İşlem | Nasıl Yapılır |
|---|---|
| Yeni klasör | Sidebar başlığındaki `+` ikonuna tıkla → ad yaz → Enter |
| Klasöre taşı | Liste öğesini sürükleyip klasörün üzerine bırak |
| Klasör sıralama | Klasörü yukarı/aşağı sürükle |
| Klasör sil | Klasörün üzerine gel → 🗑️ → Onayla |
| İptal | Escape tuşu veya dışarı tıkla |

### Filtreler

Filter çubuğundan:
- **Platform:** Twitter, YouTube, Diğer
- **Durum:** Bekleyen, Tamamlanan
- **⭐ Favorilerim:** Yalnızca favorileri göster
- **☰ Sidebar:** Klasör panelini gizle / göster

---

## Geliştirici Ortamı

### Önizleme (Uzantı Yüklemeden)

```bash
# Python 3 gerektir
python -m http.server 3000
# Tarayıcıda aç: http://localhost:3000/bookmarks.html
```

`chrome.*` API'leri yoksa `localStorage` mock'u otomatik devreye girer.

### Testleri Çalıştırma

```bash
node tests/run-tests.js
```

---

## Teknoloji

| Katman | Teknoloji |
|---|---|
| Uzantı API | Chrome Manifest V3 |
| Depolama | `chrome.storage.local` |
| Arka Plan | Service Worker |
| UI | Vanilla JavaScript — sıfır bağımlılık |
| Stil | Saf CSS (değişkenler, koyu tema) |
| Yazı Tipi | Segoe UI / Aptos / Trebuchet MS |
| Sürükle-Bırak | HTML5 Drag & Drop API |
| Yeniden Boyutlandırma | Mouse Events |

---

## Proje Yapısı

```
MyBookmarks/
├── manifest.json            # Chrome uzantısı tanım dosyası (V3)
├── background.js            # Service Worker — sağ tık menüsü, thumbnail
├── popup.html/css/js        # Araç çubuğu popup arayüzü
├── bookmarks.html           # Arşiv sayfası (ana UI)
├── bookmarks.css            # Tüm stiller — koyu tema
├── bookmarks.js             # Arşiv sayfası mantığı
├── sidebar.js               # Klasör kenar çubuğu modülü
├── store.js                 # Veri katmanı — chrome.storage CRUD
├── utils.js                 # Yardımcı fonksiyonlar
├── icons/                   # Uzantı ikonları (16/32/48/128 px)
└── tests/
    └── run-tests.js         # Node.js birim testleri
```

---

## Veri Modeli

Her kayıt `chrome.storage.local` içinde şu yapıda tutulur:

```json
{
  "id": "abc123",
  "url": "https://x.com/user/status/...",
  "title": "Tweet veya video başlığı",
  "platform": "X/Twitter",
  "createdAt": "2026-03-19T10:00:00.000Z",
  "checked": false,
  "favorite": false,
  "note": "İsteğe bağlı not",
  "tags": ["klasor-adi", "etiket"],
  "thumbnail": "https://..."
}
```

Klasörler ayrı bir `folders` anahtarında saklanır. Klasör sistemi **etiket tabanlıdır** — bir klasörün içeriği, o klasörün adını `tags[]` dizisinde bulunduran kayıtlardır.

---

## Lisans

MIT © 2026
