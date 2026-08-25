# TYANA Q-FLOW 1.16.0 — Release doğrulama kaydı

Doğrulama tarihi: 2 Ağustos 2026

- Ürün: **TYANA Q-FLOW**
- Profil: **Genel Kurulum Profili**; kuruluş, tesis, müşteri, logo ve antet kullanıcı tanımlıdır
- Hedef: Windows 10/11 x64 (`x86_64-pc-windows-msvc`)
- Mimari: Tauri 2 + Rust + Microsoft Edge WebView2
- Paket: NSIS, kullanıcı bazlı kurulum, çevrimdışı WebView2

## 1.16.0 kabul sonucu

- Ürün evreni: ana mamul/alt montaj/yarı mamul/iç üretim rotaları; hammadde, montaj malzemesi, ambalaj ve XD dış tedarik kartları iş plansız BOM girdisi.
- Boundary bağlantısı: sürükle-bırak ve tıklayarak kaynak → hedef ok bağlantısı; arama kutularında Esc temizleme/kapatma.
- Admin Merkezi: lisans özeti, kullanıcı/kütüphane/rehber sağlık aksiyonları ve denetim dışa aktarımı çalışır.
- Kalıcı lisans anahtarı: `TYANA-QFLOW-PERM-2026-EREN-ADMIN` ile cihaz yerelinde `permanent`, tam özellikli ve süresiz durum doğrulandı.
- 30 günlük deneme kilidi: anahtar girişi kilit ekranından da yapılabilir; lisans dosyası bütünlük ve saat geri alma koruması korunur.
- Native Rust testleri: **28/28 PASS**. Web/worker/export/admin statik ve çalışma zamanı testleri: **PASS**. Kurulu WebView2 CDP kabulü: Admin Merkezi, kullanıcı, kütüphane, rehber ve lisans yükseltme akışları **PASS**.
- Installer Authenticode: `NotSigned` / `unsigned`. Kurumsal dağıtımda imzalı sertifika kullanılmalıdır.
- PFMEA/DFMEA S×O×D göstergesi: S=8, O=3, D=1 girişiyle skor **24** olarak canlı güncellenir; eksik puanlarda `—` gösterilir ve AP'nin yerine geçmez.
- Operatör talimatı ekranı: numaralı görsel iş adımları, kalite/İSG notları, sayısal parametre şeridi ve reaksiyon planı kartları okunabilir düzende gösterilir.
- Kurulu canlı UX kabulü: fiziksel Escape/Esc komut paletini, drawer'ı ve arama alanını kapatır; fiziksel Ctrl+K komut paletini açar; talimat görsel testi **PASS**.

## Paket doğrulama

### 1.16.0 yayın paketi

- Installer: `release-desktop\TYANA-Q-Flow-1.16.0-x64-Setup.exe`
- Boyut: `216.006.449` bayt
- SHA-256: `99bade401f85f0f03812c67704dd149d84c9528bccf165faa1a183ad6a51c310`
- Kurulum kabulü: çıkış kodu `0`; kurulu WebView2 CDP kabulü **PASS** (Admin, durum, ürün evreni yükseltmesi).
- Authenticode: `NotSigned` / `unsigned`; kurumsal dağıtım öncesi yayıncı sertifikasıyla imzalanmalıdır.

Doğrulama tarihi: 18 Temmuz 2026

- Ürün: **TYANA Q-FLOW**
- Profil: **Genel Kurulum Profili**; kuruluş, tesis, müşteri, logo ve antet kullanıcı tanımlıdır
- Hedef: Windows 10/11 x64 (`x86_64-pc-windows-msvc`)
- Mimari: Tauri 2 + Rust + Microsoft Edge WebView2
- Paket: NSIS, kullanıcı bazlı kurulum, çevrimdışı WebView2

## Release adayı

- Installer: `release-desktop\TYANA-Q-Flow-1.4.0-x64-Setup.exe`
- Boyut: `209.944.981` bayt
- SHA-256: `fdc9de0ad37bbd30002aeefe988e95023c170111c66a7c84fe64a9a4c53b6772`
- Authenticode: `NotSigned` / `unsigned`
- Kurulum kabulü: çıkış kodu `0`; kurulu uygulama FileVersion `1.4.0`, ProductName `TYANA Q-FLOW`
- Windows Defender özel taraması: imza `1.455.200.0`, installer için tehdit eşleşmesi `0`

Bu paket yerel kabulden geçmiş, kurulabilir bir **release adayıdır**. Kurumsal Authenticode imzası ve ayrı temiz Windows 10/11 pilotu tamamlanmadan kurum geneli üretim onaylı olarak sunulmamalıdır.

## İşlevsel kapsam

