import ExcelJS from 'exceljs';

const sha256 = '6f4cf8eab418f34f276c6daf0c5444c762844f20f92a043f89d58770f30b6697';

export const snapshotFixture = {
  schemaVersion: 'tyana.qflow.documentation.v1',
  templateVersion: 'TYANA-QFLOW-CP-1.0',
  snapshotId: 'qa-snapshot-2026-07-15',
  generatedAt: '2026-07-15T09:00:00.000Z',
  sha256,
  tenant: {
    id: 'tyana-qflow-default',
    profileVersion: '1.0.0',
    productName: 'TYANA Q-FLOW',
    legalName: 'Kullanıcı Tanımlı Kuruluş',
    shortName: 'Kullanıcı Tanımlı Kuruluş',
    plant: 'Kullanıcı Tanımlı Tesis',
    brand: 'TYANA Q-FLOW',
    activeCustomer: '',
    libraryId: 'tyana.qflow.default-profile',
    libraryVersion: '2026.07.17'
  },
  product: {
    projectCode: 'TY-QA-2026-001',
    controlPlanNumber: 'CP-TY-QA-001',
    partNumber: 'OEM-TRK-001',
    internalProductCode: 'STK-TRK-001',
    partName: 'Komple Rot Kolu Mamulü',
    productType: 'Kullanıcı Tanımlı Mamul',
    customProductTypeName: 'Komple rot kolu',
    productTypeLabel: 'Komple rot kolu',
    productGroupLabel: 'Direksiyon ve Süspansiyon Mamulleri',
    productionPhase: 'Seri Üretim',
    drawingNumber: 'TR-TY-001',
    drawingRevision: 'C',
    supplierName: 'Kullanıcı Tanımlı Kuruluş',
    supplierSite: 'Kullanıcı Tanımlı Tesis',
    supplierCode: '',
    customer: 'Otomotiv OEM',
    customerPartNumber: 'OEM-TRK-001',
    keyContact: 'Eren',
    keyContactPhone: '+90 000 000 00 00',
    coreTeam: 'Kalite / Üretim / Proses / Ar-Ge / Planlama',
    originalDate: '2026-07-01',
    revisionDate: '2026-07-15'
  },
  technical: {
    materialGrade: 'Çok bileşenli mamul - bileşen bazında tanımlı',
    materialStandard: 'Teknik resim ve onaylı malzeme şartnameleri',
    coatingType: 'Çinko-nikel kaplama',
    coatingThickness: '8-12',
    corrosionHours: '720'
  },
  standardsProfile: {
    iatf: 'IATF 16949:2016',
    apqp: 'AIAG APQP / Control Plan'
  },
  approval: { preparedBy: 'Eren', status: 'Onaylandı' },
  drawingSource: { sha256: 'be1f7fce74c998ad9f27a995e9dd62a1a5c0c66e5999cb320eefcc8dc83986b7' },
  components: [
    { id: 'cmp-boru', position: '10', itemNo: 'TY-BR-001', name: 'Gövde borusu', componentType: 'Yarı mamul', quantity: 1, uom: 'Adet', makeBuy: 'Üret', materialGrade: 'S355J2H / ST52 boru', materialStandard: 'EN 10210-1', drawingNo: 'TR-BR-001', revision: 'B', heatTreatment: 'Uygulanmaz', hardnessSpec: 'Teknik resme göre', coatingType: 'Çinko-nikel', coatingSpec: '8-12 µm', traceability: 'Isı no / lot', verificationStatus: 'Doğrulandı' },
    { id: 'cmp-mafsal', position: '20', itemNo: 'TY-MF-001', name: 'Mafsal', componentType: 'İşlenmiş parça', quantity: 1, uom: 'Adet', makeBuy: 'Üret', materialGrade: '41Cr4', materialStandard: 'EN 10083-3', drawingNo: 'TR-MF-001', revision: 'C', heatTreatment: 'Islah', hardnessSpec: '28-34 HRC', coatingType: 'Fosfat', coatingSpec: 'Teknik şartname', traceability: 'Isı no / lot', verificationStatus: 'Doğrulandı' },
    { id: 'cmp-govde', position: '30', itemNo: 'TY-GV-001', name: 'Dövme ve işlenmiş gövde', componentType: 'İşlenmiş parça', quantity: 1, uom: 'Adet', makeBuy: 'Üret', materialGrade: 'C45E', materialStandard: 'EN 10083-2', drawingNo: 'TR-GV-001', revision: 'C', heatTreatment: 'Normalizasyon', hardnessSpec: '180-240 HBW', coatingType: 'Çinko-nikel', coatingSpec: '8-12 µm', traceability: 'Dövme lotu / ısı no', verificationStatus: 'Doğrulandı' },
    { id: 'cmp-altmontaj', position: '40', itemNo: 'TY-AM-001', name: 'Körük, somun ve gres alt montaj seti', componentType: 'Alt montaj', quantity: 1, uom: 'Set', makeBuy: 'Satın Al', materialGrade: 'Bileşen şartnamelerine göre', materialStandard: 'Onaylı tedarikçi şartnamesi', drawingNo: 'TR-AM-001', revision: 'A', heatTreatment: 'Bileşene göre', hardnessSpec: 'Bileşene göre', coatingType: 'Bileşene göre', coatingSpec: 'Bileşene göre', traceability: 'Tedarikçi lotu', verificationStatus: 'Doğrulandı' }
  ],
  route: [
    { routeKey: 'r10', operationNo: '10', processId: 'incoming', name: 'Girdi ve malzeme doğrulama', category: 'Kontrol', description: 'Sertifika, lot ve teknik şart doğrulaması', equipment: 'ERP / spektrometre', special: false, outsource: false },
    { routeKey: 'r20', operationNo: '20', processId: 'forging', name: 'Sıcak dövme taslak', category: 'Üretim', description: 'C45E gövde taslağının kontrollü dövülmesi', equipment: 'Dövme presi / kalıp', special: true, outsource: false },
    { routeKey: 'r30', operationNo: '30', processId: 'cnc', name: 'CNC talaşlı imalat', category: 'Üretim', description: 'Gövde ve mafsal referanslarının işlenmesi', equipment: 'CNC torna / işleme merkezi', special: false, outsource: false },
    { routeKey: 'r40', operationNo: '40', processId: 'heat-treatment', name: 'Isıl işlem', category: 'Üretim', description: 'Mafsal ıslah işlemi', equipment: 'Kontrollü atmosfer fırını', special: true, outsource: true },
    { routeKey: 'r50', operationNo: '50', processId: 'coating', name: 'Yüzey kaplama', category: 'Üretim', description: 'Çinko-nikel kaplama ve pasivasyon', equipment: 'Kaplama hattı', special: true, outsource: false },
    { routeKey: 'r60', operationNo: '60', processId: 'assembly', name: 'Entegre tesis montajı', category: 'Üretim', description: 'Alt bileşenlerin kontrollü montajı', equipment: 'Poka-yoke montaj hattı', special: false, outsource: false },
    { routeKey: 'r70', operationNo: '70', processId: 'eol', name: 'Uç fonksiyon testi', category: 'Kontrol', description: 'Tork, boşluk ve fonksiyon doğrulaması', equipment: 'EOL test tezgâhı', special: false, outsource: false },
    { routeKey: 'r80', operationNo: '80', processId: 'packing', name: 'Nihai kontrol ve paketleme', category: 'Kontrol', description: 'Görsel kontrol, etiket ve sevk koruması', equipment: 'Kontrol masası', special: false, outsource: false }
  ]
};

