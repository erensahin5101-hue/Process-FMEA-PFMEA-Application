# TYANA Q-FLOW 1.16.0 — Windows masaüstü release rehberi

**TYANA Q-FLOW**, kuruluştan bağımsız genel kurulum profiliyle çalışan; Tauri 2, Rust ve Microsoft Edge WebView2 kullanılarak paketlenen Windows kalite dokümantasyonu uygulamasıdır. Electron kullanılmaz. Masaüstü sürümü bir web sunucusuna veya `/api` servislerine ihtiyaç duymaz; proses kütüphanesi, ürün/proje snapshot'ları, kullanıcı kayıtları, teknik resimler ve denetim olayları yerel SQLite veri katmanında tutulur.

Bu belge hem release üreten geliştirici/BT ekibi hem de uygulamayı farklı bilgisayarlara kuracak kullanıcılar içindir. Kaynak sürümü `1.16.0`, ürün adı **TYANA Q-FLOW**, varsayılan profil `tyana-qflow-default`, paket kimliği `com.tyanaotomotiv.qflow` ve Windows kurulum biçimi NSIS'tir. Kuruluş, tesis, logo ve doküman anteti kullanıcı tarafından tanımlanır; kaynak referans paketleri aktif kurum kimliği yerine geçmez. Paket Authenticode ile imzalı değildir; temiz Windows 10/11 kurumsal pilot kabulü ayrıca yapılmalıdır.

Sürüm 1.15.0 ile **Admin Merkezi** ve iki kademeli lisans akışı eklendi. Kurulum 30 günlük tam özellikli deneme ile başlar; Admin Merkezi veya deneme kilit ekranındaki lisans alanından kalıcı aktivasyon anahtarı girildiğinde yerel lisans süresiz hale gelir. Kalıcı aktivasyon cihaz-bağlıdır; anahtarın kurumsal dağıtımı yetkili ekip tarafından yapılmalıdır. Uygulamadaki pasif görünen kalite kapısı düğmeleri ölü kontrol değildir: ilgili ön koşul (ör. BOM, ölçü, onay veya kanıt) tamamlanana kadar güvenli biçimde kilitlenir ve gerekçesi kullanıcıya gösterilir.

Sürüm 1.16.0 ile ürün evreni ana mamul, alt montaj, yarı mamul, iç üretim parçası, hammadde, montaj malzemesi, ambalaj ve dış tedarik (XD) kartlarına ayrılmıştır. Sadece üretilebilir kartlar iş planına alınır; satın alınan, hammadde, montaj ve ambalaj kartları BOM girdisi olarak kalır. Boundary diyagramı öğeleri sürükle-bırak veya iki tıklama ile ok yönlü arayüz bağlantısına dönüştürülebilir; arama alanlarında `Esc` temizleme ve kapatma davranışı aktiftir.

Sürüm 1.14.0 ile kullanıcıyı veri durumuna göre yönlendiren **Akıllı Rehber** eklenmiştir. On üç kapılı yol haritası ürün kimliği, teknik resim, BOM, iş planı, proses akışı, teknik sorular, karakteristikler, Boundary/P-Diyagramı, DFMEA, PFMEA, Kontrol Planı, operatör talimatları ve PPAP yayın zincirini canlı olarak denetler. Üst çubuk sıradaki işi gösterir; yardım çekmecesi gerekçeyi açıklar ve kullanıcıyı doğrudan ilgili alana götürür. `Ctrl+K` ile modül, işlem ve doküman araması yapılır. Boş/yer tutucu karakteristikler artık hazır kabul edilmez; rota, teknik kaynak, tolerans, ölçüm cihazı, MSA ve kalibrasyon kanıtı birlikte aranır.

Sürüm 1.13.0 ile APQP kalite kapısına kalıcı **Boundary Diyagramı** ve **P-Diyagramı** editörleri eklenmiştir. Ürün ağacından sistem sınırı başlatılabilir; dış sistemler ve arayüzler bağlanabilir; beş gürültü ailesi, kontrol faktörleri, fonksiyon, çıktı ve DVP&R yöntemleri seçilerek iki sayfalı kontrollü PDF üretilebilir.

## Release kapsamı

Masaüstü paketinde şu işlevler yer alır:

