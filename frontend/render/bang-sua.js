'use strict';
/**
 * BẢNG SỬA — cột phải của trang dựng video.
 *
 * Trước 15/09/2026 bảng này nằm BÊN TRONG khung deck: `engine.js` dựng
 * `.theme-editor-panel` (dòng 1375) rồi `editor.js` Việt hoá và sắp lại. Nay nó
 * nằm ở cửa sổ app, còn bảng trong khung bị ẩn đi (xem `previewHtml.js`).
 *
 * ── VÌ SAO CHUYỂN RA ĐƯỢC ────────────────────────────────────────────────
 * Khung deck CÙNG ORIGIN với app, và `applyVisualSettings()` gọi từ ngoài mất
 * trung vị 0,1 ms (đo 60 lượt) — chi tiết ở `deck-cau.js`. Bảng chỉ là một cái
 * FORM trên một object JSON; engine mới là chỗ làm việc thật.
 *
 * ── HAI NGUYÊN TẮC, đừng phá ─────────────────────────────────────────────
 *
 * 1. **`apDung` ≠ `ghiThietLap`.** Kéo thanh trượt thì vẽ lại MỖI NHỊP (rẻ),
 *    còn ghi đĩa thì giãn nhịp `CHO_GHI_MS`. Gộp hai việc là mỗi nhịp kéo một
 *    lượt ghi tệp — và tệp đó có 9 nơi khác đang đọc.
 *
 * 2. **Danh sách lựa chọn ĐỌC TỪ ENGINE, không chép cứng.** Các `<select>` của
 *    engine vẫn nằm trong khung (chỉ bị ẩn), nên đọc thẳng `<option>` của nó.
 *    Chép cứng vào đây là engine thêm hiệu ứng mới mà bảng không có, và không
 *    có gì báo — đúng kiểu lệch đã lặp nhiều lần ở dự án này.
 */