- Kuruluştan bağımsız TYANA Q-FLOW marka ve tenant yapısı; runtime/build/release dosyalarında eski kuruma özel marka koruması.
- Ayrı **OEM No** ve **kuruluş içi ERP/SAP stok kodu**; yazılabilir kullanıcı tanımlı ürün tipi; isteğe bağlı ürün ailesi.
- Önce malzeme kartı, sonra revizyonlu/alternatifli çok seviyeli BOM oluşturma; alt montaj ve alt BOM, geçerlilik, tam yol, make/buy ve yeniden kullanım.
- BOM satırından operasyon kodunu rotaya bağlama; aktif BOM revizyonu/alternatifi için açık seçim ve tam izlenebilirlik.
- 380 benzersiz TR/EN operasyon kodu; 373 sayısal, 7 alfasayısal kayıt; 55 uzman inceleme işaretli satır ve 16 belirsizlik grubu.
- Ürün grubuna bağlı proses omurgaları, sürükle-bırak rota, PFMEA hızlı risk seçimi, kontrol planı, operatör talimatı, PPAP 18 unsur desteği.
- PDF, XLSX ve geçerli ASCII DXF R12 dışa aktarımı; Windows kayıt diyaloğu, içerik imzası, boyut sınırı ve atomik dosya yazımı.

## Otomatik test kapıları

`npm.cmd run test:all` sonucu: **PASS**.

- Platform adaptörü, ham byte IPC, iptal ve dosya imza kapıları.
- PPAP Level 1–5 gönder/sakla matrisi ve 18 unsur hazır olma kapsamı.
- Ürün kimliği, kullanıcı tanımlı tip, OEM/ERP ayrımı ve snapshot kalıcılığı.
- BOM 2.0: 3 seviye, çevrim/ebeveyn/pozisyon denetimi, aktif revizyon/alternatif, exact-one alternatif, rota bağlama, kontrollü onay ve eski snapshot göçü.
- Ürün mühendisliği: 13 ürün grubu, 21 soru seti, 133 soru, 44 sayısal alan.
- PFMEA: 8 faz, 15 aile, 28 proses ve 40 risk şablonu.
- Kaynak kalite paketi: 2 kontrol planı, 10 operatör talimatı/preseti, 54 karakteristik, 14 doğrulama kuralı.
- Operasyon kütüphanesi: 380/380 benzersiz TR/EN kod.
- Worker/API: kimlik gereksinimi, CSRF, optimistic concurrency, audit ve CSP.
- Genel marka koruması: 100 runtime/build/release dosyası tarandı; kaynak referans klasörü kapsam dışıdır.
- Responsive BOM düzeni ve dört kolonlu masaüstü tabanı.

Rust kapıları:

- `cargo fmt --check`: **PASS**
- Kilitli release derlemesi: `Cargo.lock` ile **PASS**
- `cargo test --locked`: **19/19 PASS**
- `npm audit --omit=dev --audit-level=high`: bilinen açık `0`

## Dosya çıktısı doğrulaması

Fixture tabanlı dosya QA:

| Çıktı | Sonuç |
|---|---:|
| Kontrol Planı PDF | 36.301 bayt, 1 sayfa |
| PFMEA PDF | 51.989 bayt, 2 sayfa |
| Proses Akışı PDF | 42.635 bayt, 2 sayfa |
| 32 adımlı stres Proses Akışı PDF | 87.732 bayt, 6 sayfa |
| Operatör Talimatı PDF | 31.982 bayt, 1 sayfa |
| Kontrol Planı XLSX | 17.988 bayt, 5 sayfa; 4 görünür + metadata `veryHidden`; 41 BOM sütunu; formül/hata `0` |
| Proses Akışı DXF | 7.769 bayt; 62 çizgi, 63 metin, 5 katman |

PDF görsel/yapısal QA: 5 dosya ve 12 sayfada gömülü font, çıkarılabilir metin, doğru A3/A4 yönü, ardışık sayfa numarası; sayfa dışına taşan karakter, kırpılma, çakışma ve bozuk replacement karakteri `0`.

## Gerçek Windows masaüstü kabulü

Ham release uygulamasında 11 çıktı türü gerçek **Farklı Kaydet** penceresi ve Rust atomik yazım sonucu ile diske kaydedildi:

- Doğrudan DXF/XLSX köprü testleri
- 41 sütunlu kontrol planı XLSX
- 34 ana proses kartı XLSX
- 380 TR/EN operasyon kodu XLSX
- Kontrol planı, PFMEA ve proses akışı PDF
- Tek operatör talimatı ve 25 talimatlık toplu PDF
- Proses akışı DXF

Kurulu `1.4.0` uygulamada kritik sekiz çıktı yeniden kabul edildi:

