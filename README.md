# 7-Zip for macOS (GUI)

Go ve Wails ile geliştirilmiş, macOS için modern ve yüksek performanslı **7-Zip** grafik kullanıcı arayüzü (GUI) uygulaması.

Resmi Igor Pavlov **7-Zip (7zz v26.03)** universal (Apple Silicon ARM64 ve Intel x86_64) motorunu içerisinde gömülü (embedded) olarak barındırır. Kullanıcının harici hiçbir araç veya paket kurmasına gerek kalmadan bağımsız olarak çalışır.

---

## 🚀 Özellikler

### 📦 Arşiv Gözatma & Çıkarma (Inspect & Extract)
- **Geniş Format Desteği**: `.7z`, `.zip`, `.rar`, `.tar`, `.gz`, `.tgz`, `.bz2`, `.tbz2`, `.xz`, `.txz`, `.iso`, `.dmg`, `.cab`, `.zst`, `.wim`, `.apk` ve daha fazlası.
- **Sürükle & Bırak (Drag & Drop)**: Arşiv dosyasını pencereye sürükleyip anında içeriğini listeleme.
- **Klasör Ağacı ve Breadcrumb Navigasyonu**: Arşiv içi klasörlere çift tıklayarak girme, kök dizine veya üst klasörlere kolayca dönme.
- **Anlık Dosya Arama / Filtreleme**: Arşiv içindeki yüzlerce dosya arasında isme göre hızlı arama.
- **Seçimli veya Tam Çıkarma**: İster tek bir dosyayı, ister seçilenleri, isterseniz tüm arşivi istediğiniz bir klasöre çıkarma.
- **AES-256 Şifre Koruması**: Şifreli arşivler için otomatik parola isteme modalı.
- **Bütünlük Testi (Integrity Test)**: Arşivin bozulup bozulmadığını ve CRC doğruluğunu test etme.
- **macOS Finder Entegrasyonu**: Dosyayı veya hedef klasörü doğrudan Finder'da açma (`⌘ + Finder`).

### 🗜️ Yeni Arşiv Oluşturma & Sıkıştırma (Compress & Archive)
- **Çoklu Dosya ve Klasör Desteği**: Birden fazla dosya veya klasörü sürükleyip bırakarak sıkıştırma listesine ekleme.
- **Format Seçimi**: `.7z` (Ultra LZMA2), `.zip` (Evrensel), `.tar.gz`, `.tar.xz`, `.tar.bz2`, `.tar`.
- **Sıkıştırma Seviyeleri**:
  - `0`: Depola (Sıkıştırmasız, en hızlı)
  - `1`: Hızlı
  - `5`: Normal (Dengeli)
  - `7`: Maksimum
  - `9`: Ultra (En yüksek LZMA2 sıkıştırma oranı)
- **Güçlü Şifreleme**:
  - Parola koruması (AES-256).
  - **Dosya İsimlerini Şifrele** (Header Encryption - `.7z` için şifre girilmeden dosya adları dahi görünmez).
- **Ciltlere / Parçalara Bölme (Split Volumes)**: 10 MB, 25 MB (E-posta), 100 MB, 700 MB (CD), 4.7 GB (DVD).
- **Çoklu İş Parçacığı (Multi-threading)**: CPU çekirdeklerini tam kapasite kullanarak maksimum hızda sıkıştırma.

### 🖱️ macOS Finder Sağ Tık Entegrasyonu (Hızlı Eylemler / Quick Actions)
Finder içinde herhangi bir dosya veya arşive sağ tıkladığınızda doğrudan erişilebilir:
- **7-Zip ile Buraya Çıkar**: Arşiv dosyalarına sağ tıklayıp anında bulunduğu klasöre çıkarma (şifreliyse parola sorar).
- **7-Zip ile Sıkıştır (.7z)**: Seçilen dosya/klasörleri tek tıkla en yüksek LZMA2 sıkıştırmasıyla `.7z` yapma.
- **7-Zip ile Sıkıştır (.zip)**: Seçilen dosyaları standart `.zip` arşivine dönüştürme.
- **7-Zip ile Aç**: Arşivi 7-Zip grafik arayüzünde görüntüleme.
- **Birlikte Aç (Open With)**: Tüm arşiv türleri için sağ tık -> *Birlikte Aç* -> **7-Zip**.
- **Tek Tıkla Kurulum**: Uygulama arayüzündeki *"Finder Menüsü"* butonundan veya terminalden `make install-finder-actions` ile anında aktif edilir.

---

## 🛠️ Sistem Gereksinimleri

- **İşletim Sistemi**: macOS 11.0 (Big Sur) veya üzeri (Sonoma ve Sequoia dahil).
- **Mimari**: Apple Silicon (M1/M2/M3/M4) veya Intel (x86_64).
- **Geliştirme için**:
  - Go 1.22+
  - Wails CLI v2 (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

---

## 📥 Kurulum ve Derleme

Projeyi klonlayın ve kök dizine geçin:

```bash
git clone https://github.com/bysinbin/7zip-mac.git
cd 7zip-mac
```

### 1. macOS .app Paketini Derleme
Tek komutla bağımsız macOS `.app` uygulamasını oluşturabilirsiniz:

```bash
make build
```
Derlenen uygulama `build/bin/7-Zip.app` yolunda hazır olacaktır.

### 2. Uygulamayı Başlatma
```bash
make run
```
veya Finder'dan `build/bin/7-Zip.app` dosyasına çift tıklayarak çalıştırabilirsiniz.

### 3. Canlı Geliştirme Modu (Live Development)
Arayüzde yapılan değişiklikleri anında görmek için:
```bash
make dev
```

### 4. Birim Testlerini Çalıştırma
Gömülü 7zz motorunu, sıkıştırma, listeleme ve çıkarma fonksiyonlarını test etmek için:
```bash
make test
```

---

## 📂 Proje Yapısı

```
7zip-mac/
├── app.go                      # Wails Go arka uç API bağlayıcıları ve dialoglar
├── main.go                     # Uygulama başlangıcı, pencere ayarları ve macOS seçenekleri
├── Makefile                    # Kolay derleme, çalıştırma ve test komutları
├── wails.json                  # Wails yapılandırması ve dosya ilişkilendirmeleri
├── scripts/
│   └── build_app.sh            # macOS .app paketleme ve imzalama betiği
├── internal/
│   └── engine/
│       ├── bin/7zz             # Resmi Igor Pavlov universal (arm64 + x86_64) 7-Zip ikilisi
│       ├── embed.go            # 7zz ikilisinin gömülmesi ve çalışma zamanında çıkarılması
│       ├── types.go            # Veri yapıları (ArchiveInfo, Entry, Progress, Options)
│       ├── parser.go           # 7zz l -slt çıktısını parse eden ayrıştırıcı
│       ├── sevenzip.go         # 7zz CLI komut yürütücüsü ve ilerleme akışı
│       └── engine_test.go      # Motor birim testleri
└── frontend/
    └── src/
        ├── index.html          # macOS arayüz yapısı, sekmeler ve modallar
        ├── main.css            # Glassmorphism, koyu tema ve modern Apple tasarım stilleri
        ├── main.js             # İstemci tarafı mantığı, filtreleme, gezinme ve Wails olayları
        └── wailsjs/            # Otomatik üretilen Go <-> JS arayüz bağlayıcıları
```

---

## 🔒 Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.  
İçerisinde gömülü bulunan 7-Zip (7zz) yazılımı Igor Pavlov tarafından geliştirilmiş olup LGPL / BSD lisanslarına tabidir.
