'use strict';
/**
 * Hộp thoại "Dọn tệp dựng dở" — lấy lại chỗ trong thư mục nguồn.
 *
 * VÌ SAO CÓ MÀN HÌNH NÀY (đo 12/09/2026 trên thư mục nguồn thật):
 * 55 deck · 2.565 tệp · 2.336,6 MB, trong đó `output/` chiếm 1.914,3 MB mà chỉ
 * 1.285,6 MB là video thành phẩm. Phần còn lại là tệp dựng xong không ai xoá —
 * **454,9 MB** lấy lại được mà không mất gì. Nhịp tháng 9: +126 MB mỗi ngày.
 * Trong app trước đây KHÔNG có đường nào dọn; người dùng phải tự mò vào thư mục.
 *
 * ⚠ VÌ SAO KHÔNG HIỆN MỘT CON SỐ TỔNG Ở GÓC MÀN HÌNH (hướng đã cân nhắc rồi bỏ):
 * góc dưới phải đã đặc tới 58px (số hiệu bản ở `bottom 8`, nút "?" ở `bottom 32`,
 * hai bảng bung ở `bottom 64/66`) — xem `version-badge.css`. Và quan trọng hơn:
 * một con số tổng không dẫn tới hành động nào. Người dùng cần cái NÚT, còn con
 * số thì để ngay cạnh nút ấy là đủ.
 *
 * ⚠ VÌ SAO KHÔNG HIỆN MB Ở TỪNG HÀNG DỰ ÁN: `listProjects()` chạy lại mỗi lần
 * watcher báo thư mục nguồn đổi (hãm 1,5 giây lúc AI đang dựng deck). Quét
 * dung lượng cả cây mất 139 ms lần đầu — nhét vào nhịp đó là chặn tiến trình
 * chính ~10% thời gian suốt lúc dựng deck. Nên số theo deck nằm TRONG hộp
 * thoại này, chỗ nó có nghĩa và chỉ tính khi người dùng mở ra.
 */
