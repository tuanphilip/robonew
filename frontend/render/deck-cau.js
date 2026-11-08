'use strict';
/**
 * Cầu nối giữa CỬA SỔ APP và KHUNG XEM TRƯỚC của deck.
 *
 * Vì sao có tệp này: bảng sửa (Preview Editor) trước nay nằm BÊN TRONG khung
 * deck — `previewHtml.js` bơm `editor/editor.{css,js}` vào chính tài liệu của
 * deck. Nay bảng chuyển ra cửa sổ app, nên phải có một chỗ duy nhất biết cách
 * với sang khung con. Mọi mô-đun giao diện gọi qua đây — một chỗ sai thì sửa một chỗ.
 *
 * ── KHUNG Ở ORIGIN RIÊNG (10/10/2026) ──────────────────────────────────────
 *
 * Trước đây khung là `file://` CÙNG origin với app, và chỗ này gọi THẲNG hàm engine /
 * DOM của khung. Mặt trái đo được: mã của DECK cũng với thẳng được `top.beeknoee`,
 * `top.fetch`, `top.document` — tức mọi API của app. Nay khung nạp bằng `bee-deck://`
 * (src/main/khungDeck.js), KHÁC origin: không ai với qua ranh giới được nữa, hai bên nói
 * chuyện bằng postMessage với đại diện trong khung (src/render/editor/khung-cau.js):
 *
 *   · ĐỌC: khung gửi lên ẢNH CHỤP trạng thái mỗi khi đổi (slide đang xem, số slide, chữ
 *     từng slide, cỡ khung slide, lựa chọn của các <select> engine, đèn của slide…).
 *     Các hàm đọc ở đây (`sanSang`, `slideHienTai`, `soSlide`, `denSlide`, `mucChon`…)
 *     trả ĐỒNG BỘ từ bản chụp đó — nơi gọi không phải đổi sang async.
 *   · GHI: lệnh cố định (`apDung`, `apPhuDe`, `toiSlide`…) gửi xuống; khung làm rồi gửi
 *     bản chụp mới. Lệnh cần kết quả (`dungEngine`) trả Promise.
 *
 * Đo cũ (15/09/2026) vẫn đúng: vòng postMessage hỏi–đáp trung vị 0 ms, p95 0,1 ms —
 * dưới một khung hình rất xa.
 *
 * ⚠ `fetch('/api/…')` ở cửa sổ app là đường NGẮN HƠN trong khung. Trong khung,
 * `previewHtml.js` phải gói lại rồi chuyển tiếp lên cha (xem `apiFrames` ở
 * `slide-viewer.js` — chỉ ba đường, chỉ cho đúng deck của khung); ở đây `api-shim.js`
 * đã vá sẵn `fetch`, gọi thẳng.
 */