const baseRows = [
  ['r10', '10', 'Malzeme kalite doğrulaması', 'ST52 / 41Cr4 / C45E sertifika ve PMI uyumu', 'Sertifika kontrolü + PMI', 'Spektrometre / ERP', '1 lot', 'Her lot', 'CC'],
  ['r20', '20', 'Dövme sıcaklığı', '1.150 ± 30 °C', 'Kayıtlı proses parametresi', 'Kalibre pirometre', 'İlk + 1/50', 'Başlangıç ve periyodik', 'SC'],
  ['r30', '30', 'Mafsal fonksiyonel çapı', 'Ø18,200 H7 mm', 'İlk parça + SPC', '0-25 mm dijital mikrometre', '5 parça', 'Saatlik', 'CC'],
  ['r30', '30', 'Gövde referans çapı', 'Ø34,100 ± 0,020 mm', 'SPC / Xbar-R', '25-50 mm mikrometre', '5 parça', 'Saatlik', 'SC'],
  ['r40', '40', 'Mafsal sertliği', '28-34 HRC', 'Sertlik doğrulaması', 'Rockwell sertlik cihazı', '3 parça', 'Her fırın lotu', 'SC'],
  ['r50', '50', 'Kaplama kalınlığı', '8-12 µm', 'XRF ölçümü', 'XRF kaplama ölçer', '5 parça', 'Her kaplama lotu', 'SC'],
  ['r60', '60', 'Montaj torku', '42 ± 3 N·m', 'Kontrollü sıkma', 'Tork kontrollü sıkıcı', '100%', 'Her parça', 'CC'],
  ['r70', '70', 'Fonksiyonel boşluk', '≤ 0,10 mm', 'Otomatik EOL test', 'EOL test tezgâhı', '100%', 'Her parça', 'CC']
];

export const controlPlanRowsFixture = baseRows.map((row, index) => ({
  operation: row[1],
  processName: snapshotFixture.route.find(step => step.routeKey === row[0]).name,
  responsible: index === 0 ? 'Girdi Kalite' : index < 6 ? 'Üretim / Proses' : 'Montaj / Kalite',
  equipment: snapshotFixture.route.find(step => step.routeKey === row[0]).equipment,
  specification: row[3],
  control: `${row[4]} • P/Y: proses kilidi`,
  measurement: `${row[5]} • Kalibrasyon geçerli • MSA: kabul`,
  sampling: `${row[6]} / ${row[7]}`,
  reference: `TR-TY-001 / Bölge ${String.fromCharCode(65 + index)}${index + 1} / FR-KLT-${String(index + 1).padStart(3, '0')}`,
  reaction: 'Prosesi durdur; son iyi parçadan itibaren ayır ve kalite sorumlusuna bildir.',
  owner: { position: index < 2 ? '10' : index < 6 ? '30' : '40', name: index < 2 ? 'Gövde / Malzeme' : index < 6 ? 'İşlenmiş bileşen' : 'Komple mamul' },
  item: {
    id: `CHR-${String(index + 1).padStart(3, '0')}`,
    libraryCode: `TY-CHR-${String(index + 1).padStart(3, '0')}`,
    balloon: String(index + 1),
    name: row[2],
    definition: `${row[2]} teknik resim ve kontrol planı karakteristiği`,
    classification: row[8],
    kind: index === 1 ? 'Proses' : 'Ürün',
    method: row[4],
    equipmentClass: 'Ölçüm ve test ekipmanı',
    equipment: row[5],
    calibrationDue: '2027-07-01',
    msaReference: 'MSA-TY-001',
    msaStatus: 'Kabul',
    sampleSize: row[6],
    frequency: row[7],
    trigger: 'Kurulum / takım değişimi / proses kesintisi',
    sourceDrawing: 'TR-TY-001',
    sourceZone: `Bölge ${String.fromCharCode(65 + index)}${index + 1}`,
    reference: `FR-KLT-${String(index + 1).padStart(3, '0')}`,
    reaction: 'RP-01'
  }
}));

