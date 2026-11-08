;
'use strict';
/**
 * Điều phối render — dùng chung cho CLI và UI.
 *
 * Tách từ src/cli/render.js để cửa sổ app và dòng lệnh chạy CÙNG một đường,
 * không phải hai bản logic song song sẽ lệch nhau theo thời gian.
 *
 * Mọi tiến độ báo ra qua callback `onStep`, không print thẳng — nơi gọi tự
 * quyết hiển thị thế nào.
 */
const path = require('node:path');
const fs = require('node:fs');

const { prepareRecordingHtml, khungCuaDeck, kiemKhungHinh } = require('./recordingHtml');
const { OffscreenRecorder, tiLeDiemAnh } = require('./offscreen');
const maNen = require('./maNen');
const { tenVideo } = require('./tenVideo');
const phuDeXuat = require('./phuDeXuat');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Khoảng tốc độ đọc mà app cho phép — xem `chuanTocDo()`. */
const TOC_DO_MIN = 0.5;
const TOC_DO_MAX = 2;
const TOC_DO_MAC_DINH = 1.1;

/**
 * Đưa tốc độ về một số DÙNG ĐƯỢC, và nói ra khi phải sửa.
 *
 * ⚠ CỬA NÀY ĐẶT Ở PIPELINE, KHÔNG Ở Ô NHẬP — cùng lý do với cửa hạn mức bên
 * dưới: `src/cli/render.js` cũng vào bằng hàm này, và đó là đường mà một con AI
 * có quyền chạy lệnh sẽ dùng. Chốt ở giao diện thì đường đó đi vòng qua sạch.
 *
 * Hai kiểu hỏng đã ĐO được (13/09/2026, đo trên chính Chromium của app và trên
 * ffmpeg 7.1.1 đóng gói theo app):
 *
 *   · Dấu phẩy kiểu Việt. `<input type="number">` gặp "1,25" thì coi ô là không
 *     hợp lệ và `.value` trả về CHUỖI RỖNG, nên `Number('' || 1.1)` ra 1.1 —
 *     người dùng gõ 1,25 mà app đọc 1.1, không báo gì. Ở đây đổi phẩy thành
 *     chấm rồi mới đọc.
 *
 *   · Số ngoài khoảng. `min`/`max` của thẻ input KHÔNG chặn `.value` (đặt 5 thì
 *     đọc ra 5). Mà `atempo` của ffmpeg 7.1.1 nhận [0.5, 100]: dưới 0,5 thì ném
 *     "Result too large" — một câu chẳng nhắc gì tới tốc độ — còn TRÊN 2 thì
 *     không lỗi mà lặng lẽ cho ra giọng chuột. Cả hai đều tệ theo kiểu riêng,
 *     nên kẹp về [0.5, 2].
 *
 * KẸP chứ không ném lỗi: gõ 2,5 là ý muốn "nhanh hết cỡ" chứ không phải gõ
 * nhầm, mà một lượt render đã chạy tới đây thì hỏng cả lượt vì một con số là
 * phí. Nhưng PHẢI nói ra — im lặng sửa số của người ta chính là lỗi đang chữa.
 * (Khác `--size`: kích thước sai thì không có giá trị gần nhất nào hợp lý để
 * kẹp, nên `cli/render.js` thoát hẳn.)
 */
function chuanTocDo(raw) {
  // Không truyền gì = dùng mặc định, đây là chuyện bình thường, đừng cảnh báo.
  if (raw == null || raw === '') return { toc: TOC_DO_MAC_DINH, ly: null };
  const chu = typeof raw === 'string' ? raw.trim().replace(',', '.') : raw;
  const n = Number(chu);
  // Không ra số nào cả — khác hẳn "ra số nhưng ngoài khoảng", nên câu báo cũng
  // phải khác: người gõ "abc" cần biết app không hiểu, người gõ "0" cần biết
  // app hiểu nhưng số đó quá thấp.
  if (!Number.isFinite(n)) return { toc: TOC_DO_MAC_DINH, ly: `không đọc được "${raw}"` };
  if (n < TOC_DO_MIN) return { toc: TOC_DO_MIN, ly: `${n} thấp hơn mức thấp nhất ${TOC_DO_MIN}` };
  if (n > TOC_DO_MAX) return { toc: TOC_DO_MAX, ly: `${n} cao hơn mức cao nhất ${TOC_DO_MAX}` };
  return { toc: n, ly: null };
}

function parseSize(raw) {
  const m = /^(\d+)\s*[x:]\s*(\d+)$/.exec(String(raw || '').trim());
  if (m) return { width: +m[1], height: +m[2] };
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return { width: n, height: Math.round((n * 16) / 9) };
  throw new Error(`Kích thước không hợp lệ: ${raw}`);
}

/**
 * @param {object} o
 *  - py: PythonSidecar đã start()
 *  - projectDir
 *  - engine 'edge'|'elevenlabs'|'beeknoee'|'vieneu' (giọng trên máy)|'upload' · speed · size · quality · voice · audioPath
 *  - subtitles · skipValidation · realign
 *  - onStep(phase, message, extra)  · shouldCancel() -> boolean
 */
