# TYANA OTOMOTİV masaüstü iskeleti

Bu dizin Tauri 2 tabanlı Windows masaüstü kabuğunu hazırlar. Web arayüzü aynı kaynaklardan gelir; `desktop-build.mjs` yalnızca gerekli statik dosyaları `desktop-dist/` klasörüne kopyalar, `platform-adapter.js` dosyasını masaüstü kopyasına ekler ve her dosya için SHA-256 manifesti üretir.

## Uygulama entegrasyonu

PDFMake için `download()` yerine Blob oluşturup ortak adaptörü çağırın:

```js
const pdfBlob = await new Promise(resolve => pdfMake.createPdf(definition).getBlob(resolve));
const result = await TyanaPlatform.saveArtifact({
  data: pdfBlob,
  fileName: 'CP-5101-234-001_Rev-C.pdf',
  type: 'pdf'
});

if (!result.cancelled) {
  console.log(`${result.fileName} kaydedildi (${result.bytesWritten} bayt).`);
}
```

Aynı API, ExcelJS `writeBuffer()` sonucu için `xlsx`, ASCII DXF Blob'u için `dxf` türünü kabul eder. Web'de File System Access API, desteklenmiyorsa normal indirme; Tauri'de Windows native Kaydet penceresi kullanılır.

## Güvenlik sınırı

- Rust tarafında kayıtlı ayrıcalıklı komutlar yalnızca `prepare_export` ve `write_export` komutlarıdır.
- Frontend genel dosya yolu gönderemez. Yol yalnızca native diyalogdan gelir ve iki dakikalık, tek kullanımlı rastgele biletle eşleşir.
- PDF, XLSX ve DXF dışındaki uzantılar reddedilir. Boyut 64 MB ile sınırlıdır; PDF/XLSX/DXF içerik imzaları yazmadan önce kontrol edilir.
- `main` penceresine dosya sistemi, shell, HTTP, updater veya dialog eklenti izni verilmez. Native diyalog yalnızca Rust içinden açılır.
- Paketlenmiş yerel içerik, sıkı CSP, dondurulmuş `Object.prototype` ve kapalı asset protokolü kullanılır.
- NSIS kullanıcı bazlı kurulum varsayılanı korunur. Fabrika bilgisayarları için WebView2 offline installer pakete eklenir.

## Doğrulanabilen adımlar

Rust kurulmadan statik masaüstü paketini hazırlamak ve JavaScript sözdizimini kontrol etmek mümkündür:

```powershell
node desktop-build.mjs
node --check platform-adapter.js
node --check desktop-build.mjs
```

## Windows installer üretimi

Kurulum paketi için önce Rust stable MSVC, Visual Studio 2022 Build Tools içindeki **Desktop development with C++** bileşeni ve Tauri CLI gerekir. Bu bilgisayarda Rust/Cargo ve kullanılabilir MSVC Build Tools henüz yoktur; bu nedenle mevcut kaynaklar derlenmiş veya test edilmiş installer olarak sunulamaz.

Araç zinciri kurulduktan sonra:

```powershell
npm.cmd install --save-dev @tauri-apps/cli@2
npx.cmd tauri info
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml
npx.cmd tauri build
```

NSIS çıktısı `src-tauri/target/release/bundle/nsis/` altında oluşur. Kurum dışına dağıtımdan önce Windows Authenticode sertifikası ve ayrı Tauri updater imza anahtarı eklenmelidir; imzasız paket üretim paketi sayılmamalıdır.
