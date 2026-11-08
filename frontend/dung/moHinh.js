/**
 * MÔ HÌNH dự án dựng — `<deck>/dung/du-an.json` (docs/video-editor/KE-HOACH.md §4).
 *
 * DÙNG CHUNG ba nơi, nên viết thuần (không Node, không DOM) và nạp kiểu UMD:
 *   · tiến trình chính (`require`) — kiểm trước khi ghi đĩa, sinh lệnh xuất;
 *   · giao diện (`<script>` → `window.__beeDung.moHinh`) — timeline, bảng Khối;
 *   · bộ thử (`scripts/test-dung.mjs`).
 * Một chỗ tính thời gian thì xem trước và bản xuất không thể lệch nhau vì toán.
 *
 * ── Đơn vị ────────────────────────────────────────────────────────────────
 * Thời gian là MILI-GIÂY SỐ NGUYÊN ở mọi chỗ lưu. Giây thực chỉ xuất hiện ở biên
 * (đọc `timing.json`, đặt `video.currentTime`). Cộng trừ số thực qua cả trăm lần
 * kéo thả là trôi mất vài khung — số nguyên thì không.
 *
 * ── Khối NEO theo slide ──────────────────────────────────────────────────
 * Video slide còn bị DỰNG LẠI (sửa chữ, đổi giọng ⇒ độ dài từng slide đổi). Khối
 * neo `{ slide: 3, lechMs: 1200 }` = "1,2 giây sau đầu slide 4" — dựng lại thì tự
 * dời theo slide. Khối `neo: null` đứng yên theo `batDauMs` tuyệt đối.
 */