(function () {
  const RP = (window.__renderPage = window.__renderPage || {});
  const $ = (s, g) => (g || document).querySelector(s);

  const CHO_GHI_MS = 400;
  const VI_TRI = [
    'top-left', 'top-left-mid', 'top-center', 'top-right-mid', 'top-right',
    'center-left', 'center-left-mid', 'center', 'center-right-mid', 'center-right',
    'bottom-left', 'bottom-left-mid', 'bottom-center', 'bottom-right-mid', 'bottom-right',
  ];
  const DO_SANG = ['low', 'medium', 'high', 'max', 'ultra'];

  let st = null;          // thiết lập đang sửa
  /* Tab đang mở NHỚ qua lần mở app (rà L5 16/10/2026 — trước luôn về "Nội dung"). Chỉ hai tab của bảng
     này; "Thuộc tính" / "Thư viện" là tab riêng (tab-phai.js). */
  const KHOA_TAB = 'bee:bang-phai:tab';
  let tab = 'mau';
  try { if (localStorage.getItem(KHOA_TAB) === 'amthanh') tab = 'amthanh'; } catch { /* không có kho */ }
  /* Lời thoại đang gõ mà CHƯA lưu xong ({ deck, chiSo, val }) — lượt vẽ lại giữa chừng (lệnh engine…) phải
     giữ chữ này, không thì hiện lại bản cũ của `st` (ghiScript chỉ cập nhật `st` khi lưu xong).
     ⚠ GẮN THEO DECK (rà GĐ1): chỉ có chiSo thì bản nháp của deck A hiện ở slide cùng số của deck B, và lần
     rời ô kế tiếp ghi nó vào script-90s.txt của deck B. Mọi lối kết thúc lưu (xong, không đổi, dòng trống,
     hỏng) đều xoá nháp; đổi deck cũng xoá (napLai). */
  let scriptDangGo = null;
  /* Đổi slide trong lúc con trỏ đang ở ô lời thoại: đợi rời ô rồi mới vẽ lại ô (thay ô là mất con trỏ giữa câu). */
  let choCapNhatScript = false;
  let phamVi = 'tatca';   // 'tatca' | 'slide'
  let denDangXem = 0;     // 0 | 1 — hai ngọn đèn chia hai tab con cho gọn
  let hen = null;

  /* ── đọc/ghi theo đường chấm ('visuals.mainLight') ───────────────────── */
  function doc(duong) {
    return duong.split('.').reduce((o, k) => (o == null ? o : o[k]), st);
  }
  function ghi(duong, v) {
    const k = duong.split('.');
    let o = st;
    for (let i = 0; i < k.length - 1; i += 1) {
      if (o[k[i]] == null || typeof o[k[i]] !== 'object') o[k[i]] = {};
      o = o[k[i]];
    }
    o[k[k.length - 1]] = v;
  }

  /** Slide đang xem (0 khi chưa biết) — dùng cho phạm vi "Slide này". */
  function slideSo() {
    const s = RP.deckCau.slideHienTai();
    return s && s.chiSo >= 0 ? s.chiSo : 0;
  }

  /**
   * Lựa chọn của một `<select>` do ENGINE dựng, đọc từ khung deck.
   * Trả `[]` khi khung chưa sẵn sàng — chỗ gọi tự bỏ qua ô đó.
   */
  /**
   * Danh sách lựa chọn của một ô: ưu tiên mảng VIẾT CỨNG (`o.muc`, dùng cho
   * phông chữ phụ đề — engine không có `<select>` nào cho thứ đó), không có
   * thì đọc `<select>` của engine như cũ.
   */
  function mucCuaO(o) {
    if (o && Array.isArray(o.muc) && o.muc.length) return o.muc;
    return mucTuEngine(o && o.nguon);
  }

  /* Khung deck ở origin riêng — lựa chọn của `<select>` engine đến qua bản chụp trạng thái
     của khung (deck-cau.js#mucChon), không đọc thẳng DOM khung được nữa. */
  function mucTuEngine(id) {
    return RP.deckCau.mucChon(id).map((o) => ({ v: o.v, t: o.t }));
  }

  /* ── mô tả các ô ────────────────────────────────────────────────────────
     `duong` là đường vào object thiết lập. `nguon` là id `<select>` của engine
     để lấy danh sách lựa chọn. `moiSlide` = ô này là MẢNG theo slide. */
  /* BỐN tab. Tab "Hiệu ứng" đã bỏ (15/09/2026): hai ô hiệu ứng nền/video về
     "Nội dung" vì chúng là HÌNH, còn hai ô tiếng chuyển slide / tiếng hiện từng
     phần về "Âm thanh" vì chúng là TIẾNG. Chia theo giác quan chứ không theo
     chỗ chúng tình cờ nằm trong tệp thiết lập. */
  const TAB = [
    /* ⚠ Tên icon phải CÓ THẬT trong `icons.js` (61 cái). Sai tên thì `apply()`
       lặng lẽ không vẽ gì — tab hiện ra trơ mỗi chữ, không lỗi nào báo. Bản đầu
       đặt 'pha' (không có trong bộ) nên tab Nội dung mất icon (15/09/2026). */
    { ma: 'mau', ten: 'Nội dung', icon: 'slide' },
    { ma: 'amthanh', ten: 'Âm thanh', icon: 'nhac' },
    /* Tab "Phụ đề" ĐÃ GỠ (16/10/2026, GĐ1 lộ trình gộp slide + timeline): lời thoại → đầu tab "Nội dung";
       bật/tắt → nút 👁 ở track C1; kiểu chữ, chép toàn bộ → tab "Thuộc tính" khi bấm C1 / một câu phụ đề
       (render/kieu-phu-de.js — MỘT bộ chỉnh cho deck lẫn dự án video). */
    /* ⚠ TAB "Cài đặt" ĐÃ BỎ (16/09/2026). Nó chỉ còn là chỗ chứa form dựng
       video, mà form đó nay chia đôi: phần giọng đọc sang tab "Âm thanh", phần
       tuỳ chỉnh + nút Tạo video vào HỘP THOẠI mở từ thanh trên. Không còn gì
       thuộc về một tab riêng.
       ⚠ `.render-machine` VẪN SỐNG trong `.dashboard-shell` (ẩn) — mọi trình
       xử lý của `tts-panel.js`/`jobs.js` nằm trong đó. Đừng gỡ nó. */
  ];

  const O = {
    /* Thứ tự theo ảnh mẫu chủ dự án gửi: hai ô hiệu ứng lên trên cùng, rồi hai
       ngọn đèn, rồi mới tới tông và các màu lẻ. */
    mau: [
      /* Lời thoại của slide đang xem — dời từ tab Phụ đề (16/10/2026): nó là NỘI DUNG của slide. Đổi slide
         thì chỉ ô này vẽ lại (doiSlide → capNhatScript), không cả tab (mất cú kéo thanh trượt). */
      { loai: 'script', nhan: 'Lời thoại slide này', icon: 'doc' },
      { loai: 'chon', nhan: 'Hiệu ứng nền', icon: 'sao', duong: 'visuals.backgroundFx', nguon: 'backgroundFxSelect', nhom: 'hieuung' },
      /* `videoFx` nằm ở CẤP CAO NHẤT của thiết lập, không phải trong `visuals` —
         `recordingHtml.js` đọc `previewSettings.videoFx`. Đặt nhầm vào `visuals`
         thì bảng vẫn chạy mà lượt dựng không có hiệu ứng nào. */
      { loai: 'chon', nhan: 'Hiệu ứng video', icon: 'phim', duong: 'videoFx', nguon: 'videoFxSelect', khongVeLai: true, nhom: 'hieuung' },
      /* HAI ngọn đèn trong MỘT khối có tab con. Xếp dọc thì mỗi ngọn chiếm gần
         nửa màn hình (màu + 5 mức sáng + lưới 15 vị trí), phải cuộn mới thấy
         ngọn thứ hai — mà người ta hay chỉnh hai ngọn so với nhau. */
      { loai: 'den2', nhom: 'den',
        den: [
          { nhan: 'Ánh sáng nền 1', icon: 'sun', mauDuong: 'visuals.mainLight', viTriDuong: 'visuals.mainLightPosition', sangDuong: 'visuals.mainLightIntensity' },
          { nhan: 'Ánh sáng nền 2', icon: 'sun', mauDuong: 'visuals.softLight', viTriDuong: 'visuals.softLightPosition', sangDuong: 'visuals.softLightIntensity' },
        ] },
      /* ⚠ ĐÃ THỬ THÊM Ô "BỘ MÀU" Ở ĐÂY (16/09/2026) RỒI GỠ — đừng thêm lại theo
         cách đó. Ý định: `theme.preset` có backend sống (đường dựng video đọc
         `theme.variables`, xem `recordingHtml.js#themeCssFromSettings`) nhưng từ
         lúc gộp trang thì không còn nút nào đổi được. Cách thử: đọc danh sách từ
         `<select id="themePresetSelect">` của deck, như mấy ô hiệu ứng vẫn làm.
         KHÔNG CHẠY: đo được trang deck chỉ có 8 `<select>` (bgm · transition ·
         reveal · backgroundFx · videoFx và ba bản `editor*`) — bảng màu chủ đề
         KHÔNG được engine dựng ra, nên ô hiện lên rỗng.
         Muốn làm thật thì phải có danh sách bộ màu từ một nguồn khác; chép bảng
         `themePresets` của engine sang đây là đẻ ra bản sao thứ hai sẽ lệch. */
      { loai: 'tong', nhan: 'Tông màu', icon: 'tuongphan', icoXanh: true, nhom: 'tong', duong: 'visuals.colorMode', muc: [{ v: 'dark', t: 'Tối' }, { v: 'cream', t: 'Kem' }] },
      /* ⚠ "Màu nền" ĐỂ LẠI, và để CHỈ ĐỌC.
         Engine suy nó ra từ tông (`#fff3df` kem / `#07111e` tối) rồi ghi đè mỗi
         lần đổi tông — cho sửa là hứa một thứ sẽ bị xoá ngay lần bấm kế tiếp.
         Nhưng BỎ HẲN thì đổi tông xong bảng màu bên dưới trông như không đổi gì,
         vì đây đúng là ô DUY NHẤT tông làm đổi. Hiện ra, khoá lại, ghi rõ lý do. */
      { loai: 'mauKhoa', nhan: 'Màu nền', icon: 'nen', duong: 'visuals.backgroundColor', nhom: 'tong',
        mach: 'Suy ra từ Tông màu — đổi tông thì màu này đổi theo' },
      /* MỘT HÀNG, hai điều khiển: công tắc bật/tắt rồi tới ô màu. Hai thứ này
         nói về CÙNG một cái lưới — tách làm hai hàng thì "Màu lưới" đứng riêng
         trông như một thứ khác, mà tắt lưới rồi nó vẫn ngồi đó. */
      { loai: 'batMau', nhan: 'Lưới nền', icon: 'khung', nhom: 'tong',
        duong: 'visuals.gridEnabled', duongMau: 'visuals.gridLight' },
      { loai: 'mau', nhan: 'Viền sáng icon', icon: 'sao', duong: 'visuals.iconGlow', nhom: 'tong' },
      { loai: 'mau', nhan: 'Hắt sáng icon', icon: 'sun', duong: 'visuals.iconBacklight', nhom: 'tong' },
      { loai: 'mau', nhan: 'Đèn icon', icon: 'bolt', duong: 'visuals.iconLight', nhom: 'tong' },
    ],
    amthanh: [
      { loai: 'chon', nhan: 'Nhạc nền', mo: 'Chọn nhạc nền cho video', icon: 'nhac',
        duong: 'bgm.preset', nguon: 'bgmSelect', nghe: 'bgm', nhom: 'nhac' },
      { loai: 'truot', nhan: 'Âm lượng', icon: 'amluong', duong: 'bgm.volume', min: 0, max: 0.3, step: 0.01, donVi: '%', nhan100: true, motHang: true, nhom: 'nhac' },
      { loai: 'chon', nhan: 'Tiếng chuyển slide', mo: 'Khi chuyển giữa các slide', icon: 'slide',
        duong: 'slides.transitionSounds', nguon: 'transitionSelect', moiSlide: true, nghe: 'chuyen', nhom: 'tieng' },
      { loai: 'chon', nhan: 'Tiếng hiện từng phần', mo: 'Khi một phần tử hiện ra', icon: 'sao',
        duong: 'slides.revealSounds', nguon: 'revealSelect', moiSlide: true, nghe: 'hien', nhom: 'tieng' },
    ],
    /* `phude` ĐÃ GỠ cùng tab Phụ đề — xem chú thích ở TAB. */
  };
  /**
   * Trả form dựng video về `.dashboard-shell` (ở đó CSS ẩn nó đi).
   *
   * Tab "Cài đặt" DỜI nguyên nút DOM `.render-machine` vào bảng chứ không dựng
   * lại — `tts-panel.js` và `jobs.js` giữ tham chiếu thẳng vào các ô bên trong.
   * Nên trước mỗi lượt vẽ phải đưa nó ra khỏi `#bsThan`, không thì
   * `than.innerHTML = …` xoá luôn nó khỏi tài liệu.
   */
  function traFormVeCho(keCaHopTao) {
    /* Form có thể đang ở tab "Âm thanh" HOẶC trong hộp thoại Tạo video.
       ⚠ MẶC ĐỊNH KHÔNG ĐỤNG TỚI HỘP ĐANG MỞ. Bản trước quét cả hai chỗ vô điều
       kiện, mà `ve()` lại mở đầu bằng chính hàm này — nên BẤT KỲ lượt vẽ lại
       nào cũng lôi form ra khỏi hộp đang mở, để trơ lại mỗi thanh tiêu đề.
       Đo 19/09/2026, tái hiện được bằng cả ba đường có thật: `ve()`,
       `doiSlide()` (bấm sang slide khác) và `napLai()` (deck báo đổi) — thân
       hộp tụt từ 1 con / 204px xuống 0 con / 22px. Chủ dự án gặp đúng cảnh
       này, cả lúc vừa mở hộp lẫn lúc đang dựng mà hộp nhảy sang bước kế.
       Chỉ `dongHopTao()` mới được truyền `true`: lúc đó hộp sắp biến mất nên
       form BẮT BUỘC phải ra, không thì nó bị gỡ khỏi tài liệu theo hộp. */
    const form = document.querySelector(keCaHopTao
      ? '#bsChoGiong .render-machine, #bsHopThan .render-machine'
      : '#bsChoGiong .render-machine');
    if (!form) return;
    const shell = document.querySelector('.dashboard-shell');
    if (shell) shell.appendChild(form);
  }

  /* ── HỘP THOẠI "TẠO VIDEO" ───────────────────────────────────────────────
   *
   * Bấm "Tạo video" trên thanh trên KHÔNG dựng ngay nữa: mở hộp này để chọn
   * tốc độ đọc và độ phân giải trước, rồi bấm nút Tạo video TRONG hộp mới chạy
   * thật.
   *
   * ⚠ Hộp chứa CHÍNH `.render-machine`, dời nút DOM vào chứ không dựng lại —
   * cùng lý do với hai tab kia: `tts-panel.js`, `jobs.js`, `render-layout.js`
   * giữ tham chiếu thẳng vào các ô trong đó, và 108 luật CSS neo theo
   * `.render-machine`. Nút "Tạo video" trong hộp là CHÍNH `#startRender` thật,
   * không phải bản sao — nên mọi trạng thái (đang dựng, hàng đợi, tiến độ) tự
   * đúng, không phải đồng bộ gì.
   */
  let hopTao = null;

  function dongHopTao() {
    if (!hopTao) return;
    traFormVeCho(true);   // hộp sắp bị gỡ — phải kéo form ra TRƯỚC
    hopTao.remove();
    hopTao = null;
    document.removeEventListener('keydown', phimHopTao, true);
    // Panel đang mở tab nào thì vẽ lại tab đó — form vừa rời khỏi hộp.
    ve();
  }

  function phimHopTao(e) {
    if (e.key === 'Escape') { e.preventDefault(); dongHopTao(); }
  }

  function moHopTao() {
    if (hopTao) return;
    const form = document.querySelector('.render-machine');
    if (!form) return;
    hopTao = document.createElement('div');
    hopTao.className = 'bs-hop';
    hopTao.id = 'bsHopTao';
    hopTao.innerHTML = '<div class="bs-hop-nen" data-dong></div>'
      + '<div class="bs-hop-khung" role="dialog" aria-modal="true" aria-label="Tạo video">'
      + '<div class="bs-hop-dau"><span class="btn-icon" data-icon="play"></span>'
      + '<strong>Tạo video</strong>'
      /* Nút MỞ THƯ MỤC VIDEO nằm cùng dòng tiêu đề, sát nút đóng. Video vừa
         dựng xong nằm trong thư mục đó, mà hàng nút thật thì trôi xuống cuối
         bảng tiến độ — người ta phải cuộn mới thấy. */
      + '<button class="bs-hop-tm" type="button" id="bsHopThuMuc"'
      + ' title="Mở thư mục chứa video" aria-label="Mở thư mục chứa video">'
      + '<span class="btn-icon" data-icon="folder"></span></button>'
      + '<button class="bs-hop-x" type="button" data-dong aria-label="Đóng">×</button></div>'
      + '<div class="bs-hop-than" id="bsHopThan"></div></div>';
    document.body.appendChild(hopTao);
    /* Phụ đề đang TẮT (nút 👁 track C1): từ 16/10/2026 video dựng ra KHÔNG có phụ đề — trước cờ này chỉ ẩn
       xem trước. Deck cũ từng tắt công tắc mà không biết sẽ bất ngờ ⇒ nói ngay trong hộp. */
    if (!phuDeBat()) {
      const canh = document.createElement('div');
      canh.className = 'bs-hop-canh';
      canh.textContent = 'Phụ đề đang TẮT — video sẽ không có phụ đề (vẫn xuất tệp .srt). Bật lại bằng nút mắt ở đầu track C1 (Phụ đề) dưới timeline.';
      hopTao.querySelector('#bsHopThan').appendChild(canh);
    }
    hopTao.querySelector('#bsHopThan').appendChild(form);
    hopTao.querySelectorAll('[data-dong]').forEach((x) => { x.onclick = dongHopTao; });
    /* BẤM HỘ `#revealOutput` trong form, không gọi lại API — cùng lối với nút
       thư mục ở thanh phát (`thanh-phat.js`). Mọi trạng thái "có video chưa"
       vẫn do một mình form quyết, không đẻ ra nguồn sự thật thứ hai. */
    const nutTm = hopTao.querySelector('#bsHopThuMuc');
    if (nutTm) {
      const co = !!(RP.thanhPhat && RP.thanhPhat.coVideo && RP.thanhPhat.coVideo());
      nutTm.disabled = !co;
      if (!co) nutTm.title = 'Chưa có video nào trong thư mục';
      nutTm.onclick = () => {
        const r = document.querySelector('#revealOutput');
        if (r) r.click();
      };
    }
    if (window.__beeIcons) window.__beeIcons.apply(hopTao);
    document.addEventListener('keydown', phimHopTao, true);
    /* ⚠ VẼ LẠI BẢNG SỬA sau khi đã nhấc form đi.
       Form vừa rời khỏi tab Âm thanh, mà `moHopTao()` không đụng gì tới
       `#bsThan` nên tab đó GIỮ NGUYÊN bộ khung cũ với một `#bsChoGiong` rỗng
       — đúng cái khoảng trắng 330px chủ dự án thấy. Lời nhắn thay chỗ chỉ
       dựng được trong `ve()`, nên phải gọi nó ở đây chứ không đợi lượt vẽ sau.
       An toàn: `ve()` lúc `hopTao` đang có thì KHÔNG đòi form về (xem
       `traFormVeCho` và nhánh `amthanh`), nên không có vòng lặp nào.
       ⚠ CHỈ TAB ÂM THANH, không vẽ lại vô điều kiện. `ve()` dựng lại TOÀN BỘ
       `#bsThan` từ `st` trong bộ nhớ, mà ô lời thoại ở tab Phụ đề chỉ ghi vào
       `st` SAU khi lượt lưu (hẹn 900 ms) chạy xong — gõ xong bấm Tạo video
       ngay là ô bị dựng lại bằng chữ CŨ, người dùng thấy như mất chữ. Đo
       23/09/2026: chữ vừa gõ biến mất thật. Chỉ tab Âm thanh mới có lời nhắn
       cần dựng, nên chỉ nó cần vẽ lại. */
    if (tab === 'amthanh') ve();
  }

  /* ⚠ PHẦN GIỌNG ĐỌC: KHÔNG dời nút DOM ra khỏi `.render-machine`.
     Bản đầu (16/09/2026) gom `.rl-giong`, `.tabs`, `[data-pane]` và ba khối
     `[data-advanced-engine]` vào một thẻ bọc rồi dời sang tab Âm thanh. Hỏng ba
     lần liên tiếp vì cùng MỘT lý do: **108 luật CSS neo theo `.render-machine`**
     (đếm trong `render-layout.css`). Ra khỏi tổ tiên đó là đứt sạch — hai công
     tắc cũ hiện lại, và cả danh sách chọn giọng mất `position: fixed`, mất nền,
     mất bố cục hàng, đổ thành một đống chữ chồng nhau giữa bảng.
     Cách đang dùng: DỜI CẢ `.render-machine` sang tab Âm thanh (đúng như tab
     Cài đặt vẫn làm), rồi để CSS ẩn phần không thuộc về tab đó — xem
     `#bsChoGiong` / `#bsHopThan` trong `bien-tap.css`. Mọi luật cũ giữ nguyên
     hiệu lực vì không nút nào rời khỏi `.render-machine`. */

  /* ── Những khoá PHẢI đi qua engine ───────────────────────────────────
     Xem `deckCau.dungEngine()` để biết vì sao: đổi tông thì engine ép luôn màu
     nền + biến `--bg-dark`, còn đèn thì nó lưu THEO TỪNG SLIDE. Tự ghi thẳng
     vào `visuals.*` là mất cả hai. */
  const QUA_ENGINE = {
    'visuals.colorMode': 'colorMode',
    'visuals.backgroundFx': 'backgroundFx',
    'visuals.mainLight': 'mainLight',
    'visuals.mainLightPosition': 'mainLightPosition',
    'visuals.mainLightIntensity': 'mainLightIntensity',
    'visuals.softLight': 'softLight',
    'visuals.softLightPosition': 'softLightPosition',
    'visuals.softLightIntensity': 'softLightIntensity',
  };

  /* ── vẽ lại + lưu ───────────────────────────────────────────────────── */
  /* ── HOÀN TÁC / LÀM LẠI ───────────────────────────────────────────────
     Ngăn xếp các BẢN CHỤP thiết lập, không phải nhật ký thao tác: mỗi thay đổi
     ở đây rốt cuộc chỉ là một object JSON khác đi, nên chụp lại nguyên bản là
     đủ và không bao giờ lệch. Chặn 30 bản cho khỏi phình.

     ⚠ Đẩy bản TRƯỚC khi đổi, và chỉ đẩy khi có thay đổi THẬT — `ve()` chạy
     mỗi lần đổi deck hay đổi tab, đẩy ở đó là ngăn xếp đầy toàn bản giống nhau. */
  const SUC_CHUA = 30;
  let lichSu = [];
  let lamLaiDuoc = [];
  let lucLuu = 0;

  const chep = (o) => JSON.parse(JSON.stringify(o));

  function nhoTruocKhiDoi() {
    if (!st) return;
    lichSu.push(chep(st));
    if (lichSu.length > SUC_CHUA) lichSu.shift();
    lamLaiDuoc = [];      // nhánh mới thì bỏ đường làm lại cũ
    if (RP.thanhTren) RP.thanhTren.veNutSua();
  }

  async function veBan(ban) {
    st = ban;
    RP.deckCau.apDung(st);
    ve();
    try { await RP.deckCau.ghiThietLap(st); lucLuu = Date.now(); }
    catch (e) { trangThai('Không lưu được: ' + e.message, true); }
    if (RP.thanhTren) { RP.thanhTren.veNutSua(); RP.thanhTren.veTrangThaiLuu(); }
  }

  function hoanTac() {
    if (!lichSu.length) return;
    if (st) lamLaiDuoc.push(chep(st));
    veBan(lichSu.pop());
  }
  function lamLai() {
    if (!lamLaiDuoc.length) return;
    if (st) lichSu.push(chep(st));
    veBan(lamLaiDuoc.pop());
  }
  const coHoanTac = () => lichSu.length > 0;
  const coLamLai = () => lamLaiDuoc.length > 0;
  const lucLuuCuoi = () => lucLuu;

  function apNgay() {
    RP.deckCau.apDung(st);
  }
  function henGhi() {
    if (hen) clearTimeout(hen);
    hen = setTimeout(async () => {
      hen = null;
      try {
        await RP.deckCau.ghiThietLap(st);
        lucLuu = Date.now();
        /* ⚠ BÁO "ĐÃ LƯU" CHỈ MỘT CHỖ — ở thanh trên (`#tbLuu`). Trước đây báo
           cả hai: thanh trên VÀ dòng trạng thái đáy bảng sửa, cùng một lúc,
           cùng một nghĩa. Thanh trên hơn hẳn vì nó còn đếm thời gian ("vừa
           xong" → "3 phút trước") và không biến mất sau 2,2 giây.
           `trangThai()` VẪN GIỮ cho những thứ KHÔNG trùng: câu lỗi lưu hỏng,
           "Đã chép phụ đề"… — gỡ hẳn là mất chỗ báo lỗi. */
        if (RP.thanhTren) RP.thanhTren.veTrangThaiLuu();
      } catch (e) { trangThai('Không lưu được: ' + e.message, true); }
    }, CHO_GHI_MS);
  }
  /* ── Ô LỜI THOẠI ─────────────────────────────────────────────────────
     ⚠ ĐỌC LẠI NGAY TRƯỚC KHI GHI, và nối thành CHUỖI để hai lượt ghi không
     bao giờ chạy song song. Mỗi lượt lưu là đọc-sửa-ghi cả mảng dòng; hai lượt
     chồng nhau thì lượt sau đọc phải bản CHƯA có sửa đổi của lượt trước rồi ghi
     đè lên. Bản cũ trong `editor.js` đã dựng lại được lỗi này: gõ hai lần liền
     nhau, tệp ra một nội dung không giống lần gõ nào. */
  let chuoiGhi = Promise.resolve();
  let henScript = null;

  function ghiScript(chiSo, dong, bao, deckLuc) {
    /* Deck của LÚC GÕ, không phải lúc bộ hẹn giờ chạy — gõ rồi đổi deck trong 900 ms từng ghi dòng của
       deck A vào script của deck B (rà GĐ1, có từ trước). */
    const deck = deckLuc || RP.deckCau.deck();
    const cau = String(dong || '').replace(/\s+/g, ' ').trim();
    const xoaNhap = () => {
      if (scriptDangGo && scriptDangGo.deck === deck && scriptDangGo.chiSo === chiSo) scriptDangGo = null;
    };
    if (!deck) return;
    if (!cau) { xoaNhap(); bao('Dòng đang trống — chưa lưu'); return; }
    bao('Đang lưu…');
    chuoiGhi = chuoiGhi.catch(() => {}).then(async () => {
      try {
        const r = await fetch(`/api/slide-script?project=${encodeURIComponent(deck)}`);
        const d = await r.json();
        const ds = (d && d.lines) || [];
        if (chiSo < 0 || chiSo >= ds.length) throw new Error('Số slide không khớp');
        if (ds[chiSo] === cau) { xoaNhap(); bao('Đã lưu'); return; }
        ds[chiSo] = cau;
        const w = await fetch('/api/slide-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project: deck, lines: ds }),
        });
        const res = await w.json().catch(() => ({}));
        if (res && res.error) throw new Error(res.error);
        // Giữ bản trong bộ nhớ khớp đĩa, không thì lượt vẽ sau hiện lại dòng cũ.
        if (st && st.slides && RP.deckCau.deck() === deck) st.slides.scriptLines = ds;
        xoaNhap();
        bao('Đã lưu');
      } catch (e) { xoaNhap(); bao('Chưa lưu được: ' + (e.message || e)); }
    });
  }

  /**
   * Lớp `bee-fx-*` cho một khoá hiệu ứng video — cùng phép tính với
   * `videoFx.js#lopCua` bên tiến trình chính.
   *
   * `'none'` → không lớp nào. `'all'` → TẤT CẢ hiệu ứng thật, tức mọi khoá
   * trong danh sách trừ chính `none` và `all`. Danh sách lấy từ ô chọn nên
   * thêm hiệu ứng mới bên `videoFx.js` là chỗ này tự có.
   */
  function lopVideoFx(khoa, o) {
    if (!khoa || khoa === 'none') return '';
    if (khoa !== 'all') return 'bee-fx-' + khoa;
    return mucCuaO(o).map((m) => m.v)
      .filter((k) => k && k !== 'none' && k !== 'all')
      .map((k) => 'bee-fx-' + k).join(' ');
  }

  /**
   * Áp mọi khoá PHỤ ĐỀ mà ENGINE KHÔNG BIẾT, thẳng vào biến CSS của khung.
   *
   * Engine chỉ hiểu 6 khoá (enabled · color · activeColor · fontSize · bottom ·
   * maxLines). Còn lại — phông, đậm, nghiêng, gạch chân, căn lề, vị trí trên/
   * dưới, viền chữ, nền chữ — là biến CSS do app đặt ra, cùng tên với đường
   * dựng video (`recordingHtml.js#subtitleCssFromSettings`). Không đặt ở đây
   * thì đổi xong khung không nhúc nhích, dù đĩa và video đều đúng.
   *
   * ⚠ PHẢI CHẠY SAU `apPhuDe()`. Engine đặt `--subtitle-bottom` mỗi lần được
   * gọi; vị trí "Trên cùng" cần ghi đè biến đó thành `auto`, chạy trước là bị
   * engine ghi đè lại ngay và phụ đề vẫn dính đáy.
   *
   * ⚠ Ghi TOÀN BỘ chứ không chỉ khoá vừa đổi: mấy khoá này phụ thuộc lẫn nhau
   * (vị trí ↔ khoảng cách, màu nền ↔ độ mờ). Đặt lẻ từng cái là có tổ hợp lệch.
   */
  function apBienPhuDe() {
    if (!st || !RP.deckCau.sanSang()) return;
    const sub = (st && st.subtitles) || {};
    // Gom lại rồi gửi MỘT lệnh xuống khung (origin riêng) — chạy sau `apPhuDe` vì lệnh đi theo thứ tự.
    const bo = {};
    const dat = (k, v) => { bo[k] = v; };
    const laMau = (x) => typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x.trim());

    dat('--subtitle-font', typeof sub.fontFamily === 'string' ? sub.fontFamily : '');
    dat('--subtitle-weight', sub.bold === false ? '500' : '950');
    dat('--subtitle-style', sub.italic === true ? 'italic' : 'normal');
    dat('--subtitle-deco', sub.underline === true ? 'underline' : 'none');
    const CAN = { trai: 'flex-start', giua: 'center', phai: 'flex-end' };
    dat('--subtitle-align', CAN[sub.align] || 'center');

    const cach = Number(sub.bottom);
    if (cach >= 40 && cach <= 180) {
      if (sub.position === 'tren') { dat('--subtitle-top', cach + 'px'); dat('--subtitle-bottom', 'auto'); }
      else { dat('--subtitle-top', 'auto'); dat('--subtitle-bottom', cach + 'px'); }
    }

    if (laMau(sub.outlineColor)) {
      dat('--subtitle-outline', sub.outlineColor.trim());
      dat('--subtitle-outline-w', '0.045em');
    } else {
      dat('--subtitle-outline-w', '0');
    }

    const doMo = Math.round(Number(sub.bgOpacity) || 0);
    if (doMo >= 1 && doMo <= 100) {
      dat('--subtitle-bg-color', laMau(sub.bgColor) ? sub.bgColor.trim() : '#000000');
      dat('--subtitle-bg-alpha', String(doMo));
      dat('--subtitle-bg-dem', '0.12em 0.5em');
      dat('--subtitle-bg-bo', '0.25em');
    } else {
      dat('--subtitle-bg-alpha', '0');
      dat('--subtitle-bg-dem', '0');
      dat('--subtitle-bg-bo', '0');
    }
    RP.deckCau.bien(bo);
  }

  function doi(duong, v, o) {
    nhoTruocKhiDoi();
    const khoaEngine = QUA_ENGINE[duong];
    if (khoaEngine && RP.deckCau.sanSang()) {
      /* Khung ở origin riêng ⇒ engine trả bản chụp qua postMessage (bất đồng bộ). Lệnh đi và
         về theo đúng thứ tự gửi, nên kéo thanh trượt nhanh vẫn ra bản chụp cuối cùng. */
      RP.deckCau.dungEngine({ [khoaEngine]: v }).then((chup) => {
        if (chup) {
          /* Bản chụp của engine ĐÚNG cho tông / đèn — nhưng `normalizeSubtitleSettings` của engine chỉ giữ 6 khoá
             phụ đề (enabled, color, activeColor, fontSize, bottom, maxLines). Gán thẳng là phông, đậm, căn lề,
             vị trí, viền, nền… (bộ chỉnh phụ đề — kieu-phu-de.js) BỊ XOÁ khỏi preview-settings.json ở lần ghi kế
             (rà GĐ1). Giữ mọi khoá cũ, để engine đè đúng phần nó biết. */
          st = { ...(st || {}), ...chup, subtitles: { ...((st && st.subtitles) || {}), ...(chup.subtitles || {}) } };
          henGhi();
          ve();               // màu nền / đèn có thể đã đổi theo, vẽ lại cho khớp
          return;
        }
        // Engine không nhận (deck không dùng engine chung) — ghi thẳng như cũ.
        doiThang(duong, v, o);
      });
      return;
    }
    doiThang(duong, v, o);
  }

  function doiThang(duong, v, o) {
    if (o && o.moiSlide) {
      const ds = doc(duong);
      const arr = Array.isArray(ds) ? ds.slice() : [];
      if (phamVi === 'slide') {
        arr[slideSo()] = v;
      } else {
        /* ⚠ Phải ghi ĐỦ SỐ SLIDE THẬT, không chỉ `arr.length`. Mảng này rỗng ở
           deck chưa từng đặt tiếng, nên `Math.max(arr.length, 1)` cũ chỉ ghi
           được slide 1 — chọn "Toàn bộ video" mà chín slide sau vẫn im. */
        const dang = RP.deckCau && RP.deckCau.slideHienTai();
        const tong = Math.max(arr.length, (dang && dang.tong) || 0, 1);
        for (let i = 0; i < tong; i += 1) arr[i] = v;
      }
      ghi(duong, arr);
    } else {
      ghi(duong, v);
    }
    /* Phụ đề đi đường riêng của engine — xem `deckCau.apPhuDe()`. */
    if (String(duong).startsWith('subtitles.')) {
      RP.deckCau.apPhuDe(st);
      apBienPhuDe();   // PHẢI sau apPhuDe, xem chú thích trong hàm
    }
    /* HIỆU ỨNG VIDEO: engine không biết nó là gì, nên `apNgay()` (đi qua
       `applyVisualSettings`) không đụng tới. Phải tự gắn lớp `bee-fx-*` lên thẻ
       <html> của khung — xem `deckCau.apVideoFx()`. Suy lớp NGAY Ở ĐÂY vì đây
       là nơi có bảng lựa chọn (đọc từ `<select>` của deck). */
    if (duong === 'videoFx') RP.deckCau.apVideoFx(lopVideoFx(v, o));
    if (!(o && o.khongVeLai)) apNgay();
    henGhi();
  }
  function giaTri(o) {
    if (o.moiSlide) {
      const ds = doc(o.duong);
      return Array.isArray(ds) ? (ds[phamVi === 'slide' ? slideSo() : 0] || '') : '';
    }
    return doc(o.duong);
  }

  function trangThai(chu, loi) {
    const el = $('#bsTrangThai');
    if (!el) return;
    el.textContent = chu;
    el.classList.toggle('bs-loi', !!loi);
    el.hidden = false;
    clearTimeout(trangThai._t);
    trangThai._t = setTimeout(() => { el.hidden = true; }, 2200);
  }

  /** Nhãn kèm icon. Tên icon sai thì `icons.js` lặng lẽ bỏ qua — xem chú ở TAB. */
  /* `o.icoXanh` = tô icon màu xanh biển. Dùng cho MỐC MỞ ĐẦU của một khối
     riêng (Ánh sáng nền · Tông màu): mắt bắt được chỗ bắt đầu phần mới mà
     không phải kẻ thêm đường ngăn. */
  /* `o.mo` = dòng MÔ TẢ dưới nhãn. Ô nào có nó thì icon to lên thành một ô
     vuông mềm và nhãn xếp hai dòng — tab Âm thanh dùng lối này vì tên ô ở đó
     ("Tiếng hiện từng phần") không tự nói ra nó làm gì. Ô không khai `mo` giữ
     nguyên một dòng như cũ, không đụng gì tới ba tab còn lại. */
  const nhan = (o, them) => {
    const ico = o.icon ? `<span class="btn-icon bs-ico" data-icon="${o.icon}"></span>` : '';
    if (o.mo) {
      return `<span class="bs-nhan bs-nhan-to">${ico}<span class="bs-nhan-chu">`
        + `<b>${o.nhan}</b><i>${esc(o.mo)}</i></span>${them || ''}</span>`;
    }
    return `<span class="bs-nhan${o.icoXanh ? ' bs-nhan-moc' : ''}">${ico}${o.nhan}${them || ''}</span>`;
  };

  /** Một ngọn đèn: màu + 5 mức sáng + lưới 15 vị trí. */
  /** Một ngọn đèn: màu + 5 mức sáng + lưới 15 vị trí. */
  function veDen(o) {
    /* Đọc giá trị HIỆU LỰC của slide đang xem, không đọc `visuals.*`: engine lưu
       đèn theo từng slide nên `visuals.mainLight` chỉ là giá trị chung, hiện nó
       ra là nói sai về slide đang mở. */
    const rieng = RP.deckCau.denSlide() || {};
    const lay = (duong) => {
      const k = duong.split('.').pop();
      return rieng[k] != null ? rieng[k] : doc(duong);
    };
    const mau = lay(o.mauDuong) || '#ffffff';
    const vt = lay(o.viTriDuong);
    const sang = lay(o.sangDuong);
    /* Ba hàng cùng một khuôn: NHÃN có icon bên trái, thứ chỉnh bên phải. Trước
       đây ô màu đứng trơ một mình không nhãn, còn "Độ sáng" thì nhãn một dòng
       và chấm một dòng — ba thứ trong cùng khối mà ba kiểu khác nhau. */
    return `<div class="bs-den-hang">
        <span class="bs-nhan"><span class="btn-icon bs-ico" data-icon="the"></span>Màu sắc</span>
        <span class="bs-mau"><input type="color" value="${mau}" data-den-mau="${o.mauDuong}">
        <code>${String(mau).toUpperCase()}</code></span>
      </div>
      <div class="bs-den-hang">
        <span class="bs-nhan"><span class="btn-icon bs-ico" data-icon="mucdo"></span>Độ sáng</span>
        <div class="bs-cham">${DO_SANG.map((x) =>
          `<button type=\"button\" class=\"bs-cham-o${x === sang ? ' dang-chon' : ''}\" data-sang=\"${o.sangDuong}\" data-v=\"${x}\" title=\"${x}\"></button>`).join('')}</div>
      </div>
      <div class="bs-den-hang bs-den-doc">
        <span class="bs-nhan"><span class="btn-icon bs-ico" data-icon="vitri"></span>Vị trí</span>
        <div class="bs-luoi">${VI_TRI.map((p) =>
          `<button type=\"button\" class=\"bs-luoi-o${p === vt ? ' dang-chon' : ''}\" data-vitri=\"${o.viTriDuong}\" data-v=\"${p}\" title=\"${p}\"></button>`).join('')}</div>
      </div>`;
  }
  /** Thoát ký tự cho nội dung nhét thẳng vào HTML. */
  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ── dựng từng loại ô ───────────────────────────────────────────────── */
  function veO(o) {
    /* ⚠ `String(... || o.loai)`: có mục KHÔNG có `duong` lẫn `nhan` (khối hai
       ngọn đèn). Thiếu nước lùi thì `.replace` của `undefined` ném lỗi, cả lượt
       vẽ chết và tab hiện ra rỗng — mà ngoại lệ nằm trong chuỗi promise nên
       `window.onerror` KHÔNG đếm, nhìn console cũng không thấy gì. */
    const id = 'bs-' + String(o.duong || o.nhan || o.loai).replace(/[^a-zA-Z0-9]/g, '-');
    if (o.loai === 'mau') {
      const v = giaTri(o) || '#000000';
      return `<label class="bs-hang" for="${id}">${nhan(o)}
        <span class="bs-mau"><input type="color" id="${id}" value="${v}" data-o="${o.nhan}">
        <code>${String(v).toUpperCase()}</code></span></label>`;
    }
    if (o.loai === 'mauKhoa') {
      const v = giaTri(o) || '#000000';
      return `<div class="bs-hang" title="${o.mach}">${nhan(o)}
        <span class="bs-mau bs-mau-khoa"><span class="bs-o-mau" style="background:${v}"></span>
        <code>${String(v).toUpperCase()}</code></span></div>`;
    }
    if (o.loai === 'batMau') {
      /* Công tắc + ô màu trên cùng một hàng. Ô màu MỜ ĐI khi tắt lưới — vẫn
         bấm được (đổi màu trước rồi bật sau là chuyện thường), chỉ là nói cho
         biết nó đang không có tác dụng gì. */
      const bat = !!giaTri(o);
      const v = doc(o.duongMau) || '#000000';
      return `<div class="bs-hang bs-bat-mau${bat ? '' : ' bs-tat'}">${nhan(o)}
        <span class="bs-bat-mau-dk">
          ${/* THỨ TỰ: công tắc trước, ô màu sau. Bật/tắt là câu hỏi đầu tiên —
               chưa bật thì màu chưa có nghĩa gì. */ ''}
          <input class="bs-tac" type="checkbox" id="${id}" ${bat ? 'checked' : ''}
            data-bat-mau="${o.duong}" data-o="${o.nhan}">
          <span class="bs-mau"><input type="color" id="${id}-mau" value="${v}" data-o="${o.nhan}"
            data-chu-mau="${o.duongMau}"><code>${String(v).toUpperCase()}</code></span>
        </span></div>`;
    }
    if (o.loai === 'bat') {
      /* CÔNG TẮC, không phải ô đánh dấu. Vẫn là `<input type="checkbox">` thật
         — mọi thứ đọc/ghi ở chỗ khác (`.checked`, sự kiện `change`, bàn phím,
         trình đọc màn hình) giữ nguyên; chỉ lớp `.bs-tac` vẽ lại nó bằng CSS. */
      return `<label class="bs-hang bs-bat" for="${id}">${nhan(o)}
        <input class="bs-tac" type="checkbox" id="${id}" ${giaTri(o) ? 'checked' : ''} data-o="${o.nhan}"></label>`;
    }
    if (o.loai === 'dauTab') {
      const bat = giaTri(o) !== false;
      return `<div class="bs-dau-tab">
        <span class="btn-icon bs-dau-ic" data-icon="${o.icon}"></span>
        <span class="bs-dau-chu"><b>${o.nhan}</b><i>${esc(o.mo || '')}</i></span>
        <input class="bs-tac" type="checkbox" id="bs-dau-tab" ${bat ? 'checked' : ''}
               data-o="${o.nhan}" aria-label="Bật ${o.nhan}"></div>`;
    }
    if (o.loai === 'chip') {
      const v = giaTri(o) || o.macDinh;
      return `<div class="bs-hang">${nhan(o)}
        <span class="bs-chip">${o.muc.map((m) =>
          `<button type="button" class="bs-chip-nut${m.v === v ? ' dang-chon' : ''}"
                   data-chip="${o.duong}" data-v="${m.v}">${esc(m.t)}</button>`).join('')}</span></div>`;
    }
    if (o.loai === 'cumMau') {
      return `<div class="bs-hang bs-doc bs-cum-mau">${nhan(o)}
        <div class="bs-cum-luoi">${o.o.map((x) => {
          const v = doc(x.duong);
          if (x.phanTram) {
            const n = Math.round(Number(v) || 0);
            return `<label class="bs-cum-o"><span>${x.nhan}</span>
              <span class="bs-cum-so"><input type="number" min="0" max="100" step="5" value="${n}"
                data-so="${x.duong}"><em>%</em></span></label>`;
          }
          /* `coTat` = ô có thể BỎ TRỐNG (chưa chọn viền). Ô màu của trình duyệt
             không có trạng thái rỗng, nên kèm một nút × để trả về không-viền. */
          const mau = (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v : x.macDinh;
          const tat = x.coTat && !(typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v));
          return `<label class="bs-cum-o${tat ? ' chua-dat' : ''}"><span>${x.nhan}</span>
            <span class="bs-cum-mau-o">
              <input type="color" value="${esc(mau)}" data-cum-mau="${x.duong}">
              <code>${tat ? '—' : esc(String(mau).toUpperCase())}</code>
              ${x.coTat ? `<button type="button" class="bs-cum-x" data-cum-tat="${x.duong}"
                 title="Bỏ viền" aria-label="Bỏ viền">×</button>` : ''}</span></label>`;
        }).join('')}</div></div>`;
    }
    if (o.loai === 'truotSo') {
      const v = giaTri(o);
      const tren = (doc('subtitles.position') || 'duoi') === 'tren';
      const oNay = { ...o, nhan: tren && o.nhanTren ? o.nhanTren : o.nhan };
      /* Ô SỐ nằm CÙNG DÒNG với nhãn, mép phải — đúng nếp của mọi hàng khác
         trong bảng (nhãn trái, giá trị phải). Thanh kéo xuống dòng dưới vì nó
         cần cả bề ngang mới kéo chính xác được. */
      const oSo = `<span class="bs-cum-so"><input type="number" min="${o.min}" max="${o.max}"
        step="1" value="${v}" data-so="${o.duong}"><em>${o.donVi || ''}</em></span>`;
      return `<div class="bs-hang bs-doc">${nhan(oNay, oSo)}
        <input type="range" class="bs-truot-day" min="${o.min}" max="${o.max}"
          step="${o.step}" value="${v}" data-o="${o.nhan}" id="bs-subtitles-bottom">
        </div>`;
    }
    if (o.loai === 'thanhChu') {
      const phong = doc(o.phong) || '';
      const co = String(doc(o.co) || 18);
      const dam = doc(o.dam) !== false;          // mặc định ĐẬM, đúng như engine đang vẽ
      const nghieng = doc(o.nghieng) === true;
      const can = doc(o.can) || 'giua';
      const tenPhong = (o.mucPhong.find((m) => m.v === phong) || o.mucPhong[0]).t;
      const tenCo = (o.mucCo.find((m) => m.v === co) || { t: co }).t;
      const nutCan = [
        { v: 'trai', t: 'Căn trái', d: 'M3 5h18M3 10h10M3 15h18M3 20h10' },
        { v: 'giua', t: 'Căn giữa', d: 'M3 5h18M7 10h10M3 15h18M7 20h10' },
        { v: 'phai', t: 'Căn phải', d: 'M3 5h18M11 10h10M3 15h18M11 20h10' },
      ];
      /* HAI HÀNG: phông · cỡ · màu ở trên, B/I/U · căn lề ở dưới. Ảnh mẫu xếp
         tất cả một hàng, nhưng đó là ảnh rộng ~1100px — ở cột 330px bảy thứ một
         hàng thì ô phông còn ~40px. Chia hai hàng CÓ CHỦ Ý, không để trình duyệt
         tự vỡ dòng (đo lần đầu: ô màu bị đẩy xuống một mình). */
      return `<div class="bs-hang bs-doc bs-chu-o">${nhan(o)}
        <div class="bs-chu">
          <span class="bs-chon bs-chu-phong" data-chon="${o.phong}">
            <button type="button" class="bs-chon-nut" role="combobox" aria-expanded="false"
                    aria-haspopup="listbox" title="${esc(tenPhong)}">
              <span class="bs-chon-chu">${esc(tenPhong)}</span>
              <span class="bs-chon-mui" aria-hidden="true"></span></button>
          </span>
          <span class="bs-chon bs-chu-co" data-chon="${o.co}">
            <button type="button" class="bs-chon-nut" role="combobox" aria-expanded="false"
                    aria-haspopup="listbox" title="Cỡ chữ ${esc(tenCo)}px">
              <span class="bs-chon-chu">${esc(tenCo)}</span>
              <span class="bs-chon-mui" aria-hidden="true"></span></button>
          </span>
        </div>
        <div class="bs-chu bs-chu-hai">
          <button type="button" class="bs-chu-nut bs-chu-dam${dam ? ' dang-chon' : ''}"
                  data-bat="${o.dam}" title="Đậm" aria-pressed="${dam}">B</button>
          <button type="button" class="bs-chu-nut bs-chu-nghieng${nghieng ? ' dang-chon' : ''}"
                  data-bat="${o.nghieng}" title="Nghiêng" aria-pressed="${nghieng}">I</button>
          ${o.gachChan ? `<button type="button" class="bs-chu-nut bs-chu-gach${doc(o.gachChan) === true ? ' dang-chon' : ''}"
                  data-bat="${o.gachChan}" title="Gạch chân" aria-pressed="${doc(o.gachChan) === true}">U</button>` : ''}
          <span class="bs-chu-can">${nutCan.map((c) => `<button type="button"
            class="bs-chu-nut${c.v === can ? ' dang-chon' : ''}" data-can="${c.v}"
            title="${c.t}" aria-pressed="${c.v === can}"><svg viewBox="0 0 24 24" width="15" height="15"
            fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="${c.d}"/></svg></button>`).join('')}</span>
        </div></div>`;
    }
    if (o.loai === 'chonTinh') {
      /* ⚠ Markup PHẢI y hệt ô `chon` ở trên — `noiChon()` tra theo
         `[data-chon="<đường>"]` và dựng lại nhãn vào `.bs-chon-chu`. Khác một
         chữ là ô bấm không ra gì mà chẳng báo lỗi. Khác duy nhất: danh sách
         lấy từ `o.muc` (xem `mucCuaO`). */
      const muc = o.muc;
      const v = giaTri(o) || '';
      const dang = muc.find((m) => m.v === v) || muc[0];
      return `<div class="bs-hang">${nhan(o)}
        <span class="bs-chon" data-chon="${o.duong}">
          <button type="button" class="bs-chon-nut" role="combobox" aria-expanded="false"
                  aria-haspopup="listbox" title="${esc(dang.t)}">
            <span class="bs-chon-chu">${esc(dang.t)}</span>
            <span class="bs-chon-mui" aria-hidden="true"></span></button>
        </span></div>`;
    }
    if (o.loai === 'truot') {
      const v = Number(giaTri(o));
      const hien = o.nhan100 ? Math.round(v * 100) + (o.donVi || '') : v + (o.donVi || '');
      /* `motHang` = nhãn bên trái, thanh trượt bên phải CÙNG MỘT DÒNG. Dùng cho
         ô ngắn như Âm lượng; ô dài (Vị trí đáy) vẫn xếp dọc vì thanh cần cả
         bề ngang mới kéo chính xác được. */
      return `<label class="bs-hang${o.motHang ? ' bs-truot-ngang' : ' bs-doc'}" for="${id}">${nhan(o, `<b class=\"bs-so\">${hien}</b>`)}
        <input type="range" id="${id}" min="${o.min}" max="${o.max}" step="${o.step}" value="${v}" data-o="${o.nhan}"></label>`;
    }
    if (o.loai === 'tong') {
      const v = giaTri(o);
      /* Nhãn và hai lựa chọn CÙNG MỘT DÒNG — chỉ có hai chữ ngắn, xếp dọc thì
         tốn cả một hàng cho một cặp nút bé. */
      return `<div class="bs-hang">${nhan(o)}
        <div class="bs-chip">${o.muc.map((m) => `<button type=\"button\" class=\"bs-chip-nut${m.v === v ? ' dang-chon' : ''}\" data-tong=\"${m.v}\">${m.t}</button>`).join('')}</div></div>`;
    }
    if (o.loai === 'chon') {
      const muc = mucCuaO(o);
      const v = giaTri(o);
      if (!muc.length) return `<div class="bs-hang">${nhan(o)}
        <span class="bs-mo">Mở một dự án để chọn</span></div>`;
      const dang = muc.find((m) => m.v === v) || muc[0];
      /* ⚠ KHÔNG dùng `<select>` gốc. Danh sách bung ra của nó do HỆ ĐIỀU HÀNH vẽ:
         không nhận một dòng CSS nào, nên đứng giữa bảng đã bo tròn mềm thì lạc
         hẳn. Ở đây tự dựng — đổi lại là phải tự lo bàn phím (mũi tên / Enter /
         Esc) và vai trò ARIA, làm đủ ở `noiChon()`.
         Nhãn và ô chọn nằm CÙNG MỘT DÒNG: chữ không dài, xếp dọc chỉ tốn chiều
         cao mà cột phải thì đã phải cuộn. */
      /* Nút NGHE THỬ chỉ mọc ở ô nào khai `nghe` — xem `deckCau.ngheThu()`. */
      const nutNghe = o.nghe
        ? `<button type="button" class="bs-nghe" data-nghe="${o.nghe}" data-duong="${o.duong}"
             title="Nghe thử" aria-label="Nghe thử">
             <span class="btn-icon" data-icon="play"></span></button>`
        : '';
      return `<div class="bs-hang${o.mo ? ' bs-hang-to' : ''}">${nhan(o)}
        <span class="bs-chon" data-chon="${o.duong}" data-nguon="${o.nguon}"
              ${o.moiSlide ? 'data-moi-slide="1"' : ''}>
          <button type="button" class="bs-chon-nut" role="combobox" aria-expanded="false"
                  aria-haspopup="listbox" title="${esc(dang.t)}">
            <span class="bs-chon-chu">${esc(dang.t)}</span>
            <span class="bs-chon-mui" aria-hidden="true"></span></button>
        </span>${nutNghe}</div>`;
    }    if (o.loai === 'den2') {
      const d = o.den[denDangXem] || o.den[0];
      return `<div class="bs-den" data-den-goc="${d.mauDuong}">
        <div class="bs-phu bs-den-pv"><span class="btn-icon" data-icon="sun"></span><span>Ánh sáng nền</span><em>Áp dụng cho slide đang xem</em></div>
        <div class="bs-den-tab">${o.den.map((x, i) =>
          `<button type=\"button\" class=\"bs-den-tab-nut${i === denDangXem ? ' dang-chon' : ''}\" data-den-tab=\"${i}\">Đèn ${i + 1}</button>`).join('')}</div>
        ${veDen(d)}
      </div>`;
    }
    if (o.loai === 'chep') {
      return `<div class="bs-hang bs-doc">
        <button type="button" class="bs-nut-rong" data-chep>
          <span class="btn-icon" data-icon="copy"></span>${o.nhan}</button></div>`;
    }
    if (o.loai === 'script') {
      const ds = doc('slides.scriptLines');
      const i = slideSo();
      const nhap = scriptDangGo && scriptDangGo.deck === RP.deckCau.deck() && scriptDangGo.chiSo === i ? scriptDangGo : null;
      const dong = nhap ? nhap.val : (Array.isArray(ds) ? (ds[i] || '') : '');
      const tong = Array.isArray(ds) ? ds.length : 0;
      /* NÚT CHUYỂN SLIDE ngay cạnh ô lời thoại. Lời thoại là thứ theo TỪNG
         SLIDE, mà dải slide thì nằm tận dưới khung — sửa xong một dòng phải
         rê chuột xuống cuối trang để sang dòng kế. Hai nút này bấm hộ đúng dải
         đó (`RP.deckCau.toiSlide`) nên khung và bảng luôn cùng một slide. */
      const dieu = `<span class="bs-script-dieu">
        <button type="button" class="bs-script-nut" data-slide-lui
                ${i <= 0 ? 'disabled' : ''} title="Slide trước" aria-label="Slide trước">
          <span class="btn-icon" data-icon="trai"></span></button>
        <b class="bs-so">${i + 1}/${tong}</b>
        <button type="button" class="bs-script-nut" data-slide-toi
                ${i >= tong - 1 ? 'disabled' : ''} title="Slide sau" aria-label="Slide sau">
          <span class="btn-icon" data-icon="phai"></span></button></span>`;
      return `<div class="bs-hang bs-doc bs-script-o">
        ${nhan(o, dieu)}
        <textarea class="bs-script" rows="4" maxlength="10000" data-script>${esc(dong)}</textarea>
        <span class="bs-script-chan">
          <span class="bs-script-tt" data-script-tt></span>
          <span class="bs-script-dem" data-script-dem>${dong.length}/10000</span></span>
        <button type="button" class="bs-nut-rong bs-pd-nut" data-chinh-pd>
          <span class="btn-icon" data-icon="cochu"></span>Chỉnh phụ đề — kiểu chữ, bật / tắt…</button></div>`;
    }
        return '';
  }

  /* ── dựng bảng ──────────────────────────────────────────────────────── */
  function ve() {
    const than = $('#bsThan');
    if (!than) return;
    /* ⚠ TRẢ FORM VỀ TRƯỚC KHI GHI ĐÈ `innerHTML`.
       Tab “Dựng” DỜI nút `.render-machine` vào đây; `ve()` lại bắt đầu bằng
       `than.innerHTML = …`, nên nếu form đang nằm trong `than` thì lượt vẽ kế
       tiếp XOÁ LUÔN nó khỏi tài liệu — mất sạch trình xử lý của tts-panel và
       jobs, mà nhìn thì chỉ thấy tab trống. Và `ve()` chạy mỗi lần đổi deck
       (qua `napLai`), không chỉ khi bấm tab. Đo được: sau một lượt như vậy,
       `.render-machine` không còn ở CẢ hai chỗ. */
    traFormVeCho();

    /* Ba tình huống KHÁC NHAU, nói rõ từng cái. Gộp thành một câu “chọn một
       dự án” là sai với deck đã mở mà không sửa được — người dùng bấm lại mãi. */
    if (!RP.deckCau.deck()) {
      than.innerHTML = '<div class="bs-trong">Bấm "Dự án" trên thanh trên cùng để chọn dự án cần sửa.</div>';
      return;
    }
    if (!RP.deckCau.sanSang()) {
      /* Deck không dùng engine chung (`bee-engine`) thì không có
         `applyVisualSettings`, tức không có thiết lập hình ảnh nào để sửa —
         deck tự viết `app.js` riêng là rơi vào đây. Không phải lỗi. */
      than.innerHTML = '<div class="bs-trong">Deck này không dùng engine chung'
        + ' nên không có thiết lập hình ảnh để sửa.<br>Sửa thẳng trong'
        + ' <code>style.css</code> của deck.</div>';
      return;
    }
    if (!st) {
      than.innerHTML = '<div class="bs-trong">Đang đọc thiết lập…</div>';
      return;
    }
    const ds = O[tab] || [];
    /* ⚠ Hai nút phạm vi phải đứng NGAY TRÊN hai ô mà chúng chi phối, không phải
       trên đầu cả tab. Chúng chỉ tác động lên những ô `moiSlide` (tiếng chuyển
       slide · tiếng hiện từng phần); để trên cùng thì trông như chi phối cả
       nhạc nền lẫn giọng đọc — chủ dự án đọc đúng như vậy rồi hỏi "hai tab đó
       khác gì nhau", vì bấm qua lại chẳng thấy gì đổi.
       Nay kèm một dòng nói thẳng nó áp cho cái gì. */
    const iMoi = ds.findIndex((o) => o.moiSlide);
    const veCum = () => `<div class="bs-phu bs-pv-nhan"><span>Áp dụng tiếng dưới đây cho</span></div>
      <div class="bs-pham-vi">
        <button type="button" class="${phamVi === 'tatca' ? 'dang-chon' : ''}" data-pv="tatca">
          <span class="btn-icon" data-icon="phim"></span>
          <span class="bs-pv-chu"><b>Toàn bộ video</b><i>Tất cả slide</i></span></button>
        <button type="button" class="${phamVi === 'slide' ? 'dang-chon' : ''}" data-pv="slide">
          <span class="btn-icon" data-icon="slide"></span>
          <span class="bs-pv-chu"><b>Slide này (${slideSo() + 1})</b><i>Chỉ slide đang xem</i></span></button>
      </div>`;
    than.innerHTML = gomKhoi(ds, iMoi, veCum);
    noiSuKien(than, ds);
    veDemChu(than);
    /* Áp một lượt ngay khi VẼ, không đợi người dùng đụng vào ô nào: trang xem
       trước đã mang sẵn mấy biến này từ lúc dựng, nhưng đổi deck thì khung được
       dùng lại còn biến thì của deck cũ. */
    /* Mọi lượt vẽ (trước chỉ khi ở tab Phụ đề — tab đó đã gỡ): đổi deck là khung được dùng lại mà biến
       còn của deck cũ. */
    apBienPhuDe();
    if (tab === 'amthanh') veHaNhac(than);
    /* Tab Âm thanh: nối thêm phần GIỌNG ĐỌC ở cuối. Dời nút DOM vào đây (xem
       `boCucGiong`), nên phải đứng SAU `noiSuKien` — hàm đó chỉ gắn sự kiện cho
       những ô do `ve()` vừa dựng. */
    /* ⚠ `&& !hopTao`: hộp Tạo video ĐANG MỞ thì form thuộc về hộp, không được
       kéo sang tab. Thiếu vế này thì cửa sau vẫn còn — `traFormVeCho()` đã
       chừa hộp ra, nhưng dòng ngay dưới lại `querySelector('.render-machine')`
       trên cả tài liệu và lôi đúng cái form trong hộp sang đây. Hộp nằm đè lên
       tab nên người dùng chỉ thấy hộp rỗng, không thấy form đã đi đâu.
       Đóng hộp là `dongHopTao()` gọi `ve()` lại, tab tự có form. */
    if (tab === 'amthanh' && hopTao) {
      /* ⚠ HỘP TẠO VIDEO ĐANG GIỮ FORM → NÓI RA, ĐỪNG ĐỂ TRỐNG.
         Form dựng video chỉ có MỘT bản trong tài liệu; mở hộp là nó sang hộp,
         nên phần Giọng đọc ở tab này mất chỗ dựa. Đo 23/09/2026: tab tụt còn
         hai khối, chừa một khoảng trắng **330px** ở đáy cột phải — mà lớp nền
         mờ của hộp (55% đen) phủ kín màn hình vẫn không che nổi cái lỗ đó.
         Chủ dự án báo đúng hiện tượng này: "mở pop tạo video thì phần giọng
         đọc bên dưới biến mất".
         ⚠ KHÔNG dựng bản thứ hai của form để lấp. Tốc độ và độ phân giải đọc
         THẲNG từ ô DOM (`jobs.js#dungPayloadRender` lấy `#renderSpeed` và
         `currentRenderSize()`), nên hai bản là hai giá trị sớm muộn lệch nhau
         — đúng thứ cả tệp này tránh. Nói thật chỗ nó đang ở, kèm một nút đưa
         nó về, là đủ và không đẻ nguồn sự thật thứ hai. */
      than.insertAdjacentHTML('beforeend', `
        <div class="bs-giong-tam" id="bsGiongTam">
          <span class="btn-icon" data-icon="mic"></span>
          <div>
            <b>Giọng đọc đang ở trong hộp Tạo video</b>
            <em>Đóng hộp để chỉnh lại giọng ở đây.</em>
          </div>
          <button type="button" class="bs-giong-tam-nut" id="bsGiongVe">Đóng hộp</button>
        </div>`);
      const nutVe = than.querySelector('#bsGiongVe');
      if (nutVe) nutVe.onclick = () => dongHopTao();
    } else if (tab === 'amthanh') {
      /* Dời CẢ form vào đây rồi để CSS ẩn phần không phải giọng đọc — xem chú
         thích dài ở đầu tệp. Không thêm tiêu đề riêng: form đã mang sẵn nhãn
         "1. Giọng đọc" kèm hai nút Hướng dẫn. */
      const form = document.querySelector('.render-machine');
      if (form) {
        than.insertAdjacentHTML('beforeend', '<div id="bsChoGiong"></div>');
        const cho = than.querySelector('#bsChoGiong');
        if (cho) cho.appendChild(form);
      }
    }
    /* ⚠ BƠM LẠI ICON sau MỖI lượt vẽ. `icons.js` chỉ thay ruột những phần tử
       mang `data-icon` CÓ MẶT lúc nó chạy; `ve()` dựng lại toàn bộ `#bsThan`
       nên mọi icon mới là vỏ rỗng cho tới khi gọi lại — hàng nào cũng mất icon
       mà không lỗi nào báo (đã dính 15/09/2026). */
    if (window.__beeIcons) window.__beeIcons.apply(than);
  }

  /**
   * Ô chọn tự dựng: nút + danh sách bung ra.
   *
   * Tự dựng vì danh sách của `<select>` gốc do HỆ ĐIỀU HÀNH vẽ, không nhận CSS.
   * Đổi lại phải TỰ LO những thứ `<select>` cho không: mũi tên lên/xuống, Enter,
   * Esc, Home/End, đóng khi bấm ra ngoài, và vai trò ARIA cho bộ đọc màn hình.
   *
   * Danh sách vẫn ĐỌC TỪ ENGINE (`mucTuEngine`) — engine thêm hiệu ứng mới là
   * chỗ này tự có.
   */
  /**
   * Nối sự kiện cho THANH CÔNG CỤ CHỮ.
   *
   * ⚠ Hai ô chọn trong thanh dùng lại `noiChon()`, nên chúng phải có `data-chon`
   * bằng ĐÚNG đường thiết lập và một mục `ds` tương ứng — `noiChon` tra theo đó.
   * Ở đây tự dựng hai mục giả (`phong`, `co`) để không phải đẻ thêm loại ô mới.
   */
  function noiThanhChu(vo, o) {
    const gia = [
      { duong: o.phong, muc: o.mucPhong },
      { duong: o.co, muc: o.mucCo, so: true },
    ];
    vo.querySelectorAll('.bs-chon[data-chon]').forEach((x) => noiChon(x, gia));
    vo.querySelectorAll('[data-bat]').forEach((b) => {
      b.onclick = () => {
        const duong = b.dataset.bat;
        const cu2 = duong === o.dam ? doc(duong) !== false : doc(duong) === true;
        doi(duong, !cu2, o);
        ve();
      };
    });
    vo.querySelectorAll('[data-can]').forEach((b) => {
      b.onclick = () => { doi(o.can, b.dataset.can, o); ve(); };
    });
    vo.querySelectorAll('[data-chu-mau]').forEach((el) => {
      el.oninput = () => {
        doi(el.dataset.chuMau, el.value, o);
        const c = el.parentElement.querySelector('code');
        if (c) c.textContent = el.value.toUpperCase();
      };
    });
  }

  /** Bộ đếm ký tự dưới ô lời thoại. */
  function veDemChu(than) {
    const o = than.querySelector('[data-script]');
    const d = than.querySelector('[data-script-dem]');
    if (!o || !d) return;
    const ve2 = () => { d.textContent = o.value.length + '/10000'; };
    o.addEventListener('input', ve2);
    ve2();
  }

  function noiChon(vo, ds) {
    const duong = vo.dataset.chon;
    const o = ds.find((x) => x.duong === duong);
    if (!o) return;
    const nut = vo.querySelector('.bs-chon-nut');
    let bang = null;

    const dong = () => {
      if (!bang) return;
      bang.remove(); bang = null;
      nut.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', ngoai, true);
      window.removeEventListener('resize', dong);
    };
    const ngoai = (e) => { if (bang && !bang.contains(e.target) && !vo.contains(e.target)) dong(); };

    const mo = () => {
      if (bang) { dong(); return; }
      const muc = mucCuaO(o);
      if (!muc.length) return;
      /* `o.so` = giá trị lưu là SỐ (cỡ chữ). Danh sách `m.v` luôn là chuỗi, nên
         phải đổi về chuỗi khi so, và đổi ngược về số khi ghi — ghi chuỗi '18'
         vào `subtitles.fontSize` là engine đọc ra NaN. */
      const v = o.so ? String(giaTri(o)) : giaTri(o);
      bang = document.createElement('div');
      bang.className = 'bs-chon-bang';
      bang.setAttribute('role', 'listbox');
      bang.innerHTML = muc.map((m, i) =>
        `<button type="button" role="option" class="bs-chon-muc${m.v === v ? ' dang-chon' : ''}"
                 aria-selected="${m.v === v}" data-v="${esc(m.v)}" data-i="${i}">${esc(m.t)}</button>`).join('');
      document.body.appendChild(bang);
      const b = nut.getBoundingClientRect();
      /* Bung XUỐNG nếu còn chỗ, không thì bung LÊN. Bảng có thể dài hơn phần
         màn hình còn lại — thả cứng xuống dưới là mục cuối nằm ngoài cửa sổ. */
      const cao = Math.min(bang.scrollHeight, 280);
      const duoi = window.innerHeight - b.bottom - 8;
      bang.style.width = `${Math.max(Math.round(b.width), 180)}px`;
      bang.style.left = `${Math.round(Math.min(b.left, window.innerWidth - Math.max(b.width, 180) - 8))}px`;
      if (duoi >= cao) bang.style.top = `${Math.round(b.bottom + 4)}px`;
      else bang.style.top = `${Math.round(Math.max(8, b.top - cao - 4))}px`;
      nut.setAttribute('aria-expanded', 'true');
      bang.querySelectorAll('[data-v]').forEach((x) => {
        x.onclick = () => {
          const val = x.dataset.v;
          dong();
          doi(o.duong, o.so ? Number(val) : val, o);
          ve();
        };
      });
      const dangChon = bang.querySelector('.dang-chon') || bang.firstElementChild;
      if (dangChon) dangChon.focus();
      bang.onkeydown = (e) => {
        const ds2 = [...bang.querySelectorAll('[data-v]')];
        const i = ds2.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); dong(); nut.focus(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); (ds2[i + 1] || ds2[0]).focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); (ds2[i - 1] || ds2[ds2.length - 1]).focus(); }
        else if (e.key === 'Home') { e.preventDefault(); ds2[0].focus(); }
        else if (e.key === 'End') { e.preventDefault(); ds2[ds2.length - 1].focus(); }
      };
      document.addEventListener('mousedown', ngoai, true);
      window.addEventListener('resize', dong);
    };

    nut.onclick = mo;
    nut.onkeydown = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mo(); }
    };
  }

  /* Nhạc nền đang phát thử hay không. Để ở đây chứ không hỏi engine: engine
     giữ cờ trong biến `bgMusicGain` nội bộ, không mở ra ngoài. */
  let dangPhatNhac = false;

  /** Nút nghe thử: ▶ khi đang im, ⏸ khi đang phát. */
  function veNutNghe(b, phat) {
    const o = b.querySelector('.btn-icon');
    if (!o) return;
    o.dataset.icon = phat ? 'stop' : 'play';
    o.innerHTML = '';
    b.title = phat ? 'Dừng nghe thử' : 'Nghe thử';
    b.classList.toggle('dang-phat', !!phat);
    if (window.__beeIcons) window.__beeIcons.apply(b);
  }

  /** Giá trị đang hiệu lực của một đường — có xét phạm vi slide. */
  function giaTriTheoDuong(duong) {
    const v = doc(duong);
    if (!Array.isArray(v)) return v;
    return v[phamVi === 'slide' ? slideSo() : 0] || '';
  }

  /**
   * Gom cac o CUNG `nhom` thanh mot KHOI co vien nhe.
   *
   * Bang phai truoc day la mot day hang phang: nhin xuong chi thay muoi may
   * dong nhu nhau, khong biet cho nao het phan nay sang phan kia. Vien nhe
   * quanh tung khoi noi dieu do ma khong phai ke tieu de hay vach ngan.
   *
   * O KHONG khai `nhom` dung rieng, khong boc - o sua loi thoai va nut chep
   * phu de cao gan het man hinh, boc them mot khung nua chi to chat.
   *
   * KHOI CHI GOM HANG XOM LIEN NHAU. Hai o cung nhom ma cach nhau mot o khac
   * thi thanh hai khoi - dung y: thu tu tren man hinh la thu tu nguoi ta doc,
   * gom xa nhau lai la dao cho o ngay duoi tay nguoi dang sua.
   */
  function gomKhoi(ds, iMoi, veCum) {
    const phan = [];
    ds.forEach((o, i) => {
      const html = (i === iMoi ? veCum() : '') + veO(o);
      const cuoi = phan[phan.length - 1];
      if (o.nhom && cuoi && cuoi.ten === o.nhom) { cuoi.html += html; return; }
      phan.push({ ten: o.nhom || null, html });
    });
    return phan.map((p) => (p.ten ? '<div class="bs-khoi">' + p.html + '</div>' : p.html)).join('');
  }

  function noiSuKien(than, ds) {
    than.querySelectorAll('[data-pv]').forEach((b) => {
      b.onclick = () => { phamVi = b.dataset.pv; ve(); };
    });
    /* Công tắc ở ĐẦU TAB (Bật phụ đề). */
    const oDau = than.querySelector('#bs-dau-tab');
    if (oDau) {
      const oTin = ds.find((x) => x.loai === 'dauTab');
      oDau.onchange = () => doi(oTin.duong, oDau.checked, oTin);
    }
    /* Công tắc của hàng gộp "Lưới nền" (công tắc + ô màu chung một hàng).
       Ô màu đi đường `[data-chu-mau]` sẵn có, không cần gì thêm. */
    than.querySelectorAll('[data-bat-mau]').forEach((el) => {
      el.onchange = () => { doi(el.dataset.batMau, el.checked); ve(); };
    });
    /* ⚠ Ô màu của hàng gộp phải nối RIÊNG ở đây. Luật `[data-chu-mau]` sẵn có
       nằm trong `noiCumDen()` và chỉ quét trong khối đèn (`vo`), không quét cả
       bảng — dựa vào nó là ô màu này bấm không ăn gì. */
    than.querySelectorAll('.bs-bat-mau [data-chu-mau]').forEach((el) => {
      el.oninput = () => {
        doi(el.dataset.chuMau, el.value);
        const c = el.parentElement.querySelector('code');
        if (c) c.textContent = el.value.toUpperCase();
      };
    });
    /* Cặp nút CHỌN MỘT (Vị trí hiển thị). */
    than.querySelectorAll('[data-chip]').forEach((b) => {
      b.onclick = () => {
        const oTin = ds.find((x) => x.duong === b.dataset.chip);
        doi(b.dataset.chip, b.dataset.v, oTin);
        ve();
      };
    });
    /* CỤM MÀU: ô màu, nút bỏ màu, và ô số phần trăm. */
    than.querySelectorAll('[data-cum-mau]').forEach((el) => {
      el.oninput = () => {
        doi(el.dataset.cumMau, el.value);
        const c = el.parentElement.querySelector('code');
        if (c) c.textContent = el.value.toUpperCase();
        const o = el.closest('.bs-cum-o');
        if (o) o.classList.remove('chua-dat');
      };
    });
    than.querySelectorAll('[data-cum-tat]').forEach((b) => {
      b.onclick = (e) => { e.preventDefault(); doi(b.dataset.cumTat, ''); ve(); };
    });
    /* Ô SỐ (phần trăm nền · khoảng cách). Đổi lúc `change` chứ không `input`:
       gõ "100" thì `input` bắn ba lần — "1", "10", "100" — và "1" đi thẳng
       xuống đĩa lẫn khung, nhìn như phụ đề nhấp nháy về gần trong suốt. */
    than.querySelectorAll('[data-so]').forEach((el) => {
      el.onchange = () => {
        const min = Number(el.min || 0), max = Number(el.max || 100);
        const n = Math.min(max, Math.max(min, Math.round(Number(el.value) || 0)));
        el.value = String(n);
        doi(el.dataset.so, n);
        const keo = el.closest('.bs-truot-so');
        const r = keo && keo.querySelector('input[type="range"]');
        if (r) r.value = String(n);
      };
    });
    /* "Chỉnh phụ đề" ngay DƯỚI lời thoại (chốt 17/10/2026: phụ đề là lời thoại hiện chữ — nút chỉnh nó phải nằm
       cạnh nó, không nằm lẻ ở tab Thuộc tính). Mở bộ chỉnh phụ đề chung (kieu-phu-de.js) — như bấm tên track C1. */
    const nutPd = than.querySelector('[data-chinh-pd]');
    if (nutPd) nutPd.onclick = () => { if (RP.dung && RP.dung.datChon) RP.dung.datChon([], 'phude'); };
    /* Hai nút CHUYỂN SLIDE cạnh ô lời thoại. */
    than.querySelectorAll('[data-slide-lui], [data-slide-toi]').forEach((b) => {
      b.onclick = () => {
        const i = slideSo() + (b.hasAttribute('data-slide-toi') ? 1 : -1);
        if (i < 0) return;
        RP.deckCau.toiSlide(i);
        /* ⚠ Phải TỰ TÔ LẠI sau một nhịp — `toiSlide()` chỉ bảo engine đổi
           slide, không ai báo ngược về. Đúng nếp của dải slide bên `san-khau`:
           đợi 120ms cho engine đổi lớp `.active` rồi mới đọc số slide, tô sớm
           là tô theo số cũ (đo được: bấm sang slide 2 mà nhãn vẫn "1/6"). */
        setTimeout(() => {
          if (RP.sanKhau && RP.sanKhau.veDaiSlide) RP.sanKhau.veDaiSlide();
          doiSlide();
        }, 140);
      };
    });
    /* NGHE THỬ. Nhạc nền là nút GẠT (đang phát thì bấm nữa để tắt) vì nó chạy
       mãi; hai thứ tiếng kia chỉ kêu một tiếng rồi thôi nên bấm là phát. */
    than.querySelectorAll('[data-nghe]').forEach((b) => {
      const loai = b.dataset.nghe;
      if (loai === 'bgm') veNutNghe(b, dangPhatNhac);
      b.onclick = () => {
        if (loai === 'bgm') {
          dangPhatNhac = !dangPhatNhac;
          RP.deckCau.ngheThu(dangPhatNhac ? 'bgm' : 'dung-bgm');
          veNutNghe(b, dangPhatNhac);
          return;
        }
        RP.deckCau.ngheThu(loai, doc(b.dataset.duong) && giaTriTheoDuong(b.dataset.duong));
      };
    });
    /* Thanh công cụ chữ tự nối lấy: nó có nhiều nút con, không nằm trong lối
       "một ô = một id" của vòng dưới. */
    ds.filter((o) => o.loai === 'thanhChu').forEach((o) => {
      /* ⚠ `.bs-chu-o` chứ KHÔNG phải `.bs-chu`. Thanh kiểu chữ nay chia HAI
         hàng `.bs-chu`; nối theo hàng đầu thì B/I/U và căn lề ở hàng dưới không
         có trình xử lý nào — nút hiện ra bình thường mà bấm không ra gì. */
      const vo = than.querySelector('.bs-chu-o');
      if (vo) noiThanhChu(vo, o);
    });
    ds.forEach((o) => {
      /* ⚠ `String(... || o.loai)`: có mục KHÔNG có `duong` lẫn `nhan` (khối hai
       ngọn đèn). Thiếu nước lùi thì `.replace` của `undefined` ném lỗi, cả lượt
       vẽ chết và tab hiện ra rỗng — mà ngoại lệ nằm trong chuỗi promise nên
       `window.onerror` KHÔNG đếm, nhìn console cũng không thấy gì. */
    const id = 'bs-' + String(o.duong || o.nhan || o.loai).replace(/[^a-zA-Z0-9]/g, '-');
      const el = than.querySelector('#' + CSS.escape(id));
      if (!el) return;
      if (o.loai === 'mau') {
        el.oninput = () => {
          doi(o.duong, el.value, o);
          const c = el.parentElement.querySelector('code');
          if (c) c.textContent = el.value.toUpperCase();
        };
      } else if (o.loai === 'bat') {
        el.onchange = () => doi(o.duong, el.checked, o);
      } else if (o.loai === 'truot') {
        el.oninput = () => {
          const v = Number(el.value);
          doi(o.duong, v, o);
          const s = el.parentElement.querySelector('.bs-so');
          if (s) s.textContent = (o.nhan100 ? Math.round(v * 100) : v) + (o.donVi || '');
        };
      } else if (o.loai === 'truotSo') {
        /* ⚠ PHẢI CÓ NHÁNH RIÊNG. Vòng này tra phần tử theo id rồi phân nhánh
           theo `o.loai`; thêm loại ô mới mà quên nhánh ở đây thì thanh kéo hiện
           ra bình thường mà KÉO KHÔNG ĂN GÌ — không lỗi, không log (chủ dự án
           báo 16/09/2026). Ô số bên cạnh đi đường `[data-so]` riêng. */
        el.oninput = () => {
          const v = Number(el.value);
          doi(o.duong, v, o);
          const hang = el.closest('.bs-hang');
          const so = hang && hang.querySelector('[data-so]');
          if (so) so.value = String(v);
        };
      }
    });
    than.querySelectorAll('.bs-chon').forEach((v) => noiChon(v, ds));
    than.querySelectorAll('[data-den-tab]').forEach((b) => {
      b.onclick = () => { denDangXem = Number(b.dataset.denTab) || 0; ve(); };
    });
    const nutChep = than.querySelector('[data-chep]');
    if (nutChep) {
      nutChep.onclick = () => {
        const deck = RP.deckCau.deck();
        /* ⚠ GỌI THẲNG `copyProjectScript`, đừng bấm hộ `.copy-script-btn`: nút
           đó đã bị gỡ khỏi hàng dự án (15/09/2026) nên `querySelector` luôn
           trả null và nút này chỉ còn báo "Không thấy dự án trong danh sách"
           — đo được 19/09/2026. Hàm bên `project-list.js` vẫn giữ nguyên phần
           chép + báo trạng thái, nên đường này không mất gì. */
        if (!deck) { trangThai('Chưa chọn dự án', true); return; }
        if (RP.copyProjectScript) RP.copyProjectScript(deck, nutChep);
        else trangThai('Chưa nạp được bộ chép phụ đề', true);
      };
    }
    const oScript = than.querySelector('[data-script]');
    if (oScript) {
      const tt = than.querySelector('[data-script-tt]');
      const bao = (c) => { if (tt) tt.textContent = c; };
      const chiSo = slideSo();
      const deckLuc = RP.deckCau.deck();
      oScript.oninput = () => {
        scriptDangGo = { deck: deckLuc, chiSo, val: oScript.value };
        bao('Đang gõ…');
        clearTimeout(henScript);
        henScript = setTimeout(() => ghiScript(chiSo, oScript.value, bao, deckLuc), 900);
      };
      // Rời ô là lưu ngay, đừng bắt người ta ngồi đợi hết 900ms.
      oScript.onblur = () => {
        clearTimeout(henScript);
        ghiScript(chiSo, oScript.value, bao, deckLuc);
        if (choCapNhatScript) { choCapNhatScript = false; setTimeout(capNhatScript, 0); }
      };
    }
    than.querySelectorAll('[data-tong]').forEach((b) => {
      b.onclick = () => { doi('visuals.colorMode', b.dataset.tong); ve(); };
    });
    // Màu của khối đèn -> biến CSS, để chấm đang chọn tô đúng màu đó.
    const toMau = (khoi, v) => khoi && khoi.style.setProperty('--bs-den-mau', v);
    than.querySelectorAll('.bs-den').forEach((khoi) => {
      const o = khoi.querySelector('[data-den-mau]');
      if (o) toMau(khoi, o.value);
    });
    than.querySelectorAll('[data-den-mau]').forEach((el) => {
      el.oninput = () => {
        doi(el.dataset.denMau, el.value);
        const c = el.parentElement.querySelector('code');
        if (c) c.textContent = el.value.toUpperCase();
        toMau(el.closest('.bs-den'), el.value);
      };
    });
    than.querySelectorAll('[data-sang]').forEach((b) => {
      b.onclick = () => {
        doi(b.dataset.sang, b.dataset.v);
        b.parentElement.querySelectorAll('.bs-cham-o').forEach((x) => x.classList.toggle('dang-chon', x === b));
      };
    });
    than.querySelectorAll('[data-vitri]').forEach((b) => {
      b.onclick = () => {
        doi(b.dataset.vitri, b.dataset.v);
        b.parentElement.querySelectorAll('.bs-luoi-o').forEach((x) => x.classList.toggle('dang-chon', x === b));
      };
    });
  }

  async function napLai() {
    // Deck khác thì thiết lập khác — giữ lịch sử của deck cũ là hoàn tác sang
    // một bản thuộc về dự án khác.
    lichSu = []; lamLaiDuoc = []; lucLuu = 0;
    if (scriptDangGo && scriptDangGo.deck !== RP.deckCau.deck()) scriptDangGo = null;
    choCapNhatScript = false;
    if (RP.thanhTren) { RP.thanhTren.veNutSua(); RP.thanhTren.veTrangThaiLuu(); }
    const t = $('#bsThan');
    if (t) t.scrollTop = 0;       // deck khác thì nội dung khác, giữ chỗ cuộn cũ là vô nghĩa
    if (!RP.deckCau.sanSang()) { st = null; ve(); return; }
    try {
      st = await RP.deckCau.docThietLap();
    } catch { st = null; }
    ve();
    // Cờ bật/tắt phụ đề của deck vừa đọc xong ⇒ nút 👁 / trạng thái track C1 / bảng phụ đề vẽ lại cho đúng.
    if (RP.timeline && RP.timeline.noi && RP.timeline.noi.veHet) RP.timeline.noi.veHet();
    if (RP.bangKhoi && RP.bangKhoi.ve) RP.bangKhoi.ve();
  }

  function dung() {
    const neo = $('#bangSua');
    if (!neo) return;
    neo.innerHTML = `
      <div class="bs-tab">${TAB.map((t) =>
        `<button type="button" class="bs-tab-nut${t.ma === tab ? ' dang-chon' : ''}" data-tab="${t.ma}">
          <span class="btn-icon" data-icon="${t.icon}"></span><span>${t.ten}</span></button>`).join('')}</div>
      <div class="bs-than" id="bsThan"></div>
      <div class="bs-trangthai" id="bsTrangThai" hidden></div>`;
    neo.querySelectorAll('[data-tab]').forEach((b) => {
      b.onclick = () => {
        // Rời tab "Dựng video" thì phải TRẢ form về chỗ cũ, không thì lần sau
        // `$('.render-machine')` không tìm thấy gì và tab đó hiện ra rỗng.
        traFormVeCho();
        tab = b.dataset.tab;
        try { localStorage.setItem(KHOA_TAB, tab); } catch { /* không có kho */ }
        const t = $('#bsThan');
        if (t) t.scrollTop = 0;   // đổi tab thì về đầu, đừng giữ chỗ cuộn của tab cũ
        neo.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('dang-chon', x === b));
        ve();
        if (window.__beeIcons) window.__beeIcons.apply(neo);
      };
    });
    if (window.__beeIcons) window.__beeIcons.apply(neo);
    ve();
    RP.deckCau.nghe(() => { napLai(); });
    // Hạ nhạc là dữ liệu timeline: đổi ở bảng A2 / hoàn tác ⇒ ô ở tab Âm thanh theo.
    if (RP.dung && RP.dung.nghe) {
      /* Chỉ khi tab Âm thanh ĐÃ dựng xong phần thật (có chỗ giọng / ô hạ nhạc — không phải câu "đang đọc
         thiết lập…"), và chỉ khi haNhac thật sự đổi: sự kiện 'duAn' bắn theo từng nhịp kéo trên timeline. */
      let haCu = '';
      RP.dung.nghe((loai) => {
        if (tab !== 'amthanh' || (loai !== 'duAn' && loai !== 'nap')) return;
        const t = $('#bsThan');
        if (!t || t.hidden || !t.querySelector('#bsChoGiong, #bsGiongTam, #bsHaNhac')) return;
        const d = RP.dung.duAn && RP.dung.duAn();
        const moi = JSON.stringify([RP.dung.deck && RP.dung.deck(), d && d.amGoc && d.amGoc.haNhac, RP.dung.chiDoc && RP.dung.chiDoc()]);
        if (moi === haCu && loai !== 'nap') return;
        haCu = moi;
        if (document.activeElement && document.activeElement.id === 'bsHaNhacSo') return;
        veHaNhac(t);
      });
    }
  }

  /**
   * Slide đang xem đã đổi — vẽ lại NẾU tab hiện tại có thứ theo từng slide.
   *
   * ⚠ Đừng vẽ lại vô điều kiện: đang kéo thanh trượt ở tab Nội dung mà dải
   * slide đổi thì ô nhập bị dựng lại giữa chừng, mất luôn cú kéo.
   */
  function doiSlide() {
    const ds = O[tab] || [];
    if (ds.some((o) => o.moiSlide)) { ve(); return; }
    if (ds.some((o) => o.loai === 'script')) capNhatScript();
  }

  /** Vẽ lại RIÊNG ô lời thoại (đổi slide ở tab Nội dung) — cả tab vẽ lại là mất cú kéo thanh trượt đang dở. */
  function capNhatScript() {
    const than = $('#bsThan');
    const cu = than && than.querySelector('.bs-script-o');
    const oTin = (O[tab] || []).find((o) => o.loai === 'script');
    if (!cu || !oTin || !st) { ve(); return; }
    if (document.activeElement && cu.contains(document.activeElement)) { choCapNhatScript = true; return; }
    const tam = document.createElement('div');
    tam.innerHTML = veO(oTin);
    const moi = tam.firstElementChild;
    if (!moi) return;
    cu.replaceWith(moi);
    noiSuKien(moi, [oTin]);
    veDemChu(moi);   // bộ đếm N/10000 — ve() gắn nó, thay ô riêng thì phải gắn lại (rà GĐ1)
    if (window.__beeIcons) window.__beeIcons.apply(moi);
    /* Bản chụp slide của khung về CHẬM hơn nhịp 140 ms ở lần chuyển đầu (đo 16/10/2026: deck đã sang
       slide 4, ô vẫn ghi 3/6). Kiểm lại một lần — lệch thì vẽ lại theo số thật. */
    const daVe = slideSo();
    clearTimeout(capNhatScript.hen);
    capNhatScript.hen = setTimeout(() => {
      if (slideSo() !== daVe && document.contains(moi)) capNhatScript();
    }, 450);
  }

  /* ── "TỰ HẠ NHẠC" ở tab Âm thanh (dời từ tab Khối, 16/10/2026) ─────────────
     Là thiết lập của TIMELINE (`du-an.json#amGoc.haNhac`, hoàn tác của trình dựng) — đọc / ghi qua
     RP.dung, KHÔNG qua `st` của bảng này. Bật lên là dự án "có chỉnh sửa" ⇒ "Tạo video" áp thêm một
     lượt timeline (render/queue.js). Bảng phụ đề A2 (Thuộc tính khi bấm tên A2) cũng chỉnh được. */
  function veHaNhac(than) {
    const dg = RP.dung;
    if (!than || !dg || !dg.duAn || !dg.duAn() || (dg.laVideo && dg.laVideo())) return;
    const cu = than.querySelector('#bsHaNhac');
    const ag = dg.duAn().amGoc || {};
    const ha = { bat: false, mucDb: 12, ...(ag.haNhac || {}) };
    const doc1 = dg.chiDoc && dg.chiDoc();
    const html = `<div class="bs-khoi" id="bsHaNhac">
      <label class="bs-hang bs-bat" for="bsHaNhacBat">${nhan({ nhan: 'Tự hạ nhạc khi có giọng đọc', icon: 'amluong' })}
        <input class="bs-tac" type="checkbox" id="bsHaNhacBat" ${ha.bat ? 'checked' : ''} ${doc1 ? 'disabled' : ''}></label>
      ${ha.bat ? `<div class="bs-hang bs-doc">${nhan({ nhan: 'Mức hạ', icon: 'mucdo' }, `<span class="bs-cum-so"><input type="number"
          min="3" max="30" step="1" value="${ha.mucDb}" id="bsHaNhacSo" ${doc1 ? 'disabled' : ''}><em>dB</em></span>`)}</div>` : ''}
      <div class="bs-phu bs-pv-nhan"><span>${dg.tachTieng && !dg.tachTieng()
        ? 'Video slide dựng bằng bản cũ, không có giọng tách riêng — bấm "Tạo video" để dựng lại thì mới hạ nhạc được.'
        : 'Nhạc nền, tiếng chuyển và âm thanh thêm nhỏ xuống trong lúc giọng đọc — áp khi "Tạo video".'}</span></div>
    </div>`;
    const tam = document.createElement('div');
    tam.innerHTML = html;
    const moi = tam.firstElementChild;
    if (cu) cu.replaceWith(moi);
    else {
      const giong = than.querySelector('#bsChoGiong, #bsGiongTam');
      if (giong) giong.before(moi); else than.appendChild(moi);
    }
    const oBat = moi.querySelector('#bsHaNhacBat');
    if (oBat) oBat.onchange = () => dg.doiAmGoc({ haNhac: { ...ha, bat: oBat.checked } }, oBat.checked ? 'Bật hạ nhạc' : 'Tắt hạ nhạc');
    const oSo = moi.querySelector('#bsHaNhacSo');
    if (oSo) {
      oSo.onchange = () => {
        const v = Math.round(Number(oSo.value));
        if (!Number.isFinite(v)) { oSo.value = String(ha.mucDb); return; }
        dg.doiAmGoc({ haNhac: { ...ha, bat: true, mucDb: Math.min(30, Math.max(3, v)) } }, 'Đổi mức hạ nhạc');
      };
    }
    if (window.__beeIcons) window.__beeIcons.apply(moi);
  }

  /* ── PHỤ ĐỀ của deck cho bộ chỉnh dùng chung (render/kieu-phu-de.js) ─────────
     Đi ĐÚNG đường cũ của tab Phụ đề: ghi `st.subtitles.*` → engine (apPhuDe) → biến CSS của app
     (apBienPhuDe) → lưu preview-settings.json. Lưu NGAY (không chờ 400 ms) để bên gọi còn tính lại CSS
     lớp phụ đề trên timeline sau khi tệp đã ghi. `null` = bỏ khoá. */
  const docPhuDe = () => (st ? { ...((st && st.subtitles) || {}) } : null);
  const phuDeBat = () => !st || doc('subtitles.enabled') !== false;
  async function datPhuDe(va) {
    if (!st || !RP.deckCau.sanSang()) return { ok: false, loi: ['Deck chưa sẵn sàng — đợi khung slide nạp xong.'] };
    nhoTruocKhiDoi();
    for (const [k, v] of Object.entries(va || {})) {
      if (v === null) { if (st.subtitles) delete st.subtitles[k]; } else ghi(`subtitles.${k}`, v);
    }
    RP.deckCau.apPhuDe(st);
    apBienPhuDe();
    if (hen) { clearTimeout(hen); hen = null; }
    try {
      await RP.deckCau.ghiThietLap(st);
      lucLuu = Date.now();
      if (RP.thanhTren) RP.thanhTren.veTrangThaiLuu();
      return { ok: true, kieu: docPhuDe() };
    } catch (e) {
      return { ok: false, loi: [`Không lưu được: ${(e && e.message) || e}`] };
    }
  }
  /** Mở một tab của bảng này ('mau' | 'amthanh') — như bấm nút (đóng tab riêng đang mở). */
  function moTab(ma) {
    if (tab === ma && !(RP.tabPhai && RP.tabPhai.dang())) return;
    const b = document.querySelector(`#bangSua .bs-tab [data-tab="${ma}"]`);
    if (b) b.click();
  }

  Object.assign(RP, {
    bangSua: { dung, napLai, ve, doiSlide, hoanTac, lamLai, coHoanTac, coLamLai, lucLuuCuoi, moHopTao, dongHopTao,
      moTab, docPhuDe, datPhuDe, phuDeBat } });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', dung);
  } else {
    dung();
  }
})();