export const processFixture = snapshotFixture.route.map(step => ({ id: step.processId, name: step.name }));

export const pfmeaRowsFixture = Array.from({ length: 18 }, (_, index) => {
  const step = snapshotFixture.route[index % snapshotFixture.route.length];
  const modes = ['Ölçü tolerans dışı', 'Yanlış malzeme kullanımı', 'Eksik montaj', 'Kaplama yetersizliği', 'İzlenebilirlik kaybı'];
  return {
    routeKey: step.routeKey,
    processId: step.processId,
    componentId: index % 3 === 0 ? 'FINISHED_GOOD' : snapshotFixture.components[index % snapshotFixture.components.length].id,
    processItem: index % 3 === 0 ? snapshotFixture.product.partName : snapshotFixture.components[index % snapshotFixture.components.length].name,
    processStep: step.name,
    workElementType: ['MAN', 'MACHINE', 'METHOD', 'MATERIAL'][index % 4],
    workElement: ['Operatör', step.equipment, 'Onaylı iş standardı', 'Onaylı malzeme lotu'][index % 4],
    processItemFunction: 'Proses parçasını tanımlı ürün şartlarında korumak',
    functionText: `${step.name} çıktısını teknik şartlara uygun üretmek`,
    workElementFunction: 'Proses girdisini ve parametreyi tanımlı standartta sürdürmek',
    failureMode: `${index + 1}. ${modes[index % modes.length]}`,
    effect: 'Müşteri montajında veya araç fonksiyonunda uygunsuzluk',
    effectOwnPlant: 'Hurda, yeniden işleme veya hat duruşu',
    effectShipToPlant: 'Müşteri montajında ilave işçilik veya hat duruşu',
    effectEndUser: 'Araç fonksiyonunda uygunsuzluk veya müşteri memnuniyetsizliği',
    severity: String(6 + (index % 4)),
    cause: 'Proses parametresi, takım, malzeme veya insan hatası',
    preventionControl: 'Onaylı reçete, proses kilidi ve ilk parça onayı',
    occurrence: String(2 + (index % 4)),
    detectionControl: 'İlk parça, periyodik kontrol ve otomatik hata önleme',
    detection: String(2 + ((index + 1) % 4)),
    ap: ['H', 'M', 'L'][index % 3],
    recommendedAction: 'Parametre kilidi ve hata önleme doğrulamasını güçlendir',
    preventionAction: 'Parametre kilidi ve proses standardını güçlendir',
    detectionAction: 'Otomatik tespit ve doğrulama kaydını güçlendir',
    owner: ['Proses Mühendisi', 'Kalite Mühendisi', 'Üretim Mühendisi'][index % 3],
    dueDate: `2026-0${8 + (index % 2)}-${String(1 + index).padStart(2, '0')}`,
    status: ['Açık', 'Devam Ediyor', 'Kapalı'][index % 3],
    evidence: `AKS-${String(index + 1).padStart(3, '0')}`,
    actionEvidence: `AKS-${String(index + 1).padStart(3, '0')}`,
    actionCompletionDate: `2026-09-${String(1 + index).padStart(2, '0')}`,
    resultSeverity: String(6 + (index % 4)),
    resultOccurrence: '2',
    resultDetection: '2',
    resultAp: 'L',
    resultRationale: 'Etkinlik doğrulaması ve ekip yeniden değerlendirmesi',
    ratingTableRef: 'FMEA-SOD-AP / Rev.B',
    ratingsRationale: 'Kontrollü tablo, proses verisi ve ekip kararı',
    specialCharacteristic: index % 2 ? 'SC' : 'NONE',
    controlPlanCharacteristicId: `CHR-${String((index % 8) + 1).padStart(3, '0')}`,
    controlPlanRowId: `CHR-${String((index % 8) + 1).padStart(3, '0')}`,
    filterCode: '',
    riskAcceptanceRef: '',
    contentOrigin: 'qa-fixture'
  };
});