(function (goc, nhaMay) {
  if (typeof module === 'object' && module.exports) module.exports = nhaMay();
  else {
    goc.__beeDung = goc.__beeDung || {};
    goc.__beeDung.moHinh = nhaMay();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* PHIÊN BẢN 2 (GĐ3.1 lộ trình gộp, 16/10/2026): video slide là MỘT KHỐI trên timeline — `slide: { batDauMs, doan }`
     (thay `v1`), neo/đoạn V1 mang DẤU slide (`dau`, băm lời thoại) để chèn/đổi thứ tự slide không làm khối nhảy sai
     slide (lỗi L3); bỏ `goc.dauVan` (L4, không nơi nào đọc). Tệp v1 được NÂNG CẤP lúc đọc (nangCap, kho.docDuAn);
     app bản cũ mở tệp v2 thì chỉ đọc (kho.js chặn ghi đè). */
  /* Phiên bản CAO NHẤT app này đọc / ghi. 3 = dự án có BỘ SLIDE PHỤ (media `boSlide`, GĐ3.7); không có thì vẫn ghi 2 —
     bản 3.0–3.6 (đọc tới 2) mở dự án thường như cũ, còn dự án có bộ phụ thì CHỈ ĐỌC (không lặng lẽ xoá `boSlide` khi tự
     lưu — audit 3.7). */
  const PHIEN_BAN = 3;
  const LOAI_MEDIA = ['video', 'anh', 'tieng'];
  const LOAI_TRACK = ['hinh', 'tieng'];
  const TRAN = { track: 24, khoi: 2000, media: 500, msToiDa: 6 * 3600 * 1000, kf: 100, danhDau: 500 };

  /* ── Giai đoạn 2 ──────────────────────────────────────────────────────────
     KEYFRAME: `c.kf = { x: [{ t, v, muot? }], ... }` — `t` là ms TÍNH TỪ ĐẦU KHỐI trên
     timeline (không phải giờ trong media: ảnh không có giờ media). Cắt mép đầu / dao
     cạo / đổi tốc độ phải dời keyframe theo (`kfDoi`, `kfTach`, `kfTiLe`). Giữa hai
     keyframe nội suy thẳng; `muot` ở keyframe ĐẦU đoạn = vào/ra êm (smoothstep). */
  const THUOC_KF = ['x', 'y', 'co', 'xoay', 'mo', 'amLuong'];
  const GIOI_KF = { x: [-2, 3], y: [-2, 3], co: [0.01, 10], xoay: [-3600, 3600], mo: [0, 1], amLuong: [0, 4] };
  /** Kiểu chuyển cảnh vào/ra của một khối. 'mo' = mờ dần (như Giai đoạn 1). */
  const KIEU_CHUYEN = ['mo', 'truot-trai', 'truot-phai', 'truot-len', 'truot-xuong', 'phong',
    /* Đợt 1 hiệu ứng (23/10/2026). CHUYỂN ĐỘNG — biểu thức kép như trượt / phóng: */
    'phong-lon', 'nay', 'xoay',
    /* MẶT NẠ — bản xuất dùng `xfade` của ffmpeg giữa khối (đã đặt lên khung trong suốt) và khung trong suốt;
       xem trước tô `mask-image` CSS từ CHÍNH công thức của xfade (phuMat). Mặt nạ tính theo KHUNG XUẤT, không theo
       hộp khối — như Premiere: quét một logo nhỏ là mép quét đi ngang khung. */
    'quet-trai', 'quet-phai', 'quet-len', 'quet-xuong', 'quet-mem-trai', 'quet-mem-phai', 'quet-mem-len', 'quet-mem-xuong',
    'tron-mo', 'tron-dong', 'cua-mo-doc', 'cua-dong-doc', 'cua-mo-ngang', 'cua-dong-ngang', 'dong-ho',
    /* NHÁY QUA MÀU (Dip to Black / White): lớp màu phủ CẢ KHUNG đục dần 0 → 1 → 0 (tuyến tính), khối hiện / tắt đúng
       lúc màu đặc nhất. KHÔNG dùng xfade fadeblack: nó trộn bằng đen / trắng NGOÀI dải video (Y 0 / 255 thay vì 16 / 235
       — đo 23/10/2026) nên tối / sáng lâu hơn mà CSS không bắt chước được. Bản xuất: hai bộ lọc fade trên lớp màu. */
    'nhay-den', 'nhay-trang'];
  /** Kiểu mặt nạ → tên transition của xfade (ffmpeg 7.1). */
  const XFADE = {
    'quet-trai': 'wipeleft', 'quet-phai': 'wiperight', 'quet-len': 'wipeup', 'quet-xuong': 'wipedown',
    'quet-mem-trai': 'smoothleft', 'quet-mem-phai': 'smoothright', 'quet-mem-len': 'smoothup', 'quet-mem-xuong': 'smoothdown',
    'tron-mo': 'circleopen', 'tron-dong': 'circleclose', 'cua-mo-doc': 'vertopen', 'cua-dong-doc': 'vertclose',
    'cua-mo-ngang': 'horzopen', 'cua-dong-ngang': 'horzclose', 'dong-ho': 'radial',
  };
  /** Nháy qua màu: màu lớp phủ. */
  const MAU_NHAY = { 'nhay-den': '#000000', 'nhay-trang': '#ffffff' };
  /** Kiểu có mờ dần đi kèm (độ đục tuyến tính như bộ lọc fade). */
  const CO_MO = ['mo', 'phong', 'phong-lon', 'nay', 'xoay'];
  /**
   * CHỮ ĐỘNG dựng sẵn (đợt 1 hiệu ứng) — tổ hợp chuyển cảnh vào / ra (+ hiệu ứng chuyển động) với thời lượng hợp cho chữ.
   * Bảng Thuộc tính (khối chữ) và MCP (`animation` của add_title) dùng CHUNG bảng này qua apChuDong.
   * Thời lượng là mức MONG MUỐN — khối ngắn thì co lại (mỗi đầu ≤ 40 % độ dài khối).
   */
  const CHU_DONG = {
    'bat-len': { ten: 'Bật lên', mo: { kieuVao: 'nay', vaoMs: 450, kieuRa: 'mo', raMs: 300 } },
    'truot-len': { ten: 'Trượt lên', mo: { kieuVao: 'truot-len', vaoMs: 550, kieuRa: 'mo', raMs: 350 } },
    'phong-manh': { ten: 'Phóng mạnh', mo: { kieuVao: 'phong-lon', vaoMs: 450, kieuRa: 'phong-lon', raMs: 350 } },
    'xoay-vao': { ten: 'Xoay vào', mo: { kieuVao: 'xoay', vaoMs: 600, kieuRa: 'xoay', raMs: 450 } },
    'mo-giua': { ten: 'Mở từ giữa', mo: { kieuVao: 'cua-mo-doc', vaoMs: 550, kieuRa: 'cua-dong-doc', raMs: 450 } },
    'lo-dan': { ten: 'Lộ dần (quét)', mo: { kieuVao: 'quet-mem-phai', vaoMs: 800, kieuRa: 'quet-mem-phai', raMs: 600 } },
    'troi-nhe': { ten: 'Trôi nhẹ', mo: { kieuVao: 'mo', vaoMs: 400, kieuRa: 'mo', raMs: 400 }, hieuUng: { kieu: 'phong', manh: 0.3 } },
  };
  /* Hiệu ứng chuyển động do CHÍNH bảng chữ động đặt (dấu nhận: trùng kiểu + mạnh của một kiểu có `hieuUng`). Đổi
     kiểu thì chỉ gỡ cái đó — hiệu ứng người dùng tự đặt (Ken Burns…) giữ nguyên (rà soát đợt 1). */
  const huCuaChuDong = (h) => !!h && Object.values(CHU_DONG).some((x) => x.hieuUng && x.hieuUng.kieu === h.kieu && x.hieuUng.manh === h.manh);
  /** Áp kiểu chữ động `id` lên khối `c` (giữ `noi` + hiệu ứng tự đặt); 'khong' = bỏ chuyển cảnh. Không đổi `c` gốc. */
  function apChuDong(c, id) {
    const dai = doDaiMs(c);
    const cu = c.mo || {};
    const huGiu = c.hieuUng && !huCuaChuDong(c.hieuUng) ? c.hieuUng : null;
    if (id === 'khong') return { ...c, mo: { vaoMs: 0, raMs: 0, kieuVao: 'mo', kieuRa: 'mo', noi: !!cu.noi }, hieuUng: huGiu };
    const k = CHU_DONG[id];
    if (!k) return c;
    const tran = Math.floor(dai * 0.4);
    return {
      ...c,
      mo: { ...k.mo, vaoMs: Math.min(k.mo.vaoMs, tran), raMs: Math.min(k.mo.raMs, tran), noi: !!cu.noi },
      hieuUng: k.hieuUng ? { ...k.hieuUng } : huGiu,
    };
  }
  /** Kiểu chữ động khối `c` đang mang (so kiểu vào / ra + hiệu ứng của bảng) — 'khong' / id / 'tuy-chinh'. */
  function chuDongCua(c) {
    const mo = c.mo || {};
    const huBang = huCuaChuDong(c.hieuUng) ? c.hieuUng : null;
    if (!(mo.vaoMs > 0) && !(mo.raMs > 0) && !huBang) return 'khong';
    const id = Object.keys(CHU_DONG).find((k) => {
      const x = CHU_DONG[k];
      return x.mo.kieuVao === (mo.kieuVao || 'mo') && x.mo.kieuRa === (mo.kieuRa || 'mo')
        && (x.hieuUng ? !!huBang && huBang.kieu === x.hieuUng.kieu : !huBang);
    });
    return id || 'tuy-chinh';
  }
  /** Khung xuất. 'goc' = đúng cỡ video slide. */
  const KHUNG_XUAT = { goc: null, '16:9': [16, 9], '9:16': [9, 16], '1:1': [1, 1], '4:5': [4, 5] };
  const MAU_DANH_DAU = ['xanh', 'do', 'vang', 'tim', 'cam'];

  /**
   * Track CỦA NGƯỜI DÙNG (thả media vào). Các track SINH TỪ DECK — phụ đề, V1 slide,
   * A1 giọng, A2 nhạc nền, A3 tiếng chuyển — KHÔNG nằm ở đây: chúng đọc từ deck mỗi
   * lần (timeline.js) và đổi bằng cách sửa deck rồi dựng lại. Lưu chúng vào đây là
   * hai nguồn sự thật cho cùng một thứ.
   * Thứ tự trong mảng = thứ tự chồng: track HÌNH đứng SAU thì vẽ ĐÈ LÊN (V3 trên V2).
   */
  function trackMacDinh() {
    return [
      { id: 'V2', loai: 'hinh', ten: 'B-roll' },
      { id: 'V3', loai: 'hinh', ten: 'Logo / chữ' },
      { id: 'A4', loai: 'tieng', ten: 'Âm thanh thêm' },
    ];
  }

  /** Âm lượng hai lớp tiếng SINH TỪ DECK (tách sẵn lúc dựng: giọng / nhạc + hiệu ứng). */
  const amGocMacDinh = () => ({ giong: 1, deck: 1, tatGiong: false, tatDeck: false, haNhac: { bat: false, mucDb: 12 } });
  /** Cách xuất: khung ('goc' | '16:9' | …) và nền khi video slide không lấp đầy khung ('mo' | 'den'). */
  const xuatMacDinh = () => ({ khung: 'goc', nen: 'mo' });

  /**
   * Dự án CÓ chỉnh gì so với video slide không — quyết định "Tạo video" có tự áp timeline
   * (render/queue.js) hay không. Có khối, đã sửa V1 / phụ đề, đổi âm lượng giọng/nhạc, hay
   * khung xuất khác "theo video slide" đều tính là có.
   */
  function coChinhSua(d) {
    if (!d) return false;
    const ag = d.amGoc || {};
    const amKhac = (ag.giong != null && ag.giong !== 1) || (ag.deck != null && ag.deck !== 1)
      || !!ag.tatGiong || !!ag.tatDeck || !!(ag.haNhac && ag.haNhac.bat);
    // Khối slide đã cắt / đổi chỗ đoạn, hay dời khỏi giây 0 (GĐ3.1) đều là chỉnh.
    const slideKhac = !!(d.slide && (d.slide.doan || d.slide.batDauMs > 0));
    return (Array.isArray(d.khoi) && d.khoi.length > 0) || slideKhac || !!d.phuDe || amKhac
      || !!(d.xuat && d.xuat.khung && d.xuat.khung !== 'goc')
      // Chỉ chỉnh "Màu cả video" (GĐ2.4) cũng là chỉnh — không thì "Tạo video" bỏ qua bước áp timeline (rà GĐ2).
      || !!(d.xuat && d.xuat.mau);
  }

  /** Dự án rỗng cho một deck. */
  function moi(o) {
    const x = o || {};
    return {
      phienBan: 2,
      khung: { rong: x.rong || 1080, cao: x.cao || 1920, fps: x.fps || 30 },
      goc: { video: x.video || '' },
      // Khối slide ở giây 0, nguyên video. Dự án VIDEO TRỐNG (không có slide): `slide: null`.
      slide: x.khongSlide ? null : { batDauMs: 0, doan: null },
      amGoc: amGocMacDinh(),
      xuat: xuatMacDinh(),
      media: [],
      track: trackMacDinh(),
      khoi: [],
      danhDau: [],
    };
  }

  /* ── kiểm + chuẩn hoá ───────────────────────────────────────────────────
     Tệp nằm trên đĩa người dùng — AI, người dùng hay một bản app khác đều có
     thể đã sửa. Không tin gì: số phải là số hữu hạn, đường dẫn media phải nằm
     TRONG `dung/media/`, id phải trỏ tới thứ có thật. Sai thì báo, không đoán. */
  const soNguyen = (v, min, max) => Number.isFinite(v) && Math.round(v) === v && v >= min && v <= max;
  const so = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const chuoi = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
  const ID_MAU = /^[A-Za-z0-9_-]{1,40}$/;
  /* `typeof` TRƯỚC regex: `ID.test(12345)` hay `ID.test(['mabc'])` ép kiểu ra chuỗi
     và LỌT — rồi mọi phép so `===` về sau hỏng âm thầm. */
  const ID = { test: (v) => typeof v === 'string' && ID_MAU.test(v) };
  /* BỘ SLIDE PHỤ (GĐ3.7): thư mục `bo-slide/<id>/` trong dự án — một deck đầy đủ, lên timeline như MỘT clip video
     (media mang `boSlide: id`). Khớp src/dung/boSlide.js#ID_BO. */
  const ID_BO = /^[a-z0-9][a-z0-9-]{0,39}$/;
  const chuoiNgan = (v, max) => (typeof v === 'string' && v.length <= max ? v : '');

  /** Đường media tương đối, CHỈ trong `dung/media/`, không `..`, không tuyệt đối, không ADS. */
  function duongMediaHopLe(p) {
    if (!chuoi(p, 300)) return false;
    if (p.includes('\\') || p.includes(':') || p.includes('\0')) return false;
    if (!p.startsWith('dung/media/')) return false;
    return !p.split('/').some((x) => x === '..' || x === '.' || x === '');
  }

  /** Keyframe: số hữu hạn trong giới hạn của thuộc tính, xếp theo giờ, trùng giờ thì giữ cái SAU. */
  function kfSach(kf, id, loi) {
    const ra = {};
    if (kf == null) return ra;
    if (typeof kf !== 'object' || Array.isArray(kf)) { loi.push(`khối ${id}: keyframe sai.`); return ra; }
    THUOC_KF.forEach((ten) => {
      const ds = kf[ten];
      if (ds == null) return;
      if (!Array.isArray(ds) || ds.length > TRAN.kf) { loi.push(`khối ${id}: keyframe ${ten} sai hoặc quá ${TRAN.kf} điểm.`); return; }
      const [lo, hi] = GIOI_KF[ten];
      const sach = [];
      for (const k of ds) {
        if (!k || !soNguyen(k.t, 0, TRAN.msToiDa) || !so(k.v, lo, hi)) { loi.push(`khối ${id}: keyframe ${ten} sai giá trị.`); return; }
        sach.push(k.muot ? { t: k.t, v: k.v, muot: true } : { t: k.t, v: k.v });
      }
      sach.sort((a, b) => a.t - b.t);   // sort ổn định: cùng giờ giữ thứ tự gốc
      const gon = sach.filter((k, i) => i === sach.length - 1 || sach[i + 1].t !== k.t);
      if (gon.length) ra[ten] = gon;
    });
    return ra;
  }

  /** Giọng đọc thành khối (GĐ2.1): chữ + giọng để SỬA LẠI — bản xuất dùng chính tệp tiếng đã sinh. */
  const ENGINE_GIONG = ['edge', 'vieneu', 'beeknoee', 'elevenlabs'];
  /* ── CHỈNH MÀU (GĐ2.4) ─────────────────────────────────────────────────────
     Độ sáng × tương phản × bão hoà gộp thành MỘT ma trận affine RGB 3×4 (cột 4 nhân với kênh alpha — ảnh đục thì
     chính là độ dời). Xuất: `colorchannelmixer` trên gbrap (cột `ra/ga/ba`). Xem trước: SVG `feColorMatrix` CÙNG ma
     trận (cột alpha, color-interpolation-filters sRGB) ⇒ hai bên không lệch vì toán. KHÔNG dùng `eq` của ffmpeg (cộng
     trên luma, CSS thì nhân RGB — lộ trình đã cảnh báo) và cũng không dùng CSS brightness()/contrast() (kẹp giữa các
     bước). Bão hoà = ma trận saturate của SVG/CSS (hệ số 0,213 · 0,715 · 0,072). */
  function mauSach(x) {
    if (!x || typeof x !== 'object') return null;
    const r = {
      sang: so(x.sang, 0.3, 2) ? x.sang : 1,
      tuongPhan: so(x.tuongPhan, 0.3, 2) ? x.tuongPhan : 1,
      baoHoa: so(x.baoHoa, 0, 3) ? x.baoHoa : 1,
    };
    return r.sang === 1 && r.tuongPhan === 1 && r.baoHoa === 1 ? null : r;
  }
  /** [[rr, rg, rb, ra], [gr, …], [br, …]] — v' = M·(sáng·v) quanh 0,5 theo tương phản, rồi bão hoà. */
  function maTranMau(m) {
    const b = (m && m.sang) || 1;
    const c = m && m.tuongPhan != null ? m.tuongPhan : 1;
    const s = m && m.baoHoa != null ? m.baoHoa : 1;
    const S = [
      [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
      [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
      [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
    ];
    // Hàng của S cộng lại = 1 ⇒ S·(độ dời đều o) = o.
    const o = 0.5 * (1 - c);
    return S.map((h) => [...h.map((v) => v * c * b), o]);
  }
  const r6 = (v) => Number(v.toFixed(6));
  /** Bộ lọc ffmpeg (đầu vào bất kỳ — tự đổi sang gbrap). */
  function locMau(m) {
    const M = maTranMau(m);
    const k = ['r', 'g', 'b'];
    const p = [];
    M.forEach((h, i) => { ['r', 'g', 'b', 'a'].forEach((x, j) => p.push(`${k[i]}${x}=${r6(h[j])}`)); });
    return `format=gbrap,colorchannelmixer=${p.join(':')}`;
  }
  /**
   * Chuỗi `values` của feColorMatrix. Mặc định độ dời ở cột ALPHA — y hệt colorchannelmixer của bản xuất trên khối
   * (alpha thẳng: điểm ảnh nửa trong suốt nhận o·A; ffmpeg đi kèm không có premultiply/alphamerge để làm khác).
   * `hangSo`: độ dời ở cột HẰNG — cho MÀU CẢ VIDEO ở xem trước: lọc từng phần tử rồi mới chồng = lọc ảnh đã chồng
   * (bản xuất áp lên hình ghép đục) đúng cả ở mép nửa trong suốt (rà GĐ2).
   */
  function svgMau(m, hangSo) {
    const M = maTranMau(m);
    const hang = M.map((h) => (hangSo ? [h[0], h[1], h[2], 0, h[3]] : [...h, 0]));
    return [...hang, [0, 0, 0, 1, 0]].map((h) => h.map(r6).join(' ')).join(' ');
  }

  /** Hiệu ứng chuyển động cho khối hình (GĐ2.3). */
  const HIEU_UNG = ['phong', 'thu', 'troi-trai', 'troi-phai', 'troi-len', 'troi-xuong'];
  /* `tu`/`den` = khúc tiến độ (0–1) khối này chạy — dao cạo chia đôi khối thì hai nửa nối tiếp nhau, không chạy lại
     từ đầu (dung-kho.catTai). Mặc định cả khúc 0 → 1. */
  /**
   * Ô giữ chỗ của MẪU DỰNG VIDEO: `{ so, daThay, phu }` — `so` = số thứ tự hiện cho người dùng ("Ô 3", thứ tự lấp
   * nhanh), `daThay` = đã thay media demo bằng media của người dùng, `phu` = ô PHỦ KÍN khung (thay media khác tỉ lệ thì
   * cỡ quy đổi để vẫn phủ kín — thayMediaKhoi).
   */
  function oChoSach(o) {
    if (!o || typeof o !== 'object' || !soNguyen(o.so, 1, 99)) return null;
    return { so: o.so, daThay: !!o.daThay, phu: o.phu !== false };
  }
  function huSach(h) {
    const tu = so(h.tu, 0, 1) ? h.tu : 0;
    const den = so(h.den, 0, 1) && h.den > tu ? h.den : 1;
    return { kieu: h.kieu, manh: so(h.manh, 0.1, 1) ? h.manh : 0.5, ...(tu > 0 ? { tu } : {}), ...(den < 1 ? { den } : {}) };
  }
  function ttsSach(x) {
    if (!x || typeof x !== 'object' || !chuoi(x.chu, 5000)) return null;
    return {
      chu: x.chu,
      engine: ENGINE_GIONG.includes(x.engine) ? x.engine : 'edge',
      voice: chuoi(x.voice, 200) ? x.voice : '',
      model: chuoi(x.model, 100) ? x.model : '',
      speed: so(x.speed, 0.5, 2) ? x.speed : 1,
    };
  }

  const MAU_HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
  /** Chữ tiêu đề: chỉ thông số để SỬA LẠI — bản xuất dùng tệp PNG đã vẽ, không vẽ lại. */
  function chuSach(x, id, loi) {
    if (!x || typeof x !== 'object' || !chuoi(x.noiDung, 1000)) { loi.push(`media ${id}: chữ tiêu đề sai.`); return null; }
    const mau = (v, mac) => (typeof v === 'string' && MAU_HEX.test(v) ? v : mac);
    return {
      noiDung: x.noiDung,
      phong: chuoi(x.phong, 60) ? x.phong : 'Be Vietnam Pro',
      co: so(x.co, 8, 600) ? x.co : 96,
      mau: mau(x.mau, '#ffffff'),
      nen: x.nen === '' ? '' : mau(x.nen, ''),
      vien: so(x.vien, 0, 40) ? x.vien : 0,
      mauVien: mau(x.mauVien, '#000000'),
      bong: !!x.bong,
      dam: x.dam !== false,
      nghieng: !!x.nghieng,
      canh: ['trai', 'giua', 'phai'].includes(x.canh) ? x.canh : 'giua',
    };
  }

  /**
   * V1 ĐÃ SỬA (Giai đoạn 3): thứ tự + đoạn giữ lại của video slide — `{ doan: [{ slide, vaoMs, raMs }] }`
   * (vào/ra tính TRONG slide, theo trục video gốc). null = nguyên video như đã dựng.
   */
  function v1Sach(v, loi) {
    if (v == null) return null;
    if (typeof v !== 'object' || !Array.isArray(v.doan) || v.doan.length > TRAN.khoi) { loi.push('V1 đã sửa sai dạng.'); return null; }
    const ra = [];
    for (const x of v.doan) {
      if (!x || !soNguyen(x.slide, 0, 9999) || !soNguyen(x.vaoMs, 0, TRAN.msToiDa) || !soNguyen(x.raMs, 1, TRAN.msToiDa) || x.raMs <= x.vaoMs) {
        loi.push('Đoạn V1 sai (slide / vào / ra).');
        return null;
      }
      ra.push({ slide: x.slide, vaoMs: x.vaoMs, raMs: x.raMs, ...(DAU.test(x.dau || '') ? { dau: x.dau } : {}) });
    }
    return ra.length ? { doan: ra } : null;
  }

  /** Khối slide (GĐ3.1): `{ batDauMs, doan | null }` — null = dự án không có video slide (dự án video trống). */
  function slideSach(v, loi) {
    if (v == null) return null;
    if (typeof v !== 'object') { loi.push('Khối slide sai dạng.'); return null; }
    const bd = v.batDauMs == null ? 0 : v.batDauMs;
    if (!soNguyen(bd, 0, TRAN.msToiDa)) { loi.push('Khối slide: giờ bắt đầu sai.'); return null; }
    const v1 = v.doan == null ? null : v1Sach({ doan: v.doan }, loi);
    return { batDauMs: bd, doan: v1 ? v1.doan : null };
  }

  /* ── DẤU SLIDE (GĐ3.1, lỗi L3) ────────────────────────────────────────────
     Slide KHÔNG có id ổn định (data-slide = vị trí; timing.json chỉ có thứ tự). Dấu = băm FNV-1a 32 bit của LỜI
     THOẠI slide (timing.json[].text, chuẩn hoá chữ thường + gộp khoảng trắng). Neo / đoạn V1 nhớ dấu lúc gắn;
     deck đổi (chèn / đổi thứ tự slide) thì khopSlide dời về slide CÙNG dấu — duy nhất mới dời (hai slide cùng lời
     thì giữ chỉ số, như trước). Không động vào tệp deck của người dùng. */
  const DAU = /^[0-9a-f]{8}$/;
  function dauSlide(chu) {
    const t = String(chu || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!t) return '';
    let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i += 1) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }

  /**
   * PHỤ ĐỀ ĐÃ SỬA (Giai đoạn 3, phụ đề tách lớp): `{ an?, captions: [{ start, end, text, words? }] }`
   * — giây trên VIDEO GỐC (trước V1). null = dùng phụ đề của lần "Tạo video" (output/phu-de/).
   * `an` = tắt phụ đề trong bản dựng.
   */
  function phuDeSach(v, loi) {
    if (v == null) return null;
    if (typeof v !== 'object' || (v.captions != null && !Array.isArray(v.captions))) { loi.push('Phụ đề đã sửa sai dạng.'); return null; }
    const caps = Array.isArray(v.captions) ? v.captions : [];
    if (caps.length > 5000) { loi.push('Quá 5000 câu phụ đề.'); return null; }
    const giay = (x) => so(x, 0, TRAN.msToiDa / 1000);
    const ra = [];
    for (const c of caps) {
      /* Câu hỏng (dài 0 giây từ bộ nhận dạng, thiếu chữ…) thì BỎ RIÊNG câu đó, chữ quá dài thì cắt —
         loại cả bộ là dự án không lưu được nữa ngay từ lần sửa phụ đề đầu tiên (audit GĐ3). */
      if (!c || !giay(c.start) || !giay(c.end) || c.end <= c.start || typeof c.text !== 'string' || !c.text.trim()) continue;
      const text = c.text.slice(0, 400);
      const words = Array.isArray(c.words) ? c.words.slice(0, 200)
        .filter((w) => w && typeof w.text === 'string' && w.text.length <= 80 && giay(w.start) && giay(w.end) && w.end >= w.start)
        .map((w) => ({ text: w.text, start: w.start, end: w.end })) : [];
      /* Thiếu `words` (agent / sửa tay chỉ gửi chữ): chia chữ đều trong câu. Không chia thì trang quay
         vẽ chữ trơn mang màu chữ của trang deck, còn bản xem trước mang màu của app — hai bên lệch. */
      if (!words.length) {
        const tu = text.trim().split(/\s+/).filter(Boolean).slice(0, 200);
        const dai = (c.end - c.start) / Math.max(1, tu.length);
        tu.forEach((w, i) => words.push({ text: w.slice(0, 80), start: c.start + i * dai, end: c.start + (i + 1) * dai }));
      }
      ra.push({ start: c.start, end: c.end, text, words });
    }
    ra.sort((a, b) => a.start - b.start);
    // `goc`: băm phude.json của lượt "Tạo video" mà bản sửa này dựa vào — lệch là phụ đề cũ trên video mới.
    return { an: !!v.an, captions: ra, ...(typeof v.goc === 'string' && /^[0-9a-f]{8,64}$/.test(v.goc) ? { goc: v.goc } : {}) };
  }

  /** Điểm đánh dấu trên timeline (phím M) — giây tuyệt đối. */
  function danhDauSach(ds, loi) {
    if (ds == null) return [];
    if (!Array.isArray(ds) || ds.length > TRAN.danhDau) { loi.push('Danh sách điểm đánh dấu sai.'); return []; }
    const co = new Set();
    const ra = [];
    for (const x of ds) {
      if (!x || !ID.test(x.id) || co.has(x.id) || !soNguyen(x.ms, 0, TRAN.msToiDa)) { loi.push('Điểm đánh dấu sai.'); return []; }
      co.add(x.id);
      ra.push({ id: x.id, ms: x.ms, ten: chuoiNgan(x.ten, 80), mau: MAU_DANH_DAU.includes(x.mau) ? x.mau : 'xanh' });
    }
    return ra.sort((a, b) => a.ms - b.ms);
  }

  /**
   * @returns {{ ok: boolean, loi: string[], duAn: object|null }} `duAn` là bản đã
   *   chuẩn hoá (trường lạ bị bỏ) — CHỈ bản này được ghi xuống đĩa.
   */
  function kiem(d) {
    const loi = [];
    if (!d || typeof d !== 'object') return { ok: false, loi: ['Không phải dự án dựng.'], duAn: null };
    if (d.phienBan !== 2 && d.phienBan !== 3) loi.push(`Phiên bản dự án ${d.phienBan} — app này đọc bản 2–${PHIEN_BAN}.`);
    const k = d.khung || {};
    if (!soNguyen(k.rong, 16, 8192) || !soNguyen(k.cao, 16, 8192) || !so(k.fps, 1, 120)) loi.push('Khung hình không hợp lệ.');

    const media = Array.isArray(d.media) ? d.media : [];
    if (media.length > TRAN.media) loi.push(`Quá ${TRAN.media} media.`);
    const idMedia = new Set();
    const mediaSach = media.slice(0, TRAN.media).map((m, i) => {
      if (!m || !ID.test(m.id || '')) { loi.push(`media[${i}]: id sai.`); return null; }
      if (idMedia.has(m.id)) loi.push(`media[${i}]: trùng id ${m.id}.`);
      idMedia.add(m.id);
      if (!LOAI_MEDIA.includes(m.loai)) loi.push(`media ${m.id}: loại "${m.loai}" lạ.`);
      if (!duongMediaHopLe(m.tep)) loi.push(`media ${m.id}: đường tệp phải nằm trong dung/media/.`);
      if (m.loai !== 'anh' && !soNguyen(m.ms, 1, TRAN.msToiDa)) loi.push(`media ${m.id}: thời lượng sai.`);
      return {
        id: m.id, loai: m.loai, tep: m.tep,
        ten: chuoi(m.ten, 255) ? m.ten : String(m.tep || '').split('/').pop().slice(0, 255),
        ms: soNguyen(m.ms, 0, TRAN.msToiDa) ? m.ms : 0,
        rong: soNguyen(m.rong, 0, 16384) ? m.rong : 0,
        cao: soNguyen(m.cao, 0, 16384) ? m.cao : 0,
        fps: so(m.fps, 0, 240) ? m.fps : 0,
        xoay: [0, 90, 180, 270].includes(m.xoay) ? m.xoay : 0,
        coTieng: !!m.coTieng,
        byte: soNguyen(m.byte, 0, Number.MAX_SAFE_INTEGER) ? m.byte : 0,
        // Thông tin luồng (từ ffprobe lúc nhập) — quyết định có cần proxy cho Chromium không.
        codec: chuoiNgan(m.codec, 24), pixFmt: chuoiNgan(m.pixFmt, 24), codecTieng: chuoiNgan(m.codecTieng, 24),
        // Chữ tiêu đề (Giai đoạn 2): ảnh PNG vẽ từ giao diện + thông số để sửa lại.
        ...(m.chu != null ? { chu: chuSach(m.chu, m.id, loi) } : {}),
        // Giọng đọc thành khối (GĐ2.1): chữ + giọng đã dùng — bảng Thuộc tính sửa chữ rồi tạo lại.
        ...(m.loai === 'tieng' && ttsSach(m.tts) ? { tts: ttsSach(m.tts) } : {}),
        // Bộ slide phụ (GĐ3.7): video của deck `bo-slide/<boSlide>/` — "Tạo video" dựng lại rồi thay tệp này.
        ...(m.loai === 'video' && typeof m.boSlide === 'string' && ID_BO.test(m.boSlide) ? { boSlide: m.boSlide } : {}),
        // Lớp phủ có sẵn (đợt 1 hiệu ứng, src/dung/lopPhu.js): xem trước cho cú bấm XUYÊN qua (phủ cả khung).
        ...(m.loai === 'anh' && typeof m.lopPhu === 'string' && /^[a-z-]{1,30}$/.test(m.lopPhu) ? { lopPhu: m.lopPhu } : {}),
      };
    }).filter(Boolean);

    const track = Array.isArray(d.track) ? d.track : [];
    if (!track.length || track.length > TRAN.track) loi.push('Danh sách track sai.');
    const idTrack = new Map();
    const trackSach = track.slice(0, TRAN.track).map((t, i) => {
      if (!t || !ID.test(t.id || '')) { loi.push(`track[${i}]: id sai.`); return null; }
      if (idTrack.has(t.id)) loi.push(`track[${i}]: trùng id ${t.id}.`);
      if (!LOAI_TRACK.includes(t.loai)) loi.push(`track ${t.id}: loại "${t.loai}" lạ.`);
      idTrack.set(t.id, t.loai);
      return {
        id: t.id, loai: t.loai, ten: chuoi(t.ten, 60) ? t.ten : t.id,
        khoa: !!t.khoa, an: !!t.an, tatTieng: !!t.tatTieng,
        amLuong: so(t.amLuong, 0, 4) ? t.amLuong : 1,
        /* Vai trò (GĐ2.1b): track tiếng 'giong' = GIỌNG ĐỌC — KÍCH hạ nhạc và KHÔNG bị hạ (khoangGiongNd). */
        ...(t.loai === 'tieng' && t.vaiTro === 'giong' ? { vaiTro: 'giong' } : {}),
      };
    }).filter(Boolean);

    const khoi = Array.isArray(d.khoi) ? d.khoi : [];
    if (khoi.length > TRAN.khoi) loi.push(`Quá ${TRAN.khoi} khối.`);
    const idKhoi = new Set();
    const khoiSach = khoi.slice(0, TRAN.khoi).map((c, i) => {
      if (!c || !ID.test(c.id || '')) { loi.push(`khoi[${i}]: id sai.`); return null; }
      if (idKhoi.has(c.id)) loi.push(`khoi[${i}]: trùng id ${c.id}.`);
      idKhoi.add(c.id);
      const loaiTrack = idTrack.get(c.track);
      if (!loaiTrack) loi.push(`khối ${c.id}: track "${c.track}" không có.`);
      const m = mediaSach.find((x) => x.id === c.media);
      if (!m) loi.push(`khối ${c.id}: media "${c.media}" không có.`);
      else if (loaiTrack === 'tieng' && m.loai === 'anh') loi.push(`khối ${c.id}: ảnh không đặt được lên track tiếng.`);
      else if (loaiTrack === 'hinh' && m.loai === 'tieng') loi.push(`khối ${c.id}: âm thanh không đặt được lên track hình.`);
      // Video KHÔNG có tiếng đặt lên track tiếng: không có gì để phát, ffmpeg chết ở `[i:a]` (audit 10/10/2026).
      else if (loaiTrack === 'tieng' && m.loai === 'video' && !m.coTieng) loi.push(`khối ${c.id}: video không có tiếng, không đặt lên track tiếng được.`);
      /* `neo` CÓ mà sai thì là LỖI, không lặng lẽ bỏ: bỏ đi là khối nhảy về giây 0
         mà không ai hay. `lechMs` không âm — kéo thả luôn neo vào slide CHỨA điểm
         đầu khối (datChoMs), nên lệch âm chỉ đến từ tệp bị sửa tay. */
      let neo = null;
      if (c.neo != null) {
        if (soNguyen(c.neo.slide, 0, 9999) && soNguyen(c.neo.lechMs, 0, TRAN.msToiDa)) {
          neo = { slide: c.neo.slide, lechMs: c.neo.lechMs, ...(DAU.test(c.neo.dau || '') ? { dau: c.neo.dau } : {}) };
        }
        else loi.push(`khối ${c.id}: neo sai (slide/lệch phải là số nguyên ≥ 0).`);
      }
      if (c.neo == null && !soNguyen(c.batDauMs, 0, TRAN.msToiDa)) loi.push(`khối ${c.id}: thiếu chỗ đặt (neo hoặc batDauMs).`);
      if (!soNguyen(c.vaoMs, 0, TRAN.msToiDa) || !soNguyen(c.raMs, 1, TRAN.msToiDa) || c.raMs <= c.vaoMs) {
        loi.push(`khối ${c.id}: đoạn cắt vào/ra sai.`);
      } else if (m && m.loai !== 'anh' && m.ms && c.raMs > m.ms && !(c.lap && m.loai === 'tieng')) {
        loi.push(`khối ${c.id}: cắt quá độ dài media.`);
      }
      const b = c.bienDoi || {};
      const mo = c.mo || {};
      const kf = kfSach(c.kf, c.id, loi);
      const ct = c.cat || {};
      const cat = { trai: 0, phai: 0, tren: 0, duoi: 0 };
      ['trai', 'phai', 'tren', 'duoi'].forEach((k) => {
        if (ct[k] == null) return;
        if (so(ct[k], 0, 0.9)) cat[k] = ct[k]; else loi.push(`khối ${c.id}: cắt khung "${k}" sai (0–0,9).`);
      });
      if (cat.trai + cat.phai > 0.95 || cat.tren + cat.duoi > 0.95) loi.push(`khối ${c.id}: cắt khung hết cả hình.`);
      const lat = c.lat || {};
      return {
        id: c.id, track: c.track, media: c.media, neo,
        batDauMs: neo ? 0 : c.batDauMs,
        vaoMs: c.vaoMs, raMs: c.raMs,
        tocDo: so(c.tocDo, 0.25, 4) ? c.tocDo : 1,
        bienDoi: {
          x: so(b.x, -2, 3) ? b.x : 0.5, y: so(b.y, -2, 3) ? b.y : 0.5,
          co: so(b.co, 0.01, 10) ? b.co : 1, xoay: so(b.xoay, -3600, 3600) ? b.xoay : 0,
          mo: so(b.mo, 0, 1) ? b.mo : 1,
        },
        amLuong: so(c.amLuong, 0, 4) ? c.amLuong : 1,
        mo: {
          vaoMs: soNguyen(mo.vaoMs, 0, 60000) ? mo.vaoMs : 0, raMs: soNguyen(mo.raMs, 0, 60000) ? mo.raMs : 0,
          kieuVao: KIEU_CHUYEN.includes(mo.kieuVao) ? mo.kieuVao : 'mo',
          kieuRa: KIEU_CHUYEN.includes(mo.kieuRa) ? mo.kieuRa : 'mo',
          // Hoà vào khối LIỀN TRƯỚC trên cùng track: khối trước kéo dài dưới chuyển cảnh (keoDaiMs).
          noi: !!mo.noi,
        },
        kf, cat, lat: { ngang: !!lat.ngang, doc: !!lat.doc },
        /* LẶP (GĐ2.2): chỉ tệp âm thanh — vào/ra tính trên trục nguồn ĐÃ LẶP (ra được quá m.ms), vị trí trong
           tệp = (giây nguồn) mod m.ms. Xuất: aloop (xuat.js); xem trước: <audio loop> (dung-xem.js). */
        ...(c.lap && m && m.loai === 'tieng' ? { lap: true } : {}),
        /* HIỆU ỨNG CHUYỂN ĐỘNG (GĐ2.3): chỉ khối HÌNH. Phóng / thu chậm (Ken Burns), trôi nhẹ 4 hướng — cùng
           đường biểu thức kép với keyframe + chuyển cảnh (hieuUngKhoi), xem trước và xuất không lệch. */
        ...(loaiTrack === 'hinh' && m && m.loai !== 'tieng' && c.hieuUng && HIEU_UNG.includes(c.hieuUng.kieu)
          ? { hieuUng: huSach(c.hieuUng) } : {}),
        // Chỉnh màu (GĐ2.4): chỉ khối hình.
        ...(loaiTrack === 'hinh' && m && m.loai !== 'tieng' && mauSach(c.mau) ? { mau: mauSach(c.mau) } : {}),
        // Ô GIỮ CHỖ của mẫu dựng video (23/10/2026): khối mang media DEMO, người dùng thay bằng ảnh / video của mình.
        ...(loaiTrack === 'hinh' && m && m.loai !== 'tieng' && oChoSach(c.oCho) ? { oCho: oChoSach(c.oCho) } : {}),
      };
    }).filter(Boolean);

    const g = d.goc || {};
    const ag = d.amGoc || {};
    const duAn = {
      // 3 chỉ khi có bộ slide phụ (xem PHIEN_BAN) — gán lại cuối hàm theo media đã lọc.
      phienBan: 2,
      khung: { rong: k.rong, cao: k.cao, fps: k.fps },
      goc: { video: typeof g.video === 'string' ? g.video.slice(0, 300) : '' },
      amGoc: {
        giong: so(ag.giong, 0, 4) ? ag.giong : 1, deck: so(ag.deck, 0, 4) ? ag.deck : 1,
        tatGiong: !!ag.tatGiong, tatDeck: !!ag.tatDeck,
        haNhac: {
          bat: !!(ag.haNhac && ag.haNhac.bat),
          mucDb: ag.haNhac && soNguyen(ag.haNhac.mucDb, 3, 30) ? ag.haNhac.mucDb : 12,
        },
      },
      xuat: {
        khung: d.xuat && Object.prototype.hasOwnProperty.call(KHUNG_XUAT, d.xuat.khung) ? d.xuat.khung : 'goc',
        nen: d.xuat && d.xuat.nen === 'den' ? 'den' : 'mo',
        // Màu CẢ VIDEO (lớp hiệu chỉnh, GĐ2.4): áp lên hình đã ghép, TRƯỚC lớp phụ đề.
        ...(d.xuat && mauSach(d.xuat.mau) ? { mau: mauSach(d.xuat.mau) } : {}),
      },
      media: mediaSach, track: trackSach, khoi: khoiSach,
      danhDau: danhDauSach(d.danhDau, loi),
      slide: slideSach(d.slide, loi),
      phuDe: phuDeSach(d.phuDe, loi),
    };
    if (duAn.media.some((m) => m.boSlide)) duAn.phienBan = 3;
    return { ok: loi.length === 0, loi, duAn: loi.length ? null : duAn };
  }

  /* ── thời gian ─────────────────────────────────────────────────────────
     `moc` = mốc từng slide theo trục video, MILI-GIÂY: [{ tuMs, denMs }] —
     dựng từ `timing.json` bằng `mocTuTiming`. */

  /** `timing.json` (mảng { duration giây, text }) → [{ tuMs, denMs, dau? }]. Cộng dồn bằng số nguyên. */
  function mocTuTiming(ds) {
    const ra = [];
    let t = 0;
    (Array.isArray(ds) ? ds : []).forEach((x) => {
      const d = Math.max(0, Math.round((Number(x && x.duration) || 0) * 1000));
      const dau = dauSlide(x && x.text);
      ra.push({ tuMs: t, denMs: t + d, ...(dau ? { dau } : {}) });
      t += d;
    });
    return ra;
  }

  /**
   * ĐUÔI video slide (sau slide cuối — pipeline để hết câu cuối, đo ~0,5 s) thuộc về slide CUỐI. timing.json chỉ có
   * thời lượng từng slide nên mốc cuối hụt đuôi đó: khối slide ở giây 0 chưa sửa V1 thì không sao (cả video chạy),
   * nhưng hễ có đoạn V1 — dời khối slide (GĐ3.3) hay cắt / đổi chỗ — là đuôi bị CẮT (câu cuối mất vài trăm ms).
   * Hụt quá `DUOI_TOI_DA_MS` thì coi là mốc không khớp video, giữ nguyên (đã có cảnh báo mocLech riêng).
   */
  const DUOI_TOI_DA_MS = 5000;
  function keoDuoiMoc(moc, msVideo) {
    if (!Array.isArray(moc) || !moc.length) return moc;
    const cuoi = moc[moc.length - 1];
    const ms = Math.round(Number(msVideo) || 0);
    if (!(ms > cuoi.denMs) || ms - cuoi.denMs > DUOI_TOI_DA_MS) return moc;
    return [...moc.slice(0, -1), { ...cuoi, denMs: ms }];
  }

  /**
   * Khớp lại neo + đoạn V1 theo DẤU slide (L3). Neo / đoạn có `dau` mà slide ở chỉ số cũ mang dấu KHÁC ⇒ tìm slide
   * mang đúng dấu đó; đúng MỘT slide thì dời sang. Thiếu dấu (tệp cũ, timing.json không có lời) ⇒ giữ nguyên.
   * @returns {{ duAn: object, doi: number }} `doi` = số chỗ đã dời (0 ⇒ trả CHÍNH `d`)
   */
  function khopSlide(d, mocGoc) {
    if (!d || !Array.isArray(mocGoc) || !mocGoc.some((x) => x.dau)) return { duAn: d, doi: 0 };
    const theoDau = new Map();
    mocGoc.forEach((x, i) => { if (x.dau) theoDau.set(x.dau, theoDau.has(x.dau) ? -1 : i); });
    let doi = 0;
    const tim = (slide, dau) => {
      if (!dau || (mocGoc[slide] && mocGoc[slide].dau === dau)) return slide;
      const i = theoDau.get(dau);
      if (i == null || i < 0) return slide;
      doi += 1;
      return i;
    };
    const khoi = (d.khoi || []).map((c) => {
      if (!c.neo || !c.neo.dau) return c;
      const sl = tim(c.neo.slide, c.neo.dau);
      return sl === c.neo.slide ? c : { ...c, neo: { ...c.neo, slide: sl } };
    });
    let slide = d.slide;
    if (slide && slide.doan) {
      const doan = slide.doan.map((x) => { const sl = tim(x.slide, x.dau); return sl === x.slide ? x : { ...x, slide: sl }; });
      slide = { ...slide, doan };
    }
    return doi ? { duAn: { ...d, khoi, slide }, doi } : { duAn: d, doi: 0 };
  }

  /**
   * Nâng tệp v1 → v2 (GĐ3.1) TRƯỚC khi kiem (kho.docDuAn — cả các bản .bak). Deck: khối slide ở giây 0 mang V1
   * cũ; neo / đoạn được gắn dấu theo timing.json HIỆN TẠI (tệp v1 viết theo đúng deck đó). Dự án video trống:
   * không có khối slide; neo vào "slide 0" giả (nền đen) ⇒ giờ tuyệt đối.
   * @param {{ laVideo?: boolean, mocGoc?: Array }} o
   */
  function nangCap(j, o = {}) {
    if (!j || typeof j !== 'object' || j.phienBan !== 1) return j;
    const moc = Array.isArray(o.mocGoc) ? o.mocGoc : [];
    const dauCua = (i) => (moc[i] && moc[i].dau ? { dau: moc[i].dau } : {});
    const { v1, ...con } = j;
    const khoi = Array.isArray(j.khoi) ? j.khoi.map((c) => {
      if (!c || !c.neo) return c;
      if (o.laVideo) return { ...c, neo: null, batDauMs: Math.max(0, Number(c.neo.lechMs) || 0) };
      return { ...c, neo: { ...c.neo, ...dauCua(c.neo.slide) } };
    }) : j.khoi;
    const doan = v1 && Array.isArray(v1.doan) && v1.doan.length ? v1.doan.map((x) => ({ ...x, ...dauCua(x && x.slide) })) : null;
    return {
      ...con, phienBan: 2, khoi,
      goc: { video: (j.goc && j.goc.video) || '' },
      slide: o.laVideo ? null : { batDauMs: 0, doan },
    };
  }

  /** Độ dài khối trên timeline (đã tính tốc độ). */
  const doDaiMs = (c) => Math.max(1, Math.round((c.raMs - c.vaoMs) / (c.tocDo || 1)));

  /**
   * Giây BẮT ĐẦU thật của khối (ms). Neo vào slide không còn (deck bớt slide) thì
   * bám slide cuối — không đánh rơi khối của người dùng; `lechNeo` báo cho giao diện.
   */
  function batDauMs(c, moc) {
    if (!c.neo) return c.batDauMs;
    // Chưa có mốc: neo slide 0 = đầu khối slide (`batDau` mang theo cả khi mảng rỗng — mocDich, rà GĐ3).
    if (!moc || !moc.length) return Math.max(0, ((moc && moc.batDau) || 0) + c.neo.lechMs);
    const s = moc[Math.min(c.neo.slide, moc.length - 1)];
    const p = Math.max(0, s.tuMs + c.neo.lechMs);
    // V1 đã sửa: giây trên VIDEO GỐC → giây trên timeline (khối gắn slide đi theo slide).
    return moc.anXa ? moc.anXa(p, c.neo.slide) : p;
  }
  const ketThucMs = (c, moc) => batDauMs(c, moc) + doDaiMs(c);
  const lechNeo = (c, moc) => !!(c.neo && moc && moc.length
    && (c.neo.slide >= moc.length || (moc.boSlide && moc.boSlide.has(c.neo.slide))));

  /**
   * MỐC ĐÃ SỬA V1 (Giai đoạn 3). Trả CHÍNH mảng mốc gốc (giây trên video gốc, theo slide) kèm:
   *   · doan:  [{ slide, nguonTu, nguonDen, dichTu, dichDen }] theo thứ tự timeline;
   *   · anXa(msGoc, slide?) → ms trên timeline; giây rơi vào đoạn đã CẮT BỎ ⇒ đầu đoạn kế tiếp
   *     của CÙNG slide (hết thì cuối đoạn cuối của slide); slide bị bỏ hẳn ⇒ chỗ slide kề sau;
   *   · nguoc(msTimeline) → ms trên video gốc (cho kéo thả / tua);
   *   · tongDich, boSlide (Set slide bị bỏ hẳn).
   * Mọi hàm thời gian (batDauMs, datChoMs, tongMs) đọc các trường này — chỗ gọi không phải đổi.
   * v1 null ⇒ trả nguyên mảng mốc gốc (không ánh xạ gì).
   */
  function mocDich(mocGoc, v1, fps) {
    /* `v1` = KHỐI SLIDE (GĐ3.1: { batDauMs, doan }) — vẫn nhận dạng cũ { doan }. Khối slide dời khỏi giây 0 mà V1
       chưa sửa ⇒ mỗi slide một đoạn nguyên, bắt đầu ở batDauMs: mọi chỗ đọc đoạn (vẽ V1, cắt hình/tiếng khi xuất,
       phụ đề, hạ nhạc, neo) tự theo khối slide. Giây 0 + chưa sửa ⇒ mảng mốc gốc (đường nhanh như trước). */
    /* Ranh giới đoạn đặt lên LƯỚI KHUNG của video slide: bản xuất cắt hình theo khung, mỗi đoạn
       lệch tới gần một khung — 8 đoạn lệch 186 ms giữa hình và tiếng (audit GĐ3). Xem trước và
       bản xuất cùng dùng số đã làm tròn này. Đầu khối slide cũng vậy: tpad đệm NGUYÊN khung còn adelay theo ms —
       1234 ms ở 30 fps là hình lệch tiếng gần một khung (rà GĐ3). */
    const F = fps > 0 ? 1000 / fps : 0;
    // Nhân trước chia sau: 30 khung × (1000/30) ra 1000,0000000000001 — số lẻ phẩy động làm hỏng phép so liền mảnh.
    const luoi = (ms) => (F ? (Math.round((ms * fps) / 1000) * 1000) / fps : ms);
    const B = v1 && soNguyen(v1.batDauMs, 0, TRAN.msToiDa) ? luoi(v1.batDauMs) : 0;
    /* Chưa có mốc (deck vừa thêm bộ slide / chưa dựng) mà khối slide đã dời: mảng rỗng MANG `batDau` — neo slide 0 vẫn
       tính từ đầu khối slide (batDauMs / datChoMs), dựng xong khối không nhảy thêm B giây (rà GĐ3). */
    if (!mocGoc || !mocGoc.length) return B > 0 ? Object.assign([], { batDau: B }) : mocGoc;
    const dsDoan = v1 && v1.doan && v1.doan.length ? v1.doan
      : (B > 0 ? mocGoc.map((s, i) => ({ slide: i, vaoMs: 0, raMs: Math.max(1, s.denMs - s.tuMs) })) : null);
    if (!dsDoan) return mocGoc;
    const moc = mocGoc.map((x) => ({ ...x }));
    const doan = [];
    let t = B;
    dsDoan.forEach((x) => {
      const s = mocGoc[x.slide];
      if (!s) return;
      const nguonTu = luoi(Math.min(s.denMs, s.tuMs + x.vaoMs));
      const nguonDen = luoi(Math.min(s.denMs, s.tuMs + x.raMs));
      if (nguonDen - nguonTu < 1) return;
      doan.push({ slide: x.slide, nguonTu, nguonDen, dichTu: t, dichDen: t + (nguonDen - nguonTu) });
      t += nguonDen - nguonTu;
    });
    const tongDich = t;
    const coSlide = new Set(doan.map((x) => x.slide));
    // Slide dài 0 (timing.json) không có đoạn nào — không phải "bị bỏ" (khỏi cảnh báo neo mất slide oan — rà GĐ3).
    const boSlide = new Set(mocGoc.map((_, i) => i).filter((i) => !coSlide.has(i) && mocGoc[i].denMs - mocGoc[i].tuMs >= 1));
    function anXa(p, slide) {
      const d = doan.find((x) => p >= x.nguonTu && p < x.nguonDen);
      if (d) return d.dichTu + (p - d.nguonTu);
      const sl = slide != null ? slide : mocGoc.findIndex((x) => p >= x.tuMs && p < x.denMs);
      const cung = doan.filter((x) => x.slide === sl);
      if (cung.length) {
        const sau = cung.filter((x) => x.nguonTu >= p).sort((a, b) => a.nguonTu - b.nguonTu)[0];
        if (sau) return sau.dichTu;
        return Math.max(...cung.map((x) => x.dichDen));
      }
      // Slide bị bỏ hẳn: tới chỗ slide kề sau (theo thứ tự gốc) còn giữ lại; không còn ⇒ cuối timeline.
      const ke = doan.filter((x) => x.slide > sl).sort((a, b) => a.slide - b.slide || a.nguonTu - b.nguonTu)[0];
      return ke ? ke.dichTu : tongDich;
    }
    function nguoc(tt) {
      const d = doan.find((x) => tt >= x.dichTu && tt < x.dichDen);
      if (d) return d.nguonTu + (tt - d.dichTu);
      // Trước khối slide (GĐ3.1): đầu đoạn đầu — nơi gọi kiểm `batDau` để biết là "chưa tới video".
      if (doan.length && tt < B) return doan[0].nguonTu;
      const cuoi = doan[doan.length - 1];
      return cuoi ? cuoi.nguonDen + Math.max(0, tt - tongDich) : tt;
    }
    return Object.assign(moc, { doan, anXa, nguoc, tongDich, boSlide, batDau: B });
  }

  /**
   * Chiếu một khoảng giây GỐC [tuMs, denMs) lên timeline đã sửa V1 → các mảnh [{ tuMs, denMs, lechMs }]
   * theo thứ tự timeline (lechMs = giây gốc − giây timeline). Không có V1 ⇒ nguyên khoảng.
   * Dùng cho: phụ đề / sóng âm trên timeline, đoạn có giọng (hạ nhạc) trong bản xuất.
   */
  function chieuKhoang(moc, tuMs, denMs) {
    if (!moc || !moc.doan) return [{ tuMs, denMs, lechMs: 0 }];
    const ra = [];
    moc.doan.forEach((x) => {
      const a = Math.max(tuMs, x.nguonTu);
      const b = Math.min(denMs, x.nguonDen);
      if (b > a) ra.push({ tuMs: x.dichTu + (a - x.nguonTu), denMs: x.dichTu + (b - x.nguonTu), lechMs: x.nguonTu - x.dichTu });
    });
    ra.sort((p1, p2) => p1.tuMs - p2.tuMs);
    /* GỘP mảnh LIỀN NHAU cả hai trục (cùng lệch, mảnh sau bắt đầu đúng chỗ mảnh trước hết): hai slide kề nhau còn
       nguyên thứ tự — vd khối slide chỉ DỜI (GĐ3.3, mỗi slide một đoạn) — là MỘT khoảng liền. Không gộp thì câu phụ
       đề vắt qua ranh giới slide bị xé đôi (mỗi nửa chỉ còn chữ của nó), sóng/nhãn nhạc lặp theo từng slide. */
    const gop = [];
    ra.forEach((x) => {
      const t = gop[gop.length - 1];
      if (t && Math.abs(t.denMs - x.tuMs) < 0.5 && Math.abs(t.lechMs - x.lechMs) < 0.5) t.denMs = x.denMs;
      else gop.push({ ...x });
    });
    return gop;
  }

  /**
   * Phụ đề (giây GỐC) → trục timeline đã sửa V1: mỗi câu cắt theo các đoạn giữ lại, chữ ngoài đoạn
   * bị bỏ. Không có V1 ⇒ nguyên. MỘT hàm cho xem trước (dung-xem.js) và bản xuất (xuat.js).
   */
  function chieuPhuDe(caps, moc) {
    if (!moc || !moc.doan) return caps;
    const ra = [];
    caps.forEach((c) => {
      chieuKhoang(moc, c.start * 1000, c.end * 1000).forEach((p) => {
        const lech = p.lechMs / 1000;
        const words = (c.words || []).filter((w) => w.end * 1000 > p.tuMs + p.lechMs && w.start * 1000 < p.denMs + p.lechMs)
          .map((w) => ({ text: w.text, start: Math.max(p.tuMs / 1000, w.start - lech), end: Math.min(p.denMs / 1000, w.end - lech) }));
        ra.push({ text: words.length ? words.map((w) => w.text).join(' ') : c.text, start: p.tuMs / 1000, end: p.denMs / 1000,
          ...(words.length ? { words } : {}) });
      });
    });
    return ra.sort((a, b) => a.start - b.start);
  }

  /** Đặt khối vào giây `ms` — giữ kiểu neo hiện có (neo thì neo vào slide CHỨA giây đó). */
  function datChoMs(c, ms, moc) {
    const t = Math.max(0, Math.round(ms));
    if (!c.neo) return { ...c, batDauMs: t, neo: null };
    /* Chưa có mốc (deck chưa dựng / đã dọn output): không biết slide nào ở đâu, nên neo
       vào slide 0 với lệch = giây tuyệt đối — dựng xong thì khối ĐÚNG giây người dùng
       đã kéo tới. Giữ slide cũ mà ghi giây tuyệt đối vào `lechMs` là khối nhảy đi
       (đầu slide cũ + giây) sau lần dựng lại (audit 10/10/2026). */
    if (!moc || !moc.length) {
      // Khối slide đã dời (mảng rỗng mang `batDau` — mocDich): trước nó là giờ tuyệt đối, sau nó lệch tính từ nó.
      const B0 = (moc && moc.batDau) || 0;
      if (t < B0) return { ...c, neo: null, batDauMs: t };
      // B0 nằm trên lưới khung (có thể lẻ phẩy) — lechMs phải là số nguyên (kiem).
      return { ...c, neo: { slide: 0, lechMs: Math.round(t - B0) }, batDauMs: 0 };
    }
    // Đặt TRƯỚC khối slide (đã dời khỏi giây 0): không thuộc slide nào ⇒ giờ tuyệt đối (GĐ3.1).
    if (moc.batDau > 0 && t < moc.batDau) return { ...c, neo: null, batDauMs: t };
    // V1 đã sửa: giây timeline → giây video gốc, rồi neo vào slide chứa giây đó.
    const p = moc.nguoc ? Math.round(moc.nguoc(t)) : t;
    let i = moc.findIndex((s) => p < s.denMs);
    if (i < 0) i = moc.length - 1;
    // Mang DẤU slide (L3) — deck đổi thứ tự slide sau này thì khopSlide tìm lại đúng slide.
    const neo = { slide: i, lechMs: Math.max(0, Math.round(p - moc[i].tuMs)), ...(moc[i].dau ? { dau: moc[i].dau } : {}) };
    /* V1 đã sửa: neo phải đưa khối về ĐÚNG giây vừa đặt. Không được — sau cuối timeline khi đã
       đổi thứ tự slide, bản lặp thứ hai của một slide — thì đặt theo giây tuyệt đối, kẻo khối
       (outro của mẫu…) nhảy về đầu video (audit GĐ3). */
    if (moc.anXa && Math.abs(batDauMs({ ...c, neo }, moc) - t) > 1) return { ...c, neo: null, batDauMs: t };
    return { ...c, neo, batDauMs: 0 };
  }

  /**
   * Độ dài TIMELINE HIỆN của dự án video trống (GĐ3.4 — thay nền đen giả): ≥ 30 s, luôn chừa ≥ 20 s sau khối cuối
   * để còn chỗ thả, giãn theo bậc 30 s (thước không nhảy mỗi lần kéo khối). Bản xuất vẫn cắt đúng tới khối cuối.
   */
  const doDaiChoTha = (msNoiDung) => Math.max(30000, Math.ceil((Math.max(0, msNoiDung) + 20000) / 30000) * 30000);

  /** Tổng độ dài dự án: max(video gốc, khối xa nhất). */
  function tongMs(d, moc, msGoc) {
    // V1 đã sửa: video nền dài đúng tổng các đoạn giữ lại, không phải độ dài video gốc.
    let t = moc && moc.tongDich != null ? moc.tongDich
      : Math.max(0, msGoc || 0, moc && moc.length ? moc[moc.length - 1].denMs : 0)
        // Chưa có mốc mà khối slide đã dời (mảng rỗng mang `batDau`): video slide bị đẩy lùi đúng B — đừng cắt đuôi nó.
        + (moc && !moc.length && moc.batDau > 0 ? moc.batDau : 0);
    (d.khoi || []).forEach((c) => { t = Math.max(t, ketThucMs(c, moc)); });
    return t;
  }

  /** Khối đang hiện ở giây `ms` trên một track (thứ tự trong mảng = thứ tự chồng). */
  function khoiTai(d, trackId, ms, moc) {
    return (d.khoi || []).filter((c) => c.track === trackId && ms >= batDauMs(c, moc) && ms < ketThucMs(c, moc));
  }

  /**
   * HÌNH HỌC của một khối hình trong khung — MỘT hàm cho cả xem trước (CSS) lẫn bản
   * xuất (ffmpeg), để hai bên không lệch nhau vì toán.
   *
   *   · Cỡ gốc = media đặt VỪA khung (kiểu "contain"), theo hướng HIỂN THỊ (rong/cao
   *     đã tính xoay EXIF / display matrix lúc nhập).
   *   · `co` nhân lên cỡ gốc; `x`,`y` là TÂM khối theo tỉ lệ khung (0–1).
   *   · `xoay` quanh tâm (độ, chiều kim đồng hồ); `mo` độ đục 0–1.
   * Cỡ làm tròn về số CHẴN (libx264 4:2:0 đòi chẵn) — xem trước dùng đúng số đó.
   * @returns {{ w: number, h: number, cx: number, cy: number, trai: number, tren: number, xoay: number, mo: number }}
   */
  /** Ảnh chữ tiêu đề vẽ cho khung có cạnh dài CHU_KHUNG điểm ảnh (renderer, chu-tieu-de.js). */
  const CHU_KHUNG = 1920;
  /**
   * Cỡ gốc (co = 1) của media trong khung: phần CÒN LẠI sau cắt khung (mw × mh) nhân `s0`.
   *   · media thường: VỪA khung ("contain") — như Premiere "Scale to frame size";
   *   · chữ tiêu đề: CỠ TỰ NHIÊN (ảnh vẽ cho khung CHU_KHUNG) — sửa chữ dài ra không làm
   *     cỡ chữ co lại như khi "vừa khung".
   * Bản xuất dùng CHÍNH hàm này (xuat.js) — xem trước và bản xuất cùng một cỡ.
   */
  function coGoc(media, khung, cat) {
    const ct = cat || {};
    const mw = Math.max(1, (media.rong || khung.rong) * (1 - (ct.trai || 0) - (ct.phai || 0)));
    const mh = Math.max(1, (media.cao || khung.cao) * (1 - (ct.tren || 0) - (ct.duoi || 0)));
    /* LỚP PHỦ có sẵn (đợt 1 hiệu ứng): KÉO GIÃN phủ kín khung — PNG vẽ theo khổ lúc thêm (và có thể nhỏ hơn khung), đổi
       khổ xuất sau đó (9:16 → 16:9) thì "vừa khung" để lộ hai dải trống (rà soát đợt 1). Viền tối / vệt sáng / dải tối
       giãn nhẹ không ai thấy. Cỡ = cỡ khung × phần còn lại sau cắt; s0 = 1. */
    if (media.lopPhu) {
      return { mw: khung.rong * (1 - (ct.trai || 0) - (ct.phai || 0)), mh: khung.cao * (1 - (ct.tren || 0) - (ct.duoi || 0)), s0: 1 };
    }
    const s0 = media.chu ? Math.max(khung.rong, khung.cao) / CHU_KHUNG : Math.min(khung.rong / mw, khung.cao / mh);
    return { mw, mh, s0 };
  }

  function hopKhoi(media, bienDoi, khung, cat) {
    const b = bienDoi || {};
    // Cắt khung: cỡ gốc tính trên phần CÒN LẠI sau khi cắt (như Crop của Premiere + "vừa khung").
    const { mw, mh, s0 } = coGoc(media, khung, cat);
    const chan = (v) => Math.max(2, Math.round(v / 2) * 2);
    const w = chan(mw * s0 * (b.co || 1));
    const h = chan(mh * s0 * (b.co || 1));
    const cx = Math.round((b.x == null ? 0.5 : b.x) * khung.rong);
    const cy = Math.round((b.y == null ? 0.5 : b.y) * khung.cao);
    return { w, h, cx, cy, trai: cx - w / 2, tren: cy - h / 2, xoay: b.xoay || 0, mo: b.mo == null ? 1 : b.mo };
  }

  /**
   * Độ đục / âm lượng của khối tại giây `ms` (đã trừ đầu khối) — tính mờ vào/ra.
   * Dùng chung cho xem trước; bản xuất dùng bộ lọc fade/afade cùng tham số.
   */
  function heSoMo(c, msTrongKhoi) {
    const d = doDaiMs(c);
    const mv = Math.min(c.mo ? c.mo.vaoMs : 0, d);
    const mr = Math.min(c.mo ? c.mo.raMs : 0, d);
    let k = 1;
    if (mv > 0 && msTrongKhoi < mv) k = Math.min(k, Math.max(0, msTrongKhoi / mv));
    if (mr > 0 && msTrongKhoi > d - mr) k = Math.min(k, Math.max(0, (d - msTrongKhoi) / mr));
    return k;
  }

  /* ── Giai đoạn 2: giá trị theo thời gian ──────────────────────────────────
     MỌI đường cong (keyframe, chuyển cảnh, hạ nhạc) dựng bằng "biểu thức kép":
     `{ f(ms) → số, s(T) → chuỗi biểu thức ffmpeg }` với `T` là BIẾN GIÂY (vd 't' hay
     '(t-1.5)'). Xem trước gọi `.f`, bản xuất gọi `.s` — cùng một cây, nên hai bên
     không thể lệch nhau vì toán (bộ thử còn tính thử `.s` để so với `.f`). */
  const sx = (v) => {
    const n = Number(Number(v).toFixed(5));
    return n < 0 ? `(${n})` : String(n);
  };
  const kep01 = (v) => Math.max(0, Math.min(1, v));
  const bt = {
    hang: (v) => ({ f: () => v, s: () => sx(v), hang: true, v }),
    cong: (a, b) => (a.hang && b.hang ? bt.hang(a.v + b.v)
      : a.hang && a.v === 0 ? b : b.hang && b.v === 0 ? a
        : { f: (ms) => a.f(ms) + b.f(ms), s: (T) => `(${a.s(T)}+${b.s(T)})` }),
    nhan: (a, b) => (a.hang && b.hang ? bt.hang(a.v * b.v)
      : a.hang && a.v === 1 ? b : b.hang && b.v === 1 ? a
        : { f: (ms) => a.f(ms) * b.f(ms), s: (T) => `(${a.s(T)}*${b.s(T)})` }),
  };

  /** Giá trị keyframe tại `ms` (tính từ đầu khối). Không có keyframe → null. */
  function giaTriKf(ds, ms) {
    if (!ds || !ds.length) return null;
    if (ms <= ds[0].t) return ds[0].v;
    for (let i = 0; i < ds.length - 1; i += 1) {
      const a = ds[i];
      const b = ds[i + 1];
      if (ms < b.t) {
        let p = (ms - a.t) / (b.t - a.t);
        if (a.muot) p = p * p * (3 - 2 * p);
        return a.v + (b.v - a.v) * p;
      }
    }
    return ds[ds.length - 1].v;
  }

  /** Biểu thức kép của một thuộc tính có keyframe (không có thì hằng `macDinh`). */
  function btKf(ds, macDinh) {
    if (!ds || !ds.length) return bt.hang(macDinh);
    if (ds.length === 1) return bt.hang(ds[0].v);
    return {
      f: (ms) => giaTriKf(ds, ms),
      /* Cây `if` CÂN BẰNG (sâu ~log₂ n): bộ phân tích biểu thức của ffmpeg có trần lồng ~100 —
         chuỗi `if` nối tiếp chết ở ~92 keyframe dù kiem cho 100 (audit GĐ2). */
      s: (T) => {
        const n = ds.length;
        const doan = (i) => {
          const a = ds[i];
          const b = ds[i + 1];
          const p = `((${T}-${sx(a.t / 1000)})/${sx((b.t - a.t) / 1000)})`;
          const pe = a.muot ? `(${p}*${p}*(3-2*${p}))` : p;
          return `${sx(a.v)}+${sx(b.v - a.v)}*${pe}`;
        };
        // Khoảng keyframe [i, j): T nằm giữa ds[i].t và ds[j].t.
        const cay = (i, j) => {
          if (j === i + 1) return doan(i);
          const g = (i + j) >> 1;
          return `if(lt(${T},${sx(ds[g].t / 1000)}),${cay(i, g)},${cay(g, j)})`;
        };
        return `if(lt(${T},${sx(ds[0].t / 1000)}),${sx(ds[0].v)},if(lt(${T},${sx(ds[n - 1].t / 1000)}),${cay(0, n - 1)},${sx(ds[n - 1].v)}))`;
      },
    };
  }

  /** Biến đổi tại `ms` trong khối: bienDoi tĩnh, thuộc tính nào có keyframe thì lấy keyframe. */
  function bienDoiTai(c, ms) {
    const b = { x: 0.5, y: 0.5, co: 1, xoay: 0, mo: 1, ...(c.bienDoi || {}) };
    const kf = c.kf || {};
    ['x', 'y', 'co', 'xoay', 'mo'].forEach((k) => { if (kf[k] && kf[k].length) b[k] = giaTriKf(kf[k], ms); });
    return b;
  }
  /** Âm lượng của khối tại `ms` (keyframe âm lượng nếu có). */
  const amLuongTai = (c, ms) => (c.kf && c.kf.amLuong && c.kf.amLuong.length ? giaTriKf(c.kf.amLuong, ms) : c.amLuong);

  /**
   * Khối nào đang được KÉO DÀI dưới chuyển cảnh của khối liền sau (mo.noi): Map id → ms.
   * Khối B có `mo.noi` + mờ vào > 0, khối A cùng track kết thúc ĐÚNG lúc B bắt đầu (lệch
   * ≤ 1 khung 30 fps) ⇒ A hiện thêm `mo.vaoMs` của B (hình A đứng dưới, B hiện dần lên =
   * hoà trộn như Cross Dissolve). Chỉ HÌNH kéo dài; tiếng của A không đổi.
   */
  function keoDaiMs(d, moc) {
    const ra = new Map();
    const theoTrack = new Map();
    (d.khoi || []).forEach((c) => {
      if (!theoTrack.has(c.track)) theoTrack.set(c.track, []);
      theoTrack.get(c.track).push({ c, a: batDauMs(c, moc), b: ketThucMs(c, moc) });
    });
    theoTrack.forEach((ds) => {
      ds.sort((x, y) => x.a - y.a);
      for (let i = 1; i < ds.length; i += 1) {
        const B = ds[i].c;
        if (!B.mo || !B.mo.noi || !(B.mo.vaoMs > 0)) continue;
        const A = ds[i - 1];
        if (Math.abs(A.b - ds[i].a) > 34) continue;
        ra.set(A.c.id, Math.min(B.mo.vaoMs, doDaiMs(B)));
      }
    });
    return ra;
  }

  /**
   * Chuyển cảnh vào/ra dưới dạng biểu thức kép theo giây TRONG khối:
   *   dx, dy (điểm ảnh khung) — trượt; heCo — hệ số cỡ (phóng); heMo(ms) — độ đục (mờ, phóng).
   * `o.dai` = độ dài HIỆN (đã cộng kéo dài), `o.boRa` = bỏ chuyển cảnh ra (đang bị khối
   * sau hoà đè). Trượt/phóng êm kiểu "ease-out" (bậc ba); mờ tuyến tính như bộ lọc fade.
   */
  function chuyenCanh(c, khung, o) {
    const x = o || {};
    const dai = x.dai || doDaiMs(c);
    const mv = Math.min(c.mo ? c.mo.vaoMs : 0, dai);
    const mr = x.boRa ? 0 : Math.min(c.mo ? c.mo.raMs : 0, dai);
    const kv = (c.mo && c.mo.kieuVao) || 'mo';
    const kr = (c.mo && c.mo.kieuRa) || 'mo';
    let dx = bt.hang(0);
    let dy = bt.hang(0);
    let heCo = bt.hang(1);
    let xoay = bt.hang(0);
    let coMax = 1;
    // (1-p)^3 với p = tiến độ vào (0→1) hoặc còn lại tới cuối (1→0).
    const conVao = mv > 0 && {
      f: (ms) => (1 - kep01(ms / mv)) ** 3,
      s: (T) => `pow(1-clip(${T}/${sx(mv / 1000)},0,1),3)`,
    };
    const conRa = mr > 0 && {
      f: (ms) => (1 - kep01((dai - ms) / mr)) ** 3,
      s: (T) => `pow(1-clip((${sx(dai / 1000)}-${T})/${sx(mr / 1000)},0,1),3)`,
    };
    /* Trượt: VÀO "từ trái" = xuất phát bên trái; RA "sang trái" = đi về bên trái — cùng một
       dấu. Dọc thì gọi theo HƯỚNG ĐI: vào "từ dưới lên" xuất phát bên dưới (+), ra "lên trên"
       đi lên (−) — dấu đảo khi ra (audit GĐ2: ra "lên trên" từng đi xuống). */
    const ap = (kieu, con, laRa) => {
      if (!con) return;
      const doc = laRa ? -1 : 1;
      if (kieu === 'truot-trai') dx = bt.cong(dx, bt.nhan(bt.hang(-khung.rong), con));
      else if (kieu === 'truot-phai') dx = bt.cong(dx, bt.nhan(bt.hang(khung.rong), con));
      else if (kieu === 'truot-len') dy = bt.cong(dy, bt.nhan(bt.hang(doc * khung.cao), con));
      else if (kieu === 'truot-xuong') dy = bt.cong(dy, bt.nhan(bt.hang(-doc * khung.cao), con));
      else if (kieu === 'phong') heCo = bt.nhan(heCo, bt.cong(bt.hang(1), bt.nhan(bt.hang(-0.4), con)));
      // Phóng MẠNH: vào từ 1,6× (như máy quay lao tới), ra phình 1,6× rồi tắt.
      else if (kieu === 'phong-lon') { heCo = bt.nhan(heCo, bt.cong(bt.hang(1), bt.nhan(bt.hang(0.6), con))); coMax = Math.max(coMax, 1.6); }
      // Xoay vào: quay 200° kèm thu nhỏ 0,4× → về thẳng; ra quay tiếp chiều kim đồng hồ.
      else if (kieu === 'xoay') {
        heCo = bt.nhan(heCo, bt.cong(bt.hang(1), bt.nhan(bt.hang(-0.6), con)));
        xoay = bt.cong(xoay, bt.nhan(bt.hang(laRa ? 200 : -200), con));
      }
    };
    ap(kv, conVao, false);
    ap(kr, conRa, true);
    /* Bật nảy (easeOutBack): cỡ 0,3 → vọt quá ~1,07 → 1. Ra: ngược lại (phình nhẹ rồi thu về 0,3). Tiến độ TUYẾN TÍNH p
       (không phải (1-p)^3) — cong nảy nằm trong hàm. */
    const nay = (P) => ({
      f: (ms) => { const u = P.f(ms) - 1; return 0.3 + 0.7 * (1 + 2.70158 * u * u * u + 1.70158 * u * u); },
      s: (T) => { const u = `(${P.s(T)}-1)`; return `(0.3+0.7*(1+2.70158*${u}*${u}*${u}+1.70158*${u}*${u}))`; },
    });
    if (kv === 'nay' && mv > 0) {
      heCo = bt.nhan(heCo, nay({ f: (ms) => kep01(ms / mv), s: (T) => `clip(${T}/${sx(mv / 1000)},0,1)` }));
      coMax = Math.max(coMax, 1.08);
    }
    if (kr === 'nay' && mr > 0) {
      heCo = bt.nhan(heCo, nay({ f: (ms) => kep01((dai - ms) / mr), s: (T) => `clip((${sx(dai / 1000)}-${T})/${sx(mr / 1000)},0,1)` }));
      coMax = Math.max(coMax, 1.08);
    }
    const moVao = mv > 0 && CO_MO.includes(kv) ? mv : 0;
    const moRa = mr > 0 && CO_MO.includes(kr) ? mr : 0;
    const heMo = (ms) => {
      let k = 1;
      if (moVao && ms < moVao) k = Math.min(k, kep01(ms / moVao));
      if (moRa && ms > dai - moRa) k = Math.min(k, kep01((dai - ms) / moRa));
      return k;
    };
    return { dx, dy, heCo, xoay, coMax, heMo, moVao, moRa, dai, kv, kr, mv, mr };
  }

  /* ── MẶT NẠ / NHÁY (đợt 1 hiệu ứng) ──────────────────────────────────────
     Công thức CHÉP từ libavfilter/vf_xfade.c (ffmpeg 7.1): `progress` chạy 1 → 0, mix(a,b,m) = a·m + b·(1−m).
     Ở đây p = tiến độ ĐÃ CHẠY (0 → 1, = 1 − progress). Bộ thử chạy ffmpeg thật và so từng điểm ảnh. */
  const ss01 = (x) => { const t = kep01(x); return t * t * (3 - 2 * t); };
  /**
   * Độ phủ (0..1) của khối ĐANG VÀO tại điểm ảnh (x, y) — khung W×H, tiến độ p. Khối đang RA: 1 − phuMat(...).
   * Nháy qua màu không phải mặt nạ (xem nhayMau) → 1.
   */
  function phuMat(kieu, p, x, y, W, H) {
    const q = 1 - kep01(p);
    const w2i = Math.trunc(W / 2);
    const h2i = Math.trunc(H / 2);
    switch (kieu) {
      case 'quet-trai': return x > Math.trunc(W * q) ? 1 : 0;
      case 'quet-phai': return x > Math.trunc(W * (1 - q)) ? 0 : 1;
      case 'quet-len': return y > Math.trunc(H * q) ? 1 : 0;
      case 'quet-xuong': return y > Math.trunc(H * (1 - q)) ? 0 : 1;
      case 'quet-mem-trai': return ss01(1 + x / W - q * 2);
      case 'quet-mem-phai': return ss01(1 + (W - 1 - x) / W - q * 2);
      case 'quet-mem-len': return ss01(1 + y / H - q * 2);
      case 'quet-mem-xuong': return ss01(1 + (H - 1 - y) / H - q * 2);
      case 'tron-mo': return 1 - ss01(Math.hypot(x - w2i, y - h2i) / Math.hypot(w2i, h2i) + (q - 0.5) * 3);
      case 'tron-dong': return ss01(Math.hypot(x - w2i, y - h2i) / Math.hypot(w2i, h2i) + (1 - q - 0.5) * 3);
      case 'cua-mo-doc': return ss01(2 - Math.abs((x - W / 2) / (W / 2)) - q * 2);
      case 'cua-dong-doc': return ss01(1 + Math.abs((x - W / 2) / (W / 2)) - q * 2);
      case 'cua-mo-ngang': return ss01(2 - Math.abs((y - H / 2) / (H / 2)) - q * 2);
      case 'cua-dong-ngang': return ss01(1 + Math.abs((y - H / 2) / (H / 2)) - q * 2);
      case 'dong-ho': return ss01(Math.atan2(x - w2i, y - h2i) - (q - 0.5) * (Math.PI * 2.5));
      default: return 1;
    }
  }
  /**
   * Nháy qua màu tại tiến độ p: lớp màu (đè lên khối, phủ cả khung) đục `gamma` = 2p rồi 2 − 2p; khối (`beta`) hiện từ
   * GIỮA chừng khi vào / tắt từ giữa chừng khi ra — đúng lúc màu đặc nhất nên không thấy vết. Bản xuất: fade alpha
   * tuyến tính trên lớp màu + fade một khung trên khối (xuat.js) — cùng số.
   * @returns {{ mau: string, gamma: number, beta: number }}
   */
  function nhayMau(kieu, p, laRa) {
    const t = kep01(p);
    const gamma = t < 0.5 ? 2 * t : 2 - 2 * t;
    const beta = laRa ? (t < 0.5 ? 1 : 0) : (t < 0.5 ? 0 : 1);
    return { mau: MAU_NHAY[kieu] || '#000000', gamma, beta };
  }
  const LOAI_MAT = {
    ngang: ['quet-trai', 'quet-phai', 'quet-mem-trai', 'quet-mem-phai', 'cua-mo-doc', 'cua-dong-doc'],
    doc: ['quet-len', 'quet-xuong', 'quet-mem-len', 'quet-mem-xuong', 'cua-mo-ngang', 'cua-dong-ngang'],
  };
  const soCss = (v) => String(Math.round(v * 10000) / 10000);
  /** Gradient CSS (cho `mask-image`) của độ phủ — `dao` = khối đang RA (1 − phủ). */
  function gradMat(kieu, p, W, H, dao) {
    const g = (x, y) => { const c = phuMat(kieu, p, x, y, W, H); return dao ? 1 - c : c; };
    const den = (a) => `rgba(0,0,0,${soCss(a)})`;
    const N = 64;
    const ngang = LOAI_MAT.ngang.includes(kieu);
    if (ngang || LOAI_MAT.doc.includes(kieu)) {
      const L = ngang ? W : H;
      const at = (i) => (ngang ? g(i, Math.trunc(H / 2)) : g(Math.trunc(W / 2), i));
      if (/^quet-(trai|phai|len|xuong)$/.test(kieu)) {
        // Mép CỨNG: tìm điểm ảnh đầu tiên đổi giá trị (xfade so `x > z` trên chỉ số điểm ảnh).
        const a0 = at(0);
        let k = 1;
        while (k < L && at(k) === a0) k += 1;
        const vt = (k / L) * 100;
        return `linear-gradient(${ngang ? 'to right' : 'to bottom'}, ${den(a0)} 0%, ${den(a0)} ${soCss(vt)}%, ${den(at(L - 1))} ${soCss(vt)}%, ${den(at(L - 1))} 100%)`;
      }
      const ds = [];
      for (let i = 0; i <= N; i += 1) ds.push(`${den(at(Math.min(L - 1, Math.max(0, (i / N) * L - 0.5))))} ${soCss((i / N) * 100)}%`);
      return `linear-gradient(${ngang ? 'to right' : 'to bottom'}, ${ds.join(', ')})`;
    }
    const cx = Math.trunc(W / 2);
    const cy = Math.trunc(H / 2);
    /* Tâm = TÂM ĐIỂM ẢNH chỉ số (cx, cy) của xfade: điểm ảnh x phủ đoạn liên tục [x, x+1) ⇒ CSS cần tâm ở cx + 0,5 —
       đặt 50 % là lệch nửa điểm ảnh, sát tâm góc của đồng hồ lệch hẳn (bộ thử đo). */
    // −0,05: cột điểm ảnh NGAY trên tâm thuộc phía θ = +π như xfade (atan2(0, âm) = π) — đúng 0,5 thì nằm trên vết nối.
    const tam = `at ${soCss(((cx + 0.45) / W) * 100)}% ${soCss(((cy + 0.5) / H) * 100)}%`;
    if (kieu === 'tron-mo' || kieu === 'tron-dong') {
      // farthest-corner từ tâm đó = góc trên-trái, cách hypot(cx + 0,5, cy + 0,5) ⇒ vị trí % = d / bán kính ấy.
      const R = Math.hypot(Math.max(cx + 0.45, W - cx - 0.45), Math.max(cy + 0.5, H - cy - 0.5));
      const ds = [];
      for (let i = 0; i <= N; i += 1) ds.push(`${den(g(cx + (i / N) * R, cy))} ${soCss((i / N) * 100)}%`);
      return `radial-gradient(circle farthest-corner ${tam}, ${ds.join(', ')})`;
    }
    if (kieu === 'dong-ho') {
      /* conic: góc φ tính THEO chiều kim đồng hồ từ ĐỈNH; xfade: atan2(x − cx, y − cy) tính từ hướng XUỐNG. Lấy mẫu
         đúng điểm ảnh trên tia φ (bán kính 1/4 cạnh ngắn) — không đổi công thức bằng tay. */
      const R = Math.min(W, H) / 4;
      const ds = [];
      for (let d = 0; d <= 360; d += 3) {
        const r = (d * Math.PI) / 180;
        ds.push(`${den(g(cx + R * Math.sin(r), cy - R * Math.cos(r)))} ${d}deg`);
      }
      return `conic-gradient(from 0deg ${tam}, ${ds.join(', ')})`;
    }
    return null;
  }
  /**
   * Khung xfade của chuyển cảnh MẶT NẠ: xfade đổi `offset` / `duration` ra SỐ KHUNG (làm tròn) — 350 ms ở 30 khung/giây
   * là 10,5 khung → 11 (rà soát đợt 1: lệch tới 71/255 so với xem trước tính theo ms). Bản xuất (xuat.js) và xem trước
   * (matNa) cùng dùng hàm này: tuF = khung bắt đầu, soF = số khung; soF = 0 ⇒ không có chuyển cảnh.
   */
  function khungMat(tuMs, daiMs, fps) {
    return { tuF: Math.round((tuMs * fps) / 1000), soF: Math.round((daiMs * fps) / 1000) };
  }
  /**
   * Mặt nạ / nháy của khối tại `ms` (trong khối) cho XEM TRƯỚC — cùng tham số thời gian với chuyenCanh (`o.dai`,
   * `o.boRa`) + `o.fps` (mặt nạ tính theo khung như xfade — khungMat). → null khi không có gì; không thì
   * `{ mask: [css…], phu: [{ mau, mo }…], he }` (he: nhân vào độ đục của khối; phu: lớp màu nháy, PHỦ CẢ KHUNG — không
   * nằm dưới mặt nạ, như bản xuất).
   */
  function matNa(c, khung, ms, o) {
    const cc = chuyenCanh(c, khung, o);
    const fps = (o && o.fps) || khung.fps || 30;
    const ra = { mask: [], phu: [], he: 1 };
    const nhay = (kieu, p, laRa) => {
      const n = nhayMau(kieu, p, laRa);
      if (n.gamma > 0) ra.phu.push({ mau: n.mau, mo: n.gamma });
      ra.he *= n.beta;
    };
    const mat = (kieu, tuMs, daiMs, laRa) => {
      const { tuF, soF } = khungMat(tuMs, daiMs, fps);
      if (soF <= 0) return;
      const p = ((ms * fps) / 1000 - tuF) / soF;
      if (p < 0 || p >= 1) return;
      const g = gradMat(kieu, p, khung.rong, khung.cao, laRa);
      if (g) ra.mask.push(g);
    };
    if (cc.mv > 0 && ms < cc.mv) {
      if (MAU_NHAY[cc.kv]) nhay(cc.kv, ms / cc.mv, false);
      else if (XFADE[cc.kv]) mat(cc.kv, 0, cc.mv, false);
    }
    if (cc.mr > 0) {
      if (MAU_NHAY[cc.kr] && ms > cc.dai - cc.mr) nhay(cc.kr, (ms - (cc.dai - cc.mr)) / cc.mr, true);
      else if (XFADE[cc.kr]) mat(cc.kr, cc.dai - cc.mr, cc.mr, true);
    }
    return ra.mask.length || ra.phu.length || ra.he !== 1 ? ra : null;
  }

  /**
   * Hiệu ứng chuyển động suốt khối (GĐ2.3), biểu thức kép theo giây TRONG khối — nhân/cộng vào cỡ & tâm như
   * chuyển cảnh. p = tiến độ 0→1 trên độ dài HIỆN (`o.dai`, có kéo dài dưới hoà trộn), tuyến tính kiểu Ken Burns.
   *   phong: cỡ ×(1 → 1+0,2·mạnh)   thu: ngược lại
   *   trôi:  cỡ ×(1+0,13·mạnh) cố định (chừa mép) + tâm dời ±0,06·mạnh khung (trái = nội dung đi sang trái)
   * `coMax` = hệ số cỡ lớn nhất (xuat.js đệm hộp cố định cho ffmpeg).
   */
  function hieuUngKhoi(c, khung, o) {
    const h = c.hieuUng;
    const khong = { heCo: bt.hang(1), dx: bt.hang(0), dy: bt.hang(0), coMax: 1 };
    if (!h || !HIEU_UNG.includes(h.kieu)) return khong;
    const manh = so(h.manh, 0.1, 1) ? h.manh : 0.5;
    const dai = Math.max(1, (o && o.dai) || doDaiMs(c));
    const tu = so(h.tu, 0, 1) ? h.tu : 0;
    const den = so(h.den, 0, 1) && h.den > tu ? h.den : 1;
    const p0 = { f: (ms) => kep01(ms / dai), s: (T) => `clip(${T}/${sx(dai / 1000)},0,1)` };
    const p = tu === 0 && den === 1 ? p0 : bt.cong(bt.hang(tu), bt.nhan(bt.hang(den - tu), p0));
    const A = 0.2 * manh;
    const B = 0.06 * manh;
    const motTru = (x) => bt.cong(bt.hang(1), bt.nhan(bt.hang(-1), x));   // 1 − x
    const haiP1 = bt.cong(bt.nhan(bt.hang(2), p), bt.hang(-1));            // 2p − 1 (−1 → 1)
    if (h.kieu === 'phong') return { ...khong, heCo: bt.cong(bt.hang(1), bt.nhan(bt.hang(A), p)), coMax: 1 + A };
    if (h.kieu === 'thu') return { ...khong, heCo: bt.cong(bt.hang(1), bt.nhan(bt.hang(A), motTru(p))), coMax: 1 + A };
    const tran = 1 + 2.2 * B;
    if (h.kieu === 'troi-trai') return { ...khong, heCo: bt.hang(tran), coMax: tran, dx: bt.nhan(bt.hang(-B * khung.rong), haiP1) };
    if (h.kieu === 'troi-phai') return { ...khong, heCo: bt.hang(tran), coMax: tran, dx: bt.nhan(bt.hang(B * khung.rong), haiP1) };
    if (h.kieu === 'troi-len') return { ...khong, heCo: bt.hang(tran), coMax: tran, dy: bt.nhan(bt.hang(-B * khung.cao), haiP1) };
    return { ...khong, heCo: bt.hang(tran), coMax: tran, dy: bt.nhan(bt.hang(B * khung.cao), haiP1) };
  }

  /** Khối hình có đổi hình học theo thời gian không (keyframe vị trí/cỡ/xoay, trượt/phóng, hiệu ứng). */
  function coDong(c) {
    if (c.hieuUng && HIEU_UNG.includes(c.hieuUng.kieu)) return true;
    const kf = c.kf || {};
    if (['x', 'y', 'co', 'xoay'].some((k) => kf[k] && kf[k].length > 1)) return true;
    const mo = c.mo || {};
    // Mặt nạ / nháy không đổi hình học (xfade lo) — chỉ trượt / phóng / nảy / xoay.
    const hinhHoc = (k) => k && k !== 'mo' && !XFADE[k] && !MAU_NHAY[k];
    return (mo.vaoMs > 0 && hinhHoc(mo.kieuVao)) || (mo.raMs > 0 && hinhHoc(mo.kieuRa));
  }

  /**
   * HÌNH HỌC của khối tại `ms` trong khối — keyframe + chuyển cảnh + cắt khung. Xem
   * trước gọi mỗi khung; bản xuất dựng biểu thức từ CÙNG các mảnh (`hinhBieuThuc`).
   */
  function hinhTai(c, m, khung, ms, o) {
    const b = bienDoiTai(c, ms);
    const cc = chuyenCanh(c, khung, o);
    const hu = hieuUngKhoi(c, khung, o);
    const h = hopKhoi(m, {
      ...b,
      xoay: b.xoay + cc.xoay.f(ms),
      co: b.co * cc.heCo.f(ms) * hu.heCo.f(ms),
      x: b.x + (cc.dx.f(ms) + hu.dx.f(ms)) / khung.rong,
      y: b.y + (cc.dy.f(ms) + hu.dy.f(ms)) / khung.cao,
    }, khung, c.cat);
    h.mo = b.mo * cc.heMo(ms);
    return h;
  }

  /**
   * Biểu thức kép cho bản xuất: tâm (cx, cy — điểm ảnh khung), hệ số cỡ, xoay (độ).
   * `coMax` = cỡ lớn nhất khối đạt tới (để đệm khung cố định cho ffmpeg).
   */
  function hinhBieuThuc(c, khung, o) {
    const kf = c.kf || {};
    const b = { x: 0.5, y: 0.5, co: 1, xoay: 0, ...(c.bienDoi || {}) };
    const cc = chuyenCanh(c, khung, o);
    const hu = hieuUngKhoi(c, khung, o);
    const x = btKf(kf.x, b.x);
    const y = btKf(kf.y, b.y);
    const co = bt.nhan(bt.nhan(btKf(kf.co, b.co), cc.heCo), hu.heCo);
    const xoay = bt.cong(btKf(kf.xoay, b.xoay), cc.xoay);
    // × cc.coMax: phóng mạnh / nảy vượt cỡ 1 — hộp đệm của ffmpeg phải đủ (pad từ chối khung lớn hơn hộp).
    const coMax = Math.max(b.co, ...(kf.co || []).map((k) => k.v)) * hu.coMax * cc.coMax;
    const xoayMax = Math.max(Math.abs(b.xoay), ...(kf.xoay || []).map((k) => Math.abs(k.v))) + (cc.xoay.hang ? 0 : 200);
    return {
      cx: bt.cong(bt.cong(bt.nhan(x, bt.hang(khung.rong)), cc.dx), hu.dx),
      cy: bt.cong(bt.cong(bt.nhan(y, bt.hang(khung.cao)), cc.dy), hu.dy),
      co, xoay, coMax, xoayMax, chuyen: cc,
    };
  }

  /* ── dời keyframe khi sửa khối ──────────────────────────────────────────── */
  /** Dời mọi keyframe `lech` ms (cắt mép đầu: lech = −phần cắt). Điểm rơi trước 0 được
   *  thay bằng giá trị NỘI SUY tại 0 — hình ở đầu khối mới đúng như trước khi cắt. */
  /**
   * Cắt rơi GIỮA một đoạn "êm" (smoothstep): điểm chèn ở chỗ cắt làm đường cong bắt đầu lại
   * — chuyển động hai nửa khác hẳn trước khi cắt (audit GĐ2: lệch tới 138 px). Đổi riêng đoạn
   * đó thành các điểm THẲNG lấy mẫu từ chính đường cong (sai < 1% biên độ), rồi mới cắt.
   */
  function lamThangQuanh(ds, t) {
    const i = ds.findIndex((k, j) => j < ds.length - 1 && k.muot && k.t < t && t < ds[j + 1].t);
    if (i < 0) return ds;
    const a = ds[i];
    const b = ds[i + 1];
    const n = Math.max(2, Math.min(12, TRAN.kf - ds.length));
    const mau = [];
    for (let j = 1; j < n; j += 1) {
      const tt = Math.round(a.t + ((b.t - a.t) * j) / n);
      if (tt > a.t && tt < b.t) mau.push({ t: tt, v: giaTriKf(ds, tt) });
    }
    const { muot: _bo, ...aThang } = a;
    return [...ds.slice(0, i), aThang, ...mau, ...ds.slice(i + 1)].filter((k, j, x) => j === 0 || k.t !== x[j - 1].t);
  }

  function kfDoi(kf, lech) {
    const ra = {};
    Object.keys(kf || {}).forEach((ten) => {
      const ds = lech < 0 ? lamThangQuanh(kf[ten] || [], -lech) : kf[ten];
      if (!ds || !ds.length) return;
      const moi = ds.map((k) => ({ ...k, t: k.t + lech })).filter((k) => k.t >= 0);
      if (lech < 0 && (moi.length === 0 || moi[0].t > 0)) {
        const truoc = ds.filter((k) => k.t + lech < 0);
        const v = giaTriKf(ds, -lech);
        moi.unshift({ t: 0, v, ...(truoc.length && truoc[truoc.length - 1].muot ? { muot: true } : {}) });
      }
      ra[ten] = moi.map((k) => ({ ...k, t: Math.round(k.t) }));
    });
    return ra;
  }
  /** Tách keyframe tại `ms` (dao cạo): [nửa đầu, nửa sau (dời về 0)], mỗi nửa giữ đúng giá trị ở chỗ cắt. */
  function kfTach(kf, ms) {
    const dau = {};
    const thang = {};
    Object.keys(kf || {}).forEach((ten) => {
      const ds = lamThangQuanh(kf[ten] || [], ms);
      thang[ten] = ds;
      if (!ds || !ds.length) return;
      const giu = ds.filter((k) => k.t < ms);
      if (ds.some((k) => k.t >= ms) && giu.length) giu.push({ t: Math.round(ms), v: giaTriKf(ds, ms) });
      dau[ten] = giu.length ? giu : [{ t: 0, v: giaTriKf(ds, ms) }];
    });
    return [dau, kfDoi(thang, -Math.round(ms))];
  }
  /** Đổi tốc độ: độ dài khối nhân `heSo` ⇒ giờ keyframe nhân theo. */
  /** Cỡ "phủ kín khung" của media theo thang của trình dựng (1 = vừa khung). */
  function coPhuKin(m, khung) {
    const { mw, mh, s0 } = coGoc(m, khung);
    return Math.max(khung.rong / mw, khung.cao / mh) / s0;
  }
  /**
   * THAY MEDIA của một khối (mẫu dựng video: thay ảnh / video demo của ô; cũng là "Replace" thường) — GIỮ chỗ đặt, độ
   * dài trên timeline, chuyển cảnh, hiệu ứng, màu, âm lượng, keyframe. Đổi:
   *   · thời gian: ảnh ⇒ vào 0, dài đúng ô. Video đủ dài ⇒ giữ điểm vào cũ (nếu còn vừa), không thì lấy từ đầu.
   *     Video NGẮN hơn ô ⇒ quay chậm cho vừa (tối thiểu 0,25×); chậm tới đó vẫn thiếu thì khối ngắn lại.
   *   · khung hình: khối PHỦ KÍN khung (ô `phu`, hoặc cỡ ≥ 98 % cỡ phủ kín của media cũ) ⇒ cỡ / vị trí (cả keyframe)
   *     quy đổi theo tỉ lệ media mới — vẫn phủ kín, cùng điểm nhìn tương đối. Khối nhỏ (logo, ảnh trong ảnh) giữ nguyên.
   *   · cắt khung / lật của media cũ bỏ (thuộc về ảnh demo).
   * @returns {object} khối mới (chưa kiem)
   */
  /**
   * LƯU LÀM MẪU (mẫu dựng video của người dùng, 23/10/2026): đánh số ô giữ chỗ cho dự án sắp thành mẫu.
   *   · Dự án ĐÃ có ô (tạo từ mẫu) ⇒ giữ số ô, bỏ dấu "đã thay" — trong mẫu mới mọi ô đều là ảnh demo.
   *   · Chưa có ⇒ mỗi khối ảnh / video PHỦ KÍN khung (cỡ lớn nhất ≥ 98 % cỡ phủ kín — cùng ngưỡng thayMediaKhoi) trên
   *     track hình là một ô, số theo giờ bắt đầu. Chữ, lớp phủ, bộ slide, logo / ảnh nhỏ không thành ô. Tối đa 99 ô.
   * @returns {{ duAn: object, soO: number }}
   */
  function danhOMau(d) {
    const K = khungXuat(d.khung, (d.xuat || {}).khung);
    const mediaCua = new Map((d.media || []).map((m) => [m.id, m]));
    let khoi;
    if (d.khoi.some((c) => c.oCho)) {
      khoi = d.khoi.map((c) => (c.oCho ? { ...c, oCho: { so: c.oCho.so, phu: c.oCho.phu !== false } } : c));
    } else {
      const hinh = new Set((d.track || []).filter((t) => t.loai === 'hinh').map((t) => t.id));
      const la = d.khoi.filter((c) => {
        const m = mediaCua.get(c.media);
        if (!m || !hinh.has(c.track) || m.loai === 'tieng' || m.chu || m.lopPhu || m.boSlide) return false;
        const coLon = Math.max((c.bienDoi && c.bienDoi.co) || 1, ...((c.kf && c.kf.co) || []).map((k) => k.v));
        return coLon >= coPhuKin(m, K) * 0.98;
      }).sort((a, b) => batDauMs(a, []) - batDauMs(b, []) || String(a.track).localeCompare(String(b.track))).slice(0, 99);
      const so = new Map(la.map((c, i) => [c.id, i + 1]));
      khoi = d.khoi.map((c) => (so.has(c.id) ? { ...c, oCho: { so: so.get(c.id), phu: true } } : c));
    }
    return { duAn: { ...d, khoi }, soO: new Set(khoi.filter((c) => c.oCho).map((c) => c.oCho.so)).size };
  }

  function thayMediaKhoi(c, mCu, mMoi, khung) {
    const dai = doDaiMs(c);
    let x = { ...c, media: mMoi.id, cat: { trai: 0, phai: 0, tren: 0, duoi: 0 }, lat: { ngang: false, doc: false } };
    if (mMoi.loai === 'anh') {
      x = { ...x, vaoMs: 0, raMs: dai, tocDo: 1 };
    } else {
      const toc = c.tocDo || 1;
      const can = Math.round(dai * toc);
      if (mMoi.ms >= can) {
        const vao = mCu && mCu.loai !== 'anh' && c.vaoMs + can <= mMoi.ms ? c.vaoMs : 0;
        x = { ...x, vaoMs: vao, raMs: vao + can, tocDo: toc };
      } else {
        const toc2 = Math.max(0.25, Math.round((mMoi.ms / dai) * 1000) / 1000);
        x = { ...x, vaoMs: 0, raMs: Math.max(1, Math.min(mMoi.ms, Math.round(dai * toc2))), tocDo: toc2 };
      }
    }
    if (mCu && mCu.loai !== 'tieng' && mMoi.loai !== 'tieng' && !mCu.chu && !mMoi.chu) {
      const phuCu = coPhuKin(mCu, khung);
      const phuMoi = coPhuKin(mMoi, khung);
      const b = { x: 0.5, y: 0.5, co: 1, ...(c.bienDoi || {}) };
      const coLonNhat = Math.max(b.co, ...((c.kf && c.kf.co) || []).map((k) => k.v));
      const phuKin = (c.oCho && c.oCho.phu !== false) || coLonNhat >= phuCu * 0.98;
      if (phuKin) {
        const g0 = coGoc(mCu, khung);
        const g1 = coGoc(mMoi, khung);
        // Bề ngang / cao hiện ra (phần khung) ở CÙNG mức phóng tương đối — tỉ số giữa media mới và cũ.
        const rW = (g1.mw * g1.s0 * phuMoi) / (g0.mw * g0.s0 * phuCu);
        const rH = (g1.mh * g1.s0 * phuMoi) / (g0.mh * g0.s0 * phuCu);
        const k = phuMoi / phuCu;
        const r4 = (v) => Math.round(v * 10000) / 10000;
        const qx = (v) => r4(0.5 + (v - 0.5) * rW);
        const qy = (v) => r4(0.5 + (v - 0.5) * rH);
        const kf = { ...(c.kf || {}) };
        if (kf.co) kf.co = kf.co.map((q) => ({ ...q, v: r4(Math.min(10, q.v * k)) }));
        if (kf.x) kf.x = kf.x.map((q) => ({ ...q, v: Math.max(-2, Math.min(3, qx(q.v))) }));
        if (kf.y) kf.y = kf.y.map((q) => ({ ...q, v: Math.max(-2, Math.min(3, qy(q.v))) }));
        x = { ...x, bienDoi: { ...b, co: r4(Math.min(10, b.co * k)), x: Math.max(-2, Math.min(3, qx(b.x))), y: Math.max(-2, Math.min(3, qy(b.y))) }, kf };
      }
    }
    if (x.oCho) x = { ...x, oCho: { ...x.oCho, daThay: true } };
    return x;
  }

  function kfTiLe(kf, heSo) {
    const ra = {};
    Object.keys(kf || {}).forEach((ten) => {
      const ds = kf[ten];
      if (!ds || !ds.length) return;
      const moi = ds.map((k) => ({ ...k, t: Math.round(k.t * heSo) }));
      ra[ten] = moi.filter((k, i) => i === moi.length - 1 || moi[i + 1].t !== k.t);
    });
    return ra;
  }
  /** Đặt / thay một keyframe (cùng giờ thì thay). */
  function kfDat(ds, t, v, muot) {
    const k = muot ? { t: Math.round(t), v, muot: true } : { t: Math.round(t), v };
    return [...(ds || []).filter((x) => x.t !== k.t), k].sort((a, b) => a.t - b.t);
  }

  /* ── hạ nhạc khi có giọng (ducking) ────────────────────────────────────────
     `hoatDong` = các đoạn CÓ GIỌNG [{ tuMs, denMs }] (main đo bằng silencedetect trên
     tệp giọng — một nguồn cho cả xem trước lẫn bản xuất). Hệ số nhạc = 1 − (1 − g)·bao,
     `bao` là tổng các hình thang (lên trong LEN trước câu nói, xuống trong NHA sau
     câu). Đoạn gần nhau được gộp để hình thang không chồng nhau ⇒ tổng = max. */
  const HA_LEN_MS = 250;
  const HA_NHA_MS = 500;
  function gopHoatDong(ds) {
    const xs = (ds || []).filter((x) => x && x.denMs > x.tuMs).map((x) => ({ tuMs: x.tuMs, denMs: x.denMs }))
      .sort((a, b) => a.tuMs - b.tuMs);
    const ra = [];
    xs.forEach((x) => {
      const cuoi = ra[ra.length - 1];
      if (cuoi && x.tuMs - cuoi.denMs < HA_LEN_MS + HA_NHA_MS) cuoi.denMs = Math.max(cuoi.denMs, x.denMs);
      else ra.push(x);
    });
    return ra;
  }
  /**
   * Các khoảng có GIỌNG của người dùng (GĐ2.1b): khối trên track tiếng vai trò 'giong' (giọng đọc thành khối,
   * giọng thu…) — giờ TIMELINE (ms). Cùng một hàm cho bản xuất (xuat.js) và xem trước (dung-xem.js): hạ nhạc
   * hai bên không lệch. Track tắt tiếng / khối âm lượng 0 thì không kích.
   */
  /** Khối mang GIỌNG ĐỌC (kích hạ nhạc, không bị hạ): track vai trò 'giong', hoặc clip BỘ SLIDE PHỤ (GĐ3.7 — tiếng
   *  của nó là giọng đọc + nhạc deck đã trộn sẵn; hạ nó là hạ cả lời thoại). */
  function khoiLaGiong(d, c, t) {
    if (t && t.vaiTro === 'giong') return true;
    const m = c && (d.media || []).find((x) => x.id === c.media);
    // Video ĐEN đứng chỗ (chưa dựng) im lặng — không kích hạ nhạc (rà 3.7).
    return !!(m && m.boSlide && !/-cho-\d+\.mp4$/.test(m.tep || ''));
  }
  function khoangGiongNd(d, moc) {
    if (!d || !Array.isArray(d.track) || !Array.isArray(d.khoi)) return [];
    const theoId = new Map(d.track.map((t) => [t.id, t]));
    // Track hình ẨN không vào bản xuất (xuat.js) ⇒ không kích hạ ở xem trước lẫn bản xuất (rà 3.7).
    const nghe = (t) => t && !t.tatTieng && !(t.loai === 'hinh' && t.an) && (t.amLuong == null || t.amLuong > 0);
    return d.khoi.filter((c) => { const t = theoId.get(c.track); return nghe(t) && khoiLaGiong(d, c, t); })
      .filter((c) => !(c.amLuong === 0))
      .map((c) => ({ tuMs: batDauMs(c, moc), denMs: ketThucMs(c, moc) }))
      .filter((x) => x.denMs > x.tuMs);
  }
  /**
   * Áp media MỚI của bộ slide phụ (vừa dựng lại — src/dung/boSlide.js#chuanBiMedia) vào dự án: thay tệp / thời lượng /
   * khổ, rồi khối dùng media đó: đang chạy HẾT video cũ (vào 0, ra ≈ hết) ⇒ chạy hết video mới; đã tỉa ⇒ giữ, chỉ kẹp
   * trong video mới. Kéo dài mà đụng khối kế trên cùng track ⇒ dừng ngay trước nó. HÀM THUẦN — tiến trình chính (ghi
   * đĩa, bản xuất) và giao diện (ngăn đang mở) áp CÙNG phép, không ai đè ai.
   * @param {Array<{ id: string }>} ds bản vá media theo id (các trường của media)
   */
  function apMediaBoSlide(d, ds, moc) {
    if (!d || !Array.isArray(ds) || !ds.length) return d;
    const va = new Map(ds.filter((x) => x && x.id).map((x) => [x.id, x]));
    const cu = new Map((d.media || []).map((m) => [m.id, m]));
    if (![...va.keys()].some((id) => cu.has(id))) return d;
    const media = d.media.map((m) => (va.has(m.id) && m.boSlide
      ? { ...m, ...va.get(m.id), id: m.id, loai: 'video', boSlide: m.boSlide } : m));
    const moi = new Map(media.map((m) => [m.id, m]));
    const doiMs = (c) => {
      const m0 = cu.get(c.media);
      const m1 = moi.get(c.media);
      if (!m0 || !m1 || !va.has(c.media) || !m0.boSlide) return null;
      return { cuMs: m0.ms, moiMs: m1.ms };
    };
    let khoi = d.khoi.map((c) => {
      const x = doiMs(c);
      if (!x) return c;
      const het = (c.vaoMs || 0) === 0 && Math.abs(c.raMs - x.cuMs) <= 50;
      const ra = het ? x.moiMs : Math.min(c.raMs, x.moiMs);
      const vao = Math.min(c.vaoMs || 0, Math.max(0, ra - 1));
      return { ...c, vaoMs: vao, raMs: Math.max(vao + 1, ra) };
    });
    // Kéo dài đụng khối kế trên cùng track: dừng ngay trước nó (không đổi ai khác).
    const m2 = moc || [];
    khoi = khoi.map((c, i) => {
      const truoc = d.khoi[i];
      if (c === truoc || c.raMs <= truoc.raMs) return c;
      const bd = batDauMs(c, m2);
      const ke = khoi.filter((x) => x !== c && x.track === c.track && batDauMs(x, m2) >= bd)
        .map((x) => batDauMs(x, m2)).sort((a, b) => a - b)[0];
      if (ke == null) return c;
      const toc = c.tocDo || 1;
      const raToiDa = (c.vaoMs || 0) + Math.floor((ke - bd) * toc);
      return c.raMs > raToiDa ? { ...c, raMs: Math.max((c.vaoMs || 0) + 1, Math.max(truoc.raMs, raToiDa)) } : c;
    });
    return { ...d, media, khoi };
  }

  function btHaNhac(hoatDong, mucDb) {
    const ds = gopHoatDong(hoatDong);
    if (!ds.length || !(mucDb > 0)) return bt.hang(1);
    const g = 10 ** (-mucDb / 20);
    const L = HA_LEN_MS;
    const R = HA_NHA_MS;
    const hinhThang = (x, ms) => kep01((ms - x.tuMs + L) / L) * kep01((x.denMs + R - ms) / R);
    return {
      f: (ms) => {
        let bao = 0;
        for (const x of ds) {
          if (ms < x.tuMs - L) break;
          bao += hinhThang(x, ms);
        }
        return 1 - (1 - g) * Math.min(1, bao);
      },
      s: (T) => {
        const tong = ds.map((x) => `clip((${T}-${sx((x.tuMs - L) / 1000)})/${sx(L / 1000)},0,1)`
          + `*clip((${sx((x.denMs + R) / 1000)}-${T})/${sx(R / 1000)},0,1)`).join('+');
        return `(1-${sx(1 - g)}*min(1,${tong}))`;
      },
    };
  }

  /** Cỡ khung xuất theo lựa chọn (giữ cạnh DÀI của video slide, cạnh kia theo tỉ lệ, chẵn). */
  function khungXuat(khungVideo, lua) {
    const tl = KHUNG_XUAT[lua];
    if (!tl) return { ...khungVideo };
    const dai = Math.max(khungVideo.rong, khungVideo.cao);
    const chan = (v) => Math.max(16, Math.round(v / 2) * 2);
    const rong = tl[0] >= tl[1] ? dai : chan((dai * tl[0]) / tl[1]);
    const cao = tl[1] >= tl[0] ? dai : chan((dai * tl[1]) / tl[0]);
    return { ...khungVideo, rong: chan(rong), cao: chan(cao) };
  }
  /** Vùng video slide trong khung xuất (vừa khung, căn giữa) — điểm ảnh khung. */
  function vungVideo(khungVideo, khung) {
    const s = Math.min(khung.rong / khungVideo.rong, khung.cao / khungVideo.cao);
    const chan = (v) => Math.max(2, Math.round(v / 2) * 2);
    const w = chan(khungVideo.rong * s);
    const h = chan(khungVideo.cao * s);
    return { w, h, trai: Math.round((khung.rong - w) / 4) * 2, tren: Math.round((khung.cao - h) / 4) * 2 };
  }

  /**
   * URL `bee-media://` cho một tệp TƯƠNG ĐỐI trong deck (xem src/dung/giaoThuc.js).
   * Một hàm cho cả giao diện lẫn tiến trình chính — đừng tự ghép chuỗi ở chỗ khác.
   */
  function urlMedia(tenDeck, rel) {
    return `bee-media://deck/${encodeURIComponent(tenDeck)}/${String(rel).split('/').map(encodeURIComponent).join('/')}`;
  }

  /** Mã id ngắn, không trùng trong `daCo`. */
  function taoId(tienTo, daCo) {
    const co = new Set(daCo || []);
    for (;;) {
      const id = `${tienTo}${Math.random().toString(36).slice(2, 8)}`;
      if (!co.has(id)) return id;
    }
  }

  return {
    PHIEN_BAN, LOAI_MEDIA, TRAN, THUOC_KF, GIOI_KF, KIEU_CHUYEN, XFADE, MAU_NHAY, phuMat, nhayMau, gradMat, matNa, khungMat, CHU_DONG, apChuDong, chuDongCua, oChoSach, coPhuKin, thayMediaKhoi, danhOMau, KHUNG_XUAT, MAU_DANH_DAU,
    moi, coChinhSua, trackMacDinh, amGocMacDinh, xuatMacDinh, kiem, duongMediaHopLe,
    mocTuTiming, keoDuoiMoc, doDaiMs, batDauMs, ketThucMs, lechNeo, datChoMs, tongMs, khoiTai, taoId, urlMedia, hopKhoi, heSoMo,
    // Giai đoạn 2
    mocDich, chieuKhoang, chieuPhuDe, v1Sach, slideSach, dauSlide, khopSlide, nangCap, phuDeSach, CHU_KHUNG, coGoc, bt, sx, giaTriKf, btKf, bienDoiTai, amLuongTai, keoDaiMs, chuyenCanh, coDong, hinhTai, hinhBieuThuc,
    kfDoi, kfTach, kfTiLe, kfDat, gopHoatDong, btHaNhac, khungXuat, vungVideo,
    // GĐ2 lộ trình gộp slide + timeline
    ENGINE_GIONG, ttsSach, khoangGiongNd, khoiLaGiong, apMediaBoSlide, ID_BO, doDaiChoTha, HIEU_UNG, hieuUngKhoi, mauSach, maTranMau, locMau, svgMau,
  };
}));
