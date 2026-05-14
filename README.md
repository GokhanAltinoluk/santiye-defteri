# 🏗️ Şantiye Defteri

Kaba ve ince inşaat işlerini kapsayan gelir-gider muhasebesi ve personel puantajı yönetim sistemi.  
GitHub Pages üzerinden yayınlanır, iOS/Android telefonlarda PWA olarak çalışır.

## Özellikler

- **Çoklu şantiye** — Birden fazla proje/şantiyeyi ayrı ayrı yönetin
- **Gelir/Gider Muhasebesi** — Kaba iş, ince iş ve genel kategorilerinde kayıt
- **Personel Puantajı** — Günlük veya saatlik, aylık cetvel görünümü
- **Otomatik Hakediş** — Çalışılan süre × ücret, fazla mesai 1.5× ile hesaplanır
- **Ödeme Takibi** — Personele yapılan ödemeler, kalan borç göstergesi
- **Raporlar** — Aylık özet, gider kırılımı, hakediş raporu
- **CSV İndirme** — Excel'de açılabilen Türkçe CSV
- **PDF / Yazdırma** — Rapor ve puantaj cetveli yazdırma
- **JSON Yedek** — Tüm veriyi indir/yükle (Google Drive'a manuel yükleme)
- **Çevrimdışı** — Service Worker sayesinde internet olmadan da çalışır
- **Ana Ekrana Ekle** — iOS ve Android'de uygulama gibi açılır

---

## GitHub Pages'te Yayınlama

### 1. GitHub hesabı oluşturun (yoksa)
[github.com](https://github.com) adresine gidin ve ücretsiz hesap açın.

### 2. Yeni repository oluşturun
- Sağ üstteki **+** → **New repository**
- Repository name: `santiye-defteri` (veya istediğiniz bir isim)
- **Public** seçin (GitHub Pages ücretsiz kullanım için gerekli)
- **Create repository** tıklayın

### 3. Dosyaları yükleyin
Repository sayfasında **Add file → Upload files** tıklayın.  
Şu dosya ve klasörleri sürükleyin:
```
index.html
manifest.json
sw.js
css/
js/
icons/
```
**Commit changes** tıklayın.

### 4. GitHub Pages'i aktif edin
- Repository sayfasında **Settings** sekmesine girin
- Sol menüden **Pages** tıklayın
- **Source:** Branch: `main` / Folder: `/(root)` seçin
- **Save** tıklayın

Birkaç dakika bekleyin. Siteniz şu adreste yayına girer:  
`https://KULLANICI-ADINIZ.github.io/santiye-defteri/`

---

## Telefona Yükleme (PWA)

### Android (Chrome)
1. Tarayıcıda uygulamayı açın
2. Sağ üstteki ⋮ menü → **Ana ekrana ekle**

### iOS (Safari)
1. Safari'de uygulamayı açın
2. Alt ortadaki paylaş butonu ⬆️ → **Ana Ekrana Ekle**

---

## Veri Güvenliği

Veriler tarayıcının LocalStorage'ında saklanır (sunucuya gönderilmez).  
Tarayıcı verilerini temizlemeden veya cihazı değiştirmeden önce **Yedekleme** bölümünden JSON yedek alın ve Google Drive'a kaydedin.

---

## Yerel Test

```bash
# Python 3 ile basit HTTP sunucu (service worker için gerekli)
python -m http.server 8080

# Sonra tarayıcıda açın:
# http://localhost:8080
```