| Çıktı | Kurulu uygulama sonucu |
|---|---:|
| Kontrol Planı XLSX | 28.679 bayt; 5 sayfa, 4 görünür; BOM 41 sütun |
| 380 Kod XLSX | 26.504 bayt; 383 satır, 380 benzersiz kod |
| Kontrol Planı PDF | 34.232 bayt, 1 sayfa |
| PFMEA PDF | 77.956 bayt, 2 sayfa |
| Proses Akışı PDF | 86.781 bayt, 5 sayfa: 3 A3 dikey akış + 2 A3 yatay matris |
| Tek Operatör Talimatı PDF | 33.787 bayt, 1 sayfa |
| 25 Operatör Talimatı PDF | 284.765 bayt, 25 sayfa |
| Proses Akışı DXF | 18.570 bayt |

Native kabul modelinde 25 seçili prosesin 25’i de rotaya çözüldü; eksik proses kimliği `0`. Üretilen PDF’lerde sayfa dışı metin kutusu, kırpılma ve eski kuruma özel marka eşleşmesi `0`.

Yerel SQLite salt okunur kabulü:

```json
{"quick_check":"ok","processes":34,"projects":1,"users":1,"active_admins":1,"audit_events":2}
```

## Güvenlik ve dağıtım sınırları

- CSP harici scriptleri sınırlar; shell, genel dosya sistemi, HTTP ve asset protocol yetkileri açılmamıştır.
- Tauri kullanılmayan komutları release paketinden kaldırır; renderer Node.js veya Electron yetkisine sahip değildir.
- Paket **imzasızdır**. SHA-256 bütünlüğü doğrular fakat yayıncı kimliğini kanıtlamaz; SmartScreen uyarısı görülebilir.
- Kullanıcı/rol kayıtları iş akışı sorumluluklarıdır; merkezi kimlik, tam RBAC, e-imza, değiştirilemez merkezi audit veya otomatik şifreli yedek değildir.
- Yerel SQLite ve teknik resimler uygulama seviyesinde şifrelenmez; BitLocker, NTFS ve kurumsal uç nokta politikaları uygulanmalıdır.
- Native DWG yazıcısı yoktur. CAD değişim çıktısı geçerli DXF R12’dir; DWG için lisanslı ODA/RealDWG entegrasyonu gerekir.

## Kurum geneli dağıtım öncesi kalan kapılar

1. Geçerli kurumsal Authenticode sertifikasıyla zaman damgalı imza; imza sonrası hash ve manifestin yeniden üretilmesi.
2. Temiz Windows 10 ve Windows 11 x64 pilotlarında çevrimdışı kurulum, ilk açılış, yedek/geri yükleme ve kaldırma testi.
3. Kurumsal EDR/uygulama beyaz liste kabulü.
4. Çok kullanıcılı merkezi kullanım isteniyorsa gerçek kimlik doğrulama, RBAC, e-imza, merkezi audit ve yedekleme mimarisi.

## IATF/AIAG kapsam açıklaması

TYANA Q-FLOW; IATF 16949:2016, AIAG/VDA FMEA, APQP, Control Plan ve PPAP çalışmalarını destekleyen alanlar, kalite kapıları ve doküman zinciri sunar. Yazılımın veya çıktının tek başına sertifikalı ya da otomatik olarak uygun olduğu anlamına gelmez. Güncel lisanslı yayınlar, müşteri özel şartları, teknik resim, kurum prosedürleri ve yetkili kalite onayıyla doğrulama sorumluluğu kullanıcı kuruluştadır.
# TYANA Q-FLOW 1.5.0 — Release doğrulama eki

- 380/380 operasyon standart proses kartı üretildi; 34 makine sınıfı ve 33 kaynaklı makine sicil tohumu kütüphaneye alındı.
- Ürün tanımlama yalnızca boş başlangıçla çalışır; dört ürün seviyesi, açık proses rotası ve grup bazlı revizyonlu ana şablon kapıları aktiftir.
- Tüm statik/domain/PDF/XLSX/DXF/worker kontrolleri 1.5.0 kaynak ağacında başarıyla geçti.

# TYANA Q-FLOW 1.7.0 — Görsel iş planı doğrulama eki

- Ürün kartı → sürükle-bırak BOM → kart bazlı iş planı sırası doğrulandı.
- 380 operasyon kartının arama, aile filtresi, tıklama ve sürükle-bırak akışları doğrulandı.
- Mamul, yarı mamul, alt montaj ve iç üretim parçalarının ayrı rotaları doğrulandı.
- Makine seçiminde arama, çoklu seçim, uygunluk filtresi ve ana doküman rotasına aktarım doğrulandı.
- Zorunlu mamul/yarı mamul rotalarında eksik operasyon veya makine kalite kapısı doğrulandı.

# TYANA Q-FLOW 1.6.0 — Ürün tanımlama doğrulama eki

