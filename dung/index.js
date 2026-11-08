};
'use strict';
/**
 * TRÌNH DỰNG VIDEO — phần tiến trình chính (docs/video-editor/KE-HOACH.md).
 *
 * IPC (giao diện gọi qua `window.beeknoee.dung.*`, xem preload.js):
 *   dung:doc     (deck)            → { ok, duAn, moi, chiDoc, loiDoc, daCatHong, moc, video }
 *   dung:ghi     (deck, duAn)      → { ok, loi?, chiDoc? }   kiểm + ghi nguyên tử + .bak
 *   dung:nhap    (deck, [đường])   → { media: [...], loi: [...] }   chép vào dung/media/
 *   dung:chonTep (deck)            → như dung:nhap, qua hộp chọn tệp của hệ điều hành
 *   dung:cache   (deck, media)     → { anh, song, proxy, goc }  URL/đỉnh sóng đã có
 * Sự kiện gửi về: `dung:tienTrinh` (nhập từng tệp, % proxy), `dung:cacheXong`.
 *
 * Deck CHỈ nhận theo TÊN và phải nằm ngay trong thư mục nguồn đang mở
 * (`giaoThuc.deckTrongNguon`) — không nhận đường tuyệt đối từ giao diện.
 *
 * Gộp vào ctx: `dungHuyDeck(dir)` — ipc/projects.js gọi TRƯỚC khi đổi tên / xoá /
 * dọn một deck: bỏ việc của deck đó khỏi hàng đợi và giết ffmpeg đang giữ tệp
 * (Windows từ chối đổi tên thư mục có tệp đang mở — EBUSY).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { ipcMain, dialog, app } = require('electron');
const moHinh = require('./moHinh');
const kho = require('./kho');
const media = require('./media');
const giaoThuc = require('./giaoThuc');
const { timVideo } = require('../render/tenVideo');
const duAnVideo = require('./duAnVideo');

const TRAN_MOI_LUOT = 50;   // số tệp mỗi lượt nhập

function dangKy(ctx) {
  // ⚠ PHẢI trước app.ready — vòng nạp module ở main.js chạy đồng bộ lúc khởi động.
  giaoThuc.dangKyScheme();
  app.whenReady().then(() => {
    giaoThuc.xuLy(ctx);
    require('../main/khungDeck').xuLy({ thuMucTaiNguyen: () => require('../config').resourcesRoot() });
  });

  const deckCua = (ten) => {
    const dir = giaoThuc.deckTrongNguon(ctx, String(ten || ''));
    if (!dir) throw new Error(`Không thấy deck "${ten}" trong thư mục nguồn.`);
    return dir;
  };

  /** Mốc slide (ms, kèm DẤU slide theo lời thoại — moHinh.dauSlide) từ timing.json. (`dauVan` bỏ ở GĐ3.1 — L4.) */
  function docMoc(dir) {
    try {
      return { moc: moHinh.mocTuTiming(JSON.parse(fs.readFileSync(path.join(dir, 'output', 'timing.json'), 'utf8'))) };
    } catch { return { moc: [] }; }
  }

  ipcMain.handle('dung:doc', async (_e, ten) => {
    const dir = deckCua(ten);
    // Dự án video: không có slide — bỏ qua `timing.json` giả của bản trước GĐ3.4 (nếu còn).
    let { moc } = duAnVideo.laDuAnVideo(dir) ? { moc: [] } : docMoc(dir);
    /* Video gốc LUÔN đọc lại từ đĩa, không tin `goc.video` đã lưu: đổi tên deck là
       tên tệp mp4 đổi theo (`<tên deck>.mp4`). */
    const v = timVideo(dir);
    const video = v ? `output/${v.name}` : '';
    /* Hai lớp tiếng TÁCH SẴN lúc dựng (giọng / nhạc + hiệu ứng deck) — xem trước phát
       riêng từng lớp theo âm lượng của bảng Khối, y như bản xuất (xuat.js#dauVaoDeck). */
    const dv = require('./xuat').dauVaoDeck(dir);
    const tachTieng = dv && dv.giong && dv.deck
      ? { giong: `output/${path.basename(dv.giong)}`, deck: `output/${path.basename(dv.deck)}` } : null;
    const r = kho.docDuAn(dir);
    /* L3 (GĐ3.1): deck đã chèn / đổi thứ tự slide sau lần sửa timeline — neo + đoạn V1 theo lại slide CÙNG lời
       thoại, và GHI NGAY (bản xuất / MCP đọc từ đĩa phải thấy cùng chỗ với giao diện). */
    let khopDoi = 0;
    if (r.duAn && !r.chiDoc) {
      const kq = moHinh.khopSlide(r.duAn, moc);
      if (kq.doi) {
        const g = kho.ghiDuAn(dir, kq.duAn);
        if (g.ok) { r.duAn = kq.duAn; khopDoi = kq.doi; }
      }
    }
    /* KHUNG = cỡ thật của video slide (deck ngang 16:9 thì khung ngang). Không có video
       thì giữ số đã lưu / mặc định dọc. Toạ độ khối là TỈ LỆ nên đổi khung không xô lệch
       bố cục (audit 10/10/2026: deck ngang bị ép thành 1080×1920). */
    let ts = {};
    if (v) {
      // Hồ sơ `<deck>.info.json` (pipeline ghi lúc dựng) có sẵn cỡ hình — khỏi chạy ffprobe mỗi lần mở deck.
      try { ts = JSON.parse(fs.readFileSync(v.path.replace(/\.mp4$/i, '.info.json'), 'utf8')) || {}; } catch { ts = {}; }
      if (!(Number(ts.width) > 0) && ctx.doThongSoVideo) ts = ctx.doThongSoVideo(v.path) || {};
    }
    // Đuôi video sau slide cuối thuộc slide cuối (moHinh.keoDuoiMoc) — bản xuất kéo y như vậy (xuat.js#xuatBanDung).
    // Hồ sơ cũ có cỡ hình mà thiếu độ dài: đo bằng ffprobe như bản xuất, kẻo hai bên kéo đuôi khác nhau.
    if (v && moc.length && !(Number(ts.duration) > 0) && ctx.doThongSoVideo) ts = { ...ts, duration: (ctx.doThongSoVideo(v.path) || {}).duration };
    moc = moHinh.keoDuoiMoc(moc, Number(ts.duration) * 1000);
    let khungVideo = Number(ts.width) > 0 && Number(ts.height) > 0
      ? { rong: Number(ts.width), cao: Number(ts.height), fps: Math.round(Number(ts.fps)) || 30 } : null;
    // Dự án video: khổ + fps ở tệp đánh dấu (duAnVideo.js).
    if (duAnVideo.laDuAnVideo(dir)) khungVideo = duAnVideo.khungDuAn(dir);
    const loiDoc = [...(r.loiDoc || [])];
    if (khopDoi) loiDoc.push(`Deck đã đổi thứ tự / thêm slide sau lần sửa timeline — ${khopDoi} khối / đoạn V1 đã theo lại đúng slide (theo lời thoại).`);
    if (dv && dv.mocLech) loiDoc.push('Lần "Tạo video" gần nhất chưa xong — mốc slide không khớp video slide: khối neo theo slide có thể lệch chỗ. Bấm "Tạo video" lại để áp chỉnh sửa timeline.');
    else if (dv && dv.tiengLech) loiDoc.push('Tiếng tách sẵn không khớp video slide (lần tạo video gần nhất chưa xong) — xem trước và bản xuất dùng tiếng đã trộn của video.');
    /* Phụ đề tách lớp: có bản KHÔNG phụ đề + dữ liệu phụ đề của lượt dựng ⇒ trình dựng sửa được
       phụ đề. Kèm CSS phụ đề của deck (cùng luật trang quay dùng) cho lớp xem trước. */
    let phuDe = null;
    if (dv && dv.noPhuDe) {
      const k = require('../render/recordingHtml').khungCuaDeck(dir);
      /* CSS: phuDeCss.js — biến của lượt dựng (lop.json) thắng, TRỪ khi người dùng đã đổi kiểu sau đó. */
      const pc = require('./phuDeCss').cssPhuDe(dir);
      phuDe = {
        noPhuDe: path.basename(dv.noPhuDe),
        captions: dv.phuDeGoc.captions,
        sha: dv.phuDeSha,
        css: pc.css,
        kieu: pc.kieu,
        khung: { w: k.w, h: k.h },
      };
    }
    /* Dự án VIDEO TRỐNG: nền đen KHÔNG có phụ đề — coi nó là "bản không phụ đề" để trình dựng sửa và
       vẽ được phụ đề tự động (dung:phuDeTuDong) y như phụ đề tách lớp của deck. Câu gốc rỗng (không có
       lượt dựng nào sinh phụ đề); CSS phụ đề mặc định + thiết lập của dự án nếu có. */
    if (!phuDe && duAnVideo.laDuAnVideo(dir)) {
      const ps = duAnVideo.docThietLap(dir);
      const k = require('../render/recordingHtml').khungCuaDeck(dir);
      phuDe = {
        noPhuDe: duAnVideo.TEN_NEN,
        captions: [],
        sha: null,
        css: duAnVideo.cssPhuDe(ps),
        // Kiểu phụ đề hiện tại cho bộ chỉnh phụ đề (render/kieu-phu-de.js — tab Thuộc tính, dung:kieuPhuDe).
        kieu: ps.subtitles && typeof ps.subtitles === 'object' ? ps.subtitles : {},
        khung: { w: k.w, h: k.h },
      };
    }
    const pdSua = r.duAn && r.duAn.phuDe;
    if (phuDe && pdSua && pdSua.goc && phuDe.sha && pdSua.goc !== phuDe.sha) {
      loiDoc.push('Phụ đề đã sửa thuộc một lần "Tạo video" trước (lời thoại có thể đã đổi) — "Tạo video" sẽ dùng phụ đề mới, bỏ bản sửa này. Muốn sửa lại: "Khôi phục phụ đề gốc" (bấm track C1 → tab Thuộc tính).');
    }
    /* Dự án VIDEO TRỐNG (duAnVideo.js): giao diện ẩn phần của deck; không có video slide (GĐ3.4). */
    const loai = duAnVideo.laDuAnVideo(dir) ? 'video' : 'deck';
    /* BỘ SLIDE PHỤ (GĐ3.7): deck này là một clip của dự án mẹ — timeline của nó chỉ để XEM (chỉ đọc); timeline thật ở
       dự án mẹ. Giao diện hiện dải "Bộ slide của …" + nút về dự án mẹ. */
    const boC = require('./boSlide').laDirCon(dir);
    const boSlide = boC ? { cha: path.basename(boC.dirCha), id: boC.id } : null;
    const chung = { ok: true, loiDoc, daCatHong: r.daCatHong, moc, video, tachTieng, phuDe, loai, boSlide };
    if (r.chiDoc) return { ...chung, duAn: null, chiDoc: true, moi: false };
    if (r.duAn) {
      return {
        ...chung, moi: false, nguon: r.nguon,
        duAn: { ...r.duAn, goc: { ...r.duAn.goc, video }, ...(khungVideo ? { khung: khungVideo } : {}) },
      };
    }
    // Chưa có dự án (hoặc mọi bản đều hỏng — bản hỏng đã cất riêng): bản rỗng, CHƯA ghi.
    // Dự án video trống: KHÔNG có khối slide (GĐ3.1).
    return { ...chung, duAn: moHinh.moi({ video, ...(khungVideo || {}), khongSlide: loai === 'video' }), moi: true };
  });

  ipcMain.handle('dung:ghi', async (_e, ten, duAn) => kho.ghiDuAn(deckCua(ten), duAn));

  /* PHỤ ĐỀ TỰ ĐỘNG cho dự án VIDEO TRỐNG (không có kịch bản để căn): trộn TIẾNG của timeline hiện tại
     ra WAV (xuat.js — chế độ chiTieng: cùng đồ thị trộn với bản xuất, không hình, không trừ lượt) →
     Whisper (`subtitle.transcribe`, model base đi kèm) → câu phụ đề. Giao diện ghi câu vào dự án
     (RP.dung.datPhuDe) — có hoàn tác, sửa được trên track C1, bản xuất vẽ lên hình. */
  const dangPhuDe = new Map();   // dir → { huy }
  ipcMain.handle('dung:phuDeTuDong', async (_e, ten, o) => {
    const dir = deckCua(ten);
    if (!duAnVideo.laDuAnVideo(dir)) return { ok: false, loi: ['Phụ đề tự động dành cho dự án video — deck dùng phụ đề của lượt "Tạo video".'] };
    if (ctx.jobState && ctx.jobState.running) return { ok: false, loi: ['Đang dựng video — chờ xong rồi tạo phụ đề.'] };
    if (dangPhuDe.has(dir)) return { ok: false, loi: ['Đang tạo phụ đề cho dự án này.'] };
    const ngonNgu = ['vi', 'en', ''].includes(o && o.ngonNgu) ? o.ngonNgu : 'vi';
    const trang = { huy: false };
    dangPhuDe.set(dir, trang);
    /* Thư mục RIÊNG: `cache/phu-de/` bị phuDeLop.vePhuDeLop xoá sạch mỗi lần vẽ lớp phụ đề (rà 16/10/2026). */
    const wav = path.join(kho.thuMucCache(dir).goc, 'phu-de-tu-dong', `tieng-${process.pid}.wav`);
    const bao = (message, progress) => ctx.send('dung:phuDeTienTrinh', { deck: ten, message, progress });
    try {
      fs.mkdirSync(path.dirname(wav), { recursive: true });
      bao('Trộn tiếng timeline…', 0);
      await require('./xuat').xuatBanDung({
        deckDir: dir, chiTieng: true, raTieng: wav, kiemHanMuc: false,
        doThongSo: ctx.doThongSoVideo || (() => ({})),
        onStep: (_ph, msg, ex) => { if (msg) bao(msg, ex && typeof ex.progress === 'number' ? ex.progress * 0.3 : undefined); },
        shouldCancel: () => trang.huy,
      });
      if (trang.huy) return { ok: false, huy: true, loi: ['Đã dừng.'] };
      bao('Nhận dạng lời nói (Whisper)… — video dài vài phút có thể mất một lúc', 0.35);
      await ctx.ensureSidecar();
      trang.python = true;   // từ đây "Dừng" mới cần báo sang Python
      let giayTieng = 0;
      try { giayTieng = Math.max(0, (fs.statSync(wav).size - 44) / 32000); } catch { /* bỏ */ }   // pcm mono 16 kHz = 32 000 byte/giây
      const r = await ctx.sidecar().call('subtitle.transcribe', { audioPath: wav, language: ngonNgu, maxLines: 2 },
        Math.max(20 * 60 * 1000, Math.round(giayTieng * 6 * 1000)));
      if (trang.huy) return { ok: false, huy: true, loi: ['Đã dừng.'] };
      return { ok: true, captions: (r && r.captions) || [], soTu: (r && r.words) || 0 };
    } catch (e) {
      if (trang.huy) return { ok: false, huy: true, loi: ['Đã dừng.'] };
      return { ok: false, loi: [String((e && e.message) || e)] };
    } finally {
      dangPhuDe.delete(dir);
      try { fs.unlinkSync(wav); } catch { /* chưa có / đã xoá */ }
    }
  });
  ipcMain.handle('dung:phuDeHuy', async (_e, ten) => {
    const dir = deckCua(ten);
    const t = dangPhuDe.get(dir);
    if (!t) return false;
    t.huy = true;
    /* Whisper đang chạy bên Python: báo dừng. `render.cancel` là cờ huỷ CHUNG của sidecar — an toàn vì trong
       lúc tạo phụ đề không lượt dựng nào được bắt đầu (render/queue.js hỏi `dangTaoPhuDe`), và tạo phụ
       đề không bắt đầu khi đang dựng. Chỉ báo khi đã sang bước Python (trước đó là ffmpeg trộn tiếng). */
    if (t.python) {
      try { const py = ctx.sidecar && ctx.sidecar(); if (py) await py.call('render.cancel', {}, 5000); } catch { /* sidecar chưa lên */ }
    }
    return true;
  });

  /* Dự án video: nội dung chạm gần cuối nền đen ⇒ dựng nền dài hơn. Giao diện ĐÓNG <video> nền
     trước khi gọi (Windows khoá tệp đang mở) và nạp lại sau. Một lượt mỗi deck. */
  const dangGian = new Map();
  /** CSS phụ đề hiện tại cho lớp xem trước (deck vừa đổi kiểu ở bảng — rà L1 16/10/2026). */
  ipcMain.handle('dung:cssPhuDe', async (_e, ten) => {
    try { return { ok: true, ...require('./phuDeCss').cssPhuDe(deckCua(ten)) }; } catch (e) { return { ok: false, loi: [String((e && e.message) || e)] }; }
  });

  /** Kiểu phụ đề của dự án video (màu / cỡ / vị trí / phông…) → preview-settings.json — duAnVideo.ghiKieuPhuDe. */
  ipcMain.handle('dung:kieuPhuDe', async (_e, ten, va) => {
    try { return duAnVideo.ghiKieuPhuDe(deckCua(ten), va); } catch (e) { return { ok: false, loi: [String((e && e.message) || e)] }; }
  });

  /* `dung:gianNen` (giãn nền đen giả) BỎ ở GĐ3.4 — giữ kênh trả "không cần" cho giao diện bản cũ đang mở dở. */
  ipcMain.handle('dung:gianNen', async () => ({ ok: true, daDung: false, msNen: 0 }));

  /**
   * CHỮ TIÊU ĐỀ (Giai đoạn 2): giao diện vẽ chữ ra PNG (canvas, render/chu-tieu-de.js) rồi gửi
   * xuống đây ghi vào `dung/media/` — bản xuất chỉ việc chồng ảnh, không cần drawtext/phông
   * trong ffmpeg. Mỗi lần sửa chữ là MỘT tệp mới (tên khác ⇒ xem trước không dính ảnh cũ trong
   * bộ nhớ đệm; hoàn tác trỏ lại tệp cũ vẫn còn). Tệp không ai dùng nữa → Dọn dẹp "media thừa".
   * Không tin renderer: kiểm chữ ký PNG, cỡ ảnh, id, thông số chữ (moHinh.kiem).
   */
  ipcMain.handle('dung:ghiChu', async (_e, ten, vao) => {
    const dir = deckCua(ten);
    const x = vao || {};
    const id = typeof x.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(x.id) ? x.id : null;
    if (!id) return { ok: false, loi: ['Mã media sai.'] };
    let buf;
    try { buf = Buffer.from(String(x.png || ''), 'base64'); } catch { buf = null; }
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!buf || buf.length < 33 || buf.length > 25 * 1024 * 1024 || !buf.subarray(0, 8).equals(PNG) || buf.toString('latin1', 12, 16) !== 'IHDR') {
      return { ok: false, loi: ['Ảnh chữ không phải PNG hợp lệ.'] };
    }
    const rong = buf.readUInt32BE(16);
    const cao = buf.readUInt32BE(20);
    if (!(rong >= 1 && rong <= 8192 && cao >= 1 && cao <= 8192)) return { ok: false, loi: ['Ảnh chữ quá cỡ.'] };
    const goc = path.join(kho.thuMuc(dir), 'media');
    fs.mkdirSync(goc, { recursive: true });
    const tenTep = `chu-${id}-${crypto.randomBytes(4).toString('hex')}.png`;
    const tam = path.join(goc, `${tenTep}.tam-${process.pid}`);
    fs.writeFileSync(tam, buf);
    fs.renameSync(tam, path.join(goc, tenTep));
    const noiDung = x.chu && typeof x.chu.noiDung === 'string' ? x.chu.noiDung : '';
    const m = {
      id, loai: 'anh', tep: `dung/media/${tenTep}`, ten: `Chữ: ${noiDung.replace(/\s+/g, ' ').trim().slice(0, 40) || '(trống)'}`,
      ms: 0, rong, cao, fps: 0, xoay: 0, coTieng: false, byte: buf.length, chu: x.chu,
    };
    const k = moHinh.kiem({ ...moHinh.moi(), media: [m] });
    if (!k.ok) {
      try { fs.unlinkSync(path.join(goc, tenTep)); } catch { /* bỏ */ }
      return { ok: false, loi: k.loi };
    }
    return { ok: true, media: k.duAn.media[0] };
  });

  /* ── ĐỌC BYTE cho bộ giải mã khung (Giai đoạn 3 — render/dung-khung.js, Mediabunny) ──────
     Xem trước đúng từng khung giải mã tệp media bằng WebCodecs ngay trong cửa sổ; tệp đi qua
     đây chứ KHÔNG mở CORS cho `bee-media` (mọi trang trong app là file://, cả JS của deck —
     giaoThuc.js). Chỉ tệp media của dự án: `dung/media/…` (cùng luật đường với du-an.json)
     và nằm THẬT trong deck (realpath — chặn junction). */
  const TRAN_DOC_BYTE = 16 * 1024 * 1024;
  const TRAN_DOC_CUNG_LUC = 4;
  /* Kiểm đường (đọc settings + 2 realpath, đồng bộ) nhớ theo (deck, tệp) vài giây — một lần tua
     là hàng chục lượt đọc nhỏ (audit GĐ3). */
  const nhoDuong = new Map();
  function tepMediaDeck(ten, rel) {
    if (!moHinh.duongMediaHopLe(rel)) return null;
    const khoa = `${ten}|${rel}`;
    const n = nhoDuong.get(khoa);
    if (n && Date.now() - n.luc < 5000) return n.f;
    let dir;
    try { dir = deckCua(ten); } catch { return null; }
    const f0 = kho.duongTrongDeck(dir, rel);
    const f = f0 && kho.nhanThatTrongDeck(dir, f0) ? f0 : null;
    if (nhoDuong.size > 200) nhoDuong.clear();
    nhoDuong.set(khoa, { f, luc: Date.now() });
    return f;
  }
  // Hàng chờ đọc: tối đa vài lượt cùng lúc — renderer gọi dồn dập không làm tiến trình chính cấp phát hàng GB.
  let dangDoc = 0;
  const choDoc = [];
  const giuCho = () => (dangDoc < TRAN_DOC_CUNG_LUC ? (dangDoc += 1, Promise.resolve()) : new Promise((r) => choDoc.push(r)));
  const traCho = () => { const r = choDoc.shift(); if (r) r(); else dangDoc -= 1; };
  ipcMain.handle('dung:coByte', async (_e, ten, rel) => {
    const f = tepMediaDeck(ten, rel);
    if (!f) return null;
    try { const st = await fs.promises.stat(f); return st.isFile() ? st.size : null; } catch { return null; }
  });
  ipcMain.handle('dung:docByte', async (_e, ten, rel, tu, den) => {
    if (!Number.isSafeInteger(tu) || !Number.isSafeInteger(den) || tu < 0 || den <= tu || den - tu > TRAN_DOC_BYTE) return null;
    const f = tepMediaDeck(ten, rel);
    if (!f) return null;
    await giuCho();
    let fh;
    try {
      fh = await fs.promises.open(f, 'r');
      // Kẹp theo cỡ tệp TRƯỚC khi cấp phát.
      const n = Math.min(den, (await fh.stat()).size) - tu;
      if (n <= 0) return null;
      const buf = Buffer.allocUnsafe(n);
      const { bytesRead } = await fh.read(buf, 0, n, tu);
      return new Uint8Array(buf.buffer, buf.byteOffset, bytesRead);
    } catch { return null; } finally {
      if (fh) await fh.close().catch(() => {});
      traCho();
    }
  });

  /** Các đoạn có giọng (ms) — xem trước "hạ nhạc khi có giọng" dùng CÙNG số với bản xuất (giong.js). */
  ipcMain.handle('dung:hoatDong', async (_e, ten) => {
    const dir = deckCua(ten);
    const dv = require('./xuat').dauVaoDeck(dir);
    return { ds: dv && dv.giong ? await require('./giong').hoatDong(dir, dv.giong) : [], coGiong: !!(dv && dv.giong) };
  });

  /* ── hàng đợi bộ nhớ đệm: MỘT việc một lúc, chạy nền ───────────────────
     Ảnh thu nhỏ trước (rẻ, người dùng nhìn thấy ngay), rồi sóng âm, proxy sau
     cùng (đắt nhất). Proxy đang chạy bị giết khi thoát app / đổi tên / xoá deck.
     ⚠ NHƯỜNG MÁY KHI ĐANG DỰNG VIDEO: bước quay chạy thời gian thực, libx264 của
     proxy giành CPU là hụt khung (đúng giá đã ghi ở don-rac.js). Chờ lượt dựng
     xong mới chạy tiếp; proxy cũng chạy ở mức ưu tiên thấp. */
  const hang = [];
  let dangChay = false;
  let viecDang = null;            // { dir, tienTrinh }
  const daXep = new Set();
  /* Việc HỎNG được nhớ theo `<dir>|<id>|<loại>`: không nhớ thì mỗi lần giao diện hỏi
     `dung:cache` lại xếp chạy lại ffprobe + proxy nhiều phút cho một tệp chắc chắn
     hỏng (vd ảnh động WebP) — vòng lặp vô hạn (audit 10/10/2026). */
  const daHong = new Set();
  const choDung = () => new Promise((ok) => {
    const t = setInterval(() => { if (!(ctx.jobState && ctx.jobState.running)) { clearInterval(t); ok(); } }, 2000);
  });

  function xepCache(ten, dir, m) {
    const khoa = `${dir}|${m.id}`;
    if (daXep.has(khoa)) return;
    daXep.add(khoa);
    hang.push({ ten, dir, m, khoa });
    chayHang();
  }

  async function chayHang() {
    if (dangChay) return;
    dangChay = true;
    try {
      while (hang.length) {
        if (ctx.jobState && ctx.jobState.running) await choDung();
        const v = hang.shift();
        if (!v) break;
        const bao = (loai, ok, them) => ctx.send('dung:cacheXong', { deck: v.ten, id: v.m.id, loai, ok, ...them });
        const hong = (loai) => daHong.add(`${v.dir}|${v.m.id}|${loai}`);
        const daHongTruoc = (loai) => daHong.has(`${v.dir}|${v.m.id}|${loai}`);
        viecDang = { dir: v.dir, tienTrinh: null, biHuy: false };
        let xepLai = false;
        try {
          if (v.m.loai !== 'tieng' && !daHongTruoc('anh')) {
            const a = await media.taoAnhNho(v.dir, v.m);
            // Bị huỷ giữa chừng (Dọn dẹp / đổi tên) không phải hỏng — nhớ hỏng là cả phiên không sinh lại.
            if (!a && !(viecDang && viecDang.biHuy)) hong('anh');
            bao('anh', !!a);
          }
          if ((v.m.loai === 'tieng' || v.m.coTieng) && !daHongTruoc('song')) {
            const s = await media.taoSong(v.dir, v.m);
            if (!s && !(viecDang && viecDang.biHuy)) hong('song');
            bao('song', !!s);
          }
          if (media.canProxy(v.m) && !daHongTruoc('proxy')) {
            if (ctx.jobState && ctx.jobState.running) await choDung();
            /* Lượt "Tạo video" bắt đầu GIỮA lúc tạo proxy: dừng proxy ngay (bước quay chạy thời gian
               thực — libx264 giành CPU là hụt khung), xếp lại chạy sau (audit 10/10/2026). */
            const vd = viecDang;
            const canhNhuong = setInterval(() => {
              const st = ctx.trangThaiDung ? ctx.trangThaiDung() : null;
              if (st && st.running && st.loai !== 'dung' && vd && vd.tienTrinh && vd.tienTrinh.exitCode == null) {
                vd.nhuong = true;
                vd.biHuy = true;
                try { vd.tienTrinh.kill(); } catch { /* đã thoát */ }
              }
            }, 500);
            const p = await media.taoProxy(v.dir, v.m, {
              khiSpawn: (tt) => {
                if (viecDang) viecDang.tienTrinh = tt;
                try { os.setPriority(tt.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* không đặt được thì thôi */ }
              },
              khiTien: (phan) => ctx.send('dung:tienTrinh', { deck: v.ten, id: v.m.id, loai: 'proxy', phan }),
            });
            /* Bị giết vì đổi tên/xoá deck / Dọn dẹp bộ nhớ đệm (huyDeck) thì KHÔNG tính là hỏng —
               nhớ là hỏng thì cả phiên không sinh lại nữa, xem trước đen (audit 10/10/2026). */
            clearInterval(canhNhuong);
            const biHuy = !!(viecDang && viecDang.biHuy);
            if (!p && !biHuy && fs.existsSync(v.dir)) hong('proxy');
            if (!p && viecDang && viecDang.nhuong && fs.existsSync(v.dir)) xepLai = true;   // nhường máy: làm lại sau lượt dựng
            else bao('proxy', !!p);
          }
        } catch (e) {
          bao('loi', false, { loi: e.message });
        } finally {
          viecDang = null;
          daXep.delete(v.khoa);
          if (xepLai) { hang.unshift(v); daXep.add(v.khoa); }
        }
      }
    } finally {
      dangChay = false;
    }
  }

  /** Bỏ mọi việc của một deck + giết ffmpeg đang chạy cho nó. Chờ tiến trình thoát hẳn. */
  async function huyDeck(dir) {
    const d = path.resolve(String(dir || ''));
    for (let i = hang.length - 1; i >= 0; i -= 1) {
      if (path.resolve(hang[i].dir) === d) { daXep.delete(hang[i].khoa); hang.splice(i, 1); }
    }
    // Quên các việc từng HỎNG của deck này: tệp có thể đã đổi (nhập lại, Dọn dẹp xong).
    [...daHong].forEach((k) => { if (path.resolve(k.split('|')[0]) === d) daHong.delete(k); });
    const v = viecDang;
    if (v && path.resolve(v.dir) === d) v.biHuy = true;
    if (v && path.resolve(v.dir) === d && v.tienTrinh && v.tienTrinh.exitCode == null) {
      await new Promise((ok) => {
        v.tienTrinh.once('close', ok);
        try { v.tienTrinh.kill(); } catch { ok(); }
        setTimeout(ok, 3000);
      });
    }
  }

  app.on('will-quit', () => {
    hang.length = 0;
    const tt = viecDang && viecDang.tienTrinh;
    if (tt) { try { tt.kill(); } catch { /* đã thoát */ } }
  });

  async function nhapNhieu(ten, ds) {
    const dir = deckCua(ten);
    const cac = (Array.isArray(ds) ? ds : []).filter((x) => typeof x === 'string' && x).slice(0, TRAN_MOI_LUOT);
    const ra = { media: [], loi: [] };
    for (let i = 0; i < cac.length; i += 1) {
      ctx.send('dung:tienTrinh', { deck: ten, loai: 'nhap', i, n: cac.length, ten: path.basename(cac[i]) });
      try {
        const r = await media.nhap(dir, cac[i]);
        if (!r.ok) { ra.loi.push(r.loi); continue; }
        ra.media.push({ ...r.media, daCo: r.daCo });
        xepCache(ten, dir, r.media);
      } catch (e) {
        ra.loi.push(`${path.basename(cac[i])}: ${e.message}`);
      }
    }
    if (Array.isArray(ds) && ds.length > TRAN_MOI_LUOT) ra.loi.push(`Mỗi lượt nhập tối đa ${TRAN_MOI_LUOT} tệp — đã bỏ qua ${ds.length - TRAN_MOI_LUOT} tệp.`);
    return ra;
  }

  ipcMain.handle('dung:nhap', async (_e, ten, ds) => nhapNhieu(ten, ds));

  /* GIỌNG ĐỌC THÀNH KHỐI (GĐ2.1 lộ trình gộp slide + timeline, 16/10/2026): chữ → tệp giọng (Python
     `tts.chu` — cùng nhà cung cấp / cache / chuẩn hoá số với deck) → media `tieng` của dự án, kèm `tts` (chữ +
     giọng) để sửa chữ rồi tạo lại. Bộ đệm theo BĂM (chữ, engine, giọng, model, tốc độ) ⇒ đọc lại đúng chữ cũ
     không tính tiền lần nữa. Tiền giọng: khoá của chính người dùng (Beeknoee / ElevenLabs) — không trừ lượt dựng
     của Studio; Edge / Trên máy miễn phí. */
  const ENGINE_GIONG = ['edge', 'vieneu', 'beeknoee', 'elevenlabs'];
  ipcMain.handle('dung:taoGiong', async (_e, ten, o) => {
    const dir = deckCua(ten);
    const v = o && typeof o === 'object' ? o : {};
    const chu = String(v.chu || '').replace(/\s+/g, ' ').trim();
    if (!chu) return { ok: false, loi: ['Chưa có chữ để đọc.'] };
    if (chu.length > 5000) return { ok: false, loi: ['Chữ dài quá 5.000 ký tự — chia thành nhiều khối giọng đọc.'] };
    const engine = ENGINE_GIONG.includes(v.engine) ? v.engine : 'edge';
    const voice = typeof v.voice === 'string' ? v.voice.trim().slice(0, 200) : '';
    const model = typeof v.model === 'string' ? v.model.trim().slice(0, 100) : '';
    const speed = Math.min(2, Math.max(0.5, Number(v.speed) || 1));
    /* Sidecar dùng CHUNG cờ huỷ cho mọi bước (tools.bat_dau_buoc) — chạy song song với một lượt dựng / phụ đề tự
       động là gỡ nút Dừng của lượt kia. */
    if (ctx.jobState && ctx.jobState.running) return { ok: false, loi: ['Đang dựng video — đợi xong rồi tạo giọng đọc.'] };
    if (dangPhuDe.size) return { ok: false, loi: ['Đang tạo phụ đề tự động — đợi xong rồi tạo giọng đọc.'] };
    const bam = crypto.createHash('sha256').update(JSON.stringify({ chu, engine, voice, model, speed })).digest('hex').slice(0, 16);
    const thuMuc = path.join(kho.thuMucCache(dir).goc, 'giong', bam);
    try {
      await ctx.ensureSidecar();
      const r = await ctx.sidecar().call('tts.chu', {
        projectPath: dir, outputDir: thuMuc, text: chu, engine, voice, modelId: model, speed,
        apiKey: require('../providers').khoaCho(engine) || null, chuanHoaSo: v.chuanHoaSo !== false,
      }, 10 * 60 * 1000);
      if (!r || !r.audioPath || !fs.existsSync(r.audioPath)) return { ok: false, loi: ['Không nhận được tệp giọng đọc.'] };
      // Tên tệp RIÊNG theo băm (tệp của provider luôn tên edge_full_voiceover.mp3…) — nhập trùng thì nhận ra (daCo).
      const tep = path.join(thuMuc, `giong-${bam}${path.extname(r.audioPath) || '.mp3'}`);
      if (path.resolve(tep) !== path.resolve(r.audioPath)) fs.copyFileSync(r.audioPath, tep);
      const n = await media.nhap(dir, tep);
      if (!n.ok) return { ok: false, loi: [n.loi] };
      xepCache(ten, dir, n.media);
      const tts = { chu, engine, voice, model, speed };
      return { ok: true, daCo: !!n.daCo, media: { ...n.media, ten: `Giọng: ${chu.slice(0, 40)}${chu.length > 40 ? '…' : ''}`, tts } };
    } catch (e) {
      return { ok: false, loi: [String((e && e.message) || e)] };
    }
  });

  /* NHẠC CÓ SẴN (GĐ2.2 lộ trình gộp): 5 kiểu nhạc tổng hợp của engine (src/dung/nhacSan.js — dựng lần đầu vào
     userData/nhac-san, ~1 giây) + nhạc mẫu của mẫu slide. Thêm vào dự án = nhập như media thường (chép vào deck). */
  const nhacSan = require('./nhacSan');
  const oNhac = () => ({
    thuMuc: path.join(app.getPath('userData'), 'nhac-san'),
    // media.exe: đường TUYỆT ĐỐI của ffmpeg đi kèm, null khi không có (đừng chạy "ffmpeg" trần — app mở từ Finder không có PATH).
    ffmpeg: media.exe('ffmpeg'),
    gocMau: ctx.templateRoots ? ctx.templateRoots() : [],
  });
  ipcMain.handle('dung:nhacSan', async () => nhacSan.DS.map(({ id, ten, moTa }) => ({ id, ten, moTa })));
  /** URL nghe thử (file:) — CSP của trang cho `media-src file:`. */
  ipcMain.handle('dung:nhacSan:nghe', async (_e, id) => {
    try { return { ok: true, url: require('node:url').pathToFileURL(await nhacSan.damBao(String(id || ''), oNhac())).href }; } catch (e) { return { ok: false, loi: [String((e && e.message) || e)] }; }
  });
  ipcMain.handle('dung:nhacSan:them', async (_e, ten, id) => {
    const dir = deckCua(ten);
    const muc = nhacSan.DS.find((x) => x.id === id);
    if (!muc) return { ok: false, loi: ['Không có bản nhạc này.'] };
    try {
      const tep = await nhacSan.damBao(muc.id, oNhac());
      const n = await media.nhap(dir, tep);
      if (!n.ok) return { ok: false, loi: [n.loi] };
      xepCache(ten, dir, n.media);
      return { ok: true, daCo: !!n.daCo, media: { ...n.media, ten: `Nhạc: ${muc.ten}` } };
    } catch (e) {
      return { ok: false, loi: [String((e && e.message) || e)] };
    }
  });

  /* TIẾNG HIỆU ỨNG CÓ SẴN (đợt 1 hiệu ứng): tổng hợp trong app (src/dung/tiengHieuUng.js — WAV vào userData, vài chục ms),
     thêm vào dự án = nhập như media thường. */
  const tiengHU = require('./tiengHieuUng');
  const oTiengHU = () => ({ thuMuc: path.join(app.getPath('userData'), 'tieng-hieu-ung') });
  ipcMain.handle('dung:tiengHieuUng', async () => tiengHU.DS.map(({ id, ten, moTa, dai }) => ({ id, ten, moTa, dai })));
  ipcMain.handle('dung:tiengHieuUng:nghe', async (_e, id) => {
    try { return { ok: true, url: require('node:url').pathToFileURL(tiengHU.damBao(String(id || ''), oTiengHU())).href }; } catch (e) { return { ok: false, loi: [String((e && e.message) || e)] }; }
  });
  ipcMain.handle('dung:tiengHieuUng:them', async (_e, ten, id) => {
    const dir = deckCua(ten);
    const muc = tiengHU.DS.find((x) => x.id === id);
    if (!muc) return { ok: false, loi: ['Không có tiếng hiệu ứng này.'] };
    try {
      const n = await media.nhap(dir, tiengHU.damBao(muc.id, oTiengHU()));
      if (!n.ok) return { ok: false, loi: [n.loi] };
      xepCache(ten, dir, n.media);
      return { ok: true, daCo: !!n.daCo, media: { ...n.media, ten: `Hiệu ứng: ${muc.ten}` } };
    } catch (e) {
      return { ok: false, loi: [String((e && e.message) || e)] };
    }
  });

  /* LỚP PHỦ CÓ SẴN (đợt 1 hiệu ứng): PNG vẽ đúng cỡ khung xuất (src/dung/lopPhu.js → userData/lop-phu). Danh sách kèm
     ảnh thu nhỏ đúng khổ dự án (dọc / ngang). */
  const lopPhu = require('./lopPhu');
  const oLopPhu = () => ({ thuMuc: path.join(app.getPath('userData'), 'lop-phu') });
  const nhoDo = new Map();
  ipcMain.handle('dung:lopPhu', async (_e, doc) => {
    const [w, h] = doc === false ? [128, 72] : [72, 128];
    return lopPhu.DS.map(({ id, ten, moTa, macDinh }) => {
      const k = `${id}-${w}x${h}`;
      if (!nhoDo.has(k)) { try { nhoDo.set(k, lopPhu.anhNho(id, w, h)); } catch { nhoDo.set(k, ''); } }
      return { id, ten, moTa, macDinh, anh: nhoDo.get(k) };
    });
  });
  ipcMain.handle('dung:lopPhu:them', async (_e, ten, id, rong, cao) => {
    const dir = deckCua(ten);
    const muc = lopPhu.DS.find((x) => x.id === id);
    if (!muc) return { ok: false, loi: ['Không có lớp phủ này.'] };
    const w = Math.round(Number(rong));
    const h = Math.round(Number(cao));
    if (!(w >= 16 && h >= 16 && w <= 8192 && h <= 8192)) return { ok: false, loi: ['Cỡ khung lớp phủ sai.'] };
    try {
      const cv = lopPhu.coVe(muc.id, w, h);
      const n = await media.nhap(dir, lopPhu.damBao(muc.id, cv.w, cv.h, oLopPhu()));
      if (!n.ok) return { ok: false, loi: [n.loi] };
      xepCache(ten, dir, n.media);
      return { ok: true, daCo: !!n.daCo, macDinh: muc.macDinh, media: { ...n.media, ten: `Lớp phủ: ${muc.ten}`, lopPhu: muc.id } };
    } catch (e) {
      return { ok: false, loi: [String((e && e.message) || e)] };
    }
  });

  ipcMain.handle('dung:chonTep', async (_e, ten) => {
    deckCua(ten);
    const win = ctx.mainWindow && ctx.mainWindow();
    const r = await dialog.showOpenDialog(win, {
      title: 'Nhập media vào dự án',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video, ảnh, âm thanh', extensions: [...media.DUOI.video, ...media.DUOI.anh, ...media.DUOI.tieng] },
        { name: 'Video', extensions: media.DUOI.video },
        { name: 'Ảnh', extensions: media.DUOI.anh },
        { name: 'Âm thanh', extensions: media.DUOI.tieng },
      ],
    });
    if (r.canceled || !r.filePaths.length) return { media: [], loi: [], huy: true };
    return nhapNhieu(ten, r.filePaths);
  });

  /**
   * XUẤT bản dựng — vào hàng đợi dựng chung (`ctx.batDauDung`, render/queue.js), trừ
   * lượt như dựng thường. Lưu dự án TRƯỚC (giao diện gửi kèm bản mới nhất) để lượt
   * xuất đọc đúng thứ người dùng đang thấy, kể cả khi tự lưu chưa kịp chạy.
   */
  ipcMain.handle('dung:xuat', async (_e, ten, duAn) => {
    const dir = deckCua(ten);
    if (duAn) {
      const g = kho.ghiDuAn(dir, duAn);
      if (!g.ok) return { ok: false, loi: g.loi };
    }
    // Dự án video: không có video slide — bản xuất tự sinh nền đen (GĐ3.4).
    if (!timVideo(dir) && !duAnVideo.laDuAnVideo(dir)) return { ok: false, loi: ['Deck chưa có video slide — bấm "Tạo video" trước, rồi mới xuất bản dựng.'] };
    if (typeof ctx.batDauDung !== 'function') return { ok: false, loi: ['Hàng đợi dựng chưa sẵn sàng.'] };
    /* Hàng đợi RẢNH thì `batDauDung` CHẠY luôn và chỉ xong khi xuất xong — chờ nó là giao
       diện nhận "đã bắt đầu" SAU câu "đã xuất xong" và ghi đè lên (audit 10/10/2026). Chỉ chờ
       câu trả lời tức thì (xếp hàng / đang chạy / lỗi ngay); kết cục đi qua render:done/error. */
    try {
      const p = ctx.batDauDung({ projectDir: dir, loai: 'dung' });
      Promise.resolve(p).catch(() => { /* đã báo qua render:error */ });
      const r = await Promise.race([p, new Promise((xong) => setTimeout(() => xong('dangChay'), 80))]);
      if (r === 'dangChay') return { ok: true, batDau: true };
      if (r && r.banDung) return { ok: true, xong: true };   // xong ngay trong 80 ms — render:done đã báo
      /* GIỮ cờ `trung` (24/10/2026): deck đã nằm sẵn trong hàng xuất (người dùng xếp từ giao diện) thì
         hàng đợi không thêm gì mà vẫn trả `xepHang`. Rơi cờ là `studio_export_edit` tưởng mình vừa xếp
         được một lượt và mở việc MCP "nhận vơ" lượt của người dùng — `studio_cancel_job` sau đó gỡ luôn
         lượt của người ta (cùng bẫy `studio_render` đã chặn, mcp/congCu.js). */
      return { ok: true, ...(r && r.xepHang ? { xepHang: true, viTri: r.viTri, ...(r.trung ? { trung: true } : {}) } : {}), ...(r && r.dangChay ? { dangChay: true } : {}) };
    } catch (e) {
      return { ok: false, loi: [e.message] };
    }
  });

  /** Bộ nhớ đệm đã có cho một media — thiếu thứ gì (và chưa từng hỏng) thì xếp hàng sinh lại. */
  ipcMain.handle('dung:cache', async (_e, ten, mVao) => {
    const dir = deckCua(ten);
    /* Nhận bản ghi media từ giao diện (vừa nhập thì CHƯA kịp vào du-an.json trên
       đĩa) — nhưng kiểm lại như mọi thứ đến từ renderer: id đúng dạng, tệp nằm
       trong dung/media/ và có thật. */
    const k = moHinh.kiem({ ...moHinh.moi(), media: [mVao] });
    const m = k.ok ? k.duAn.media[0] : null;
    const f = m && kho.duongTrongDeck(dir, m.tep);
    if (!m || !f || !fs.existsSync(f)) return { anh: null, song: null, proxy: null, goc: null };
    const id = m.id;
    const c = kho.thuMucCache(dir);
    const relCache = (loai, tep) => `dung/cache/${loai}/${tep}`;
    /* Chữ tiêu đề: ảnh thu nhỏ CHÍNH LÀ tệp PNG (nhỏ sẵn) — ảnh thu nhỏ theo id media sẽ cũ
       mỗi lần sửa chữ (media giữ id, đổi tệp). */
    const anh = m.chu ? moHinh.urlMedia(ten, m.tep)
      : fs.existsSync(path.join(c.anh, `${id}.jpg`)) ? moHinh.urlMedia(ten, relCache('anh', `${id}.jpg`)) : null;
    let song = null;
    try { song = JSON.parse(fs.readFileSync(path.join(c.song, `${id}.json`), 'utf8')); } catch { /* chưa có */ }
    const proxy = fs.existsSync(path.join(c.proxy, `${id}.mp4`)) ? moHinh.urlMedia(ten, relCache('proxy', `${id}.mp4`)) : null;
    const hongRoi = (loai) => daHong.has(`${dir}|${id}|${loai}`);
    const thieu = (m.loai !== 'tieng' && !anh && !hongRoi('anh'))
      || ((m.loai === 'tieng' || m.coTieng) && !song && !hongRoi('song'))
      // Proxy bị ngắt giữa chừng (thoát app) thì lần sau phải được xếp lại (audit 10/10/2026).
      || (media.canProxy(m) && !proxy && !hongRoi('proxy'));
    if (thieu) xepCache(ten, dir, m);
    return { anh, song, proxy, goc: moHinh.urlMedia(ten, m.tep), dangSinh: thieu };
  });

  /* ── THƯ VIỆN DÙNG CHUNG + MẪU (Giai đoạn 3, thuVienChung.js) ──────────────
     Media dùng cho mọi dự án (logo, nhạc nền…) và mẫu intro/outro. Đưa vào dự án = CHÉP
     vào dung/media của deck (media.nhap) — dự án luôn tự đủ. */
  const tvc = require('./thuVienChung');
  tvc.khoiTao(app);
  const dsTvc = () => ({ media: tvc.ds(), mau: tvc.dsMau() });
  ipcMain.handle('dung:tvc:ds', async () => dsTvc());
  ipcMain.handle('dung:tvc:chonTep', async () => {
    const win = ctx.mainWindow && ctx.mainWindow();
    const r = await dialog.showOpenDialog(win, {
      title: 'Thêm vào thư viện dùng chung',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Video, ảnh, âm thanh', extensions: [...media.DUOI.video, ...media.DUOI.anh, ...media.DUOI.tieng] }],
    });
    if (r.canceled || !r.filePaths.length) return { ...dsTvc(), loi: [], huy: true };
    const loi = [];
    for (const f of r.filePaths.slice(0, TRAN_MOI_LUOT)) {
      const k = await tvc.themTep(f).catch((e) => ({ ok: false, loi: e.message }));
      if (!k.ok) loi.push(k.loi);
    }
    return { ...dsTvc(), loi };
  });
  /** Lưu media CỦA DỰ ÁN vào thư viện (★ trong tab Thư viện). Bản ghi từ giao diện được kiểm lại. */
  async function tuDeckVaoTvc(dir, ds) {
    const raId = new Map();
    const loi = [];
    for (const mVao of (Array.isArray(ds) ? ds : []).slice(0, 200)) {
      const k = moHinh.kiem({ ...moHinh.moi(), media: [mVao] });
      const m = k.ok ? k.duAn.media[0] : null;
      const f = m && kho.duongTrongDeck(dir, m.tep);
      if (!m || !f || !fs.existsSync(f)) { loi.push(`${(mVao && mVao.ten) || 'media'}: không còn tệp trong dự án.`); continue; }
      const r = await tvc.themTep(f, { ten: m.ten, chu: m.chu, tts: m.tts }).catch((e) => ({ ok: false, loi: e.message }));
      if (r.ok) raId.set(m.id, r.muc.id); else loi.push(r.loi);
    }
    return { raId, loi };
  }
  ipcMain.handle('dung:tvc:tuDeck', async (_e, ten, ds) => {
    const { loi } = await tuDeckVaoTvc(deckCua(ten), ds);
    return { ...dsTvc(), loi };
  });
  ipcMain.handle('dung:tvc:xoa', async (_e, id) => ({ ...tvc.xoa(String(id || '')), ...dsTvc() }));
  ipcMain.handle('dung:tvc:doiTen', async (_e, id, tenMoi) => ({ ...tvc.doiTen(String(id || ''), tenMoi), ...dsTvc() }));
  ipcMain.handle('dung:tvc:vaoDeck', async (_e, ten, ids) => {
    const dir = deckCua(ten);
    const r = await tvc.vaoDeck(dir, ids);
    r.media.forEach((m) => xepCache(ten, dir, m));
    return r;
  });
  /**
   * Lưu mẫu từ các khối đang chọn. `khoi` mang bản ghi media CỦA DỰ ÁN (`mediaDuAn`) — media
   * chưa có trong thư viện thì thêm vào trước (mẫu chỉ trỏ tới thư viện, không trỏ tới deck).
   */
  ipcMain.handle('dung:mau:luu', async (_e, ten, vao) => {
    const dir = deckCua(ten);
    const x = vao || {};
    const khoi = Array.isArray(x.khoi) ? x.khoi.slice(0, 200) : [];
    const { raId, loi } = await tuDeckVaoTvc(dir, khoi.map((k) => k && k.mediaDuAn));
    if (loi.length) return { ok: false, loi };
    const r = tvc.luuMau({
      ten: x.ten, khung: x.khung,
      khoi: khoi.map((k) => ({ ...k, mediaDuAn: undefined, media: raId.get(k.mediaDuAn && k.mediaDuAn.id) })),
    });
    return r.ok ? { ok: true, mau: r.mau, ...dsTvc() } : { ok: false, loi: [r.loi] };
  });
  ipcMain.handle('dung:mau:xoa', async (_e, id) => ({ ...tvc.xoaMau(String(id || '')), ...dsTvc() }));
  /** Chèn mẫu: chép media vào deck, trả mẫu + bảng id thư viện → bản ghi media dự án. */
  ipcMain.handle('dung:mau:vaoDeck', async (_e, ten, id) => {
    const dir = deckCua(ten);
    const mau = tvc.layMau(String(id || ''));
    if (!mau) return { ok: false, loi: ['Không thấy mẫu.'] };
    const r = await tvc.vaoDeck(dir, mau.media);
    if (r.loi.length) return { ok: false, loi: r.loi };
    r.media.forEach((m) => xepCache(ten, dir, m));
    return { ok: true, mau, media: r.media };
  });

  /* Hàng đợi dựng hỏi trước khi chạy: đang tạo phụ đề tự động thì KHÔNG bắt đầu lượt dựng — hai bên dùng
     chung cờ huỷ của sidecar Python (bấm Dừng bên này giết việc bên kia) và bản xuất vẽ lớp phụ đề vào cùng
     bộ nhớ đệm (rà 16/10/2026). */
  return { dungHuyDeck: huyDeck, dangTaoPhuDe: () => dangPhuDe.size > 0 };
}

module.exports = { dangKy }