# TYANA Q-FLOW PFMEA kaynak uyum raporu

Bu rapor `PFMEA/PFMEA` klasöründeki eğitim, boş form, örnek form, S-O-D ve AP tabloları ile Block/Boundary ve P-Diyagramı örneklerinin uygulama omurgasına nasıl aktarıldığını kaydeder. Kaynak dosyalardaki firma kimliği ve özel şablon markaları uygulama tenant kimliği olarak kullanılmamıştır.

## İncelenen kaynak grupları

- AIAG-VDA yaklaşımını anlatan eğitim PDF'i ve sonuç raporu örnekleri
- Boş ve doldurulmuş DFMEA çalışma kitapları
- Şiddet, olasılık, tespit edilebilirlik ve Action Priority referans tabloları
- Block/Boundary Diagram ve P-Diyagramı örnekleri

## Uygulamaya aktarılan yöntem omurgası

- Planlama ve hazırlıkta 5T: Intent, Timing, Team, Task, Tool
- Kontrollü antet: FMEA no, konu, kuruluş/saha, müşteri/program, başlangıç ve anahtar tarih, revizyon, sorumluluk ve gizlilik
- Üç seviyeli PFMEA yapı analizi: proses parçası/sistem, proses adımı/istasyon, proses çalışma öğesi
- Çalışma öğesi sınıfları: İnsan, Makine, Metot ve Malzeme
- Üç seviyeli fonksiyon analizi ve ölçülebilir ürün/proses karakteristiği bağlantısı
- Üç katmanlı hata etkisi: kuruluş sahası, sevk edilen saha ve son kullanıcı/araç
- Önleme ve tespit kontrollerinin ayrı kaydı
- S-O-D ve AP kararlarının gerekçe ve kontrollü tablo referansıyla saklanması
- Önlemeye ve tespite yönelik aksiyonların ayrı kaydı
- Sorumlu, hedef tarih, durum, fiili tamamlanma tarihi ve nesnel kanıt
- Aksiyon sonrası yeni S-O-D/AP, etkinlik gerekçesi ve gerekçeli risk kabul kaydı
- BOM, iş planı/operasyon, makine, özel karakteristik ve Kontrol Planı kimlik zinciri
- AIAG-VDA 7 adım için soru, karar, kanıt, sorumlu ve termin kütüğü
- Foundation FMEA, Family FMEA ve ürüne/prosese özel FMEA türetme profili

## Çıktı ve kalite kapıları

- PFMEA PDF: A3 yatay, kontrollü antet, risk renkleri, 10 okunabilir bilgi grubu ve 7 adım kanıt eki
- PFMEA Excel: 41 kolonlu ana form, 7 Adım Kanıtı, FMEA Profili ve İzlenebilirlik sayfaları
- Excel veri doğrulama listeleri: 4M, S-O-D, AP ve aksiyon durumu
- Excel baskı alanları, tekrarlanan başlıklar, donmuş bölmeler ve çok gizli kontrollü metadata sayfası
- Yüksek/orta AP için aksiyon, sorumlu ve termin kapısı
- Tamamlanan aksiyon için fiili tarih, kanıt ve yeniden S-O-D/AP kapısı
- Özel karakteristik için PFMEA–Kontrol Planı bağlantı kapısı
- Silinmiş iş planı adımına veya geçersiz BOM bileşenine bağlı risk için yayın engeli

## Kontrollü kullanım sınırı

Uygulama puanı veya AP'yi kendiliğinden tayin etmez. S-O-D ve AP değerleri yetkili çok disiplinli ekip tarafından kuruluşun kontrollü ve kullanım hakkı bulunan referans tablolarıyla seçilir. Uygulama, IATF 16949 veya AIAG-VDA sertifikası vermez; yöntem desteği, izlenebilirlik ve kanıt kapısı sağlar. Kuruluşun müşteri özel şartları, sembol sözlüğü, imza yetkileri ve lisanslı puan tabloları devreye alma sırasında ayrıca onaylanmalıdır.

## Doğrulama özeti

- 34 ortak FMEA denetim sorusu, 10 DFMEA özel sorusu ve 14 PFMEA özel sorusu
- 8 faz, 15 proses ailesi, 28 proses ve 40 seçilebilir PFMEA risk şablonu
- 380 standart operasyon kartı ve 77 makine/istasyon kaydıyla rota bağlantısı
- PDF üretme ve yeniden açma, Excel üretme ve yeniden açma, şema/satır/sütun/baskı alanı/metadata denetimi
- JavaScript, domain, kütüphane, güvenlik, worker, responsive ve marka regresyon testleri