- Makine tohumu: **77/77**, makine türü: **5/5**, operasyon kataloğu: **380/380**.
- SQLite tabloları: `machines` ve `operation_machine_eligibility`; kalıcı silme ve ilk seçimden uygunluk öğrenme kapıları aktiftir.
- Mamul kartı rotası → operasyon → uygun makine → ana doküman rotası zinciri statik sözleşme ve Rust birim testleriyle doğrulandı.
- Rust: **21/21 PASS**. Tam uygulama paketi: platform, PPAP, ürün kimliği, ürün tanımlama, operasyon kataloğu, ana şablon, BOM, kütüphane, PDF/XLSX/DXF, worker ve release güvenlik kontrolleri **PASS**.
- Fixture çıktıları: kontrol planı PDF 1 sayfa, PFMEA PDF 2 sayfa, proses akışı PDF 2 sayfa, uzun proses akışı PDF 6 sayfa, operatör talimatı PDF 1 sayfa; XLSX 5 sayfa ve DXF 5 katman.
- Derlenen Tauri uygulaması gerçek WebView2 çalışma zamanında açıldı; masaüstü köprüsü, 380 operasyon, 77 makine, 5 makine türü, PDF/XLSX motorları ve mühendislik kütüphaneleri **PASS**. Ayrı Chrome/Edge görsel etkileşim testi kurumsal hata ayıklama portu politikası nedeniyle koşturulamadı; test dosyası release kabul bilgisayarında çalıştırılmak üzere projede tutulur.

# TYANA Q-FLOW 1.8.0 — Ürün kokpiti, lisans ve paket koruma doğrulaması

- Tam kapsamlı ürün kokpiti, toplu kart açma, BOM çoklu seçim, akıllı rota önerisi ve kontrollü iş planı kopyası statik sözleşme testinden geçti.
- 30 günlük cihaz lisansı; 30. gün bitişi, kayıt bütünlüğü değişikliği, cihaz uyuşmazlığı ve saat geri alma senaryolarıyla Rust birim testinde doğrulandı.
- Tüm veri, makine, proje, kullanıcı, ana şablon, teknik resim, kütüphane ve PDF/XLSX/DXF kaydetme komutlarının lisans kapısı arkasında olduğu doğrulandı.
- Masaüstü varlık paketinde ayrı uygulama kaynak dosyası, ham mühendislik JSON'u ve source map bulunmadığı doğrulandı.
- Rust: **26/26 PASS**.
- Platform, PPAP, ürün kimliği, ürün tanımlama, 380 operasyon, 77 makine, ana şablon, BOM, kütüphane, PDF/XLSX/DXF, worker, responsive ve genel marka testlerinin tamamı **PASS**.

# TYANA Q-FLOW 1.9.0 — Kolaylaştırılmış tam kapsam ve APQP kanıt zinciri

- Ürün tanımlama ekranı özgün TYANA görsel diliyle daha geniş, numaralı ve odaklı bir mühendislik çalışma alanına yükseltildi; alan veya kalite kapısı kaldırılmadı.
- Malzeme kartını ana mamul/yarı mamul/iç üretim kartına bırakarak hedef alt BOM açma ve satır ekleme doğrulandı.
- 380 operasyon kartını iş planının sonuna veya belirli operasyonun önüne sürükleyerek bırakma destekleniyor.
- VOC → QFD → Boundary/P-Diyagramı → DFMEA/DVP&R → proses → PFMEA → Kontrol Planı → iş talimatı çalışma zinciri eklendi.
- Teknik resim karakteristiklerinden QFD başlangıç matrisi üretme, satır düzenleme, kopyalama, silme, sıralama ve snapshot geri yükleme sözleşmeleri eklendi.
- Foundation/Family/ürüne özel FMEA ve AP/miras RPN profil seçimleri proje snapshot'ında saklanıyor.
- Statik APQP sözleşmesi, bütün uygulama test paketi ve Rust lisans/veri katmanı testleri **PASS**.
- 30 günlük cihaz bağlı tam özellikli lisans ilk açılıştan itibaren devam eder; sürüm yükseltmesi mevcut cihazın deneme başlangıç tarihini sıfırlamaz.
- Tam JavaScript/çıktı/worker/responsive/marka test paketi **PASS**; Rust veri ve lisans katmanı **26/26 PASS**.
- Gerçek release ve kurulu NSIS uygulaması WebView2 üzerinde açıldı: **380 operasyon**, **77 makine**, **5 makine türü**, **21 ürün soru seti**, **40 PFMEA riski**, PDF ve Excel motorları **PASS**.
- Native ürün yükseltme kabulünde 3 ürün kartı, 2 ana BOM satırı, sürükle-bırakla oluşturulan 1 alt BOM satırı, 17 operasyonlu akıllı rota ve kontrollü kopya, 11 düğümlü APQP kanıt zinciri **PASS**.
- Kurulu uygulama sürümü: **1.9.0**. Kurulum paketi: **210.083.527 bayt**; SHA-256: `891013d1b0347608f25844d150354753872373de7a892cc070fee0d8be5e9dda`.
- Kurulum paketi çevrimdışı WebView2 bileşenini içerir ve **imzasızdır**; kurumsal dağıtım öncesi Authenticode imzası kalite kapısı olarak kalır.

