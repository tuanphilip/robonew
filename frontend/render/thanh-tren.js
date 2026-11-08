'use strict';
/**
 * THANH TRÊN CÙNG của trang biên tập.
 *
 * Giữa: tên deck đang mở. Phải: trạng thái lưu · Dự án mới · trợ giúp · Tạo video · menu ⋯
 *
 * Thanh chia ĐÚNG hai phần theo cột bên dưới: khối logo rộng bằng thanh dọc +
 * cột danh sách dự án, phần còn lại của tên deck và cụm nút (xem `bien-tap.css`).
 *
 * ── Những gì đã bỏ / đổi chỗ ─────────────────────────────────────────────
 *
 * · **Chuông thông báo** — bấm vào chỉ hiện "chưa có thông báo nào". Gỡ hẳn.
 * · **Nút đổi nền sáng/tối** — vào menu ⋯, cùng "Thư mục nguồn" và "Dọn tệp
 *   dựng dở". Ba việc này đều làm THƯA, để ngoài thì chiếm chỗ của hai nút
 *   dùng liên tục. ⚠ Gỡ `[data-theme-toggle]` thì phải sửa `login.js`: cụm đổi
 *   nền trong popup tài khoản BẤM HỘ nút đó, mà nó có `if (nut)` nên chết lặng.
 * · **Hàng tiêu đề của sân khấu** — tên deck đã ở đây rồi, lặp lần hai ngay
 *   dưới là thừa. Nút tắt tiếng chuyển lên đây; nút "Dựng lại" bỏ hẳn vì thư
 *   mục deck có bộ theo dõi, AI sửa xong là khung tự nạp lại.
 * · **Nút "Xem trước"** (giấu hai cột để phóng khung deck ra cả cửa sổ) — gỡ
 *   16/09/2026 theo yêu cầu: khung deck đã chiếm nguyên cột giữa và có sẵn
 *   thanh phóng to ở dưới, nên nút này chỉ đổi lấy việc mất cả hai cột kia.
 *   Gỡ theo: `datToanManHinh()`, phím Esc của nó, và luật `.bt-toan-man`
 *   trong `bien-tap.css`.
 *
 * · **Cây bút đổi tên deck** — ảnh mẫu có, ban đầu app KHÔNG có đường nào để
 *   làm, nên tôi bỏ. Nay đã dựng thật: `project:rename` ở `ipc/projects.js`.
 *   ⚠ Nó đổi cả BỐN tệp trong `output/` mang tên deck (`.mp4` `.srt`
 *   `.chuong.txt` `.info.json`) — `timVideo()` chỉ tìm `<tên thư mục>.mp4` nên
 *   đổi mỗi thư mục là video đang nằm đó bỗng "chưa render".
 *
 * ⚠ **"Tạo video" KHÔNG dựng lại nút render.** Nó bấm hộ `#startRender` — nút
 * thật nằm trong form `.render-machine` (tab "Cài đặt"), nơi `jobs.js` gắn toàn
 * bộ trình xử lý. Dựng một nút thứ hai là hai đường vào một việc, sớm muộn lệch
 * nhau. Trạng thái bật/tắt cũng soi theo nút thật.
 */
