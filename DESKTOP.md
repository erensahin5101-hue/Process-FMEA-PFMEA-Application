# TYANA Q-Flow — Windows masaüstü release rehberi

TYANA Q-Flow, Tauri 2 ve Rust ile paketlenen, Windows üzerinde çevrimdışı çalışan bir kalite dokümantasyonu uygulamasıdır. Masaüstü sürümü bir web sunucusuna veya `/api` servislerine ihtiyaç duymaz; proses kütüphanesi, ürün/proje snapshot'ları, kullanıcı kayıtları, teknik resimler ve denetim olayları yerel SQLite veri katmanında tutulur.

Bu belge hem release üreten geliştirici/BT ekibi hem de uygulamayı farklı bilgisayarlara kuracak kullanıcılar içindir. Geçerli uygulama sürümü `1.0.0`, ürün adı **TYANA Q-Flow**, paket kimliği `com.tyanaotomotiv.qflow` ve Windows kurulum biçimi NSIS'tir.

## Release kapsamı

Masaüstü paketinde şu işlevler yer alır:

- Proses kütüphanesini listeleme, ekleme, düzenleme ve arşivleme
- Ürün/proje çalışmasını yerel olarak kaydetme ve son çalışmayı geri yükleme
- Kullanıcı dizini kayıtlarını ekleme, düzenleme ve pasife alma
- PDF, PNG ve JPG teknik resimleri kontrollü yerel depoya alma
- PDF, XLSX ve DXF çıktısını Windows'un yerel **Farklı Kaydet** penceresiyle üretme
- PFMEA'yı antetli, filigranlı ve kontrollü kopya durumunu gösteren A3 yatay PDF olarak üretme
- Proses kütüphanesini biçimlendirilmiş XLSX olarak dışa aktarma
- Değişiklikleri hash zincirli yerel denetim olaylarıyla kaydetme

Masaüstü arayüzü `desktop-build.mjs` tarafından `desktop-dist/` klasörüne hazırlanır. Bu işlem uygulama varlıklarını kopyalar ve `desktop-build-manifest.json` içinde her paket dosyasının SHA-256 özetini üretir. Installer ise bu varlıklarla Rust çekirdeğini tek bir Windows uygulaması olarak paketler.

## Desteklenen ortam

- Windows 10 veya Windows 11, 64 bit
- x64 işlemci/işletim sistemi
- Kurulum için internet bağlantısı gerekmez: yapılandırmadaki `offlineInstaller`, Microsoft Edge WebView2 çalışma zamanını NSIS paketine ekler. Bunun doğal sonucu installer boyutunun daha büyük olmasıdır.
- NSIS'in varsayılanı `currentUser` kurulumudur. Normal koşullarda kurulum yalnızca oturum açmış Windows kullanıcısı içindir; kurumun uç nokta politikası yine de yönetici onayı isteyebilir.

ARM64 veya 32 bit Windows için aynı installer kullanılmamalıdır. Bu hedefler gerektiğinde ayrı Rust target'larıyla ayrı paketlenmeli ve ayrıca test edilmelidir.

## Yerel veri mimarisi

Uygulama verisi Tauri'nin `app_data_dir` konumunda saklanır. Windows'ta beklenen dizin:

```text
%APPDATA%\com.tyanaotomotiv.qflow\
├── tyana-qflow.sqlite3
└── drawings\
    └── <sha256>.<pdf|png|jpg>
```

Kesin konumu PowerShell ile açmak için:

```powershell
$DataRoot = Join-Path $env:APPDATA 'com.tyanaotomotiv.qflow'
Write-Host $DataRoot
explorer.exe $DataRoot
```

SQLite bağlantısı açılırken foreign key kontrolü, WAL günlükleme, `synchronous=FULL`, beş saniyelik busy timeout ve `PRAGMA quick_check` uygulanır. İlk açılışta gömülü proses tohumu ve `user-eren` kimlikli yerel kurulum sahibi **Eren** aktif yönetici olarak eklenir ve bu sahip kaydının aktif yönetici niteliği korunur.

Veri tabloları şunlardır:

| Tablo | İçerik |
|---|---|
| `processes` | Proses kodu, adı, ailesi, durum, sürüm ve bütün JSON içeriği |
| `projects` | Ürün/proje üst bilgileri, revizyon, faz, durum, sürüm ve çalışma snapshot'ı |
| `users` | Yerel kullanıcı dizini, rol etiketi, durum ve sürüm |
| `drawing_assets` | Teknik resmin SHA-256 özeti, türü, boyutu ve göreli dosya yolu |
| `audit_events` | Varlık, işlem, zaman ve birbirine bağlı olay hash'leri |
| `app_meta` | Veri şeması sürümü |

Teknik resimler içerik adresli depolanır. Uygulama istemci ve Rust tarafında SHA-256 doğrulaması yapar; aynı içerik ikinci kez yüklenirse yeni bir fiziksel kopya oluşturulmaz. Daha önce aynı hash ile saklanmış dosya yeniden kullanılırken fiziksel dosyanın boyutu, SHA-256 özeti ve içerik imzası tekrar doğrulanır; bozuk veya değiştirilmiş kopya sessizce kabul edilmez. Kabul edilen türler PDF, PNG ve JPG, tek dosya üst sınırı 32 MB'dir. Proje/proses/kullanıcı JSON kaydı için üst sınır 2 MB'dir.

Yazma işlemleri SQLite `IMMEDIATE` transaction içinde yapılır. Düzenlenen kayıtlarda `WHERE ... version = ?` koşullu güncellemesiyle compare-and-swap (CAS) uygulanır; eski sürüme dayanarak yapılan eşzamanlı değişiklik reddedilir. Bu mekanizma tek yerel veri deposunda kayıp güncelleme riskini azaltır, bilgisayarlar arası eşzamanlama sağlamaz.

## Masaüstü komut sınırı

Rust çekirdeğinde yalnızca aşağıdaki uygulama komutları kaydedilidir ve tamamı `main` etiketli pencereyle sınırlandırılmıştır:

| Alan | Komutlar |
|---|---|
| Kontrollü çıktı | `prepare_export`, `write_export` |
| Proses | `process_list`, `process_save`, `process_archive` |
| Proje | `project_latest`, `project_save` |
| Kullanıcı dizini | `user_me`, `user_list`, `user_save`, `user_deactivate` |
| Teknik resim | `drawing_store` |

Frontend genel bir dosya yolu gönderemez. Çıktı yolu yalnızca Windows kaydet diyaloğunda seçilir ve iki dakika geçerli, tek kullanımlık rastgele biletle eşleştirilir. PDF/XLSX/DXF içerik imzası ile uzantı uyumu yazmadan önce kontrol edilir; tek çıktı üst sınırı 64 MB'dir. Doğrulanan çıktı önce aynı klasörde geçici dosyaya yazılıp diske senkronlanır, ardından Windows `MoveFileExW` ile `REPLACE_EXISTING | WRITE_THROUGH` kullanılarak hedefe atomik olarak geçirilir; başarısız yazım mevcut kontrollü çıktının yarım dosyayla değiştirilmesine yol açmaz.

`main` penceresine genel dosya sistemi, shell, HTTP, updater veya dialog eklenti izni verilmez. Yerel varlıklarda sıkı CSP, dondurulmuş prototipler ve kapalı asset protokolü kullanılır.

## Farklı bilgisayara kurulum

1. Release klasöründeki `*-setup.exe` dosyasını ve yayınlanan SHA-256 değerini hedef bilgisayara aktarın.
2. Hedef bilgisayarda hash'i doğrulayın:

   ```powershell
   Get-FileHash -Algorithm SHA256 '.\TYANA-Q-Flow-1.0.0-x64-Setup.exe'
   ```

3. Sonucun release manifestindeki değerle birebir aynı olduğunu kontrol edin.
4. Installer'ı çalıştırın ve Windows yönergelerini tamamlayın. WebView2 pakete gömülü olduğu için internet bağlantısı gerekmez.
5. Başlat menüsündeki **TYANA OTOMOTİV > TYANA Q-Flow** kısayolundan uygulamayı açın.
6. İlk açılışta bir test mamulü kaydedin, uygulamayı kapatıp yeniden açın ve son projenin geri geldiğini doğrulayın.
7. PDF ve XLSX test çıktısı alın; dosyaları kendi uygulamalarında açarak içerik ve sayfa düzenini kontrol edin.

Her Windows hesabının ve her bilgisayarın ayrı veri dizini vardır. Installer'ı başka bilgisayara kurmak veriyi otomatik taşımaz. Veri aktarımı gerekiyorsa aşağıdaki yedekleme/geri yükleme yöntemi kullanılmalıdır.

