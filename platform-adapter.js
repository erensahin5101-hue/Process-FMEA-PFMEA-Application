(() => {
  'use strict';

  const MAX_EXPORT_BYTES = 64 * 1024 * 1024;
  const EXPORT_TYPES = Object.freeze({
    pdf: Object.freeze({ extension: 'pdf', mime: 'application/pdf', label: 'PDF dokümanı' }),
    xlsx: Object.freeze({ extension: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel çalışma kitabı' }),
    dxf: Object.freeze({ extension: 'dxf', mime: 'application/dxf', label: 'DXF teknik çizimi' })
  });

  const TURKISH_ASCII = Object.freeze({
    'Ç': 'C', 'ç': 'c', 'Ğ': 'G', 'ğ': 'g', 'İ': 'I', 'ı': 'i',
    'Ö': 'O', 'ö': 'o', 'Ş': 'S', 'ş': 's', 'Ü': 'U', 'ü': 'u'
  });

  const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

  function isTauriDesktop() {
    return Boolean(globalThis.__TAURI_INTERNALS__ && globalThis.__TAURI__?.core?.invoke);
  }

  function normalizeExportType(type, fileName = '') {
    const explicit = String(type || '').trim().toLowerCase().replace(/^\./, '');
    const inferred = String(fileName).split('.').pop().toLowerCase();
    const key = EXPORT_TYPES[explicit] ? explicit : inferred;
    if (!EXPORT_TYPES[key]) throw new TypeError('Yalnızca PDF, XLSX ve DXF çıktıları kaydedilebilir.');
    return key;
  }

  function safeFileName(input, type) {
    const extension = EXPORT_TYPES[type].extension;
    const transliterated = String(input || `TYANA_EXPORT.${extension}`)
      .replace(/[ÇçĞğİıÖöŞşÜü]/g, character => TURKISH_ASCII[character])
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');
    const withoutExtension = transliterated.replace(/\.(pdf|xlsx|dxf)$/i, '');
    let stem = withoutExtension
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/[ ._]+$/g, '')
      .replace(/^[ .]+/g, '')
      .slice(0, 100);
    if (!stem) stem = 'TYANA_EXPORT';
    if (WINDOWS_RESERVED_NAMES.test(stem)) stem = `TYANA_${stem}`;
    return `${stem}.${extension}`;
  }

  async function toBytes(data) {
    let bytes;
    if (data instanceof Uint8Array) bytes = data;
    else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    else if (typeof Blob !== 'undefined' && data instanceof Blob) bytes = new Uint8Array(await data.arrayBuffer());
    else throw new TypeError('Çıktı verisi Blob, ArrayBuffer veya Uint8Array olmalıdır.');

    if (!bytes.byteLength) throw new RangeError('Boş bir çıktı kaydedilemez.');
    if (bytes.byteLength > MAX_EXPORT_BYTES) throw new RangeError('Tek çıktı boyutu 64 MB sınırını aşıyor.');
    return bytes;
  }

  function containsSequence(bytes, sequence) {
    if (!sequence.length || bytes.byteLength < sequence.length) return false;
    let offset = bytes.indexOf(sequence[0]);
    while (offset >= 0 && offset <= bytes.byteLength - sequence.length) {
      let matches = true;
      for (let index = 0; index < sequence.length; index += 1) {
        if (bytes[offset + index] !== sequence[index]) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
      offset = bytes.indexOf(sequence[0], offset + 1);
    }
    return false;
  }

  function validateSignature(bytes, type) {
    const ascii = value => new TextEncoder().encode(value);
    if (type === 'pdf') {
      return containsSequence(bytes.subarray(0, 5), ascii('%PDF-'))
        && containsSequence(bytes.subarray(Math.max(0, bytes.byteLength - 2048)), ascii('%%EOF'));
    }
    if (type === 'xlsx') {
      return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
        && containsSequence(bytes, ascii('[Content_Types].xml'))
        && containsSequence(bytes, ascii('xl/workbook.xml'));
    }
    if (type === 'dxf') {
      for (const byte of bytes) if (byte === 0 || byte > 0x7f) return false;
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replaceAll('\r\n', '\n');
      return text.trimStart().startsWith('0\nSECTION') && text.trimEnd().endsWith('EOF');
    }
    return false;
  }

  async function saveWithTauri(bytes, fileName, type) {
    const invoke = globalThis.__TAURI__?.core?.invoke;
    if (typeof invoke !== 'function') throw new Error('Tauri native kaydetme köprüsü kullanılamıyor.');

    const ticket = await invoke('prepare_export', { suggestedName: fileName, exportType: type });
    if (!ticket) return Object.freeze({ cancelled: true, mode: 'tauri', fileName, type });

    const result = await invoke('write_export', bytes, {
      headers: { 'x-tyana-export-ticket': ticket }
    });
    return Object.freeze({ cancelled: false, mode: 'tauri', ...result });
  }

  async function saveWithFilePicker(bytes, fileName, type) {
    const definition = EXPORT_TYPES[type];
    const handle = await globalThis.showSaveFilePicker({
      suggestedName: fileName,
      excludeAcceptAllOption: true,
      types: [{ description: definition.label, accept: { [definition.mime]: [`.${definition.extension}`] } }]
    });
    const writable = await handle.createWritable();
    try {
      await writable.write(bytes);
      await writable.close();
    } catch (error) {
      try { await writable.abort(); } catch {}
      throw error;
    }
    return Object.freeze({ cancelled: false, mode: 'file-picker', fileName, type, bytesWritten: bytes.byteLength });
  }

  function saveWithDownload(bytes, fileName, type) {
    const blob = new Blob([bytes], { type: EXPORT_TYPES[type].mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return Object.freeze({ cancelled: false, mode: 'download', fileName, type, bytesWritten: bytes.byteLength });
  }

  async function saveArtifact(options = {}) {
    const source = options.data ?? options.blob ?? options.bytes;
    const type = normalizeExportType(options.type ?? options.extension, options.fileName);
    const fileName = safeFileName(options.fileName, type);
    const bytes = await toBytes(source);
    if (!validateSignature(bytes, type)) throw new TypeError('Çıktı içeriği seçilen dosya türüyle uyuşmuyor.');

    if (isTauriDesktop()) return saveWithTauri(bytes, fileName, type);

    if (typeof globalThis.showSaveFilePicker === 'function' && globalThis.isSecureContext && !navigator.webdriver) {
      try {
        return await saveWithFilePicker(bytes, fileName, type);
      } catch (error) {
        if (error?.name === 'AbortError') return Object.freeze({ cancelled: true, mode: 'file-picker', fileName, type });
      }
    }
    return saveWithDownload(bytes, fileName, type);
  }

  const adapter = Object.freeze({
    isDesktop: isTauriDesktop(),
    maxExportBytes: MAX_EXPORT_BYTES,
    supportedExportTypes: Object.freeze(Object.keys(EXPORT_TYPES)),
    saveArtifact,
    saveFile: saveArtifact
  });

  Object.defineProperty(globalThis, 'TyanaPlatform', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: adapter
  });
})();