snapshotFixture.pfmea = pfmeaRowsFixture;
snapshotFixture.fmeaGovernance = {
  schemaVersion: '1.2.0',
  profiles: {
    dfmea: {
      basis: 'family',
      applicability: 'applicable',
      applicabilityRationale: 'Kuruluş ürün tasarım sorumluluğunu taşır.',
      sourceId: 'FFMEA-STEERING-001 / Rev. B',
      family: 'Direksiyon bağlantı elemanları',
      scope: 'Komple mamul fonksiyonları, alt bileşenler ve araç arayüzleri',
      team: 'Ar-Ge / Tasarım / Kalite / Üretim / Test / Tedarikçi Kalite',
      customerRequirements: 'OEM CSR-2026 / teknik şartname',
      lessonsLearned: '8D-2025-014 / garanti analizi',
      coordinator: 'FMEA Moderatörü',
      revision: 'C',
      intent: 'Tasarım risklerini SOP öncesi azaltmak',
      timing: 'APQP ürün tasarım doğrulama kilometre taşı',
      task: 'Yapı, fonksiyon, hata, risk ve optimizasyon analizlerini tamamlamak',
      tool: 'AIAG-VDA 7 Adımlı FMEA',
      fmeaId: 'DFMEA-TY-QA-001',
      subject: 'Komple rot kolu tasarımı',
      startDate: '2026-07-01',
      keyDate: '2026-08-31',
      structureAnalysisRef: 'BD-TY-QA-001 / Rev.B',
      functionAnalysisRef: 'PD-TY-QA-001 / Rev.B',
      ratingTableRef: 'FMEA-SOD-AP / Rev.B',
      resultReportRef: 'FMEA-RPT-TY-QA-001 / Rev.C'
    },
    pfmea: {
      basis: 'family',
      sourceId: 'FFMEA-MACHINING-001 / Rev. D',
      family: 'Talaşlı imalat ve montaj',
      scope: 'Girdi kontrolden paketlemeye kadar bütün proses rotası',
      team: 'Proses / Kalite / Üretim / Bakım / Lojistik',
      customerRequirements: 'OEM CSR-2026 / kontrol planı şartları',
      lessonsLearned: 'Hurda Pareto 2025 / müşteri şikayetleri',
      coordinator: 'PFMEA Moderatörü',
      revision: 'D',
      intent: 'Proses risklerini SOP öncesi azaltmak',
      timing: 'APQP proses doğrulama kilometre taşı',
      task: 'Tüm rota ve 4M çalışma öğelerini değerlendirmek',
      tool: 'AIAG-VDA 7 Adımlı FMEA',
      fmeaId: 'PFMEA-TY-QA-001',
      subject: 'Komple rot kolu üretim prosesi',
      startDate: '2026-07-01',
      keyDate: '2026-09-01',
      structureAnalysisRef: 'PFD-TY-QA-001 / Rev.D',
      functionAnalysisRef: 'PFM-TY-QA-001 / Rev.D',
      ratingTableRef: 'FMEA-SOD-AP / Rev.B',
      resultReportRef: 'FMEA-RPT-TY-QA-002 / Rev.D',
      managementReview: 'MR-TY-QA-001'
    }
  },
  questionCatalog: {
    dfmea: [
      { id: '1.01', step: 1, text: 'Kapsam ve sınırlar kayıtlı mı?', required: true, disposition: 'PASS', evidence: 'DFMEA kapsam sayfası / Rev.C', owner: 'FMEA Moderatörü', dueDate: '2026-07-10' },
      { id: '5.02', step: 5, text: 'AP kararı lisanslı tabloyla doğrulandı mı?', required: true, disposition: 'PASS', evidence: 'Ekip toplantı tutanağı FM-07', owner: 'Kalite', dueDate: '2026-07-11' },
      { id: '7.03', step: 7, text: 'Core Tools zinciri iki yönlü izlenebilir mi?', required: true, disposition: 'PASS', evidence: 'TRACE-001', owner: 'Kalite', dueDate: '2026-07-12' }
    ],
    pfmea: [
      { id: 'P.01', step: 1, text: 'PFMEA kapsamı proses akışını kapsıyor mu?', required: true, disposition: 'PASS', evidence: 'PFD-TY-QA-001', owner: 'Proses', dueDate: '2026-07-10' },
      { id: 'P.08', step: 7, text: 'PFMEA kontrolü Kontrol Planı ve talimatla aynı kimliği taşıyor mu?', required: true, disposition: 'PASS', evidence: 'TRACE-001', owner: 'Kalite', dueDate: '2026-07-12' }
    ]
  },
  readiness: {
    dfmea: { required: 3, passed: 3, percent: 100, profileIssues: [], findings: [], ready: true },
    pfmea: { required: 2, passed: 2, percent: 100, profileIssues: [], findings: [], ready: true }
  },
  dfmeaRows: Array.from({ length: 10 }, (_, index) => ({
    id: `DF-${String(index + 1).padStart(3, '0')}`,
    upperLevel: 'Araç direksiyon sistemi',
    focusElement: index % 2 ? 'Mafsal' : 'Gövde',
    lowerLevel: index % 2 ? 'Küre geometrisi' : 'Malzeme ve kesit',
    function: 'Direksiyon kuvvetini güvenli ve kontrollü aktarmak',
    requirement: index % 2 ? 'Boşluk ≤ 0,10 mm' : 'Statik yük ≥ 45 kN',
    failureEffect: 'Direksiyon hassasiyetinin azalması veya emniyet fonksiyonu kaybı',
    failureMode: index % 2 ? 'Aşırı boşluk oluşması' : 'Gövde dayanımının yetersiz kalması',
    failureCause: index % 2 ? 'Küre geometrisi veya sertlik uygunsuzluğu' : 'Malzeme, kesit veya ısıl işlem yetersizliği',
    preventionControl: 'Hesap, tolerans analizi ve onaylı malzeme standardı',
    detectionControl: 'DVP&R dayanım, ömür ve ölçü doğrulama testleri',
    severity: 9,
    occurrence: 3,
    detection: 3,
    ap: index % 3 === 0 ? 'H' : 'M',
    riskRationale: 'Lisanslı değerlendirme tablosu / ekip kararı FM-07',
    action: 'Tolerans ve doğrulama kapsamını güçlendir',
    owner: 'Tasarım Mühendisi',
    dueDate: '2026-08-15',
    actionCompletionDate: '2026-08-10',
    actionEvidence: `DVP-${String(index + 1).padStart(3, '0')}`,
    resultSeverity: 9,
    resultOccurrence: 2,
    resultDetection: 2,
    resultAp: 'L',
    resultRationale: 'DVP&R testi ve tolerans analizi sonrası ekip değerlendirmesi',
    specialClass: index % 2 ? 'CC' : 'SC',
    characteristicId: `CHR-${String(index + 1).padStart(3, '0')}`,
    dvprRef: `DVP-${String(index + 1).padStart(3, '0')}`,
    status: 'Etkinlik Doğrulandı'
  }))
};