# TYANA Q-FLOW 1.12.1 — Kolay BOM oluşturma ve rehberli PFMEA puanlama

- Ürün ağacı parça kütüphanesine açık **seçili üst karta bırak** alanı eklendi. Sürükle-bırak, tek tıkla işaretleme, toplu ekleme, çift tıklama ve `+` ile hızlı ekleme aynı kontrollü BOM fonksiyonuna bağlandı.
- BOM satırı ekleme/kaldırma işlemlerinin ardından ekran anında yenilenir; veri kaydolduğu hâlde kullanıcının eski görünümü görmesine neden olan yeniden çizim açığı kapatıldı.
- Dar sol panelde flu/taşmış görünen toplu ekleme düğmesini etkileyen geniş kapsamlı CSS seçicisi ayrıştırıldı. Düğme artık seçili kart sayısını gösterir, metni kırpmaz ve 560 px altında tam genişliğe iner.
- PFMEA için **Şiddet, Oluşma ve Tespit** boyutlarında ayrı 1–10 kriter kartları, karar sorusu, nesnel gerekçe ve kontrollü tablo referansı zorunluluğu eklendi.
- Kullanıcı kaynak kriterini seçtiğinde puan ve gerekçe risk satırına izlenebilir biçimde yazılır. Aksiyon sonrası S/O/T değerlendirmesi de aynı rehberi kullanır.
- Sağlanan AP tablosu veri güdümlü matrise dönüştürüldü; **1.000 S/O/T kombinasyonunun tamamı** H/M/L önerisi üretir. Öneri otomatik hüküm değildir; ekip isterse ayrıca onaylayarak uygular. RPN yalnız bilgi göstergesidir.
- Kaynak listesi kuruluş kontrollü eğitim PDF, şiddet, olasılık, tespit ve AP dosyalarıyla ilişkilendirildi; eski kuruluş markası ürün kütüphanesine taşınmadı.
- Tam JavaScript, domain, kütüphane, PDF/XLSX/DXF, worker, responsive, marka ve release koruma test paketi **PASS**.
- Gerçek Tauri/WebView2 kabulünde 3 kartlı iki seviyeli BOM, okunabilir toplu ekleme düğmesi, açık bırakma alanı, 10+10+10 puan kriteri, AP matris örnekleri ve rehberden S=8/gerekçe/referans kaydı **PASS**.
- Rust veri, cihaz bağlı 30 günlük lisans, saat geri alma koruması, atomik çıktı ve gömülü varlık testleri **26/26 PASS**.
- Kurulum paketi: **210.113.392 bayt**; SHA-256: `68621120cb61fd8e390f6b8cfdb0d7ea948bb00855960d81f7ab4b8140a2f253`.
- Paket çevrimdışı WebView2 içerir; Authenticode durumu **NotSigned**. Kurumsal dağıtım öncesi kod imzası açık release kalite kapısıdır.

# TYANA Q-FLOW 1.14.0 — Akıllı kullanıcı rehberi ve hata önleyici iş akışı