Kurulum kaldırılmadan veya sürüm yükseltilmeden önce mutlaka yedek alın. Windows **Ayarlar > Uygulamalar > Yüklü uygulamalar** alanından kaldırma yapılabilir. Kaldırıcının kullanıcı verisini silmeyeceği varsayılmamalı; yedek, kaldırmadan önce doğrulanmalıdır.

## Yedekleme ve bilgisayarlar arası veri taşıma

Uygulamada henüz zamanlanmış/otomatik yedekleme ekranı yoktur. Güvenli elle yedekleme için:

1. TYANA Q-Flow'u tamamen kapatın. Görev Yöneticisi'nde uygulama işleminin kalmadığını doğrulayın.
2. Veritabanı, olası `-wal`/`-shm` dosyaları ve `drawings` klasörü dahil **bütün veri kökünü** kopyalayın.

```powershell
$DataRoot = Join-Path $env:APPDATA 'com.tyanaotomotiv.qflow'
$BackupRoot = Join-Path $env:USERPROFILE ('Documents\TYANA-QFlow-Backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
Copy-Item -LiteralPath $DataRoot -Destination $BackupRoot -Recurse
Get-ChildItem -LiteralPath $BackupRoot -Recurse
```

Yedek şu iki unsuru birlikte içermelidir:

- `tyana-qflow.sqlite3` ve varsa SQLite günlük dosyaları
- `drawings` klasörünün tamamı

PDF/XLSX/DXF çıktıları kullanıcı tarafından farklı klasörlere kaydedilir; uygulama veri yedeğine dahil değildir. Bunlar ayrıca arşivlenmelidir.

Geri yükleme veya başka bilgisayara taşıma:

1. Kaynak ve hedef uygulamaları kapatın.
2. Hedefte mevcut veri varsa önce ayrı bir yedek alın.
3. Tek ve eksiksiz yedek klasörünü hedef `%APPDATA%\com.tyanaotomotiv.qflow` konumuna kopyalayın.
4. Uygulamayı açın; başlangıçtaki `quick_check` veritabanı bütünlüğünü kontrol eder.
5. Proje, proses ve teknik resim ilişkisinin çalıştığını örnek kayıtlarla doğrulayın.

İki bilgisayarın SQLite dosyaları dosya seviyesinde birleştirilmemelidir. Canlı veritabanını OneDrive, ağ paylaşımı veya eşzamanlı iki bilgisayarın açtığı ortak klasör üzerinde çalıştırmayın. Bu sürüm merkezi eşzamanlama sunmaz; taşıma, bir bütün yedeğin kontrollü olarak diğerinin yerine geçirilmesidir.

## Release üretme

### Derleme bilgisayarı gereksinimleri

