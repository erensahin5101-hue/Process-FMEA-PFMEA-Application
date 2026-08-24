(function initializeFmeaGovernance(global) {
  'use strict';

  const STEPS = Object.freeze([
    ['1', 'Planlama ve Hazırlık'],
    ['2', 'Yapı Analizi'],
    ['3', 'Fonksiyon Analizi'],
    ['4', 'Hata Analizi'],
    ['5', 'Risk Analizi'],
    ['6', 'Optimizasyon'],
    ['7', 'Sonuçların Dokümantasyonu']
  ]);

  const sharedQuestions = [
    ['1.01', 1, 'Kapsamın başlangıç/bitiş sınırları, varsayımları ve hariç tutulanlar kayıtlı mı?', true],
    ['1.02', 1, 'Müşteri özel şartları, yasal şartlar ve öğrenilmiş ders kaynakları listelendi mi?', true],
    ['1.03', 1, 'Çok disiplinli ekip; tasarım, proses, kalite, üretim, tedarikçi ve saha deneyimini kapsıyor mu?', true],
    ['1.04', 1, 'Foundation/Family/ürüne özel FMEA türetme gerekçesi ve değişiklik noktaları kayıtlı mı?', true],
    ['1.05', 1, 'FMEA kapsamı proje kilometre taşları ve değişiklik yönetimiyle ilişkilendirildi mi?', false],
    ['1.06', 1, '5T kaydı; amaç, zamanlama, ekip, görev ve kullanılan aracı açıkça tanımlıyor mu?', true],
    ['1.07', 1, 'FMEA kimliği, konu, başlangıç/revizyon tarihi, sorumluluk ve gizlilik bilgileri kontrollü antette mevcut mu?', true],
    ['2.01', 2, 'Üst seviye, odak eleman ve alt seviye ilişkisi eksiksiz kuruldu mu?', true],
    ['2.02', 2, 'Sınır diyagramı; enerji, malzeme, sinyal ve fiziksel arayüzleri gösteriyor mu?', true],
    ['2.03', 2, 'Yeni/değişen/devralınan elemanlar ile arayüz sorumluları işaretlendi mi?', false],
    ['2.04', 2, 'Yapı ağacı veya proses yapısı güncel BOM, proses akışı ve analiz sınırıyla aynı revizyonda mı?', true],
    ['3.01', 3, 'Her odak elemanın fiil + isim + ölçülebilir gereksinim formatında fonksiyonu var mı?', true],
    ['3.02', 3, 'Fonksiyonlar müşteri/VOC, teknik resim, şartname veya proses çıktısına izlenebilir mi?', true],
    ['3.03', 3, 'P-Diyagramı; girdi, kontrol faktörü, gürültü faktörü ve istenmeyen çıktıları kapsıyor mu?', false],
    ['3.04', 3, 'Fonksiyon ve gereksinimler üst seviye, odak seviye ve alt seviye arasında kesintisiz bağlandı mı?', true],
    ['4.01', 4, 'Hata etkisi üst seviyede müşteri, araç, mevzuat veya sonraki proses diliyle yazıldı mı?', true],
    ['4.02', 4, 'Hata modu odak eleman fonksiyonunun olumsuzlanması olarak tanımlandı mı?', true],
    ['4.03', 4, 'Hata nedeni alt seviye eleman veya 4M kaynağında doğrulanabilir biçimde yazıldı mı?', true],
    ['4.04', 4, 'Etkiler–modlar–nedenler arasında atlanmış bağlantı bulunmadığı ekipçe gözden geçirildi mi?', false],
    ['4.05', 4, 'Etki katmanları kuruluş sahası, sevk edilen saha ve son kullanıcı açısından ayrı değerlendirildi mi?', true],
    ['5.01', 5, 'S-O-D puanlarının her biri için kurumsal/lisanslı değerlendirme tablosu ve gerekçe kayıtlı mı?', true],
    ['5.02', 5, 'AP kararı lisanslı AIAG-VDA tablosuyla ekip tarafından doğrulandı mı?', true],
    ['5.03', 5, 'Özel karakteristik adayları risk analizi, müşteri sembolü ve yasal şartla ilişkilendirildi mi?', true],
    ['5.04', 5, 'Mevcut önleme ve tespit kontrolleri birbirinden ayrıldı mı?', false],
    ['5.05', 5, 'Devralınan FMEA puanları ve kontrolleri yeni ürün/proses koşullarında yeniden doğrulandı mı?', true],
    ['6.01', 6, 'Yüksek/Orta AP için aksiyon, sorumlu, termin ve kanıt tanımlandı mı?', true],
    ['6.02', 6, 'Aksiyon sonrası S-O-D/AP yeniden değerlendirildi ve etkinlik kanıtı kaydedildi mi?', true],
    ['6.03', 6, 'Şiddet azaltılamıyorsa tasarım/proses değişikliği veya hata önleme kararı gerekçelendirildi mi?', false],
    ['6.04', 6, 'Önlemeye ve tespit etmeye yönelik aksiyonlar ayrı, durum ve fiili tamamlanma tarihiyle izleniyor mu?', true],
    ['6.05', 6, 'Tamamlanan aksiyonun etkinliği doğrulanmadan durum kapalı/tamamlandı yapılması engelleniyor mu?', true],
    ['7.01', 7, 'Açık riskler, yönetim kabulü, kilometre taşı ve eskalasyon durumu özetlendi mi?', true],
    ['7.02', 7, 'Revizyon, değişiklik nedeni, ekip, onay ve dağıtım kaydı mevcut mu?', true],
    ['7.03', 7, 'FMEA çıktıları ilgili Core Tools dokümanlarına iki yönlü izlenebilir mi?', true],
    ['7.04', 7, 'Sonuç raporu 5T hedeflerini, kapsamı, yüksek riskleri, aksiyon durumunu ve seri üretim gözden geçirme taahhüdünü içeriyor mu?', true]
  ];

  const kindQuestions = {
    dfmea: [
      ['D.01', 1, 'Tasarım sorumluluğu kuruluşta mı; değilse DFMEA uygulanabilirlik gerekçesi ve tedarikçi kanıtı var mı?', true],
      ['D.02', 2, 'Sistem–alt sistem–bileşen kırılımı BOM ve teknik mimariyle tutarlı mı?', true],
      ['D.03', 3, 'Fonksiyonel, dayanım, ömür, çevre, güvenlik ve arayüz gereksinimleri kapsandı mı?', true],
      ['D.04', 4, 'Malzeme, geometri, tolerans, arayüz ve yanlış kullanım kaynaklı tasarım nedenleri sorgulandı mı?', true],
      ['D.05', 5, 'Tespit kontrolleri DVP&R test numarası, örnek büyüklüğü ve kabul kriterine bağlı mı?', true],
      ['D.06', 6, 'Tasarım aksiyonu teknik resim/şartname/BOM revizyonuna ve doğrulama testine aktarıldı mı?', true],
      ['D.07', 7, 'DFMEA ürün karakteristikleri PFMEA etkilerine ve özel karakteristik matrisine aktarıldı mı?', true],
      ['D.08', 7, 'FMEA-MSR uygulanabilirliği izleme, uyarı ve sistem tepkisi açısından değerlendirildi mi?', false],
      ['D.09', 1, 'VOC/QFD çıktıları ürün ve parça karakteristiklerine, ardından DFMEA fonksiyonlarına izlenebilir mi?', false],
      ['D.10', 2, 'Blok/sınır diyagramı ile P-Diyagramı kontrollü kaynak numarası ve revizyonuyla kaydedildi mi?', true]
    ],
    pfmea: [
      ['P.01', 1, 'PFMEA kapsamı onaylı proses akışındaki başlangıç, bitiş, taşıma, depolama ve dış prosesleri kapsıyor mu?', true],
      ['P.02', 2, 'Her operasyon için insan, makine, malzeme ve çevre 4M elemanları sorgulandı mı?', true],
      ['P.03', 3, 'Proses fonksiyonu ürün karakteristiği ve proses karakteristiğini ölçülebilir biçimde tanımlıyor mu?', true],
      ['P.04', 4, 'PFMEA hata etkisi DFMEA/ürün fonksiyonu veya sonraki operasyon etkisine bağlı mı?', true],
      ['P.05', 5, 'O puanı gerçek hurda, rework, PPM, yetenek ve benzer proses verisiyle destekleniyor mu?', true],
      ['P.06', 5, 'D puanı kontrolün yeri, yöntemi, sıklığı, MSA yeterliliği ve hata kaçış olasılığıyla uyumlu mu?', true],
      ['P.07', 6, 'Poka-yoke, otomatik durdurma ve reaksiyon planı etkinlik doğrulaması kayıtlı mı?', true],
      ['P.08', 7, 'PFMEA kontrolü Kontrol Planı satırı ve operatör talimatındaki sayısal şartla aynı kimliği taşıyor mu?', true],
      ['P.09', 7, 'Özel karakteristikler teknik resim, PFMEA, Kontrol Planı ve standart işte aynı sembolle zincirlenmiş mi?', true],
      ['P.10', 7, 'Fason proses ve pass-through karakteristik sorumlulukları tanımlı mı?', false],
      ['P.11', 2, 'Her satır proses parçası, proses adımı ve proses çalışma öğesi olmak üzere üç seviyeli yapıya bağlı mı?', true],
      ['P.12', 3, 'İnsan, makine, metot ve malzeme iş elemanlarının fonksiyonları ve proses karakteristikleri ayrı sorgulandı mı?', true],
      ['P.13', 4, 'Kuruluş sahası, sevk edilen saha ve son kullanıcı etkileri ayrı alanlarda değerlendirildi mi?', true],
      ['P.14', 6, 'Önleme/tespit aksiyonları, fiili tarih, etkinlik kanıtı ve aksiyon sonrası S-O-D/AP ile kapatılıyor mu?', true]
    ]
  };

  function profileDefaults(kind) {
    return {
      basis: 'family', sourceId: '', family: '', scope: '', team: '', customerRequirements: '',
      lessonsLearned: '', coordinator: '', revision: 'A', intent: '', timing: '', task: '',
      tool: 'AIAG-VDA 7 Adımlı FMEA', organization: '', site: '', customer: '', subject: '',
      fmeaId: '', startDate: '', keyDate: '', revisionDate: '', processResponsibility: '',
      confidentiality: 'Kuruluş içi', structureAnalysisRef: '', functionAnalysisRef: '',
      ratingTableRef: '', resultReportRef: '', managementReview: '',
      ...(kind === 'dfmea' ? { applicability: 'applicable', applicabilityRationale: '' } : {})
    };
  }

  const state = {
    profiles: {
      dfmea: profileDefaults('dfmea'),
      pfmea: profileDefaults('pfmea')
    },
    answers: { dfmea: {}, pfmea: {} },
    dfmeaRows: []
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function markChanged() {
    global.markDraftDirty?.();
  }

  function questions(kind) {
    return [...sharedQuestions, ...(kindQuestions[kind] || [])].map(([id, step, text, required]) => ({ id, step, text, required }));
  }

  function answer(kind, id) {
    if (!state.answers[kind][id]) state.answers[kind][id] = { disposition: 'OPEN', evidence: '', owner: '', dueDate: '', note: '' };
    return state.answers[kind][id];
  }

  function coverage(kind) {
    const required = questions(kind).filter(item => item.required);
    const passed = required.filter(item => ['PASS', 'NA'].includes(answer(kind, item.id).disposition) && String(answer(kind, item.id).evidence).trim());
    return { required: required.length, passed: passed.length, percent: required.length ? Math.round((passed.length / required.length) * 100) : 0 };
  }

  function profileIssues(kind) {
    const profile = state.profiles[kind] || {};
    const issues = [];
    if (!String(profile.scope || '').trim()) issues.push('Analiz sınırı tanımlanmadı');
    if (!String(profile.team || '').trim()) issues.push('Çok disiplinli ekip tanımlanmadı');
    if (!String(profile.coordinator || '').trim()) issues.push('FMEA moderatörü tanımlanmadı');
    if (!String(profile.customerRequirements || '').trim()) issues.push('Müşteri özel şart kaynağı tanımlanmadı');
    if (!String(profile.lessonsLearned || '').trim()) issues.push('Öğrenilmiş ders / benzer ürün kaynağı tanımlanmadı');
    if (profile.basis !== 'foundation' && !String(profile.sourceId || '').trim()) issues.push('Türetilen kaynak FMEA ve revizyonu tanımlanmadı');
    if (!String(profile.intent || '').trim() || !String(profile.timing || '').trim() || !String(profile.task || '').trim() || !String(profile.tool || '').trim()) issues.push('5T kaydında amaç, zamanlama, görev veya araç eksik');
    if (!String(profile.fmeaId || '').trim() || !String(profile.subject || '').trim() || !profile.startDate || !profile.keyDate) issues.push('Kontrollü FMEA antetinde kimlik, konu, başlangıç veya anahtar tarih eksik');
    if (!String(profile.structureAnalysisRef || '').trim()) issues.push(`${kind === 'dfmea' ? 'Blok/sınır/yapı ağacı' : 'Proses akışı/yapı ağacı'} referansı tanımlanmadı`);
    if (!String(profile.functionAnalysisRef || '').trim()) issues.push(`${kind === 'dfmea' ? 'P-Diyagramı/QFD' : 'Proses fonksiyon matrisi'} referansı tanımlanmadı`);
    if (!String(profile.ratingTableRef || '').trim()) issues.push('Kontrollü S-O-D/AP değerlendirme tablosu ve revizyonu tanımlanmadı');
    if (!String(profile.resultReportRef || '').trim()) issues.push('7. adım sonuç raporu / gözden geçirme kaydı tanımlanmadı');
    if (kind === 'dfmea' && profile.applicability === 'not-applicable' && !String(profile.applicabilityRationale || '').trim()) issues.push('DFMEA uygulanamazlık gerekçesi ve sorumluluk kanıtı yok');
    return issues;
  }

  function readiness(kind) {
    const score = coverage(kind);
    const findings = questions(kind)
      .filter(item => item.required)
      .filter(item => !['PASS', 'NA'].includes(answer(kind, item.id).disposition) || !String(answer(kind, item.id).evidence).trim())
      .map(item => item.id);
    return { ...score, profileIssues: profileIssues(kind), findings, ready: !findings.length && !profileIssues(kind).length };
  }

  function evidenceRows(kind) {
    return questions(kind).map(item => ({ ...item, ...answer(kind, item.id) }));
  }

  function governanceMarkup(kind) {
    const profile = state.profiles[kind];
    const score = coverage(kind);
    return `<article class="fmea-governance-card" data-fmea-kind="${kind}">
      <header><div><span>${kind === 'dfmea' ? 'TASARIM' : 'PROSES'} FMEA KONTROLLÜ OMURGA</span><h2>Planlama, türetme ve denetim kanıtı</h2><p>Hazır sorular karar vermez; ekip kararının gerekçesini, kaynağını ve bağlantısını görünür kılar.</p></div><div class="fmea-coverage"><b>${score.percent}%</b><span>${score.passed}/${score.required} zorunlu kanıt</span><i><em style="width:${score.percent}%"></em></i></div></header>
      <div class="fmea-profile-grid">
        <label>FMEA türü<select data-fmea-profile="basis"><option value="foundation" ${profile.basis === 'foundation' ? 'selected' : ''}>Foundation FMEA</option><option value="family" ${profile.basis === 'family' ? 'selected' : ''}>Family FMEA</option><option value="product" ${profile.basis === 'product' ? 'selected' : ''}>Ürüne / prosese özel FMEA</option></select></label>
        ${kind === 'dfmea' ? `<label>Tasarım sorumluluğu / uygulanabilirlik<select data-fmea-profile="applicability"><option value="applicable" ${profile.applicability !== 'not-applicable' ? 'selected' : ''}>DFMEA uygulanabilir</option><option value="not-applicable" ${profile.applicability === 'not-applicable' ? 'selected' : ''}>U/A - tasarım sorumluluğu kuruluşta değil</option></select></label>` : ''}
        <label>Kaynak FMEA / revizyon<input data-fmea-profile="sourceId" value="${escapeHtml(profile.sourceId)}" placeholder="Örn. FFMEA-MACH-001 / Rev. C"></label>
        <label>Aile / kapsam<input data-fmea-profile="family" value="${escapeHtml(profile.family)}" placeholder="Ürün veya proses ailesi"></label>
        <label>FMEA revizyonu<input data-fmea-profile="revision" value="${escapeHtml(profile.revision)}"></label>
        <label class="span-2">Analiz sınırı<input data-fmea-profile="scope" value="${escapeHtml(profile.scope)}" placeholder="Başlangıç, bitiş, dahil ve hariç kapsam"></label>
        <label class="span-2">Çok disiplinli ekip<input data-fmea-profile="team" value="${escapeHtml(profile.team)}" placeholder="Tasarım, proses, üretim, kalite, tedarikçi, saha"></label>
        <label>FMEA moderatörü<input data-fmea-profile="coordinator" value="${escapeHtml(profile.coordinator)}"></label>
        <label>Müşteri özel şart kaynağı<input data-fmea-profile="customerRequirements" value="${escapeHtml(profile.customerRequirements)}" placeholder="CSR / şartname / portal kaydı"></label>
        <label class="span-2">Öğrenilmiş ders / benzer ürün kaynağı<input data-fmea-profile="lessonsLearned" value="${escapeHtml(profile.lessonsLearned)}" placeholder="8D, garanti, hurda, saha veya önceki FMEA referansı"></label>
        ${kind === 'dfmea' ? `<label class="span-2">Uygulanabilirlik kararı / tasarım sorumluluğu kanıtı<input data-fmea-profile="applicabilityRationale" value="${escapeHtml(profile.applicabilityRationale)}" placeholder="U/A ise müşteri/tedarikçi DFMEA referansı ve sorumluluk matrisi zorunludur"></label>` : ''}
      </div>
      <details class="fmea-profile-method" open>
        <summary><span>5T, kontrollü antet ve yöntem kanıtları</span><small>Amaç • zamanlama • ekip • görev • araç • kaynak revizyonları</small></summary>
        <div class="fmea-profile-grid fmea-method-grid">
          <label class="span-2">Amaç / Intent<input data-fmea-profile="intent" value="${escapeHtml(profile.intent)}" placeholder="Bu FMEA neden yapılıyor; beklenen risk azaltma sonucu nedir?"></label>
          <label>Zamanlama / Timing<input data-fmea-profile="timing" value="${escapeHtml(profile.timing)}" placeholder="APQP kilometre taşı / SOP öncesi"></label>
          <label>Anahtar tarih<input data-fmea-profile="keyDate" type="date" value="${escapeHtml(profile.keyDate)}"></label>
          <label class="span-2">Görev / Task<input data-fmea-profile="task" value="${escapeHtml(profile.task)}" placeholder="Analiz, doğrulama ve kapatılacak çalışma paketi"></label>
          <label class="span-2">Araç / Tool<input data-fmea-profile="tool" value="${escapeHtml(profile.tool)}" placeholder="7 adımlı yöntem, yapı ağacı, P-Diyagramı, ekip çalıştayı"></label>
          <label>FMEA kimlik no<input data-fmea-profile="fmeaId" value="${escapeHtml(profile.fmeaId)}" placeholder="PFMEA-001 / DFMEA-001"></label>
          <label>Konu / ürün-proses<input data-fmea-profile="subject" value="${escapeHtml(profile.subject)}"></label>
          <label>Başlangıç tarihi<input data-fmea-profile="startDate" type="date" value="${escapeHtml(profile.startDate)}"></label>
          <label>Revizyon tarihi<input data-fmea-profile="revisionDate" type="date" value="${escapeHtml(profile.revisionDate)}"></label>
          <label>Kuruluş<input data-fmea-profile="organization" value="${escapeHtml(profile.organization)}"></label>
          <label>Üretim / mühendislik sahası<input data-fmea-profile="site" value="${escapeHtml(profile.site)}"></label>
          <label>Müşteri / program<input data-fmea-profile="customer" value="${escapeHtml(profile.customer)}"></label>
          <label>Proses / tasarım sorumluluğu<input data-fmea-profile="processResponsibility" value="${escapeHtml(profile.processResponsibility)}"></label>
          <label>Gizlilik<select data-fmea-profile="confidentiality"><option ${profile.confidentiality === 'Kuruluş içi' ? 'selected' : ''}>Kuruluş içi</option><option ${profile.confidentiality === 'Müşteri ile paylaşılabilir' ? 'selected' : ''}>Müşteri ile paylaşılabilir</option><option ${profile.confidentiality === 'Gizli' ? 'selected' : ''}>Gizli</option></select></label>
          <label class="span-2">${kind === 'dfmea' ? 'Blok / sınır / yapı ağacı' : 'Proses akışı / proses yapı ağacı'} ref.<input data-fmea-profile="structureAnalysisRef" value="${escapeHtml(profile.structureAnalysisRef)}" placeholder="Doküman no / revizyon / tarih"></label>
          <label class="span-2">${kind === 'dfmea' ? 'P-Diyagramı / QFD' : 'Proses fonksiyon matrisi / karakteristik matrisi'} ref.<input data-fmea-profile="functionAnalysisRef" value="${escapeHtml(profile.functionAnalysisRef)}" placeholder="Doküman no / revizyon / tarih"></label>
          <label class="span-2">Kontrollü S-O-D/AP tablo ref.<input data-fmea-profile="ratingTableRef" value="${escapeHtml(profile.ratingTableRef)}" placeholder="Kuruluşça kontrollü/lisanslı tablo no ve revizyonu"></label>
          <label class="span-2">7. adım sonuç raporu ref.<input data-fmea-profile="resultReportRef" value="${escapeHtml(profile.resultReportRef)}" placeholder="FMEA sonuç raporu / gözden geçirme tutanağı"></label>
          <label class="span-2">Yönetim gözden geçirme / risk kabul kaydı<input data-fmea-profile="managementReview" value="${escapeHtml(profile.managementReview)}" placeholder="Yüksek risk, açık aksiyon, karar ve yetkili referansı"></label>
        </div>
      </details>
      <div class="fmea-seven-steps">${STEPS.map(([number, title]) => {
        const stepQuestions = questions(kind).filter(item => item.step === Number(number));
        const complete = stepQuestions.filter(item => ['PASS', 'NA'].includes(answer(kind, item.id).disposition)).length;
        return `<details class="fmea-audit-step" ${Number(number) === 1 ? 'open' : ''}><summary><span>${number}</span><div><b>${escapeHtml(title)}</b><small>${complete}/${stepQuestions.length} karar • ${stepQuestions.filter(item => item.required).length} zorunlu</small></div><mark>${complete === stepQuestions.length ? 'TAMAM' : 'AÇIK'}</mark></summary><div class="fmea-audit-questions">${stepQuestions.map(item => {
          const current = answer(kind, item.id);
          return `<article class="fmea-audit-question ${item.required ? 'required' : ''} ${current.disposition.toLowerCase()} " data-fmea-question="${escapeHtml(item.id)}"><span>${escapeHtml(item.id)}</span><div><b>${escapeHtml(item.text)}</b><small>${item.required ? 'Zorunlu denetim kanıtı' : 'İyi uygulama / uygulanabilirlik kararı'}</small></div><select data-fmea-answer="disposition"><option value="OPEN" ${current.disposition === 'OPEN' ? 'selected' : ''}>Açık</option><option value="PASS" ${current.disposition === 'PASS' ? 'selected' : ''}>Karşılandı</option><option value="NA" ${current.disposition === 'NA' ? 'selected' : ''}>U/A + gerekçe</option><option value="FINDING" ${current.disposition === 'FINDING' ? 'selected' : ''}>Bulgu</option></select><input data-fmea-answer="evidence" value="${escapeHtml(current.evidence)}" placeholder="Doküman/karakteristik/test/operasyon kanıtı"><input data-fmea-answer="owner" value="${escapeHtml(current.owner)}" placeholder="Sorumlu"><input data-fmea-answer="dueDate" type="date" value="${escapeHtml(current.dueDate)}"></article>`;
        }).join('')}</div></details>`;
      }).join('')}</div>
      <footer><span>U/A kararı da kanıt alanında gerekçe gerektirir. Bu ekran sertifika veya otomatik uygunluk beyanı değildir.</span><button type="button" data-fmea-expand>7 Adımın Tümünü Aç / Kapat</button></footer>
    </article>`;
  }

  function bindGovernance(host, kind) {
    host.querySelectorAll('[data-fmea-profile]').forEach(field => field.addEventListener('input', event => {
      state.profiles[kind][event.target.dataset.fmeaProfile] = event.target.value;
      markChanged();
    }));
    host.querySelectorAll('[data-fmea-answer]').forEach(field => {
      const update = event => {
        const row = event.target.closest('[data-fmea-question]');
        answer(kind, row.dataset.fmeaQuestion)[event.target.dataset.fmeaAnswer] = event.target.value;
        row.classList.remove('open', 'pass', 'na', 'finding');
        row.classList.add(answer(kind, row.dataset.fmeaQuestion).disposition.toLowerCase());
        markChanged();
      };
      field.addEventListener(field.matches('select, input[type="date"]') ? 'change' : 'input', update);
    });
    host.querySelector('[data-fmea-expand]')?.addEventListener('click', () => {
      const shouldOpen = [...host.querySelectorAll('.fmea-audit-step')].some(item => !item.open);
      host.querySelectorAll('.fmea-audit-step').forEach(item => { item.open = shouldOpen; });
    });
  }

  function renderGovernance(kind) {
    const host = document.getElementById(`${kind}GovernanceStudio`);
    if (!host) return;
    host.innerHTML = governanceMarkup(kind);
    bindGovernance(host, kind);
  }

  function newDfmeaRow(seed = {}) {
    return {
      id: `DF-${crypto.randomUUID()}`,
      upperLevel: '', focusElement: '', lowerLevel: '', function: '', requirement: '',
      failureEffect: '', failureMode: '', failureCause: '', preventionControl: '',
      detectionControl: '', severity: 1, occurrence: 1, detection: 1, ap: '',
      riskRationale: '', action: '', preventionAction: '', detectionAction: '', owner: '', dueDate: '', actionCompletionDate: '',
      actionEvidence: '', resultSeverity: '', resultOccurrence: '', resultDetection: '',
      resultAp: '', resultRationale: '', specialClass: 'NONE',
      characteristicId: '', dvprRef: '', filterCode: '', notes: '', status: 'Açık', ...seed
    };
  }

  function riskNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(1, Math.min(10, Math.round(number))) : 1;
  }

  function dfmeaRpn(row) {
    const values = [row.severity, row.occurrence, row.detection].map(Number);
    return values.every(value => Number.isInteger(value) && value >= 1 && value <= 10)
      ? values.reduce((total, value) => total * value, 1)
      : 0;
  }

  function dfmeaRowMarkup(row, index) {
    const rpn = dfmeaRpn(row);
    return `<article class="dfmea-analysis-row" draggable="true" data-dfmea-row="${escapeHtml(row.id)}">
      <header><span class="dfmea-drag">⋮⋮</span><b>${String(index + 1).padStart(2, '0')}</b><div><strong>${escapeHtml(row.focusElement || 'Odak eleman bekleniyor')}</strong><small>${escapeHtml(row.function || 'Fonksiyon ve gereksinim tanımlanmalı')}</small></div><mark class="${String(row.ap).toLowerCase()}">${escapeHtml(row.ap || 'AP?')}</mark><button type="button" data-dfmea-copy title="Satırı kopyala">⧉</button><button type="button" data-dfmea-delete title="Satırı sil">×</button></header>
      <div class="dfmea-structure-grid">
        <label>Üst seviye / etki alanı<input data-dfmea-field="upperLevel" value="${escapeHtml(row.upperLevel)}"></label>
        <label>Odak eleman<input data-dfmea-field="focusElement" value="${escapeHtml(row.focusElement)}"></label>
        <label>Alt seviye / neden elemanı<input data-dfmea-field="lowerLevel" value="${escapeHtml(row.lowerLevel)}"></label>
        <label class="span-2">Fonksiyon<input data-dfmea-field="function" value="${escapeHtml(row.function)}" placeholder="Fiil + isim"></label>
        <label>Ölçülebilir gereksinim<input data-dfmea-field="requirement" value="${escapeHtml(row.requirement)}"></label>
      </div>
      <div class="dfmea-failure-chain">
        <label><span>ETKİ</span><textarea data-dfmea-field="failureEffect" rows="2">${escapeHtml(row.failureEffect)}</textarea></label><i>→</i>
        <label><span>HATA MODU</span><textarea data-dfmea-field="failureMode" rows="2">${escapeHtml(row.failureMode)}</textarea></label><i>→</i>
        <label><span>NEDEN</span><textarea data-dfmea-field="failureCause" rows="2">${escapeHtml(row.failureCause)}</textarea></label>
      </div>
      <div class="dfmea-control-grid">
        <label>Mevcut önleme kontrolü<textarea data-dfmea-field="preventionControl" rows="2">${escapeHtml(row.preventionControl)}</textarea></label>
        <label>Mevcut tespit kontrolü<textarea data-dfmea-field="detectionControl" rows="2">${escapeHtml(row.detectionControl)}</textarea></label>
        <label>DVP&amp;R / test ref.<input data-dfmea-field="dvprRef" value="${escapeHtml(row.dvprRef)}"></label>
        <label>Karakteristik ID<input data-dfmea-field="characteristicId" value="${escapeHtml(row.characteristicId)}"></label>
        <label>Özel sınıf<select data-dfmea-field="specialClass"><option value="NONE" ${row.specialClass === 'NONE' ? 'selected' : ''}>Normal</option><option value="SC" ${row.specialClass === 'SC' ? 'selected' : ''}>SC</option><option value="CC" ${row.specialClass === 'CC' ? 'selected' : ''}>CC</option><option value="KPC" ${row.specialClass === 'KPC' ? 'selected' : ''}>KPC</option><option value="SAFETY" ${row.specialClass === 'SAFETY' ? 'selected' : ''}>Emniyet / yasal</option></select></label>
      </div>
      <div class="dfmea-risk-grid">
        <label>S<input data-dfmea-field="severity" type="number" min="1" max="10" value="${riskNumber(row.severity)}"></label>
        <label>O<input data-dfmea-field="occurrence" type="number" min="1" max="10" value="${riskNumber(row.occurrence)}"></label>
        <label>D<input data-dfmea-field="detection" type="number" min="1" max="10" value="${riskNumber(row.detection)}"></label>
        <label>AP<select data-dfmea-field="ap"><option value="" ${!row.ap ? 'selected' : ''}>Ekip seçimi</option><option value="H" ${row.ap === 'H' ? 'selected' : ''}>H / Yüksek</option><option value="M" ${row.ap === 'M' ? 'selected' : ''}>M / Orta</option><option value="L" ${row.ap === 'L' ? 'selected' : ''}>L / Düşük</option></select></label>
        <span data-dfmea-rpn><b>${rpn || '—'}</b><small>S×O×D gösterge; AP yerine geçmez</small></span>
        <label class="span-2">S/O/D/AP gerekçesi ve kullanılan tablo ref.<input data-dfmea-field="riskRationale" value="${escapeHtml(row.riskRationale)}" placeholder="Kurumsal/lisanslı tablo, veri ve ekip kararı"></label>
        <label>Filtre kodu<input data-dfmea-field="filterCode" value="${escapeHtml(row.filterCode)}" placeholder="Opsiyonel filtre / emniyet kodu"></label>
        <label>Önlemeye yönelik aksiyon<textarea data-dfmea-field="preventionAction" rows="2">${escapeHtml(row.preventionAction || row.action)}</textarea></label>
        <label>Tespit etmeye yönelik aksiyon<textarea data-dfmea-field="detectionAction" rows="2">${escapeHtml(row.detectionAction)}</textarea></label>
        <label>Sorumlu<input data-dfmea-field="owner" value="${escapeHtml(row.owner)}"></label>
        <label>Termin<input data-dfmea-field="dueDate" type="date" value="${escapeHtml(row.dueDate)}"></label>
        <label>Tamamlama tarihi<input data-dfmea-field="actionCompletionDate" type="date" value="${escapeHtml(row.actionCompletionDate)}"></label>
        <label class="span-2">Tamamlama / etkinlik kanıtı<input data-dfmea-field="actionEvidence" value="${escapeHtml(row.actionEvidence)}"></label>
        <label>Durum<select data-dfmea-field="status"><option ${row.status === 'Açık' ? 'selected' : ''}>Açık</option><option ${row.status === 'Karar Bekleniyor' ? 'selected' : ''}>Karar Bekleniyor</option><option ${row.status === 'Uygulama Bekleniyor' || row.status === 'Devam Ediyor' ? 'selected' : ''}>Uygulama Bekleniyor</option><option ${row.status === 'Etkinlik Doğrulandı' ? 'selected' : ''}>Etkinlik Doğrulandı</option><option ${row.status === 'Tamamlandı' || row.status === 'Kapatıldı' ? 'selected' : ''}>Tamamlandı</option><option ${row.status === 'Uygulanmadı' ? 'selected' : ''}>Uygulanmadı</option></select></label>
        <label class="span-2">Notlar / risk kabul gerekçesi<input data-dfmea-field="notes" value="${escapeHtml(row.notes)}"></label>
      </div>
      <div class="dfmea-result-grid">
        <span><b>AKSİYON SONRASI RİSK</b><small>Etkinlik kanıtından sonra ekipçe yeniden değerlendirilir</small></span>
        <label>Yeni S<input data-dfmea-field="resultSeverity" type="number" min="1" max="10" value="${row.resultSeverity ? riskNumber(row.resultSeverity) : ''}"></label>
        <label>Yeni O<input data-dfmea-field="resultOccurrence" type="number" min="1" max="10" value="${row.resultOccurrence ? riskNumber(row.resultOccurrence) : ''}"></label>
        <label>Yeni D<input data-dfmea-field="resultDetection" type="number" min="1" max="10" value="${row.resultDetection ? riskNumber(row.resultDetection) : ''}"></label>
        <label>Yeni AP<select data-dfmea-field="resultAp"><option value="" ${!row.resultAp ? 'selected' : ''}>Ekip seçimi</option><option value="H" ${row.resultAp === 'H' ? 'selected' : ''}>H / Yüksek</option><option value="M" ${row.resultAp === 'M' ? 'selected' : ''}>M / Orta</option><option value="L" ${row.resultAp === 'L' ? 'selected' : ''}>L / Düşük</option></select></label>
        <label class="span-2">Yeniden değerlendirme gerekçesi<input data-dfmea-field="resultRationale" value="${escapeHtml(row.resultRationale)}" placeholder="Aksiyon etkisi, test/validasyon sonucu ve ekip kararı"></label>
      </div>
    </article>`;
  }

  function renderDfmeaRows() {
    const host = document.getElementById('dfmeaAnalysisRows');
    if (!host) return;
    if (!state.dfmeaRows.length) state.dfmeaRows.push(newDfmeaRow());
    host.innerHTML = state.dfmeaRows.map(dfmeaRowMarkup).join('');
    const count = document.getElementById('dfmeaRowCount');
    if (count) count.textContent = `${state.dfmeaRows.length} SATIR`;
    let draggedId = '';
    host.querySelectorAll('[data-dfmea-row]').forEach(card => {
      const row = () => state.dfmeaRows.find(item => item.id === card.dataset.dfmeaRow);
      card.addEventListener('dragstart', event => { draggedId = card.dataset.dfmeaRow; event.dataTransfer.effectAllowed = 'move'; card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('dragover', event => { event.preventDefault(); card.classList.add('drop-target'); });
      card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
      card.addEventListener('drop', event => {
        event.preventDefault(); card.classList.remove('drop-target');
        if (!draggedId || draggedId === card.dataset.dfmeaRow) return;
        const source = state.dfmeaRows.findIndex(item => item.id === draggedId);
        const target = state.dfmeaRows.findIndex(item => item.id === card.dataset.dfmeaRow);
        const [moved] = state.dfmeaRows.splice(source, 1); state.dfmeaRows.splice(target, 0, moved);
        renderDfmeaRows(); markChanged();
      });
      card.querySelectorAll('[data-dfmea-field]').forEach(field => {
        const update = event => {
          const key = event.target.dataset.dfmeaField;
          row()[key] = ['severity', 'occurrence', 'detection', 'resultSeverity', 'resultOccurrence', 'resultDetection'].includes(key) && event.target.value
            ? riskNumber(event.target.value)
            : event.target.value;
          if (key === 'preventionAction') row().action = event.target.value;
          const riskScore = card.querySelector('[data-dfmea-rpn] b');
          if (riskScore) riskScore.textContent = dfmeaRpn(row()) || '—';
          markChanged();
        };
        field.addEventListener(field.matches('select, input[type="date"]') ? 'change' : 'input', update);
      });
      card.querySelector('[data-dfmea-copy]')?.addEventListener('click', () => {
        const index = state.dfmeaRows.findIndex(item => item.id === card.dataset.dfmeaRow);
        state.dfmeaRows.splice(index + 1, 0, newDfmeaRow({ ...row(), id: `DF-${crypto.randomUUID()}`, status: 'Açık' }));
        renderDfmeaRows(); markChanged();
      });
      card.querySelector('[data-dfmea-delete]')?.addEventListener('click', () => {
        if (state.dfmeaRows.length === 1) return;
        state.dfmeaRows = state.dfmeaRows.filter(item => item.id !== card.dataset.dfmeaRow);
        renderDfmeaRows(); markChanged();
      });
    });
  }

  function audit(kind) {
    const result = readiness(kind);
    const openCount = result.findings.length + result.profileIssues.length;
    global.toast?.(`${kind.toUpperCase()} denetçi kontrolü`, openCount ? `${openCount} zorunlu kanıt/profil bulgusu açık • kapsam ${result.percent}%` : `Zorunlu kanıtların tamamı kayıtlı • kapsam ${result.percent}%`);
    renderGovernance(kind);
    return result;
  }

  function render() {
    renderGovernance('dfmea');
    renderGovernance('pfmea');
    renderDfmeaRows();
  }

  function snapshot() {
    return JSON.parse(JSON.stringify({
      schemaVersion: '1.2.0',
      profiles: state.profiles,
      answers: state.answers,
      questionCatalog: { dfmea: evidenceRows('dfmea'), pfmea: evidenceRows('pfmea') },
      readiness: { dfmea: readiness('dfmea'), pfmea: readiness('pfmea') },
      dfmeaRows: state.dfmeaRows
    }));
  }

  function hydrate(payload = {}) {
    if (payload.profiles) state.profiles = {
      dfmea: { ...profileDefaults('dfmea'), ...(payload.profiles.dfmea || {}) },
      pfmea: { ...profileDefaults('pfmea'), ...(payload.profiles.pfmea || {}) }
    };
    if (payload.answers) state.answers = { dfmea: { ...(payload.answers.dfmea || {}) }, pfmea: { ...(payload.answers.pfmea || {}) } };
    state.dfmeaRows = Array.isArray(payload.dfmeaRows) ? payload.dfmeaRows.map(row => newDfmeaRow(row)) : [];
    render();
  }

  function reset() {
    state.profiles = {
      dfmea: profileDefaults('dfmea'),
      pfmea: profileDefaults('pfmea')
    };
    state.answers = { dfmea: {}, pfmea: {} };
    state.dfmeaRows = [newDfmeaRow()];
    render();
  }

  document.querySelector('[data-fmea-action="add-dfmea-row"]')?.addEventListener('click', () => { state.dfmeaRows.push(newDfmeaRow()); renderDfmeaRows(); markChanged(); });
  document.querySelector('[data-fmea-action="audit-dfmea"]')?.addEventListener('click', () => audit('dfmea'));

  global.TyanaFmea = Object.freeze({ render, snapshot, hydrate, reset, audit, coverage, readiness, evidenceRows, profileIssues, questionCount: kind => questions(kind).length });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
})(globalThis);
