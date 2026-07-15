# TYANA Q-Flow 1.0.0 — Release doğrulama özeti

Doğrulama tarihi: 15 Temmuz 2026  
Hedef: Windows 10/11 x64 (`x86_64-pc-windows-msvc`)  
Paket: NSIS, kullanıcı bazlı kurulum, çevrimdışı WebView2 çalışma zamanı

## Üretilen paket

- Dosya: `TYANA-Q-Flow-1.0.0-x64-Setup.exe`
- Boyut: `209.554.159` bayt
- SHA-256: `95f41e65300a6b64e496ab4e9639dd948fd5395ce6712f1e0ec4f0fcee6eaf54`
- Dosya sürümü / ürün: `1.0.0` / `TYANA Q-Flow`
- Authenticode: `NotSigned`

SHA-256 dosya bütünlüğünü doğrular; yayıncı kimliğinin yerine geçmez. Kurumsal dağıtımdan önce TYANA adına geçerli bir Authenticode kod imzalama sertifikasıyla imzalama gerekir.

## Geçen kontroller

- Rust `cargo fmt`, `cargo check --locked`, `cargo clippy -D warnings`: başarılı
- Rust birim/veri testleri: `9/9` başarılı
- Worker/API smoke testi: kullanıcı, proje, optimistic concurrency, CSRF, audit ve CSP kontrolleri başarılı
- Çıktı smoke testi:
  - Kontrol planı XLSX: 11 satır, A3 baskı alanı, gizli metadata
  - Kontrol planı PDF: 32.923 bayt
  - Proses akışı PDF: 29.839 bayt
  - Operatör talimatı PDF: 28.530 bayt
  - PFMEA PDF: 41.876 bayt, A3 yatay, 14 sütun
  - DXF: 105 LINE, 91 TEXT, 5 katman
- `npm audit`: 0 bilinen güvenlik açığı
- RustSec `cargo audit`: 0 bilinen güvenlik açığı
- Windows hedef ağacında GTK/GLib bağımlılığı bulunmadığı ayrıca doğrulandı

## Gerçek kurulum kabul testi

- Installer sessiz kurulum çıkış kodu: `0`
- Kayıt defteri: `TYANA Q-Flow`, sürüm `1.0.0`, yayıncı `TYANA OTOMOTİV`
- Kurulum: `%LOCALAPPDATA%\TYANA Q-Flow\tyana-qflow-desktop.exe`
- Başlat menüsü: `TYANA OTOMOTİV\TYANA Q-Flow.lnk`
- Kurulu uygulama açılış smoke testi: başarılı; süreç erken kapanmadı
- Runtime SQLite `PRAGMA quick_check`: `ok`
- Tohum verisi: 19 proses, 1 kullanıcı, 1 aktif yerel kurulum sahibi

## Açık dağıtım sınırları

- Installer işlevsel fakat kurumsal sertifika sağlanmadığı için imzasızdır; Windows SmartScreen uyarısı oluşabilir.
- Kullanıcı profilleri doküman sorumluluk dizinidir. Gerçek parola oturumu, çok kullanıcılı RBAC veya elektronik imza değildir; güvenlik sınırı Windows kullanıcı profilidir.
- SQLite dosyası uygulama düzeyinde şifreli değildir; Windows profil ACL korumasına dayanır.
- Audit kaydı hash bağlantılıdır; harici imzalı/WORM kayıt değildir.
- CAD çıktısı DXF'dir. Native DWG motoru/lisansı bu release'e dâhil değildir.
- IATF 16949:2016 ve AIAG alan desteği, sertifikasyon veya otomatik uygunluk beyanı değildir.
