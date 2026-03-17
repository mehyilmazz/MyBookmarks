# MyBookmark

> Hizli, hafif ve sik bir Chrome eklentisi — istedigin sayfayi tek tikla kaydet, platformlara gore duzenle, takip et.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## Ekran Goruntuleri

| Popup | Arsiv — Liste | Arsiv — Feed |
|-------|--------------|--------------|
| Aktif sekmeyi tek tikla kaydet | Platform bazli 3 tablo (Twitter, YouTube, Diger) | Twitter benzeri, ortalanmis feed kartlari |

---

## Ozellikler

### Popup
- **Tek tikla kaydet** — aktif sekmeyi aninda arsivle
- Platform otomatik algilama: X/Twitter · YouTube · Diger
- Etiket (tag) destegi ile kayit organizasyonu
- Daha once kaydedilmisse uyari gosterir

### Arsiv Sayfasi (`bookmarks.html`)
- **Liste gorunumu** — platform bolumlerine ayrilmis tablolar (Twitter + YouTube yan yana, Diger altta)
- **Feed gorunumu** — Twitter benzeri kart akisi; YouTube videolari icin otomatik thumbnail
- Bekleyen / Tamamlanan filtresi, platform filtresi, arama, siralama
- Silme, tamamlandi isaretleme, toplu islemler
- JSON ile disa/ice aktarma

---

## Proje Yapisi

```
MyBookmark/
├── manifest.json        # Chrome Manifest V3
├── popup.html           # Eklenti popup'i
├── popup.css            # Popup stilleri
├── popup.js             # Popup mantigi
├── bookmarks.html       # Tam ekran arsiv sayfasi
├── bookmarks.css        # Arsiv stilleri
├── bookmarks.js         # Arsiv mantigi
├── utils.js             # Ortak yardimci fonksiyonlar
├── background.js        # Service worker (context menu destegi)
└── icons/               # Eklenti ikonlari
```

---

## Kurulum

### Chrome Gelistirici Modu

1. Bu repoyu klonlayin:
   ```bash
   git clone https://github.com/mehyilmazz/MyBookmarks.git
   ```

2. Chrome'da `chrome://extensions/` adresini acin

3. Sag ustten **"Gelistirici modu"**nu aktif edin

4. **"Paketlenmemis oge yukle"** butonuna tiklayin

5. Klonladiginiz klasoru secin

6. Arac cubugunda **MyBookmark** ikonu gorunur — hazir!

---

## Teknolojiler

| Katman | Teknoloji |
|--------|-----------|
| Platform | Chrome Extension Manifest V3 |
| Depolama | `chrome.storage.local` |
| UI | Vanilla HTML · CSS · JavaScript |
| Tema | Koyu tema (Claude+ renk paleti) |
| Font | Inter (Google Fonts) |

---

## Kullanim

### Sayfa Kaydetme
1. Kaydetmek istedigin sayfada **MyBookmark** ikonuna tikla
2. Istege bagli etiket ekle
3. **Kaydet** butonuna bas

### Arsivi Goruntuleme
- Popup'taki **Arsiv** butonuna tikla
- veya `chrome-extension://<ID>/bookmarks.html` adresini ac

### Filtreleme
- **Tumu / Twitter / YouTube / Diger** — platforma gore filtrele
- **Bekleyen / Tamamlanan** — duruma gore filtrele
- Ust arama cubuguyla baslik, URL veya etiket ile ara

### Gorunum Degistirme
- **Liste** — platform tablolariyla kompakt gorunum
- **Feed** — YouTube thumbnail'li, Twitter benzeri kart akisi

---

## Kisayollar

| Kisayol | Islev |
|---------|-------|
| `/` | Arama kutusuna odaklan |
| `Esc` | Menu kapat / secim modundan cik |

---

## Disa / Ice Aktarma

- **Disa Aktar** — tum kayitlari `mybookmark-YYYY-MM-DD.json` olarak indir
- **Ice Aktar** — daha once disa aktarilan JSON dosyasini yukle (tekrar kayitlar atlanir)

---

## Izinler

| Izin | Neden |
|------|-------|
| `storage` | Bookmark verilerini yerel olarak saklamak icin |
| `tabs` | Aktif sekmenin URL ve basligini okumak icin |
| `contextMenus` | Sag tik menusuyle hizli kayit icin |

---

## Lisans

MIT License — dilediginiz gibi kullanabilir, degistirebilir ve dagitabilirsiniz.

---

Made with love · [GitHub](https://github.com/mehyilmazz/MyBookmarks)