- Ürün kimliğinden kontrollü PPAP yayınına kadar **13 kapılı** veri güdümlü yol haritası eklendi. Hazır, sıradaki, kısmen tamam ve ön koşul bekleyen durumlar gerçek proje verisinden hesaplanır.
- Her ekranda bağlama duyarlı “Bu sayfada” açıklaması ve üç uygulama kuralı gösterilir; kullanıcı ilk açık bulgudan doğrudan doğru modüle, alt aşamaya ve giriş alanına taşınır.
- Masaüstü üst çubuğu sürekli hazırlık yüzdesini, sıradaki doğru işi ve ilk bloke bulguyu gösterir. Sağ yardım çekmecesi A’dan Z’ye bütün dokümantasyon zincirini tek görünümde sunar.
- Üst arama alanı ve `Ctrl+K`, ürün, BOM, iş planı, proses akışı, DFMEA/PFMEA, Kontrol Planı, operatör talimatı, PPAP ve kayıt işlemlerini açan hızlı komut paletine dönüştürüldü.
- Boş ürün başlangıcındaki yer tutucu karakteristik artık yanlışlıkla hazır sayılmaz. Hazırlık için geçerli tolerans, rota bağlantısı, teknik kaynak doğrulaması, cihaz/metot, MSA ve kalibrasyon kanıtı birlikte aranır.
- Gerçek Chrome kabulünde 13/13 aşama, yardım çekmecesi, doğru ilk aksiyon, BOM alt aşamasına yönlendirme, `Ctrl+K` ve PFMEA komut geçişi, erişilebilirlik durumları ve sıfır yatay taşma **PASS**.
- Tam JavaScript/domain/kütüphane/PDF-XLSX-DXF/worker/responsive/marka test paketi **PASS**; Rust veri, BOM, lisans, çizim bütünlüğü ve atomik çıktı testleri **26/26 PASS**.
- Gerçek Tauri/WebView2 kabulünde 34 proses, 380 TR/EN operasyon, 77 makine, 30 günlük cihaz bağlı tam deneme, 13 rehber aşaması ve yönlendirme çalışma zamanı **PASS**. Tam ürün yükseltme senaryosunda 3 kartlı/alt BOM’lu yapı, 17 operasyonlu rota, S-O-D rehberi, Boundary/P-Diyagramı %100 ve DFMEA/PFMEA kanıt omurgası yeniden doğrulandı.
- NSIS sessiz kurulum çıkış kodu **0**; kurulu uygulama ProductVersion/FileVersion **1.14.0**. Kurulu uygulamanın WebView2 kabulünde Akıllı Rehber 13 aşamayla yüklendi ve tam ürün yükseltme senaryosu ikinci kez **PASS** verdi.
- Kurulum paketi: **216.000.623 bayt**; SHA-256: `451f08d5287e2c0ffefdb0973378feb1069a980f6797945cf3c9f2891090b887`.
- Paket çevrimdışı WebView2 içerir; kaynak haritası ve DevTools kapalıdır, runtime küçültülmüştür, mühendislik kütüphaneleri native ikiliye gömülüdür. Authenticode durumu **NotSigned**; kurumsal dağıtım öncesi kod imzası açık release kalite kapısıdır.

# TYANA Q-FLOW 1.13.0 — Boundary ve P-Diyagramı tasarım analiz stüdyosu

- APQP kanıt zincirindeki Boundary ve P-Diyagramı aşamaları yalnız doküman referansı olmaktan çıkarıldı; ayrı, kalıcı ve düzenlenebilir mühendislik çalışma yüzeylerine dönüştürüldü.
- Boundary editörü ürün ağacından sınır içi öğeleri başlatır; sınır dışı komşu sistem/aktörleri ve kaynak-hedef yönlü fiziksel bağlantı, malzeme, enerji, sinyal, boşluk, insan/servis ve çevre arayüzlerini kaydeder.
- P-Diyagramı editörü ideal fonksiyon, girdi sinyali, kontrol faktörü, istenen/istenmeyen çıktı, fonksiyonel gereklilik, fonksiyonel olmayan kısıt ve DVP&R doğrulama yöntemini ayrı veri alanlarında yönetir.
- Kaynak P-Diyagramı şablonundaki beş gürültü ailesi - parçadan parçaya, zamanla değişim, müşteri kullanımı, harici ortam ve sistem etkileşimi - seçilebilir kartlar olarak eklendi.
- APQP snapshot şeması **2.0.0** oldu. Eski snapshot satırları korunur; yeni Boundary/P-Diyagramı doküman numaraları izlenebilirlik satırlarına otomatik bağlanır.
- Boundary ve P-Diyagramı tamlık göstergeleri içerik tabanlıdır. Doküman numarası yazmak tek başına aşamayı tamamlanmış göstermez; sistem öğesi/arayüz ve fonksiyon/girdi/gürültü/kontrol/çıktı kanıtları aranır.
- İki sayfalı A4 yatay **Boundary + P-Diyagramı PDF** üretimi eklendi. Gerçek tarayıcı çıktısı **28.411 bayt / 2 sayfa** olarak yeniden açıldı ve iki sayfa görsel olarak kontrol edildi.
- Gerçek tarayıcı kabulünde iki modül %100 tamlık, beş gürültü etkeni, bir sınır arayüzü, otomatik doküman referansı ve sıfır yatay taşma ile **PASS**.
- Tam JavaScript/domain/kütüphane/PDF-XLSX-DXF/worker/responsive/marka test paketi **PASS**; Rust veri, lisans ve atomik çıktı testleri **26/26 PASS**.
- Gerçek Tauri/WebView2 kabulünde 30 günlük cihaz bağlı tam deneme, APQP şema 2.0.0, iki iç öğe, bir dış öğe, bir Boundary arayüzü, beş P-Diyagramı gürültü etkeni ve iki modülde %100 tamlık **PASS**.
- Kurulum paketi: **210.123.436 bayt**; SHA-256: `c71741bc7219aa6406dfa92bd691a6230e1d08460208f2548cef768af6a93be2`.
- Paket çevrimdışı WebView2 içerir; Authenticode durumu **NotSigned**. Kurumsal dağıtım öncesi kod imzası açık release kalite kapısıdır.