- Proses kütüphanesini listeleme, ekleme, düzenleme ve arşivleme
- 13 ürün grubu, 13 bileşen arketipi, 133 teknik soru ve 34 başlangıç prosesinden seçilebilir ürün/proses omurgası oluşturma
- SAP benzeri iki aşamalı mühendislik omurgası: önce ana mamul/alt montaj/bileşen malzeme kartları, sonra yalnız tanımlı kartlardan revizyonlu ve alternatifli çok seviyeli BOM
- Görsel karttan hedef ana mamul, yarı mamul veya iç üretim kartına doğrudan bırakmayla alt BOM açma; çoklu seçim, çift tıklama ve hızlı ekleme alternatifleri
- Üretilen her kart için 380 operasyon kartından iş planı oluşturma; operasyonu belirli sıraya sürükleyip bırakma, uygun makine seçme, akıllı rota önerme ve kontrollü rota kopyalama
- VOC → QFD-1/2 → Boundary Diagram → P-Diyagramı → DFMEA → DVP&R → karakteristik matrisi → proses akışı → PFMEA → Kontrol Planı → iş talimatı kanıt zinciri
- Foundation FMEA, Family FMEA ve ürüne özel FMEA profilleri; AIAG-VDA AP veya miras RPN + AP seçim kaydı
- DFMEA ve PFMEA için kapsam, uygulanabilirlik gerekçesi, öğrenilmiş ders, 7 adım denetim soruları, kanıt/sorumlu/termin, risk gerekçesi ve aksiyon sonrası S-O-D/AP etkinlik kaydı
- Ürün → BOM → İş Planı → DFMEA/PFMEA → Kontrol Planı → Operatör Talimatı → PPAP zincirini 10 kalite kapısında sınayan dokümantasyon tutarlılık paneli
- Mevcut veriyi okuyup sıradaki doğru işi belirleyen 13 kapılı Akıllı Rehber; bağlama duyarlı sayfa yardımı, doğrudan hedef alana geçiş, hazırlık skoru ve `Ctrl+K` hızlı komut araması
- Teknik resim karakteristiklerinden düzenlenebilir ve sürüklenebilir QFD/izlenebilirlik satırı üretme
- Çok seviyeli BOM: alt BOM, sürükle-bırak sıralama, ebeveyn/çocuk ilişkisi, geçerlilik, exact-one alternatif kapısı, aktif BOM revizyonu/alternatifi, tam yol ve proses bağlantıları
- Ürün kimliğinde ayrı OEM No ve kuruluş içi ERP/SAP stok kodu; yazılabilir kullanıcı tanımlı ürün tipi ve isteğe bağlı gelişmiş ürün ailesi
- Tanıtım amaçlı `Rot Kolu Sabit Ayarlı` mühendislik şablonu: 18 bileşen, 7 üst seviye kalem, Rot Başı altında 9 alt bileşen, iki rulman alternatifi arasından tek seçim ve boya sonrası montaj bağlantısı
- 28 proses ve 40 risk şablonlu seçilebilir PFMEA çalışma alanı
- Kontrollü kaynak referans paketi: 2 kaynak kontrol planı, 10 kaynak talimat, 10 talimat preseti, 10 operasyon preseti, 54 karakteristik ve 14 doğrulama kuralı. Paket provenance amaçlıdır; aktif kuruluş markasını belirlemez.
- Türkçe/İngilizce operasyon kodu kütüphanesi: 380 kayıt; gözden geçirme ve eşleme belirsizliği işaretleri kullanıcı doğrulamasına tabidir
- 18 unsurlu PPAP kanıt kaydı: sorumlu, termin, revizyon, onay, uygulanabilirlik, gerekçe, dosya/SHA-256 kanıtı ve kaynak veri değiştiğinde kontrollü çıktıyı bayatlatan kalite kapısı
- Ürün/proje çalışmasını yerel olarak kaydetme ve son çalışmayı geri yükleme
- Kullanıcı dizini kayıtlarını ekleme, düzenleme ve pasife alma
- PDF, PNG ve JPG teknik resimleri kontrollü yerel depoya alma
- PDF, XLSX ve DXF çıktısını Windows'un yerel **Farklı Kaydet** penceresiyle üretme
- PFMEA'yı antetli, filigranlı ve kontrollü kopya durumunu gösteren A3 yatay PDF olarak üretme
- PFMEA'yı 41 kolonlu ana form, 7 Adım Kanıtı, FMEA Profili, İzlenebilirlik ve çok gizli kontrollü metadata sayfalarıyla Excel olarak üretme
- DFMEA'yı ürün fonksiyon/hata/risk/optimizasyon zinciri ve 7 adım kanıt ekiyle antetli A3 yatay PDF olarak üretme
- Dokümantasyon tutarlılık sonuçlarını, bloke bulguları ve FMEA soru kanıtlarını denetim kanıt PDF'i olarak üretme
- Proses akışını tip bazlı vektör şekiller, ikonlar, lejant, KPI, antet ve kontrollü filigranla A3 dikey infografik; tam girdi/çıktı izlenebilirliğini A3 yatay matris olarak aynı PDF içinde üretme
- 34 ana proses kartını ve 380 TR/EN operasyon kodunu ayrı doğrulanmış XLSX çalışma kitapları olarak dışa aktarma
- Değişiklikleri hash zincirli yerel denetim olaylarıyla kaydetme
- İlk çalıştırıldığı bilgisayara bağlı 30 günlük tam özellikli kullanım; çift yerel bütünlük kaydı, cihaz doğrulaması ve saat geri alma koruması

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