(() => {
  const api = window.beeknoee;
  if (!api || !api.projects || !api.projects.scanRac) return;

  let nen = null;
  let dangQuet = false;
  let kqQuet = null;          // kết quả quét của hộp đang mở — lấy `root` gửi kèm lúc xoá deck cũ

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /**
   * Byte → chữ đọc được.
   *
   * Ba bậc chứ không phải một: thư mục nguồn thật của chủ dự án đang 2,3 GB, mà
   * để một bậc MB thì nó in ra "2336.4 MB" — đúng số nhưng phải đếm chữ số mới
   * biết là bao nhiêu. Dưới 0,1 MB thì xuống KB cho khỏi ra "0.0 MB".
   */
  const co = (b) => {
    const n = Number(b) || 0;
    if (n < 102400) return `${Math.round(n / 1024)} KB`;
    if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
    return `${(n / 1073741824).toFixed(2)} GB`;
  };

  function phimThoat(e) {
    if (e.key === 'Escape') dong();
  }

  function dong() {
    if (!nen) return;
    /* ⚠ GỠ TAY NGHE PHÍM Ở ĐÂY, đừng gỡ bên trong chính nó: hộp còn đóng được
       bằng nút "Đóng" và bằng cách bấm ra nền, hai đường đó không hề đi qua
       phím Escape. Trước 13/09/2026 tay nghe chỉ tự gỡ khi có người bấm
       Escape, nên mở rồi đóng bằng chuột mười lần là mười tay nghe nằm lại
       trên `document` cho tới lúc tải lại trang. */
    document.removeEventListener('keydown', phimThoat);
    nen.remove();
    nen = null;
  }

  function veNhom(nhom) {
    if (!nhom.length) return '<p class="rac-trong">Không tìm thấy tệp dựng dở nào. Thư mục đang sạch.</p>';
    return nhom.map((n) => `
      <label class="rac-nhom${n.soTep ? '' : ' rac-rong'}">
        <input type="checkbox" value="${esc(n.ma)}" ${n.macDinh && n.soTep ? 'checked' : ''} ${n.soTep ? '' : 'disabled'} />
        <span class="rac-than">
          <span class="rac-dong1">
            <b>${esc(n.ten)}</b>
            <span class="rac-so">${n.soTep ? `${n.soTep} tệp · ${co(n.byte)}` : 'không có'}</span>
          </span>
          <span class="rac-mo">${esc(n.mo)}</span>
          ${n.canhBao ? `<span class="rac-canh">${esc(n.canhBao)}</span>` : ''}
          ${n.viDu && n.viDu.length ? `<details class="rac-xem"><summary>Xem tệp sẽ xoá</summary><pre>${esc(n.viDu.join('\n'))}${n.soTep > n.viDu.length ? `\n… và ${n.soTep - n.viDu.length} tệp nữa` : ''}</pre></details>` : ''}
        </span>
      </label>`).join('');
  }

  /** Nhóm "Deck cũ đã có video" — ô chọn số ngày nằm TRONG thẻ, số liệu tính lại khi đổi ngày. */
  function veDeckCu(ds, moc) {
    if (!ds || !ds.length || !moc || !moc.length) return '';
    const macDinh = moc.includes(30) ? 30 : moc[0];
    return `
      <label class="rac-nhom rac-deck-cu">
        <input type="checkbox" value="__deckCu" />
        <span class="rac-than">
          <span class="rac-dong1"><b>Deck cũ đã có video</b><span class="rac-so" id="racDeckSo"></span></span>
          <span class="rac-mo">Deck đã dựng xong video và không sửa, không dựng lại từ
            <select id="racNgay">${moc.map((n) => `<option value="${n}"${n === macDinh ? ' selected' : ''}>${n}</option>`).join('')}</select>
            ngày trở lên. Xoá <b>cả thư mục deck</b>: slide, script, giọng đọc và video.</span>
          <span class="rac-canh">Thư mục được chuyển vào Thùng rác nên vẫn khôi phục được — ổ đĩa chỉ trống ra khi bạn dọn Thùng rác (ổ USB, ổ mạng không có Thùng rác thì Windows xoá hẳn). Tải video về hoặc đăng xong rồi hãy xoá. Giữ lại: deck đang chọn, deck đang chờ dựng, deck mẫu đi kèm app.</span>
          <details class="rac-xem"><summary>Xem deck sẽ xoá</summary><pre id="racDeckDs"></pre></details>
        </span>
      </label>`;
  }

  /** Đổi số ngày ⇒ tính lại danh sách + dung lượng của nhóm deck cũ. Tên hiện ra được nhớ lại để
      gửi xuống lúc xoá — bên chính chỉ xoá trong đúng danh sách này. */
  let tenDeckCuDaHien = [];
  function capNhatDeckCu(ds) {
    if (!nen) return;
    const o = nen.querySelector('.rac-deck-cu input');
    const chon = nen.querySelector('#racNgay');
    if (!o || !chon) return;
    const ngay = Number(chon.value);
    // Deck đang chọn thì không bao giờ vào danh sách: người dùng đang nhìn nó.
    const dangChon = window.__renderPage?.state?.project || '';
    const loc = ds.filter((d) => d.ngay >= ngay && d.ten !== dangChon).sort((a, b) => b.ngay - a.ngay);
    tenDeckCuDaHien = loc.map((d) => d.ten);
    const tong = loc.reduce((a, d) => a + d.byte, 0);
    o.dataset.byte = tong;
    o.disabled = !loc.length;
    if (!loc.length) o.checked = false;
    nen.querySelector('.rac-deck-cu').classList.toggle('rac-rong', !loc.length);
    nen.querySelector('#racDeckSo').textContent = loc.length ? `${loc.length} deck · ${co(tong)}` : 'không có';
    nen.querySelector('#racDeckDs').textContent = loc.length
      ? loc.map((d) => `${String(d.ngay).padStart(3)} ngày  ${co(d.byte).padStart(9)}  ${d.ten}`).join('\n')
      : 'Không deck nào đủ điều kiện.';
    capNhatNut();
  }

  function veDeck(deck) {
    const co5 = deck.filter((d) => d.rac > 0).slice(0, 5);
    if (!co5.length) return '';
    return `<details class="rac-xem rac-deck"><summary>Deck nào đang nặng nhất</summary><pre>${
      esc(co5.map((d) => `${co(d.byte).padStart(9)}  (dọn được ${co(d.rac)})  ${d.ten}`).join('\n'))
    }</pre></details>`;
  }

  function capNhatNut() {
    if (!nen) return;
    const chon = [...nen.querySelectorAll('.rac-nhom input:checked')];
    const nut = nen.querySelector('#rac-don');
    const tong = chon.reduce((a, o) => a + Number(o.dataset.byte || 0), 0);
    nut.disabled = !chon.length;
    nut.textContent = chon.length ? `Dọn ${co(tong)}` : 'Chưa chọn gì';
  }

  async function moHop(nutMo) {
    if (dangQuet) return;
    dangQuet = true;
    if (nutMo) nutMo.disabled = true;
    let kq = null;
    let loi = '';
    try {
      kq = await api.projects.scanRac();
    } catch (e) {
      loi = (e && e.message) || 'Không quét được thư mục nguồn.';
    }
    /* Chưa chọn thư mục làm việc thì KHÔNG được báo "thư mục đang sạch" —
       câu đó nói rằng app đã tìm và không có gì, trong khi thật ra nó chưa có
       chỗ nào để tìm. Hai tình huống khác hẳn nhau. */
    if (!loi && kq && kq.chuaCoKho) {
      loi = 'Chưa chọn thư mục làm việc. Chọn ở nút "Nguồn" rồi mở lại.';
    }
    dangQuet = false;
    if (nutMo) nutMo.disabled = false;

    kqQuet = kq;
    const nhom = (kq && kq.nhom) || [];
    const tongDon = nhom.reduce((a, n) => a + n.byte, 0);

    nen = document.createElement('div');
    nen.id = 'rac-nen';
    nen.innerHTML = `
      <div id="rac-hop" role="dialog" aria-modal="true" aria-labelledby="rac-tieu">
        <h2 id="rac-tieu">Dọn dẹp</h2>
        ${loi ? `<p class="rac-loi">${esc(loi)}</p>` : `
        <p class="rac-phu">Thư mục nguồn đang chiếm <b>${co(kq.tongCaThuMuc)}</b>${
          tongDon ? `, trong đó <b>${co(tongDon)}</b> là tệp dựng dở.` : '.'}</p>
        <p class="rac-phu rac-giu">Các nhóm tệp bên dưới không đụng tới video thành phẩm, khoá căn chỉnh và hồ sơ video — chỉ nhóm <b>Deck cũ đã có video</b> mới xoá cả thư mục deck.</p>
        <div class="rac-ds">${veNhom(nhom)}${veDeckCu(kq.deckCu, kq.mocNgayDeckCu)}</div>
        ${veDeck((kq && kq.deck) || [])}`}
        <div class="rac-ketqua" id="rac-ketqua"></div>
        <div class="rac-nut">
          <button type="button" id="rac-dong">Đóng</button>
          ${loi ? '' : '<button type="button" class="chinh" id="rac-don">Chưa chọn gì</button>'}
        </div>
      </div>`;

    nen.addEventListener('click', (e) => { if (e.target === nen) dong(); });
    nen.querySelector('#rac-dong').addEventListener('click', dong);
    document.addEventListener('keydown', phimThoat);

    if (!loi) {
      nen.querySelectorAll('.rac-nhom input').forEach((o) => {
        if (o.value === '__deckCu') { o.addEventListener('change', capNhatNut); return; }
        const n = nhom.find((x) => x.ma === o.value);
        o.dataset.byte = n ? n.byte : 0;
        o.addEventListener('change', capNhatNut);
      });
      const chonNgay = nen.querySelector('#racNgay');
      if (chonNgay) {
        // <select> là nội dung tương tác nên bấm vào nó KHÔNG bật/tắt ô tick của <label> bọc ngoài.
        chonNgay.addEventListener('change', () => capNhatDeckCu(kq.deckCu || []));
        capNhatDeckCu(kq.deckCu || []);
      }
      nen.querySelector('#rac-don').addEventListener('click', chayDon);
    }

    document.body.appendChild(nen);
    if (!loi) capNhatNut();
    nen.querySelector('#rac-dong').focus();
  }

  async function chayDon() {
    const nut = nen.querySelector('#rac-don');
    const oKq = nen.querySelector('#rac-ketqua');
    const daTick = [...nen.querySelectorAll('.rac-nhom input:checked')];
    if (!daTick.length) return;
    const oDeck = daTick.find((o) => o.value === '__deckCu');
    const ma = daTick.filter((o) => o !== oDeck).map((o) => o.value);
    const ngayCu = oDeck ? Number(nen.querySelector('#racNgay').value) : 0;
    /* Hỏi lại một lần nữa, và nói ĐÚNG con số sắp mất. Tệp dựng dở bị xoá THẲNG (không hoàn lại);
       deck cũ thì vào Thùng rác — hai cách khác nhau nên nói tách hai câu. */
    const tongTep = daTick.filter((o) => o !== oDeck).reduce((a, o) => a + Number(o.dataset.byte || 0), 0);
    const cau = [];
    if (ma.length) cau.push(`• Xoá thẳng ${co(tongTep)} tệp dựng dở — không vào Thùng rác, không hoàn lại được.`);
    if (oDeck) {
      const soDeck = nen.querySelector('#racDeckSo').textContent;
      cau.push(`• Chuyển ${soDeck} (không dùng từ ${ngayCu} ngày) vào Thùng rác — CẢ thư mục: slide, script, giọng đọc, video.`);
    }
    if (!window.confirm(`Dọn dẹp?\n\n${cau.join('\n')}`)) return;

    nut.disabled = true;
    nut.textContent = 'Đang dọn…';
    oKq.className = 'rac-ketqua';
    oKq.textContent = '';
    try {
      const r = await api.projects.runRac(ma, oDeck
        ? { deckCuNgay: ngayCu, deckCuTen: tenDeckCuDaHien, root: kqQuet && kqQuet.root }
        : {});
      oKq.className = 'rac-ketqua tot';
      const ketQua = [];
      if (r.soTep) ketQua.push(`đã dọn ${r.soTep} tệp (${co(r.byte)})`);
      if (r.soDeck) ketQua.push(`đã chuyển ${r.soDeck} deck vào Thùng rác (${co(r.byteDeck)})`);
      // Ít hơn số đã hiện = có deck vừa được mở sửa / xếp dựng sau lúc quét — bên chính đã giữ lại.
      if (oDeck && r.soDeck < tenDeckCuDaHien.length && !(r.hong && r.hong.length)) {
        ketQua.push(`giữ lại ${tenDeckCuDaHien.length - r.soDeck} deck vừa được dùng tới`);
      }
      oKq.textContent = ketQua.length ? `Xong: ${ketQua.join(', ')}.` : 'Không có gì để dọn.';
      if (r.hong && r.hong.length) {
        oKq.className = 'rac-ketqua xau';
        oKq.textContent += ` ${r.hong.length} mục không xoá được (đang bị chương trình khác giữ).`;
      }
      /* Danh sách dự án đổi — nạp lại. Deck ĐANG CHỌN vừa bị dọn thì chuyển sang deck khác, không để
         bảng phải ghi "Dự án đang chọn" là một deck không còn nữa (cùng cách RP.xoaDuAn xử lý). */
      try {
        const RP = window.__renderPage;
        if (RP && RP.lamMoiDanhSach) {
          await RP.lamMoiDanhSach();
          if (r.soDeck && RP.state.project && !RP.projectMap.has(RP.state.project)) {
            RP.state.project = null;
            RP.state.outputUrl = null;
            if (RP.projects[0]) RP.setSelectedProject(RP.projects[0].name, false);
          }
        }
      } catch { /* không có thì thôi */ }
      capNhatDungLuong();
      nut.remove();
    } catch (e) {
      oKq.className = 'rac-ketqua xau';
      oKq.textContent = (e && e.message) || 'Không dọn được.';
      nut.disabled = false;
      capNhatNut();
    }
  }

  /* ══ TỔNG DUNG LƯỢNG Ở TIÊU ĐỀ DANH SÁCH ═══════════════════════════════
   *
   * `Danh sách dự án (55 · 2.28 GB)`.
   *
   * ⚠ NHỊP CHẠY LÀ PHẦN QUAN TRỌNG NHẤT Ở ĐÂY. Quét cả cây mất 139 ms lần đầu
   * (34 ms những lần sau) và chạy trên TIẾN TRÌNH CHÍNH. Chỗ vẽ số đếm
   * (`project-list.js`) chạy lại mỗi lần bảng đổi — kể cả do watcher, mà
   * watcher bắn liên tục lúc AI dựng deck (hãm 1,5 giây). Gắn vào đó là chặn
   * tiến trình chính ~10% thời gian suốt lúc dựng deck.
   *
   * Nên số này chỉ tính ở BỐN nhịp do người dùng gây ra, tất cả nằm trong
   * module này để sau có bỏ thì bỏ gọn một chỗ:
   *   1. lúc mở app (chậm 1,5 giây, nhường màn hình đầu tiên vẽ xong)
   *   2. bấm "Làm mới"
   *   3. dọn rác xong
   *   4. tạo xong một video (deck vừa phình thêm)
   *
   * ⚠ BỎ QUA khi đang dựng video. Bộ ghi hình chạy THỜI GIAN THỰC; chặn tiến
   * trình chính 139 ms giữa lúc quay là hụt tới 4 khung hình. Thà số cũ vài
   * phút còn hơn một video sứt.
   */
  const oSo = document.querySelector('[data-project-size]');

  async function capNhatDungLuong() {
    if (!oSo) return;
    try {
      const st = await api.render.status();
      if (st && st.running) return;          // đang quay — xem chú thích trên
    } catch { /* không hỏi được thì cứ quét */ }
    try {
      const kq = await api.projects.scanRac();
      oSo.textContent = kq && kq.tongCaThuMuc ? ` · ${co(kq.tongCaThuMuc)}` : '';
    } catch {
      oSo.textContent = '';                  // hỏng thì bỏ trống, đừng để số cũ nói dối
    }
  }

  const nut = document.getElementById('donRac');
  if (nut) nut.addEventListener('click', () => moHop(nut));

  const nutLamMoi = document.getElementById('refreshList');
  if (nutLamMoi) nutLamMoi.addEventListener('click', () => setTimeout(capNhatDungLuong, 300));
  if (api.render && api.render.onDone) api.render.onDone(() => setTimeout(capNhatDungLuong, 500));
  setTimeout(capNhatDungLuong, 1500);
})();