# TYANA Q-FLOW 1.12.0 — Kaynak temelli PFMEA yöntem ve çıktı yükseltmesi

- `PFMEA/PFMEA` klasöründeki eğitim PDF'i, boş/dolu DFMEA formları, S-O-D/AP tabloları, Block/Boundary ve P-Diyagramı örnekleri yöntem ve çıktı açısından incelendi. Kaynak firma kimliği tenant markası olarak kullanılmadı.
- FMEA profil şeması **1.2.0** oldu. 5T planlama, kontrollü antet, yapı/fonksiyon analizi, puan tablosu ve sonuç raporu referansları eklendi.
- PFMEA satırı üç seviyeli yapı ve fonksiyon zinciri, İnsan–Makine–Metot–Malzeme çalışma öğesi, kuruluş/sevk sahası/son kullanıcı etki katmanları, ayrı önleme/tespit aksiyonları, fiili tamamlanma ve aksiyon sonrası S-O-D/AP içerir.
- Denetim omurgası **34 ortak**, **10 DFMEA özel** ve **14 PFMEA özel** soruyu kanıt, sorumlu ve terminle yönetir.
- Yüksek/orta AP; aksiyon, sorumlu ve termin olmadan; tamamlanan satır ise fiili tarih, etkinlik kanıtı ve yeniden S-O-D/AP olmadan yayımlanamaz.
- PFMEA PDF A3 yatay, 10 okunabilir bilgi grubu ve 7 adım kanıt ekiyle üretildi. Fixture çıktısı **65.860 bayt / 3 sayfa**; gerçek native çıktı **115.853 bayt / 5 A3 yatay sayfa** olarak yeniden açıldı ve görsel kontrol edildi.
- Yeni PFMEA Excel çıktısı 41 kolonlu `PFMEA Formu`, `7 Adım Kanıtı`, `FMEA Profili`, `İzlenebilirlik` ve çok gizli `_TYANA_METADATA` sayfalarını içerir. Fixture dosyası **19.493 bayt**, gerçek native dosya **29.045 bayt**; 5 sayfa, 4 görünür sayfa, 33 satır, 41 kolon ve `A1:AO33` baskı alanıyla yeniden açılarak doğrulandı.
- JavaScript/domain/kütüphane/güvenlik/worker/responsive/marka ve PDF-XLSX-DXF test paketi **PASS**. Rust veri, lisans, atomik çıktı, teknik resim bütünlüğü ve BOM doğrulama katmanı **26/26 PASS**.
- Gerçek Tauri/WebView2 kabulünde PFMEA PDF ve PFMEA Excel, Windows Kaydet diyaloğu üzerinden Rust atomik yazım yoluyla kaydedildi; uygulama sürümü **1.12.0** olarak doğrulandı.
- Kurulum paketi: **210.106.303 bayt**; SHA-256: `e1c07ef7eb42ad589db57cff27b018fa55242f7227b94c65322d419c5f9c26d4`.
- Paket çevrimdışı WebView2 içerir; 30 günlük cihaz bağlı tam deneme, saat geri alma koruması, çift yerel ankraj, kapalı DevTools, kaynak haritasız küçültülmüş runtime ve native ikiliye gömülü mühendislik kütüphaneleri manifestte doğrulandı.
- Authenticode durumu **NotSigned**. Kurumsal dağıtım öncesi kod imzası açık release kalite kapısıdır.

# TYANA Q-FLOW 1.11.0 — Denetim kanıtı ve kontrollü dokümantasyon kapıları

