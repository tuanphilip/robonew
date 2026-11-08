'use strict';
/**
 * TIMELINE kiểu Premiere — hàng dưới của trang Dựng video (09/10/2026).
 *
 * Thay cho "Danh sách slide" (dải ô đều nhau dưới khung xem trước). Chiếm cả
 * phần dưới của cột giữa lẫn cột phải (css/timeline.css) — cột trái (AI) vẫn
 * cao hết cửa sổ. NHẸ MẮT là yêu cầu chính (chủ dự án: "nhìn rối mắt quá"):
 * khối nền nhạt, một ảnh đầu khối, chữ chỉ hiện khi đủ chỗ. Gồm:
 *
 *   ┌ 00:13:02 / 02:40:00  ◀ ▶ ▶▶ │ trạng thái …            📌 │ − ━━ + ⤢ │ ▾ ┐
 *   │          │ 00:00:00   00:05:00   00:10:00 ▼ …                      │
 *   │ V2 Phụ đề│ [câu][câu][câu]  [câu] …                                   │
 *   │ V1 Slide │ [1 ▤▤▤▤▤▤][2 ▤▤▤▤▤▤▤▤▤▤][3 ▤▤▤▤]…   ← dải ảnh thu nhỏ      │
 *   │ A1 Giọng │ [∿∿∿∿∿∿∿][∿∿∿∿∿∿∿∿∿∿∿][∿∿∿∿∿]…   ← sóng âm thật          │
 *   │ A2 Nhạc  │ [meta.mp3 ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿]               │
 *   │ A3 Chuyển│ [Boom]   [Sweep]     [Rise] …                              │
 *   └──────────┴───────────────────────────────────────────────────────────┘
 *
 * ── GIAI ĐOẠN 1: CHỈ XEM VÀ TUA ───────────────────────────────────────────
 * Không kéo cắt, không kéo đổi chỗ: độ dài từng slide do GIỌNG ĐỌC quyết định,
 * không do người dùng kéo. Tay kéo trim mà không đổi được video thật là lừa
 * người dùng. Thao tác có được: bấm/kéo trên thước hay làn để tua, bấm khối
 * slide để sang slide đó, phóng/thu, phím tắt như Premiere.
 *
 * ── NGUỒN SỐ LIỆU — không bịa ────────────────────────────────────────────
 *   · Mốc từng slide: `output/timing.json` (qua `thanhPhat.mocThoiGian()`), tức
 *     đúng trục của video đã dựng. Tổng = độ dài thật của tệp mp4.
 *   · Deck CHƯA dựng: không có mốc nào ⇒ ƯỚC TÍNH theo số chữ lời thoại, khối
 *     vẽ sọc chéo + dòng trạng thái nói rõ "ước tính".
 *   · Sóng âm + mốc từng chữ: `preview.songAm` (main/songAm.js, ffmpeg).
 *   · Ảnh thu nhỏ: chính bộ ảnh của dải slide cũ (`sanKhau.anh`).
 *   · Nhạc nền / tiếng chuyển / phụ đề bật hay tắt: `preview-settings.json`
 *     của deck (`deckCau.docThietLap()`).
 *
 * ⚠ Bấm vào KHỐI SLIDE giữ đúng nếp của dải cũ: đang xem video thì tua video,
 * không thì chuyển slide trên deck (để sửa). Kéo trên THƯỚC thì như Premiere:
 * mở video đã dựng (nếu có) rồi tua theo tay.
 */
