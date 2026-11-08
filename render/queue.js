;
'use strict';
const { app, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { runRender } = require('./pipeline');
const { khoaCho } = require('../providers');

/**
 * Lượt dựng: jobState (nguồn sự thật), hàng đợi tuần tự, chayMotLuot, IPC render:*.
 *
 * Tách từ main.js (02/09/2026, audit Phase 2.4/2.5). Cơ chế: main.js dựng `ctx`
 * (app, send, mainWindow(), sidecar()…) rồi gọi dangKy(ctx) từng module theo thứ
 * tự; hàm/hằng module này trả về được gộp vào ctx để module khác gọi qua
 * `ctx.tên`. Handler IPC đăng ký ngay trong dangKy — main.js gọi trước whenReady.
 */
function dangKy(ctx) {
  /** Chỉ MỘT job render cùng lúc: bước quay chiếm gần hết CPU và chạy thời gian thực. */
  /**
   * Trạng thái render, GIỮ Ở TIẾN TRÌNH CHÍNH — nguồn sự thật.
   *
   * ⚠ Vì sao không để riêng renderer giữ: giao diện là SPA, chuyển tab chỉ ẩn
   * div nên bộ nhớ còn; NHƯNG mọi lần renderer tải lại (đổi thư mục nguồn gọi
   * `window.location.href`, hay mở lại app) là `api-shim` mất sạch Map job, trong
   * khi render vẫn chạy dưới này. Hậu quả người dùng thấy: bấm Tạo video, rời tab,
   * quay lại thì vạch tiến trình như đứng hình hoặc trống trơn dù video vẫn đang
   * dựng. Giữ ảnh chụp ở đây để giao diện hỏi lại và bám vào đúng job đang chạy.
   *
   * `phase/message/progress` cập nhật theo từng bước; `status` là trạng thái cuối
   * cùng để tab mở lại vẽ đúng ngay cả khi render đã xong lúc đang ở tab khác.
   */
  const jobState = {
    running: false,
    cancel: false,
    projectDir: null,
    phase: null,
    message: null,
    progress: 0,
    status: 'idle',       // idle | running | done | failed | cancelled
    videoPath: null,
    error: null,
    startedAt: 0,
    ketThucLuc: 0,        // mốc kết thúc lượt gần nhất — api-shim tính 'đã chạy Xs' cho tab mở lại
    voiceoverDuration: 0, // giây — bước Quay hình chạy đúng bấy nhiêu (xem onStep)
  };

  /* ══ HÀNG ĐỢI DỰNG VIDEO ═══════════════════════════════════════════════════
   *
   * VÌ SAO ĐỂ Ở TIẾN TRÌNH CHÍNH, không để ở giao diện:
   * trang bị NẠP LẠI ở vài tình huống có thật — đổi thư mục nguồn, dựng thư mục
   * làm việc, bấm Làm mới. Hàng đợi nằm bên renderer thì những lúc đó bay sạch mà
   * không báo gì. Ở đây thì nó sống cùng `jobState`, một nguồn sự thật duy nhất.
   *
   * VÌ SAO XẾP HÀNG CHỨ KHÔNG CHẠY SONG SONG:
   * ba chặng nặng (Whisper, quay hình offscreen, ffmpeg) đều CPU thuần và KHÔNG
   * chỗ nào giới hạn số luồng — một lượt đã lấy hết lõi. Chạy hai lượt thì mỗi
   * lượt chậm gấp đôi, tổng thời gian y hệt, mà lại tốn thêm một model Whisper
   * trong RAM và một cửa sổ Chromium 1080x1920 nữa. Còn `ensureSidecar()` chỉ
   * dựng MỘT tiến trình Python dùng chung — hai job cùng gọi RPC vào đó là giẫm
   * lên nhau.
   *
   * ⚠ HẠN MỨC KHÔNG ĐỔI. Mỗi lượt trong hàng khi tới lượt vẫn đi qua đúng
   * `chayMotLuot()` → `runRender()` → vẫn giữ và trừ một lượt như thường. Và chỉ
   * trừ LÚC BẮT ĐẦU CHẠY, không trừ lúc xếp hàng — trừ sớm thì bỏ khỏi hàng là
   * mất oan một lượt. Hàng đợi chỉ sắp thứ tự, không phải đường lách hạn mức.
   */
  const hangDoi = [];
  /* Trần 20: bấm nhầm 200 lần thì hàng đợi thành thứ không ai gỡ nổi, mà 20 lượt
     đã là vài giờ máy chạy. */
  const TRAN_HANG_DOI = 20;

  /** Đẩy ảnh chụp hàng đợi xuống giao diện. Gọi sau MỌI thay đổi.
   *
   * ⚠ `hang` CHỈ gồm lượt "Tạo video" — giao diện danh sách deck và sổ việc MCP
   * hiểu nó theo TÊN DECK ("deck X đang chờ" ⇒ nút X thành "Bỏ khỏi hàng đợi", việc
   * `studio_render` của agent khớp vào). Lượt XUẤT BẢN DỰNG nằm riêng ở `hangDung`;
   * trộn chung là agent nhận nhầm kết quả xuất của người dùng, bấm "Bỏ khỏi hàng đợi"
   * gỡ nhầm lượt xuất (audit 10/10/2026). `dangChayLoai` nói lượt đang chạy là gì. */
  function phatHangDoi() {
    ctx.send('render:hangdoi', {
      dangChay: jobState.running ? (jobState.projectDir || null) : null,
      dangChayLoai: jobState.running ? loaiDang : null,
      hang: hangDoi.filter((x) => loaiLuot(x.opts) !== 'dung').map((x) => x.opts.projectDir),
      hangDung: hangDoi.filter((x) => loaiLuot(x.opts) === 'dung').map((x) => x.opts.projectDir),
    });
  }

  /**
   * Chạy lượt kế trong hàng.
   *
   * ⚠ Gọi qua `setImmediate`, KHÔNG gọi thẳng trong `finally` của lượt trước:
   * lúc đó lời hứa của lượt trước còn đang giải quyết dở, đặt `jobState.running`
   * lại thành true ngay giữa chừng làm `render:status` trả về một trạng thái lai
   * — giao diện đang poll sẽ đọc trúng và vẽ sai.
   */
  function chayTiepHangDoi() {
    if (jobState.running) return;
    const ke = hangDoi.shift();
    if (!ke) { phatHangDoi(); return; }
    console.log(`[hàng đợi] tới lượt ${path.basename(ke.opts.projectDir || '')} — còn ${hangDoi.length} chờ`);
    // Lỗi của lượt này KHÔNG được làm đứng cả dây chuyền: `chayMotLuot` tự bắt và
    // tự gọi lượt kế trong `finally` của nó.
    chayMotLuot(ke.opts).catch(() => {});
  }

  /* ⚠ Tách khỏi `ipcMain.handle` để AI Agent dựng video BẰNG ĐÚNG CỬA NÀY.
     Agent mà gọi thẳng `chayMotLuot()` thì lọt qua chốt "đang chạy rồi" ở dưới
     → hai lượt dựng song song trên cùng một deck. Còn gọi thẳng `runRender()`
     thì lọt qua cả cửa trừ lượt trong đó (`auth/quota.js`). Một cửa, cho cả
     người bấm nút lẫn máy. */
  /* Hai lượt TRÙNG nhau = cùng deck VÀ cùng loại (dựng thường / xuất bản dựng của
     trình dựng). Chỉ so deck thì "Tạo video" rồi "Xuất bản dựng" cùng một deck bị
     gộp làm một — lượt sau báo "đã xếp hàng" mà không bao giờ chạy (audit 10/10/2026). */
  const loaiLuot = (o) => (o && o.loai === 'dung' ? 'dung' : 'dung-video');
  let loaiDang = null;
  async function batDauDung(opts) {
    const duong = String(opts && opts.projectDir || '');
    /* DỰ ÁN VIDEO TRỐNG (src/dung/duAnVideo.js): không slide, không giọng — "Tạo video" (nút,
       MCP, AI agent) là XUẤT TIMELINE. Đổi loại ngay ở cửa vào để chốt trùng lượt / hàng đợi /
       giao diện đều thấy đúng một loại. */
    if (duong && opts.loai !== 'dung' && require('../dung/duAnVideo').laDuAnVideo(duong)) {
      opts = { projectDir: opts.projectDir, loai: 'dung' };
    }
    const loai = loaiLuot(opts);

    // Đang tạo phụ đề tự động (src/dung/index.js#dung:phuDeTuDong) — xem chú thích ở `dangTaoPhuDe`.
    if (typeof ctx.dangTaoPhuDe === 'function' && ctx.dangTaoPhuDe()) {
      throw new Error('Đang tạo phụ đề tự động — chờ xong (hoặc bấm Dừng ở mục Phụ đề) rồi tạo / xuất video.');
    }

    if (jobState.running) {
      // Deck NÀY đang dựng dở thì không xếp thêm — bấm hai lần không được ra hai lượt.
      if (path.resolve(jobState.projectDir || '') === path.resolve(duong) && loaiDang === loai) {
        return { xepHang: false, dangChay: true };
      }
      const daCo = hangDoi.findIndex((x) => path.resolve(x.opts.projectDir || '') === path.resolve(duong)
        && loaiLuot(x.opts) === loai);
      if (daCo >= 0) return { xepHang: true, viTri: daCo + 1, trung: true };
      if (hangDoi.length >= TRAN_HANG_DOI) {
        throw new Error(`Hàng đợi đã đầy (${TRAN_HANG_DOI} video). Chờ bớt rồi thêm tiếp.`);
      }
      hangDoi.push({ opts, themLuc: Date.now() });
      phatHangDoi();
      return { xepHang: true, viTri: hangDoi.length };
    }

    return chayMotLuot(opts);
  }

  ipcMain.handle('render:start', async (_e, opts) => batDauDung(opts));

  /** Bỏ một dự án khỏi hàng đợi. KHÔNG đụng tới lượt đang chạy — dừng lượt đang
   *  chạy là việc của `render:cancel`, gộp hai thứ là có ngày bấm nhầm mất job
   *  đang dở dang. */
  /** Xoá SẠCH hàng đợi. Không đụng lượt đang chạy. */
  /* CHỈ lượt "Tạo video" — đúng số giao diện hỏi ("Xoá luôn N video đang chờ" đếm `hang`). Xoá
     cả lượt xuất bản dựng là bỏ lặng lẽ thứ người dùng không được hỏi, timeline còn báo "đã xếp
     hàng xuất" mãi (audit 10/10/2026). */
  ipcMain.handle('render:xoaHang', async () => {
    const truoc = hangDoi.length;
    for (let i = hangDoi.length - 1; i >= 0; i -= 1) if (loaiLuot(hangDoi[i].opts) !== 'dung') hangDoi.splice(i, 1);
    const n = truoc - hangDoi.length;
    if (n) { console.log(`[hàng đợi] xoá ${n} lượt "Tạo video" đang chờ`); phatHangDoi(); }
    return n;
  });

  /** Bỏ MỘT lượt khỏi hàng: đúng deck VÀ đúng loại (mặc định "Tạo video"). */
  function boHang(projectDir, loai) {
    const d = path.resolve(String(projectDir || ''));
    const l = loai === 'dung' ? 'dung' : 'dung-video';
    const i = hangDoi.findIndex((x) => path.resolve(x.opts.projectDir || '') === d && loaiLuot(x.opts) === l);
    if (i < 0) return false;
    hangDoi.splice(i, 1);
    phatHangDoi();
    return true;
  }
  ipcMain.handle('render:boHang', async (_e, projectDir, loai) => boHang(projectDir, loai));

  async function chayMotLuot(opts) {
    /* Đặt jobState TRƯỚC khi chờ sidecar (rà soát Phase 3, 02/09/2026). Bản
       trước `await ctx.ensureSidecar()` đứng đầu: lúc app vừa mở (sidecar còn
       đang lên, 2–5 s) hay sau khi sidecar chết, giao diện poll ngay sau khi bấm
       mà ảnh chụp vẫn là 'idle' (→ 404 → báo đỏ) hoặc còn 'done' của lượt trước
       (→ vẽ nhầm video cũ); và hai lần bấm sát nhau đều lọt qua `if
       (jobState.running)` ở render:start, chạy song song hai lượt. Sidecar không
       lên nổi thì rơi vào catch bên dưới như mọi lỗi khác: status 'failed' kèm
       câu lỗi, hàng đợi vẫn được dọn ở finally. */
    jobState.running = true;
    jobState.cancel = false;
    jobState.projectDir = opts.projectDir;
    loaiDang = loaiLuot(opts);
    jobState.phase = 'start';
    jobState.message = 'Bắt đầu';
    jobState.progress = 0;
    jobState.status = 'running';
    jobState.videoPath = null;
    jobState.banDungPath = null;
    jobState.error = null;
    jobState.startedAt = Date.now();
    jobState.ketThucLuc = 0;
    jobState.voiceoverDuration = 0;
    ctx.send('render:step', { phase: 'start', message: 'Bắt đầu' });
    /* ⚠ PHÁT CẢ KHI HÀNG ĐỢI RỖNG. Bản đầu chỉ phát lúc hàng đợi đổi, nên lượt
       ĐẦU TIÊN (xếp hàng rỗng) không phát gì — giao diện không biết có job vừa
       bắt đầu, nhãn nút đứng nguyên ở "Tạo video" trong khi máy đang dựng. Đo
       được đúng như vậy. Sự kiện này là thứ duy nhất báo "ai đang chạy". */
    phatHangDoi();

    try {
      /* LƯỢT XUẤT BẢN DỰNG (trình dựng video, docs/video-editor/KE-HOACH.md §7) đi
         CHUNG hàng đợi này: một lượt một lúc với quay/dựng (cùng ăn CPU), cùng
         jobState để giao diện hiện tiến độ/huỷ y như dựng thường, và trừ lượt bên
         trong `xuatBanDung` (chủ dự án chốt 10/10/2026: "1 lần dựng là trừ"). */
      if (opts.loai === 'dung') {
        /* Bộ slide PHỤ (GĐ3.7): lượt xuất riêng KHÔNG dựng bộ phụ — có bộ đang dùng mà cũ thì dừng ngay (không xuất ra
           video đen / video cũ rồi trừ lượt); video đã dựng mà chưa lên timeline thì đưa lên trước (rà 3.7). */
        const bsX = require('../dung/boSlide');
        const khoX = require('../dung/kho').docDuAn(opts.projectDir);
        const cuX = khoX.duAn ? bsX.ds(opts.projectDir).filter((b) => bsX.dangDung(khoX.duAn).has(b.id) && bsX.canDung(b.dir)) : [];
        if (cuX.length) {
          throw new Error(`Bộ slide ${cuX.map((b) => b.id.slice(1)).join(', ')} chưa dựng hoặc đã sửa — bấm "Tạo video" để dựng chung cả dự án.`);
        }
        const kX = await bsX.capNhatSauDung(opts.projectDir);
        if (kX.va.length) ctx.send('dung:boSlideMoi', { projectDir: opts.projectDir, media: kX.va });
        const resDung = await require('../dung/xuat').xuatBanDung({
          ...(kX.va.length ? { apDung: (d) => require('../dung/moHinh').apMediaBoSlide(d, kX.va, kX.moc) } : {}),
          deckDir: opts.projectDir,
          appVersion: app.getVersion(),
          doThongSo: ctx.doThongSoVideo,
          onStep: (phase, message, extra) => {
            if (phase) jobState.phase = phase;
            if (message) jobState.message = message;
            if (extra && typeof extra.progress === 'number') jobState.progress = extra.progress;
            ctx.send('render:step', { phase, message, projectDir: opts.projectDir, banDung: true, ...extra });
          },
          shouldCancel: () => jobState.cancel,
        });
        jobState.status = 'done';
        jobState.videoPath = resDung.videoPath;
        ctx.send('render:done', { ...resDung, projectDir: opts.projectDir });
        return resDung;
      }
      await ctx.ensureSidecar();
      /* MỘT deck — deck gốc của dự án hoặc một BỘ SLIDE PHỤ (GĐ3.7, src/dung/boSlide.js#dungCaDuAn): sự kiện vẫn mang
         projectDir của DỰ ÁN (giao diện theo dõi đúng một lượt), lời báo của bộ phụ có tiền tố. */
      const dungMot = (projectDir, them = {}) => {
        if (them.boPhu && opts.engine === 'upload') {
          return Promise.reject(new Error('giọng đọc tải lên chỉ dùng cho bộ slide đầu — bộ phụ cần giọng tạo tự động. Chọn Edge / Beeknoee / ElevenLabs / giọng trên máy rồi "Tạo video".'));
        }
        return runRender({
        py: ctx.sidecar(),
        projectDir,
        engine: opts.engine,
        speed: opts.speed,
        size: opts.size,
        quality: opts.quality,
        voice: opts.voice,
        /* Bộ PHỤ: giọng tải lên là của bộ ĐẦU — không dùng cho bộ phụ; "đọc lại giọng" cũng chỉ cho bộ đầu (rà 3.7). */
        audioPath: them.boPhu ? null : opts.audioPath,
        // Model của Beeknoee Platform (VD google/gemini-2.5-flash-tts).
        // Engine khác không dùng — pipeline chuyển tiếp nguyên trạng.
        modelId: opts.modelId || null,
        /* Khoá giải mã ngay tại đây, không lấy từ opts do giao diện gửi lên —
           giao diện không có khoá và không được phép có. Mỗi engine một kho:
           đưa nhầm khoá ElevenLabs cho platform (hay ngược lại) là 401 khó hiểu. */
        apiKey: khoaCho(opts.engine) || null,
        subtitles: opts.subtitles,
        skipValidation: opts.skipValidation,
        realign: opts.realign,
        // ⚠ HAI TRƯỜNG NÀY TỪNG BỊ ĐÁNH RƠI ĐÚNG Ở ĐÂY.
        //
        // `force` = ô tick "Đọc lại giọng, bỏ qua bản đã lưu". Chuỗi truyền đủ ở
        // mọi chặng — index.html → render-page.js → api-shim.js (`force:
        // Boolean(body.force)`) — rồi đứt tại đây, nên `pipeline.js` luôn thấy
        // false và Python luôn trả file giọng trong bộ nhớ đệm. Ô tick hiện thật
        // trên giao diện (render-layout.js đưa nó lên hàng "2 THÔNG SỐ") nhưng
        // bấm không có tác dụng: giọng cũ bị cụt hay đọc sai thì không có đường
        // nào ép đọc lại.
        //
        // `appVersion` chỉ dùng để ghi vào `render_log`, thiếu không gây lỗi —
        // nhưng thiếu thì mất luôn khả năng biết lượt render đến từ bản app nào.
        force: them.boPhu ? false : opts.force,
        appVersion: app.getVersion(),
        /* ⚠ Từng truyền thêm `danhDauVuaGhi: ctx.danhDauVuaGhi` xuống đây cho
           pipeline đánh dấu ảnh bìa nó vừa ghi — gỡ 13/09/2026 cùng lượt chụp
           ảnh bìa (CONTEXT §6.5E). `ctx.danhDauVuaGhi` VẪN CÒN và vẫn dùng ở
           ipc/projects.js; chỉ mỗi đường render là hết việc với nó. */
        onStep: (phase, message, extra) => {
          // Cập nhật ảnh chụp TRƯỚC khi gửi, để `render:status` hỏi lúc nào cũng
          // khớp sự kiện cuối cùng renderer nhận được.
          if (phase) jobState.phase = phase;
          if (message && them.nhan) message = `${them.nhan} — ${message}`;
          if (message) jobState.message = message;
          if (extra && typeof extra.progress === 'number') jobState.progress = extra.progress;
          if (extra && typeof extra.voiceoverDuration === 'number') {
            jobState.voiceoverDuration = extra.voiceoverDuration;
          }
          /* `projectDir` PHẢI đi kèm MỌI sự kiện render. Giao diện có thể đang
             có nhiều lượt (một chạy, mấy lượt xếp hàng), mà sự kiện không nói rõ
             của ai thì bên kia buộc phải đoán — và nó đoán bằng "lượt mới nhất",
             tức là đoán SAI ngay khi hàng đợi có từ hai lượt. */
          ctx.send('render:step', { phase, message, projectDir: opts.projectDir, ...extra });
        },
        shouldCancel: () => jobState.cancel,
        ...(them.kiemHanMuc === false ? { kiemHanMuc: false } : {}),
        });
      };
      const boSlide = require('../dung/boSlide');
      const res = await boSlide.dungCaDuAn({ dirCha: opts.projectDir, dungMot, appVersion: app.getVersion() });
      /* Video mới của bộ slide phụ ⇒ dung/media + du-an.json (cùng bản vá gửi giao diện áp lên ngăn đang mở). */
      let vaBo = [];
      let vaMoc = [];
      let loiBo = '';
      if (res && res.videoPath && !jobState.cancel) {
        try {
          const k = await boSlide.capNhatSauDung(opts.projectDir);
          vaBo = k.va; vaMoc = k.moc;
        } catch (e) { loiBo = (e && e.message) || String(e); }
        if (vaBo.length) ctx.send('dung:boSlideMoi', { projectDir: opts.projectDir, media: vaBo });
        /* Không thay được video bộ phụ ⇒ KHÔNG áp timeline (bản cuối sẽ mang video đen / cũ) — báo rõ (rà 3.7). */
        if (loiBo) {
          jobState.message = `Video slide đã xong, nhưng chưa thay được video bộ slide phụ lên timeline: ${loiBo}`;
          ctx.send('render:step', { phase: 'mux', message: jobState.message, projectDir: opts.projectDir });
        }
      }
      /* ÁP TIMELINE NGAY TRONG LƯỢT "Tạo video" (chủ dự án bỏ nút "Xuất bản dựng" 12/10/2026:
         "gần giống nút tạo video, chả cần thiết"). Dự án có chỉnh trên timeline (khối, V1, phụ
         đề, âm lượng, khung xuất — moHinh.coChinhSua) thì sau khi dựng slide xong chạy luôn bước
         xuất bản dựng → `<deck>-dung.mp4`. CÙNG một lượt: không xin thêm hạn mức (`kiemHanMuc:
         false` — `runRender` đã giữ/xác nhận lượt). `<deck>.mp4` vẫn là video slide sạch: nó là
         NỀN của trình dựng, đè bản đã áp lên là lần sau B-roll chồng hai lần.
         Bước này hỏng ⇒ KHÔNG làm hỏng lượt dựng (video slide đã xong) — chỉ báo. */
      let banDungPath = null;
      if (res && res.videoPath && !jobState.cancel && !loiBo) {
        const xuatMod = require('../dung/xuat');
        if (xuatMod.coChinhSuaDeck(opts.projectDir)) {
          const bao = (phase, message, extra) => {
            if (phase) jobState.phase = phase;
            if (message) jobState.message = message;
            if (extra && typeof extra.progress === 'number') jobState.progress = extra.progress;
            ctx.send('render:step', { phase, message, projectDir: opts.projectDir, ...extra });
          };
          bao('mux', 'Áp chỉnh sửa trên timeline', { progress: 0 });
          try {
            const rd = await xuatMod.xuatBanDung({
              deckDir: opts.projectDir,
              appVersion: app.getVersion(),
              doThongSo: ctx.doThongSoVideo,
              kiemHanMuc: false,
              boQuaPhuDeCu: true,
              // Giao diện lưu trong lúc dựng (bản chưa có video bộ phụ mới) ⇒ áp lại bản vá — hàm thuần, áp lặp vô hại.
              ...(vaBo.length ? { apDung: (d) => require('../dung/moHinh').apMediaBoSlide(d, vaBo, vaMoc) } : {}),
              nhan: 'Áp chỉnh sửa timeline',
              onStep: (phase, message, extra) => bao(phase === 'done' ? 'mux' : phase, message, extra),
              shouldCancel: () => jobState.cancel,
            });
            banDungPath = rd && rd.videoPath ? rd.videoPath : null;
            if (rd && rd.boQua) bao('mux', 'Không còn chỉnh sửa timeline nào cần áp — video slide là bản cuối');
          } catch (e) {
            /* Dừng ở bước ÁP TIMELINE: video slide đã xong và đã trừ lượt — lượt này vẫn là "xong" (không
               có bản dựng), đừng báo cả lượt là huỷ (rà 16/10/2026). */
            bao('mux', e && e.cancelled
              ? 'Đã dừng bước áp chỉnh sửa timeline — video slide vẫn xong'
              : `Video slide đã xong, nhưng chưa áp được chỉnh sửa timeline: ${(e && e.message) || e}`);
          }
        }
      }
      jobState.status = 'done';
      jobState.videoPath = res && res.videoPath ? res.videoPath : null;
      jobState.banDungPath = banDungPath;
      ctx.send('render:done', { ...res, banDungPath, projectDir: opts.projectDir });
      return res;
    } catch (err) {
      jobState.status = err.cancelled ? 'cancelled' : 'failed';
      jobState.error = err.message || String(err);
      ctx.send('render:error', {
        message: err.message,
        kind: err.kind || null,
        issues: err.issues || null,
        cancelled: !!err.cancelled,
        projectDir: opts.projectDir,
        // Lượt xuất bản dựng: người nghe (MCP, timeline) phân biệt bằng cờ, không đoán chữ.
        banDung: opts.loai === 'dung',
      });
      throw err;
    } finally {
      // `running=false` nhưng GIỮ `status/phase/videoPath/error`: tab mở lại sau
      // khi render xong lúc đang ở tab khác vẫn phải vẽ được kết quả cuối.
      jobState.running = false;
      jobState.cancel = false;
      jobState.ketThucLuc = Date.now();
      // Báo "hết chạy" ngay, đừng đợi lượt kế: hàng rỗng thì `chayTiepHangDoi`
      // cũng phát, nhưng giao diện cần biết sớm để mở lại nút.
      phatHangDoi();
      // Tới lượt kế. `setImmediate` chứ không gọi thẳng — xem chú thích ở
      // `chayTiepHangDoi()`. Chạy cả khi lượt này HỎNG: một deck lỗi không được
      // làm đứng những deck sau.
      setImmediate(chayTiepHangDoi);
    }
  }

  /**
   * Dừng lượt dựng đang chạy.
   *
   * ⚠ Tách khỏi `ipcMain.handle` để CHỖ KHÁC TRONG TIẾN TRÌNH CHÍNH gọi được.
   * Từng phục vụ `ai/agent.js#dungAI` hồi agent còn tool `dung_video`. Tool đó
   * đã gỡ (18/09/2026) và `dungAI` KHÔNG còn gọi vào đây nữa (19/09/2026): mọi
   * lượt dựng đang chạy là của người dùng, "Dừng AI" không được đụng vào. Giữ
   * hàm tách riêng vì `render:cancel` vẫn đi qua và có thể có chỗ khác cần.
   */
  function huyDung() {
    if (!jobState.running) return false;
    jobState.cancel = true;
    ctx.send('render:step', { phase: 'cancel', message: 'Đang dừng…' });
    /* Báo cả phía Python (Phase 4.3): bước đang chạy bên đó (Whisper, ffmpeg
       cắt/ghép) tự dừng và giết tiến trình con, thay vì chạy cho hết rồi JS mới
       thấy cờ huỷ ở bước kế — bấm Dừng lúc "Khớp lời thoại" từng phải chờ 17 s+. */
    const py = ctx.sidecar();
    if (py) py.call('render.cancel', {}, 5000).catch(() => { /* sidecar đang chết thì thôi */ });
    return true;
  }

  ipcMain.handle('render:cancel', async () => huyDung());

  const trangThaiDung = () => ({
    running: jobState.running,
    projectDir: jobState.projectDir,
    // Loại lượt gần nhất (đang chạy hoặc vừa xong): 'dung-video' | 'dung' (xuất bản dựng).
    loai: loaiDang,
    phase: jobState.phase,
    message: jobState.message,
    progress: jobState.progress,
    status: jobState.status,
    videoPath: jobState.videoPath,
    // Bản đã áp chỉnh sửa timeline (`<deck>-dung.mp4`) của lượt "Tạo video" — null khi không có.
    banDungPath: jobState.banDungPath || null,
    error: jobState.error,
    startedAt: jobState.startedAt,
    ketThucLuc: jobState.ketThucLuc,
    // Kèm hàng đợi để trang vừa NẠP LẠI giữa chừng dựng lại đúng danh sách chờ —
    // `resyncRender()` chỉ hỏi đúng một lần này, không có kênh nào khác.
    hangDoi: hangDoi.filter((x) => loaiLuot(x.opts) !== 'dung').map((x) => x.opts.projectDir),
    hangDung: hangDoi.filter((x) => loaiLuot(x.opts) === 'dung').map((x) => x.opts.projectDir),
  });

  ipcMain.handle('render:status', async () => trangThaiDung());

  return {
    TRAN_HANG_DOI, chayMotLuot, chayTiepHangDoi, hangDoi, jobState, phatHangDoi,
    batDauDung, huyDung, trangThaiDung, boHang,
  };
}

module.exports = { dangKy }