- DFMEA/PFMEA profil kayıtlarına kapsam, uygulanabilirlik ve gerekçesi, öğrenilmiş ders kaynağı ile ekip/CSR kanıt alanları eklendi.
- DFMEA satırlarında risk gerekçesi; aksiyon sahibi, termin ve tamamlanma tarihi; aksiyon sonrası S-O-D/AP, sonuç gerekçesi ve etkinlik kanıtı birlikte saklanır.
- FMEA snapshot şeması **1.1.0** olarak yükseltildi; 33 DFMEA ve 35 PFMEA sorusunun soru metni, yanıtı, kanıtı, sorumlusu ve termini kontrollü snapshot içinde taşınır.
- Kontrollü yayımlama kapısı DFMEA, PFMEA ve FMEA yönetişim bulgularını kapsar. AP/risk gerekçesi, özel karakteristik–DVP&R bağı ve yüksek/orta öncelikli aksiyon kayıtları eksikse yayın bloke edilir.
- Ürün kimliği, teknik resim/hash, çok seviyeli BOM, teknik soru kayıtları, iş planı/makine, DFMEA, PFMEA, Kontrol Planı/MSA, operatör talimatı ve PPAP unsurları **10 çapraz doküman kalite kapısında** denetlenir.
- Yeni **DFMEA A3 PDF** çıktısı yapı–fonksiyon–hata–risk–optimizasyon zincirini ve AIAG-VDA 7 adım kanıt ekini taşır.
- Yeni **Dokümantasyon Denetim Kanıt PDF** çıktısı kalite kapılarını, bloke bulguları ve FMEA kanıt ekini kontrollü antetle sunar.
- Arayüzde FMEA soru, kanıt ve aksiyon alanlarının okunabilirliği artırıldı; Power BI sınıfı denetim özeti PPAP merkezine eklendi.
- Tam JavaScript, domain, kütüphane, güvenlik, PDF/XLSX/DXF, worker, responsive ve marka regresyon paketi **PASS**.
- Fixture çıktıları: Kontrol Planı PDF **1 sayfa**, DFMEA PDF **2 sayfa**, PFMEA PDF **2 sayfa**, Dokümantasyon Denetim Kanıt PDF **2 sayfa**, proses akışı PDF **2 sayfa**, uzun proses akışı PDF **6 sayfa**, operatör talimatı PDF **1 sayfa**; XLSX **5 çalışma sayfası**, DXF **5 katman**. Excel’in 41 sütunlu ayrıntılı BOM baskısı veri kaybetmeden iki A3 yatay sayfaya bölündü; kimlik sütunları ve başlıklar tekrar eder.
- Rust veri, lisans, atomik çıktı, teknik resim bütünlüğü ve BOM doğrulama katmanı **26/26 PASS**.
- Kurulum paketi: **210.099.103 bayt**; SHA-256: `6eac9b04731b2717563fbb2ad8dde7dff9542ada6543e2c4d5014aaa63a456e5`.
- Kurulum paketi çevrimdışı WebView2 bileşenini içerir ve **imzasızdır**; kurumsal dağıtım öncesi Authenticode kod imzası açık release kalite kapısıdır.

# TYANA Q-FLOW 1.10.0 — Bağımsız ürün modülleri ve FMEA denetim omurgası

- Ürün Kartları, Ürün Ağaçları ve İş Planları ayrı ana menü ve çalışma yüzeylerine ayrıldı; ortak ana veri kimlikleri, revizyonlar ve downstream doküman bağlantıları korunur.
- Ürün Kartları modülü ana mamul ile bütün alt ürün/malzeme ana verilerini yönetir; BOM miktarı Ürün Ağaçları, operasyon sırası ve makine ataması İş Planları modülünde tutulur.
- Teknik detay panelini kapatan gereksiz tam editör yeniden çizimi kaldırıldı; açık/kapalı durum kart bazında korunur.
- BOM ve iş planı sürükle-bırak işlemleri WebView2 veri türü yanında uygulama içi yedek taşıma kimliği, belirgin bırakma alanı, tıklama/çift tıklama ve toplu ekleme yollarıyla güçlendirildi.
- DFMEA için yapı–fonksiyon–hata–risk–optimizasyon satırları; üst/odak/alt eleman, etki–mod–neden, S-O-D/AP, DVP&R, özel karakteristik, aksiyon ve etkinlik kanıtı alanları eklendi.
- DFMEA için **33**, PFMEA için **35** denetim sorusu; AIAG-VDA 7 adım, Foundation/Family/ürüne özel türetme, kapsam, CSR, ekip, kanıt, sorumlu ve termin kayıtlarıyla sunulur.
- AP kullanıcı/ekip kararı olarak bırakılır; S×O×D yalnız tanısal gösterge olarak sunulur ve lisanslı AP tablosunun yerine geçmez.
- Tam JavaScript, çıktı, worker, responsive, marka ve release koruma test paketi **PASS**; Rust veri/lisans katmanı **26/26 PASS**.
- Kurulu NSIS uygulaması WebView2 üzerinde açılarak doğrulandı: **380 operasyon**, **78 makine**, **5 makine türü**, PDF/XLSX motorları, 30 günlük cihaz bağlı tam sürüm lisans ve bağımsız modül geçişleri **PASS**.
- Native ürün kabulünde 3 ürün kartı, 2 ana BOM satırı, sürükle-bırakla 1 alt BOM satırı, 17 operasyonlu akıllı rota ve kontrollü kopya, açık kalan teknik detay paneli, 11 düğümlü APQP zinciri, 33 DFMEA ve 35 PFMEA denetim sorusu **PASS**.
- Kurulu uygulama sürümü: **1.10.0**. Kurulum paketi: **210.094.659 bayt**; SHA-256: `410f76f8635065a03110b71daaf881080937b658f5c21768cc77837cd9141059`.
- Kurulum paketi çevrimdışı WebView2 bileşenini içerir ve **imzasızdır**; kurumsal dağıtım öncesi Authenticode imzası kalite kapısı olarak kalır.
