'use strict';
/**
 * Thanh điều hướng dọc bên trái + trang "Template".
 *
 * Trước đây app chỉ có MỘT trang. Thêm trang bằng cách dựng thêm file HTML thì
 * phải kéo theo cả đường điều hướng, thanh menu, theme, phím tắt — nhân đôi mọi
 * thứ cho một danh sách. Nên trang mới là một khối ẩn/hiện ngay trong trang
 * hiện tại: đổi trang chỉ là bật/tắt `hidden`.
 *
 * Thanh nằm ở mép TRÁI. Mặc định THU GỌN còn một cột icon; rê chuột vào thì mở
 * ra kèm nhãn bên phải icon, rời chuột vài giây thì tự đóng (`ganMoDong()`).
 * Bề ngang hai mức ở `--nav-w` / `--nav-w-mo` (`css/tokens.css`), kiểu dáng
 * ở `css/pages.css`.
 */
(() => {
  const api = window.beeknoee;

  const TRANG = [
    { key: 'render', nhan: 'Dựng video', icon: 'play' },
    /* HAI trang kho mẫu, tách theo KHỔ HÌNH chứ không theo thời lượng.
       App dựng được video DỌC dài 25 phút, nên đặt tên "ngắn / dài" là xếp
       mẫu sai chỗ ngay từ đầu. Và tách hẳn hai trang chứ không gộp thành hai
       tab trong một trang — chủ dự án chốt 15/09/2026, tính đường còn thêm
       nhiều mẫu nữa. Thêm khổ thứ ba thì thêm một mục ở đây và một mục trong
       `TRANG_MAU`, không phải sửa chỗ nào khác. */
    { key: 'mau-doc', nhan: 'Mẫu dọc 9:16', icon: 'copy' },
    { key: 'mau-ngang', nhan: 'Mẫu ngang 16:9', icon: 'monitor' },
    /* "Nâng cấp" mở THẲNG trang thanh toán.
     *
     * Trước đây đây là hai trang: một trang giới thiệu gói gần như trống (tên
     * gói, giá, danh sách tính năng, một cái nút) rồi bấm nút mới sang trang
     * QR — mà trang QR đã in lại y nguyên chừng ấy thứ ở cột phải. Hai trang
     * cho một nội dung, bắt người mua bấm thêm một nhát để đọc lại cái vừa đọc.
     *
     * Gộp được là NHỜ bước trước: đơn nay chỉ sinh khi bấm "Tạo mã QR", nên vào
     * thẳng trang này không còn đẻ ra đơn treo. Chừng nào mở màn còn tự đặt đơn
     * thì tuyệt đối KHÔNG gộp — mỗi lần bấm nhầm mục này là một đơn rác. */
    { key: 'thanhtoan', nhan: 'Nâng cấp', icon: 'bolt' },
    /* Hướng dẫn CÓ mục riêng trên thanh, thêm sau.
     *
     * Trước đây cố ý không có: hai nút mở nó đã đứng cạnh mốc "1. Giọng đọc",
     * đúng chỗ người dùng đang bí. Nhưng ba bài hướng dẫn nằm rải ba nơi khác
     * nhau (hai nút ở cột Dựng video, một nút gấp trong trang Template) nên ai
     * chưa biết trước thì không tìm ra. Mục này là chỗ gom lại.
     * Hai nút cũ VẪN GIỮ — chúng ở đúng ngữ cảnh, bỏ đi là bắt người dùng đi
     * vòng khi đang bí. */
    { key: 'huongdan', nhan: 'Hướng dẫn', icon: 'help' },
  ];

  /**
   * Hai trang kho mẫu. Khoá = `key` trong `TRANG` = đuôi id của thẻ trang
   * (`page-mau-doc`, `page-mau-ngang`).
   *
   * `khung` phải khớp mã mà `khungCuaDeck()` trả về (`doc` | `ngang`) — deck
   * khai bằng thẻ `<meta name="bee-khung">`, không khai gì thì là `doc`, nên
   * mọi mẫu cũ rơi hết vào trang dọc y như trước.
   */
  const TRANG_MAU = {
    'mau-doc': {
      khung: 'doc',
      ten: 'dọc 9:16',
      icon: 'copy',
      tem: 'THƯ VIỆN MẪU VIDEO DỌC',
      h2: 'Biến ý tưởng thành <em>video ấn tượng</em>',
      mo: 'Mẫu video dọc 9:16 dựng sẵn cho nhiều lĩnh vực — Short, Reels, TikTok.'
        + ' Chỉ cần Copy prompt rồi tuỳ chỉnh để tạo video của riêng bạn.',
      loi2: 'Đa dạng chủ đề',
      loi3: 'Tối ưu cho video dọc',
      rong: 'Chưa có mẫu dọc nào trong thư mục <code>template/</code>.',
    },
    'mau-ngang': {
      khung: 'ngang',
      ten: 'ngang 16:9',
      icon: 'monitor',
      tem: 'THƯ VIỆN MẪU VIDEO NGANG',
      h2: 'Dựng <em>video ngang</em> cho YouTube',
      /* ⚠ GIỮ NGẮN — tối đa chừng này chữ. Nửa phải tấm nền hero là cụm ảnh
         mẫu; câu dài hơn là chữ chạy vào dưới ảnh và không đọc được. Bản đầu
         dài hơn một mệnh đề, chụp ảnh mới thấy (15/09/2026). */
      mo: 'Mẫu 16:9 cho bài giảng, bản tin, phân tích và biểu đồ.'
        + ' Mỗi lượt dựng ra sẵn phụ đề .srt và danh sách chương.',
      loi2: 'Đang có',
      loi3: 'Tối ưu cho video ngang',
      /* Nói luôn CÁCH thêm: trang này còn ít mẫu, ai tự dựng deck ngang mà
         quên thẻ meta thì deck rơi sang trang dọc và họ không hiểu vì sao. */
      rong: 'Chưa có mẫu ngang nào. Deck khai khổ bằng thẻ'
        + ' <code>&lt;meta name="bee-khung" content="ngang"&gt;</code> trong <code>index.html</code>.',
    },
  };

  function style() {
    // CSS của module này nằm ở css/pages.css (tách 02/09/2026, nạp bằng <link> trong index.html).
  }

  function buildNav() {
    const nav = document.createElement('nav');
    nav.className = 'app-nav';
    nav.setAttribute('aria-label', 'Chuyển trang');
    /* KHÔNG có logo ở đây (bỏ 10/09/2026). Thanh trên cùng đã mang logo, mà hai
       thanh gặp nhau ở góc trái nên hai dấu hiệu giống hệt xếp chồng cách nhau
       chừng 60px — chụp ảnh mới thấy rõ là thừa. Mục đầu tiên của thanh dọc nay
       là "Dựng video" luôn. */
    TRANG.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.trang = t.key;
      b.innerHTML = `<span class="btn-icon" data-icon="${t.icon}"></span><span>${t.nhan}</span>`;
      /* Hướng dẫn đi qua `moHuongDan('')` chứ không gọi thẳng `moTrang`:
         cần đặt lại về MỤC LỤC. Gọi thẳng thì `hdCanMo` giữ nguyên giá trị cũ,
         nên xem một bài rồi bấm lại nút trên thanh sẽ ra đúng bài đó, không ra
         danh sách — trông như nút hỏng. */
      b.onclick = () => (t.key === 'huongdan' ? moHuongDan('') : moTrang(t.key));
      nav.appendChild(b);
    });
    // Khoảng đẩy để "Cài đặt" rơi xuống đáy thanh.
    const day = document.createElement('div');
    day.style.flex = '1 1 auto';
    nav.appendChild(day);

    /* ⚠ TỪNG CÓ NÚT TÀI KHOẢN (`#bee-account-btn`) Ở GÓC PHẢI THANH TRÊN —
       gỡ 16/09/2026, đừng dựng lại. Bảng tài khoản và bảng cài đặt đã GỘP làm
       một thẻ (xem `paintAccount()` bên login.js), nên hai nút mở cùng một thứ
       ở hai góc màn hình chỉ tổ làm người dùng đoán xem cái nào ra cái gì.
       `login.js` tra nút bằng id và bỏ qua nếu không thấy, nên gỡ ở đây là đủ. */

    // "Cài đặt" ĐỨNG CUỐI thanh dọc — nay là đường DUY NHẤT vào bảng tài
    // khoản. Xem `moCaiDat()` ở login.js.
    const cd = document.createElement('button');
    cd.id = 'bee-caidat-btn';
    cd.type = 'button';
    cd.className = 'nav-caidat';
    cd.innerHTML = '<span class="btn-icon" data-icon="gear"></span><span>Cài đặt</span>';
    cd.title = 'Cài đặt';
    // Truyền chính nút này sang để bảng neo cạnh nó, đừng để nó tự đoán.
    cd.onclick = () => window.__beeAuth && window.__beeAuth.moCaiDat && window.__beeAuth.moCaiDat(cd);
    nav.appendChild(cd);

    document.body.appendChild(nav);
    if (window.__beeIcons) window.__beeIcons.apply(nav);
    if (window.__beeIcons) window.__beeIcons.apply(document.querySelector('.app-bar-phai'));
    ganMoDong(nav);
    ganChuong();
  }

  /**
   * Chuông thông báo — KHUNG TRỐNG có chủ đích.
   *
   * App chưa có nguồn thông báo nào: tin "có bản mới" đã có kênh riêng ở góc
   * dưới bên phải (updater-ui.js), còn lại chẳng có gì để báo. Dựng sẵn cái
   * khung để sau này cắm nội dung vào, và QUAN TRỌNG hơn là để cái chuông trả
   * lời khi bấm — nút bấm không ra gì thì người dùng thử hai lần rồi kết luận
   * là app hỏng, chứ không kết luận là chưa có thông báo.
   */
  function ganChuong() {
    const nut = document.getElementById('bee-thongbao-btn');
    if (!nut) return;
    let bang = null;
    const dong = () => {
      if (!bang) return;
      bang.remove(); bang = null;
      document.removeEventListener('mousedown', ngoai, true);
      document.removeEventListener('keydown', esc, true);
    };
    const ngoai = (e) => { if (bang && !bang.contains(e.target) && e.target !== nut) dong(); };
    const esc = (e) => { if (e.key === 'Escape') dong(); };
    nut.onclick = () => {
      if (bang) { dong(); return; }
      bang = document.createElement('div');
      bang.className = 'tb-bang';
      bang.innerHTML = '<div class="tb-dau">Thông báo</div>'
        + '<div class="tb-trong">Chưa có thông báo nào.</div>';
      document.body.appendChild(bang);
      // Neo theo mép PHẢI của nút, thả xuống dưới. Neo mép trái thì bảng chạy
      // ra ngoài màn hình vì nút đứng sát mép phải cửa sổ.
      const r = nut.getBoundingClientRect();
      bang.style.top = `${Math.round(r.bottom + 8)}px`;
      bang.style.right = `${Math.round(window.innerWidth - r.right)}px`;
      document.addEventListener('mousedown', ngoai, true);
      document.addEventListener('keydown', esc, true);
    };
  }

  /**
   * Bao lâu thì THỬ LẠI việc đóng khi đang bị chặn.
   *
   * ⚠ KHÔNG phải độ trễ trước khi đóng — rời chuột là đóng NGAY. Số này chỉ
   * dùng cho một trường hợp: có thứ đang giữ thanh mở (bảng tài khoản/cài đặt).
   * Phải hẹn lại theo chu kỳ chứ đừng gọi đệ quy tức thì: hẹn 0ms trong lúc còn
   * bị chặn là một vòng lặp chặt, ăn CPU cho tới khi người dùng đóng bảng.
   */
  const CHO_LAI = 400;

  /**
   * Thu gọn / mở thanh theo con chuột. Rời chuột là thu lại ngay.
   *
   * ⚠ HOÃN đóng khi bảng tài khoản/cài đặt đang mở. Bảng đó neo theo mép phải
   * của nút và chỉ tính vị trí ĐÚNG MỘT LẦN lúc mở (xem datViTri trong
   * login.js); thanh co lại sau đó là bảng đứng lơ lửng, cách thanh một quãng
   * mà không ai hiểu vì sao.
   *
   * ⚠ Mở cả khi nhận focus bàn phím. Tab tới một nút mà nhãn vẫn mờ thì người
   * dùng bàn phím không biết mình đang đứng ở mục nào.
   */
  function ganMoDong(nav) {
    let hen = 0;
    const chan = () => nav.matches(':hover')
      || nav.contains(document.activeElement)
      || Boolean(document.getElementById('bee-login'));
    const mo = () => { clearTimeout(hen); hen = 0; nav.classList.add('mo'); };
    const dong = () => {
      clearTimeout(hen);
      if (chan()) { hen = setTimeout(dong, CHO_LAI); return; }
      nav.classList.remove('mo');
    };
    nav.addEventListener('mouseenter', mo);
    nav.addEventListener('mouseleave', dong);
    nav.addEventListener('focusin', mo);
    /* focusout: đợi MỘT nhịp rồi mới xét. Ngay lúc sự kiện bắn, activeElement
       còn là <body> dù focus đang chuyển sang nút bên cạnh — xét ngay thì thanh
       đóng rồi mở lại, nháy một cái ở mỗi lần bấm Tab. */
    nav.addEventListener('focusout', () => { clearTimeout(hen); hen = setTimeout(dong, 0); });
  }

  /** Trang đang mở — ô tìm ở thanh trên đổi việc theo giá trị này. */
  let trangDangMo = 'render';

  /* ══ Ô TÌM KIẾM Ở THANH TRÊN ═══════════════════════════════════════════
   *
   * MỘT ô, đổi việc theo trang đang mở: ở Template thì lọc mẫu, ở Hướng dẫn thì
   * lọc bài. Hai trang còn lại (Dựng video, Nâng cấp) không có gì để tìm nên ô
   * ẩn hẳn — để đó mà gõ không ra gì thì tệ hơn là không có.
   *
   * ⚠ PHẢI đặt trong `.app-bar-phai`, KHÔNG phải `.header-tools`:
   * `render-layout.js#depDauTrang()` bê nguyên `.header-tools` xuống cột danh
   * sách dự án, nên thứ gì nằm trong đó sẽ biến mất khỏi thanh trên.
   */
  const TIM = {
    huongdan: 'Tìm kiếm hướng dẫn…',
    /* Sinh từ `TRANG_MAU` chứ không gõ tay từng trang: thiếu một khoá ở đây
       là ô tìm BIẾN MẤT ở trang đó (`capNhatOTim` ẩn ô khi không có nhãn) —
       hỏng lặng lẽ, không lỗi nào báo. */
    ...Object.fromEntries(Object.entries(TRANG_MAU)
      .map(([k, v]) => [k, `Tìm kiếm mẫu ${v.ten}, chủ đề, phong cách…`])),
  };

  let oTim = null;

  function dungOTim() {
    if (oTim) return oTim;
    const phai = document.querySelector('.app-bar-phai');
    if (!phai) return null;
    oTim = document.createElement('div');
    oTim.className = 'ab-tim';
    oTim.hidden = true;
    oTim.innerHTML = `
      <span class="btn-icon ab-tim-kinh" data-icon="tim"></span>
      <input type="search" class="ab-tim-o" autocomplete="off" spellcheck="false">
      <span class="ab-tim-phim">Ctrl K</span>`;
    // Chèn TRƯỚC chuông để ô nằm bên trái cụm nút tròn, đúng như mẫu.
    phai.insertBefore(oTim, phai.firstChild);
    const o = oTim.querySelector('.ab-tim-o');
    o.addEventListener('input', () => locTheoTim(o.value));
    /* Escape xoá ô và trả danh sách về đủ — nhanh hơn xoá tay từng ký tự, và là
       thói quen sẵn có của mọi ô tìm kiếm. */
    o.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { o.value = ''; locTheoTim(''); o.blur(); }
    });
    if (window.__beeIcons) window.__beeIcons.apply(oTim);
    return oTim;
  }

  /** Ctrl/Cmd + K nhảy vào ô — chỉ khi ô đang hiện. */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'k' && e.key !== 'K') return;
    if (!(e.ctrlKey || e.metaKey)) return;
    if (!oTim || oTim.hidden) return;
    e.preventDefault();
    const o = oTim.querySelector('.ab-tim-o');
    o.focus();
    o.select();
  });

  /**
   * Bật/tắt ô theo trang, và XOÁ nội dung cũ mỗi lần đổi trang.
   *
   * Không xoá thì từ khoá của trang trước còn nguyên trong ô trong khi danh
   * sách trang mới hiện đủ — ô nói một đằng, màn hình một nẻo.
   */
  function capNhatOTim(key) {
    const el = dungOTim();
    if (!el) return;
    const nhan = TIM[key];
    el.hidden = !nhan;
    const o = el.querySelector('.ab-tim-o');
    if (!nhan) { o.value = ''; return; }
    o.placeholder = nhan;
    o.value = '';
    locTheoTim('');
  }

  /* Bỏ dấu để "giong doc" tìm được "giọng đọc" — gõ tiếng Việt có dấu trong ô
     tìm kiếm là việc phiền, mà bỏ dấu thì ai cũng gõ được. */
  const khongDau = (s) => String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase();

  function locTheoTim(q) {
    const tu = khongDau(q).trim();
    if (TRANG_MAU[trangDangMo]) return locTemplate(tu);
    if (trangDangMo === 'huongdan') return locHuongDan(tu);
    return undefined;
  }

  function locTemplate(tu) {
    // Hai trang kho mẫu dùng chung hàm này — lọc đúng trang ĐANG mở.
    const box = document.getElementById(`page-${trangDangMo}`);
    if (!box) return;
    const the = [].slice.call(box.querySelectorAll('.tpl-the'));
    /* Gõ vào ô tìm thì BỎ luôn tab nhóm đang chọn — đang lọc "Tin tức" mà tìm
       "món ngon" thì không ra gì, người dùng tưởng không có mẫu đó. */
    if (tu) {
      box.querySelectorAll('.tpl-tab').forEach((t) => t.classList.toggle('dang-chon', !t.dataset.nhom));
    }
    let hien = 0;
    the.forEach((el) => {
      const kho = el.dataset.tim || '';
      const khop = !tu || kho.includes(tu);
      el.hidden = !khop;
      if (!khop) el.querySelectorAll('video').forEach((v) => v.pause());
      if (khop) hien += 1;
    });
    baoRong(box, '.tpl-luoi', tu && !hien, tu);
  }

  function locHuongDan(tu) {
    const box = document.getElementById('page-huongdan');
    if (!box) return;
    /* Đang mở một BÀI mà gõ tìm thì quay về mục lục rồi mới lọc — không có chỗ
       nào trong bài để hiện kết quả, mà giữ nguyên bài thì gõ xong không thấy
       gì xảy ra.

       ⚠ CHỈ khi có từ khoá. Gọi vô điều kiện là vòng lặp vô tận: capNhatOTim →
       locTheoTim('') → locHuongDan → moHuongDan → moTrang → capNhatOTim. Đã
       dính thật, ngăn xếp tràn ngay lúc mở trang. */
    if (tu && hdDangVe) { moHuongDan(''); }
    const the = [].slice.call(box.querySelectorAll('.hd-the'));
    if (!the.length) return;
    const tim = (window.__beeGuide && window.__beeGuide.timBai) || (() => null);
    let hien = 0;
    the.forEach((el, i) => {
      const b = layBai()[i] || {};
      const kho = khongDau([b.ten, b.mo, tim(b.khoa)].join(' '));
      const khop = !tu || kho.includes(tu);
      el.hidden = !khop;
      if (khop) hien += 1;
    });
    baoRong(box, '.hd-muc', tu && !hien, tu);
  }

  /** Dòng "không tìm thấy" — dựng một lần rồi dùng lại, đừng tạo mới mỗi phím gõ. */
  function baoRong(box, sauSel, hien, tu) {
    let el = box.querySelector('.tim-rong');
    if (!hien) { if (el) el.hidden = true; return; }
    if (!el) {
      el = document.createElement('div');
      el.className = 'tpl-rong tim-rong';
      const neo = box.querySelector(sauSel);
      if (neo) neo.insertAdjacentElement('afterend', el);
      else box.appendChild(el);
    }
    el.hidden = false;
    el.textContent = `Không có kết quả nào cho “${tu}”. Thử từ khoá ngắn hơn.`;
  }

  function moTrang(key) {
    const shell = document.querySelector('.dashboard-shell');
    if (shell) shell.hidden = key !== 'render';
    // 'upgrade' là tên cũ của trang này — vẫn nhận, để chỗ nào gọi sót không rơi
    // vào trang trắng. Phải đổi TRƯỚC mấy dòng `hidden` bên dưới.
    if (key === 'upgrade') key = 'thanhtoan';
    // 'template' là tên cũ, hồi kho mẫu còn là MỘT trang. Vẫn nhận, để chỗ nào
    // gọi sót (hoặc bản cũ của help-hub) không rơi vào trang trắng.
    if (key === 'template') key = 'mau-doc';
    for (const k of Object.keys(TRANG_MAU)) {
      document.getElementById(`page-${k}`).hidden = key !== k;
    }
    document.getElementById('page-thanhtoan').hidden = key !== 'thanhtoan';
    document.getElementById('page-huongdan').hidden = key !== 'huongdan';
    document.querySelectorAll('.app-nav button').forEach((b) => {
      b.classList.toggle('active', b.dataset.trang === key);
    });
    trangDangMo = key;
    /* ⚠ Tên deck ở thanh trên chỉ có nghĩa Ở TRANG DỰNG. Sang trang Mẫu hay
       Hướng dẫn mà vẫn treo "Chưa chọn dự án" thì nó nói về một thứ không có
       mặt trên màn hình — và vạch ngăn cách bên cạnh lại càng vô nghĩa. */
    const giuaTT = document.querySelector('.tb-giua');
    if (giuaTT) giuaTT.hidden = key !== 'render';
    capNhatOTim(key);
    // Quay lại tab Dựng video: bám lại job render đang chạy (nếu có). Trạng
    // thái thật nằm ở tiến trình chính, xem render-page.js#resyncRender.
    if (key === 'render' && window.__beeRender && window.__beeRender.resync) {
      Promise.resolve(window.__beeRender.resync()).catch(() => {});
    }
    if (TRANG_MAU[key]) napTemplate(key);
    if (key === 'huongdan') napHuongDan();
    if (key === 'thanhtoan') {
      // Dựng nội dung thanh toán NGAY TRONG trang, không phải popup.
      const box = document.getElementById('page-thanhtoan');
      if (window.__beeCheckout) window.__beeCheckout.mo({ trang: box });
    }
  }

  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  /**
   * Trang Hướng dẫn — nội dung do `guide.js` giữ, ở đây chỉ mượn chỗ để vẽ.
   *
   * Không chép nội dung sang đây: hai bản sao của cùng một hướng dẫn thì sửa
   * một bên là bên kia lạc hậu ngay, mà chẳng ai báo. `guide.js` cũng dùng
   * chính bộ nội dung đó cho popup của mấy mục ngắn.
   */
  // Hai hướng dẫn dùng CHUNG một trang, phân biệt bằng khoá. Không dựng hai
  // thẻ trang riêng: chúng khác nhau đúng ở nội dung, mà nội dung thì guide.js
  // giữ — thêm thẻ thứ hai chỉ để chứa cùng một thứ là nhân đôi chỗ phải sửa.
  /* `hdCanMo = ''` nghĩa là hiện MỤC LỤC ba bài; có khoá thì hiện bài đó.
     Mặc định rỗng vì vào từ thanh bên là muốn xem có những bài gì. Hai nút cũ
     trong cột Dựng video vẫn vào thẳng bài của chúng qua `moHuongDan(khoa)`. */
  let hdCanMo = '';
  let hdDangVe = null;

  /* ══ MỤC LỤC BÀI HƯỚNG DẪN — KHÔNG KHAI Ở ĐÂY ═══════════════════════════
   * Danh sách bài (thứ tự · icon · tiêu đề thẻ · câu mô tả) nằm ở `MUC_LUC`
   * trong `guide.js`, ngay cạnh chính nội dung của chúng. Trước 19/09/2026
   * mỗi bài được khai HAI LẦN — nội dung một bên, mục lục một bên — nên thêm
   * bài mà quên một bên là bài đó không có trong mục lục, và không có phép
   * kiểm nào báo. Trang này giờ chỉ VẼ.
   *
   * ⚠ Đọc qua hàm chứ đừng giữ tham chiếu vào một biến ở đầu tệp: `guide.js`
   * nạp độc lập với tệp này, chộp sớm là chộp phải `undefined`. */
  const layBai = () => ((window.__beeGuide && window.__beeGuide.mucLuc)
    ? window.__beeGuide.mucLuc() : []);

  /* Màu cho từng thẻ trong mục lục — xem `.hd-the[data-mau]` ở css/pages.css.
     Không phải trang trí thuần: bảy thẻ chữ đen trên nền trắng thì mắt phải ĐỌC
     mới biết mình đang ở đâu trong danh sách. Có màu thì nhớ được bằng hình,
     kiểu "bài xanh lá là bài thư mục". Thứ tự khớp `MUC_LUC` trong guide.js. */
  const MAU_BAI = ['lam', 'luc', 'tim', 'vang', 'do', 'lam', 'xam', 'luc'];

  /**
   * Bài nào đã mở rồi — để mục lục đánh dấu bằng dấu tích.
   *
   * Bảy thẻ nhìn giống hệt nhau thì quay lại sau vài hôm không nhớ nổi mình
   * đọc tới đâu, và người ta hoặc đọc lại từ đầu hoặc bỏ dở luôn.
   *
   * ⚠ localStorage NÉM LỖI được (cửa sổ riêng tư, trình duyệt chặn lưu trữ),
   * mà đây chỉ là dấu tích trang trí — hỏng thì coi như chưa đọc bài nào, đừng
   * để nó làm vỡ cả trang.
   */
  const KHOA_DA_DOC = 'bee-hd-dadoc';

  function dsDaDoc() {
    try {
      const v = JSON.parse(window.localStorage.getItem(KHOA_DA_DOC) || '[]');
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }

  function ghiDaDoc(khoa) {
    if (!khoa) return;
    try {
      const ds = dsDaDoc();
      if (ds.includes(khoa)) return;
      ds.push(khoa);
      window.localStorage.setItem(KHOA_DA_DOC, JSON.stringify(ds));
    } catch { /* không ghi được thì thôi */ }
  }

  /**
   * Cột phải của trang Hướng dẫn.
   *
   * ⚠ KHÔNG có mục nào trỏ vào hư không. Mọi dòng ở đây đều mở một thứ CÓ THẬT
   * trong app hoặc một địa chỉ đang sống — mẫu thiết kế có hai mục ("Thư viện
   * âm thanh", "Cộng đồng hỗ trợ") mà app chưa có gì đứng sau, đặt vào là một
   * cái nút bấm không ra gì, tệ hơn hẳn việc không có nó.
   */
  const TAI_NGUYEN = [
    { icon: 'copy', nhan: 'Kho mẫu dọc 9:16', chu: 'Short, Reels, TikTok', trangApp: 'mau-doc' },
    { icon: 'monitor', nhan: 'Kho mẫu ngang 16:9', chu: 'Bài giảng, bản tin, biểu đồ', trangApp: 'mau-ngang' },
    { icon: 'bee', nhan: 'Beeknoee Platform', chu: 'Lấy API key giọng đọc', ngoai: () => 'https://platform.beeknoee.com/' },
    { icon: 'eleven', nhan: 'ElevenLabs', chu: 'Giọng đọc chất lượng cao', ngoai: () => 'https://elevenlabs.io/' },
  ];

  /**
   * Mục lục hướng dẫn.
   *
   * Bố cục hai cột: cột trái là đường đi chính (khối mở đầu + bảy thẻ bài), cột
   * phải là những thứ tra nhanh. Cột phải TỰ RỤNG XUỐNG dưới khi cửa sổ hẹp —
   * xem @media trong css/pages.css; ép hai cột ở màn hẹp thì cả hai đều teo.
   */
  function veMucLuc(box) {
    box.classList.remove('hd-trang');
    box.classList.add('hd-muc-trang');
    const daDoc = dsDaDoc();
    box.innerHTML = `
      <div class="hd-trum">
        <div class="hd-chinh">
          <section class="hd-hero">
            <span class="hd-hero-tag"><span class="btn-icon" data-icon="bee"></span>HƯỚNG DẪN BEEKNOEE STUDIO</span>
            <h2>Tạo video chuyên nghiệp<br>chỉ trong <em>vài phút</em></h2>
            <p>Làm theo các bước dưới đây để biến ý tưởng của bạn thành video ấn tượng với AI.
               Dễ dàng, nhanh chóng và mạnh mẽ hơn bao giờ hết.</p>
          </section>
          <div class="hd-muc">
            ${layBai().map((b, i) => `
              <button class="hd-the${daDoc.includes(b.khoa) ? ' da-doc' : ''}" type="button" data-hd-i="${i}" data-mau="${MAU_BAI[i] || 'xam'}">
                <span class="hd-so">${i + 1}</span>
                <span class="hd-o"><span class="btn-icon hd-icon" data-icon="${b.icon}"></span></span>
                <span class="hd-noi">
                  <span class="hd-ten">
                    ${esc(b.ten)}
                    <span class="hd-tich" title="Đã xem"><span class="btn-icon" data-icon="check"></span></span>
                  </span>
                  <span class="hd-mo">${esc(b.mo)}</span>
                </span>
                <span class="hd-mui" aria-hidden="true">›</span>
              </button>`).join('')}
          </div>
        </div>

        <aside class="hd-ben">
          <section class="hd-ben-the hd-meo">
            <h3><span class="btn-icon" data-icon="sao"></span>Mẹo nhỏ</h3>
            <p>Mới dùng thì xem bài đầu tiên, rồi "Bản đồ giao diện" và "Timeline". Bài nào cũng có ảnh chụp
               từ chính app để đối chiếu.</p>
          </section>

          <section class="hd-ben-the">
            <h3>Tài nguyên hữu ích</h3>
            <div class="hd-ds">
              ${TAI_NGUYEN.map((t, i) => `
                <button class="hd-ds-dong" type="button" data-hd-tn="${i}">
                  <span class="hd-ds-o"><span class="btn-icon" data-icon="${t.icon}"></span></span>
                  <span class="hd-ds-chu">
                    <span class="hd-ds-nhan">${esc(t.nhan)}</span>
                    <span class="hd-ds-mo">${esc(t.chu)}</span>
                  </span>
                  <span class="hd-ds-mui" aria-hidden="true">${t.trangApp ? '›' : '↗'}</span>
                </button>`).join('')}
            </div>
          </section>

          <section class="hd-ben-the hd-video">
            <span class="hd-video-o"><span class="btn-icon" data-icon="play"></span></span>
            <b>Xem video hướng dẫn</b>
            <em>Từ lúc chọn mẫu tới lúc ra video · xem ngay trong app</em>
            <button class="hd-video-nut" type="button" data-hd-video>
              <span class="btn-icon" data-icon="play"></span>Phát ngay
            </button>
          </section>

          <section class="hd-ben-the" data-hd-vd-ds hidden>
            <h3>Loạt video hướng dẫn</h3>
            <div class="hd-ds">
              ${((window.__beeGuide && window.__beeGuide.videoDs) || []).map((v, i) => `
                <button class="hd-ds-dong" type="button" data-hd-vd="${esc(v.khoa)}" hidden>
                  <span class="hd-ds-o">${i + 1}</span>
                  <span class="hd-ds-chu">
                    <span class="hd-ds-nhan">${esc(v.ten)}</span>
                    <span class="hd-ds-mo">${esc(v.mo)}</span>
                  </span>
                  <span class="hd-ds-mui" aria-hidden="true">▶</span>
                </button>`).join('')}
            </div>
          </section>

          <section class="hd-ben-the hd-hotro">
            <h3><span class="btn-icon" data-icon="mail"></span>Vẫn cần hỗ trợ?</h3>
            <p>Không có bài nào trả lời được việc bạn đang gặp? Gửi thẳng cho đội Beeknoee,
               kèm nhật ký lỗi của app.</p>
            <button class="hd-hotro-nut" type="button" data-hd-hotro>Liên hệ hỗ trợ →</button>
          </section>
        </aside>
      </div>`;

    box.querySelectorAll('[data-hd-i]').forEach((nut) => {
      nut.onclick = () => {
        const b = layBai()[Number(nut.dataset.hdI)];
        if (b.trang) {
          // Bài nằm trong trang khác — sang đó rồi mở sẵn phần hướng dẫn.
          moTrang(b.trang);
          setTimeout(() => {
            const mo = document.querySelector('[data-mo-hd]');
            if (mo && mo.getAttribute('aria-expanded') !== 'true') mo.click();
          }, 60);
          return;
        }
        moHuongDan(b.khoa);
      };
    });

    /* Cột phải. Link ra ngoài PHẢI đi qua `openExternal`: để thẻ <a> chạy tự
       nhiên là cả cửa sổ app điều hướng sang trang web, mà app không có thanh
       địa chỉ nên không còn đường quay lại. Cùng bài học đã ghi ở guide.js. */
    box.querySelectorAll('[data-hd-tn]').forEach((nut) => {
      nut.onclick = () => {
        const t = TAI_NGUYEN[Number(nut.dataset.hdTn)];
        if (t.trangApp) { moTrang(t.trangApp); return; }
        const url = t.ngoai && t.ngoai();
        if (url && api.openExternal) api.openExternal(url);
      };
    });
    /* Video hướng dẫn đi kèm bộ cài, phát TRONG app (guide.js#xemVideo). Dòng nào không có tệp thì ẩn; cả danh
       sách trống (bản dựng thiếu video) thì ẩn luôn thẻ — nút "Phát ngay" khi đó lùi về video cũ trên YouTube. */
    const G = window.__beeGuide || {};
    const nutVideo = box.querySelector('[data-hd-video]');
    if (nutVideo) nutVideo.onclick = () => { if (G.xemVideo) G.xemVideo('bat-dau', 0); };
    box.querySelectorAll('[data-hd-vd]').forEach((nut) => {
      nut.onclick = () => { if (G.xemVideo) G.xemVideo(nut.dataset.hdVd, 0); };
    });
    if (G.napVideo) {
      G.napVideo().then((ds) => {
        let co = 0;
        box.querySelectorAll('[data-hd-vd]').forEach((nut) => { nut.hidden = !ds[nut.dataset.hdVd]; co += nut.hidden ? 0 : 1; });
        const the = box.querySelector('[data-hd-vd-ds]');
        if (the) the.hidden = !co;
      });
    }
    /* "Liên hệ hỗ trợ" mở ĐÚNG hộp báo lỗi của nút "?" — nó đã gửi thẳng về máy
       chủ kèm nhật ký lỗi 10 mục gần nhất. Dựng một đường liên hệ thứ hai ở đây
       là hai đường cùng làm một việc, rồi lệch nhau. */
    const nutHoTro = box.querySelector('[data-hd-hotro]');
    if (nutHoTro) {
      nutHoTro.onclick = () => {
        if (window.__beeHub && window.__beeHub.moHopLoi) window.__beeHub.moHopLoi();
      };
    }

    if (window.__beeIcons) window.__beeIcons.apply(box);
  }

  function napHuongDan() {
    const box = document.getElementById('page-huongdan');
    if (!box) return;
    // Vẽ lại khi ĐỔI hướng dẫn, không chỉ lần đầu — bản trước khoá bằng một cờ
    // boolean nên bấm nút thứ hai vẫn ra nội dung của nút thứ nhất.
    if (hdDangVe === hdCanMo) return;

    if (!hdCanMo) { veMucLuc(box); hdDangVe = ''; box.scrollTop = 0; return; }

    if (window.__beeGuide && window.__beeGuide.veTrang
        && window.__beeGuide.veTrang(box, hdCanMo)) {
      // Nút quay lại mục lục — chèn sau khi guide.js đã dựng xong nội dung.
      const lui = document.createElement('button');
      lui.type = 'button';
      lui.className = 'hd-lui';
      lui.innerHTML = '‹ Tất cả hướng dẫn';
      lui.onclick = () => moHuongDan('');
      box.insertBefore(lui, box.firstChild);
      hdDangVe = hdCanMo;
      box.scrollTop = 0;
      return;
    }
    // guide.js nạp sau pages.js nên lần mở đầu có thể trượt — KHÔNG ghi nhận
    // đã vẽ, để lần mở sau còn thử lại.
    box.innerHTML = '<div class="tpl-rong">Chưa nạp được nội dung hướng dẫn.</div>';
  }

  /**
   * Mở trang Hướng dẫn.
   *
   * `khoa` rỗng = mục lục ba bài (nút trên thanh bên, nút quay lại).
   * `khoa` có giá trị = vào thẳng bài đó (hai nút cũ trong cột Dựng video).
   *
   * ⚠ KHÔNG còn mặc định về 'manual' khi thiếu tham số. Trước đây gọi rỗng là
   * rơi vào bài audio, nên nút trên thanh bên sẽ nhảy thẳng vào một bài thay vì
   * cho xem có những bài gì.
   */
  function moHuongDan(khoa) {
    hdCanMo = khoa || '';
    ghiDaDoc(hdCanMo);
    moTrang('huongdan');
  }

  const daNap = new Set();
  /** Danh sách mẫu đổi (Lưu làm mẫu / xoá mẫu của tôi): trang đang mở dựng lại ngay, trang kia dựng lại lúc mở. */
  function lamMoiMau() {
    daNap.clear();
    for (const k of Object.keys(TRANG_MAU)) {
      const el = document.getElementById(`page-${k}`);
      if (el && !el.hidden) napTemplate(k);
    }
  }
  async function napTemplate(key) {
    if (daNap.has(key)) return;
    daNap.add(key);
    const cau = TRANG_MAU[key];
    const box = document.getElementById(`page-${key}`);
    let goc;
    try {
      goc = await api.templates.list();
    } catch (e) {
      /* Bỏ dấu đã-nạp ra. Lỗi ở đây gần như luôn là lỗi nhất thời (chưa trỏ
         thư mục nguồn); giữ dấu lại thì trang chết cho tới lúc khởi động lại
         app, mà người dùng không có cách nào đoán ra phải làm vậy. */
      daNap.delete(key);
      box.innerHTML = `<div class="tpl-rong">Không đọc được thư mục template: ${esc(e.message)}</div>`;
      return;
    }
    /* MỘT lượt gọi, mỗi trang lọc phần của mình ra từ đó. `khung` do
       `khungCuaDeck()` đọc ở tiến trình chính; mẫu cũ không khai gì = 'doc',
       nên 21 mẫu hiện có nằm nguyên ở trang dọc. */
    const data = { ...goc, templates: goc.templates.filter((t) => (t.khung || 'doc') === cau.khung) };


    // MỘT lưới chung, không tách từng nhóm thành khối riêng: bảy template mà
    // chia năm khối thì mỗi khối một hai thẻ, màn hình dài ngoẵng toàn tiêu đề.
    // Nhóm chuyển thành con chip nhỏ trên thẻ.
    /**
     * Gom thẻ theo nhóm, GIỮ NGUYÊN thứ tự máy chủ gửi xuống.
     *
     * `main.js` đã sắp theo thứ tự trong `_templates.json` rồi — sắp lại ở đây
     * (ví dụ theo bảng chữ cái) là đá lại chủ ý của người viết danh mục, mà
     * cũng làm "Bắt đầu" tụt xuống giữa danh sách thay vì đứng đầu.
     * `Map` giữ thứ tự khoá theo lần chèn đầu tiên nên không cần sắp gì thêm.
     */
    function theoNhom(ds) {
      const m = new Map();
      for (const t of ds) {
        const k = t.nhom || 'Khác';
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(t);
      }
      return [...m.entries()];
    }

    /* Màu thẻ phân loại — CHỌN THEO TÊN THẺ, không theo vị trí.
       Bốc màu theo thứ tự thì cùng một chữ "Crypto" ở thẻ này xanh, thẻ kia
       vàng; mắt hiểu màu là một cách phân loại nên sẽ tìm quy luật không có.
       Băm tên ra số là "Crypto" ở đâu cũng một màu. */
    const MAU_THE = ['lam', 'luc', 'tim', 'vang', 'do'];
    const mauThe = (s) => {
      let n = 0;
      for (let i = 0; i < s.length; i += 1) n = (n * 31 + s.charCodeAt(i)) >>> 0;
      return MAU_THE[n % MAU_THE.length];
    };

    const the = (t) => `
      ${/* `data-tim` gom sẵn mọi chữ tìm được của thẻ, ĐÃ BỎ DẤU. Gom lúc dựng
            chứ không đọc textContent mỗi phím gõ: 21 thẻ × mỗi ký tự là một
            lượt duyệt DOM, mà chuỗi này có đổi đâu. */ ''}
      <div class="tpl-the" data-id="${esc(t.name)}" data-mau-id="${esc(t.id)}" data-nhom="${esc(t.nhom)}" data-ten="${esc(t.ten)}" data-slide="${Number(t.slides) || 0}"
           data-tim="${esc(khongDau([t.ten, t.moTa, t.nhom, (t.the || []).join(' '), t.ma].join(' ')))}">
        <div class="tpl-khung" data-khung="${esc(t.khung || 'doc')}">
          ${t.video
            ? `<video class="tpl-anh" src="${esc(t.video)}"${/* Mẫu dựng video mở bằng màn đen mờ dần → khung đầu
                   (preload="metadata") là ô đen; ảnh bìa đặt làm poster thì thẻ có hình ngay. */ t.anh ? ` poster="${esc(t.anh)}"` : ''} loop playsinline preload="metadata"></video>
               <button class="tpl-phat" type="button" aria-label="Phát video mẫu">
                 <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                   <path class="ico-play" d="M8 5.2 19 12 8 18.8z" fill="currentColor"/>
                   <g class="ico-pause" hidden><rect x="7" y="5.5" width="3.6" height="13" rx="1.2" fill="currentColor"/><rect x="13.4" y="5.5" width="3.6" height="13" rx="1.2" fill="currentColor"/></g>
                 </svg>
               </button>
               ${/* ⚠ NÚT XEM TO CHỈ CÓ Ở MẪU NGANG. Ô xem trước của thẻ rộng
                      ~215px; khung 16:9 nhét vào đó chỉ cao ~121px, tức chữ
                      tiêu đề 74px của deck co lại còn ~8px trên màn hình —
                      không đọc nổi. Khung dọc 9:16 cùng bề ngang ấy cao 300px
                      nên không cần. */ ''}
               ${(t.khung || 'doc') === 'ngang' ? `
                 <button class="tpl-to" type="button" aria-label="Xem video lớn">
                   <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                        stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                     <path d="M9 4H4v5"/><path d="M4 4l6 6"/>
                     <path d="M15 20h5v-5"/><path d="M20 20l-6-6"/>
                   </svg>
                 </button>` : ''}
               <button class="tpl-tieng" type="button" aria-label="Bật/tắt tiếng">
                 <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <path d="M4 9.5h3.4L12 5.6v12.8L7.4 14.5H4z" fill="currentColor" stroke="none"/>
                   <g class="ico-loa"><path d="M15.6 9.4a3.6 3.6 0 0 1 0 5.2"/><path d="M18 7a7 7 0 0 1 0 10"/></g>
                   <g class="ico-tat" hidden><path d="M16 9.5l4.5 5M20.5 9.5l-4.5 5"/></g>
                 </svg>
               </button>`
            : t.anh
              ? `<img class="tpl-anh" src="${esc(t.anh)}" alt="" loading="lazy">`
              : '<div class="tpl-anh tpl-trong">chưa có ảnh mẫu</div>'}
        </div>
        <div class="tpl-ten" title="${esc(t.ten)}">${esc(t.ten)}</div>
        <div class="tpl-mota">${esc(t.moTa || '')}</div>
        ${/* Thẻ phân loại nằm DƯỚI mô tả, không nằm trên tên.
              Ở trên tên thì thứ đầu tiên mắt chạm vào là một mã ("TIN-01") và
              một chữ phân loại — cả hai đều không nói mẫu này làm được gì.
              Mã mẫu bỏ hẳn: nó chỉ dùng trong câu lệnh gửi cho AI, mà câu lệnh
              đã kèm sẵn (xem `kemDuongDan`), người dùng không cần đọc nó. */ ''}
        ${(t.the || []).length ? `
          <div class="tpl-the-ds">
            ${t.the.map((x) => `<span class="tpl-tag" data-mau="${mauThe(x)}">${esc(x)}</span>`).join('')}
          </div>` : ''}
        <div class="tpl-chan">
          <span class="tpl-meta">${t.loai === 'dung'
            ? `${t.soO} ô · ${Math.round((t.daiMs || 0) / 1000)} giây`
            : `${t.slides} slide`}</span>
          ${/* "Copy prompt" GIỮ LẠI bên cạnh: nó vẫn là đường dùng AI ngoài cho
                ai đã quen. Nút chính bây giờ là "Tạo dự án" — chép mẫu ngay
                trong app, không phải mở ứng dụng khác chỉ để copy thư mục. */ ''}
          ${t.prompt ? '<button class="tpl-copy" type="button" data-copy>Copy prompt</button>' : ''}
          ${t.cuaToi ? '<button class="tpl-copy" type="button" data-xoa-mau title="Xoá mẫu này khỏi máy">Xoá mẫu</button>' : ''}
        </div>
        ${/* ⚠ Nút chính XUỐNG HÀNG RIÊNG, không nhét vào hàng chân. Thẻ rộng
              ~215px; "6 slide" + "Copy prompt" + "Tạo dự án" cộng lại đã hơn
              240px nên ba thứ đè lên nhau (đo 16/09/2026). Xuống hàng vừa hết
              chật vừa đúng thứ bậc: đây là việc chính của thẻ. */ ''}
        <button class="tpl-tao" type="button" data-tao><span class="btn-icon" data-icon="cong"></span>Tạo dự án</button>
        <div class="tpl-bao" hidden></div>
      </div>`;


    box.innerHTML = `
      <section class="tpl-hero">
        <div class="tpl-hero-chu">
          <span class="tpl-hero-tem"><span class="btn-icon" data-icon="${cau.icon}"></span>${cau.tem}</span>
          <div class="tpl-hero-dong">
            <h2>${cau.h2}</h2>
            <button class="tpl-hdmo" type="button" data-mo-hd>(Hướng dẫn chi tiết)</button>
          </div>
          <p>${cau.mo}</p>
          <div class="tpl-loi">
            <span><span class="tpl-loi-o" data-mau="lam"><span class="btn-icon" data-icon="copy"></span></span>
              <b>Dễ sử dụng</b><em>Copy prompt &amp; tạo ngay</em></span>
            <span><span class="tpl-loi-o" data-mau="luc"><span class="btn-icon" data-icon="the"></span></span>
              <b>${cau.loi2}</b><em>${data.templates.length} mẫu, ${theoNhom(data.templates).length} nhóm</em></span>
            <span><span class="tpl-loi-o" data-mau="tim"><span class="btn-icon" data-icon="sao"></span></span>
              <b>Chất lượng cao</b><em>${cau.loi3}</em></span>
          </div>
        </div>
      </section>


      ${data.templates.length ? `
        <div class="tpl-hang">
          <button class="tpl-truot" type="button" data-truot="-1" aria-label="Xem nhóm trước">‹</button>
          <div class="tpl-tabs-boc">
            <div class="tpl-tabs" role="tablist">
              <button class="tpl-tab dang-chon" type="button" role="tab" data-nhom="">
                Tất cả<span class="tpl-tab-so">${data.templates.length}</span></button>
              ${theoNhom(data.templates).map(([nhom, ds]) => `
                <button class="tpl-tab" type="button" role="tab" data-nhom="${esc(nhom)}">
                  ${esc(nhom)}<span class="tpl-tab-so">${ds.length}</span></button>`).join('')}
            </div>
          </div>
          <button class="tpl-truot" type="button" data-truot="1" aria-label="Xem nhóm sau">›</button>
          <div class="tpl-dieu">
            <div class="tpl-kieu" role="group" aria-label="Kiểu hiển thị">
              <button class="tpl-kieu-nut dang-chon" type="button" data-kieu="luoi">
                <span class="btn-icon" data-icon="the"></span>Lưới</button>
              <button class="tpl-kieu-nut" type="button" data-kieu="danhsach">
                <span class="btn-icon" data-icon="cuon"></span>Danh sách</button>
            </div>
            ${/* KHÔNG có "Mới nhất": danh mục template không có ngày tháng nào
                  cả, nên một lựa chọn tên như vậy chỉ là cái nhãn không làm gì.
                  Ba cách sắp dưới đây đều tính được từ dữ liệu đang có. */ ''}
            <select class="tpl-sap" aria-label="Sắp xếp">
              <option value="mac-dinh">Thứ tự đề xuất</option>
              <option value="ten">Tên A → Z</option>
              <option value="slide">Nhiều slide nhất</option>
            </select>
          </div>
        </div>
        <div class="tpl-luoi">${data.templates.map(the).join('')}</div>`
        : `<div class="tpl-rong">${goc.templates.length
            ? cau.rong
            : 'Chưa thấy thư mục <code>template/</code> nào trong thư mục app.'}</div>`}`;

    // ĐÃ GỠ khối "Thư mục làm việc" (và cảnh báo lệch thư mục đi kèm) theo yêu
    // cầu của chủ dự án: việc trỏ AI vào đâu sẽ nói trong tài liệu hướng dẫn,
    // không nhồi vào giao diện.
    //
    // ⚠ Nhưng vấn đề nó cảnh báo thì VẪN CÒN: `sourceRoot` và thư mục AI làm
    // việc có thể là hai nơi khác nhau, khi đó deck AI tạo ra app không hiện.
    // `templates:list` vẫn trả về `sourceRoot` + `deckDir` để chỗ khác dùng lại
    // được — đừng bỏ hai trường đó khi dọn dẹp.

    if (window.__beeIcons) window.__beeIcons.apply(box);
    noiSuKien(box, data);
  }

  /**
   * Gắn ĐƯỜNG DẪN TUYỆT ĐỐI vào đầu câu lệnh trước khi copy.
   *
   * Vì sao cần: câu lệnh trong `_templates.json` chỉ nói "thư mục làm việc" và
   * trỏ mẫu bằng đường dẫn TƯƠNG ĐỐI (`template/vi-du/...`). Dán vào một
   * AI đang mở ở thư mục khác thì không có đường nào giải ra được — và AI không
   * dừng lại hỏi, nó báo "không tìm thấy mẫu" rồi tự bịa ra một project mới,
   * sai hẳn phong cách. Đã dính đúng như vậy (03/09/2026).
   *
   * Ghi vào CÂU LỆNH chứ không thêm khối nào lên giao diện: chủ dự án đã bỏ khối
   * "Thư mục làm việc" khỏi trang này, đừng dựng lại (xem chú thích ở napTemplate).
   */
  function kemDuongDan(prompt, root, t) {
    if (!root) return prompt;
    /* Thư mục làm việc dựng từ bản cài CŨ có thể không có mẫu này: mẫu thêm về
       sau, hoặc thư mục gom mẫu đã đổi tên (24/09/2026). Đường dẫn tương đối
       trong prompt khi đó trỏ vào chỗ trống và AI dừng lại hỏi — thay bằng đường
       dẫn TUYỆT ĐỐI tới bản mẫu đi kèm app, deck mới vẫn ghi vào thư mục làm việc. */
    const tuongDoi = t && t.id ? `template/${t.id}` : '';
    const noiDung = tuongDoi && t.path && t.coTrongThuMucLamViec === false
      ? prompt.split(tuongDoi).join(t.path)
      : prompt;
    return [
      `Thư mục làm việc: ${root}`,
      'Mọi đường dẫn dưới đây tính từ thư mục này. Không thấy thì DỪNG LẠI và hỏi,',
      'đừng tự tạo project mới theo phong cách khác.',
      '',
      noiDung,
    ].join('\n');
  }

  /**
   * Tạo dự án từ mẫu — bấm "Tạo dự án" trên thẻ mở hộp Nội dung + Lưu ý (moHopTaoMau → prompt vào ô chat AI
   * agent; "Chỉ tạo dự án" chép mẫu ngay trong hộp). Hàng nhập tên cũ trong thẻ đã bỏ (chủ dự án: 100% dùng hộp).
   */
  /** Câu lệnh của mẫu (hoặc câu mặc định cho mẫu chưa khai — vd "Mẫu của tôi") + Nội dung + Lưu ý của người dùng. */
  function promptTuMau(t, data, noiDung, luuY) {
    const goc = t.prompt || (t.loai === 'dung'
      ? `Dùng các công cụ studio_* của Beeknoee Studio (MCP) để làm một video từ mẫu dựng video "${t.ten}".\n\n`
        + `Mẫu: ${t.id} — ${t.soO || 0} ô ảnh / video (Ô 1 → Ô ${t.soO || 0} trên timeline). Tạo dự án bằng studio_create_project `
        + `(template_id ${t.id}), nhập ảnh / video của tôi bằng studio_media_import, thay từng ô bằng studio_timeline_replace_media `
        + 'theo thứ tự ô, rồi sửa chữ bằng studio_timeline_update_title cho đúng nội dung. Xem lại bằng studio_timeline_get trước khi xuất.\n\n'
        + 'Nội dung của tôi:\n\n[NỘI DUNG Ở ĐÂY]'
      : `Đọc kỹ workflow.md và AGENTS.md trong thư mục làm việc, rồi tạo một project slide mới từ mẫu template/${t.id}.\n\n`
        + 'Nội dung nguồn:\n\n[NỘI DUNG Ở ĐÂY]');
    let p = kemDuongDan(goc, data.workRoot || data.root, t);
    // Chỗ chừa trong câu lệnh mẫu: "[DÁN URL HOẶC NỘI DUNG Ở ĐÂY]", "[MÔ TẢ VIDEO + … Ở ĐÂY]"…
    const cho = /\[[^\]\n]*Ở ĐÂY\]/;
    p = cho.test(p) ? p.replace(cho, () => noiDung) : `${p}\n\nNội dung:\n\n${noiDung}`;
    if (luuY) p += `\n\nLƯU Ý CỦA TÔI (ưu tiên hơn hướng dẫn chung ở trên):\n${luuY}`;
    return p;
  }

  /**
   * Hộp "Tạo dự án" (23/10/2026, chủ dự án yêu cầu): HAI ô — Nội dung + Lưu ý — ghép với câu lệnh của mẫu thành
   * prompt, đặt SẴN vào ô chat của tab AI agent (không gửi: người dùng đọc lại rồi tự gửi). AI agent tự tạo dự án từ
   * mẫu qua MCP. "Chỉ tạo dự án" giữ đường cũ: chép mẫu thành dự án rồi mở ra để tự làm tay.
   */
  function moHopTaoMau(t, data) {
    const tao = (the, lop) => { const e = document.createElement(the); if (lop) e.className = lop; return e; };
    const h = tao('div', 'ai-hop dav-hop tpl-hop');
    const nen = tao('div', 'ai-nen');
    const khung = tao('div', 'ai-khung');
    khung.setAttribute('role', 'dialog');
    khung.setAttribute('aria-modal', 'true');
    khung.setAttribute('aria-label', 'Tạo dự án từ mẫu');
    const nutMo = document.activeElement;
    const dung = t.loai === 'dung';
    khung.innerHTML = `
      <div class="ai-dau"><span class="btn-icon" data-icon="duAnMoi"></span><b>Tạo dự án — ${esc(t.ten || t.id)}</b></div>
      <div class="ai-than">
        <div class="ait-hoi-dong">${dung
          ? 'Mô tả video và dán đường dẫn ảnh / video của bạn (mỗi tệp một dòng). Bấm <b>Tạo</b> là yêu cầu được đặt sẵn vào ô chat của <b>AI agent</b> — đọc lại rồi bấm Gửi, AI sẽ tạo dự án từ mẫu, thay vào các ô và sửa chữ.'
          : 'Viết nội dung video hoặc dán URL bài viết. Bấm <b>Tạo</b> là yêu cầu được đặt sẵn vào ô chat của <b>AI agent</b> — đọc lại rồi bấm Gửi, AI sẽ tạo dự án từ mẫu, viết chữ và lời đọc.'}</div>
        <label class="dav-nhan" for="tplNoiDung">Nội dung</label>
        <textarea id="tplNoiDung" class="dav-o tpl-hop-o" rows="5" maxlength="20000" spellcheck="false"
          placeholder="${dung ? 'Vd: Video du lịch Đà Lạt 3 ngày 2 đêm.&#10;D:\\Anh\\dalat-1.jpg&#10;D:\\Anh\\dalat-2.mp4' : 'Vd: 5 mẹo giữ ấm mùa đông cho người già — hoặc dán URL bài báo'}"></textarea>
        <label class="dav-nhan" for="tplLuuY">Lưu ý <span class="tpl-hop-phu">(không bắt buộc)</span></label>
        <textarea id="tplLuuY" class="dav-o tpl-hop-o" rows="5" maxlength="4000" spellcheck="false"
          placeholder="Giọng điệu, độ dài, màu sắc, tên thương hiệu, điều cần tránh…"></textarea>
        <div class="dav-loi" hidden></div>
      </div>
      <div class="ait-hoi-nut">
        <button type="button" class="ait-hoi-phu tpl-hop-tay" data-chi-tao title="Chép mẫu thành dự án rồi mở ra — tự làm tay, không qua AI">Chỉ tạo dự án</button>
        <button type="button" class="ait-hoi-phu" data-huy>Hủy</button>
        <button type="button" class="ait-hoi-chinh" data-tao>Tạo</button>
      </div>`;
    h.append(nen, khung);
    document.body.append(h);
    if (window.__beeIcons) window.__beeIcons.apply(h);
    const oND = h.querySelector('#tplNoiDung');
    const oLY = h.querySelector('#tplLuuY');
    const oLoi = h.querySelector('.dav-loi');
    oND.focus();
    const dong = () => {
      document.removeEventListener('keydown', phim, true);
      h.remove();
      if (nutMo && nutMo.isConnected && nutMo.focus) nutMo.focus();
    };
    const phim = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dong(); }
      // Ctrl+Enter = Tạo (Enter thường là xuống dòng trong ô nhiều dòng).
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); h.querySelector('[data-tao]').click(); }
    };
    document.addEventListener('keydown', phim, true);
    nen.onclick = dong;
    h.querySelector('[data-huy]').onclick = dong;
    /* Chỉ tạo dự án: chép mẫu thành dự án NGAY trong hộp (tên = tên mẫu; trùng thì main tự thêm `-2`, `-3`, không
       ghi đè), báo trạng thái tại chỗ, xong thì mở dự án. */
    const nutChi = h.querySelector('[data-chi-tao]');
    nutChi.onclick = async () => {
      if (nutChi.disabled) return;
      h.querySelectorAll('.ait-hoi-nut button').forEach((b) => { b.disabled = true; });
      oLoi.hidden = false;
      oLoi.classList.add('tpl-hop-dang');
      oLoi.textContent = 'Đang tạo dự án…';
      try {
        /* ⚠ `t.id` ("vi-du/<tên>", "dung-video/<tên>") chứ KHÔNG phải `t.name` — tên thư mục cuối, main không tìm ra
           mẫu lồng một tầng (đã kiểm: 21/22 mẫu nằm trong thư mục gom). */
        const r = await window.beeknoee.projects.createFromTemplate({ mauId: t.id, ten: t.ten || '' });
        if (!r || !r.ok) throw new Error((r && r.loi) || 'Không tạo được.');
        dong();
        await moDuAnVuaTao(r.name);
      } catch (e) {
        oLoi.classList.remove('tpl-hop-dang');
        oLoi.textContent = (e && e.message) || String(e);
        h.querySelectorAll('.ait-hoi-nut button').forEach((b) => { b.disabled = false; });
      }
    };
    h.querySelector('[data-tao]').onclick = () => {
      const noiDung = oND.value.trim();
      if (!noiDung) { oLoi.hidden = false; oLoi.textContent = 'Viết nội dung trước đã.'; oND.focus(); return; }
      const p = promptTuMau(t, data, noiDung, oLY.value.trim());
      dong();
      moTrang('render');
      if (window.__beeMoTab) window.__beeMoTab('agent');
      if (window.__beeAgentChat) window.__beeAgentChat.dienChu(p);
    };
  }

  function noiTaoDuAn(box, data) {
    box.querySelectorAll('.tpl-the').forEach((the) => {
      const nutTao = the.querySelector('[data-tao]');
      if (!nutTao) return;
      nutTao.onclick = () => {
        const t = (data.templates || []).find((x) => x.id === the.dataset.mauId);
        if (t) moHopTaoMau(t, data);
      };
    });
  }

  /**
   * Sang trang Dựng video rồi CHỌN dự án vừa tạo.
   *
   * ⚠ KHÔNG chỉ gọi `lamMoiDanhSach()` một lượt rồi chọn ngay — ĐÃ THỬ, TRƯỢT.
   * Thư mục mới xuất hiện cũng đánh thức watcher (`fs-watch.js:128` →
   * `render-page.js:364`), nên có HAI lượt nạp danh sách chạy song song, mà
   * `lamMoiDanhSach` có chốt chống đua: lượt nào không phải lượt mới nhất thì
   * bỏ kết quả (`project-list.js:218`). Lượt của mình thua là `projectMap` chưa
   * có dự án mới, `setSelectedProject` lặng lẽ không chọn gì, và người dùng
   * vừa tạo xong lại thấy deck cũ. Đo được đúng như vậy 16/09/2026.
   *
   * Nên ĐỢI CHO TỚI KHI dự án có mặt trong sổ rồi mới chọn — ai nạp lại cũng
   * được, miễn là có mặt. Chặn 8 nhịp (~4 giây) để không quay mãi.
   */
  async function moDuAnVuaTao(ten) {
    moTrang('render');
    const RP = window.__renderPage;
    if (!RP || !RP.setSelectedProject) return;
    // Bộ slide phụ `cha::id` (GĐ3.7): không nằm trong danh sách — mở dòng ảo dựng từ dự án mẹ (project-list.js).
    if (/::/.test(String(ten)) && RP.moBoSlide) {
      if (RP.moBoSlide(ten)) return;
      if (RP.lamMoiDanhSach) { try { await RP.lamMoiDanhSach(); } catch { /* thử một lần */ } }
      RP.moBoSlide(ten);
      return;
    }
    const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let lan = 0; lan < 8; lan += 1) {
      try {
        if (RP.projectMap && RP.projectMap.has(ten)) { RP.setSelectedProject(ten); return; }
        if (RP.lamMoiDanhSach) await RP.lamMoiDanhSach();
      } catch { /* thử lại nhịp sau */ }
      if (RP.projectMap && RP.projectMap.has(ten)) { RP.setSelectedProject(ten); return; }
      await nghi(500);
    }
    /* Hết nhịp mà vẫn chưa thấy: dự án ĐÃ tạo xong (hàm này chỉ chạy sau khi
       main báo ok), chỉ là danh sách chưa kịp. Không báo lỗi — câu "Đã tạo …"
       trên thẻ vẫn đúng, người dùng bấm vào deck là mở được. */
  }

  /** Nút phát/dừng ở giữa video, và nút copy câu lệnh. */
  function noiSuKien(box, data) {
    /**
     * Lọc thẻ theo tab.
     *
     * ⚠ ẨN chứ KHÔNG dựng lại danh sách. Mọi thẻ nằm sẵn trong DOM và các
     * handler bên dưới (phát video, bật/tắt tiếng, Copy prompt) gắn thẳng vào
     * từng nút — dựng lại HTML là mất sạch chúng, thẻ trông vẫn bình thường mà
     * bấm không ra gì. Ẩn cũng giữ được vị trí video đang xem khi đổi tab qua lại.
     */
    const tabs = [].slice.call(box.querySelectorAll('.tpl-tab'));
    const the = [].slice.call(box.querySelectorAll('.tpl-the'));
    const luoi = box.querySelector('.tpl-luoi');

    /* ── Hàng nhóm: trượt bằng NÚT, không bằng thanh cuộn ─────────────────
       Thanh cuộn ngang trong một hàng cao 36px vừa khó trúng vừa chiếm mất
       vài điểm ảnh chiều cao. Hai nút ‹ › tự ẩn khi không còn gì để trượt —
       nút bấm không ra gì còn tệ hơn nút không có. */
    const boc = box.querySelector('.tpl-tabs-boc');
    const nutTruot = [].slice.call(box.querySelectorAll('[data-truot]'));
    function capNhatTruot() {
      if (!boc) return;
      const con = boc.scrollWidth - boc.clientWidth;
      nutTruot.forEach((n) => {
        const xuoi = Number(n.dataset.truot) > 0;
        n.disabled = con <= 1 || (xuoi ? boc.scrollLeft >= con - 1 : boc.scrollLeft <= 1);
      });
    }
    nutTruot.forEach((n) => {
      n.onclick = () => {
        if (!boc) return;
        boc.scrollBy({ left: Number(n.dataset.truot) * Math.max(160, boc.clientWidth * 0.7), behavior: 'smooth' });
      };
    });
    if (boc) boc.addEventListener('scroll', capNhatTruot);
    window.addEventListener('resize', capNhatTruot);
    capNhatTruot();

    /* ── Kiểu hiển thị: lưới / danh sách ─────────────────────────────────── */
    box.querySelectorAll('[data-kieu]').forEach((n) => {
      n.onclick = () => {
        box.querySelectorAll('[data-kieu]').forEach((k) => k.classList.toggle('dang-chon', k === n));
        if (luoi) luoi.classList.toggle('kieu-danhsach', n.dataset.kieu === 'danhsach');
      };
    });

    /* ── Sắp xếp ─────────────────────────────────────────────────────────
       Đổi THỨ TỰ trong DOM bằng appendChild chứ không dựng lại HTML: mọi
       handler (phát video, bật tiếng, Copy prompt) gắn thẳng vào từng nút,
       dựng lại là mất sạch — cùng lý do đã ghi ở phần lọc theo tab. */
    const oSap = box.querySelector('.tpl-sap');
    const thuTuGoc = the.slice();
    if (oSap && luoi) {
      oSap.onchange = () => {
        const k = oSap.value;
        const ds = thuTuGoc.slice();
        if (k === 'ten') ds.sort((a, b) => (a.dataset.ten || '').localeCompare(b.dataset.ten || '', 'vi'));
        else if (k === 'slide') ds.sort((a, b) => Number(b.dataset.slide) - Number(a.dataset.slide));
        ds.forEach((el) => luoi.appendChild(el));
      };
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const nhom = tab.dataset.nhom;
        tabs.forEach((t) => t.classList.toggle('dang-chon', t === tab));
        the.forEach((el) => {
          el.hidden = Boolean(nhom) && el.dataset.nhom !== nhom;
          // Video của thẻ vừa ẩn phải dừng: để chạy tiếp thì người dùng nghe
          // tiếng từ một thẻ không còn nhìn thấy, không biết tắt ở đâu.
          if (el.hidden) el.querySelectorAll('video').forEach((v) => v.pause());
        });
        box.querySelectorAll('.tpl-phat').forEach((b) => {
          b.querySelector('.ico-play').removeAttribute('hidden');
          b.querySelector('.ico-pause').setAttribute('hidden', '');
          b.classList.remove('dang-phat');
        });
        capNhatTruot();
      });
    });

    box.querySelectorAll('.tpl-phat').forEach((btn) => {
      const v = btn.parentElement.querySelector('video');
      const doiIcon = () => {
        btn.querySelector('.ico-play').toggleAttribute('hidden', !v.paused);
        btn.querySelector('.ico-pause').toggleAttribute('hidden', v.paused);
        btn.classList.toggle('dang-phat', !v.paused);
      };
      const bat = () => {
        // CÓ TIẾNG. Đặt tường minh chứ không dựa vào mặc định: file mẫu có sẵn
        // audio (aac stereo 44.1kHz — đã đo bằng ffprobe), nhưng bản trước đặt
        // `muted` để rê chuột tự phát, nên xem mẫu mà không nghe được gì.
        v.muted = false;
        v.volume = 1;
        // Dừng mọi video khác trước: hai video cùng chạy là hai tiếng chồng nhau.
        box.querySelectorAll('video').forEach((k) => { if (k !== v) { k.pause(); } });
        box.querySelectorAll('.tpl-phat').forEach((b) => {
          if (b !== btn) {
            b.querySelector('.ico-play').removeAttribute('hidden');
            b.querySelector('.ico-pause').setAttribute('hidden', '');
            b.classList.remove('dang-phat');
          }
        });
        if (v.paused) v.play(); else v.pause();
      };
      btn.onclick = bat;
      v.onclick = bat;
      v.addEventListener('play', doiIcon);
      v.addEventListener('pause', doiIcon);

      /* ── Xem to: mở video ra một lớp phủ chiếm gần hết màn hình ──────────
         Dựng lớp phủ MỖI LẦN MỞ rồi bỏ đi khi đóng, không giữ sẵn một cái ẩn:
         trang Mẫu vẽ lại toàn bộ `box.innerHTML` mỗi lần đổi khổ, nên một nút
         nào đó còn trỏ vào lớp phủ của lượt vẽ trước là trỏ vào DOM đã rời cây.

         Video trong lớp phủ là một thẻ <video> RIÊNG chứ không mượn thẻ của
         ô nhỏ: di chuyển thẻ đang phát sang chỗ khác trong DOM thì Chromium
         dừng phát và tải lại từ đầu. Chép `currentTime` sang là xem tiếp đúng
         chỗ đang dở. */
      const to = btn.parentElement.querySelector('.tpl-to');
      if (to) {
        to.onclick = (e) => {
          e.stopPropagation();          // đừng lọt xuống nút phát bên dưới
          v.pause();
          const den = document.createElement('div');
          den.className = 'tpl-den';
          den.innerHTML = '<div class="tpl-den-hop">'
            + '<video class="tpl-den-video" controls autoplay playsinline></video>'
            + '<button class="tpl-den-x" type="button" aria-label="Đóng">×</button>'
            + '</div>';
          const vt = den.querySelector('.tpl-den-video');
          vt.src = v.currentSrc || v.src;
          vt.currentTime = v.currentTime;
          vt.muted = false;
          const dong = () => {
            vt.pause();
            den.remove();
            document.removeEventListener('keydown', phim);
          };
          const phim = (k) => { if (k.key === 'Escape') dong(); };
          den.querySelector('.tpl-den-x').onclick = dong;
          /* Bấm ra NỀN ĐEN thì đóng, bấm trúng video thì không — người dùng
             kéo thanh thời gian mà chuột nhả ra ngoài khung là đóng oan. */
          den.onclick = (k) => { if (k.target === den) dong(); };
          document.addEventListener('keydown', phim);
          document.body.appendChild(den);
        };
      }

      const loa = btn.parentElement.querySelector('.tpl-tieng');
      if (loa) {
        loa.onclick = (e) => {
          e.stopPropagation();      // đừng để lọt xuống nút phát bên dưới
          v.muted = !v.muted;
          loa.querySelector('.ico-loa').toggleAttribute('hidden', v.muted);
          loa.querySelector('.ico-tat').toggleAttribute('hidden', !v.muted);
          loa.classList.toggle('tat', v.muted);
        };
      }
    });

    noiTaoDuAn(box, data);

    box.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.closest('.tpl-the').dataset.id;
        const t = data.templates.find((x) => x.name === id);
        if (!t || !t.prompt) return;
        try {
          await navigator.clipboard.writeText(kemDuongDan(t.prompt, data.workRoot || data.root, t));
          const cu = btn.textContent;
          btn.textContent = 'Đã copy ✓';
          btn.classList.add('xong');
          setTimeout(() => { btn.textContent = cu; btn.classList.remove('xong'); }, 1400);
        } catch {
          btn.textContent = 'Copy lỗi';
        }
      };
    });

    // Mẫu của tôi: xoá (dự án đã tạo từ mẫu là bản chép riêng — không ảnh hưởng).
    box.querySelectorAll('[data-xoa-mau]').forEach((btn) => {
      btn.onclick = async () => {
        const the = btn.closest('.tpl-the');
        const ten = the.dataset.ten || '';
        const dongY = window.__beeHoi ? await window.__beeHoi({ tieuDe: 'Xoá mẫu của tôi?',
          chu: [`Mẫu "${ten}" sẽ bị xoá khỏi máy.`, 'Các dự án đã tạo từ mẫu này giữ bản chép riêng — không hỏng gì.'],
          nutDong: 'Xoá', nguyHiem: true }) : false;
        if (!dongY) return;
        const r = await api.templates.xoaCuaToi(the.dataset.mauId);
        if (!r || !r.ok) { const bao = the.querySelector('.tpl-bao'); if (bao) { bao.hidden = false; bao.textContent = (r && r.loi) || 'Không xoá được.'; bao.classList.add('tpl-bao-loi'); } return; }
        lamMoiMau();
      };
    });

    // ---- Nút "Hướng dẫn chi tiết" ----
    //
    // Sang thẳng bài trong trang Hướng dẫn. Trước đây nó bung một bảng ngay tại
    // trang này; nội dung đó nay là một mục trong bài 'su-dung-app'.
    const nutMo = box.querySelector('[data-mo-hd]');
    if (nutMo) nutMo.onclick = () => moHuongDan('su-dung-app');

    /* Ba handler cũ (`data-copy-duong`, `data-video-hd`, `data-xem-goi`) đã bỏ
       cùng bảng hướng dẫn tại chỗ — không còn phần tử nào mang các thuộc tính đó.
       Nút mở video hướng dẫn nay nằm trong bài 'su-dung-app' (guide.js), dùng
       chung đường `data-ngoai` của trang Hướng dẫn. */
  }

  const tien = (n) => Number(n).toLocaleString('vi-VN');

  /* napGoi()/veGoi() đã bỏ cùng với trang #page-upgrade — nội dung của
     chúng nay nằm ở cột phải trang thanh toán (checkout.js). */
  function boot() {
    if (!api || !api.templates) return;
    // CHỈ thêm ở trang chính. Lớp phủ xem slide/video dùng chung file này qua
    // app-bar, thêm thanh điều hướng ở đó là hiện hai thanh chồng nhau.
    if (!document.querySelector('.dashboard-shell')) return;
    style();
    const shell = document.querySelector('.dashboard-shell');
    const idTrang = [...Object.keys(TRANG_MAU).map((k) => `page-${k}`), 'page-thanhtoan', 'page-huongdan'];
    for (const id of idTrang) {
      const page = document.createElement('div');
      page.id = id;
      /* ⚠ CSS kho mẫu bám vào LỚP `.trang-mau`, không bám id nữa — hai trang
         dùng chung một bộ 104 luật. Quên lớp này là trang hiện ra trần trụi,
         không lỗi nào báo. */
      if (TRANG_MAU[id.slice('page-'.length)]) page.className = 'trang-mau';
      page.hidden = true;
      shell.after(page);
    }
    buildNav();
    moTrang('render');
    // Cho popup tài khoản gọi sang được trang Nâng cấp.
    /* `moDuAnVuaTao` lộ ra để hộp tạo dự án video (`render/du-an-video.js`) dùng lại.
       ⚠ Đừng viết bản thứ hai ở bên đó: hàm này mang cái vá của Phase 0 cho một
       cuộc đua thật — bộ theo dõi thư mục cũng gọi `lamMoiDanhSach()`, lượt của
       nó và lượt của mình chèn nhau nên chốt `lanNap` vứt mất một cái, và dự án
       vừa tạo KHÔNG được chọn. Phải dò `projectMap` tối đa 8 nhịp × 500 ms. */
    window.__beePages = { moTrang, moHuongDan, moDuAnVuaTao, lamMoiMau };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