`main` penceresine genel dosya sistemi, shell, HTTP, updater veya dialog eklenti izni verilmez. Yerel varlıklarda sıkı CSP ve kapalı asset protokolü kullanılır. Tauri `freezePrototype` seçeneği ExcelJS'in çalışma zamanında kendi sayı/kriptografi prototiplerini kurmasıyla çakıştığı için kapalıdır; paket yalnız birinci taraf yerel scriptleri çalıştırır ve `script-src 'self'` dışındaki script kaynaklarını reddeder.

## Farklı bilgisayara kurulum

1. Release klasöründeki `*-setup.exe` dosyasını ve yayınlanan SHA-256 değerini hedef bilgisayara aktarın.
2. Hedef bilgisayarda hash'i doğrulayın:

   ```powershell
   Get-FileHash -Algorithm SHA256 '.\TYANA-Q-Flow-1.16.0-x64-Setup.exe'
   ```

3. Sonucun release manifestindeki değerle birebir aynı olduğunu kontrol edin.
4. Installer'ı çalıştırın ve Windows yönergelerini tamamlayın. WebView2 pakete gömülü olduğu için internet bağlantısı gerekmez.
5. Başlat menüsündeki **TYANA Q-FLOW** klasöründen uygulamayı açın; pencere başlığında **TYANA Q-FLOW | Kalite Dokümantasyonu** ifadesini doğrulayın.
6. İlk açılışta bir test mamulü kaydedin, uygulamayı kapatıp yeniden açın ve son projenin geri geldiğini doğrulayın.
7. PDF ve XLSX test çıktısı alın; dosyaları kendi uygulamalarında açarak içerik ve sayfa düzenini kontrol edin.

Her Windows hesabının ve her bilgisayarın ayrı veri dizini vardır. Installer'ı başka bilgisayara kurmak veriyi otomatik taşımaz. Veri aktarımı gerekiyorsa aşağıdaki yedekleme/geri yükleme yöntemi kullanılmalıdır.

Kurulum kaldırılmadan veya sürüm yükseltilmeden önce mutlaka yedek alın. Windows **Ayarlar > Uygulamalar > Yüklü uygulamalar** alanından kaldırma yapılabilir. Kaldırıcının kullanıcı verisini silmeyeceği varsayılmamalı; yedek, kaldırmadan önce doğrulanmalıdır.

## Yedekleme ve bilgisayarlar arası veri taşıma

Uygulamada henüz zamanlanmış/otomatik yedekleme ekranı yoktur. Güvenli elle yedekleme için:

1. TYANA Q-FLOW'u tamamen kapatın. Görev Yöneticisi'nde uygulama işleminin kalmadığını doğrulayın.
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

Cargo derleme çıktısı ve bağımlılık önbelleği OneDrive içindeki kaynak ağacına yazılmaz. Varsayılan harici hedef `%LOCALAPPDATA%\TYANA\QFlow\cargo-target` dizinidir. Bu yaklaşım `src-tauri\target` altında debug/release/target tekrarlarının oluşmasını ve OneDrive'ın gigabaytlarca derleme ara dosyasını eşitlemesini önler. Kurumsal build sunucusunda farklı bir yol kullanılacaksa bütün build ve paketleme adımlarında aynı `CARGO_TARGET_DIR` değeri korunmalıdır.

Proje kökünde:

```powershell
npm.cmd ci
node --check app.js
node --check platform-adapter.js
node --check desktop-build.mjs
npm.cmd run test:all
npm.cmd run desktop:assets

$env:CARGO_TARGET_DIR = Join-Path $env:LOCALAPPDATA 'TYANA\QFlow\cargo-target'
cargo fmt --manifest-path src-tauri\Cargo.toml -- --check
cargo check --locked --manifest-path src-tauri\Cargo.toml
cargo test --locked --manifest-path src-tauri\Cargo.toml
```

`test:all`; native export adaptörünü, PPAP seviye matrisini, ürün/PFMEA/BOM/kaynak referans/operasyon kodu kütüphanelerini, PDF/XLSX/DXF dosya yapılarını ve worker güvenlik kontrollerini birlikte çalıştırır. Kaynak referans paketinde 2 kontrol planı, 10 talimat preseti, 54 karakteristik ve 14 doğrulama kuralı; operasyon kodu kütüphanesinde 380 kayıt doğrulanır. Kurulu Tauri/WebView2 kabul sonuçları her release için `RELEASE-VALIDATION.md` dosyasına yeniden işlenir.

BOM döngüleri, alternatif seçimleri ve proses izlenebilirliği; PPAP snapshot kalıcılığı, zorunlu unsurda U/A atlatma engeli ve bayat kanıt reddi ayrıca sınanır. Release kabulünde `tests/native-desktop-cdp.mjs` gerçek Tauri/WebView2 çalışma zamanını; `tests/native-save-dialog.ps1` ise gerçek Windows Kaydet diyaloğu, Rust export bileti ve atomik disk yazımını sınar. Çalışma kitapları yeniden açılmalı; PDF imzaları, sayfaları ve görsel yerleşimleri ile DXF yapısı doğrulanmalıdır.

`--locked` kullanımı, repodaki `Cargo.lock` ile yeniden üretilebilir bağımlılık çözümünü zorlar. Bu release `Cargo.lock` ile derlenmiş ve 19 Rust testi geçmiştir. Kilit dosyası bilinçli bağımlılık güncellemesi dışında yeniden çözülmemeli; değişirse ayrı güvenlik ve regresyon incelemesine alınmalıdır.

NSIS installer üretimi:

```powershell
npm.cmd run desktop:release:x64
npm.cmd run desktop:package:x64
```

İlk script Tauri'yi CI modunda, yalnız NSIS paketi için ve `x86_64-pc-windows-msvc` hedefiyle çalıştırır; `CARGO_TARGET_DIR` verilmemişse harici `%LOCALAPPDATA%\TYANA\QFlow\cargo-target` dizinini kullanır. İkinci script aynı harici hedefteki installer'ı bulur, sürüm eşleşmesini denetler ve `release-desktop` klasörüne installer, SHA-256 ve release manifestini üretir. Elle `tauri build` çağırmak yerine release üretiminde bu sabit scriptler tercih edilmelidir.

Beklenen çıktılar:

```text
%LOCALAPPDATA%\TYANA\QFlow\cargo-target\x86_64-pc-windows-msvc\release\tyana-qflow-desktop.exe
%LOCALAPPDATA%\TYANA\QFlow\cargo-target\x86_64-pc-windows-msvc\release\bundle\nsis\TYANA Q-FLOW_1.16.0_x64-setup.exe
release-desktop\TYANA-Q-Flow-1.16.0-x64-Setup.exe
```

Dağıtımda tek başına ham uygulama `.exe` dosyası yerine release klasöründeki installer kullanılmalıdır. Mevcut 1.4.0 release adayı `209.944.981` bayttır; SHA-256 özeti `fdc9de0ad37bbd30002aeefe988e95023c170111c66a7c84fe64a9a4c53b6772` ve Authenticode durumu `NotSigned` / `unsigned` olarak kaydedilmiştir. Bu değerler [release manifesti](release-desktop/release-manifest.json) ve `SHA256SUMS.txt` ile birlikte doğrulanmalıdır; kurumsal imza uygulanırsa dosya ve hash değişeceği için manifest yeniden üretilmelidir.

`package.json`, `src-tauri/Cargo.toml` ve `src-tauri/tauri.conf.json` içindeki sürümler release öncesinde aynı olmalıdır.

## Installer doğrulama

Build tamamlandıktan sonra:

```powershell
$Installer = Get-Item 'release-desktop\TYANA-Q-Flow-1.16.0-x64-Setup.exe'

$Installer | Select-Object FullName, Length, LastWriteTime
Get-FileHash -Algorithm SHA256 -LiteralPath $Installer.FullName
Get-AuthenticodeSignature -LiteralPath $Installer.FullName |
  Select-Object Status, StatusMessage, SignerCertificate, TimeStamperCertificate
```

18 Temmuz 2026 yerel kabul sonucu: NSIS çıkış kodu `0`, kurulu dosya sürümü `1.4.0`, ürün adı `TYANA Q-FLOW`, installer SHA-256 değeri yukarıdaki manifestle aynı ve Authenticode durumu `NotSigned` olarak doğrulandı. Windows Defender imza `1.455.200.0` ile yapılan özel taramada installer için tehdit eşleşmesi `0` oldu. Bu yerel kabul kurumsal EDR, Authenticode imzası ve temiz Windows 10/11 pilotunun yerine geçmez.

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
- Bu nedenle masaüstü pilot sürümü `Onaylandı` veya `Yayında` proje kaydını backend seviyesinde kabul etmez; proses `approvalStatus` alanı düzenlemede `draft` durumuna döner. Bu durumlar ancak ilerideki kimlikli, yetkili çift onay modülüyle açılmalıdır.
- Hash zincirli denetim olayları değişiklik sürekliliğini destekler ancak salt okunur harici WORM kayıt veya dijital imza olmadığı için tek başına kurcalamaya dayanıklı resmi kayıt sayılmaz.
- SQLite ve teknik resimler uygulama seviyesinde şifrelenmez. Hassas üretim verileri için Windows hesap politikası, NTFS izinleri, BitLocker ve kurumsal uç nokta kontrolleri uygulanmalıdır.
- Merkezi sunucu, çok bilgisayarlı eşzamanlama, eşzamanlı ortak düzenleme ve otomatik çatışma birleştirme yoktur.
- Otomatik yedekleme/geri yükleme ekranı ve şema göç yönetimi henüz yoktur. Sürüm yükseltmeden önce tam yedek zorunludur.
- Teknik resimden ölçü, tolerans, malzeme veya kaplama otomatik OCR/CAD çıkarımı yapılmaz; bu değerler kullanıcı tarafından seçilir/girilir ve kullanıcı doğrulamasına tabidir.
- Yerel teknik resim deposu yalnızca PDF/PNG/JPG kabul eder.
- Kontrollü CAD çıktısı **DXF**'tir. Yerel/native DWG yazımı bu sürümde yoktur; DXF dosyasının CAD uygulamasında DWG'ye dönüştürülmesi ayrı ve doğrulanması gereken bir işlemdir.
- IATF 16949:2016 ve AIAG/VDA yaklaşımına göre alanlar, kalite kapıları ve doküman akışları bir **destek profili** sunar; bu profil yazılımın, kuruluşun veya üretilen dokümanın sertifikalı ya da otomatik olarak standarda uygun olduğunu kanıtlamaz. Şablonların müşteri özel şartları, güncel ve lisanslı AIAG/VDA yayınları, kurum prosedürleri ve yetkili kalite onayıyla doğrulanması gerekir.
- Hiçbir yazılım için “güvenlik açığı yoktur” garantisi verilemez. Release öncesinde bağımlılık taraması, Windows temiz makine testi, kötü amaçlı yazılım taraması, yetki testi ve düzenli yama süreci işletilmelidir.

Gerçek çok kullanıcılı üretim dağıtımından önce asgari kapanış maddeleri; Windows/kurumsal kimlik doğrulama, backend komutlarında rol yetkilendirmesi, elektronik onay imzaları, merkezi veya kontrollü immutable audit deposu, otomatik şifreli yedek, veri göçleri, Authenticode imzası ve temiz makine kabul testleridir.

# TYANA Q-FLOW 1.8.0 — Tam kapsamlı kolay kullanım ve 30 günlük cihaz sürümü

1.8.0 mühendislik kapsamını azaltmaz. Ürün kartı, çok seviyeli BOM, iş planı, makine, karakteristik, PFMEA, kontrol planı, proses akışı, operatör talimatı ve PPAP bağlantıları korunurken aşağıdaki hızlandırıcılar eklenmiştir:

- Ürün kimliği → malzeme kartları → BOM → iş planları → karakteristikler zincirini canlı denetleyen akıllı ürün kokpiti.
- Excel'den sekmeli veya noktalı virgüllü veri yapıştırarak toplu malzeme/ürün kartı oluşturma.
- Parça kütüphanesinden çoklu seçim, tek tık ve sürükle-bırak ile BOM satırı ekleme.
- Ürün grubu, ürün seviyesi ve üretim bağlamından 380 standart proses kartına dayalı akıllı rota önerisi.
- Başka bir mamul/yarı mamul kartının iş planını operasyon, makine ve kontrol işaretleriyle kontrollü kopyalama.
- Boş doküman numaralarını kuruluş kodundan türeten, girilmiş değerleri ezmeyen kod tamamlama.

Windows sürümü ilk çalıştırıldığı bilgisayara bağlanan **30 günlük tam özellikli kullanım** profiline sahiptir. Başlangıç ve son görülme zamanı hem uygulama veri dizininde hem kullanıcı kayıt defterinde bütünlük kontrollü tutulur. Cihaz uyuşmazlığı, imza bozulması veya sistem saatinin geri alınması veri, kütüphane ve çıktı komutlarını Rust katmanında kilitler. Sürenin dolması yerel veriyi silmez.

Üretim paketinde ayrı `app.js`, BOM/ürün çalışma zamanı dosyaları, ham mühendislik JSON kütüphaneleri ve kaynak haritaları dağıtılmaz. Arayüz tek küçültülmüş çalışma zamanı paketine dönüştürülür; mühendislik ve tohum kütüphaneleri sıkıştırılarak Rust ikilisine gömülür. Tauri geliştirme araçları kapalıdır ve genel dosya sistemi, kabuk, HTTP ile asset protocol yetkileri verilmez.

Bu koruma tersine mühendisliği ve sıradan dosya incelemesini zorlaştırır; hiçbir yerel masaüstü yazılımında kaynak/içerik erişiminin matematiksel olarak imkânsız olduğu garanti edilemez. Daha güçlü ticari lisans yönetimi için çevrimiçi aktivasyon, imzalı lisans sunucusu, kod imzalama, periyodik yetki yenileme ve kurumsal cihaz yönetimi gerekir.
# TYANA Q-FLOW 1.5.0 — Release notu

Bu sürümde 380 operasyonun tamamı standart proses kartı, makine sınıfı, kontrol planı, PFMEA ve operatör talimatı bağlantılarıyla seçilebilir hale getirilmiştir. Grup bazlı ana şablonlar kimlik alanlarını temizleyerek yeniden kullanılabilir; 33 belgeli makine sicil tohumu ve 34 makine sınıfı tesis doğrulamasına açıktır.

# TYANA Q-FLOW 1.7.0 — Ürün kartı, BOM ve görsel iş planı omurgası

1.7.0 sürümünde ürün tanımlama akışı üç net aşamaya ayrılmıştır: ürün kartları, sürükle-bırak çok seviyeli BOM ve her üretilen mamul/yarı mamul için ayrı iş planı. 380 standart operasyon kartı aranabilir ve sürüklenebilir; operasyonlar 77 makine/istasyon sicili ile uygunluk matrisi üzerinden bağlanır. İş planları ana doküman rotasına otomatik aktarılır ve sonraki kontrol planı, PFMEA ve operatör talimatı üretimine ortak veri sağlar.

# TYANA Q-FLOW 1.6.0 — Ürün tanımlama omurgası

- 77 makine kartı beş sınıfta SQLite makine siciline alındı; kartlar eklenebilir, düzenlenebilir, pasifleştirilebilir ve silinebilir.
- 380 standart operasyon ile makineler arasında çoktan çoğa uygunluk ilişkisi kuruldu. Tanımsız ilişkide aktif makineler gösterilir ve ilk doğrulanmış seçim uygunluk bilgisini öğrenir.
- Mamul, yarı mamul ve bileşen kartlarında sıralı operasyon rotası; makine seçimi ve § / <C> / <M> kontrol işaretleri ayrı ayrı yönetilir.
- Hammadde ve montaj malzemesi kartlarında gereksiz rota alanları kapatılır; BOM ile proses rotası birbirinden bağımsız tutulur.
- Parça kütüphanesi tür bazında gruplanır; ürün ağacına sürükle-bırak desteklenir. Kendine bağlama ve çevrim kontrolleri korunur.
- Parça rotaları proses akışı, PFMEA, kontrol planı ve operatör talimatı doküman zincirine aktarılır.