(function () {
  const RP = (window.__renderPage = window.__renderPage || {});

  /** Khung đang mở và tên deck của nó. `null` khi chưa mở deck nào. */
  let khung = null;
  let ten = '';
  /** Ảnh chụp trạng thái mới nhất của khung (khung-cau.js#chup); null khi chưa nhận. */
  let tt = null;

  /** Ai quan tâm khung đổi thì đăng ký ở đây (bảng sửa, dải slide…). */
  const nguoiNghe = new Set();

  function bao() {
    for (const f of nguoiNghe) {
      try { f({ deck: ten, sanSang: sanSang() }); } catch { /* một người nghe hỏng không được kéo cả hội */ }
    }
  }

  /* ── kênh với khung ──────────────────────────────────────────────────── */
  const cho = new Map();    // id lệnh → hàm trả kết quả
  let soLenh = 0;
  let henDai = 0;
  const cuaKhung = () => (khung && khung.isConnected ? khung.contentWindow : null);

  window.addEventListener('message', (e) => {
    const w = cuaKhung();
    if (!w || e.source !== w) return;
    // Đúng origin của trang đã nạp — khung tự điều hướng sang deck khác thì bỏ qua.
    if (e.origin !== String(khung.getAttribute('src') || '').split('/').slice(0, 3).join('/')) return;
    const d = e.data;
    if (!d || typeof d.__beeKhung !== 'string') return;
    if (d.__beeKhung === 'tt' && d.tt && typeof d.tt === 'object') {
      const cu = tt;
      tt = d.tt;
      // Engine vừa sẵn sàng (hoặc vừa chết) ⇒ báo người nghe — bảng sửa dựng lại theo nó.
      if (!cu || !!cu.sanSang !== !!tt.sanSang) bao();
      /* Bản chụp ĐẦU TIÊN / slide đổi (bấm trong khung, engine tự chuyển…) ⇒ vẽ lại dải slide (kéo
         theo timeline — nó đếm slide của deck). Chỉ dải — bảng sửa dựng lại theo lời gọi của
         chính nó, dựng giữa lúc gõ là mất chữ đang gõ. */
      // Sân khấu canh iframe theo số đo của khung — nó tự chờ bản chụp đo đúng cỡ (san-khau.js).
      if (RP.sanKhau && RP.sanKhau.theoKhung) RP.sanKhau.theoKhung();
      if (!cu || cu.chiSo !== tt.chiSo || cu.soSlide !== tt.soSlide) {
        clearTimeout(henDai);
        henDai = setTimeout(() => { if (RP.sanKhau && RP.sanKhau.veDaiSlide) RP.sanKhau.veDaiSlide(); }, 30);
      }
      return;
    }
    if (d.__beeKhung === 'kq') {
      const f = cho.get(d.id);
      if (f) { cho.delete(d.id); f(d.loi ? null : d.kq); }
    }
  });

  /** Gửi một lệnh xuống khung → Promise kết quả (null khi hỏng / quá hạn / không có khung). */
  function lenh(tenLenh, a, han = 3000) {
    const w = cuaKhung();
    if (!w) return Promise.resolve(null);
    const id = ++soLenh;
    return new Promise((xong) => {
      cho.set(id, xong);
      try { w.postMessage({ __beeKhung: 'lenh', id, ten: tenLenh, a: a || {} }, '*'); } catch { cho.delete(id); xong(null); return; }
      setTimeout(() => { if (cho.has(id)) { cho.delete(id); xong(null); } }, han);
    });
  }

  /**
   * Đặt khung đang dùng. Gọi sau khi `<iframe>` phát `load`.
   * Truyền `null` khi đóng deck — để bảng sửa tự tắt thay vì bám vào khung chết.
   */
  function dat(f, deck) {
    khung = f || null;
    ten = deck || '';
    tt = null;
    bao();
    // Bản chụp gửi lúc khung nạp có thể tới TRƯỚC khi khung được đặt ở đây (bị bỏ) — xin lại.
    if (khung) lenh('ping');
  }

  /** Đã bỏ: khung khác origin, không với vào được. Giữ tên để chỗ gọi sót trả null thay vì nổ. */
  function cuaSo() { return null; }
  function taiLieu() { return null; }

  /**
   * Khung đã nạp xong engine chưa.
   *
   * ⚠ Kiểm ĐÚNG hàm của engine, đừng kiểm `.slide`: `.slide` nằm sẵn trong HTML tĩnh
   * của deck nên nó vẫn có kể cả khi engine chết — đúng cái bẫy đã ghi ở `slide-viewer.js`.
   */
  function sanSang() { return !!(tt && tt.sanSang); }

  function deck() { return ten; }

  /* ── đọc / ghi thiết lập ────────────────────────────────────────────────
     Hình dạng gói (đã đo): { project, settings: { theme, bgm, subtitles,
     visuals, slides } }. `visuals` là chỗ của bảng "Màu sắc video":
     colorMode · backgroundColor · gridEnabled · gridLight · iconGlow ·
     iconBacklight · iconLight · mainLight(+Position,+Intensity) ·
     softLight(+Position,+Intensity) · backgroundFx. */

  async function docThietLap(d) {
    const p = d || ten;
    if (!p) return null;
    const r = await fetch(`/api/preview-settings?project=${encodeURIComponent(p)}`);
    if (!r.ok) throw new Error(`Không đọc được thiết lập (${r.status})`);
    const goi = await r.json();
    return goi && goi.settings ? goi.settings : goi;
  }

  async function ghiThietLap(thietLap, d) {
    const p = d || ten;
    if (!p) throw new Error('Chưa chọn deck nào.');
    const r = await fetch('/api/preview-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: p, settings: thietLap }),
    });
    if (!r.ok) throw new Error(`Không lưu được thiết lập (${r.status})`);
    /* Thiết lập đổi là HÌNH của slide đổi ⇒ ảnh thu nhỏ trên dải thành cũ.
       Báo một tiếng ở ĐÚNG MỘT chỗ này thay vì rải lời gọi khắp bảng sửa: mọi
       đường lưu của bảng đều đi qua đây. Bên `san-khau.js` tự giãn nhịp, và
       tiến trình chính còn so chữ ký nữa nên gọi thừa cũng không tốn gì. */
    if (RP.sanKhau && RP.sanKhau.capNhatAnh) RP.sanKhau.capNhatAnh();
    return r.json().catch(() => ({}));
  }

  /**
   * Vẽ lại khung theo thiết lập mới — KHÔNG lưu.
   *
   * Tách hẳn khỏi `ghiThietLap`: kéo thanh trượt là gọi hàm này mỗi nhịp (rẻ), còn ghi
   * đĩa thì phải giãn nhịp. Trả `true` khi khung sẵn sàng nhận (lệnh chạy bất đồng bộ).
   */
  function apDung(thietLap) {
    if (!sanSang()) return false;
    lenh('apDung', { thietLap });
    return true;
  }

  /**
   * Áp riêng phần PHỤ ĐỀ (màu · cỡ · vị trí đáy · số dòng).
   *
   * ⚠ `applyVisualSettings()` KHÔNG đụng tới phụ đề — engine để việc đó ở một
   * hàm khác, `applySubtitleSettings()`, và chính nó mới đặt `--subtitle-bottom`
   * / `--subtitle-font-size` / `--subtitle-color`.
   *
   * ⚠ KHÔNG gọi `applyPreviewSettings()` cho tiện: hàm đó áp CẢ nhạc nền, mà
   * `applyBgmSettings()` có thể khởi động lại nhạc — kéo một thanh trượt là
   * nhạc giật mỗi nhịp.
   *
   * Lệnh đi theo THỨ TỰ gửi: `bien()` gọi ngay sau đây chạy SAU `applySubtitleSettings`
   * (bảng sửa cần đúng thứ tự đó — xem `apBienPhuDe`).
   */
  function apPhuDe(thietLap) {
    if (!sanSang()) return false;
    lenh('apPhuDe', { thietLap });
    return true;
  }

  /** Đặt biến CSS (`--subtitle-*`…) lên <html> của khung. */
  function bien(ds) {
    if (!cuaKhung()) return false;
    lenh('bien', { bien: ds || {} });
    return true;
  }

  /**
   * NGHE THỬ một thứ tiếng — gọi hàm của engine trong khung.
   *
   * ⚠ Dùng `setSlideTransition` / `setSlideReveal` chứ KHÔNG dùng `playSlideSound` /
   * `playRevealSound` trần (chúng đọc mảng RUNTIME cũ ⇒ ra đúng thứ tiếng vừa bỏ);
   * KHÔNG dùng `testTransition()` / `testReveal()` (bật luôn nhạc nền). Xem khung-cau.js.
   */
  function ngheThu(loai, giaTri) {
    if (!cuaKhung()) return false;
    lenh('ngheThu', { loai, giaTri });
    return true;
  }

  /**
   * Áp HIỆU ỨNG VIDEO vào khung NGAY, không đợi dựng lại trang — đổi lớp `bee-fx-*` trên
   * <html> (videoFx.js#themVideoFx gắn lúc dựng trang; CSS + JS luôn được chèn sẵn).
   * Nhận thẳng CHUỖI LỚP: bảng lựa chọn nằm bên `bang-sua`, chỉ MỘT nơi biết danh sách.
   */
  function apVideoFx(lop) {
    if (!cuaKhung()) return false;
    lenh('videoFx', { lop: String(lop || '') });
    return true;
  }

  /**
   * Đổi TÔNG / HIỆU ỨNG NỀN / ĐÈN — để CHÍNH ENGINE tính, đừng tự viết lại.
   *
   * `setToneVisual()` của engine: đổi `colorMode` thì ÉP `visuals.backgroundColor` + ghi
   * `theme.variables['--bg-dark']`; đèn lưu THEO TỪNG SLIDE (`visuals.slideLights`). Nhưng
   * nó KHÔNG GHI ĐƯỢC XUỐNG ĐĨA (cửa chốt `location.protocol.startsWith('http')` —
   * engine.js:1056) nên: **engine tính, bảng sửa chở bản chụp xuống đĩa**. Bản chụp là
   * thứ engine vừa ghi vào kho (localStorage giả của previewHtml.js).
   * @returns {Promise<object|null>} null khi deck không dùng engine chung.
   */
  function dungEngine(doiGi) {
    if (!sanSang()) return Promise.resolve(null);
    return lenh('dungEngine', { doiGi });
  }

  /** Giá trị đèn HIỆU LỰC của slide đang xem (đã gộp phần riêng của slide). */
  function denSlide() { return tt ? tt.den : null; }

  /**
   * Tới slide thứ `i`. Deck dùng engine chung: `goToSlide()`, nhảy được hai chiều. Deck tự
   * viết `app.js`: khung bấm dần tới đúng số (chỉ ĐI TỚI được). Trả `false` khi biết chắc
   * không tới được (lùi trên deck không có `goToSlide`); kết quả thật về theo bản chụp mới.
   */
  function toiSlide(i) {
    if (!cuaKhung()) return false;
    lenh('toiSlide', { i: i | 0 });
    return true;
  }

  /** `{ chiSo, tong }` của slide đang xem; `null` khi khung chưa sẵn sàng. */
  function slideHienTai() {
    if (!tt || !tt.soSlide) return null;
    return { chiSo: tt.chiSo, tong: tt.soSlide };
  }

  /** Số slide (`.slide`) của deck — 0 khi chưa có bản chụp. */
  function soSlide() { return tt ? tt.soSlide | 0 : 0; }
  /** Đã nhận bản chụp nào của khung hiện tại chưa. */
  function coTrangThai() { return !!tt; }
  /** Chữ (đã gọn) của từng slide — dùng làm nhãn ô trên dải slide. */
  function chuSlide() { return tt && Array.isArray(tt.chu) ? tt.chu : []; }
  /** Cỡ khung nhìn của khung `{ w, h }` LÚC đo bản chụp — biết số đo thuộc cỡ iframe nào. */
  function khungNhin() { return tt && tt.vp && tt.vp.w && tt.vp.h ? tt.vp : null; }
  /** Cỡ khung slide `{ w, h }` (px CSS trong khung) — null khi chưa đo được. */
  function kichThuoc() { return tt && tt.khung && tt.khung.w && tt.khung.h ? tt.khung : null; }
  /** Danh sách lựa chọn của `<select id>` trong khung: `[{ v, t }]`. */
  function mucChon(id) { return tt && tt.chon && Array.isArray(tt.chon[id]) ? tt.chon[id] : []; }
  /** Phụ đề xem trước của engine: có hàm bật không / đang chạy không. */
  function phuDe() { return { co: !!(tt && tt.coPhuDe), chay: !!(tt && tt.phuDeChay) }; }
  function batPhuDe(i) { if (cuaKhung()) lenh('batPhuDe', { i: i | 0 }); }
  /** Câm mọi audio/video trong khung (đang xem video thành phẩm đè lên). */
  function dungMedia() { if (cuaKhung()) lenh('dungMedia'); }
  /** Bấm nút tắt/bật tiếng của deck. `false` khi deck không có nút đó. */
  function bamTieng() {
    if (!(tt && tt.coNutTieng)) return false;
    lenh('bamTieng');
    return true;
  }
  /** Đổi tông sáng/tối của bảng sửa cũ trong khung (EDITOR_THEME_SCRIPT). */
  function doiTong(f, sang) {
    try { if (f && f.contentWindow) f.contentWindow.postMessage({ __beeKhung: 'lenh', id: 0, ten: 'tong', a: { sang: !!sang } }, '*'); } catch { /* khung đã gỡ */ }
  }

  function nghe(f) {
    nguoiNghe.add(f);
    return () => nguoiNghe.delete(f);
  }

  Object.assign(RP, {
    deckCau: {
      dat, cuaSo, taiLieu, sanSang, deck, docThietLap, ghiThietLap, apDung, apPhuDe, bien, apVideoFx, ngheThu, dungEngine,
      denSlide, toiSlide, slideHienTai, soSlide, coTrangThai, chuSlide, khungNhin, kichThuoc, mucChon, phuDe, batPhuDe, dungMedia, bamTieng, doiTong, nghe,
    },
  });
})();
