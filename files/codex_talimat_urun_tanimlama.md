# URUN TANIMLAMA MODULU - CODEX TALIMAT METNI

## AMAC
Mevcut PySide6 masaustu programindaki "Urun Tanimlama" ekranini, kullanicinin
serbest metin yazmadan; SURUKLE-BIRAK ve ACILIR PENCERE / SECMELI LISTE
(dropdown, checkbox, aranabilir combo) ile calisacagi, PROFESYONEL,
SADE ve KULLANICI ODAKLI bir modul haline getir. Karar/onay her zaman
kullanicida kalir; program sadece adim adim yonlendirir.

## VERI MODELI (degismeyecek temel yapi)

1. **OPERATIONS_MASTER** - 380 operasyon kaydi
   - `op_code`, `op_name`, `category`, `default_step_type` (process/control),
     `default_control_marks` (§ / <C> / <M>, opsiyonel)
   - Ayri bir "Operasyon Kutuphanesi" ekranindan CRUD ile yonetilir.

2. **MACHINES_MASTER** - makine/kaynak kodlari (TAMAMEN DINAMIK)
   - `machine_code`, `machine_type` (cnc_tool / die_fixture /
     gauge_instrument / assembly_station / ndt_gauge), `description`,
     `active` (bool)
   - Ayri "Makine Kutuphanesi" ekranindan kullanici istedigi zaman
     yeni kod EKLEYEBILIR, mevcut kodu PASIFLESTIREBILIR veya SILEBILIR.
   - Baslangic seed verisi (gercek uretimde gorulen kodlar) asagida.

3. **OPERATION_MACHINE_ELIGIBILITY** - operasyon <-> makine cok-cok iliski
   - Bir operasyon secildiginde kullaniciya sadece bu tablodaki uygun
     makineler checkbox listesi olarak sunulur.
   - Eslesme tanimlanmamissa tum aktif makine listesi gosterilir;
     kullanicinin yaptigi secim otomatik olarak bu tabloya kaydedilip
     kutuphane zamanla kendini gunceller (ogrenen liste).

4. **PARTS_MASTER** - her tanimlanan parca
   - `part_no`, `part_name`,
     `type` (raw_material / assembly_material / component / sub_assembly /
     final_product)

5. **ROUTINGS** - component/sub_assembly/final_product turundeki her
   parca icin sirali is plani
   - Her adim: `sequence`, `op_code`, `selected_machines[]`,
     `control_marks` (opsiyonel override)
   - raw_material / assembly_material turlerinde bu sekme PASIF
     (bu parcalar islem gormez, direkt BOM'a girer).

6. **BOM_LINKS** - `parent_part_no -> child_part_no` listesi.
   Routing'den bagimsiz, sadece montaj yapisini tutar.

## EKRAN TASARIMI (PROFESYONEL UYGULAMA)

### Genel gorunum
- Uc panelli duzen: **Sol** = Parca Kutuphanesi (agac), **Orta-Ust** =
  secili parca basligi + hiyerarsi breadcrumb (Ana Mamul > Alt Montaj >
  Parca), **Sag/Alt** = sekmeli calisma alani.
- Acik/koyu tema destegi, tutarli ikon seti, hover/secim renkleri net.
- Bos durumlarda ("henuz parca secilmedi", "henuz adim yok") yonlendirici
  ipucu metinleri ve buyuk aksiyon butonlari.
- Her onemli islemde (silme, montajdan cikarma) onay dialogu.

### A) Sol Panel - "Parca Kutuphanesi"
- QTreeWidget, tur bazli gruplama (Hammadde / Montaj Malzemesi /
  Parca / Alt Montaj / Ana Mamul), arama kutusu (canli filtreleme).
- Surukleme kaynagi (DragOnly), her yaprak mime data = part_no.
- "+ Yeni Parca" butonu -> dialog: part_no, part_name, type (dropdown).
  Serbest metin sadece bu iki alanda; geri kalan her sey secmeli.

### B) Sag Panel - secili parcaya gore iki sekme

**Sekme 1: Is Plani / Proses Akisi**
- Ustte aranabilir combo (QCompleter, MatchContains, 380 kod icinde
  anlik arama) + "+ Adim Ekle".
- Altta surukle-birak ile SIRALANABILIR liste (InternalMove):
  `sira. [op_code] op_name -> secili makineler`.
- Cift tik -> Makine Secim Dialogu (checkbox liste, OPERATION_MACHINE_
  ELIGIBILITY'den filtrelenmis).
- Kontrol isaretleri (§ / <C> / <M>) satirda ikon/checkbox olarak gorunur.
- Adim silme, surukleyerek yeniden siralama.

**Sekme 2: Montaj Yapisi (BOM)**
- Drop hedefi liste; sol kutuphaneden surukle-birak ile parca eklenir.
- Kendine ekleme engeli, dongu (circular BOM) kontrolu.
- Her satirda miktar alani (opsiyonel) ve cikart butonu.

### C) Ayri Yonetim Ekranlari (menuden)
- **Operasyon Kutuphanesi**: 380 op_code CRUD, kategori filtresi.
- **Makine Kutuphanesi**: tum kodlar CRUD, tur atamasi, aktif/pasif.

## TASARIM PRENSIPLERI (zorunlu)
- Serbest metin sadece kod/isim alanlarinda; gerisi tamamen secmeli.
- Her yikici islemde onay dialogu; veri kaybi riski olmamali.
- Hiyerarsi (Ana Mamul -> Alt Montaj -> Parca -> Hammadde/Malzeme)
  her zaman gorsel olarak net (breadcrumb).
- Gecersiz surukle-birak hedefleri acik uyari ile engellenir
  (ornegin hammaddeye routing eklemek, veya bir parcayi kendi icine
  birakmak).
- Yapi tamamen JENERIK olmali; Track Rod ornegi sadece test/demo icindir.

## MAKINE KUTUPHANESI - BASLANGIC SEED VERISI (77 kod)

| Seri | Tur | Kodlar |
|---|---|---|
| T | cnc_tool | T11, T12, T27, T104, T112, T118, T119, T121, T122, T139, T146, T150, T151, T154, T155, T157, T158, T164, T168, T181, T182, T188, T189, T191, T192, T193, T194, T195, T196, T197, T203, T204, T205 |
| D | die_fixture | D3, D15, D16, D19, D24, D30, D37, D38, D42, D53, D55, D60, D61, D65, D66, D68, D69 |
| I | gauge_instrument | I9, I11, I12, I13, I20, I30, I50, I60, I61 |
| M | assembly_station | M2, M3, M4, M6, M12, M13, M17, M18, M22, M24, M45, M50, M51, M72 |
| KK | ndt_gauge | KK25, KK26, KK27, KK28 |

## CIKTI BEKLENTISI
PySide6 ile calisan, yukaridaki iki ana ekrani (Is Plani + BOM) ve iki
yonetim ekranini (Operasyon Kutuphanesi, Makine Kutuphanesi) iceren
modul. Veri katmani (PARTS / ROUTINGS / BOM_LINKS / OPERATIONS_MASTER /
MACHINES_MASTER / OPERATION_MACHINE_ELIGIBILITY) SQLite ya da mevcut
programin veritabanina baglanacak sekilde soyutlanmis olmali - dogrudan
Python sozlugu degil, gercek bir repository/DAO katmani uzerinden.