(function () {
  const api = window.beeknoee;
  if (!api || !api.preview) return;
  const RP = (window.__renderPage = window.__renderPage || {});

  const SHELL = '.dashboard-shell.bt-ba-cot';
  const FPS = 30;                 // video Studio dựng 30 khung/giây (info.fps nếu có)
  const CAO_MAC_DINH = 300;       // khớp --tl-cao trong tokens.css — đủ năm track + thanh cuộn ngang
  const CAO_MIN = 120;
  const CAO_THU = 37;             // chỉ còn thanh công cụ (36px + viền)
  const PPS_MAX = 240;            // phóng to nhất: 240px mỗi giây (~8px mỗi khung)
  const RONG_CANVAS_MAX = 4096;   // canvas sóng âm rộng hơn thì kéo giãn — tránh trần cỡ canvas
  const CHU_MOI_GIAY = 3.3;       // ước lượng tốc độ đọc tiếng Việt (đo: 3,5–4,1 ở tốc 1.15×)
  const KHOA = { cao: 'bee-tl-cao', thu: 'bee-tl-thu', bam: 'bee-tl-bam' };

  /* Track SINH TỪ DECK (chỉ đọc — đổi bằng cách sửa deck rồi dựng lại). Track của
     NGƯỜI DÙNG (V2, V3, A4…) đến từ dự án dựng (`RP.dung`, render/dung-kho.js) và
     xen vào đúng chỗ như Premiere: phụ đề trên cùng, track hình cao nhất ở trên,
     V1 sát dưới; A1 giọng · A2 nhạc · A3 tiếng chuyển, track tiếng thêm ở dưới. */
  const TRACK_DECK = {
    phude: { id: 'phude', huy: 'C1', loai: 'p', ten: 'Phụ đề', cao: 22 },
    hinh: { id: 'hinh', huy: 'V1', loai: 'v', ten: 'Slide', cao: 46 },
    giong: { id: 'giong', huy: 'A1', loai: 'a', ten: 'Giọng đọc', cao: 38, goc: 'giong' },
    nhac: { id: 'nhac', huy: 'A2', loai: 'a', ten: 'Nhạc nền', cao: 28, goc: 'deck' },
    sfx: { id: 'sfx', huy: 'A3', loai: 'a', ten: 'Tiếng chuyển', cao: 22, goc: 'deck' },
  };
  const CAO_ND = { hinh: 36, tieng: 30 };

  /** Danh sách track hiển thị, trên xuống dưới. */
  function dsTrack() {
    const d = RP.dung && RP.dung.duAn();
    const nd = d ? d.track : [];
    const ndHinh = nd.filter((t) => t.loai === 'hinh').slice().reverse()
      .map((t) => ({ id: t.id, huy: t.id, loai: 'v', ten: t.ten, cao: CAO_ND.hinh, nd: t }));
    const ndTieng = nd.filter((t) => t.loai === 'tieng')
      .map((t) => ({ id: t.id, huy: t.id, loai: 'a', ten: t.ten, cao: CAO_ND.tieng, nd: t }));
    /* Dự án VIDEO TRỐNG (src/dung/duAnVideo.js): V1 là nền đen (dài hơn nội dung để còn chỗ thả),
       không có phụ đề / giọng / nhạc / tiếng chuyển của deck. */
    if (RP.dung && RP.dung.laVideo && RP.dung.laVideo()) {
      /* C1 LUÔN hiện (16/10/2026): bấm tên track là tới bảng phụ đề — tạo tự động, kiểu chữ. Trước chỉ hiện
         khi đã có phụ đề, mà lối tạo lại nằm ở "cài đặt" khi không chọn gì — khó tìm. */
      return [TRACK_DECK.phude, ...ndHinh, { ...TRACK_DECK.hinh, ten: 'Nền', cao: 26 }, ...ndTieng];
    }
    return [TRACK_DECK.phude, ...ndHinh, TRACK_DECK.hinh, TRACK_DECK.giong, TRACK_DECK.nhac, TRACK_DECK.sfx, ...ndTieng];
  }

  /** Tổng độ dài hiển thị: video/deck + khối người dùng xa nhất (giây). */
  function capNhatTong() {
    if (!mh || !mh.slides) return;
    if (mh.tongDeck == null) mh.tongDeck = mh.tong;
    const d = RP.dung && RP.dung.duAn();
    const M = window.__beeDung && window.__beeDung.moHinh;
    const nd = d && M ? M.tongMs({ ...d, khoi: d.khoi }, RP.dung.moc(), 0) / 1000 : 0;
    // Dự án video (GĐ3.4): thước = nội dung + chỗ thả, giãn theo bậc khi khối chạm gần cuối.
    if (mh.laVideo && M) { mh.tong = M.doDaiChoTha(nd * 1000) / 1000; return; }
    // V1 đã sửa: video nền dài đúng tổng các đoạn — không còn là độ dài video gốc.
    mh.tong = v1Moc() ? nd : Math.max(mh.tongDeck, nd);
  }

  /* localStorage chỉ để nhớ tiện tay (chiều cao, thu gọn) — hỏng thì thôi. */
  const kho = {
    doc(k) { try { return localStorage.getItem(k); } catch { return null; } },
    ghi(k, v) { try { localStorage.setItem(k, String(v)); } catch { /* không lưu được */ } },
  };
  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const kep = (x, a, b) => Math.max(a, Math.min(b, x));
  const p2 = (n) => String(n).padStart(2, '0');

  /** Mã thời gian kiểu Premiere: hh:mm:ss:ff. ĐỦ bốn cụm — dạng ngắn mm:ss:ff
      ("02:40:09") đọc nhầm thành 2 giờ 40 phút, đã thấy trên ảnh chụp. */
  function maGio(g, fps) {
    const t = Math.max(0, g || 0);
    const f = Math.min(fps - 1, Math.floor((t - Math.floor(t)) * fps + 1e-6));
    const s = Math.floor(t) % 60;
    const m = Math.floor(t / 60) % 60;
    const h = Math.floor(t / 3600);
    return `${p2(h)}:${p2(m)}:${p2(s)}:${p2(f)}`;
  }

  /** Nhãn trên thước: gọn `01:30` khi bước ≥ 1 giây (thước thưa, dễ đọc); mã đủ khi
      phóng tới mức khung hình. Mã đầy đủ luôn ở đồng hồ góc trái. */
  function nhanThuoc(g, buoc, fps) {
    if (buoc < 1) return maGio(g, fps).slice(3);
    const t = Math.round(g);
    const h = Math.floor(t / 3600);
    return `${h ? `${h}:` : ''}${p2(Math.floor(t / 60) % 60)}:${p2(t % 60)}`;
  }

  /* ── trạng thái ─────────────────────────────────────────────────────── */
  let goc = null;          // <section.bt-timeline>
  let cuon = null;         // .tl-cuon — vùng cuộn
  let luoi = null;         // .tl-luoi — lưới tên track | làn
  let dauPhat = null;
  let thuocCv = null;
  let rongDau = 190;       // bề ngang cột tên track (đọc từ --tl-dau-w)
  let mh = null;           // mô hình đang vẽ, xem `dungMoHinh`
  let pps = 20;            // pixel mỗi giây
  let vuaKhung = true;     // đang ở chế độ "vừa khung" — đổi cỡ thì tính lại
  let tDau = 0;            // giây của đầu phát
  let bam = kho.doc(KHOA.bam) !== '0';
  let vongRaf = 0;
  let maNap = 0;           // chống đua khi đổi deck liên tục
  let slideSang = -1;      // khối slide đang viền sáng
  let anhCu = null;        // mảng ảnh thu nhỏ đã vẽ — đổi thì vẽ lại track V1
  let dangKeoTua = false;  // đang kéo trên thước/làn — đừng kéo đầu phát về đầu slide
  let lucDieuHuong = 0;    // lúc timeline vừa bảo deck sang slide — xem dongBoDau
  let slideDich = -1;      // slide timeline bảo deck sang SAU CÙNG — xem denSlideDeck

  /** Ảnh thu nhỏ của deck đang mở; `null` khi chưa có (để so ĐỊNH DANH mảng). */
  const layAnh = () => {
    const a = mh && RP.sanKhau && RP.sanKhau.anh ? RP.sanKhau.anh(mh.deck) : null;
    return a && a.length ? a : null;
  };

  /* ══ MÔ HÌNH ═══════════════════════════════════════════════════════════ */

  /** Chữ thuần của một slide (cho nhãn khối) — như dải slide cũ. */
  /* Khung deck ở origin riêng — chữ slide và lựa chọn của `<select>` engine đến qua bản chụp
     trạng thái của khung (deck-cau.js#chuSlide / #mucChon). */
  function chuSlide(i) {
    return String((RP.deckCau ? RP.deckCau.chuSlide() : [])[i] || '');
  }

  /** Nhãn hiển thị của một giá trị trong ô chọn của engine (vd `boom` → "Boom"). */
  function nhanChon(id, v) {
    const x = (RP.deckCau ? RP.deckCau.mucChon(id) : []).find((op) => op.v === v);
    return x ? x.t : String(v || '');
  }

  /** Chia một câu thoại thành các cụm phụ đề ngắn (≤ 7 chữ, ngắt theo dấu câu). */
  function catCum(chu) {
    const ra = [];
    String(chu || '').split(/(?<=[.!?…;:])\s+/).forEach((doan) => {
      const tu = doan.trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < tu.length; i += 8) ra.push(tu.slice(i, i + 8).join(' '));
    });
    return ra.filter(Boolean);
  }

  /**
   * Dựng mô hình từ những gì đang có. Không gọi IPC — phần chậm (sóng âm, mốc
   * từng chữ) gắn vào sau qua `ganSongAm`.
   */
  function dungMoHinh() {
    const tp = RP.thanhPhat;
    const moc = tp && tp.mocThoiGian ? tp.mocThoiGian() : null;
    const tin = tp && tp.tinVideo ? tp.tinVideo() : null;
    const soSlideDeck = RP.deckCau ? RP.deckCau.soSlide() : 0;
    const tl = mh && mh.deck === deckDang() ? mh.tl : null;
    const loi = (tl && tl.slides && Array.isArray(tl.slides.scriptLines)) ? tl.slides.scriptLines : [];
    let fps = (tin && Number(tin.fps)) || FPS;

    let slides;
    let nguon;
    let tong;
    /* DỰ ÁN VIDEO TRỐNG (GĐ3.4): không slide, không video — thước dài theo NỘI DUNG + chỗ thả (moHinh.doDaiChoTha),
       fps của dự án. Trước đây lấy theo nền đen giả `_nen.mp4` (1 khung/giây ⇒ bước khung 1 giây). */
    const laVideo = !!(RP.dung && RP.dung.laVideo && RP.dung.laVideo());
    if (laVideo) {
      const d0 = RP.dung.duAn();
      const Mh = window.__beeDung && window.__beeDung.moHinh;
      slides = [];
      nguon = 'video';
      tong = Mh ? Mh.doDaiChoTha(RP.dung.msXuat ? RP.dung.msXuat() : 0) / 1000 : 30;
      if (d0 && d0.khung && d0.khung.fps) fps = d0.khung.fps;
    } else if (moc && moc.moc && moc.moc.length) {
      slides = moc.moc.map((m, i) => ({ i, tu: m.tu, den: m.den, loi: m.chu || loi[i] || '' }));
      const dv = tin && Number(tin.duration);
      tong = Math.max(moc.tong, isFinite(dv) && dv > 0 ? dv : 0);
      nguon = tin && tin.file ? 'video' : 'moc';
    } else {
      const n = soSlideDeck || loi.length;
      let t = 0;
      slides = [];
      for (let i = 0; i < n; i += 1) {
        const soChu = String(loi[i] || '').trim().split(/\s+/).filter(Boolean).length;
        const d = soChu ? Math.max(2, soChu / CHU_MOI_GIAY) : 4;
        slides.push({ i, tu: t, den: t + d, loi: loi[i] || '' });
        t += d;
      }
      tong = t;
      nguon = n ? 'uoc' : 'trong';
    }
    slides.forEach((s) => { s.chu = chuSlide(s.i) || s.loi.slice(0, 60); });

    // Tiếng chuyển slide: mỗi slide một tiếng (mảng theo số slide), phát lúc vào slide.
    const tsArr = (tl && tl.slides && Array.isArray(tl.slides.transitionSounds)) ? tl.slides.transitionSounds : [];
    const sfx = slides
      .map((s) => ({ tu: s.tu, den: Math.min(s.den, s.tu + 0.8), v: tsArr[s.i] }))
      .filter((x) => x.v && x.v !== 'none')
      .map((x) => ({ ...x, ten: nhanChon('transitionSelect', x.v) }));

    // Nhạc nền: tắt / tệp tải lên (có sóng) / mẫu tổng hợp (không có tệp).
    const bgm = tl && tl.bgm;
    let nhac = null;
    if (bgm && bgm.mode !== 'none') {
      const vol = Math.round((Number(bgm.volume) || 0) * 100);
      nhac = bgm.mode === 'custom'
        ? { ten: (bgm.custom && bgm.custom.name) || 'Nhạc tải lên', vol, tongHop: false }
        : { ten: `Nhạc tổng hợp · ${nhanChon('bgmSelect', bgm.preset)}`, vol, tongHop: true };
    }

    const cu = mh && mh.deck === deckDang() ? mh : null;
    const m = {
      deck: deckDang(), tl, fps, tong, nguon, slides, sfx, nhac, soSlideDeck, laVideo,
      lechDeck: !laVideo && nguon !== 'uoc' && soSlideDeck > 0 && soSlideDeck !== slides.length,
      phudeTat: !!(tl && tl.subtitles && tl.subtitles.enabled === false),
      // Phần chậm giữ lại qua các lượt dựng lại mô hình (cùng deck).
      songGiong: cu ? cu.songGiong : null,
      songNhac: cu ? cu.songNhac : null,
      mocChu: cu ? cu.mocChu : null,
      dangDung: cu ? cu.dangDung : false,
    };
    m.phude = dungPhuDe(m);
    return m;
  }

  /**
   * Cụm phụ đề. Có mốc từng chữ (Whisper) thì đặt đúng giây; không thì chia đều
   * theo độ dài chữ trong từng slide — đủ để thấy câu nào nằm ở đâu.
   */
  function dungPhuDe(m) {
    const ra = [];
    const mc = m.mocChu;
    if (mc && m.nguon !== 'uoc' && mc.dong.length === m.slides.length) {
      // Quy mốc theo trục TỆP GIỌNG về trục VIDEO, từng slide một.
      const dau = [];
      let c = 0;
      mc.dong.forEach((d) => { dau.push(c); c += d; });
      let k = 0;
      let cum = [];
      const xa = () => {
        if (!cum.length) return;
        ra.push({ tu: cum[0].t0, den: cum[cum.length - 1].t1, chu: cum.map((x) => x.w).join(' ') });
        cum = [];
      };
      mc.tu.forEach((w) => {
        while (k + 1 < dau.length && w.s >= dau[k + 1] - 1e-3) { xa(); k += 1; }
        const s = m.slides[k];
        const t0 = kep(s.tu + (w.s - dau[k]), s.tu, s.den);
        const t1 = kep(s.tu + (w.e - dau[k]), t0, s.den);
        cum.push({ w: w.w, t0, t1 });
        // Ngắt cụm như phụ đề thật: hết câu; dấu phẩy chỉ khi cụm đã đủ dài.
        if (cum.length >= 8 || /[.!?…;:]$/.test(w.w) || (cum.length >= 4 && /[,—]$/.test(w.w))
          || t1 - cum[0].t0 > 3) xa();
      });
      xa();
      /* Phụ đề GIỮ trên màn tới khi cụm sau hiện (khoảng ngắt hơi < 0,8 s) —
         vẽ đúng thế thì track đỡ lốm đốm, và khớp thứ người xem thấy. */
      for (let i = 0; i + 1 < ra.length; i += 1) {
        const ke = ra[i + 1].tu - ra[i].den;
        if (ke > 0 && ke < 0.8) ra[i].den = ra[i + 1].tu;
      }
      if (ra.length) return ra;
    }
    m.slides.forEach((s) => {
      const cac = catCum(s.loi);
      const tongChu = cac.reduce((a, x) => a + x.length, 0) || 1;
      let t = s.tu;
      cac.forEach((x) => {
        const d = ((s.den - s.tu) * x.length) / tongChu;
        ra.push({ tu: t, den: t + d, chu: x, uoc: true });
        t += d;
      });
    });
    return ra;
  }

  const deckDang = () => (RP.deckCau && RP.deckCau.deck()) || '';
  const tenTuDuong = (d) => String(d || '').split(/[\\/]/).filter(Boolean).pop() || '';

  /** Slide chứa giây `g`. */
  /* ── V1 ĐÃ SỬA (cắt / đổi chỗ slide — Giai đoạn 3) ─────────────────────────
     Đầu phát `tDau` là giây TIMELINE. Video slide (thẻ <video>) chạy theo giây GỐC. Mọi chỗ
     đọc/ghi giờ video đi qua hai hàm dưới; mốc mang ánh xạ lấy từ RP.dung.moc() (moHinh.mocDich). */
  const v1Moc = () => {
    const dg = RP.dung;
    const m = dg && dg.moc ? dg.moc() : null;
    return m && m.doan && m.doan.length ? m : null;
  };
  const goc2dich = (g) => { const m = v1Moc(); return m ? m.anXa(g * 1000) / 1000 : g; };
  const dich2goc = (t) => { const m = v1Moc(); return m ? m.nguoc(t * 1000) / 1000 : t; };
  /** Khoảng giây GỐC → các mảnh trên timeline [{ tu, den, lech }] (giây; lech = gốc − timeline). */
  function chieu(tu, den) {
    const m = v1Moc();
    if (!m) return [{ tu, den, lech: 0 }];
    const M = window.__beeDung && window.__beeDung.moHinh;
    return M.chieuKhoang(m, tu * 1000, den * 1000).map((x) => ({ tu: x.tuMs / 1000, den: x.denMs / 1000, lech: x.lechMs / 1000 }));
  }
  /** Đầu các "khối V1" trên timeline (giây): đoạn V1 đã sửa, hoặc đầu từng slide. */
  const dauKhoiV1 = () => { const m = v1Moc(); return m ? m.doan.map((x) => x.dichTu / 1000) : mh.slides.map((x) => x.tu); };

  /** Có timeline để vẽ / tua: deck có slide, hay dự án video (không slide — GĐ3.4). */
  const coTimeline = () => !!(mh && mh.slides && (mh.slides.length || mh.laVideo));

  function slideTai(g) {
    if (!mh || !mh.slides.length) return -1;
    for (const s of mh.slides) if (g < s.den - 1e-6) return s.i;
    return mh.slides[mh.slides.length - 1].i;
  }

  /* ══ NẠP ═══════════════════════════════════════════════════════════════ */

  async function napDeck() {
    const ma = ++maNap;
    const ten = deckDang();
    if (!ten) { mh = null; tDau = 0; veHet(); return; }
    let tl = null;
    try { tl = await RP.deckCau.docThietLap(); } catch { tl = null; }
    if (ma !== maNap) return;
    if (!mh || mh.deck !== ten) { mh = { deck: ten }; tDau = 0; }
    mh.tl = tl;
    mh = dungMoHinh();
    if (vuaKhung) tinhVuaKhung();
    dongBoDau();
    veHet();
    const s = await api.preview.songAm(ten).catch(() => null);
    if (ma !== maNap || !mh || mh.deck !== ten) return;
    mh.dangDung = !!(s && s.dangDung);
    if (s && !s.dangDung) {
      mh.songGiong = s.giong || null;
      mh.songNhac = s.nhac || null;
      mh.mocChu = s.chu || null;
      mh.phude = dungPhuDe(mh);
    }
    veHet();
  }

  /* ══ VẼ ════════════════════════════════════════════════════════════════ */

  function dungKhung() {
    const shell = document.querySelector(SHELL);
    if (!shell || shell.querySelector('.bt-timeline')) return false;
    goc = document.createElement('section');
    goc.className = 'bt-timeline';
    goc.id = 'btTimeline';
    goc.tabIndex = 0;
    goc.setAttribute('aria-label', 'Timeline');
    goc.innerHTML = `
      <div class="tl-keo" tabindex="0" role="separator" aria-orientation="horizontal"
           aria-label="Chiều cao timeline" title="Kéo để đổi chiều cao timeline — bấm đúp để về mặc định"></div>
      <div class="tl-thanh">
        <span class="tl-gio" id="tlGio" title="Vị trí đầu phát (phút:giây:khung)">00:00:00</span>
        <span class="tl-gio-tong" id="tlTong">/ 00:00:00</span>
        <button class="tl-nut" type="button" data-lenh="truoc" title="Về đầu slide trước (Mũi tên lên)"
                aria-label="Về đầu slide trước"><span class="btn-icon" data-icon="trai"></span></button>
        <button class="tl-nut" type="button" data-lenh="chay" title="Chạy / dừng video (Space)"
                aria-label="Chạy hoặc dừng"><span class="btn-icon" data-icon="play"></span></button>
        <button class="tl-nut" type="button" data-lenh="sau" title="Tới đầu slide sau (Mũi tên xuống)"
                aria-label="Tới đầu slide sau"><span class="btn-icon" data-icon="phai"></span></button>
        <button class="tl-nut" type="button" data-lenh="tieng" title="Tắt tiếng"
                aria-label="Tắt hoặc bật tiếng"><span class="btn-icon" data-icon="loa"></span></button>
        <span class="tl-vach"></span>
        <span class="tl-trang-thai" id="tlTrangThai"></span>
        <span class="tl-gian"></span>
        <button class="tl-nut" type="button" data-lenh="bam" title="Bám đầu phát: tự cuộn theo khi video chạy"
                aria-label="Bám đầu phát"><span class="btn-icon" data-icon="bamDau"></span></button>
        <span class="tl-vach"></span>
        <button class="tl-nut" type="button" data-lenh="thu-nho" title="Thu nhỏ (phím -)" aria-label="Thu nhỏ timeline">−</button>
        <input class="tl-zoom" id="tlZoom" type="range" min="0" max="1000" step="1" value="0"
               aria-label="Thu phóng timeline" title="Thu phóng (Alt + lăn chuột)">
        <button class="tl-nut" type="button" data-lenh="phong-to" title="Phóng to (phím =)" aria-label="Phóng to timeline">+</button>
        <button class="tl-nut" type="button" data-lenh="vua" title="Vừa khung (phím \\)"
                aria-label="Vừa khung"><span class="btn-icon" data-icon="vuakhung"></span></button>
        <span class="tl-vach"></span>
        <button class="tl-nut" type="button" data-lenh="thu" title="Thu gọn timeline"
                aria-label="Thu gọn timeline"><span class="btn-icon" data-icon="xuong"></span></button>
      </div>
      <div class="tl-than"><div class="tl-cuon" id="tlCuon"><div class="tl-luoi" id="tlLuoi"></div></div></div>`;
    shell.appendChild(goc);
    shell.classList.add('co-tl');
    cuon = goc.querySelector('#tlCuon');
    luoi = goc.querySelector('#tlLuoi');
    if (window.__beeIcons) window.__beeIcons.apply(goc);
    rongDau = parseFloat(getComputedStyle(goc).getPropertyValue('--tl-dau-w')) || 190;
    apCao();
    ganSuKien();
    return true;
  }

  /** Vẽ lại toàn bộ lưới (đổi deck, đổi mức zoom, có sóng âm…). */
  function veHet() {
    if (!luoi) return;
    capNhatTong();
    veTrangThai();
    const coMh = coTimeline();
    const rongLan = coMh ? Math.ceil(mh.tong * pps) + 48 : 0;
    luoi.style.gridTemplateColumns = `var(--tl-dau-w) ${coMh ? `${rongLan}px` : 'minmax(0, 1fr)'}`;
    let h = '<div class="tl-goc"></div><div class="tl-thuoc-o" data-thuoc><canvas class="tl-thuoc"></canvas></div>';
    const dg = RP.dung && RP.dung.duAn() ? RP.dung : null;
    dsTrack().forEach((t) => {
      // Thông tin phụ (nguồn sóng, số slide…) chỉ ở `title` — một dòng tên cho gọn mắt.
      const phu = t.nd ? phuTrackNd(t.nd) : phuTrack(t.id);
      /* Tên C1 bấm được như A1/A2 (bảng Thuộc tính → phụ đề). Đang chọn track gốc thì tô tên track đó. */
      const gocChon = dg && dg.chonGoc ? dg.chonGoc() : null;
      const laGoc = t.goc || t.id === 'phude';
      const dangChonTen = (t.id === 'phude' && gocChon === 'phude') || (t.goc && gocChon === t.goc && t.id !== 'sfx');
      // Bấm được ⇒ với tới được bằng BÀN PHÍM (Tab + Enter/Space — ganNutTrack): lối duy nhất vào bảng phụ đề.
      const bamDuoc = laGoc && t.id !== 'sfx' ? ' tabindex="0" role="button"' : '';
      h += `<div class="tl-ten${t.nd ? ' nd' : ''}${laGoc ? ' tl-ten-goc' : ''}${dangChonTen ? ' dang-chon' : ''}"${bamDuoc} style="height:${t.cao}px" data-ten-track="${esc(t.id)}"
          title="${esc(t.ten)}${phu ? ` · ${esc(phu)}` : ''}${t.id === 'phude' ? ' — bấm để chỉnh phụ đề' : ''}">
          <span class="tl-huy ${t.loai}${t.nd ? ' nd' : ''}">${esc(t.huy)}</span><span class="tl-ten-chu">${esc(t.ten)}</span>
          ${nutTrack(t, dg)}</div>`;
      h += `<div class="tl-lan${t.nd ? ` nd nd-${t.nd.loai}${t.nd.khoa ? ' khoa' : ''}${t.nd.an || t.nd.tatTieng ? ' tat' : ''}` : ''}${t.goc && dg && tatGoc(dg, t.goc) ? ' tat' : ''}"
          data-track="${esc(t.id)}" style="height:${t.cao}px">${coMh ? (t.nd ? khoiNd(t.nd) : khoiTrack(t)) : ''}</div>`;
    });
    if (dg && !dg.chiDoc()) {
      // Hàng cuối: thêm track (V mới lên trên cùng, A mới xuống dưới cùng).
      h += `<div class="tl-ten tl-them" style="height:26px">
          <button type="button" class="tl-them-nut" data-them-track="hinh" title="Thêm track hình (lên trên cùng)">+ Hình</button>
          <button type="button" class="tl-them-nut" data-them-track="tieng" title="Thêm track tiếng (xuống dưới cùng)">+ Tiếng</button>
          <button type="button" class="tl-them-nut" data-them-chu title="Thêm chữ tiêu đề tại đầu phát (sửa ở tab Thuộc tính)">+ Chữ</button>
          <button type="button" class="tl-them-nut" data-them-giong title="Gõ lời → giọng đọc thành một khối tại đầu phát (track Giọng đọc)">+ Giọng</button></div>
          <div class="tl-lan tl-lan-them" style="height:26px"></div>`;
    }
    h += '<div class="tl-dau-phat" id="tlDauPhat"></div>';
    luoi.innerHTML = h;
    if (!coMh) {
      const lan = luoi.querySelector('[data-track="hinh"]');
      if (lan) lan.innerHTML = `<span class="tl-lan-trong">${deckDang()
        ? 'Deck này chưa có slide nào.' : 'Bấm "Dự án" trên thanh trên cùng để chọn dự án.'}</span>`;
    }
    dauPhat = luoi.querySelector('#tlDauPhat');
    thuocCv = luoi.querySelector('.tl-thuoc');
    luoi.querySelectorAll('canvas.tl-song').forEach(veSong);
    if (window.__beeIcons) window.__beeIcons.apply(luoi);
    anhCu = coMh ? layAnh() : null;
    slideSang = -1;
    veThuoc();
    capNhatDau();
    veZoomO();
  }

  /** Phụ đề đang TẮT — một nguồn cho cả hai cờ (subtitles.enabled của deck · phuDe.an của timeline). */
  const phuDeTat = () => (RP.phuDe ? RP.phuDe.tat() : !!(mh && mh.phudeTat));

  /** Dòng phụ dưới tên track. */
  function phuTrack(id) {
    if (!mh || !mh.slides) return '';
    if (id === 'phude') {
      if (phuDeTat()) return 'đang tắt';
      return mh.phude && mh.phude.length && !mh.phude[0].uoc ? 'theo từng chữ' : 'chia câu ước lượng';
    }
    if (id === 'hinh') return mh.laVideo ? '' : `${mh.slides.length} slide`;
    if (id === 'giong') {
      if (mh.songGiong) return mh.songGiong.tron ? 'tiếng đã trộn với nhạc' : mh.songGiong.nguon;
      return mh.nguon === 'uoc' ? 'tạo khi dựng video' : (mh.dangDung ? 'đang dựng…' : 'đang đọc sóng…');
    }
    if (id === 'nhac') return mh.nhac ? `âm lượng ${mh.nhac.vol}%` : 'không có';
    if (id === 'sfx') return mh.sfx.length ? `${mh.sfx.length} tiếng` : 'không có';
    return '';
  }

  /** Dòng phụ cho track người dùng. */
  function phuTrackNd(t) {
    const d = RP.dung && RP.dung.duAn();
    const n = d ? d.khoi.filter((c) => c.track === t.id).length : 0;
    return [`${n} khối`, t.khoa ? 'đang khoá' : '', t.an ? 'đang ẩn' : '', t.tatTieng ? 'tắt tiếng' : ''].filter(Boolean).join(' · ');
  }
  const tatGoc = (dg, goc) => {
    const ag = dg.duAn().amGoc || {};
    return goc === 'giong' ? !!ag.tatGiong : !!ag.tatDeck;
  };
  /** Nút nhỏ ở cột tên track: khoá / ẩn (hình) / tắt tiếng (tiếng) — như Premiere. */
  function nutTrack(t, dg) {
    if (!dg || dg.chiDoc()) return '';
    const nut = (lenh, icon, bat, title) => `<button type="button" class="tl-tr-nut${bat ? ' bat' : ''}" data-tr-lenh="${lenh}"
        data-tr="${esc(t.id)}" title="${title}" aria-label="${title}"><span class="btn-icon" data-icon="${icon}"></span></button>`;
    if (t.nd) {
      const kh = nut('khoa', 'khoa', t.nd.khoa, t.nd.khoa ? 'Mở khoá track' : 'Khoá track (không sửa được)');
      return t.nd.loai === 'hinh'
        ? kh + nut('an', 'eye', t.nd.an, t.nd.an ? 'Hiện track' : 'Ẩn track (không xuất)')
        : kh + nut('tieng', t.nd.tatTieng ? 'loatat' : 'loa', t.nd.tatTieng, t.nd.tatTieng ? 'Bật tiếng track' : 'Tắt tiếng track');
    }
    // C1: MỘT nút 👁 cho cả hai cờ phụ đề (render/kieu-phu-de.js — chốt Q1 16/10/2026).
    if (t.id === 'phude') {
      if (!RP.phuDe || !RP.phuDe.coPhuDe()) return '';
      const tatPd = phuDeTat();
      return nut('phude', 'eye', tatPd, tatPd ? 'Bật phụ đề' : 'Tắt phụ đề (video slide lẫn bản dựng)');
    }
    // Không có tiếng tách (video dựng từ bản cũ): nhạc deck đã trộn vào A1 — không có nút riêng.
    if (t.id === 'nhac' && !dg.tachTieng()) return '';
    if (t.id === 'giong' || t.id === 'nhac') {
      const tat = tatGoc(dg, t.goc);
      return nut('goc', tat ? 'loatat' : 'loa', tat, t.id === 'giong'
        ? (tat ? 'Bật giọng đọc' : 'Tắt giọng đọc (bản dựng)') : (tat ? 'Bật nhạc + tiếng chuyển' : 'Tắt nhạc + tiếng chuyển (bản dựng)'));
    }
    return '';
  }

  /** Khối của NGƯỜI DÙNG trên một track — sửa được (timeline-sua.js). */
  function khoiNd(t) {
    const dg = RP.dung;
    const M = window.__beeDung && window.__beeDung.moHinh;
    const d = dg && dg.duAn();
    if (!d || !M) return '';
    const moc = dg.moc();
    const chon = new Set(dg.chon());
    const ds = d.khoi.filter((c) => c.track === t.id);
    if (!ds.length) {
      return `<span class="tl-lan-trong">${t.loai === 'hinh' ? 'Kéo video / ảnh từ Thư viện vào đây' : 'Kéo âm thanh từ Thư viện vào đây'}</span>`;
    }
    return ds.map((c) => {
      const m = d.media.find((x) => x.id === c.media);
      if (!m) return '';
      const tu = M.batDauMs(c, moc) / 1000;
      const den = M.ketThucMs(c, moc) / 1000;
      const w = rongKhoi(tu, den);
      const ca = dg.cacheCua(m.id) || {};
      const anh = ca.anh && m.loai !== 'tieng' && w >= 40 ? `<img class="tl-anh" src="${esc(ca.anh)}" alt="">` : '';
      const song = ca.song && (m.loai === 'tieng' || (m.coTieng && t.loai === 'tieng'))
        ? `<canvas class="tl-song" data-song="nd" data-media="${esc(m.id)}" data-tu="${tu}" data-den="${den}" data-vao="${c.vaoMs}" data-toc="${c.tocDo || 1}"${c.lap ? ' data-lap="1"' : ''}></canvas>` : '';
      const lech = M.lechNeo(c, moc) ? ' lech' : '';
      // Ô giữ chỗ của MẪU DỰNG VIDEO: nhãn "Ô n" (viền đứt khi còn media mẫu — css/dung.css .tl-o.cho).
      const oNhan = c.oCho ? `<b class="tl-o${c.oCho.daThay ? '' : ' cho'}" title="${c.oCho.daThay ? 'Ô của mẫu — đã thay' : 'Ô của mẫu — đang dùng ảnh / video mẫu: thả media của bạn lên đây để thay'}">Ô ${c.oCho.so}</b>` : '';
      const nhan = w >= 22 ? `<span class="tl-khoi-nhan">${oNhan}<span class="tl-khoi-chu">${esc(m.ten)}</span></span>` : '';
      const tieuDe = `${m.ten} · ${(den - tu).toFixed(2)} giây${c.neo ? ` · gắn slide ${c.neo.slide + 1}` : ' · đứng yên theo giây'}${(c.tocDo || 1) !== 1 ? ` · tốc độ ${c.tocDo}×` : ''}`;
      // Chuyển cảnh vào/ra: dải nhạt ở hai đầu khối (hoà với khối trước: dải đậm hơn).
      const mo = c.mo || {};
      const rongChuyen = (ms) => Math.min(w, Math.max(3, x(ms / 1000)));
      const chuyen = (mo.vaoMs > 0 ? `<span class="tl-chuyen vao${mo.noi ? ' noi' : ''}" style="width:${rongChuyen(mo.vaoMs)}px"></span>` : '')
        + (mo.raMs > 0 ? `<span class="tl-chuyen ra" style="width:${rongChuyen(mo.raMs)}px"></span>` : '');
      // Keyframe (khối đang chọn): hình thoi nhỏ ở đáy khối.
      const tKf = chon.has(c.id) ? [...new Set(Object.values(c.kf || {}).flat().map((k) => k.t))] : [];
      const kfs = tKf.map((t2) => `<span class="tl-kf" style="left:${Math.min(w - 4, x(t2 / 1000))}px"></span>`).join('');
      return `<div class="tl-khoi nd nd-${m.loai}${chon.has(c.id) ? ' chon' : ''}${t.khoa ? ' khoa' : ''}${lech}" data-khoi="${esc(c.id)}"
          data-tu="${tu}" style="${viTri(tu, den)}" title="${esc(tieuDe)}">
          ${song}${anh}${chuyen}${kfs}${nhan}${t.khoa ? '' : '<span class="tl-tay trai" data-tay="trai"></span><span class="tl-tay phai" data-tay="phai"></span>'}</div>`;
    }).join('');
  }

  const x = (g) => Math.round(g * pps);
  /** Bề ngang (px) một khối sẽ có — khe 2px giữa hai khối liền nhau cho thoáng. */
  const rongKhoi = (tu, den, min = 3) => Math.max(min, x(den) - x(tu) - 2);
  /** Hộp vị trí của một khối: left/width theo giây, tối thiểu 3px cho thấy được. */
  const viTri = (tu, den, min = 3) => `left:${x(tu)}px;width:${rongKhoi(tu, den, min)}px`;

  function khoiTrack(t) {
    const uoc = mh.nguon === 'uoc' ? ' uoc' : '';
    const vt = !!(RP.dung && RP.dung.duAn() && !RP.dung.chiDoc() && mh.nguon === 'video');
    if (t.id === 'hinh') {
      const anh = layAnh() || [];
      const m1 = v1Moc();
      if (m1) {
        // V1 đã sửa: mỗi ĐOẠN một khối, theo thứ tự timeline; data-doan = chỉ số đoạn (timeline-sua).
        return m1.doan.map((d1, j) => {
          const s = mh.slides[d1.slide] || { i: d1.slide, chu: '' };
          const tu = d1.dichTu / 1000;
          const den = d1.dichDen / 1000;
          const w = rongKhoi(tu, den);
          const a = anh[s.i];
          const hinhAnh = a && w >= 44 ? `<img class="tl-anh" src="${a}" alt="">` : '';
          const nhan = w >= 16 ? `<span class="tl-khoi-nhan"><b>${s.i + 1}</b>${w >= 90 ? `<span class="tl-khoi-chu">${esc(s.chu)}</span>` : ''}</span>` : '';
          return `<div class="tl-khoi hinh v1doan" data-tu="${tu}" data-slide="${s.i}" data-doan="${j}" style="${viTri(tu, den)}"
                    title="Slide ${s.i + 1} · ${(den - tu).toFixed(1)} giây (đoạn ${j + 1} của V1 đã sửa)\n${esc(s.chu)}">${hinhAnh}${nhan}${
            vt ? '<span class="tl-tay trai" data-tay-v1="trai"></span><span class="tl-tay phai" data-tay-v1="phai"></span>' : ''}</div>`;
        }).join('');
      }
      return mh.slides.map((s) => {
        const a = anh[s.i];
        const dai = s.den - s.tu;
        const w = rongKhoi(s.tu, s.den);
        // MỘT ảnh ở đầu khối (không lặp dải ảnh — rối mắt); hẹp quá thì bỏ ảnh, chỉ còn số.
        const hinhAnh = a && w >= 44 ? `<img class="tl-anh" src="${a}" alt="">` : '';
        const nhan = w >= 16 ? `<span class="tl-khoi-nhan"><b>${s.i + 1}</b>${w >= 90
          ? `<span class="tl-khoi-chu">${esc(s.chu)}</span>` : ''}</span>` : '';
        // data-doan = chỉ số slide: V1 chưa sửa coi như mỗi slide một đoạn (timeline-sua cắt / đổi chỗ được ngay).
        return `<div class="tl-khoi hinh${uoc}" data-tu="${s.tu}" data-slide="${s.i}" data-doan="${s.i}" style="${viTri(s.tu, s.den)}"
                  title="Slide ${s.i + 1} · ${dai.toFixed(1)} giây${uoc ? ' (ước tính)' : ''}\n${esc(s.chu)}">${hinhAnh}${nhan}${
          vt ? '<span class="tl-tay trai" data-tay-v1="trai"></span><span class="tl-tay phai" data-tay-v1="phai"></span>' : ''}</div>`;
      }).join('');
    }
    if (t.id === 'phude') {
      /* Phụ đề TÁCH LỚP (deck dựng bằng bản có tách lớp): vẽ từ phụ đề ĐANG DÙNG của trình dựng —
         đã sửa, hoặc của lượt dựng — và cho sửa (timeline-sua.js: data-cau = chỉ số câu). */
      const capsTd = RP.dung && RP.dung.phuDeTt && RP.dung.phuDeTt() ? RP.dung.phuDeDung() : null;
      if (capsTd) {
        const tatTd = phuDeTat() ? ' tat' : '';
        const sua = vt ? '<span class="tl-tay trai" data-tay-cau="trai"></span><span class="tl-tay phai" data-tay-cau="phai"></span>' : '';
        return capsTd.flatMap((c, k) => chieu(c.start, c.end).map((p) => ({ k, chu: c.text, tu: p.tu, den: p.den })))
          .map((c) => `<div class="tl-khoi phude sua${tatTd}" data-tu="${c.tu}" data-cau="${c.k}"
            style="${viTri(c.tu, c.den)}" title="${esc(c.chu)}
Bấm đúp: sửa chữ · kéo mép: đổi giờ · Delete: xoá câu">${rongKhoi(c.tu, c.den) >= 60
              ? `<span class="tl-khoi-nhan">${esc(c.chu)}</span>` : ''}${sua}</div>`).join('');
      }
      const tat = phuDeTat() ? ' tat' : '';
      // Chữ phụ đề chỉ hiện khi khối đủ rộng — ở mức vừa khung, cả trăm cụm chữ cụt là thứ rối mắt nhất.
      return (mh.phude || []).flatMap((c) => chieu(c.tu, c.den).map((p) => ({ ...c, tu: p.tu, den: p.den })))
        .map((c) => `<div class="tl-khoi phude${tat}${c.uoc && uoc ? ' uoc' : ''}" data-tu="${c.tu}"
          style="${viTri(c.tu, c.den)}" title="${esc(c.chu)}">${rongKhoi(c.tu, c.den) >= 60
            ? `<span class="tl-khoi-nhan">${esc(c.chu)}</span>` : ''}</div>`).join('');
    }
    if (t.id === 'giong') {
      const coSong = !!mh.songGiong;
      // Mỗi slide (đã chiếu lên trục timeline — V1 sửa thì theo đoạn); canvas mang `lech` để vẽ đúng sóng GỐC.
      return mh.slides.flatMap((s) => chieu(s.tu, s.den).map((p) => ({ s, ...p })))
        .map(({ s, tu, den, lech }) => `<div class="tl-khoi giong${uoc}" data-tu="${tu}" data-slide="${s.i}"
          style="${viTri(tu, den)}" title="Giọng đọc · slide ${s.i + 1}">
          ${coSong ? `<canvas class="tl-song" data-song="giong" data-tu="${tu}" data-den="${den}" data-lech="${lech}"></canvas>` : ''}
          ${rongKhoi(tu, den) >= 18 ? `<span class="tl-khoi-nhan"><b>${s.i + 1}</b></span>` : ''}</div>`).join('');
    }
    if (t.id === 'nhac') {
      if (!mh.nhac) return '<span class="tl-lan-trong">Không có nhạc nền</span>';
      const coSong = !!(mh.songNhac && !mh.nhac.tongHop);
      const doanNhac = v1Moc() ? chieu(0, mh.tongDeck || mh.tong) : [{ tu: 0, den: mh.tong, lech: 0 }];
      return doanNhac.map((p) => `<div class="tl-khoi nhac${mh.nhac.tongHop ? ' tong-hop' : ''}" data-tu="${p.tu}" style="${viTri(p.tu, p.den)}"
          title="${esc(mh.nhac.ten)} · âm lượng ${mh.nhac.vol}%${mh.nhac.tongHop ? ' — engine tự tổng hợp, không có tệp nên không có sóng' : ''}">
          ${coSong ? `<canvas class="tl-song" data-song="nhac" data-tu="${p.tu}" data-den="${p.den}" data-lech="${p.lech}"></canvas>` : ''}
          <span class="tl-khoi-nhan"><b>${esc(mh.nhac.ten)}</b><span class="tl-khoi-chu">${mh.nhac.vol}%</span></span></div>`).join('');
    }
    if (t.id === 'sfx') {
      /* Tiếng chuyển là SỰ KIỆN (một tiếng ngắn lúc vào slide) — vẽ rộng tối
         thiểu 44px cho đọc được tên, nhưng không lấn sang khối kế tiếp. */
      // Tiếng chuyển rơi vào phần V1 đã cắt bỏ thì không còn trong bản dựng.
      const sfx = mh.sfx.map((c) => { const p = chieu(c.tu, c.den)[0]; return p ? { ...c, tu: p.tu, den: p.den } : null; })
        .filter(Boolean).sort((a, b) => a.tu - b.tu);
      return sfx.map((c, k) => {
        const ke = sfx[k + 1];
        const min = Math.min(44, ke ? x(ke.tu) - x(c.tu) - 1 : 44);
        return `<div class="tl-khoi sfx" data-tu="${c.tu}" style="${viTri(c.tu, c.den, Math.max(3, min))}"
          title="Tiếng chuyển slide: ${esc(c.ten)}">${min >= 40 ? `<span class="tl-khoi-nhan">${esc(c.ten)}</span>` : ''}</div>`;
      }).join('');
    }
    return '';
  }

  /** Vẽ sóng âm vào một canvas của khối tiếng. */
  function veSong(cv) {
    const loai = cv.dataset.song;
    let nguon = loai === 'giong' ? mh.songGiong : mh.songNhac;
    // giây trong TỆP = lechNguon + giây timeline × heSoToc. Giọng / nhạc deck: lệch của đoạn V1 (data-lech).
    let lechNguon = Number(cv.dataset.lech) || 0;
    let heSoToc = 1;
    if (loai === 'nd') {
      const ca = RP.dung && RP.dung.cacheCua(cv.dataset.media);
      nguon = ca && ca.song;
      heSoToc = Number(cv.dataset.toc) || 1;
      lechNguon = Number(cv.dataset.vao) / 1000 - Number(cv.dataset.tu) * heSoToc;
    }
    if (!nguon || !nguon.dinh || !nguon.dinh.length) return;
    const tu = Number(cv.dataset.tu);
    const den = Number(cv.dataset.den);
    const rong = rongKhoi(tu, den);
    const cao = cv.parentElement ? cv.parentElement.clientHeight : 30;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.min(RONG_CANVAS_MAX, Math.ceil(rong * dpr));
    const h = Math.max(1, Math.round(cao * dpr));
    cv.width = w;
    cv.height = h;
    const c = cv.getContext('2d');
    c.fillStyle = getComputedStyle(cv).color || 'white';
    const dinh = nguon.dinh;
    const n = dinh.length;
    const giayNguon = nguon.giay || n * nguon.buoc;
    const giua = h * 0.6;             // lệch xuống: chừa dải trên cho nhãn
    const bien = h * 0.3;
    c.globalAlpha = loai === 'nhac' ? 0.45 : 0.6;   // nhạc là nền — nhạt hơn giọng
    for (let px = 0; px < w; px += 1) {
      const g0 = tu + ((den - tu) * px) / w;
      const g1 = tu + ((den - tu) * (px + 1)) / w;
      // Nhạc tải lên phát LẶP (engine đặt `loop = true`) ⇒ quấn vòng theo độ dài tệp.
      let a0 = loai === 'nhac' && giayNguon > 0 ? g0 % giayNguon : g0;
      if (loai === 'nd') a0 = lechNguon + g0 * heSoToc;
      // Khối LẶP (nhạc có sẵn, GĐ2.2): sóng lặp lại theo độ dài tệp như tiếng phát ra.
      if (loai === 'nd' && cv.dataset.lap && giayNguon > 0) a0 %= giayNguon;
      let i0 = Math.floor(a0 / nguon.buoc);
      let i1 = Math.max(i0 + 1, Math.floor((a0 + (g1 - g0) * heSoToc) / nguon.buoc));
      if (i0 < 0) continue;
      if (i0 >= n) continue;
      i1 = Math.min(i1, n);
      let v = 0;
      for (let i = i0; i < i1; i += 1) if (dinh[i] > v) v = dinh[i];
      const a = Math.max(0.5, (v / 100) * bien);
      c.fillRect(px, giua - a, 1, a * 2);
    }
  }

  /** Thước thời gian — chỉ vẽ phần đang nhìn thấy (canvas dính theo cuộn). */
  function veThuoc() {
    if (!thuocCv || !cuon) return;
    const rong = Math.max(1, cuon.clientWidth - rongDau);
    const cao = 22;
    const dpr = window.devicePixelRatio || 1;
    thuocCv.style.width = `${rong}px`;
    thuocCv.width = Math.ceil(rong * dpr);
    thuocCv.height = Math.ceil(cao * dpr);
    const c = thuocCv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, rong, cao);
    if (!coTimeline()) return;
    const cs = getComputedStyle(goc);
    const mauChu = getComputedStyle(thuocCv).color || 'gray';
    c.fillStyle = mauChu;
    c.strokeStyle = mauChu;
    c.font = `10px ${cs.getPropertyValue('--font-ui') || 'sans-serif'}`;
    c.textBaseline = 'top';
    const fps = mh.fps || FPS;
    // Bước nhãn: nhỏ nhất mà hai nhãn cách nhau ≥ 90px.
    const BUOC = [1 / fps, 5 / fps, 10 / fps, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const buoc = BUOC.find((b) => b * pps >= 110) || 600;
    const phu = buoc >= 1 ? buoc / 5 : buoc / 2;
    const t0 = cuon.scrollLeft / pps;
    const t1 = t0 + rong / pps;
    c.beginPath();
    // Đếm theo SỐ NGUYÊN vạch rồi nhân — cộng dồn số thực thì sai số làm lệch vạch lớn.
    const moiLon = Math.round(buoc / phu);
    for (let k = Math.floor(t0 / phu); k * phu <= t1 + phu; k += 1) {
      const g = k * phu;
      const px = Math.round((g - t0) * pps) + 0.5;
      const lon = k % moiLon === 0;
      c.moveTo(px, cao);
      c.lineTo(px, cao - (lon ? 7 : 3));
      if (lon && g <= mh.tong + 1e-6) c.fillText(nhanThuoc(g, buoc, fps), px + 4, 4);
    }
    c.lineWidth = 1;
    c.stroke();
    /* Dự án video: vạch KẾT THÚC ở khối cuối — bản xuất dừng đúng đó; phần sau là nền chừa để thả. */
    const cuoiX = giayXuat();
    if (cuoiX > 0 && cuoiX >= t0 - 1 && cuoiX <= t1 + 1) {
      const px = Math.round((cuoiX - t0) * pps) + 0.5;
      c.save();
      c.strokeStyle = cs.getPropertyValue('--tl-ket-thuc').trim() || mauChu;
      c.fillStyle = c.strokeStyle;
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(px, 0); c.lineTo(px, cao); c.stroke();
      c.textAlign = 'right';
      c.fillText('Kết thúc', px - 4, 4);
      c.restore();
    }
    // Điểm đánh dấu (phím M, timeline-sua.js) — hình cờ nhỏ trên thước, như Premiere.
    const dd = (RP.dung && RP.dung.duAn() && RP.dung.duAn().danhDau) || [];
    if (dd.length) {
      c.fillStyle = cs.getPropertyValue('--tl-danh-dau').trim() || mauChu;
      dd.forEach((x) => {
        const g = x.ms / 1000;
        if (g < t0 - 1 || g > t1 + 1) return;
        const px = Math.round((g - t0) * pps) + 0.5;
        c.beginPath();
        c.moveTo(px - 5, 0); c.lineTo(px + 5, 0); c.lineTo(px + 5, 8); c.lineTo(px, 13); c.lineTo(px - 5, 8);
        c.closePath();
        c.fill();
      });
    }
  }

  /** Đầu phát + đồng hồ + khối slide đang sáng. Gọi mỗi khung hình khi chạy. */
  function capNhatDau() {
    // Đang DỪNG thì lớp ghép xem trước vẽ theo đầu phát (kể cả khi kéo quá cuối video);
    // đang chạy thì dung-xem.js tự có vòng khung hình riêng — đừng vẽ hai lần.
    if (RP.dungXem && RP.dungXem.capNhat && !dongHoChay()) RP.dungXem.capNhat();
    const fps = (mh && mh.fps) || FPS;
    // Dự án video: tổng = độ dài SẼ XUẤT, không phải nền đen (dài hơn để còn chỗ thả khối).
    const laVideo = !!(RP.dung && RP.dung.laVideo && RP.dung.laVideo());
    const tong = laVideo ? giayXuat() : ((mh && mh.tong) || 0);
    const g = goc && goc.querySelector('#tlGio');
    const t = goc && goc.querySelector('#tlTong');
    if (g) g.textContent = maGio(tDau, fps);
    if (t) {
      t.textContent = `/ ${maGio(tong, fps)}`;
      t.title = laVideo ? 'Độ dài video sẽ xuất (tới khối cuối cùng)' : '';
    }
    if (dauPhat) {
      dauPhat.hidden = !coTimeline();
      dauPhat.style.left = `${rongDau + tDau * pps}px`;
    }
    const i = slideTai(dich2goc(tDau));
    if (i !== slideSang && luoi) {
      luoi.querySelectorAll('.tl-khoi.dang-o').forEach((k) => k.classList.remove('dang-o'));
      luoi.querySelectorAll(`.tl-khoi.hinh[data-slide="${i}"]`).forEach((k) => k.classList.add('dang-o'));
      slideSang = i;
    }
  }

  function veTrangThai() {
    const el = goc && goc.querySelector('#tlTrangThai');
    if (!el) return;
    let chu = '';
    let lop = '';
    const fps = (mh && mh.fps) || FPS;
    if (!mh || !mh.slides) chu = deckDang() ? 'Đang đọc deck…' : 'Chưa mở dự án';
    else if (mh.dangDung) { chu = 'Đang dựng video — timeline cập nhật khi dựng xong'; lop = 'canh-bao'; }
    else if (mh.nguon === 'uoc') { chu = 'Chưa dựng video — thời lượng ƯỚC TÍNH theo lời thoại'; lop = 'canh-bao'; }
    else if (mh.lechDeck) {
      chu = `Deck đã đổi sau lần dựng: deck ${mh.soSlideDeck} slide, video ${mh.slides.length} slide — dựng lại để khớp`;
      lop = 'canh-bao';
    } else if (mh.nguon === 'moc') { chu = 'Theo mốc của lần dựng trước (không còn tệp video)'; lop = 'canh-bao'; }
    else if (RP.dung && RP.dung.laVideo && RP.dung.laVideo()) {
      // Dự án video trống: nói độ dài NỘI DUNG (thứ sẽ xuất), không phải độ dài nền đen.
      const Mh = window.__beeDung && window.__beeDung.moHinh;
      const nd = RP.dung.duAn() && Mh ? Math.round(Mh.tongMs(RP.dung.duAn(), [], 0) / 1000) : 0;
      chu = nd ? `Dự án video · xuất ${Math.floor(nd / 60)}:${String(nd % 60).padStart(2, '0')}` : 'Dự án video · thả ảnh, video, nhạc vào đây';
      lop = 'tot';
    } else if (mh.nguon === 'video') { chu = 'Theo video đã dựng'; lop = 'tot'; }
    el.textContent = chu;
    el.title = chu;
    el.className = `tl-trang-thai${lop ? ` ${lop}` : ''}`;
    const coVideo = !!(RP.thanhPhat && RP.thanhPhat.coVideo && RP.thanhPhat.coVideo());
    const nutChay = goc.querySelector('[data-lenh="chay"]');
    if (nutChay) {
      nutChay.disabled = !coVideo;
      nutChay.title = coVideo ? 'Chạy / dừng video (Space)' : 'Chưa có video — bấm "Tạo video" rồi mới chạy được';
    }
    const nutBam = goc.querySelector('[data-lenh="bam"]');
    if (nutBam) nutBam.classList.toggle('bat', bam);
  }

  /** Nút loa trên thanh timeline soi theo nút loa (ẩn) của thanh phát. */
  function veNutTieng() {
    const n = goc && goc.querySelector('[data-lenh="tieng"]');
    const n0 = document.querySelector('#tpTieng');
    if (!n || !n0) return;
    const tat = n0.classList.contains('dang-tat');
    n.classList.toggle('dang-tat', tat);
    n.title = n0.title || (tat ? 'Bật tiếng' : 'Tắt tiếng');
    const o = n.querySelector('[data-icon]');
    const ten = tat ? 'loatat' : 'loa';
    if (o && o.dataset.icon !== ten) {
      o.dataset.icon = ten;
      o.innerHTML = '';
      if (window.__beeIcons) window.__beeIcons.apply(n);
    }
  }

  function veNutChay() {
    const n = goc && goc.querySelector('[data-lenh="chay"]');
    if (!n) return;
    const ten = dongHoChay() ? 'stop' : 'play';
    const o = n.querySelector('[data-icon]');
    if (o && o.dataset.icon !== ten) {
      o.dataset.icon = ten;
      o.innerHTML = '';
      if (window.__beeIcons) window.__beeIcons.apply(n);
    }
  }

  /* ══ ZOOM ══════════════════════════════════════════════════════════════ */

  function ppsVua() {
    if (!mh || !mh.tong || !cuon) return 20;
    return Math.max(0.5, (cuon.clientWidth - rongDau - 24) / mh.tong);
  }
  // Tính lại tổng TRƯỚC (khối người dùng đặt sau cuối video) — kẻo "vừa khung" chỉ vừa phần video (audit 10/10/2026).
  function tinhVuaKhung() { capNhatTong(); pps = ppsVua(); }

  /** Thanh trượt 0–1000 ↔ pps theo thang log giữa "vừa khung" và PPS_MAX. */
  function ppsTuO(v) {
    const lo = ppsVua();
    const hi = Math.max(lo * 1.01, PPS_MAX);
    return lo * (hi / lo) ** (v / 1000);
  }
  function oTuPps(p) {
    const lo = ppsVua();
    const hi = Math.max(lo * 1.01, PPS_MAX);
    return Math.round((Math.log(p / lo) / Math.log(hi / lo)) * 1000);
  }
  function veZoomO() {
    const o = goc && goc.querySelector('#tlZoom');
    if (o) o.value = String(kep(oTuPps(pps), 0, 1000));
  }

  /** Đổi mức zoom, giữ giây `neo` đứng yên dưới điểm `xMan` (toạ độ trong vùng làn). */
  function datPps(moi, neo, xMan) {
    if (!mh || !mh.tong) return;
    const lo = ppsVua();
    const p = kep(moi, lo, Math.max(lo, PPS_MAX));
    const gNeo = neo == null ? tDau : neo;
    const xNeo = xMan == null ? (gNeo * pps - cuon.scrollLeft) : xMan;
    pps = p;
    vuaKhung = Math.abs(p - lo) < 1e-6;
    veHet();
    cuon.scrollLeft = Math.max(0, gNeo * pps - xNeo);
    veThuoc();
  }

  /* ══ TUA & PHÁT ════════════════════════════════════════════════════════ */

  const videoDangMo = () => (RP.thanhPhat && RP.thanhPhat.video ? RP.thanhPhat.video() : null);
  const coVideo = () => !!(RP.thanhPhat && RP.thanhPhat.coVideo && RP.thanhPhat.coVideo());
  /* ĐỒNG HỒ TIMELINE (thanh-phat.js, GĐ3.0) — đầu phát khi xem bản dựng là giờ của nó, không phải currentTime video. */
  const dongHoChay = () => !!(RP.thanhPhat && RP.thanhPhat.dangChay && RP.thanhPhat.dangChay());
  const gioDongHo = () => (RP.thanhPhat && RP.thanhPhat.gio ? RP.thanhPhat.gio() : tDau);

  let dangMoVideo = null;   // Promise khi đang mở video lần đầu — kéo nhanh không mở hai lần
  let gioCho = null;        // giây chờ tua sau khi video mở xong

  /**
   * Tua tới giây `g`.
   * @param {boolean} moVideo true = mở video đã dựng nếu chưa mở (kéo trên thước).
   */
  function tuaToi(g, moVideo) {
    if (!coTimeline()) return;
    tDau = kep(g, 0, mh.tong);
    capNhatDau();
    const v = videoDangMo();
    if (v) {
      // Đang xem bản dựng: tua ĐỒNG HỒ (giây timeline) — dung-xem tự đưa video slide về đúng đoạn V1.
      if (RP.thanhPhat.tua) RP.thanhPhat.tua(tDau);
      return;
    }
    if (moVideo && coVideo() && mh.nguon === 'video') {
      gioCho = tDau;   // giây TIMELINE — đồng hồ (GĐ3.0); dung-xem tự quy về giây gốc
      if (!dangMoVideo) {
        dangMoVideo = RP.thanhPhat.tuaToiGiay(gioCho).finally(() => {
          dangMoVideo = null;
          // Kéo tiếp trong lúc video đang mở: tua tới chỗ kéo SAU CÙNG.
          if (videoDangMo() && gioCho != null && RP.thanhPhat.tua) RP.thanhPhat.tua(gioCho);
          gioCho = null;
        });
      }
      return;
    }
    denSlideDeck(slideTai(dich2goc(tDau)));
  }

  /** Chuyển slide trên deck (không có video): đúng đường của dải slide cũ. */
  function denSlideDeck(i, lan = 0) {
    if (i < 0 || !RP.deckCau) return;
    const dang = RP.deckCau.slideHienTai();
    if (dang && dang.chiSo === i) return;
    /* Slide deck có thể đang đứng khi lệnh này bị BỎ: slide lúc ra lệnh, hoặc đích lệnh trước của timeline (đang chạy
       chuyển cảnh tới đó). Hết nhịp mà deck ở slide KHÁC hai cái này = người dùng đã đi chỗ khác (dải slide, phím của
       deck, bảng Nội dung) ⇒ KHÔNG kéo deck về (rà soát đợt 1). */
    const coThe = new Set([dang ? dang.chiSo : -1, slideDich]);
    lucDieuHuong = Date.now();
    slideDich = i;
    RP.deckCau.toiSlide(i);
    setTimeout(() => {
      if (RP.sanKhau && RP.sanKhau.veDaiSlide) RP.sanKhau.veDaiSlide();
      if (RP.bangSua && RP.bangSua.doiSlide) RP.bangSua.doiSlide();
    }, 120);
    /* Hết nhịp chuyển cảnh: deck BỎ lệnh (bấm › hai lần trong 0,4 s) thì bảo lại — trước đây đầu phát giật lùi về slide
       deck đang hiện, như thể lần bấm thứ hai không ăn (audit 23/10). Người dùng đã đi chỗ khác / mở video: thôi. */
    setTimeout(() => {
      if (slideDich !== i) return;   // đã bảo deck sang slide khác sau lệnh này: hẹn giờ của lệnh đó khớp lại
      const d = RP.deckCau.slideHienTai();
      if (lan < 2 && !videoDangMo() && d && d.chiSo !== i && coThe.has(d.chiSo)) { denSlideDeck(i, lan + 1); return; }
      veLai();
    }, 900);
  }

  /** Bấm một KHỐI: tới đầu khối. Khối slide giữ nếp dải cũ — xem đầu tệp. */
  /** @param {boolean} [tuBam] cú bấm chuột THẬT (không phải ↑/↓, ◀▶) — chỉ lúc đó mới đổi bảng phải. */
  function bamKhoi(k, tuBam) {
    const tu = Number(k.dataset.tu) || 0;
    const si = k.dataset.slide;
    if (si != null && !videoDangMo()) {
      tDau = tu;
      capNhatDau();
      denSlideDeck(Number(si));
      /* Bảng phải sang tab Nội dung (đúng slide) — cùng luật với V1 sửa được (timeline-sua.js). CHỈ khi bấm
         chuột: phím ↑/↓, ◀▶ cũng đi qua đây (nhayMoc), mà nhảy tab theo phím là đóng Thư viện / Âm thanh và
         xoá khối đang chọn mỗi lần bước slide (rà GĐ1). */
      if (tuBam && RP.dung && RP.dung.datChon && !(RP.dung.laVideo && RP.dung.laVideo())) RP.dung.datChon([], 'v1');
      return;
    }
    tuaToi(tu + 1e-3, false);
  }

  /** Mốc đầu các slide — cho phím lên/xuống và hai nút ◀ ▶. */
  function nhayMoc(huong) {
    if (!coTimeline()) return;
    const dau = dauKhoiV1();
    let dich;
    if (huong < 0) dich = [...dau].reverse().find((t) => t < tDau - 0.05);
    else dich = dau.find((t) => t > tDau + 0.05);
    if (dich == null) dich = huong < 0 ? 0 : mh.tong;
    const k = luoi && luoi.querySelector(`.tl-khoi.hinh[data-tu="${dich}"]`);
    if (k) bamKhoi(k); else tuaToi(dich, false);
    hienDau();
  }

  /* ── J / K / L (như Premiere) ─────────────────────────────────────────────
     L: phát; bấm thêm = nhanh gấp đôi (tới 8×). J: lùi (video không phát ngược được
     ⇒ tua lùi từng nhịp 1/20 giây), bấm thêm = nhanh gấp đôi. K: dừng, về tốc độ 1×. */
  let tocToi = 0;
  let tocLui = 0;
  let henLui = 0;
  function dungLui() { clearInterval(henLui); henLui = 0; tocLui = 0; }
  function dungShuttle() {
    dungLui();
    tocToi = 0;
    if (RP.thanhPhat && RP.thanhPhat.datToc) RP.thanhPhat.datToc(1);
    if (dongHoChay()) RP.thanhPhat.dung();
  }
  async function shuttle(huong) {
    if (!coVideo() || !RP.thanhPhat) return;
    if (huong > 0) {
      dungLui();
      if (!dongHoChay()) {
        tocToi = 1;
        RP.thanhPhat.datToc(1);
        if (RP.thanhPhat.batTat) await RP.thanhPhat.batTat();
      } else {
        tocToi = Math.min(8, (tocToi || 1) * 2);
        RP.thanhPhat.datToc(tocToi);
      }
      return;
    }
    tocToi = 0;
    if (dongHoChay()) { RP.thanhPhat.dung(); RP.thanhPhat.datToc(1); }
    tocLui = Math.min(8, tocLui ? tocLui * 2 : 1);
    if (henLui) return;
    henLui = setInterval(() => {
      if (tDau <= 0 || !videoDangMo()) { dungLui(); return; }
      tuaToi(Math.max(0, tDau - 0.05 * tocLui), false);
      hienDau();
    }, 50);
  }

  /** Cuộn cho đầu phát nằm trong tầm nhìn (lật trang như Premiere). */
  function hienDau() {
    if (!cuon) return;
    const xDau = tDau * pps;
    const rong = cuon.clientWidth - rongDau;
    if (xDau < cuon.scrollLeft || xDau > cuon.scrollLeft + rong - 24) {
      cuon.scrollLeft = Math.max(0, xDau - 40);
    }
  }

  /** Dự án video: giây sẽ xuất (khối cuối); deck thường / dự án trống: 0. */
  const giayXuat = () => (RP.dung && RP.dung.laVideo && RP.dung.laVideo() && RP.dung.msXuat ? RP.dung.msXuat() / 1000 : 0);
  /** Cuối timeline cho đồng hồ (giây): dự án video = khối cuối (phần nền đen dư không phát); deck = thước. */
  const tongGiay = () => (giayXuat() > 0 ? giayXuat() : ((mh && mh.tong) || 0));

  /** Không có video đang mở: đầu phát về đầu slide đang xem trên deck. */
  function dongBoDau() {
    /* Engine của deck BỎ QUA lệnh sang slide khi đang chạy hiệu ứng chuyển
       (đo: bấm ↓ hai lần cách 0,4 s thì lần hai mất). Trong nhịp đó đừng kéo
       đầu phát về slide cũ — bấm liên tục mới không thấy nó giật lùi. */
    if (!mh || !mh.slides || !mh.slides.length || dangKeoTua || Date.now() - lucDieuHuong < 1000) return;   // 1000 > hẹn 900 ms bảo lại của denSlideDeck
    const v = videoDangMo();
    if (v) { tDau = gioDongHo(); return; }
    const dang = RP.deckCau && RP.deckCau.slideHienTai();
    if (!dang || dang.chiSo < 0) return;
    const s = mh.slides.find((x) => x.i === dang.chiSo);
    const g = dich2goc(tDau);
    if (s && (g < s.tu || g >= s.den)) tDau = goc2dich(s.tu);
  }

  /* ══ SỰ KIỆN ═══════════════════════════════════════════════════════════ */

  function apCao() {
    const shell = document.querySelector(SHELL);
    if (!shell || !goc) return;
    const thu = kho.doc(KHOA.thu) === '1';
    goc.classList.toggle('thu', thu);
    const cao = thu ? CAO_THU : kep(Number(kho.doc(KHOA.cao)) || CAO_MAC_DINH, CAO_MIN, 2000);
    shell.style.setProperty('--tl-cao', `${cao}px`);
    const n = goc.querySelector('[data-lenh="thu"]');
    if (n) {
      n.title = thu ? 'Mở rộng timeline' : 'Thu gọn timeline';
      const o = n.querySelector('[data-icon]');
      const ten = thu ? 'len' : 'xuong';
      if (o && o.dataset.icon !== ten) { o.dataset.icon = ten; o.innerHTML = ''; if (window.__beeIcons) window.__beeIcons.apply(n); }
    }
    henVuaSanKhau();
  }

  /** Khung deck phía trên đổi cỡ theo timeline — đo lại cho vừa. */
  let henSk = null;
  function henVuaSanKhau() {
    clearTimeout(henSk);
    henSk = setTimeout(() => { if (RP.sanKhau && RP.sanKhau.vuaKhung) RP.sanKhau.vuaKhung(); }, 60);
  }

  function ganKeo() {
    const tay = goc.querySelector('.tl-keo');
    const shell = document.querySelector(SHELL);
    const caoTran = () => Math.max(CAO_MIN, (shell ? shell.clientHeight : 800) - 220);
    const dat = (cao) => {
      const c = Math.round(kep(cao, CAO_MIN, caoTran()));
      shell.style.setProperty('--tl-cao', `${c}px`);
      henVuaSanKhau();
      return c;
    };
    tay.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const y0 = e.clientY;
      const c0 = goc.getBoundingClientRect().height;
      let c = c0;
      tay.classList.add('dang-keo');
      document.body.classList.add('tl-dang-keo');
      const di = (ev) => { c = dat(c0 - (ev.clientY - y0)); };
      const thoi = () => {
        tay.classList.remove('dang-keo');
        document.body.classList.remove('tl-dang-keo');
        window.removeEventListener('pointermove', di);
        window.removeEventListener('pointerup', thoi);
        window.removeEventListener('pointercancel', thoi);
        kho.ghi(KHOA.cao, c);
        if (vuaKhung) { tinhVuaKhung(); veHet(); }
      };
      window.addEventListener('pointermove', di);
      window.addEventListener('pointerup', thoi);
      window.addEventListener('pointercancel', thoi);
    });
    tay.addEventListener('dblclick', () => { kho.ghi(KHOA.cao, CAO_MAC_DINH); apCao(); });
    tay.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      e.stopPropagation();
      const c = dat(goc.getBoundingClientRect().height + (e.key === 'ArrowUp' ? 16 : -16));
      kho.ghi(KHOA.cao, c);
    });
  }

  /** Giây ứng với toạ độ chuột (đã trừ cột tên track, cộng phần đã cuộn). */
  function giayTai(clientX) {
    const b = cuon.getBoundingClientRect();
    return kep((clientX - b.left - rongDau + cuon.scrollLeft) / pps, 0, (mh && mh.tong) || 0);
  }

  function ganKeoTua() {
    cuon.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !coTimeline()) return;
      if (e.target.closest('.tl-ten, .tl-goc')) return;
      // Khối của người dùng (di chuyển, cắt hai đầu, chọn) do timeline-sua.js xử lý.
      if (e.target.closest('.tl-khoi.nd') || e.defaultPrevented) return;
      if (RP.dung && RP.dung.chon().length && !e.target.closest('[data-thuoc]')) RP.dung.datChon([]);
      // Bấm vào vùng thanh cuộn của chính .tl-cuon thì để trình duyệt lo.
      const b = cuon.getBoundingClientRect();
      if (e.clientY > b.top + cuon.clientHeight || e.clientX > b.left + cuon.clientWidth) return;
      e.preventDefault();
      goc.focus({ preventScroll: true });
      const trenThuoc = !!e.target.closest('[data-thuoc]');
      const khoi = trenThuoc ? null : e.target.closest('.tl-khoi');
      const x0 = e.clientX;
      let keo = trenThuoc;
      dangKeoTua = true;
      if (keo) tuaToi(giayTai(e.clientX), true);
      try { cuon.setPointerCapture(e.pointerId); } catch { /* con trỏ đã nhả — vẫn nghe trên cuon */ }
      const di = (ev) => {
        if (!keo && Math.abs(ev.clientX - x0) < 4) return;
        keo = true;
        tuaToi(giayTai(ev.clientX), trenThuoc || coVideo());
      };
      const thoi = (ev) => {
        cuon.removeEventListener('pointermove', di);
        cuon.removeEventListener('pointerup', thoi);
        cuon.removeEventListener('pointercancel', thoi);
        try { cuon.releasePointerCapture(ev.pointerId); } catch { /* đã nhả */ }
        // Nhả cờ SAU nhịp chuyển slide của deck (120 ms, xem denSlideDeck).
        setTimeout(() => { dangKeoTua = false; }, 200);
        if (keo) return;
        if (khoi) bamKhoi(khoi, true);
        else tuaToi(giayTai(ev.clientX), false);
      };
      cuon.addEventListener('pointermove', di);
      cuon.addEventListener('pointerup', thoi);
      cuon.addEventListener('pointercancel', thoi);
    });
  }

  function ganNutTrack() {
    luoi.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('tl-ten-goc')) {
        e.preventDefault();
        e.stopPropagation();
        e.target.click();
      }
    });
    luoi.addEventListener('click', (e) => {
      const dg = RP.dung;
      if (!dg) return;
      const n = e.target.closest('[data-tr-lenh]');
      if (n) {
        const id = n.dataset.tr;
        const l = n.dataset.trLenh;
        const t = dg.trackCua(id);
        if (l === 'khoa' && t) dg.doiTrack(id, { khoa: !t.khoa }, t.khoa ? 'Mở khoá track' : 'Khoá track');
        else if (l === 'an' && t) dg.doiTrack(id, { an: !t.an }, t.an ? 'Hiện track' : 'Ẩn track');
        else if (l === 'tieng' && t) dg.doiTrack(id, { tatTieng: !t.tatTieng }, t.tatTieng ? 'Bật tiếng track' : 'Tắt tiếng track');
        else if (l === 'phude') { if (RP.phuDe) RP.phuDe.datTat(!phuDeTat()); }
        else if (l === 'goc') {
          const ag = dg.duAn().amGoc || {};
          if (id === 'giong') dg.doiAmGoc({ tatGiong: !ag.tatGiong }, ag.tatGiong ? 'Bật giọng đọc' : 'Tắt giọng đọc');
          else dg.doiAmGoc({ tatDeck: !ag.tatDeck }, ag.tatDeck ? 'Bật nhạc deck' : 'Tắt nhạc deck');
        }
        return;
      }
      const them = e.target.closest('[data-them-track]');
      if (them) { dg.themTrack(them.dataset.themTrack); return; }
      if (e.target.closest('[data-them-chu]')) { if (!dg.chiDoc()) dg.themChu(Math.round(tDau * 1000)); return; }
      if (e.target.closest('[data-them-giong]')) { if (!dg.chiDoc() && RP.giongKhoi) RP.giongKhoi.mo({ ms: Math.round(tDau * 1000) }); return; }
      // Bấm tên track C1 / A1 / A2: bảng Thuộc tính hiện phụ đề / âm lượng giọng / nhạc deck.
      const ten = e.target.closest('.tl-ten-goc');
      if (ten) {
        const id = ten.dataset.tenTrack;
        dg.datChon([], id === 'phude' ? 'phude' : id === 'giong' ? 'giong' : 'deck');
      }
    });
  }

  function ganSuKien() {
    ganKeo();
    ganKeoTua();
    ganNutTrack();

    let henThuoc = 0;
    cuon.addEventListener('scroll', () => {
      if (henThuoc) return;
      henThuoc = requestAnimationFrame(() => { henThuoc = 0; veThuoc(); });
    }, { passive: true });

    /* Lăn chuột: dọc → cuộn NGANG (như Premiere) khi các track đã vừa chiều
       cao; Alt + lăn → phóng/thu quanh con trỏ. Ctrl + lăn để nguyên cho zoom
       của cả app (main.js). */
    cuon.addEventListener('wheel', (e) => {
      if (!mh || !mh.tong) return;
      if (e.altKey) {
        e.preventDefault();
        const xMan = e.clientX - cuon.getBoundingClientRect().left - rongDau;
        const neo = (cuon.scrollLeft + xMan) / pps;
        datPps(pps * (e.deltaY < 0 ? 1.18 : 1 / 1.18), neo, xMan);
        return;
      }
      if (e.ctrlKey || e.shiftKey) return;
      const docDu = cuon.scrollHeight > cuon.clientHeight + 1;
      if (!docDu && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        cuon.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    goc.querySelector('.tl-thanh').addEventListener('click', (e) => {
      const n = e.target.closest('[data-lenh]');
      if (!n || n.disabled) return;
      const l = n.dataset.lenh;
      if (l === 'chay') { if (RP.thanhPhat && RP.thanhPhat.batTat) RP.thanhPhat.batTat(); }
      else if (l === 'tieng') {
        /* Bấm hộ nút loa (đã ẩn) của thanh phát cũ — nó biết tắt tiếng VIDEO hay
           tắt tiếng DECK (nhạc nền + tiếng chuyển của engine), một nguồn sự thật. */
        const n0 = document.querySelector('#tpTieng');
        if (n0) n0.click();
        veNutTieng();
      }
      else if (l === 'truoc') nhayMoc(-1);
      else if (l === 'sau') nhayMoc(1);
      else if (l === 'phong-to') datPps(pps * 1.5);
      else if (l === 'thu-nho') datPps(pps / 1.5);
      else if (l === 'vua') { vuaKhung = true; tinhVuaKhung(); veHet(); cuon.scrollLeft = 0; }
      else if (l === 'bam') { bam = !bam; kho.ghi(KHOA.bam, bam ? '1' : '0'); veTrangThai(); if (bam) hienDau(); }
      else if (l === 'thu') { kho.ghi(KHOA.thu, goc.classList.contains('thu') ? '0' : '1'); apCao(); setTimeout(() => { if (vuaKhung) { tinhVuaKhung(); veHet(); } }, 80); }
    });
    goc.querySelector('#tlZoom').addEventListener('input', (e) => {
      datPps(ppsTuO(Number(e.target.value)));
    });

    /* Phím tắt khi timeline đang được chọn (bấm vào nó là có focus). */
    goc.addEventListener('keydown', (e) => {
      if (e.target.closest('input, .tl-keo') || e.ctrlKey || e.metaKey || e.altKey) return;
      const fps = (mh && mh.fps) || FPS;
      let xong = true;
      if (e.key === ' ') {
        dungLui();
        if (RP.thanhPhat && RP.thanhPhat.toc && RP.thanhPhat.toc() !== 1) { RP.thanhPhat.datToc(1); tocToi = 0; }
        if (coVideo() && RP.thanhPhat.batTat) RP.thanhPhat.batTat();
      }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const huong = e.key === 'ArrowLeft' ? -1 : 1;
        if (videoDangMo()) tuaToi(tDau + (huong * (e.shiftKey ? 5 : 1)) / fps, false);
        else nhayMoc(huong);
        hienDau();
      } else if (e.key === 'ArrowUp') nhayMoc(-1);
      else if (e.key === 'ArrowDown') nhayMoc(1);
      else if (e.key === 'Home') { tuaToi(0, false); hienDau(); }
      else if (e.key === 'End') { tuaToi(mh ? mh.tong : 0, false); hienDau(); }
      else if (e.key === '=' || e.key === '+') datPps(pps * 1.5);
      else if (e.key === '-') datPps(pps / 1.5);
      else if (e.key === 'l' || e.key === 'L') shuttle(1);
      else if (e.key === 'j' || e.key === 'J') shuttle(-1);
      else if (e.key === 'k' || e.key === 'K') dungShuttle();
      else if (e.key === '\\') { vuaKhung = true; tinhVuaKhung(); veHet(); cuon.scrollLeft = 0; }
      else xong = false;
      if (xong) e.preventDefault();
    });

    // Đổi cỡ vùng làn (kéo cột, đổi cỡ cửa sổ, kéo chiều cao) → vừa khung lại + thước.
    if (window.ResizeObserver) {
      let w0 = 0;
      new ResizeObserver(() => {
        const w = cuon.clientWidth;
        if (w === w0) { veThuoc(); return; }
        w0 = w;
        if (vuaKhung && mh && mh.tong) { tinhVuaKhung(); veHet(); } else veThuoc();
      }).observe(cuon);
    }

    // Video: chạy/dừng/tua/đóng — xem `nguoiNghe` ở thanh-phat.js.
    if (RP.thanhPhat && RP.thanhPhat.nghe) {
      RP.thanhPhat.nghe((loai) => {
        veNutTieng();
        if (loai === 'deck') { dungLui(); napDeck(); return; }
        const v = videoDangMo();
        // Đồng hồ chạy (nút ▶ / Space) hay đóng: thôi tua lùi J — không thì hai bên giành đầu phát (audit).
        if (loai === 'chay' || loai === 'dong') dungLui();
        if (loai === 'chay' || loai === 'dung') { veNutChay(); if (v) { tDau = gioDongHo(); capNhatDau(); } return; }
        if (loai === 'dong') { veNutChay(); dongBoDau(); capNhatDau(); return; }
        // GĐ3.0: đầu phát = giờ đồng hồ (đi được cả quá cuối video slide — không còn "kẹp ở khung cuối").
        if (loai === 'nhip' && v) { tDau = gioDongHo(); capNhatDau(); if (bam) hienDau(); return; }
        if ((loai === 'tua' || loai === 'mo') && v) { tDau = gioDongHo(); capNhatDau(); }
      });
    }

    // Dựng xong một lượt: nạp lại mốc + video của deck đang mở (timeline theo sau qua 'deck').
    if (api.render && api.render.onDone) {
      /* CHỈ khi đúng deck đang mở vừa dựng lại video slide: lượt của deck khác (hàng đợi)
         hay lượt XUẤT BẢN DỰNG (video slide không đổi) mà nạp lại là đóng mất khung xem
         trước người dùng đang xem (audit 10/10/2026). */
      api.render.onDone((r) => {
        const ten = deckDang();
        // Sóng âm bị hoãn vì đang có lượt dựng (deck nào cũng vậy): xong lượt nào cũng hỏi lại.
        if (ten && mh && mh.dangDung && (!r || r.banDung || tenTuDuong(r.projectDir) !== ten)) { napDeck(); return; }
        if (!ten || !r || r.banDung || tenTuDuong(r.projectDir) !== ten) return;
        if (RP.thanhPhat && RP.thanhPhat.napDeck) RP.thanhPhat.napDeck(ten);
      });
    }
    if (api.render && api.render.onError) {
      api.render.onError(() => { if (deckDang() && mh && mh.dangDung) napDeck(); });
    }
    // Đổi sáng/tối: màu thước + sóng lấy từ token — vẽ lại.
    new MutationObserver(() => { if (mh) veHet(); })
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  /* ══ CỬA CHO MÔ-ĐUN KHÁC ═══════════════════════════════════════════════ */

  let mocUocNguon = null;
  let mocUocDem = [];
  /** Mốc slide ms từ mô hình đang vẽ (nhớ theo tham chiếu — xem trước gọi mỗi khung hình). */
  function mocUoc() {
    if (!mh || !mh.slides) return [];
    if (mocUocNguon !== mh.slides) {
      mocUocNguon = mh.slides;
      mocUocDem = mh.slides.map((x) => ({ tuMs: Math.round(x.tu * 1000), denMs: Math.round(x.den * 1000) }));
    }
    return mocUocDem;
  }

  /**
   * San-khau gọi mỗi lần vẽ lại dải slide cũ (đổi slide, có ảnh thu nhỏ mới,
   * đóng deck). Gom về một nhịp khung hình.
   */
  let henVe = 0;
  function veLai() {
    if (henVe || !goc) return;
    henVe = requestAnimationFrame(() => {
      henVe = 0;
      if (!mh || mh.deck !== deckDang()) return;   // đổi deck: 'deck' của thanh phát lo
      const anh = layAnh();
      if (anh !== anhCu) {
        // Ảnh thu nhỏ mới (hoặc deck vừa nạp lại): dựng lại mô hình — chữ slide có thể đã đổi.
        mh = dungMoHinh();
        if (vuaKhung) tinhVuaKhung();
      }
      dongBoDau();
      if (anh !== anhCu) veHet(); else capNhatDau();
    });
  }

  /* Dự án dựng đổi (thêm/sửa khối, chọn, ảnh thu nhỏ/sóng mới, mốc slide) → vẽ lại
     trong MỘT nhịp khung hình, dù có bao nhiêu sự kiện dồn về. */
  let henVeDung = 0;
  function henVeHet() {
    if (henVeDung) return;
    henVeDung = requestAnimationFrame(() => {
      henVeDung = 0;
      const tongCu = mh && mh.tong;
      capNhatTong();
      if (vuaKhung && mh && mh.tong !== tongCu) tinhVuaKhung();
      veHet();
    });
  }
  function ganDung() {
    if (!RP.dung || !RP.dung.nghe) return;
    RP.dung.nghe((loai) => {
      if (loai === 'loi') { veTrangThai(); return; }
      /* Kho dựng nạp xong SAU mô hình timeline: dự án video (không slide — GĐ3.4) chỉ biết được lúc này ⇒ dựng lại
         mô hình cho đúng loại (thước theo nội dung, fps của dự án). */
      if (loai === 'nap' && mh && mh.deck === deckDang() && !!mh.laVideo !== !!(RP.dung.laVideo && RP.dung.laVideo())) {
        mh = dungMoHinh();
      }
      henVeHet();
    });
  }

  Object.assign(RP, {
    timeline: {
      veLai, napDeck, tuaToi: (g) => tuaToi(g, false),
      /** Giây đầu phát (ms) — thư viện thêm khối "tại đầu phát". */
      tDauMs: () => Math.round(tDau * 1000),
      /** Cuối timeline (giây) cho đồng hồ của thanh phát (GĐ3.0). */
      tongGiay,
      /** Độ dài video slide đang vẽ (ms, kể cả đuôi sau slide cuối) — 0 khi chưa có. Nhạc có sẵn kéo tới đây. */
      msVideo: () => Math.round(((mh && (mh.tongDeck != null ? mh.tongDeck : mh.tong)) || 0) * 1000),
      /** Cửa TRONG cho timeline-sua.js: cùng phép quy đổi giây ↔ điểm ảnh, không tự tính lại. */
      noi: {
        goc: () => goc, cuon: () => cuon, luoi: () => luoi,
        pps: () => pps, rongDau: () => rongDau,
        giayTai: (clientX) => {
          const b = cuon.getBoundingClientRect();
          return Math.max(0, (clientX - b.left - rongDau + cuon.scrollLeft) / pps);
        },
        tDau: () => tDau,
        datDau: (g) => tuaToi(g, false),
        mocSlide: () => (mh && mh.slides ? dauKhoiV1() : []),
        // V1 đã sửa: cho timeline-sua đổi giờ gốc ↔ giờ timeline.
        goc2dich, dich2goc,
        // Mốc slide (ms) đang VẼ — ước lượng khi chưa dựng video. RP.dung dùng khi chưa có timing.json.
        mocUoc,
        veHet: henVeHet, hienDau,
      },
    },
  });

  function khoi() {
    if (!dungKhung()) return;
    ganDung();
    veHet();
    napDeck();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', khoi);
  else khoi();
})();