export const instructionFixture = {
  operationNo: '30',
  operationCode: '304',
  processId: 'cnc',
  title: 'CNC Talaşlı İmalat Operatör Talimatı',
  presetId: 'fixture.cnc-304',
  sourceDocumentNo: 'TTI-QA-304',
  sourceRevision: 'A',
  sourceRef: 'qa-fixture',
  equipment: 'CNC-12 / Fikstür F-30 / Program TY-001 Rev.C',
  ppe: 'Koruyucu gözlük, iş ayakkabısı ve makine risk değerlendirmesinde tanımlı PPE',
  ppeItems: ['Koruyucu gözlük', 'İş ayakkabısı', 'İş elbisesi', 'Kulak koruyucu'],
  validationFlags: [],
  safety: 'Yalnız eğitimli ve yetkili operatör çalışır. Koruyucu kapı ve interlock devre dışı bırakılmaz. Talaş elle alınmaz; ölçüm yalnız mil tamamen durduğunda yapılır. Ayar ve arızada LOTO uygulanır.',
  parametersText: 'Devir: 1.250 dev/dk\nİlerleme: 0,18 mm/dev\nTakım ömrü: 180 parça\nİzin verilen takım ofseti: ±0,020 mm\nSoğutma sıvısı konsantrasyonu: %7 ± %1',
  stepsText: 'İş emri, parça numarası ve teknik resim revizyonunu doğrula.\nMakine, bağlama ve koruyucu sistem başlangıç kontrolünü tamamla.\nOnaylı program ve takım listesini çağır.\nİlk parçayı üret ve numaralı karakteristikleri ölç.\nSeri üretimi başlat; SPC ve takım ömrü kayıtlarını izle.\nSonuçları kaydet ve lot izlenebilirliğini tamamla.',
  linked: controlPlanRowsFixture.slice(2, 4).map(row => row.item),
  reaction: 'Prosesi durdur; uygunsuz ürünü kırmızı alanda bloke et; son iyi parçadan itibaren ayır; kaliteye bildir ve yeniden başlatma onayı al.',
  record: 'FR-TY-CNC-030',
  context: { tenant: snapshotFixture.tenant, product: snapshotFixture.product }
};

export function safeExcelValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return value;
  const text = value.replaceAll('\u0000', '');
  return /^[\u0001-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
}

const thinBorder = {
  top: { style: 'thin', color: { argb: 'FF9AA7B8' } },
  left: { style: 'thin', color: { argb: 'FF9AA7B8' } },
  bottom: { style: 'thin', color: { argb: 'FF9AA7B8' } },
  right: { style: 'thin', color: { argb: 'FF9AA7B8' } }
};

function styleTitle(cell, color = 'FF10213F') {
  cell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
}

function styleTableHeader(row) {
  row.eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10213F' } };
    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });
}

