export const runtimeBlankProductFixtureBody = `
  applyProductTemplate('blank');
  productGroup.value = 'steering';
  syncProductTypes();
  productType.value = 'Kullanıcı Tanımlı Mamul';
  customProductTypeName.value = 'Native kalite kabul mamulü';
  syncCustomProductTypeField();
  document.getElementById('productStructureType').value = 'assembly';
  syncProductLevelContext();
  document.getElementById('controlPlanNumber').value = 'TYANA_NATIVE_QA_CP';
  document.getElementById('projectCode').value = 'TYANA_NATIVE_QA_PRJ';
  document.getElementById('partNumber').value = 'TYANA_NATIVE_QA_OEM';
  document.getElementById('internalProductCode').value = 'TYANA_NATIVE_QA_STOCK';
  document.getElementById('partName').value = 'Native Export Acceptance';
  document.getElementById('supplierName').value = tenantOrganizationName();
  document.getElementById('supplierSite').value = tenantPlantName();
  document.getElementById('customer').value = 'Kullanıcı Tanımlı Müşteri';
  document.getElementById('customerPartNumber').value = 'CUSTOMER-REF-QA';
  document.getElementById('drawingNumber').value = 'TYANA-NATIVE-DWG-001';
  document.getElementById('drawingRevision').value = 'QA';
  document.getElementById('documentStatus').value = 'Taslak';
  document.getElementById('materialFamily').value = 'BOM ve bileşen kartlarından türetilir';
  document.getElementById('materialGrade').value = 'Native test ortak mamul şartı';
  document.getElementById('materialStandard').value = 'QA-SPEC-001 Rev.A';
  document.getElementById('partWeight').value = '1.25';
  document.getElementById('traceabilityLevel').value = 'Parça + lot + vardiya';

  components = [
    componentRecord({ id: 'QA-ITEM-010', position: '10', itemNo: 'QA-COMP-010', name: 'QA işlenmiş gövde', componentType: 'İç üretim parçası', quantity: 1, usageQuantity: 1, uom: 'adet', makeBuy: 'Üret', materialFamily: 'Karbon çeliği', materialGrade: 'C45E', materialStandard: 'EN 10083-2', rawMaterialForm: 'Dövme taslağı', inputState: 'Dövme taslak', upstreamMethod: 'Sıcak dövme', primaryManufacturingMethod: 'Talaşlı imalat', outputState: 'İşlenmiş parça', drawingNo: 'QA-DWG-010', drawingRevision: 'A', itemRevision: 'A', revision: 'A', certificate: 'EN 10204 3.1', heatTreatment: 'Uygulanmıyor', hardnessSpec: '180–240 HBW', coatingType: 'Uygulanmıyor', coatingSpec: 'Uygulanmıyor', traceability: 'Isı no + üretim lotu', verificationStatus: 'Doğrulandı', status: 'Onaylı' }),
    componentRecord({ id: 'QA-ITEM-020', position: '20', itemNo: 'QA-COMP-020', name: 'QA satın alınan bağlantı', componentType: 'Satın alınan parça', quantity: 1, usageQuantity: 1, uom: 'adet', makeBuy: 'Satın al', materialFamily: 'Alaşımlı çelik', materialGrade: '41Cr4', materialStandard: 'EN 10083-3', rawMaterialForm: 'Standart parça', inputState: 'Satın alınan bitmiş parça', upstreamMethod: 'Satın alma / tedarikçi prosesi', primaryManufacturingMethod: 'Satın alma / tedarikçi prosesi', outputState: 'Satın alınan komponent', drawingNo: 'QA-DWG-020', drawingRevision: 'A', itemRevision: 'A', revision: 'A', supplier: 'Onaylı QA tedarikçisi', certificate: 'EN 10204 3.1', heatTreatment: 'Tedarikçi şartı', hardnessSpec: '28–34 HRC', coatingType: 'Çinko-Nikel', coatingSpec: '8–12 µm', traceability: 'Tedarikçi lotu', verificationStatus: 'Doğrulandı', status: 'Onaylı' })
  ];
  resetEngineeringUniverseFromComponents();

  selected = [...activeBackbone().processes];
  routeDetails = {};
  renderOptions();
  renderSequence();
  const qaRouteEntries = selectedProcessEntries();
  const qaOperationCodes = operationCodeEntries();
  qaRouteEntries.forEach((entry, index) => {
    const operation = qaOperationCodes[index % qaOperationCodes.length];
    entry.detail.operationNo = String((index + 1) * 10);
    if (operation?.code) bindOperationCodeMetadata(entry.detail, operation.code);
    entry.detail.inputComponentIds = index === 0 ? components.map(item => item.id) : [];
    entry.detail.outputItemId = 'FINISHED_GOOD';
    entry.detail.workcenter = 'QA İş Merkezi';
    entry.detail.machineId = 'QA-MAK-' + String(index + 1).padStart(3, '0');
    entry.detail.tooling = 'QA takım / fikstür';
    entry.detail.programNo = 'QA-PRG-' + String(index + 1).padStart(3, '0') + ' Rev.A';
    entry.detail.responsible = 'Üretim + Kalite';
  });

  const qaCnc = qaRouteEntries.find(entry => entry.process.id === 'cnc') || qaRouteEntries[0];
  const qaFinal = qaRouteEntries.find(entry => entry.process.id === 'final') || qaRouteEntries.at(-1);
  const qaTorque = qaRouteEntries.find(entry => entry.process.id === 'torque') || qaFinal;
  characteristics = [
    newCharacteristic({ id: 'QA-CHAR-001', libraryCode: 'CUSTOM', componentId: 'QA-ITEM-010', balloon: '1', name: 'Fonksiyonel çap', definition: 'Teknik resimdeki fonksiyonel çapın alt ve üst limit kontrolü', sourceDrawing: 'QA-DWG-010', sourceZone: 'C4', sourceStatus: 'Test fixture teknik kaynağı', kind: 'Ürün', nominal: 18, minus: 0.013, plus: 0.013, unit: 'mm', classification: 'CC', processId: qaCnc.process.id, routeKey: qaCnc.routeKey, method: 'Değişken ölçüm', equipmentClass: 'Dış çap mikrometresi', equipment: 'QA-MIK-001', resolution: '0,001 mm', calibrationDue: '2027-12-31', msaReference: 'QA-GRR-001', msaStatus: 'Doğrulandı', sampleSize: '5', frequency: '2 saatte', trigger: 'İlk parça + takım değişimi + 2 saat', reference: 'QA-FRM-001', reaction: 'RP-QA-01' }),
    newCharacteristic({ id: 'QA-CHAR-002', libraryCode: 'CUSTOM', componentId: 'QA-ITEM-020', balloon: '2', name: 'Sertlik', definition: 'Satın alınan bağlantının sertlik kabul kontrolü', sourceDrawing: 'QA-DWG-020', sourceZone: 'Not 2', sourceStatus: 'Test fixture teknik kaynağı', kind: 'Ürün', nominal: 31, minus: 3, plus: 3, unit: 'HRC', classification: 'SC', processId: qaFinal.process.id, routeKey: qaFinal.routeKey, method: 'Laboratuvar testi', equipmentClass: 'Rockwell sertlik cihazı', equipment: 'QA-HRC-001', resolution: '0,1 HRC', calibrationDue: '2027-12-31', msaReference: 'QA-MSA-HRC', msaStatus: 'Doğrulandı', sampleSize: '3', frequency: 'Lot başına', trigger: 'Her tedarikçi lotu', reference: 'QA-FRM-002', reaction: 'RP-QA-02' }),
    newCharacteristic({ id: 'QA-CHAR-003', libraryCode: 'CUSTOM', componentId: 'FINISHED_GOOD', balloon: 'P-03', name: 'Montaj torku', definition: 'Mamul bağlantısının tork/açı sonucu', sourceDrawing: 'TYANA-NATIVE-DWG-001', sourceZone: 'Montaj notu 3', sourceStatus: 'Test fixture teknik kaynağı', kind: 'Proses', nominal: 42, minus: 3, plus: 3, unit: 'Nm', classification: 'SC', processId: qaTorque.process.id, routeKey: qaTorque.routeKey, method: '%100 otomatik izleme', equipmentClass: 'Tork transdüseri', equipment: 'QA-TORK-001', resolution: '0,1 Nm', calibrationDue: '2027-12-31', msaReference: 'QA-MSA-TORK', msaStatus: 'Doğrulandı', sampleSize: '%100', frequency: 'Her parça', trigger: 'Her parça', reference: 'QA-FRM-003', reaction: 'RP-QA-03' })
  ];
  pfmeaRows = [];
  renderComponents();
  renderCharacteristics();
  renderOptions();
  renderSequence();
  renderFlowDiagram();
  renderPfmea();
  buildInstructionModels();
  renderInstructions();
  updateSummary();
`;

export function runtimeBlankProductFixtureExpression() {
  return `(() => {${runtimeBlankProductFixtureBody}\nreturn { components: components.length, characteristics: characteristics.length, selected: selected.length, route: selectedProcessEntries().length, pfmea: pfmeaRows.length, instructions: instructionModels.length };})()`;
}