- Node.js LTS ve npm
- Rust stable MSVC; bu kaynak sürümü `rust-version = 1.97.0` ister
- Visual Studio 2022 Build Tools içinde **Desktop development with C++** iş yükü ve Windows SDK
- Tauri CLI 2 (`@tauri-apps/cli` proje dev dependency'si)
- İlk paketleme sırasında bağımlılıklar ve WebView2 offline installer'ı indirebilmek için internet erişimi

Kurulu hedefi doğrulayın:

```powershell
rustc -vV
cargo -V
npx.cmd tauri info
```

`rustc -vV` çıktısındaki `host` değeri x64 release için `x86_64-pc-windows-msvc` olmalıdır.

### Temiz kurulum ve doğrulama

Proje kökünde:

```powershell
npm.cmd ci
node --check app.js
node --check platform-adapter.js
node --check desktop-build.mjs
npm.cmd run test:worker
npm.cmd run test:exports
npm.cmd run desktop:assets

cargo fmt --manifest-path src-tauri\Cargo.toml -- --check
cargo check --locked --manifest-path src-tauri\Cargo.toml
cargo test --locked --manifest-path src-tauri\Cargo.toml
```

`test:exports`, diğer kontrollü formatlarla birlikte gerçek PFMEA doküman tanımını çalıştırır; PDF'nin A3 yatay olduğunu, 14 kolonlu PFMEA yapısını ve anlamlı bir PDF byte akışı üretildiğini smoke test ile doğrular.

`--locked` kullanımı, repodaki `Cargo.lock` ile yeniden üretilebilir bağımlılık çözümünü zorlar. `Cargo.lock` henüz oluşturulmamışsa bir kez `cargo check --manifest-path src-tauri\Cargo.toml` çalıştırın, oluşan kilit dosyasını gözden geçirip repoya dahil edin; sonraki release'lerde yeniden `--locked` kullanın.

NSIS installer üretimi:

```powershell
npm.cmd run desktop:release:x64
```

Bu script Tauri'yi CI modunda, yalnız NSIS paketi için ve `x86_64-pc-windows-msvc` hedefiyle çalıştırır. Elle `tauri build` çağırmak yerine release üretiminde bu sabit script tercih edilmelidir.

Beklenen çıktılar:

```text
src-tauri\target\x86_64-pc-windows-msvc\release\tyana-quality-docs.exe
src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\TYANA Q-Flow_1.0.0_x64-setup.exe
release-desktop\TYANA-Q-Flow-1.0.0-x64-Setup.exe
```

Dağıtımda tek başına ham `.exe` yerine release klasöründeki `TYANA-Q-Flow-1.0.0-x64-Setup.exe` dosyasını kullanın. Doğrulanan 1.0.0 installer'ı 209.554.159 bayttır; yaklaşık 209,6 MB (ondalık) / 199,8 MiB boyutu, pakete gömülü çevrimdışı WebView2 çalışma zamanını da içerir.

`package.json`, `src-tauri/Cargo.toml` ve `src-tauri/tauri.conf.json` içindeki sürümler release öncesinde aynı olmalıdır.

## Installer doğrulama

Build tamamlandıktan sonra:

```powershell
$Installer = Get-Item 'release-desktop\TYANA-Q-Flow-1.0.0-x64-Setup.exe'

$Installer | Select-Object FullName, Length, LastWriteTime
Get-FileHash -Algorithm SHA256 -LiteralPath $Installer.FullName
Get-AuthenticodeSignature -LiteralPath $Installer.FullName |
  Select-Object Status, StatusMessage, SignerCertificate, TimeStamperCertificate
```

Kurulmuş uygulamayı bir kez açıp kapattıktan sonra runtime veritabanını salt okunur kabul kontrolünden geçirin:

```powershell
$Database = Join-Path $env:APPDATA 'com.tyanaotomotiv.qflow\tyana-qflow.sqlite3'
python tests\runtime-db-check.py $Database
```

`tests/runtime-db-check.py` veritabanını SQLite `mode=ro` ile açar; `quick_check`, proses/proje/kullanıcı/audit sayaçları ve aktif yönetici sayısını JSON olarak raporlar. Kabul için `quick_check` değeri `ok`, proses ve aktif yönetici sayıları en az bir olmalıdır. Bu komut Python 3 bulunan release test bilgisayarında çalıştırılır; son kullanıcı kurulumunun Python'a çalışma zamanı bağımlılığı yoktur.

Release kabul testi tercihen temiz bir Windows 10 ve temiz bir Windows 11 x64 sanal makinesinde yapılmalıdır:

- Ağ bağlantısı kapalıyken kurulum ve ilk açılış
- Başlat menüsü kısayolu ve kaldırıcı
- İlk açılışta SQLite/veri dizini oluşması
- Sıfırdan mamul oluşturma ve çok seviyeli alt bileşen/BOM kaydı
- Proses ekleme, düzenleme, arşivleme ve yeniden açılışta kalıcılık
- PDF/PNG/JPG teknik resim alma ve SHA-256 doğrulaması
- Proje kaydetme, kapatıp açma ve son projeyi geri yükleme
- PDF, XLSX ve DXF üretme; çıktıların bağımsız okuyucularda açılması
- PFMEA'nın A3 yatay kontrollü PDF olarak üretilmesi; antet, filigran, S-O-D-AP ve aksiyon kanıt alanlarının görsel kontrolü
- Son aktif yönetici koruması
- Yedekleme ve geri yükleme provası
- Installer hash'i ve Authenticode durumu

Dosyanın oluşması tek başına release kabulü değildir; yukarıdaki işlevsel ve görsel kontroller tamamlanmalıdır.

## İmzalama ve dağıtım güveni

Kaynak repoda kurumsal Windows Authenticode sertifikası bulunmaz. Sertifika ortam değişkenleri/kurumsal imzalama altyapısı sağlanmadan üretilen installer **imzasızdır** ve Windows SmartScreen'de “Bilinmeyen yayıncı” uyarısı gösterebilir. SHA-256 değeri dosya bütünlüğünü doğrular; yayıncı kimliğinin yerini tutmaz.

Kurum dışına üretim dağıtımı için:

- TYANA adına geçerli OV veya EV kod imzalama sertifikası temin edin.
- Özel anahtarı repoya, kaynak klasörüne veya installer'ın yanına koymayın.
- Release CI/kurumsal imzalama istasyonunda Authenticode imzası ve güvenilir zaman damgası uygulayın.
- İmza sonrası `Get-AuthenticodeSignature` sonucu `Valid` olmalıdır.
- İmzalanmış installer'ın SHA-256 değerini yayınlayın ve kabul tutanağında saklayın.

`createUpdaterArtifacts` şu anda `false` olduğu için otomatik güncelleme paketi üretilmez. Yeni sürüm kontrollü biçimde yeni installer ile dağıtılmalıdır.

## Bilinen sınırlar ve uyum notları

Bu sınırlar kapatılmadan uygulama, tek Windows profilli yerel çalışma istasyonu sürümü olarak değerlendirilmelidir:

- `user_me`, sabit bir frontend nesnesi yerine SQLite içindeki `user-eren` yerel kurulum sahibi kaydını döndürür; Eren kaydı aktif yönetici olarak korunur ve pasife alınamaz. Buna rağmen bu yapı gerçek oturum açma değildir. Kullanıcı ekranındaki roller bir kullanıcı dizini/iş akışı etiketidir; parola doğrulaması, Windows hesabıyla kriptografik eşleme veya komut seviyesinde gerçek RBAC yetkilendirmesi yoktur.
- Elektronik imza, çift onay, reddedilemezlik ve 21 CFR Part 11 düzeyi kimlik doğrulama yoktur.
- Hash zincirli denetim olayları değişiklik sürekliliğini destekler ancak salt okunur harici WORM kayıt veya dijital imza olmadığı için tek başına kurcalamaya dayanıklı resmi kayıt sayılmaz.
- SQLite ve teknik resimler uygulama seviyesinde şifrelenmez. Hassas üretim verileri için Windows hesap politikası, NTFS izinleri, BitLocker ve kurumsal uç nokta kontrolleri uygulanmalıdır.
- Merkezi sunucu, çok bilgisayarlı eşzamanlama, eşzamanlı ortak düzenleme ve otomatik çatışma birleştirme yoktur.
- Otomatik yedekleme/geri yükleme ekranı ve şema göç yönetimi henüz yoktur. Sürüm yükseltmeden önce tam yedek zorunludur.
- Teknik resimden ölçü, tolerans, malzeme veya kaplama otomatik OCR/CAD çıkarımı yapılmaz; bu değerler kullanıcı tarafından seçilir/girilir ve kullanıcı doğrulamasına tabidir.
- Yerel teknik resim deposu yalnızca PDF/PNG/JPG kabul eder.
- Kontrollü CAD çıktısı **DXF**'tir. Yerel/native DWG yazımı bu sürümde yoktur; DXF dosyasının CAD uygulamasında DWG'ye dönüştürülmesi ayrı ve doğrulanması gereken bir işlemdir.
- IATF 16949:2016 ve AIAG yaklaşımına göre alanlar/doküman akışları sunmak, tek başına kuruluşun standarda uygunluğunu veya sertifikasyonunu kanıtlamaz. Şablonların müşteri özel şartları, güncel lisanslı AIAG yayınları, kurum prosedürleri ve yetkili kalite onayıyla doğrulanması gerekir.
- Hiçbir yazılım için “güvenlik açığı yoktur” garantisi verilemez. Release öncesinde bağımlılık taraması, Windows temiz makine testi, kötü amaçlı yazılım taraması, yetki testi ve düzenli yama süreci işletilmelidir.

Gerçek çok kullanıcılı üretim dağıtımından önce asgari kapanış maddeleri; Windows/kurumsal kimlik doğrulama, backend komutlarında rol yetkilendirmesi, elektronik onay imzaları, merkezi veya kontrollü immutable audit deposu, otomatik şifreli yedek, veri göçleri, Authenticode imzası ve temiz makine kabul testleridir.