export function buildControlPlanWorkbook(snapshot = snapshotFixture, rows = controlPlanRowsFixture) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${snapshot.tenant.productName} • ${snapshot.tenant.shortName} • Eren`;
  workbook.created = new Date('2026-07-15T09:00:00.000Z');
  workbook.modified = new Date('2026-07-15T09:00:00.000Z');

  const control = workbook.addWorksheet('Kontrol Planı', {
    views: [{ state: 'frozen', ySplit: 8, showGridLines: false }],
    pageSetup: { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 } }
  });
  control.columns = [7, 23, 25, 10, 25, 19, 12, 24, 25, 16, 17, 31].map(width => ({ width }));
  control.mergeCells('A1:L1'); control.getCell('A1').value = 'KONTROL PLANI / CONTROL PLAN'; styleTitle(control.getCell('A1')); control.getRow(1).height = 30;
  const mergeValue = (range, label, value) => {
    control.mergeCells(range); const cell = control.getCell(range.split(':')[0]);
    cell.value = `${label}\n${safeExcelValue(value || '—')}`;
    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF10213F' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FB' } };
  };
  mergeValue('A2:D2', 'FAZ', `[ ] Prototip   [ ] Ön Seri   [X] ${snapshot.product.productionPhase}`); mergeValue('E2:H2', 'KONTROL PLANI NO', snapshot.product.controlPlanNumber); mergeValue('I2:L2', 'DOKÜMAN DURUMU', snapshot.approval.status);
  mergeValue('A3:D3', 'KURULUŞ / SAHA', `${snapshot.product.supplierName} / ${snapshot.product.supplierSite}`); mergeValue('E3:H3', 'MÜŞTERİ / PARÇA NO', `${snapshot.product.customer} / ${snapshot.product.customerPartNumber}`); mergeValue('I3:L3', 'TEDARİKÇİ KODU', snapshot.product.supplierCode);
  mergeValue('A4:D4', 'OEM NO / REVİZYON', `${snapshot.product.partNumber} / ${snapshot.product.drawingRevision}`); mergeValue('E4:H4', 'KURULUŞ KODU / MAMUL ADI', `${snapshot.product.internalProductCode} / ${snapshot.product.partName}`); mergeValue('I4:L4', 'TEKNİK RESİM', `${snapshot.product.drawingNumber} / Rev. ${snapshot.product.drawingRevision}`);
  mergeValue('A5:D5', 'ANAHTAR PERSONEL / TELEFON', `${snapshot.product.keyContact} / ${snapshot.product.keyContactPhone}`); mergeValue('E5:H5', 'ÇEKİRDEK EKİP', snapshot.product.coreTeam); mergeValue('I5:L5', 'İLK YAYIN / REVİZYON', `${snapshot.product.originalDate} / ${snapshot.product.revisionDate}`);
  mergeValue('A6:D6', 'MAMUL AĞACI', `${snapshot.components.length} alt kalem • ST52 boru / 41Cr4 mafsal / C45E gövde`); mergeValue('E6:H6', 'MAMUL ORTAK ŞARTI', snapshot.technical.materialGrade); mergeValue('I6:L6', 'YÜZEY / FONKSİYON', `${snapshot.technical.coatingType} • ${snapshot.technical.coatingThickness} µm • ${snapshot.technical.corrosionHours} saat`);
  mergeValue('A7:H7', 'PROJE / APQP', snapshot.product.projectCode); mergeValue('I7:L7', 'KAYNAK SNAPSHOT SHA-256', snapshot.sha256);
  for (let rowNo = 2; rowNo <= 7; rowNo += 1) {
    control.getRow(rowNo).height = 28;
    control.getRow(rowNo).eachCell({ includeEmpty: true }, cell => { cell.border = thinBorder; });
  }
  control.getRow(8).values = ['Op.', 'Operasyon / Sorumlu', 'Makine / Teçhizat / Aparat', 'Kar. No', 'Ürün / Proses Karakteristiği', 'Spesifikasyon / Tolerans', 'Özel Sınıf', 'Kontrol / Poka-Yoke', 'Ölçüm Tekniği / Cihaz', 'Numune / Sıklık', 'Referans', 'Reaksiyon Planı'];
  control.getRow(8).height = 34; styleTableHeader(control.getRow(8));
  rows.forEach((row, index) => {
    const values = [row.operation, `${row.processName}\n${row.responsible}`, row.equipment, `${row.item.balloon}\n${row.item.id}`, `${row.item.name}\n${row.owner.position} • ${row.owner.name}\n${row.item.definition}`, row.specification, row.item.classification, row.control, row.measurement, row.sampling, row.reference, row.reaction].map(safeExcelValue);
    const excelRow = control.addRow(values); excelRow.height = 45;
    excelRow.eachCell({ includeEmpty: true }, cell => { cell.font = { name: 'Arial', size: 8 }; cell.alignment = { vertical: 'middle', wrapText: true }; cell.border = thinBorder; });
    if (index % 2) excelRow.eachCell({ includeEmpty: true }, cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8FB' } }; });
  });
  control.autoFilter = { from: 'A8', to: `L${8 + rows.length}` };
  control.pageSetup.printArea = `A1:L${8 + rows.length}`; control.pageSetup.printTitlesRow = '8:8';
  control.headerFooter.oddFooter = `&L${safeExcelValue(snapshot.product.controlPlanNumber)} • Rev. ${safeExcelValue(snapshot.product.drawingRevision)}&C KONTROLLÜ KOPYA&R Sayfa &P / &N`;

  const bom = workbook.addWorksheet('Mamul Ağacı', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
  const bomHeaders = ['Poz.', 'Parça Kodu', 'OEM No', 'Bileşen / Alt Montaj', 'Kalem Tipi', 'Miktar', 'Birim', 'Üret/Satın Al', 'Malzeme Kalite', 'Malzeme Standardı', 'Teknik Resim / Rev.', 'Giriş Durumu', 'Önceki / Kaynak Yöntem', 'Ana Dönüşüm Yöntemi', 'Çıkış Durumu', 'Bileşen Proses Omurgası', 'Isıl İşlem', 'Sertlik Şartı', 'Kaplama', 'İzlenebilirlik', 'Doğrulama', 'Seviye', 'Üst Parça Kodu', 'Tam BOM Yolu', 'Kullanım Miktarı', 'Kalem Revizyonu', 'Teknik Resim Revizyonu', 'Alternatif Grup', 'Aktif Alternatif', 'Geçerlilik', 'Kaynak BOM No', 'BOM Revizyonu', 'BOM Alternatifi', 'Montaj Operasyon Kodu', 'Yeniden Kullanım / Katalog', 'Üretildiği Operasyon', 'İlk Kullanım', 'Monte Edildiği Operasyon', 'Kontrol Operasyonu', 'Montaj Aşaması', 'Operasyon Bağlantı Durumu'];
  bom.columns = [10, 20, 20, 26, 20, 10, 10, 16, 22, 24, 24, 19, 21, 21, 19, 30, 19, 18, 18, 22, 18, 9, 20, 42, 13, 15, 17, 18, 14, 22, 22, 14, 14, 18, 26, 22, 22, 22, 22, 20, 20].map(width => ({ width }));
  bom.mergeCells('A1:AO1'); bom.getCell('A1').value = `${snapshot.tenant.shortName} • ${snapshot.tenant.productName} • MAMUL AĞACI / BILL OF MATERIALS`; styleTitle(bom.getCell('A1')); bom.getRow(1).height = 29;
  bom.mergeCells('A2:T2'); bom.getCell('A2').value = `ANA MAMUL: ${safeExcelValue(snapshot.product.internalProductCode)} • OEM ${safeExcelValue(snapshot.product.partNumber)} • ${safeExcelValue(snapshot.product.partName)} • Rev. ${safeExcelValue(snapshot.product.drawingRevision)}`;
  bom.mergeCells('U2:AO2'); bom.getCell('U2').value = `PROJE: ${safeExcelValue(snapshot.product.projectCode)} • ${snapshot.components.length} ALT KALEM • AKTİF BOM QA-BOM-001 / Rev. C / Alt. 01`;
  bom.getRow(4).values = bomHeaders;
  styleTableHeader(bom.getRow(4));
  snapshot.components.forEach((item, index) => {
    const operationCode = ['100', '304', '320', '600'][index] || '600';
    const manufacturingMethod = ['Boru hazırlama', 'Talaşlı imalat', 'Dövme + talaşlı imalat', 'Entegre montaj'][index] || 'Üretim';
    const row = bom.addRow([
      item.position, item.itemNo, `OEM-CMP-${String(index + 1).padStart(3, '0')}`, item.name, item.componentType,
      item.quantity, item.uom, item.makeBuy, item.materialGrade, item.materialStandard,
      `${item.drawingNo} / ${item.revision}`, 'Onaylı girdi', manufacturingMethod, manufacturingMethod,
      index === 3 ? 'Alt montaj seti' : 'İşlenmiş bileşen', `${operationCode} • ${manufacturingMethod}`,
      item.heatTreatment, item.hardnessSpec, `${item.coatingType} • ${item.coatingSpec}`, item.traceability,
      item.verificationStatus, 1, snapshot.product.internalProductCode,
      `${snapshot.product.internalProductCode} > ${item.itemNo}`, item.quantity, item.revision, item.revision,
      index === 3 ? 'ALT-MONTAJ-SET' : '', index === 3 ? 'SEÇİLİ' : '—', '2026-07-01 →',
      'QA-BOM-001', 'C', '01', operationCode, 'Yeni ana veri', operationCode, operationCode,
      index === 3 ? '600' : '—', index === 0 ? '100' : '700', index === 3 ? 'Ana montaj' : 'Bileşen üretimi',
      'BAĞLI'
    ].map(safeExcelValue));
    row.height = 38; row.eachCell({ includeEmpty: true }, cell => { cell.font = { name: 'Arial', size: 8 }; cell.alignment = { vertical: 'middle', wrapText: true }; cell.border = thinBorder; });
    if (index % 2) row.eachCell({ includeEmpty: true }, cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8FB' } }; });
  });
  bom.autoFilter = { from: 'A4', to: `AO${4 + snapshot.components.length}` };
  bom.pageSetup = {
    paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 2, fitToHeight: 0,
    horizontalCentered: true, pageOrder: 'overThenDown',
    margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 },
    printArea: `A1:AO${4 + snapshot.components.length}`
  };
  bom.pageSetup.printTitlesRow = '1:4';
  bom.pageSetup.printTitlesColumn = 'A:D';
  bom.headerFooter.oddFooter = `&L${safeExcelValue(snapshot.product.internalProductCode)} • BOM Rev. ${safeExcelValue(snapshot.product.drawingRevision)}&C KONTROLLÜ KOPYA&R Sayfa &P / &N`;

  const characteristics = workbook.addWorksheet('Karakteristik Kütüğü', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
  characteristics.columns = [13, 14, 9, 22, 24, 32, 22, 15, 20, 22, 22, 24, 17, 18, 22, 22, 28].map(width => ({ width }));
  characteristics.mergeCells('A1:Q1'); characteristics.getCell('A1').value = `${snapshot.tenant.shortName} • ${snapshot.tenant.productName} • NUMARALI KARAKTERİSTİK KÜTÜĞÜ`; styleTitle(characteristics.getCell('A1'), 'FF245CC7'); characteristics.getRow(1).height = 28;
  characteristics.getRow(3).values = ['Kalıcı ID', 'Kütüphane Kodu', 'Balon', 'Bileşen', 'Ad', 'Tanım', 'Kaynak Resim / Bölge', 'Tip / Sınıf', 'Spesifikasyon', 'Proses', 'Kontrol Yöntemi', 'Ekipman / ID', 'Kalibrasyon', 'MSA', 'Numune / Sıklık', 'Tetikleyici', 'Kayıt / Reaksiyon'];
  styleTableHeader(characteristics.getRow(3));
  rows.forEach((row, index) => {
    const record = characteristics.addRow([row.item.id, row.item.libraryCode, row.item.balloon, `${row.owner.position} • ${row.owner.name}`, row.item.name, row.item.definition, `${row.item.sourceDrawing} / ${row.item.sourceZone}`, `${row.item.kind} / ${row.item.classification}`, row.specification, row.processName, row.item.method, `${row.item.equipmentClass} / ${row.item.equipment}`, row.item.calibrationDue, `${row.item.msaReference} / ${row.item.msaStatus}`, `${row.item.sampleSize} / ${row.item.frequency}`, row.item.trigger, `${row.item.reference} / ${row.item.reaction}`].map(safeExcelValue));
    record.height = 44; record.eachCell({ includeEmpty: true }, cell => { cell.font = { name: 'Arial', size: 8 }; cell.alignment = { vertical: 'middle', wrapText: true }; cell.border = thinBorder; });
    if (index % 2) record.eachCell({ includeEmpty: true }, cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8FB' } }; });
  });
  characteristics.autoFilter = { from: 'A3', to: `Q${3 + rows.length}` };
  characteristics.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:Q${3 + rows.length}` };

  const engineering = workbook.addWorksheet('Mühendislik Soruları', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
  engineering.columns = [24, 28, 25, 48, 16, 48, 13, 20, 22, 22].map(width => ({ width }));
  engineering.mergeCells('A1:J1'); engineering.getCell('A1').value = `${snapshot.tenant.shortName} • ${snapshot.tenant.productName} • ÜRÜN / BİLEŞEN MÜHENDİSLİK SORULARI VE DOĞRULAMA KAYDI`; styleTitle(engineering.getCell('A1'), 'FF245CC7'); engineering.getRow(1).height = 28;
  engineering.getRow(3).values = ['Kapsam', 'Soru ID', 'Soru Seti', 'Teknik Soru', 'Tip', 'Yanıt / Sayısal Değer', 'Birim', 'Kaynak', 'Doğrulama', 'Kanıt / Gerekçe'];
  styleTableHeader(engineering.getRow(3));
  [
    ['ANA MAMUL • Komple Rot Kolu Mamulü', 'product.main-method', 'product-definition', 'Ana üretim / dönüşüm yöntemi nedir?', 'select', 'Entegre montaj', '', 'Proses tasarımı', 'Doğrulandı', 'Rota QA-001'],
    ['20 • Mafsal', 'component.hardness', 'machined-component', 'Isıl işlem sonrası sertlik şartı nedir?', 'number', '28-34', 'HRC', 'TR-MF-001', 'Doğrulandı', 'Balon 5'],
    ['30 • Dövme ve işlenmiş gövde', 'component.input-output-state', 'manufacturing-state', 'Giriş ve çıkış üretim durumları nedir?', 'select', 'Dövme taslak → işlenmiş gövde', '', 'TR-GV-001', 'Doğrulandı', 'Operasyon 320'],
    ['40 • Alt montaj seti', 'component.assembly-operation', 'assembly', 'Montaj operasyon kodu hangisidir?', 'select', '600 • Entegre tesis montajı', '', 'Operasyon kütüphanesi', 'Doğrulandı', 'Aktif BOM 01']
  ].forEach((values, index) => {
    const row = engineering.addRow(values.map(safeExcelValue)); row.height = 39;
    row.eachCell({ includeEmpty: true }, cell => { cell.font = { name: 'Arial', size: 8 }; cell.alignment = { vertical: 'middle', wrapText: true }; cell.border = thinBorder; });
    if (index % 2) row.eachCell({ includeEmpty: true }, cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8FB' } }; });
  });
  engineering.autoFilter = { from: 'A3', to: `J${engineering.rowCount}` };
  engineering.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:J${engineering.rowCount}` };

  const metadata = workbook.addWorksheet('_TYANA_METADATA'); metadata.state = 'veryHidden';
  [['Schema', snapshot.schemaVersion], ['Template', snapshot.templateVersion], ['Product', snapshot.tenant.productName], ['Tenant', snapshot.tenant.shortName], ['Plant', snapshot.tenant.plant], ['Project ID', snapshot.product.projectCode], ['Snapshot ID', snapshot.snapshotId], ['SHA-256', snapshot.sha256], ['Generated At', snapshot.generatedAt], ['Drawing SHA-256', snapshot.drawingSource.sha256], ['Input Guard', safeExcelValue('=HYPERLINK("https://invalid.example","blocked")')]].forEach(row => metadata.addRow(row));
  return workbook;
}
