'use strict';
/**
 * Danh sách dự án: trạng thái/lọc/bảng, chọn dự án, nhớ mp3, xoá, copy, thư mục nguồn.
 *
 * Tách từ render-page.js (02/09/2026, audit Phase 2.3). Các module của trang
 * Dựng video dùng chung một không gian tên `window.__renderPage` (RP): core.js
 * đặt state/$/setStatus/apiGoi…; mỗi module đăng ký hàm của mình vào RP ở cuối
 * file; gọi sang module KHÁC qua `RP.tên()` — vì thứ tự nạp không đảm bảo module
 * kia đã có lúc file này chạy. Câu lệnh khởi động/gắn sự kiện nằm ở render-page.js.
 */
(() => {
  const RP = window.__renderPage;
  const { $, $all, MAX_AUDIO_BYTES, apiGoi, apiPost, applyTheme, currentProject, fallbackOutputUrl, fallbackProject, projectMap, projects, rowForProject, setButtonLabel, setStatus, state, toggleTheme } = RP;

  /**
   * Đọc lại danh sách dự án và vẽ lại MỖI bảng danh sách.
   *
   * Giữ nguyên dự án đang chọn nếu nó còn; mất rồi thì bỏ chọn chứ không tự
   * nhảy sang dự án khác — nhảy ngầm là người dùng bấm "Tạo video" cho một dự
   * án họ không hề chọn.
   */
  /* ══ Nhớ file giọng đọc THEO TỪNG DỰ ÁN ═══════════════════════════════
   *
   * Hai lỗi cùng một gốc:
   *   1. Ô <input type="file"> chỉ có MỘT trên trang, dùng chung cho mọi dự án.
   *      Chọn mp3 cho deck A rồi bấm sang deck B là B hiện luôn file của A —
   *      bấm Tạo video không để ý thì ra video B với giọng của A.
   *   2. Ô đó không sống qua lần khởi động app, nên mở lại là mất sạch.
   *
   * Không thể đặt lại file vào ô bằng code (trình duyệt cấm). Nên nhớ ĐƯỜNG DẪN
   * và lúc render đọc thẳng từ đĩa, không đi qua base64 nữa — tiện thể bỏ luôn
   * chỗ nạp cả file 200 MB vào bộ nhớ.
   */
  const KHOA_MP3 = 'mp3DaChon';
  let mp3DaChon = {};

  async function napMp3DaChon() {
    try {
      const s = await window.beeknoee.settings.get();
      mp3DaChon = (s && s[KHOA_MP3]) || {};
    } catch { mp3DaChon = {}; }
  }

  function nhoMp3(duAn, file) {
    const duong = window.beeknoee.projects.duongDanFile
      ? window.beeknoee.projects.duongDanFile(file) : '';
    // Không lấy được đường dẫn thì vẫn chạy được như cũ (đi đường base64),
    // chỉ là không nhớ qua lần khởi động. Đừng chặn người dùng vì chuyện đó.
    mp3DaChon[duAn] = { duong, ten: file.name };
    window.beeknoee.settings.set({ [KHOA_MP3]: mp3DaChon }).catch(() => {});
  }

  /** Bỏ file đã nhớ của một dự án. */
  function quenMp3(duAn) {
    delete mp3DaChon[duAn];
    window.beeknoee.settings.set({ [KHOA_MP3]: mp3DaChon }).catch(() => {});
  }

  const doDai = (n) => {
    if (!(n > 0)) return '';
    const p = Math.round(n);
    return String(Math.floor(p / 60)).padStart(2, '0') + ':' + String(p % 60).padStart(2, '0');
  };
  const doLon = (n) => {
    if (!(n > 0)) return '';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0).replace('.', ',') + ' KB';
    return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
  };
  /* `file://` + mã hoá khoảng trắng và ký tự lạ. Tên file giọng đọc hay có dấu
     tiếng Việt và dấu cách; để trần thì <audio> nhận một URL hỏng và im lặng. */
  const urlTep = (duong) => 'file:///' + encodeURI(String(duong).replace(/\\/g, '/').replace(/^\/+/, ''));

  let ngheTep = null;   // <audio> đang nghe thử, nếu có

  function dungNghe() {
    if (ngheTep) { try { ngheTep.pause(); } catch {} ngheTep = null; }
    const b = document.getElementById('elevenFileNghe');
    const o = b && b.querySelector('.btn-icon');
    if (o && o.dataset.icon !== 'play') {
      o.dataset.icon = 'play'; o.innerHTML = '';
      b.title = 'Nghe thử';
      if (window.__beeIcons) window.__beeIcons.apply(b);
    }
  }

  /**
   * Vẽ THẺ FILE giọng đọc: tên · dung lượng · thời lượng, kèm nút nghe và nút bỏ.
   *
   * `file` là `File` vừa chọn ở ô input, hoặc `null` khi chỉ dựng lại từ đường
   * dẫn đã nhớ (đổi dự án, hoặc mở lại app).
   *
   * ⚠ Hai nguồn số liệu KHÁC NHAU, không gộp được:
   *   · Vừa chọn  → `File` có sẵn `size`; phát bằng `URL.createObjectURL`.
   *   · Đã nhớ    → chỉ còn ĐƯỜNG DẪN (trình duyệt cấm đặt lại file vào ô input,
   *     xem `nhoMp3`). Dung lượng phải hỏi tiến trình chính (`thongTinTep`) vì
   *     `fetch`/XHR trên `file://` bị Chromium chặn; thời lượng thì thẻ <audio>
   *     tự đọc được qua `file://` (đã đo: ra 75s cho một tệp thật).
   */
  function veTheFile(file) {
    const the = document.getElementById('elevenFileThe');
    const tha = document.querySelector('.file-tha');
    const oTen = document.getElementById('elevenFileName');
    const oTin = document.getElementById('elevenFileTin');
    if (!the || !oTen) return;
    dungNghe();

    if (file && window.beeknoee.projects.duongDanFile) {
      oTen.dataset.duong = window.beeknoee.projects.duongDanFile(file) || '';
    }
    const duong = oTen.dataset.duong || '';
    const ten = file ? file.name : (oTen.textContent || '').trim();
    const co = !!(file || duong) && ten && ten !== 'Chưa chọn file';

    the.hidden = !co;
    if (tha) tha.classList.toggle('co-file', !!co);
    if (!co) { if (oTin) oTin.textContent = ''; return; }

    oTen.textContent = ten;
    const url = file ? URL.createObjectURL(file) : (duong ? urlTep(duong) : '');
    the.dataset.url = url;

    /* Dựng dòng thông tin theo từng mảnh: mảnh nào có thì hiện luôn, đừng đợi
       mảnh kia. Đọc thời lượng phải nạp metadata, chậm hơn hẳn phần dung lượng. */
    const manh = { lon: file ? doLon(file.size) : '', dai: '' };
    const veTin = () => {
      if (oTin) oTin.textContent = [manh.lon, manh.dai].filter(Boolean).join('  ·  ');
    };
    veTin();
    if (!file && duong && window.beeknoee.projects.thongTinTep) {
      window.beeknoee.projects.thongTinTep(duong)
        .then((t) => { if (t && t.kichThuoc) { manh.lon = doLon(t.kichThuoc); veTin(); } })
        .catch(() => {});
    }
    if (url) {
      const a = new Audio();
      a.onloadedmetadata = () => { manh.dai = doDai(a.duration); veTin(); };
      a.src = url;
    }
  }

  /** Nối nút NGHE THỬ và nút BỎ của thẻ file. Gọi một lần lúc dựng trang. */
  function noiTheFile() {
    const the = document.getElementById('elevenFileThe');
    if (!the || the.dataset.daNoi) return;
    the.dataset.daNoi = '1';
    const nutNghe = document.getElementById('elevenFileNghe');
    if (nutNghe) {
      nutNghe.onclick = () => {
        if (ngheTep) { dungNghe(); return; }
        const url = the.dataset.url;
        if (!url) return;
        ngheTep = new Audio(url);
        ngheTep.onended = dungNghe;
        ngheTep.onerror = dungNghe;
        ngheTep.play().catch(dungNghe);
        const o = nutNghe.querySelector('.btn-icon');
        if (o) {
          o.dataset.icon = 'stop'; o.innerHTML = '';
          nutNghe.title = 'Dừng nghe';
          if (window.__beeIcons) window.__beeIcons.apply(nutNghe);
        }
      };
    }
    const nutXoa = document.getElementById('elevenFileXoa');
    if (nutXoa) {
      nutXoa.onclick = () => {
        dungNghe();
        const oFile = document.getElementById('elevenFile');
        const oTen = document.getElementById('elevenFileName');
        if (oFile) oFile.value = '';
        if (oTen) { oTen.textContent = 'Chưa chọn file'; oTen.dataset.duong = ''; }
        const duAn = state.project;
        if (duAn) quenMp3(duAn);
        veTheFile(null);
        RP.capNhatNutDung();   // hết file thì nút Tạo video khoá lại
      };
    }
  }

  /* Hiện lại tên file đã nhớ của dự án, và DỌN ô input để không rò sang deck khác.
     Tra phần tử tại chỗ chứ không dùng biến khai ở cuối file: hàm này bị gọi từ
     `setSelectedProject`, mà thứ tự chạy không đảm bảo mấy biến đó đã khởi tạo. */
  function veMp3DaChon(duAn) {
    const oFile = document.getElementById('elevenFile');
    const oTen = document.getElementById('elevenFileName');
    if (!oTen) return;
    const g = mp3DaChon[duAn];
    // Xoá file đang nằm trong ô: đây chính là chỗ rò giữa các dự án.
    if (oFile) oFile.value = '';
    oTen.textContent = g && g.ten ? g.ten : 'Chưa chọn file';
    oTen.dataset.duong = (g && g.duong) || '';
    noiTheFile();
    veTheFile(null);
    RP.capNhatNutDung();   // dự án khác có thể đã nhớ file, hoặc chưa
  }

  /* Số thứ tự lượt nạp — chống hai lượt chồng nhau.
     Watcher có thể đẩy hai sự kiện sát nhau (bắn ở mép trước, rồi lần cuối khi
     im). Mỗi cái tạo một `fetch`; nếu cái sau về TRƯỚC thì bảng bị vẽ bằng dữ
     liệu cũ hơn, và trạng thái sẽ sai cho tới lần nạp kế tiếp. */
  let lanNap = 0;

  /* Deck vừa dựng xong TRONG PHIÊN NÀY — tên deck → đường dẫn video.
   *
   * ⚠ VÌ SAO CẦN SỔ RIÊNG. `lamMoiDanhSach()` thay SẠCH mảng `projects` bằng
   * dữ liệu đọc từ đĩa, nên mọi thứ đánh dấu trong bộ nhớ đều bay mất. Mà lúc
   * một lượt render vừa xong, hàm đó được gọi NGAY và KHÔNG chờ — nếu lần đọc
   * đĩa ấy chạy đua với lúc tệp video vừa ghi xong, máy chủ trả `has_output`
   * còn false, và dòng của deck tụt về "Sẵn sàng" dù video đã nằm đó.
   * Giữ riêng ở đây rồi áp lại sau mỗi lần nạp thì không còn cửa cho cuộc đua. */
  const videoVuaXong = new Map();

  async function lamMoiDanhSach() {
    const lan = ++lanNap;
    const res = await fetch('/api/projects');
    const data = await res.json();
    // Đã có lượt mới hơn chạy sau mình → kết quả này lỗi thời, bỏ đi.
    if (lan !== lanNap) return projects.length;
    const moi = Array.isArray(data && data.projects) ? data.projects : [];
    projects.length = 0;
    moi.forEach((p) => projects.push(p));
    projectMap.clear();
    projects.forEach((p) => projectMap.set(p.name, p));
    // Bộ slide phụ đã mở (dòng ảo — không có trong danh sách main trả về): dựng lại từ dự án mẹ mới.
    boAo.forEach((ten) => { const p = dongBoAo(ten); if (p) projectMap.set(ten, p); else boAo.delete(ten); });
    // Áp lại sổ "vừa dựng xong" — xem chú thích ở `videoVuaXong`.
    videoVuaXong.forEach((url, ten) => {
      const p = projectMap.get(ten);
      if (!p) return;
      p.has_output = true;
      if (!p.video_url) p.video_url = url;
    });
    // state.project là CHUỖI tên (xem setSelectedProject), không phải object.
    // Đọc .name của nó ra undefined nên lần đầu làm mới là mất luôn dự án đang
    // chọn — đã đo.
    const dangChon = state.project;
    buildProjectRows();
    if (dangChon && projectMap.has(dangChon)) setSelectedProject(dangChon, false);
    return projects.length;
  }
  /* ══ Kết thúc giai đoạn dò trạng thái ═════════════════════════════════
   *
   * Cần ĐỦ CẢ HAI mới dám kết luận, vì mỗi cái trả lời một câu hỏi khác nhau:
   *   biRender  — `/api/jobs/current` đã trả lời: có job nào đang chạy không.
   *   biGhi     — đã lắng đủ lâu để tin rằng không ai đang ghi vào thư mục.
   *
   * Chờ MỘT cái rồi kết luận là sai: biết "không có job render" nhưng chưa đủ
   * thời gian nghe ngóng thì deck đang được AI ghi dở vẫn hiện "Sẵn sàng". */
  let biRender = false;
  let biGhi = false;
  /* Dài hơn IM_LANG_MS của main (3000ms) một chút: sự kiện watcher phải đi qua
     IPC rồi mới tới đây, cắt đúng 3000 là có lúc kết luận trước khi tin về. */
  const CHO_DO_MS = 3300;

  function thoiDoTrangThai() {
    if (!biRender || !biGhi) return;
    if (!state.dangDoTrangThai) return;
    state.dangDoTrangThai = false;
    // Vẽ lại để thay nhãn "Đang kiểm tra…" bằng trạng thái thật. `capNhatOLoc()`
    // phải chạy cùng: lúc đang dò, mọi dòng đếm về một nhóm nên ô lọc sai hết.
    buildProjectRows();   // tự gắn lại dấu sáng ở cuối hàm, xem chú thích trong đó
    capNhatOLoc();
  }
  /* Ba cửa cho phần điều phối (render-page.js) báo về — biến `biRender`/`biGhi`
     là của riêng module này, bên ngoài không gán thẳng được. */
  function baoBiRender() { biRender = true; thoiDoTrangThai(); }
  function baoBiGhi() { biGhi = true; thoiDoTrangThai(); }
  function epKetThucDo() {
    if (!state.dangDoTrangThai) return;
    biRender = true;
    biGhi = true;
    thoiDoTrangThai();
  }
  /**
   * Dựng bảng dự án TỪ DỮ LIỆU THẬT (`window.__PROJECTS__`).
   *
   * Trước đây 80 dòng này nằm cứng trong index.html — di sản của lần trích
   * giao diện từ web_server.py, vốn render sẵn ở phía máy chủ. Hậu quả đã đo
   * được: đĩa có 82 deck nhưng bảng chỉ hiện 80; `gia-vang-hom-nay-3-8-2026`
   * và `browser-use-github` KHÔNG chọn/render được vì đơn giản là không có
   * dòng. Mọi deck tạo mới sau lần trích đó cũng chịu chung số phận.
   *
   * Đường dẫn `/slide/...` phải giữ NGUYÊN VĂN dạng dưới đây: bộ chặn click ở
   * slide-viewer.js khớp đúng hai mẫu này để mở trong app thay vì bật cửa sổ
   * ngoài, và script kiểm tra endpoint dò đúng chuỗi đó trong mã nguồn.
   */
  /**
   * Thùng rác vẽ bằng SVG, KHÔNG dùng emoji 🗑 và cũng không dùng Font Awesome.
   *
   * Emoji hiện ra dạng màu sẵn của hệ điều hành nên chọi với giao diện đơn sắc,
   * ép về dạng chữ bằng U+FE0E thì tuỳ máy mới ăn. Font Awesome thì có sẵn
   * trong `resources/fonts/` nhưng thư mục đó bị `asarUnpack` tách ra ngoài
   * `app.asar`, nên đường dẫn tương đối chạy được lúc dev mà gãy khi đóng gói.
   * SVG nội tuyến ăn theo `currentColor`, không phụ thuộc gì hết.
   */
  /* Từ 10/09/2026 thùng rác lấy từ `icons.js` như mọi icon khác (bộ Lucide),
     không còn vẽ riêng ở đây nữa — vẽ riêng một cái là bộ lệch một cái. */

  /**
   * Số dòng đang hiện. Danh sách dài (đã gặp deck 82 dự án) mà dựng hết một lượt
   * thì mở app phải chờ dựng 82 × ~15 nút — chậm thấy rõ, mà 9/10 lần người
   * dùng chỉ động vào vài dự án trên cùng.
   *
   * ⚠ Đây là cắt Ở GIAO DIỆN, không phải ở dữ liệu: `projects` vẫn đủ cả, nên
   * chọn dự án bằng URL `?project=` hay `__INITIAL_PROJECT__` vẫn tìm thấy dự
   * án nằm ngoài 5 dòng đầu. Cắt cả ở dữ liệu là dự án thứ 6 biến mất khỏi
   * app — đúng lỗi đã từng xảy ra khi bảng còn viết cứng 80 dòng trong HTML.
   *
   * 5 chứ không 10: danh sách sắp theo `updatedAt` giảm dần (xem
   * src/main/duAn.js), nên 5 dòng đầu đúng là 5 dự án vừa động vào gần nhất —
   * còn lại tìm bằng ô tìm kiếm hoặc nút Xem thêm.
   */
  const MOI_LAN = 5;
  let soDongHien = MOI_LAN;
  /** Về lại 5 dòng đầu — gõ từ khoá mới / đổi ô lọc. */
  function datLaiSoDongHien() { soDongHien = MOI_LAN; }

  /**
   * Trạng thái của một dự án — MỘT nguồn duy nhất cho cả dòng lẫn bộ lọc.
   *
   * Tách khỏi `buildProjectRows` vì bộ lọc cần chính con số này để đếm. Để hai
   * chỗ tự tính là sớm muộn lệch nhau: bộ lọc bảo có 3 "Video cũ" mà bảng hiện
   * 2, không ai biết bên nào đúng.
   *
   * THỨ TỰ XÉT CÓ Ý NGHĨA, đừng đảo:
   *   1. đang dựng      — việc đang chạy, quan trọng hơn mọi trạng thái tĩnh
   *   2. đang thiết kế  — AI ghi dở, chưa nên cho mở sửa
   *   3. thiếu script   — deck nằm im mà không đủ script
   *   4. video cũ       — có video nhưng script đã sửa sau đó
   *   5. đã có video / sẵn sàng
   */
  /**
   * Mốc mili-giây -> { ngay: '12/09/2026', gio: '14:23' }; `null` khi không có.
   *
   * Tự ghép chứ không `toLocaleDateString`: máy khách có thể đang để ngôn ngữ
   * khác, mà cột này phải đọc được giống nhau trên mọi máy.
   */
  function ngayGon(ms) {
    const t = Number(ms) || 0;
    if (!t) return null;
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return null;
    const hai = (n) => String(n).padStart(2, '0');
    return {
      ngay: `${hai(d.getDate())}/${hai(d.getMonth() + 1)}/${d.getFullYear()}`,
      gio: `${hai(d.getHours())}:${hai(d.getMinutes())}`,
    };
  }

  function tinhTrangThai(project) {
    const name = project.name;
    const count = Number(project.script_count) || 0;
    /* ══ CHƯA BIẾT thì nói là chưa biết ═══════════════════════════════════
     *
     * Hai trạng thái dưới đây KHÔNG đọc được từ đĩa, nên lúc vẽ lần đầu app
     * không có cách nào biết:
     *
     *   "Đang dựng"      — nằm ở `state.busy`, chỉ đúng sau khi `resyncRender()`
     *                      hỏi xong `/api/jobs/current`. Hàm đó bất đồng bộ và
     *                      chạy SAU lần vẽ đầu.
     *   "Đang thiết kế"  — main suy ra từ `deckDangGhi`, một Map trong bộ nhớ do
     *                      `fs.watch` đổ vào. Vừa mở app thì Map đó RỖNG: watcher
     *                      mới bật, chưa có lịch sử ghi nào.
     *
     * Không chặn thì cả hai cùng rơi về nhánh cuối và deck đang render hoặc
     * đang được AI ghi dở hiện "Sẵn sàng" — một câu trả lời DỨT KHOÁT mà lại
     * sai, tệ hơn hẳn việc nói thẳng là đang dò.
     *
     * Cửa sổ chờ dài đúng bằng luật im lặng của main (IM_LANG_MS = 3s): sau 3
     * giây không thấy tiếng ghi nào thì "không ai đang ghi" mới là kết luận
     * thật, chứ không phải chỉ là chưa kịp nghe. Xem `thoiDoTrangThai()`. */
    if (state.dangDoTrangThai) {
      return { cls: 'load', text: 'Đang kiểm tra…', label: 'App vừa mở — đang dò xem deck này có đang dựng hay đang được ghi không' };
    }
    if (state.busy && state.deckDangDung === name) {
      return { cls: 'run', text: 'Đang dựng', label: 'Đang tạo video cho dự án này' };
    }
    /* Đang chờ đứng NGAY SAU đang dựng, TRƯỚC mọi trạng thái đọc từ đĩa: nó là
       việc đang diễn ra, phải thắng "Đã có video" hay "Sẵn sàng" — deck đã có
       video mà đang xếp hàng dựng lại thì thứ người dùng cần biết là nó sắp
       chạy, không phải là nó từng chạy. */
    const cho = state.hangDoi.indexOf(name);
    if (cho >= 0) {
      return {
        cls: 'wait',
        text: `Đang chờ · ${cho + 1}`,
        /* `nhom` tách khỏi `text` vì nhãn có kèm SỐ THỨ TỰ. Ô lọc so khớp
           chính xác chuỗi, mà "Đang chờ · 2" thì không mục nào trong ô lọc
           trùng — lọc ra rỗng. Mọi trạng thái khác `nhom` bằng chính `text`. */
        nhom: 'Đang chờ',
        label: `Đứng thứ ${cho + 1} trong hàng đợi — bấm nút Dựng video để bỏ khỏi hàng`,
      };
    }
    if (project.dang_thiet_ke) {
      return { cls: 'wip', text: 'Đang thiết kế', label: 'Deck đang được dựng — đợi xong rồi mở' };
    }
    /* DỰ ÁN VIDEO TRỐNG (src/dung/duAnVideo.js): không có script — đừng báo "Thiếu script". */
    if (project.loai === 'video') {
      if (project.has_output && project.video_cu) return { cls: 'old', text: 'Video cũ', label: 'Timeline đã sửa sau lần xuất gần nhất — nên xuất lại' };
      if (project.has_output) return { cls: 'done', text: 'Đã có video', label: 'Đã xuất video — vẫn xuất lại được' };
      return { cls: 'ok', text: 'Sẵn sàng', label: 'Dự án video — thả ảnh, video, nhạc lên timeline rồi bấm "Xuất video"' };
    }
    if (!project.has_script || !count) {
      return { cls: 'warn', text: 'Thiếu script', label: 'Không thấy script-90s.txt — chưa tạo video được' };
    }
    if (project.has_output && project.video_cu) {
      /* Sửa script rồi quên dựng lại là lỗi âm thầm tệ nhất: video vẫn mở được,
         vẫn chạy, chỉ là nội dung không còn khớp lời thoại. Không có dấu hiệu
         nào cho tới lúc đăng lên mới phát hiện. */
      /* `old` chứ không dùng chung `warn` với "Thiếu script": hai bệnh khác
         hẳn nhau. Thiếu script là CHẶN ĐỨNG, bấm tạo cũng không chạy. Video cũ
         thì vẫn dựng được, chỉ là nội dung không còn khớp. Dùng chung một màu
         là người dùng phải đọc chữ mới biết cái nào gấp. */
      return { cls: 'old', text: 'Video cũ', label: 'Script đã sửa sau lần dựng gần nhất — nên tạo lại video' };
    }
    if (project.has_output) {
      return { cls: 'done', text: 'Đã có video', label: 'Đã tạo video — vẫn tạo lại được' };
    }
    return { cls: 'ok', text: 'Sẵn sàng', label: 'Đủ script, tạo video được' };
  }

  /** Nhóm dùng để LỌC. Khác nhãn hiển thị ở chỗ không kèm số thứ tự hàng đợi. */
  const nhomTrangThai = (p) => { const t = tinhTrangThai(p); return t.nhom || t.text; };

  /** Lọc theo ô tìm kiếm + trạng thái đang chọn. Trả danh sách đã lọc. */
  function locDuAn() {
    const oTim = document.getElementById('timDuAn');
    const oLoc = document.getElementById('locTrangThai');
    const tim = (oTim ? oTim.value : '').trim().toLowerCase();
    const loc = oLoc ? oLoc.value : '';
    return projects.filter((p) => {
      if (tim && !String(p.name).toLowerCase().includes(tim)) return false;
      /* Đang dò thì BỎ QUA bộ lọc trạng thái: lúc đó mọi dòng đều mang nhãn
         "Đang kiểm tra…", nên một bộ lọc đang bật (vd "Đã có video") sẽ loại
         sạch danh sách và người dùng nhìn thấy màn trống trong mấy giây đầu —
         trông như mất hết dự án. Lọc theo TÊN thì vẫn đúng, giữ nguyên. */
      if (loc && !state.dangDoTrangThai && nhomTrangThai(p) !== loc) return false;
      return true;
    });
  }

  /** Điền số đếm vào từng mục của ô lọc, và ẩn mục không có dự án nào. */
  function capNhatOLoc() {
    const oLoc = document.getElementById('locTrangThai');
    if (!oLoc) return;
    /* Chưa dò xong thì chưa đếm được — mọi dòng đang là "Đang kiểm tra…" nên
       mục nào cũng ra 0 và bị ẩn sạch, ô lọc trông như hỏng. Để nguyên, lát
       `thoiDoTrangThai()` gọi lại hàm này với số thật. */
    if (state.dangDoTrangThai) return;
    const dem = new Map();
    projects.forEach((p) => {
      const t = nhomTrangThai(p);
      dem.set(t, (dem.get(t) || 0) + 1);
    });
    [].forEach.call(oLoc.options, (o) => {
      if (!o.value) { o.textContent = `Tất cả (${projects.length})`; return; }
      const n = dem.get(o.value) || 0;
      o.textContent = `${o.value} (${n})`;
      /* Ẩn mục rỗng — với 5 trạng thái thì phần lớn thời gian 2-3 mục trống,
         để lại chỉ tổ dài danh sách. Nhưng KHÔNG ẩn mục đang chọn, không thì
         ô lọc tự nhảy sang giá trị khác ngay dưới tay người dùng. */
      o.hidden = n === 0 && oLoc.value !== o.value;
    });
  }

  function buildProjectRows() {
    const list = $('#projectList');
    if (!list) return;

    const esc = (value) => String(value).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    list.replaceChildren();
    capNhatOLoc();
    const hienThi = locDuAn();
    hienThi.slice(0, soDongHien).forEach((project, index) => {
      const name = project.name;
      const safe = esc(name);
      const href = `/slide/${encodeURIComponent(name)}/`;
      const videoHref = `/slide/${encodeURIComponent(name)}/output/${encodeURIComponent(project.video_file || (name + '.mp4'))}`;
      const count = Number(project.script_count) || 0;

      /* Trạng thái là DẤU, không phải chữ: cả cột trước đây lặp lại đúng một
       * chữ "Sẵn sàng" ở mọi dòng — tốn chỗ mà không nói thêm điều gì.
       * `title` giữ nguyên nghĩa cho người dùng rê chuột và cho trình đọc màn hình.
       *
       * THỨ TỰ XÉT CÓ Ý NGHĨA, đừng đảo:
       *   1. đang dựng      — việc đang chạy, quan trọng hơn mọi trạng thái tĩnh
       *   2. đang thiết kế  — AI ghi dở, chưa nên cho mở sửa
       *   3. thiếu script   — deck cũ nằm im mà không đủ script
       *   4. đã có video    — xong rồi, nhưng vẫn tạo lại được
       *   5. sẵn sàng
       *
       * Phân biệt (2) với (3): cùng là thiếu script, nhưng `dang_thiet_ke` do
       * main đánh dấu dựa trên việc thư mục VỪA được ghi. Deck cũ thiếu script
       * thì cứ mở sửa bình thường; deck AI đang ghi dở thì mở ra là thấy dở dang. */
      const st = tinhTrangThai(project);

      // Đang thiết kế thì KHÔNG cho mở trình sửa: deck còn dở, mở ra chỉ thấy
      // một nửa và dễ tưởng hỏng.
      const choSua = !project.dang_thiet_ke;

      /* ⚠ KHÔNG còn ảnh đại diện trước tên (bỏ 13/09/2026 theo yêu cầu chủ dự
         án: "cái đấy mình thấy không cần thiết"). Tên deck đã tự nói đủ, mà
         mỗi hàng một tấm ảnh dọc 36x64 làm danh sách rối hơn là dễ tra.

         ⚠ CẢ DÂY ĐÃ GỠ THEO, đừng tìm `project.thumb` nữa — trường đó không còn
         tồn tại. Gỡ cùng lượt (xem CONTEXT §6.5E trước khi đưa lại thứ nào):
           · `duAn.anhDaiDien()` — hàm chọn ảnh, thứ tự xét đã đo trên 52 deck.
           · `main/anhBia.js` — cả tệp. Đường A chụp lúc render (2,5 ms) và
             đường B mở cửa sổ ẩn ~2 giây mỗi lần mở Trình sửa.
           · `offscreen.anhKhungMoiNhat()` và tuỳ chọn `danhDauVuaGhi` của
             render — hai thứ chỉ tồn tại để phục vụ đường A.
         Nhóm "Ảnh chụp slide cũ" trong hộp Dọn rác nay xoá được mà KHÔNG mất gì
         trong app; câu cảnh báo đã viết lại cho đúng. */
      /* Ngày sửa gần nhất. Mốc do `duAn.listProjects()` tính theo TỆP NỘI
         DUNG (index.html, script, style, app.js, preview-settings) — KHÔNG
         theo mốc thư mục, vì mở deck là app ghi `_preview.html` vào đó. */
      const ngay = ngayGon(project.updated_at);

      const row = document.createElement('li');
      row.className = 'project-row';
      row.dataset.project = name;
      // Không còn nút "Chọn": bấm vào DÒNG là chọn (handler gắn ở cuối file).
      // Một hàng có 5 nút thì nút hay dùng nhất lại lẫn vào 4 nút kia.
      //
      // Trạng thái nằm CẠNH số slide, không chiếm cột riêng: một cột chỉ để
      // lặp lại "Sẵn sàng" ở gần hết các dòng thì tốn chỗ hơn giá trị nó mang.
      row.innerHTML = `
              <span class="row-index">${index + 1}</span>
              <div class="project-main">
                <div class="project-chu">
                <span class="project-title-row">
                  <!-- So thu tu NAM TRONG hang tieu de, khong phai mot cot rieng.
                       Cot rieng 22px la thu tao ra khoang trong 44px ben trai ma
                       chu du an phai nhac ba lan; de ngay truoc ten thi van con
                       so ma le chi 12px. Phan tu .row-index (o luoi cu) van nam
                       trong DOM cho bo cuc rong, bi an o bo cuc ba cot.
                       KHONG DUNG DAU HUYEN O DAY - xem canh bao cuoi khoi nay. -->
                  <span class="stt-hang">${index + 1}</span>
                  <span class="project-name" title="${safe}">${safe}</span>${project.khung === 'ngang'
                    ? '<span class="nhan-khung nhan-ngang" title="Bài giảng ngang 16:9 — dựng ra video 1920x1080 cho YouTube"><span class="btn-icon" data-icon="bangngang"></span></span>'
                    : '<span class="nhan-khung nhan-doc" title="Video ngắn dọc 9:16 — dựng ra video 1080x1920 cho Shorts/TikTok"><span class="btn-icon" data-icon="dienthoai"></span></span>'}
                  <button class="copy-name-btn icon-only" type="button" data-project="${safe}" title="Chép tên dự án" aria-label="Chép tên dự án"><span class="btn-icon" data-icon="copy">⧉</span></button>
                </span>
                <span class="project-meta">
                  <span class="project-slide-count">${project.loai === 'video' ? 'Video' : `${count} slide`}</span>
                  <span class="project-status ${st.cls}" title="${st.label}">${st.text}</span>
                  <!-- Dau (i) thong tin video da CHUYEN len thanh tren canh nut doi ten
                       (11/10/2026, thanh-tren.js#tbThongTin). KHONG DUNG DAU HUYEN O DAY. -->
                  <!-- Nút XOÁ nằm ngay đây, cùng dòng với số slide và trạng thái:
                       cột chỉ rộng 380px, để nó một hàng riêng là tốn cả hàng cho
                       một cái thùng rác. -->
                  <button class="delete-project-btn icon-only trash" type="button" data-project="${safe}" title="Xoá dự án (chuyển vào Thùng rác)" aria-label="Xoá dự án"><span class="ic-o" data-icon="trash"></span></button>
                </span>
                </div>
              </div>
              <!-- ⚠ CỤM NÚT HÀNH ĐỘNG ĐÃ BỎ HẲN (15/09/2026):
                   · "Sửa"/"Xem to" — bấm vào hàng là deck hiện luôn ở giữa trang.
                   · "Chép phụ đề" — nay ở bảng phụ đề (bấm track C1 → tab Thuộc tính).
                   · Mở video — chuyển xuống thanh điều khiển dưới khung xem.
                   · Xoá — lên cùng dòng với số slide và trạng thái.
                   Cột 380px không đủ chỗ cho một hàng nút riêng.
                   ⚠ TUYỆT ĐỐI KHÔNG dùng dấu huyền trong chú thích này: nó nằm
                   TRONG một template literal, một dấu là đứt chuỗi và cả tệp sai
                   cú pháp (đã dính đúng vậy 15/09/2026).
                   Cot thu ba nay truoc bo trong tu luc go cum nut; nay la NGAY
                   CAP NHAT, dung cho nguoi dung biet deck nao vua sua. -->
              <span class="project-ngay">${ngay
                ? `<span class="pn-ngay">${ngay.ngay}</span><span class="pn-gio">${ngay.gio}</span>`
                : ''}</span>`;
      list.appendChild(row);
    });

    /* Không tìm thấy gì — phải nói ra, đừng để bảng trống trơn.
       Bảng rỗng mà không giải thích thì người dùng tưởng mất hết dự án. */
    if (!hienThi.length) {
      const rong = document.createElement('li');
      rong.className = 'project-row row-xem-them';
      rong.innerHTML = '<div class="tpl-rong" style="padding:18px 4px">Không có dự án nào khớp. Xoá từ khoá hoặc chọn lại trạng thái.</div>';
      list.appendChild(rong);
    }

    // Dòng "Xem thêm" — đếm trên DANH SÁCH ĐÃ LỌC, không phải tổng số dự án.
    // Đếm theo tổng thì lọc còn 3 dự án mà vẫn mời "xem thêm 10", bấm vào không
    // ra gì thêm.
    const conLai = hienThi.length - soDongHien;
    if (conLai > 0) {
      const them = document.createElement('li');
      them.className = 'project-row row-xem-them';
      them.innerHTML = `
              <button class="xem-them-btn" type="button" data-xem-them><span
                class="xem-them-cong" aria-hidden="true">+</span>Xem thêm (${conLai})</button>`;
      // Gắn thẳng vào nút chứ không uỷ quyền lên #projectList: bộ chọn dòng ở
      // dưới bắt mọi cú bấm trong danh sách và coi đó là "chọn dự án" — dòng
      // này không có `data-project` nên sẽ chọn nhầm sang undefined.
      them.querySelector('[data-xem-them]').addEventListener('click', (e) => {
        e.stopPropagation();
        soDongHien += MOI_LAN;
        buildProjectRows();
      });
      list.appendChild(them);
    }

    // Vẽ icon SVG cho các hàng vừa dựng. `icons.js` chỉ quét MỘT LẦN lúc nạp
    // trang, mà bảng này dựng sau và dựng lại mỗi lần làm mới — không gọi ở đây
    // thì mấy ô `data-icon` nằm trống không, chẳng báo lỗi gì.
    if (window.__beeIcons) window.__beeIcons.apply(list);

    /* Con số ở header cũng từng viết cứng ("80") nên lệch với thực tế.
       Có HAI chỗ hiện số: huy hiệu góc trên và tiêu đề cột danh sách.
       Đang lọc thì hiện "đã lọc/tổng" — chỉ hiện số đã lọc là người dùng tưởng
       mất dự án, chỉ hiện tổng là không biết bộ lọc có ăn không. */
    const dangLoc = hienThi.length !== projects.length;
    $all('[data-project-count]').forEach((el) => {
      el.textContent = dangLoc ? `${hienThi.length}/${projects.length}` : String(projects.length);
    });

    /* ══ GẮN LẠI DẤU SÁNG — phải nằm Ở ĐÂY, không phải ở chỗ gọi ═══════════
     *
     * Lớp `.selected` do `setSelectedProject()` gắn SAU khi dựng bảng, nên mọi
     * lần dựng lại đều xoá sạch nó. Chỉ `lamMoiDanhSach()` là nhớ chọn lại;
     * bốn chỗ gọi còn lại thì không, và người dùng thấy dòng đang chọn tự hết
     * sáng dù khung bên phải vẫn ghi tên dự án đó:
     *
     *   - bấm "Xem thêm" để mở rộng danh sách
     *   - gõ vào ô tìm kiếm
     *   - đổi ô lọc trạng thái
     *   - dò xong trạng thái lúc mở app (`thoiDoTrangThai`)
     *
     * Đặt ở cuối hàm dựng thì mọi đường vào đều được vá cùng lúc, và chỗ gọi
     * mới sau này không phải nhớ thêm gì. `setSelectedProject()` có toggle lại
     * ngay sau khi gọi hàm này — trùng nhau vô hại, cùng một kết quả. */
    if (state.project) {
      $all('.project-row[data-project]').forEach((row) => {
        row.classList.toggle('selected', row.dataset.project === state.project);
      });
    }
  }

  /**
   * BỎ CHỌN dự án — thư mục nguồn mới không có dự án nào.
   *
   * Không có hàm nào làm việc này trước đây vì trước đây đổi thư mục là NẠP LẠI
   * CẢ CỬA SỔ (xem `doiNguonTaiCho`). Bỏ cú nạp lại thì phải tự dọn: để nguyên
   * là sân khấu vẫn hiện deck của thư mục CŨ — một deck không còn trong danh
   * sách nào cả.
   *
   * ⚠ Chỉ cần gọi `sanKhau.chonDeck('')`: nó gọi `deckCau.dat(null, '')`, và
   * bảng sửa · thanh trên · thanh phát đều đã đăng ký nghe qua `deckCau.nghe`
   * nên tự dọn theo. Gọi tay từng cái là dựng đường thứ hai, sớm muộn lệch.
   */
  function boChonDuAn() {
    state.project = '';
    state.outputUrl = '';
    $all('.project-row[data-project]').forEach((r) => r.classList.remove('selected'));
    const sel = $('#projectSelect');
    if (sel) sel.value = '';
    const ten = $('#selectedName');
    if (ten) ten.textContent = '';
    if (RP.sanKhau && RP.sanKhau.chonDeck) RP.sanKhau.chonDeck('');
    RP.capNhatNutDung();
  }

  /**
   * Đổi thư mục nguồn xong thì NẠP LẠI TẠI CHỖ — KHÔNG nạp lại cả cửa sổ.
   *
   * ⚠ Bản trước là `window.location.href = …`, tức nạp lại toàn bộ renderer.
   * Ba cái hại, và cái thứ ba mới là lý do phải bỏ:
   *   · mất sạch trạng thái đang giữ trong bộ nhớ (hội thoại AI đang mở, chỗ
   *     cuộn, tab đang xem);
   *   · nháy trắng cả cửa sổ cho một thao tác đáng lẽ chỉ đổi một danh sách;
   *   · nó dựng lại địa chỉ từ `location.pathname` — ở bản ĐÃ CÀI đường đó nằm
   *     trong `app.asar`, đúng loại mã chạy ngon ở bản mã nguồn mà vỡ ở bản
   *     cài. `verify:ui` cũng chấm dòng đó là "điều hướng chưa vá" vì không
   *     phân biệt được "nạp lại chính trang này" với "đi tới một route lạ".
   *
   * `lamMoiDanhSach()` làm đủ việc: gọi lại `/api/projects`, dựng lại
   * `projects`/`projectMap`, vẽ lại bảng, và giữ dự án đang chọn nếu nó còn.
   */
  async function doiNguonTaiCho(data, nguonCu) {
    const ds = Array.isArray(data && data.projects) ? data.projects : [];
    const nguonMoi = String((data && data.source_root) || '');
    /* ⚠ NGƯỜI DÙNG BẤM HUỶ ở hộp thoại thì main trả về CHÍNH thư mục cũ
       (`pickRoot()` rỗng → `root || s.sourceRoot`). Khi đó tuyệt đối không đổi
       dự án đang chọn — họ không yêu cầu đổi gì cả. Vẫn nạp lại danh sách cho
       chắc, rẻ và không hại. */
    const daDoi = !!nguonMoi && !!nguonCu && nguonMoi !== nguonCu;
    await lamMoiDanhSach();
    if (!daDoi) return;
    /* Thư mục MỚI thì dự án đang chọn thuộc thư mục cũ — chọn dự án đầu của
       danh sách mới, đúng như cú nạp lại cũ vẫn làm (nó đặt `?project=<đầu>`).
       `setSelectedProject` tự cập nhật địa chỉ qua `updateProjectUrl`. */
    const dau = ds[0] && ds[0].name;
    if (dau && projectMap.has(dau)) { setSelectedProject(dau); return; }
    boChonDuAn();
  }

  function setSourceSelectStatus(message, tone = 'warn') {
    if ($('#renderStatus')) setStatus(message, tone);
  }

  async function selectSourceRootFromFinder() {
    const buttons = $all('[data-source-root-select]');
    buttons.forEach((button) => { button.disabled = true; });
    setSourceSelectStatus('Đang mở hộp thoại chọn thư mục nguồn...', 'warn');
    try {
      /* Đọc thư mục nguồn ĐANG dùng TRƯỚC khi mở hộp thoại — đó là cách duy
         nhất biết người dùng có thật sự đổi hay đã bấm Huỷ (xem
         `doiNguonTaiCho`). Hỏng thì coi như không biết, và khi đó không đổi
         dự án đang chọn — chọn im lặng vẫn hơn chọn bừa. */
      let nguonCu = '';
      try { nguonCu = String((await window.beeknoee.settings.get()).sourceRoot || ''); }
      catch { nguonCu = ''; }
      const data = await apiPost('/api/source-root/select', {});
      const count = Array.isArray(data.projects) ? data.projects.length : 0;
      setSourceSelectStatus(`Đã đổi source. Tìm thấy ${count} project.`, 'good');
      await doiNguonTaiCho(data, nguonCu);
    } catch (error) {
      setSourceSelectStatus(error.message || String(error), 'bad');
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  function setRevealOutputButton(projectName = state.project, visible = false) {
    const button = $('#revealOutput');
    if (!button) return;
    button.dataset.project = projectName || '';
    button.hidden = !visible;
    button.disabled = false;
  }

  function setProjectVideoBadge(project) {
    const badge = $('#projectVideoBadge');
    if (!badge) return;
    const ready = Boolean(project?.video_url);
    badge.textContent = ready ? 'đã có video' : 'chưa tạo video';
    badge.className = `project-video-badge ${ready ? 'ready' : 'missing'}`;
  }

  /**
   * Nháy dấu tích trên nút Copy rồi trả về icon cũ.
   *
   * Dùng `innerHTML` chứ KHÔNG dùng `textContent`: từ khi có `icons.js`, phần
   * `.btn-icon` chứa một thẻ `<svg>`, mà `textContent` của SVG là chuỗi rỗng.
   * Bản cũ gán `icon.textContent = '✓'` là xoá luôn SVG, rồi lúc trả về lại lấy
   * `dataset.defaultIcon` (cũng rỗng) nên rơi xuống ký tự '⧉' — nút mất icon
   * vĩnh viễn sau lần bấm đầu tiên.
   *
   * Nội dung gốc giữ trong thuộc tính JS chứ không nhét vào `data-*`: markup SVG
   * nằm trong thuộc tính HTML thì vừa dài vừa khó đọc khi soi DOM.
   */
  function flashCopyButton(button) {
    if (!button) return;
    const icon = button.querySelector('.btn-icon');
    if (!icon) return;
    if (button._defaultIconHtml === undefined) button._defaultIconHtml = icon.innerHTML;
    if (!button.dataset.defaultTitle) button.dataset.defaultTitle = button.getAttribute('title') || 'Copy';
    if (!button.dataset.defaultAriaLabel) button.dataset.defaultAriaLabel = button.getAttribute('aria-label') || button.dataset.defaultTitle;
    icon.innerHTML = window.__beeIcons?.ICONS?.check || '✓';
    button.setAttribute('title', 'Đã copy');
    button.setAttribute('aria-label', 'Đã copy');
    if (button._copyResetTimer) window.clearTimeout(button._copyResetTimer);
    button._copyResetTimer = window.setTimeout(() => {
      icon.innerHTML = button._defaultIconHtml;
      button.setAttribute('title', button.dataset.defaultTitle || 'Copy');
      button.setAttribute('aria-label', button.dataset.defaultAriaLabel || button.dataset.defaultTitle || 'Copy');
    }, 1400);
  }

  /**
   * Chép TÊN dự án — không phải nội dung script.
   *
   * Tên deck là thứ phải gõ lại nhiều nhất: nhắc cho AI, đặt tên file, tìm
   * trong thư mục. Gõ tay thì sai một dấu gạch là hỏng cả câu lệnh.
   */
  async function copyProjectName(name, button) {
    if (!name) return;
    try {
      await navigator.clipboard.writeText(name);
    } catch {
      fallbackCopyText(name);
    }
    flashCopyButton(button);
    if (!button) return;
    button.classList.add('da-copy');
    if (button._nameResetTimer) window.clearTimeout(button._nameResetTimer);
    button._nameResetTimer = window.setTimeout(() => button.classList.remove('da-copy'), 1400);
  }

  function fallbackCopyText(text) {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    helper.style.pointerEvents = 'none';
    document.body.appendChild(helper);
    helper.select();
    helper.setSelectionRange(0, helper.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(helper);
    if (!ok) throw new Error('Không chép được vào clipboard.');
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else fallbackCopyText(text);
  }

  /* Xoá khoá đang lưu. Có bước hỏi lại: bấm nhầm là mất khoá, mà lấy lại thì
     phải sang tận trang ElevenLabs tạo key mới — key cũ không xem lại được. */
  async function copyProjectScript(projectName, button) {
    const project = String(projectName || '').trim();
    if (!project) {
      setStatus('Không tìm thấy dự án để chép phụ đề.', 'bad');
      return;
    }
    if (button) button.disabled = true;
    try {
      const data = await apiGoi(`/api/slide-script?project=${encodeURIComponent(project)}`, { cache: 'no-store' });
      const text = Array.isArray(data.lines) ? data.lines.join('\n') : '';
      if (!text.trim()) throw new Error(`${project} chưa có phụ đề — script-90s.txt trống hoặc chưa có.`);
      await copyText(text);
      flashCopyButton(button);
      setStatus(`Đã chép phụ đề của ${project}.`, 'good');
    } catch (error) {
      setStatus(error.message || String(error), 'bad');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function updateProjectUrl(projectName) {
    if (window.location.pathname !== '/') return;
    // Bộ slide phụ (dòng ảo `cha::id`) không ghi lên URL — tải lại trang không mở được nó khi danh sách chưa có mẹ (rà 3.7).
    if (String(projectName || '').includes('::')) return;
    const url = new URL(window.location.href);
    url.searchParams.set('project', projectName);
    window.history.replaceState(null, '', url);
  }

  /* ── BỘ SLIDE PHỤ (GĐ3.7, src/dung/boSlide.js) ─────────────────────────────
     `cha::id` không có trong danh sách (main/duAn.js#listProjects chỉ quét một tầng). Mở nó = một dòng ẢO dựng từ dự án
     mẹ, chỉ nằm trong projectMap (không vào `projects` / bảng) — setSelectedProject, sân khấu, bảng sửa, mọi chỗ tra theo
     tên chạy y nguyên (main + api-shim hiểu tên `cha::id`). Giữ qua các lượt làm mới danh sách (boAo). */
  const boAo = new Set();
  function dongBoAo(ten) {
    const m = /^(.+?)::([a-z0-9][a-z0-9-]{0,39})$/.exec(String(ten || ''));
    const cha = m && projectMap.get(m[1]);
    if (!cha || cha.bo_slide_cua || cha.loai === 'video') return null;
    const sep = String(cha.source_path || '').includes('\\') ? '\\' : '/';
    return { ...cha, name: ten, url: `beeknoee://slide/${encodeURIComponent(ten)}/`,
      source_path: `${cha.source_path}${sep}bo-slide${sep}${m[2]}`, loai: 'deck', has_output: false, output_url: null,
      video_url: null, video_file: null, video_cu: false, script_count: null, dang_thiet_ke: false, bo_slide_cua: m[1], bo_slide_id: m[2] };
  }
  /** Mở bộ slide phụ `cha::id` (nút "Sửa nội dung bộ slide"). @returns {boolean} */
  function moBoSlide(ten) {
    const p = dongBoAo(ten);
    if (!p) return false;
    boAo.add(ten);
    projectMap.set(ten, p);
    setSelectedProject(ten);
    return true;
  }

  function setSelectedProject(projectName, updateUrl = true) {
    const project = projectMap.get(projectName);
    if (!project) {
      setStatus('Chưa có dự án nào để tạo video.', 'bad');
      return;
    }

    state.project = project.name;
    state.outputUrl = project.output_url || project.video_url || `/slide/${encodeURIComponent(project.name)}/output/${encodeURIComponent(project.video_file || (project.name + '.mp4'))}`;

    const select = $('#projectSelect');
    if (select) select.value = project.name;
    setProjectVideoBadge(project);

    /* Bộ kích thước phải theo KHỔ của deck. Deck ngang mà để nguyên 1080×1920
       thì `pipeline.js` chặn lượt dựng — người dùng không chọn sai mà vẫn bị
       chặn. Xem `apKhungDeck()` trong tts-panel.js. */
    RP.apKhungDeck?.(project.khung);
    /* Sân khấu đổi deck theo. Gọi SAU `apKhungDeck` để ô độ phân giải đã
       đúng khổ trước khi khung deck bắt đầu nạp — đổi ngược lại thì trong
       lúc deck đang nạp, ô vẫn còn hiện bộ của khổ cũ. */
    RP.sanKhau?.chonDeck(project.name, project.khung);

    const selectedName = $('#selectedName');
    if (selectedName) selectedName.textContent = project.bo_slide_cua ? `${project.bo_slide_cua} › Bộ slide ${project.bo_slide_id.slice(1)}` : project.name;

    const selectedBadge = $('#selectedBadge');
    if (selectedBadge) selectedBadge.textContent = project.bo_slide_cua ? 'Bộ slide' : project.loai === 'video' ? 'Video' : `${project.script_count || '?'} slide`;

    const previewLink = $('#previewLink');
    if (previewLink) previewLink.href = project.url;

    // Mỗi dự án một file giọng đọc riêng — xem ghi chú ở `veMp3DaChon`.
    veMp3DaChon(project.name);

    const existingVideoLink = $('#existingVideoLink');
    if (existingVideoLink) {
      existingVideoLink.href = project.video_url || state.outputUrl;
      existingVideoLink.hidden = !project.video_url;
    }

    /* Nút mở video/thư mục chỉ ẩn khi CHÍNH deck này đang được dựng (file
       đang ghi dở). Bản trước ẩn theo `state.busy` toàn cục, nên đang dựng
       deck A thì mọi deck B, C… đã có video cũng mất cả ba nút — bấm vào dự
       án nào cũng chỉ thấy màn hình "đang dựng" của A. */
    const dangDungDeckNay = Boolean(state.busy && state.deckDangDung === project.name);

    const videoLink = $('#videoLink');
    if (videoLink) {
      videoLink.href = project.video_url || state.outputUrl;
      // Hiện khi dự án ĐÃ CÓ video, không chỉ ngay sau lần tạo.
      // Bản cũ ép hidden = true ở đây, nên tạo xong thấy đủ ba nút, chuyển sang
      // dự án khác rồi quay lại thì mất nút "Mở video cuối" — cùng một dự án,
      // cùng một file, mà hai lần nhìn ra hai kiểu.
      videoLink.hidden = dangDungDeckNay || !project.video_url;
    }
    setRevealOutputButton(project.name, !dangDungDeckNay && Boolean(project.video_url));
    RP.capNhatNutTao(Boolean(project.video_url));

    // Dự án được chọn có thể nằm NGOÀI 10 dòng đang hiện — ví dụ mở app bằng
    // `?project=…`, hoặc app nhớ dự án cuối. Không nới ra thì người dùng thấy
    // tên dự án ở khung trên mà tìm mãi không ra dòng nào sáng.
    const viTri = projects.findIndex((p) => p.name === project.name);
    if (viTri >= soDongHien) {
      soDongHien = Math.ceil((viTri + 1) / MOI_LAN) * MOI_LAN;
      buildProjectRows();
    }
    // Nhãn nút phụ thuộc dự án ĐANG CHỌN (Tạo video / Thêm vào hàng đợi / Bỏ
    // khỏi hàng đợi / Đang dựng…), nên đổi dòng là phải tính lại.
    RP.capNhatNutDung();
    $all('.project-row[data-project]').forEach((row) => row.classList.toggle('selected', row.dataset.project === project.name));

    const stopButton = $('#stopRender');
    if (dangDungDeckNay) {
      /* Đang xem ĐÚNG deck đang dựng: bảng là tiến độ live, khôi phục từ lần
         vẽ gần nhất (poll 1.5s sẽ cập nhật tiếp — không có cache thì bảng
         trống một nhịp), nút Dừng thuộc về màn này. */
      if (stopButton) { stopButton.hidden = false; stopButton.disabled = state.canceling; }
      const td = state.tienDoCuoi;
      if (td && td.deck === project.name) {
        if (td.step !== undefined) state.renderStep = td.step;
        RP.setRenderState(td.title, td.logs || [], td.tone || 'running');
        setStatus(td.status || '', 'warn');
      } else {
        RP.setRenderState('Đang tạo video…', []);
        setStatus('', 'warn');
      }
    } else {
      /* Bảng thuộc về deck ĐANG CHỌN — kể cả khi máy đang dựng deck khác
         (tiến độ của deck kia nằm ở dải mỏng phía trên, không đè vào đây).
         Nút Dừng cũng rút theo: nó dừng deck ĐANG DỰNG, đứng cạnh bộ nút của
         một deck khác là mời bấm nhầm. */
      if (state.busy && stopButton) stopButton.hidden = true;
      // Vào xem deck có kết quả đang chờ báo là coi như đã biết — dải tắt.
      if (state.ketQuaCho && state.ketQuaCho.deck === project.name) state.ketQuaCho = null;
      /* Deck này vừa dựng HỎNG thì GIỮ NGUYÊN bảng lỗi — đừng vẽ đè.
         Chuyển sang deck khác thì lau như thường (nhánh dưới), vì bảng lỗi
         thuộc về deck kia chứ không phải deck đang xem. */
      if (state.deckLoi && state.deckLoi === project.name) {
        RP.veDaiDangDung();
        if (updateUrl) updateProjectUrl(project.name);
        return;
      }
      if (state.hangDoi.includes(project.name)) {
        // Deck đang XẾP HÀNG: nói rõ vị trí thay vì nằm im như chưa có gì.
        state.renderStep = -1;
        RP.setRenderState(`Đang chờ trong hàng đợi (thứ ${state.hangDoi.indexOf(project.name) + 1})`, [], 'cho');
        setStatus('', 'warn');
      } else if (project.video_url) {
        // Dự án đã có video thì bảng phải nói ra điều đó, không nằm im ở "Chưa
        // tạo video" — nhìn vào không phân biệt được đã làm hay chưa.
        state.renderStep = RP.RENDER_STEPS.length - 1;
        /* Câu này nay đứng NGAY SAU tiêu đề, chỉ cách một dấu chấm — mà tiêu
           đề tone done đã là "Đã tạo xong video". Giữ nguyên câu cũ thì cả dòng
           đọc ra "Đã tạo xong video · Đã tạo xong — …", lặp ngay trước mắt. */
        RP.setRenderState('Có thể tạo lại nếu cần', [], 'done');
        setStatus('', 'warn');
      } else {
        state.renderStep = -1;
        RP.setRenderState('', []);
        setStatus(window.location.pathname === '/upload' ? `${project.name} chưa có video. Tạo video ở Dashboard trước khi upload.` : '', project.has_script ? 'warn' : 'bad');
      }
    }
    RP.veDaiDangDung();
    if (updateUrl) updateProjectUrl(project.name);
  }

  function markProjectHasOutput(projectName, videoUrl) {
    if (projectName) videoVuaXong.set(projectName, videoUrl);
    const project = projectMap.get(projectName);
    if (project) {
      project.video_url = videoUrl;
      project.has_output = true;
    }

    // Nút thùng rác KHÔNG còn phụ thuộc việc có video hay chưa — nó xoá cả dự
    // án nên lúc nào cũng bấm được. Bản trước bật/tắt nó ở đây; bỏ đi rồi.
    const row = rowForProject(projectName);
    const slot = row ? row.querySelector('.row-video-slot') : null;
    if (slot) {
      slot.textContent = '';
      slot.classList.remove('muted');
      // Cùng dạng với lúc dựng dòng: chỉ mũi tên xanh, không nền, không chữ.
      const link = document.createElement('a');
      link.className = 'small-link icon-only play';
      link.href = videoUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.title = 'Mở video đã tạo';
      link.setAttribute('aria-label', 'Mở video đã tạo');
      link.textContent = '▶';
      slot.appendChild(link);
    }

    const existingVideoLink = $('#existingVideoLink');
    if (existingVideoLink && state.project === projectName) {
      existingVideoLink.href = videoUrl;
      existingVideoLink.hidden = false;
    }
    if (state.project === projectName) setRevealOutputButton(projectName, true);
    if (state.project === projectName) setProjectVideoBadge(project);
  }

  /**
   * ⚠ KHÔNG CHỖ NÀO GỌI HÀM NÀY (đã quét 16/09/2026) — và đó không phải lỗi.
   *
   * Nó là nửa-giao-diện của nút "Xoá video" (`#deleteSelectedOutput`), nút đã gỡ
   * khỏi markup từ lâu (xem chú thích ở `jobs.js` và `render-page.js`). Đường
   * IPC `output:delete` bên main vẫn còn, nên GIỮ hàm này để nếu nút quay lại
   * thì có sẵn phần vẽ ngược hàng về "chưa có video" — viết lại từ đầu là chắc
   * chắn quên mất `videoVuaXong.delete()` ở dòng dưới.
   */
  function markProjectOutputDeleted(projectName) {
    // Bỏ khỏi sổ, kẻo lần nạp sau lại dựng "Đã có video" cho một video đã xoá.
    videoVuaXong.delete(projectName);
    const project = projectMap.get(projectName);
    if (project) {
      project.video_url = null;
      project.has_output = false;
    }

    // Xem chú thích ở `markProjectHasOutput`: nút thùng rác nay luôn bấm được.
    const row = rowForProject(projectName);
    const slot = row ? row.querySelector('.row-video-slot') : null;
    if (slot) {
      slot.textContent = '';
      slot.classList.remove('muted');
      const disabled = document.createElement('span');
      disabled.className = 'icon-only play disabled';
      disabled.title = 'Chưa có video';
      disabled.setAttribute('aria-label', 'Chưa có video');
      disabled.textContent = '▶';
      slot.appendChild(disabled);
    }

    if (state.project === projectName) {
      const existingVideoLink = $('#existingVideoLink');
      if (existingVideoLink) existingVideoLink.hidden = true;
      const videoLink = $('#videoLink');
      if (videoLink) videoLink.hidden = true;
      setRevealOutputButton(projectName, false);
      setProjectVideoBadge(project);
    }
  }

  async function revealOutput(projectName) {
    const project = projectMap.get(projectName || state.project);
    if (!project) {
      setStatus('Không tìm thấy dự án để mở output.', 'bad');
      return;
    }
    const button = $('#revealOutput');
    if (button) button.disabled = true;
    setStatus(`Đang mở thư mục video của ${project.name}...`, 'warn');
    try {
      const data = await apiPost('/api/output/reveal', { project: project.name });
      setStatus(`Đã mở thư mục video của ${project.name}.`, 'good');
    } catch (error) {
      setStatus(error.message || String(error), 'bad');
    } finally {
      if (button) button.disabled = false;
    }
  }

  /**
   * Xoá cả dự án (slide + script + giọng đọc + video) vào Thùng rác.
   *
   * Chạy được kể cả khi dự án CHƯA dựng video lần nào — nút không còn phụ thuộc
   * `has_output` như bản trước, vì thứ người dùng muốn bỏ là cả deck chứ không
   * riêng cái video.
   */
  async function xoaDuAn(projectName) {
    const project = projectMap.get(projectName);
    if (!project) {
      setStatus('Không tìm thấy dự án để xoá.', 'bad');
      return;
    }

    // Nói rõ MẤT GÌ và CỨU ĐƯỢC KHÔNG. Chỉ hỏi "chắc chưa?" thì người dùng bấm
    // OK theo phản xạ; nêu đúng nội dung sắp mất mới khiến người ta dừng lại đọc.
    const confirmed = window.confirm(
      `Xoá dự án "${project.name}"?\n\n`
      + 'Toàn bộ thư mục dự án sẽ bị xoá: slide, nội dung script, file giọng đọc '
      + 'và video đã tạo.\n\n'
      + 'Thư mục được chuyển vào Thùng rác nên bạn vẫn khôi phục lại được.'
    );
    if (!confirmed) return;

    const nut = $all('.delete-project-btn[data-project]')
      .filter((b) => b.dataset.project === project.name);
    nut.forEach((b) => { b.disabled = true; });
    setStatus(`Đang xoá ${project.name}...`, 'warn');

    try {
      const data = await apiPost('/api/project/delete', { project: project.name, confirm: true });

      // Đang mở một BỘ SLIDE PHỤ của dự án vừa xoá (`<tên>::<id>`) cũng là đang chọn nó (rà 3.7).
      const laDangChon = state.project === project.name || String(state.project || '').startsWith(`${project.name}::`);
      setStatus(`Đã chuyển "${project.name}" vào Thùng rác.`, 'good');
      // Nạp lại từ đĩa thay vì tự gỡ dòng khỏi bảng: đĩa là nguồn sự thật, và
      // nếu xoá hỏng nửa chừng thì bảng phải phản ánh đúng cái còn lại.
      await lamMoiDanhSach();

      /* ⚠ Xoá đúng dự án ĐANG CHỌN thì phải chuyển lựa chọn sang chỗ khác.
         `lamMoiDanhSach()` chỉ giữ lựa chọn cũ nếu nó còn tồn tại — tên vừa xoá
         thì không, nên `state.project` mắc kẹt ở một dự án không còn nữa: bảng
         bên phải vẫn ghi "Dự án đang chọn: <tên đã xoá>", còn nút Tạo video thì
         báo "chưa chọn dự án" một cách khó hiểu. */
      if (laDangChon) {
        state.project = null;
        state.outputUrl = null;
        const conLai = projects[0];
        if (conLai) setSelectedProject(conLai.name, false);
        else setStatus('Đã xoá dự án cuối cùng. Thêm deck mới vào thư mục nguồn rồi bấm Làm mới.', 'warn');
      }
    } catch (error) {
      nut.forEach((b) => { b.disabled = false; });
      setStatus(error.message || String(error), 'bad');
    }
  }

  Object.assign(RP, { CHO_DO_MS, KHOA_MP3, MOI_LAN, baoBiGhi, baoBiRender, buildProjectRows, capNhatOLoc, copyProjectName, copyProjectScript, copyText, datLaiSoDongHien, epKetThucDo, fallbackCopyText, flashCopyButton, lamMoiDanhSach, locDuAn, markProjectHasOutput, markProjectOutputDeleted, napMp3DaChon, nhoMp3, noiTheFile, quenMp3, veTheFile, nhomTrangThai, boChonDuAn, doiNguonTaiCho, revealOutput, selectSourceRootFromFinder, setProjectVideoBadge, setRevealOutputButton, setSelectedProject, moBoSlide, setSourceSelectStatus, thoiDoTrangThai, tinhTrangThai, updateProjectUrl, veMp3DaChon, videoVuaXong, xoaDuAn });
})();