async function runRender(o) {
  const { py, projectDir } = o;

  const batDauLuc = Date.now();
  const mocChang = [];
  let changDangChay = null;
  const baoTiep = o.onStep || (() => {});
  const onStep = (phase, message, extra) => {
    const bay = Date.now() - batDauLuc;
    if (phase && phase !== changDangChay) {
      const truoc = mocChang[mocChang.length - 1];
      if (truoc) truoc.den = bay;
      /* Chặng ĐẦU tính từ mốc 0, không phải từ lúc nó lên tiếng: `project.read`
         và cửa hạn mức chạy XONG rồi mới có onStep đầu tiên. Không kéo về 0
         thì bước "Chuẩn bị dự án" luôn hiện 0s trong khi nó làm thật. */
      mocChang.push({ ma: phase, tu: mocChang.length ? bay : 0, den: bay });
      changDangChay = phase;
    } else if (mocChang.length) {
      mocChang[mocChang.length - 1].den = bay;
    }
    return baoTiep(phase, message, extra);
  };
  /* Chặng cuối cùng KHÔNG tự đóng được: `onStep('mux', …)` kêu lúc BẮT ĐẦU
     ghép rồi im cho tới khi xong, nên không chốt là bước "Xuất video" ghi 0s
     đúng cái bước tốn nhiều giây nhất sau quay hình. */
  const chotMoc = () => {
    const cuoi = mocChang[mocChang.length - 1];
    if (cuoi) cuoi.den = Date.now() - batDauLuc;
  };
  const shouldCancel = o.shouldCancel || (() => false);
  const outputDir = path.join(projectDir, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  const { width, height } = parseSize(o.size || '1080x1920');

  const bail = () => {
    if (shouldCancel()) {
      const e = new Error('Đã huỷ theo yêu cầu');
      e.cancelled = true;
      throw e;
    }
  };

  // Chặn sớm: engine "upload" mà không có file thì Python vỡ ở `Path(None)` với
  // "argument should be a str or an os.PathLike object ... not 'NoneType'" —
  // một câu chẳng nhắc gì tới voiceover, đọc xong vẫn không biết thiếu cái gì.
  if ((o.engine || 'edge') === 'upload' && !o.audioPath) {
    throw new Error('Chế độ "Tải file" cần một file voiceover — chưa nhận được đường dẫn file.');
  }

  /* Cửa chốt KHỔ VIDEO — deck dọc mà dựng khung ngang (hoặc ngược lại) thì
     video ra bị cắt mất phần lớn hình mà KHÔNG có lỗi nào báo. Đo 15/09/2026:
     deck dọc ở 1920×1080 chỉ còn 31,7 % hình, mất 2.332px phía dưới.

     ⚠ ĐẶT Ở ĐÂY, TRƯỚC BƯỚC GIỌNG ĐỌC. Bước dựng trang (`prepareRecordingHtml`)
     nằm mãi sau TTS và Whisper — chặn ở đó thì người dùng đã tốn tiền đọc và
     vài phút căn chữ rồi mới biết mình chọn nhầm khổ. Một lần đọc `index.html`
     ở đây là đủ, và nó rẻ. */
  const khungDeck = khungCuaDeck(projectDir);
  kiemKhungHinh(khungDeck, width, height);

  /* Cửa chốt TỐC ĐỘ — xem chú thích dài ở `chuanTocDo()`. */
  const { toc: tocDo, ly: tocDoSua } = chuanTocDo(o.speed);

  let recorder = null;
  let luotDaGiu = null;
  let xong = false;
  try {
    const project = await py.call('project.read', { projectPath: projectDir });

    // CỬA HẠN MỨC. Đặt ở đây chứ không ở nút bấm giao diện: `src/cli/render.js`
    // cũng vào bằng hàm này, và đó là đường mà một con AI có quyền chạy lệnh sẽ
    // dùng. Chốt ở giao diện thì đường đó đi vòng qua sạch. Xem src/auth/quota.js.
    if (o.kiemHanMuc !== false) {
      const { xinPhep } = require('../auth/quota');
      const q = await xinPhep({
        project: path.basename(projectDir),
        slides: project.lines.length,
        appVersion: o.appVersion,
      });
      // Nhớ số lượt vừa giữ chỗ để TRẢ LẠI nếu render hỏng (xem khối finally).
      luotDaGiu = q.renderId || null;
      if (q.conLai != null) {
        onStep('project', `Gói miễn phí, còn ${q.conLai} lượt tạo video`, { conLai: q.conLai });
      }
    }

    onStep('project', `${project.lines.length} slide`, { sentenceCounts: project.sentenceCounts });
    bail();

    // 1 — giọng đọc
    onStep('tts', `Tạo giọng đọc (${o.engine || 'edge'})`);
    if (tocDoSua) onStep('tts', `CẢNH BÁO: tốc độ ${tocDoSua} — dùng ${tocDo} thay vào`);
    const tts = await py.call(
      'tts.generate',
      {
        projectPath: projectDir,
        outputDir,
        engine: o.engine || 'edge',
        /* Mặc định giọng CHỈ cho Edge. Bản trước gán 'vi-VN-HoaiMyNeural' cho
           mọi engine: ElevenLabs (nay đọc `voice` làm Voice ID) nhận một ID
           không tồn tại → "Giọng đọc đang chọn không còn trên ElevenLabs", và
           khoá cache đổi. Provider khác tự có mặc định (Beeknoee: Kore;
           ElevenLabs: voice_id trong tts.json). */
        voice: o.voice || ((o.engine || 'edge') === 'edge' ? 'vi-VN-HoaiMyNeural' : null),
        speed: tocDo,
        audioPath: o.audioPath || null,
        // Model Beeknoee Platform (engine 'beeknoee'); engine khác bỏ qua.
        modelId: o.modelId || null,
        // Ô tick "Tạo lại giọng đọc": bỏ qua cache, đọc lại từ đầu.
        // Trước đây giá trị này bị rơi ở api-shim nên ô tick không làm gì cả.
        force: !!o.force,
        // Đọc số / ngày / đơn vị thành chữ trước khi gửi giọng đọc (python/tts/chuan_hoa.py).
        chuanHoaSo: o.chuanHoaSo !== false,
        /* Khoá ElevenLabs do main giải mã và bơm xuống theo TỪNG lượt.
           Không nằm trong `config/tts.json` nữa, cũng không đi qua biến môi
           trường — xem chú thích ở `tts:elevenSave` trong main.js. */
        apiKey: o.apiKey || null,
      },
      20 * 60 * 1000
    );
    bail();

    // 2 — cắt theo slide (dùng khoá nếu còn hiệu lực)
    onStep('split', 'Cắt giọng đọc theo slide');
    const split = await py.call(
      'voiceover.split',
      { projectPath: projectDir, outputDir, audioPath: tts.audioPath, forceRealign: !!o.realign },
      30 * 60 * 1000
    );
    onStep('split', split.usedLock ? 'Dùng lại căn chỉnh đã khoá' : 'Căn chỉnh mới', {
      splitPoints: split.splitPoints,
      sanity: split.sanity,
    });
    if (split.sanity && !split.sanity.ok && !o.skipValidation) {
      const e = new Error(split.sanity.issues.map((i) => i.message).join(' · '));
      e.kind = 'E_ALIGN';
      e.issues = split.sanity.issues;
      throw e;
    }
    bail();

    // 3 — phụ đề
    let subtitleData = null;
    if (o.subtitles !== false) {
      onStep('subtitle', 'Dựng phụ đề karaoke');
      /* Deck không khai `subtitles.maxLines` (deck cũ thiếu preview-settings.json)
         thì lấy mặc định THEO KHỔ: dọc 1, ngang 2 — đúng luật trong AGENTS.md
         (chốt 24/09/2026). Trước đây mặc định 2 cho mọi khổ: deck dọc thiếu tệp
         thiết lập ra cụm dài tới 62 ký tự, mà bộ ghi không thu nhỏ chữ khi
         maxLines > 1 (`fitSubtitleLine` trong recordingHtml.js) nên chữ tràn
         mép khung 390px. Con số chỉ đổi ĐỘ DÀI cụm (python/subtitle_timing.py
         `caption_constraints`), video vẫn luôn một hàng chữ. */
      const maxLines = Number(project.previewSettings?.subtitles?.maxLines)
        || (khungDeck.ma === 'ngang' ? 2 : 1);
      const sub = await py.call('subtitle.karaoke', { outputDir, maxLines }, 30 * 60 * 1000);
      subtitleData = sub.subtitleData;
      onStep('subtitle', `${subtitleData.captions.length} caption`, { mode: sub.mode });
    }
    /* ĐỐT phụ đề vào hình hay không — KHÁC với việc có dựng phụ đề hay không.
       `--no-subtitles` tắt hẳn: không dựng, không có gì để xuất `.srt`.
       `--no-burn-subtitles` vẫn dựng (nên vẫn ra `.srt`) mà không vẽ lên hình —
       đúng thứ YouTube cần: người xem tự bật/tắt, và Google đọc được chữ. */
    /* Người dùng TẮT phụ đề (nút 👁 track C1 / `subtitles.enabled: false` trong preview-settings.json):
       không đốt. Trước 16/10/2026 cờ này chỉ ẩn phụ đề ở XEM TRƯỚC (engine) — app luôn gửi
       `subtitles: true` và trang quay không đọc cờ đó, nên tắt rồi mà video vẫn có phụ đề. */
    const tatTay = project.previewSettings?.subtitles?.enabled === false;
    const dotPhuDe = !!subtitleData && o.dotPhuDe !== false && !tatTay;
    if (subtitleData && !dotPhuDe) onStep('subtitle', tatTay ? 'Phụ đề đang TẮT — không đốt vào hình, chỉ xuất tệp .srt'
      : 'Không đốt vào hình — chỉ xuất tệp .srt');
    bail();

    // 4 — dựng trang + đếm reveal
    onStep('page', 'Dựng trang ghi hình');
    /* Màn hình Retina: trang được dựng ở kích thước CSS = đích ÷ tỉ lệ, còn
       bitmap và video ra vẫn đúng width×height — xem tiLeDiemAnh(). */
    const tiLe = tiLeDiemAnh(width, height);
    if (tiLe !== 1) onStep('page', `Màn hình tỉ lệ ${tiLe}× — cửa sổ ghi ${width / tiLe}×${height / tiLe} CSS`);
    /* CHỈ báo khi deck khác khổ mặc định. Deck dọc giữ nguyên nhật ký như cũ —
       đường shorts không được đổi dù chỉ một dòng log. */
    if (khungDeck.ma !== 'doc') onStep('page', `Khổ ${khungDeck.ten} — khung slide ${khungDeck.w}×${khungDeck.h}`);
    const htmlPath = prepareRecordingHtml(projectDir, {
      // Dùng LẠI khổ đã đọc ở đầu lượt, không đọc lại file: hai chỗ đọc riêng
      // là có ngày kiểm một đằng dựng một nẻo.
      khung: khungDeck,
      videoWidth: width / tiLe,
      videoHeight: height / tiLe,
      outName: '_recording.html',
      subtitleData: dotPhuDe ? subtitleData : null,
      onFontRewrite: (r) => onStep('page', r.available ? 'Font offline' : 'CẢNH BÁO: thiếu font bundle'),
      onEngineRewrite: (r) =>
        onStep('page', r.replaced ? `Engine chung v${r.version}` : 'Deck dùng app.js riêng'),
    });

    /* PHỤ ĐỀ TÁCH LỚP (Giai đoạn 3 trình dựng, src/render/phuDeLop.js): vẽ lớp phụ đề ra ảnh
       từ CHÍNH trang quay này, quay KHÔNG phụ đề, sau bước ghép mới chồng lớp lên. Được thêm bản
       `<deck>.nophude.mp4` cho trình dựng sửa phụ đề. Hỏng ở đây ⇒ lùi về đường cũ (đốt DOM lúc
       quay) — lượt dựng không hỏng vì tính năng này. */
    let lopPhuDe = null;
    const thuMucPhuDe = path.join(outputDir, 'phu-de');
    /* Vẽ vào thư mục TẠM, chỉ thay `phu-de/` khi cả lượt xong: lượt hỏng / huỷ giữa chừng mà đã
       ghi đè `phu-de/` là phụ đề lượt mới nằm trên video lượt cũ (audit GĐ3). */
    const thuMucPhuDeTam = path.join(outputDir, 'phu-de.tam');
    if (dotPhuDe && o.phuDeTachLop !== false) {
      try {
        onStep('subtitle', 'Vẽ lớp phụ đề');
        lopPhuDe = await require('./phuDeLop').vePhuDeLop({
          htmlPath, width, height, cssScale: tiLe, captions: subtitleData.captions, outDir: thuMucPhuDeTam, shouldCancel,
        });
        fs.writeFileSync(path.join(thuMucPhuDeTam, 'phude.json'), JSON.stringify(subtitleData), 'utf8');
        /* Ghi kèm KIỂU phụ đề lúc dựng (bản thô của preview-settings.json) — trình dựng so với kiểu hiện tại
           để biết biến của lượt dựng còn đúng không (src/dung/phuDeCss.js). So mtime thì đổi đèn / nhạc cũng
           tính là "đổi kiểu", và ổ FAT (mtime 2 s) đọc nhầm (rà GĐ1). */
        try {
          const tepLop = path.join(thuMucPhuDeTam, 'lop.json');
          const lopJ = JSON.parse(fs.readFileSync(tepLop, 'utf8'));
          lopJ.kieuLucDung = require('../dung/phuDeCss').dauKieu(projectDir);
          fs.writeFileSync(tepLop, JSON.stringify(lopJ), 'utf8');
        } catch { /* thiếu thì phuDeCss lùi về so mtime */ }
        onStep('subtitle', `Phụ đề tách lớp: ${lopPhuDe.soAnh} trạng thái`);
      } catch (e) {
        if (e && e.cancelled) throw e;
        lopPhuDe = null;
        onStep('subtitle', `Không tách được lớp phụ đề (${(e && e.message) || e}) — đốt phụ đề lúc quay như cũ`);
      }
    }
    bail();

    /* Bộ nén: trên Mac thử VideoToolbox (phần cứng Apple) trước, hỏng thì
       libx264 như cũ — xem maNen.js. Ghi tên vào log để ai đọc log hỗ trợ
       biết máy khách đang nén bằng gì. */
    const boNen = await maNen.chonBoNen();
    onStep('page', `Bộ nén video: ${boNen.nhan}`);
    recorder = new OffscreenRecorder({
      width,
      height,
      fps: 30,
      htmlPath,
      outFile: path.join(outputDir, 'intermediate.mp4'),
      muteAudio: true,
      blockNetwork: true,
      cssScale: tiLe,
      encodeArgs: maNen.thamSoQuay(boNen, width, height, 30),
    });
    await recorder.open();

    const revealUnits = await recorder.js(`
      Array.from(document.querySelectorAll('.slide')).map((slide) => {
        let count = slide.querySelectorAll('.slide-element').length;
        if (slide.dataset.mode === 'highlight') count += slide.querySelectorAll('.highlightable').length;
        if (slide.dataset.mode === 'traffic-light') count += slide.querySelectorAll('.lightable').length;
        return count;
      })
    `);
    onStep('page', `Reveal units ${JSON.stringify(revealUnits)}`, { revealUnits });

    const fontCheck = await recorder.js(`
      (async () => { await document.fonts.ready;
        const l = new Set(); document.fonts.forEach(f => { if (f.status === 'loaded') l.add(f.family); });
        return { daNap: [...l], dungFA: !!document.querySelector('[class*="fa-"]') }; })()
    `);
    /* ⚠ CHỈ ĐÒI FONT MÀ DECK THẬT SỰ DÙNG. Bản cũ đòi cứng cả `Font Awesome 6
       Free`, nên deck không có icon nào vẫn bị báo thiếu — một cảnh báo SAI, và
       cảnh báo sai thì người ta quen bỏ qua cảnh báo. Lộ ra ở mẫu ngang đầu
       tiên (15/09/2026), vốn thuần chữ.
       Dò bằng lớp `fa-` trong DOM chứ không dò thẻ `<link>`: `rewriteFontLinks`
       đã đổi link sang bản đóng gói nên đường dẫn không còn nhận ra được. */
    const canFont = ['Inter', ...(fontCheck.dungFA ? ['Font Awesome 6 Free'] : [])];
    const missing = canFont.filter((f) => !fontCheck.daNap.includes(f));
    if (missing.length) onStep('page', `CẢNH BÁO font chưa nạp: ${missing.join(', ')}`);
    bail();

    // 5 — timeline
    onStep('timeline', 'Tính timeline');
    const tl = await py.call('timeline.build', { projectPath: projectDir, outputDir, revealUnits });
    if (tl.mappingErrors.length && !o.skipValidation) {
      const e = new Error(tl.mappingErrors.join(' · '));
      e.kind = 'E_MAPPING';
      e.issues = tl.mappingErrors;
      throw e;
    }
    onStep('timeline', `${tl.timeline.length} sự kiện · giọng đọc ${tl.voiceoverDuration}s`, {
      voiceoverDuration: tl.voiceoverDuration,
      mappingErrors: tl.mappingErrors,
    });
    bail();

    // 6 — quay (thời gian thực)
    const totalMs =
      Math.max(tl.timeline[tl.timeline.length - 1].time + 0.5, tl.voiceoverDuration + 0.5) * 1000;
    /* ⚠ Lưới cho lớp lỗi "video 3 phút thành 19 phút": timeline có thể bị kéo
       dài hơn giọng đọc rất nhiều bởi DỮ LIỆU deck (video nền dài + cài đặt
       preferVideoDurationSlides, tệp tiếng chọn nhầm…). App vẫn quay đúng như
       được bảo — nhưng phải NÓI RA trước khi đốt ngần ấy phút quay thời gian
       thực, để người dùng dừng sớm và biết sửa ở đâu thay vì nhận một video
       dài gấp sáu lần rồi đi hỏi vì sao. Khách Mac đã dính đúng cảnh này. */
    {
      const giay = totalMs / 1000;
      const tieng = Number(tl.voiceoverDuration) || 0;
      if (tieng > 1 && giay > tieng * 1.5 + 30) {
        onStep('record',
          `CẢNH BÁO: thời lượng quay ${(giay / 60).toFixed(1)} phút, dài hơn hẳn giọng đọc `
          + `${(tieng / 60).toFixed(1)} phút — kiểm tra video nền của slide hoặc cài đặt kéo slide theo video. `
          + `Bấm Dừng tạo nếu không chủ ý.`);
      }
    }
    onStep('record', `Đang quay ${(totalMs / 1000).toFixed(1)}s (thời gian thực)`, {
      totalMs,
      realtime: true,
    });

    recorder.startEncoder();
    /* Cú click mồi chỉ dành cho deck chờ click mới hé lộ (starter). Deck kiểu
       cũ (Giá vàng TIN-01 và anh em) TỰ hé lộ đơn vị 1 ngay khi nạp trang —
       mồi thêm là lệch cả video đi một nhịp và mất hẳn slide mở đầu. */
    const daTuHien = await recorder.js('!!document.querySelector(".slide-element.visible")');
    if (!daTuHien) recorder.click();
    await sleep(600);
    const audioState = await recorder.js('window.__audioProbe ? window.__audioProbe().ctxState : null');
    if (audioState !== 'running') await recorder.js('window.__resumeAudioContext()');
    await recorder.js('window.__enableSilentKeepAlive()');
    await recorder.js('window.__armSlideAudioRecording()');
    if (dotPhuDe && !lopPhuDe) await recorder.js('window.__startScriptSubtitles && window.__startScriptSubtitles()');

    /* ⚠ TỪNG CHỤP ẢNH BÌA Ở ĐÂY (đường A) — gỡ 13/09/2026 cùng với ảnh đại diện
       ở bảng danh sách dự án, xem CONTEXT §6.5E. Rẻ thật (2,5 ms, lấy đúng khung
       bộ ghi đang cầm, không mở thêm cửa sổ) nhưng nay không còn ai nhìn tấm
       ảnh ấy. Nếu đưa ảnh đại diện trở lại thì chỗ này vẫn là ĐÚNG CHỖ: slide 1
       vừa bày xong và phải đặt TRƯỚC `startPacer()` — từ lúc pacer chạy, mỗi
       khung trượt là một khung hụt trong video thật. */
    recorder.startPacer();
    const startedAt = Date.now();
    for (const ev of tl.timeline.slice(1)) {
      const wait = ev.time * 1000 - (Date.now() - startedAt);
      if (wait > 0) await sleep(Math.min(wait, 250));
      while (Date.now() - startedAt < ev.time * 1000) {
        if (shouldCancel()) break;
        await sleep(20);
      }
      if (shouldCancel()) break;
      recorder.click();
      onStep('record', null, { progress: (Date.now() - startedAt) / totalMs });
    }
    while (Date.now() - startedAt < totalMs && !shouldCancel()) {
      await sleep(200);
      onStep('record', null, { progress: (Date.now() - startedAt) / totalMs });
    }

    if (dotPhuDe && !lopPhuDe) await recorder.js('window.__stopScriptSubtitles && window.__stopScriptSubtitles()');
    const b64 = await recorder.js('window.__stopSlideAudioRecording()');
    const slideAudioPath = path.join(outputDir, 'slide_audio.webm');
    if (b64) fs.writeFileSync(slideAudioPath, Buffer.from(b64, 'base64'));
    /* Máy chậm có thể đứng ở đây cả phút (xả nốt khung hình tồn trong ống) —
       phải nói ra, không thì trông như treo. */
    onStep('record', 'Đang nén nốt và đóng tệp ghi hình…');
    let stats;
    try {
      stats = await recorder.stop();
    } catch (e) {
      /* Bộ nén phần cứng hỏng giữa lượt (rất hiếm: driver, máy ảo…) — lượt
         sau trong phiên này về libx264, người dùng chỉ việc bấm tạo lại. */
      if (boNen.ten !== 'libx264') maNen.danhDauHong(e && e.message);
      throw e;
    }
    /* 0 khung = tệp ghi hình rỗng. Không chặn ở đây thì bước ghép nổ với một
       tường chữ ffmpeg vô nghĩa. Đã gặp thật trên Mac Retina khi bitmap về sai
       kích thước (xem enableDeviceEmulation trong offscreen.js). */
    if (!stats.framesWritten) {
      throw new Error(
        'Bộ ghi không nhận được khung hình nào'
        + (stats.partialFrameBytes ? ` (khung nhận về ${stats.partialFrameBytes} byte, mong đợi ${width * height * 4})` : '')
        + ' — thử lại; nếu vẫn vậy hãy gửi log này cho hỗ trợ.'
      );
    }
    recorder = null;
    onStep('record', `${stats.framesWritten} frame · ${stats.throughputMBs} MB/s`, { stats });
    /* Hụt khung = video sẽ ngắn hơn thời gian quay thật. Bước ghép bên dưới
       nhận số đo này để giãn video cho khớp tiếng; ở đây chỉ NÓI RA — trước
       đây hụt bao nhiêu cũng im lặng, người dùng chỉ biết khi phụ đề trôi. */
    {
      const hut = stats.durationS - stats.framesWritten / 30;
      if (hut > 0.5) {
        onStep('record', `CẢNH BÁO: máy ghi hụt ${hut.toFixed(1)}s khung hình — video sẽ được giãn lại cho khớp tiếng`);
      }
    }
    bail();

    // 7 — ghép
    onStep('mux', 'Ghép video + âm thanh');
    const mux = await py.call(
      'render.mux',
      {
        rawVideo: path.join(outputDir, 'intermediate.mp4'),
        ttsAudio: tl.ttsPath,
        slideAudio: fs.existsSync(slideAudioPath) ? slideAudioPath : null,
        outputPath: path.join(outputDir, tenVideo(path.basename(projectDir))),
        quality: o.quality || 'quality',
        fps: 30,
        /* Số đo THẬT của bộ ghi — để bước ghép giãn video khớp thời gian quay,
           thay vì tin lời hứa 30fps. Xem keo_dai trong ffmpeg_mux.py. */
        giayGhiThat: stats.durationS,
        khungDaGhi: stats.framesWritten,
        // Bộ nén cho bước ghép (VideoToolbox nếu quay bằng nó); Python tự lùi
        // về libx264 nếu ghép hỏng — xem ffmpeg_mux.py.
        boNen: maNen.thamSoGhep(boNen, o.quality || 'quality', width, height, 30),
      },
      30 * 60 * 1000
    );
    try {
      fs.unlinkSync(path.join(outputDir, 'intermediate.mp4'));
    } catch { /* bỏ qua */ }

    /* CHUẨN ÂM LƯỢNG -14 LUFS (src/render/amLuong.js) — ngay sau bước ghép, TRƯỚC khi tách bản
       không phụ đề: cả `<deck>.mp4` lẫn `.nophude.mp4` (nền của trình dựng) cùng một độ lớn. */
    let amLuong = null;
    if (o.chuanAmLuong !== false) {
      onStep('mux', 'Chuẩn âm lượng');
      const aL = require('./amLuong');
      amLuong = await aL.chuanAmLuong({
        ffmpeg: path.join(require('../config').ffmpegDir() || '', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
        tep: mux.videoPath, tanSo: 44100, shouldCancel,
      });
      onStep('mux', aL.moTa(amLuong));
      try { mux.sizeBytes = fs.statSync(mux.videoPath).size; } catch { /* giữ số cũ */ }
    }

    /* Phụ đề tách lớp: video vừa ghép CHƯA có phụ đề → giữ làm `<deck>.nophude.mp4`, chồng lớp
       ra `<deck>.mp4` như mọi lần. Lượt không tách lớp thì xoá bản nophude / lớp CŨ (của lượt
       trước) — để lại là trình dựng ghép phụ đề cũ vào hình mới. */
    const tenNoPhuDe = tenVideo(path.basename(projectDir)).replace(/\.mp4$/i, '.nophude.mp4');
    const fileNoPhuDe = path.join(outputDir, tenNoPhuDe);
    /* Đổi tên có thử lại: trình dựng / sân khấu có thể còn giữ `.nophude.mp4` (Windows EPERM). */
    const doiTen = async (tu, den) => {
      let loi;
      for (let lan = 0; lan < 12; lan += 1) {
        try { if (fs.existsSync(den)) fs.unlinkSync(den); fs.renameSync(tu, den); return; } catch (e) {
          loi = e;
          if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) break;
          await new Promise((r) => setTimeout(r, 250));
        }
      }
      throw loi;
    };
    if (lopPhuDe) {
      onStep('mux', 'Chồng phụ đề lên video');
      const tam = mux.videoPath.replace(/\.mp4$/i, '.pd-tam.mp4');
      try {
        const ff = path.join(require('../config').ffmpegDir() || '', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
        await require('./phuDeLop').chongPhuDe({ ffmpeg: ff, video: mux.videoPath, lop: lopPhuDe, ra: tam, shouldCancel });
        await doiTen(mux.videoPath, fileNoPhuDe);
        try {
          await doiTen(tam, mux.videoPath);
        } catch (e) {
          // Trả bản không phụ đề về chỗ cũ rồi mới báo — đừng để deck mất video.
          try { await doiTen(fileNoPhuDe, mux.videoPath); } catch { /* bỏ */ }
          throw e;
        }
        mux.sizeBytes = fs.statSync(mux.videoPath).size;
        fs.rmSync(thuMucPhuDe, { recursive: true, force: true });
        fs.renameSync(thuMucPhuDeTam, thuMucPhuDe);
      } catch (e) {
        if ((e && e.cancelled) || shouldCancel()) throw e;
        /* Video đã quay KHÔNG phụ đề — không còn đường đốt DOM để lùi. Giữ video (quay lại mất
           cả buổi), báo rõ, bỏ dấu nophude — trình dựng không nhận một cặp nửa vời. */
        lopPhuDe = null;
        try { fs.unlinkSync(tam); } catch { /* không có */ }
        onStep('mux', `⚠ Không chồng được phụ đề lên video (${(e && e.message) || e}) — video này KHÔNG có phụ đề, bấm "Tạo video" lại để có phụ đề.`);
      }
    }
    if (!lopPhuDe) {
      // (Còn video chính mới xoá bản nophude — lượt đổi tên hỏng có thể chỉ còn mỗi bản đó.)
      if (fs.existsSync(mux.videoPath)) { try { fs.unlinkSync(fileNoPhuDe); } catch { /* không có */ } }
      try { fs.rmSync(thuMucPhuDe, { recursive: true, force: true }); } catch { /* bỏ */ }
    }
    try { fs.rmSync(thuMucPhuDeTam, { recursive: true, force: true }); } catch { /* bỏ */ }

    /* ── Phụ đề .srt + danh sách chương, cạnh file MP4 ─────────────────────
       Hai tệp này KHÔNG đụng gì tới video — ai không cần thì bỏ qua. Vì thế
       ghi cho CẢ video dọc: deck dọc đăng lên YouTube Shorts cũng dùng được,
       và không việc gì bắt người dùng phải chọn thêm một thứ nữa.
       Nuốt lỗi: hai tệp phụ không được phép làm hỏng một lượt render đã xong. */
    const tenGoc = tenVideo(path.basename(projectDir)).replace(/\.mp4$/i, '');
    try {
      if (subtitleData) {
        const srt = phuDeXuat.dungSrt(subtitleData.captions);
        if (srt) {
          fs.writeFileSync(path.join(outputDir, `${tenGoc}.srt`), srt, 'utf8');
          onStep('mux', `Phụ đề: ${tenGoc}.srt`);
        }
      }
      const chuong = phuDeXuat.dungChuong(tl.renderTiming);
      if (chuong) {
        fs.writeFileSync(path.join(outputDir, `${tenGoc}.chuong.txt`), chuong, 'utf8');
        onStep('mux', `Chương YouTube: ${tenGoc}.chuong.txt (${phuDeXuat.demChuong(chuong)} mốc)`);
      }
    } catch (e) {
      onStep('mux', `CẢNH BÁO: không ghi được tệp phụ đề/chương — ${e?.message || e}`);
    }

    // Ghi hồ sơ video cạnh file MP4.
    //
    // Độ dài, độ phân giải, giọng đọc, tốc độ — chỉ chỗ này biết. Không ghi lại
    // thì lần sau mở app muốn hiện thông tin phải chạy ffprobe, mà mấy thứ như
    // "render bằng giọng nào" thì ffprobe cũng chịu.
    //
    // `buoc` cũng vậy: máy khách đo được từng bước mất bao lâu, nhưng số đó
    // sống trong bộ nhớ trang và chết ngay khi đóng app. Ghi vào đây thì mở
    // lại deck cũ vẫn thấy đúng thời gian của lượt đã chạy — xem napMocTuHoSo()
    // ở ui-classic/render/jobs.js.
    chotMoc();
    /* DẤU của các tệp đầu vào trình dựng (src/dung/xuat.js#dauVaoDeck): mốc slide + hai lớp
       tiếng tách sẵn được ghi TRƯỚC video ở trên — lượt dựng lại hỏng/huỷ giữa chừng để lại
       tệp MỚI cạnh video CŨ. Ghi lại cỡ (+ băm timing.json) của đúng bộ đi cùng video này để
       trình dựng biết bộ nào khớp (audit 10/10/2026). */
    const dauTep = (ten, bam) => {
      try {
        const f = path.join(outputDir, ten);
        const st = fs.statSync(f);
        const ra = { size: st.size };
        if (bam) ra.sha = require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
        return ra;
      } catch { return null; }
    };
    /* Giọng: ĐÚNG tệp bước ghép đã dùng (`tl.ttsPath`). `voiceover_concat_render.mp3` chỉ được
       ghi khi phải đệm khoảng lặng — lượt không cần đệm để lại bản CŨ của lượt trước; ghi cỡ
       của tệp đó là trình dựng nhận giọng cũ ghép vào hình mới (audit 10/10/2026). */
    const tenGiong = tl && tl.ttsPath ? path.basename(tl.ttsPath) : null;
    const dauVaoDung = {
      timing: dauTep('timing.json', true),
      giong: tenGiong && path.dirname(path.resolve(tl.ttsPath)) === path.resolve(outputDir)
        ? (dauTep(tenGiong) ? { ...dauTep(tenGiong), ten: tenGiong } : null) : null,
      deckAm: dauTep('slide_audio.webm'),
      // Bản video KHÔNG phụ đề (phụ đề tách lớp) — trình dựng chỉ dùng khi cỡ khớp.
      nophude: lopPhuDe && dauTep(tenNoPhuDe) ? { ...dauTep(tenNoPhuDe), ten: tenNoPhuDe } : null,
      // Dữ liệu phụ đề CỦA lượt này — phụ đề đã sửa trong trình dựng ghi lại băm này để biết mình thuộc lượt nào.
      phude: lopPhuDe ? dauTep(path.join('phu-de', 'phude.json'), true) : null,
    };
    try {
      fs.writeFileSync(
        path.join(outputDir, tenVideo(path.basename(projectDir)).replace(/\.mp4$/i, '.info.json')),
        JSON.stringify({
          deck: path.basename(projectDir),
          file: path.basename(mux.videoPath),
          duration: mux.duration,
          sizeBytes: mux.sizeBytes,
          width,
          height,
          slides: project.lines.length,
          engine: o.engine || 'edge',
          voice: o.voice || '',
          speed: tocDo,
          taoLuc: new Date().toISOString(),
          // Mili giây tính từ lúc bấm Tạo video. Giao diện gộp các chặng này
          // lại thành 5 bước hiện cho người dùng (stepIndexForPhase).
          buoc: mocChang,
          tongMs: Date.now() - batDauLuc,
          dauVaoDung,
          amLuong: amLuong ? { truocLufs: amLuong.truoc && amLuong.truoc.i, sauLufs: amLuong.sau ? amLuong.sau.i : null, daChuan: amLuong.daChuan } : null,
        }, null, 2) + '\n',
        'utf8'
      );
    } catch { /* không ghi được thì bảng thông tin lùi về đọc mỗi thuộc tính file */ }

    onStep('done', `Xong · ${mux.duration.toFixed(2)}s · ${(mux.sizeBytes / 1024 / 1024).toFixed(1)} MB`, {
      videoPath: mux.videoPath,
      duration: mux.duration,
      sizeBytes: mux.sizeBytes,
    });
    xong = true;
    // Lượt tiêu THẬT — gạch khỏi sổ chờ-trả, kẻo lần mở app sau hoàn nhầm
    // một lượt đã ra video đàng hoàng. Xem sổ trong auth/quota.js.
    if (luotDaGiu) {
      try { require('../auth/quota').xacNhanXong(luotDaGiu); } catch { /* lưới đỡ */ }
    }
    return mux;
  } catch (e) {
    /* Bước Python bị dừng theo yêu cầu (render.cancel — Phase 4.3) tới đây dưới
       dạng lỗi RPC kèm data.cancelled; và mọi lỗi khác xảy ra SAU khi người dùng
       bấm Dừng cũng là "đã dừng" chứ không phải "hỏng" — đừng báo đỏ oan. */
    if (e && !e.cancelled && (shouldCancel() || (e.data && e.data.cancelled))) e.cancelled = true;
    throw e;
  } finally {
    if (recorder) {
      try {
        await recorder.stop();
      } catch { /* bỏ qua */ }
    }
    // Render KHÔNG tới đích thì trả lại lượt đã giữ. Gói miễn phí chỉ có ít lượt
    // — để lỗi kỹ thuật ăn mất một lượt là tính tiền người dùng cho lỗi của ta.
    if (!xong && luotDaGiu) {
      const { traLuot } = require('../auth/quota');
      await traLuot(luotDaGiu);
    }
  }
}

module.exports = { runRender, parseSize, chuanTocDo, TOC_DO_MIN, TOC_DO_MAX, TOC_DO_MAC_DINH }