(function () {
  const RP = (window.__renderPage = window.__renderPage || {});
  const $ = (s) => document.querySelector(s);

  let hen = null;

  /** "vừa xong" → "N phút trước" → "N giờ trước". */
  function moTaLuc(luc) {
    if (!luc) return '';
    const giay = Math.max(0, Math.round((Date.now() - luc) / 1000));
    if (giay < 45) return 'Đã lưu vừa xong';
    const phut = Math.round(giay / 60);
    if (phut < 60) return `Đã lưu ${phut} phút trước`;
    return `Đã lưu ${Math.round(phut / 60)} giờ trước`;
  }

  function veTrangThaiLuu() {
    const el = $('#tbLuu');
    if (!el) return;
    const luc = RP.bangSua && RP.bangSua.lucLuuCuoi ? RP.bangSua.lucLuuCuoi() : 0;
    const chu = moTaLuc(luc);
    el.hidden = !chu;
    const o = el.querySelector('[data-chu]');
    if (o) o.textContent = chu;
  }

  /* ⚠ HAI NÚT "Hoàn tác" / "Làm lại" ĐÃ GỠ 16/09/2026 theo yêu cầu.
     Bộ nhớ hoàn tác trong `bang-sua.js` (`hoanTac`/`lamLai`/`coHoanTac`/
     `coLamLai`, ngăn xếp 30 bước) VẪN CÒN nhưng nay KHÔNG CÒN ĐƯỜNG NÀO GỌI
     TỚI — không có phím tắt nào nối vào. Ai muốn bỏ nốt thì gỡ cả cụm đó,
     đừng gỡ nửa vời. */
  function veNutSua() {}

  /**
   * Nút "Tạo video" trên thanh — từ 16/09/2026 nó MỞ HỘP THOẠI, không dựng
   * ngay, nên KHÔNG khoá theo `#startRender` nữa.
   *
   * Trước đây nó khoá khi nút render thật khoá. Nay khoá là chặn luôn đường
   * vào phần "Tuỳ chỉnh video" — mà người dùng có quyền mở ra xem/chỉnh trước
   * khi mọi thứ sẵn sàng. Trạng thái "chưa dựng được" do CHÍNH nút thật trong
   * hộp thể hiện (nó vẫn khoá), kèm dòng trạng thái ngay trên nó.
   */
  /* DỰ ÁN ĐANG CHỌN có phải dự án video trống không — đọc sổ dự án, KHÔNG đọc RP.dung: kho trình dựng chỉ
     đổi sau khi khung xem deck mới nạp xong (vài giây), trong lúc đó nút trên cùng còn mang chế độ của
     dự án TRƯỚC — bấm "Xuất video" là xuất nhầm dự án cũ, tốn một lượt (rà 16/10/2026). */
  const laDuAnVideoDangChon = () => {
    const ten = RP.state && RP.state.project;
    const p = ten && RP.projectMap ? RP.projectMap.get(ten) : null;
    return !!(p && p.loai === 'video');
  };

  function veNutTao() {
    const that = $('#startRender');
    const nut = $('#tbTaoVideo');
    if (!nut) return;
    nut.disabled = false;

    /* ĐANG DỰNG NGẦM THÌ NÚT NÀY PHẢI NÓI RA.
       Đóng hộp Tạo video KHÔNG dừng lượt dựng — main vẫn chạy tiếp. Nhưng
       trước đây nút trên thanh vẫn ghi "Tạo video" với icon play, nên đóng hộp
       xong là mất sạch dấu hiệu máy đang làm việc; người dùng tưởng mình vừa
       huỷ mất. Chủ dự án yêu cầu 19/09/2026: icon xoay + chữ "Đang tạo video"
       + một vệt sáng chạy qua nút.
       ⚠ KHÔNG đẻ cờ mới. Nguồn sự thật vẫn là `state.busy` của `jobs.js`, và
       `capNhatNutDung()` gọi sang đây mỗi lần trạng thái đổi — hai đường vào
       cùng một việc thì sớm muộn lệch nhau. */
    const dangDung = !!(RP.state && RP.state.busy);
    // Dự án VIDEO TRỐNG: không slide / giọng — nút này XUẤT timeline (du-an-video.js).
    const laVideo = laDuAnVideoDangChon();
    nut.classList.toggle('dang-dung', dangDung);
    const ico = nut.querySelector('[data-icon]');
    const chu = nut.querySelector('[data-chu]');
    if (ico) ico.dataset.icon = dangDung ? 'refresh' : 'play';
    if (chu) chu.textContent = laVideo ? (dangDung ? 'Đang xuất video' : 'Xuất video') : (dangDung ? 'Đang tạo video' : 'Tạo video');
    /* ⚠ `data-icon` chỉ là chỗ đánh dấu. Đổi tên xong PHẢI gọi lại `apply()`,
       không thì ruột svg vẫn là icon cũ và không lỗi nào báo. */
    if (window.__beeIcons) window.__beeIcons.apply(nut);

    nut.title = laVideo ? (dangDung ? 'Đang xuất video' : 'Xuất timeline ra output/<tên dự án>.mp4 — tính một lượt tạo video')
      : dangDung
      ? 'Đang tạo video — bấm để mở lại bảng tiến trình'
      : (that && that.disabled
        ? 'Mở bảng tuỳ chỉnh video — chọn tốc độ đọc và độ phân giải'
        : 'Tạo video');
  }

  function veTen(ten, khung) {
    /* Gọi từ `deckCau.nghe` (deck nạp xong) KHÔNG kèm khổ — tra lại trong sổ dự án. Thiếu bước này
       thì deck NGANG bị đổi về icon dọc ngay khi khung xem nạp xong (bắt gặp 12/10/2026). */
    if (khung === undefined && ten && RP.projectMap && RP.projectMap.get(ten)) khung = RP.projectMap.get(ten).khung;
    const el = $('#tbTenDeck');
    // Bộ slide phụ `cha::id` (GĐ3.7) — hiện "cha › Bộ slide N", không hiện tên nội bộ.
    const bo = /^(.+?)::b?([a-z0-9-]+)$/.exec(String(ten || ''));
    if (el) el.textContent = bo ? `${bo[1]} › Bộ slide ${bo[2]}` : (ten || 'Chưa chọn dự án');
    /* Nhãn khổ: HIỆN CẢ HAI, bằng icon. Trước chỉ deck ngang mới có chữ
       "16:9", nên deck dọc không có dấu hiệu nào — mà đó mới là đa số, và
       người dùng cần phân biệt được hai loại ngay từ cái nhìn đầu. */
    const k = $('#tbKhung');
    if (k) {
      k.hidden = !ten;
      const ngang = khung === 'ngang';
      k.title = ngang
        ? 'Bài giảng ngang 16:9 — dựng ra video 1920x1080'
        : 'Video ngắn dọc 9:16 — dựng ra video 1080x1920';
      k.classList.toggle('nhan-ngang', ngang);
      k.classList.toggle('nhan-doc', !ngang);
      k.innerHTML = `<span class="btn-icon" data-icon="${ngang ? 'bangngang' : 'dienthoai'}"></span>`;
      /* ⚠ PHẢI gọi lại `apply()`: `data-icon` chỉ là chỗ đánh dấu, script icon
         chạy một lượt lúc nạp trang. Quên là ô rỗng, không lỗi nào báo. */
      if (window.__beeIcons) window.__beeIcons.apply(k);
    }
    const b = $('#tbSuaTen');
    // Bộ slide phụ không đổi tên (đi theo dự án mẹ — rà 3.7): ẩn bút.
    if (b) b.hidden = !ten || !!bo;
    veNutVideo(ten);
  }

  /** Hai nút video trên thanh: chỉ khi có deck VÀ deck đã có video (thanh-phat.js gọi
      lại sau khi đọc xong `video:info` — lúc `veTen` chạy thì chưa biết). */
  function veNutVideo(ten) {
    // Không đọc chữ hiển thị ("cha › Bộ slide 2" với bộ phụ) — tên thật của dự án đang chọn (rà 3.7).
    const deck = ten !== undefined ? ten : ((RP.state && RP.state.project) || '');
    /* Dự án video trống: "có video" = ĐÃ XUẤT (thanhPhat.coVideo() là nền đen của trình dựng, lúc nào cũng có). */
    const pj = deck && RP.projectMap ? RP.projectMap.get(deck) : null;
    const laVideo = !!(pj && pj.loai === 'video');
    /* Deck thường: tin thanh phát CHỈ khi thông tin video của nó là của đúng deck này — đang đổi deck thì
       nó còn giữ video của deck trước (rà 16/10/2026). */
    const co = !!deck && deck !== 'Chưa chọn dự án' && (laVideo ? !!(pj && pj.has_output)
      : !!(RP.thanhPhat && (RP.thanhPhat.coVideoCua ? RP.thanhPhat.coVideoCua(deck) : RP.thanhPhat.coVideo())));
    const tt = $('#tbThongTin');
    const tm = $('#tbThuMuc');
    if (tt) { tt.hidden = !co; tt.dataset.project = co ? deck : ''; }
    if (tm) tm.hidden = !co;
  }

  /**
   * Đổi tên dự án — sửa ngay tại chỗ, Enter để lưu, Esc để bỏ.
   *
   * ⚠ ĐÓNG BẢN XEM TRƯỚC TRƯỚC KHI ĐỔI. Khung giữ `_preview.html` mở và watcher
   * giữ một tay cầm vào thư mục; Windows từ chối đổi tên thư mục đang bị giữ.
   * Đổi xong mới mở lại deck theo tên mới.
   */
  async function suaTen() {
    const el = $('#tbTenDeck');
    const cu = RP.deckCau ? RP.deckCau.deck() : '';
    if (!el || !cu || el.isContentEditable) return;
    el.contentEditable = 'plaintext-only';
    el.classList.add('dang-sua');
    el.focus();
    document.getSelection().selectAllChildren(el);
    const xong = async (luu) => {
      el.contentEditable = 'false';
      el.classList.remove('dang-sua');
      const moi = (el.textContent || '').trim();
      if (!luu || !moi || moi === cu) { el.textContent = cu; return; }
      el.textContent = 'Đang đổi tên…';
      if (RP.sanKhau) RP.sanKhau.dong();     // nhả `_preview.html` + watcher
      await new Promise((r) => setTimeout(r, 120));
      const r = await window.beeknoee.renameProject(cu, moi).catch((e) => ({ error: e.message }));
      if (r && r.error) {
        el.textContent = cu;
        if (RP.setStatus) RP.setStatus(r.error, 'bad');
        if (RP.sanKhau) RP.sanKhau.chonDeck(cu);
        return;
      }
      el.textContent = r.name;
      // Nạp lại danh sách rồi chọn deck theo TÊN MỚI — tên cũ không còn tồn tại.
      if (RP.lamMoiDanhSach) await RP.lamMoiDanhSach();
      if (RP.setSelectedProject) RP.setSelectedProject(r.name);
    };
    el.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); el.textContent = cu; el.blur(); }
    };
    el.onblur = () => { const c = el.textContent; xong(c !== cu); };
  }

  /* ⚠ NÚT "⋯" VÀ MENU CỦA NÓ ĐÃ GỠ 16/09/2026 theo yêu cầu ("nút đấy hiện
     chưa cần"). Ba mục trong đó đều còn đường khác, đừng dựng lại nút chỉ vì
     thấy trống:
       · Đổi nền sáng/tối — cụm nút trong popup tài khoản (xem `login.js`).
       · Thư mục nguồn    — nút thư mục ở hàng công cụ cột danh sách.
       · Dọn tệp dựng dở  — nút "Dọn rác" ngay cạnh nút đó.
     Muốn đưa lại thì lấy nguyên hàm `menu()` ở lịch sử git, nó chỉ bấm hộ ba
     nút thật đó chứ không gọi API riêng. */

  /* ── HỘP DỰ ÁN ──────────────────────────────────────────────────────────
     Thay tab "Dự án" ở cột trái (chủ dự án chốt 03/10/2026): nút "Dự án:" trước
     tên dự án mở danh sách để chuyển dự án.
     ⚠ HỘP CHÍNH LÀ `#paneDuAn` CŨ, không dựng bản thứ hai: nó vẫn nằm trong
     `.slide-list` (giữ mọi luật CSS của danh sách và mọi id mà project-list.js /
     don-rac.js tra), chỉ hiện ra kiểu `position: fixed` dưới nút — xem
     `css/du-an-pop.css`. Ở đây chỉ bật/tắt `hidden` và đặt toạ độ. */
  let deckLucMo = null;

  function datViTriHop(hop, nut) {
    const r = nut.getBoundingClientRect();
    const le = 8;
    const rong = Math.min(440, window.innerWidth - 2 * le);
    hop.style.width = `${rong}px`;
    hop.style.left = `${Math.round(Math.max(le, Math.min(r.left, window.innerWidth - rong - le)))}px`;
    hop.style.top = `${Math.round(r.bottom + 6)}px`;
    hop.style.height = `${Math.round(Math.max(240, Math.min(640, window.innerHeight - r.bottom - 6 - 16)))}px`;
  }

  function ngoaiHop(e) {
    const hop = $('#paneDuAn');
    const nut = $('#tbDuAn');
    if (!hop || hop.hidden) return;
    if (hop.contains(e.target) || (nut && nut.contains(e.target))) return;
    /* Hộp thoại của app mở từ TRONG hộp (xác nhận xoá dự án, Dọn dẹp…) nằm ngoài
       hộp nhưng đang là việc của hộp — bấm trong đó không được đóng hộp. */
    if (e.target.closest && e.target.closest('.ai-hop, #rac-nen')) return;
    dongHopDuAn();
  }
  function phimHop(e) {
    if (e.key !== 'Escape') return;
    const hop = $('#paneDuAn');
    if (!hop || hop.hidden) return;
    if (document.querySelector('.ai-hop, #rac-nen')) return; // Esc là của hộp thoại đang mở bên trên
    dongHopDuAn();
    const nut = $('#tbDuAn');
    if (nut) nut.focus();
  }

  function moHopDuAn() {
    const hop = $('#paneDuAn');
    const nut = $('#tbDuAn');
    if (!hop || !nut) return;
    if (!hop.hidden) { dongHopDuAn(); return; }
    deckLucMo = RP.deckCau ? RP.deckCau.deck() : null;
    hop.hidden = false;
    datViTriHop(hop, nut);
    nut.setAttribute('aria-expanded', 'true');
    nut.classList.add('dang-mo');
    document.addEventListener('mousedown', ngoaiHop, true);
    document.addEventListener('keydown', phimHop);
    window.addEventListener('resize', dongHopDuAn);
    /* Cuộn tới dự án đang chọn, đưa con trỏ vào ô tìm — mở hộp là để tìm/chuyển. */
    const dangChon = hop.querySelector('.project-row.selected');
    if (dangChon) dangChon.scrollIntoView({ block: 'nearest' });
    const tim = hop.querySelector('#timDuAn');
    if (tim) tim.focus();
  }

  function dongHopDuAn() {
    const hop = $('#paneDuAn');
    const nut = $('#tbDuAn');
    if (!hop || hop.hidden) return;
    hop.hidden = true;
    if (nut) { nut.setAttribute('aria-expanded', 'false'); nut.classList.remove('dang-mo'); }
    document.removeEventListener('mousedown', ngoaiHop, true);
    document.removeEventListener('keydown', phimHop);
    window.removeEventListener('resize', dongHopDuAn);
  }

  function noiHopDuAn() {
    const nut = $('#tbDuAn');
    if (nut) nut.onclick = moHopDuAn;
    /* "Dự án mới" (23/10/2026 — trước là nút "Video trống" trong hộp Dự án, trông như bộ lọc): mở hộp tạo dự án của
       render/du-an-video.js. Tra lúc bấm — tệp đó nạp sau tệp này. */
    const moi = $('#tbDuAnMoi');
    if (moi) {
      moi.onclick = () => {
        if (RP.duAnVideo && RP.duAnVideo.moHopTao) RP.duAnVideo.moHopTao();
        else if (RP.setStatus) RP.setStatus('Chưa tạo được dự án — thử lại sau giây lát.', 'bad');
      };
    }
  }

  function dung() {
    const neo = $('.app-bar-phai');
    if (!neo) return;
    neo.insertAdjacentHTML('afterbegin', `
      <span class="tb-luu" id="tbLuu" hidden><span class="btn-icon" data-icon="luu"></span><span data-chu></span></span>
      <button class="tb-nut-phu" id="tbDuAnMoi" type="button" title="Tạo dự án mới — timeline trống: thả ảnh, video, nhạc, chữ rồi xuất (dự án có slide: chọn ở trang Mẫu)">
        <span class="btn-icon" data-icon="duAnMoi"></span><span>Dự án mới</span></button>
      <button class="tb-nut-tron" id="tbTroGiup" type="button" title="Hướng dẫn" aria-label="Hướng dẫn">
        <span class="btn-icon" data-icon="help"></span></button>
      <button class="tb-nut-chinh" id="tbTaoVideo" type="button">
        <span class="btn-icon" data-icon="play"></span><span data-chu>Tạo video</span></button>
`);

    const giua = document.createElement('div');
    giua.className = 'tb-giua';
    giua.innerHTML = '<button class="tb-duan" id="tbDuAn" type="button" aria-haspopup="dialog"'
      + ' aria-expanded="false" aria-controls="paneDuAn" title="Mở danh sách dự án để chuyển dự án">'
      /* Icon DANH SÁCH (Lucide list-video), không phải thư mục: cùng một icon thư mục
         đứng cạnh nút "Mở thư mục chứa video" là hai việc khác nhau trông như một
         (chủ dự án yêu cầu 11/10/2026). */
      + '<span class="btn-icon" data-icon="danhsach"></span><span class="tb-duan-chu">Dự án</span></button>'
      + '<span class="tb-duan-hai" aria-hidden="true">:</span>'
      + '<span class="tb-ten-deck" id="tbTenDeck">Chưa chọn dự án</span>'
      + '<span class="tb-khung" id="tbKhung" hidden></span>'
      + '<button class="tb-nut-tron tb-but" id="tbSuaTen" type="button" hidden'
      + ' title="Đổi tên dự án" aria-label="Đổi tên dự án">'
      + '<span class="btn-icon" data-icon="but"></span></button>'
      /* HAI NÚT VIDEO của dự án đang chọn, ngay cạnh nút đổi tên (chủ dự án yêu cầu
         11/10/2026): dấu ⓘ rê vào hiện bảng thông tin video (trước ở từng dòng của
         danh sách — render-layout.js#dauThongTin vẫn vẽ bảng, nay nghe ở nút này) và
         nút mở thư mục chứa video (trước ở thanh phát dưới khung xem). Chỉ hiện khi
         deck ĐÃ có video — nguồn sự thật là `thanhPhat.coVideo()`, vẽ lại ở `veNutVideo`. */
      + '<button class="tb-nut-tron tb-but tb-vid" id="tbThongTin" type="button" hidden'
      + ' data-thong-tin-video data-project="" title="Thông tin video" aria-label="Thông tin video">'
      + '<span class="btn-icon" data-icon="info"></span></button>'
      + '<button class="tb-nut-tron tb-but tb-vid" id="tbThuMuc" type="button" hidden'
      + ' title="Mở thư mục chứa video" aria-label="Mở thư mục chứa video">'
      + '<span class="btn-icon" data-icon="folder"></span></button>';
    neo.parentElement.insertBefore(giua, neo);

    /* ĐƯA DÒNG THÔNG BÁO LÊN ĐÂY, ngay TRƯỚC nút Hướng dẫn.
       `#renderStatus` khai sẵn trong `index.html` bên trong `.render-machine`;
       trước 20/09/2026 `render-layout.js` dời nó xuống dưới cụm nút ở đáy cột
       phải. Chủ dự án đổi ý: "ở đấy user dễ đọc hơn".
       ⚠ Dời ra khỏi `.render-machine` còn sửa luôn một chuyện âm thầm: form đó
       bị DỜI qua lại giữa tab Âm thanh và hộp Tạo video, nên dòng thông báo
       trước đây đi theo nó — mở hộp Tạo video là câu báo biến khỏi cột phải.
       Nay nó neo vào thanh trên nên đứng yên một chỗ.
       ⚠ Chỉ dời ở ĐÚNG MỘT NƠI. `render-layout.js` đã gỡ phần dời của nó. */
    const oTT = document.getElementById('renderStatus');
    const nutTG = $('#tbTroGiup');
    if (oTT && nutTG && oTT.parentElement !== nutTG.parentElement) {
      nutTG.parentElement.insertBefore(oTT, nutTG);
    }

    $('#tbTroGiup').onclick = () => window.__beePages && window.__beePages.moHuongDan && window.__beePages.moHuongDan('');
    /* MỞ HỘP chọn tốc độ + độ phân giải, không dựng ngay. Nút Tạo video thật
       (`#startRender`) nằm trong hộp — xem `bang-sua.js#moHopTao`. */
    $('#tbTaoVideo').onclick = async () => {
      /* Đang mở BỘ SLIDE PHỤ (GĐ3.7): "Tạo video" là của dự án mẹ — về dự án mẹ trước, để hộp dựng, giọng tải lên,
         tiến trình đều là của nó (rà 3.7). */
      const bo = /^(.+?)::[a-z0-9][a-z0-9-]{0,39}$/.exec(String((RP.state && RP.state.project) || ''));
      if (bo && window.__beePages && window.__beePages.moDuAnVuaTao) {
        await window.__beePages.moDuAnVuaTao(bo[1]);
        await new Promise((r) => setTimeout(r, 700));
      }
      // Dự án video trống: xuất thẳng, không mở hộp chọn giọng đọc / độ phân giải.
      if (laDuAnVideoDangChon() && RP.duAnVideo) { RP.duAnVideo.xuat(); return; }
      if (RP.bangSua && RP.bangSua.moHopTao) RP.bangSua.moHopTao();
      else if ($('#startRender')) $('#startRender').click();
    };
    $('#tbSuaTen').onclick = suaTen;
    // Bấm hộ `#revealOutput` trong form dựng — cùng lối với hộp "Tạo video" (bang-sua.js).
    $('#tbThuMuc').onclick = () => { const r = $('#revealOutput'); if (r) r.click(); };
    noiHopDuAn();
    /* Tắt tiếng: bấm hộ `#muteBtn` BÊN TRONG khung. KHÔNG tự đặt `video.muted`
       — deck có engine tiếng riêng (nhạc nền, tiếng chuyển slide), chỉ nút của
       nó mới tắt được hết. Bộ nút của deck bị ẩn vì nằm đè lên hình. */

    if (window.__beeIcons) window.__beeIcons.apply(neo.parentElement);
    if (RP.deckCau) RP.deckCau.nghe((x) => {
      veTen(x.deck); veNutSua(); veTrangThaiLuu();
      /* Chọn xong một dự án trong hộp thì hộp tự đóng — đúng việc người dùng mở nó ra. */
      if (x.deck !== deckLucMo) dongHopDuAn();
    });
    // Nhịp chậm: chỉ để đổi "vừa xong" → "N phút trước", và soi lại nút render.
    hen = setInterval(() => { veTrangThaiLuu(); veNutTao(); veNutSua(); }, 20000);
    veNutTao();
  }

  Object.assign(RP, { thanhTren: { veTrangThaiLuu, veNutSua, veNutTao, veTen, veNutVideo, dung, moHopDuAn, dongHopDuAn } });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dung);
  else dung();
})();
