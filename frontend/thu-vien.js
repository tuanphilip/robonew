'use strict';
/**
 * TAB "THƯ VIỆN" (bảng phải từ 16/10/2026 — render/tab-phai.js dời `#paneThuVien`) — Project panel của trình dựng (docs/video-editor/KE-HOACH.md §5).
 *
 *   [+ Nhập media]   Tất cả · Video · Ảnh · Âm thanh
 *   ┌────┐ ┌────┐ ┌────┐
 *   │ảnh │ │ảnh │ │ ∿∿ │   kéo một ô sang timeline (track hình / tiếng)
 *   └────┘ └────┘ └────┘   bấm đúp = thêm vào timeline tại đầu phát
 *   12 media · 1,2 GB
 *
 * Thả tệp từ Explorer/Finder vào tab này (hoặc thẳng xuống timeline) là nhập.
 *
 * Ba chế độ (Giai đoạn 3): DỰ ÁN (media của deck) · DÙNG CHUNG (thư viện cho mọi dự án —
 * src/dung/thuVienChung.js; dùng = CHÉP vào deck) · MẪU (intro/outro lưu từ các khối đang chọn).
 * Mọi dữ liệu lấy từ `RP.dung` (render/dung-kho.js) — tab này không giữ trạng thái riêng.
 *
 * ⚠ Tên tệp do NGƯỜI DÙNG đặt → chỉ đi qua `textContent`, không `innerHTML`.
 */
(function () {
  const pane = document.getElementById('paneThuVien');
  const RP = window.__renderPage || {};
  const api = window.beeknoee;
  if (!pane) return;

  const tao = (the, lop, chu) => {
    const e = document.createElement(the);
    if (lop) e.className = lop;
    if (chu != null) e.textContent = chu;
    return e;
  };
  const icon = (ten) => { const s = tao('span', 'btn-icon'); s.dataset.icon = ten; return s; };
  const veIcon = (g) => { if (window.__beeIcons) window.__beeIcons.apply(g); };
  const mmss = (ms) => {
    const t = Math.max(0, Math.round((ms || 0) / 1000));
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  };
  const coByte = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.max(0.1, b / 1024 ** 2).toFixed(1)} MB`);

  pane.innerHTML = `
    <div class="tv">
      <div class="tv-che" role="tablist" aria-label="Nguồn media">
        <button type="button" class="tv-che-nut dang-chon" data-che="duAn" role="tab">Dự án</button>
        <button type="button" class="tv-che-nut" data-che="chung" role="tab" title="Media dùng cho mọi dự án (logo, nhạc nền…)">Dùng chung</button>
        <button type="button" class="tv-che-nut" data-che="mau" role="tab" title="Mẫu intro / outro">Mẫu</button>
        <button type="button" class="tv-che-nut" data-che="nhac" role="tab" title="Nhạc nền có sẵn — dựng ngay trong app, dùng thoải mái">Nhạc</button>
        <button type="button" class="tv-che-nut" data-che="hieuUng" role="tab" title="Lớp phủ (viền tối, vệt sáng, khung điện ảnh…) và tiếng hiệu ứng có sẵn — dựng ngay trong app">Hiệu ứng</button>
      </div>
      <div class="tv-dau" data-dau-du-an>
        <div class="tv-nut-dau">
          <button type="button" class="tv-nhap" data-nhap><span class="btn-icon" data-icon="upload"></span><span>Nhập media</span></button>
          <button type="button" class="tv-nhap tv-chu" data-chu title="Thêm chữ tiêu đề lên timeline tại đầu phát">+ Chữ</button>
        </div>
        <div class="tv-loc" role="tablist" aria-label="Lọc theo loại">
          <button type="button" class="tv-loc-nut dang-chon" data-loc="">Tất cả</button>
          <button type="button" class="tv-loc-nut" data-loc="video">Video</button>
          <button type="button" class="tv-loc-nut" data-loc="anh">Ảnh</button>
          <button type="button" class="tv-loc-nut" data-loc="tieng">Âm thanh</button>
        </div>
      </div>
      <div class="tv-lap" data-lap hidden>
        <div class="tv-lap-chu" data-lap-chu></div>
        <button type="button" class="tv-nhap tv-chu" data-lap-nhanh>Lấp nhanh…</button>
      </div>
      <div class="tv-dau" data-dau-chung hidden>
        <button type="button" class="tv-nhap" data-tvc-them><span class="btn-icon" data-icon="upload"></span><span>Thêm vào thư viện dùng chung</span></button>
      </div>
      <div class="tv-dau" data-dau-mau hidden>
        <div class="tv-mau-luu">
          <input type="text" class="tv-mau-ten" data-mau-ten maxlength="80" placeholder="Tên mẫu (vd Intro kênh)" aria-label="Tên mẫu">
          <button type="button" class="tv-nhap tv-chu" data-mau-luu>Lưu khối đang chọn</button>
        </div>
        <button type="button" class="tv-nhap tv-mau-du-an" data-mau-du-an
          title="Lưu CẢ timeline (cảnh, chữ, lớp phủ, tiếng, nhạc) thành mẫu dựng video ở trang Mẫu → nhóm &quot;Mẫu của tôi&quot;. Mỗi cảnh ảnh / video phủ kín khung thành một ô để thay.">Lưu cả dự án làm mẫu dựng video</button>
      </div>
      <div class="tv-dau" data-dau-nhac hidden>
        <div class="tv-phu">Nhạc nền dựng ngay trong app (cùng bộ nhạc của slide) — không bản quyền. Thêm vào là nhạc tự LẶP tới hết video; giọng đọc nói thì nhạc tự hạ khi bật "Hạ nhạc khi có giọng".</div>
      </div>
      <div class="tv-dau" data-dau-hieu-ung hidden>
        <div class="tv-phu">Lớp phủ và tiếng hiệu ứng dựng ngay trong app — không bản quyền. Bấm để thêm ĐÚNG tại đầu phát (đặt đầu phát vào chỗ cắt cảnh trước), hoặc kéo xuống timeline.</div>
      </div>
      <div class="tv-bao" data-bao hidden></div>
      <div class="tv-tien" data-tien hidden></div>
      <div class="tv-luoi" data-luoi></div>
      <div class="tv-trong" data-trong hidden>
        <span class="btn-icon" data-icon="upload"></span>
        <b>Kéo video, ảnh, âm thanh vào đây</b>
        <span>hoặc bấm "Nhập media". Tệp được CHÉP vào thư mục dự án (dung/media), nên dọn thư mục Tải về cũng không mất.</span>
      </div>
      <div class="tv-chan" data-chan></div>
      <div class="tv-tha" data-tha hidden><span>Thả để nhập vào dự án</span></div>
    </div>`;
  veIcon(pane);

  const luoi = pane.querySelector('[data-luoi]');
  const baoEl = pane.querySelector('[data-bao]');
  const tienEl = pane.querySelector('[data-tien]');
  const trongEl = pane.querySelector('[data-trong]');
  const chanEl = pane.querySelector('[data-chan]');
  const thaEl = pane.querySelector('[data-tha]');
  let loc = '';
  let che = 'duAn';                // 'duAn' | 'chung' | 'mau' | 'nhac' | 'hieuUng'
  let tvcDs = { media: [], mau: [] };
  let nhacDs = [];                 // nhạc có sẵn (GĐ2.2) — src/dung/nhacSan.js
  let sfxDs = [];                  // tiếng hiệu ứng có sẵn (đợt 1 hiệu ứng) — src/dung/tiengHieuUng.js
  let lpDs = [];                   // lớp phủ có sẵn (đợt 1 hiệu ứng) — src/dung/lopPhu.js
  let lpDoc = null;                // khổ của ảnh thu nhỏ đang có (dọc / ngang)
  let ngheAm = null;               // { id, el } bản đang nghe thử
  async function napSfx() {
    if (!api || !api.dung) return;
    if (!sfxDs.length && api.dung.tiengHieuUng) { try { sfxDs = await api.dung.tiengHieuUng(); } catch { sfxDs = []; } }
    // Ảnh thu nhỏ của lớp phủ theo khổ KHUNG XUẤT của dự án đang mở (đổi dự án dọc ↔ ngang thì nạp lại).
    const K = RP.dung && RP.dung.khungXuat && RP.dung.khungXuat();
    const doc = !K || K.cao >= K.rong;
    if ((!lpDs.length || lpDoc !== doc) && api.dung.lopPhu) {
      try { lpDs = await api.dung.lopPhu(doc); lpDoc = doc; } catch { lpDs = []; }
    }
  }
  async function napNhac() {
    if (nhacDs.length || !api || !api.dung || !api.dung.nhacSan) return;
    try { nhacDs = await api.dung.nhacSan(); } catch { nhacDs = []; }
  }
  let luotNghe = 0;                // lượt "Nghe" mới nhất — bản dựng xong muộn của lượt cũ thì không phát (rà GĐ2)
  function dungNghe() {
    luotNghe += 1;
    if (ngheAm) { ngheAm.el.pause(); ngheAm.el.src = ''; ngheAm = null; }
  }
  const tvc = api && api.dung && api.dung.tvc;
  async function napTvc() {
    if (!tvc) return;
    try { tvcDs = await tvc.ds(); } catch { tvcDs = { media: [], mau: [] }; }
    if (che !== 'duAn') ve();
  }

  function bao(chu, loai) {
    baoEl.hidden = !chu;
    baoEl.textContent = chu || '';
    baoEl.className = `tv-bao${loai ? ` ${loai}` : ''}`;
  }

  /** Ô của một media. Dựng lại toàn lưới mỗi lần đổi — thư viện vài chục ô, rẻ. */
  function oMedia(m) {
    const c = (RP.dung && RP.dung.cacheCua(m.id)) || {};
    const o = tao('div', `tv-o tv-loai-${m.loai}`);
    o.draggable = true;
    o.dataset.id = m.id;
    o.title = `${m.ten}\n${m.loai === 'anh' ? `${m.rong}×${m.cao}` : mmss(m.ms)}${m.rong && m.loai === 'video' ? ` · ${m.rong}×${m.cao}` : ''}\nBấm đúp: thêm vào timeline tại đầu phát`;
    const anh = tao('div', 'tv-anh');
    if (c.anh) {
      const im = tao('img');
      im.src = c.anh;
      im.alt = '';
      im.draggable = false;
      anh.appendChild(im);
    } else if (m.loai === 'tieng') {
      anh.appendChild(veSongNho(c.song));
    } else {
      anh.appendChild(icon(m.loai === 'video' ? 'phim' : 'khung'));
    }
    o.appendChild(anh);
    if (m.loai !== 'anh') o.appendChild(tao('span', 'tv-gio', mmss(m.ms)));
    if (c.tienDo != null) {
      const t = tao('span', 'tv-proxy');
      t.title = 'Đang tạo bản xem trước';
      t.style.setProperty('--tv-phan', `${Math.round(c.tienDo * 100)}%`);
      o.appendChild(t);
    }
    const ten = tao('div', 'tv-ten');
    ten.appendChild(icon(m.loai === 'video' ? 'phim' : m.loai === 'anh' ? 'khung' : 'nhac'));
    ten.appendChild(tao('span', '', m.ten));
    o.appendChild(ten);
    const xoa = tao('button', 'tv-xoa');
    xoa.type = 'button';
    xoa.title = 'Xoá khỏi dự án';
    xoa.setAttribute('aria-label', 'Xoá khỏi dự án');
    xoa.appendChild(icon('trash'));
    xoa.dataset.xoa = m.id;
    o.appendChild(xoa);
    if (tvc) {
      const sao = tao('button', 'tv-xoa tv-sao');
      sao.type = 'button';
      sao.title = 'Lưu vào thư viện dùng chung (dùng cho dự án khác)';
      sao.setAttribute('aria-label', sao.title);
      sao.textContent = '★';
      sao.dataset.sao = m.id;
      o.appendChild(sao);
    }
    return o;
  }

  /** Ô của một mục THƯ VIỆN DÙNG CHUNG (cùng dáng ô dự án). */
  function oChung(m) {
    const o = tao('div', `tv-o tv-loai-${m.loai}`);
    o.draggable = true;
    o.dataset.tvc = m.id;
    o.title = `${m.ten}\nBấm đúp: chép vào dự án và đặt lên timeline tại đầu phát\nKéo xuống timeline để đặt đúng chỗ`;
    const anh = tao('div', 'tv-anh');
    if (m.anh) {
      const im = tao('img');
      im.src = m.anh;
      im.alt = '';
      im.draggable = false;
      anh.appendChild(im);
    } else anh.appendChild(icon(m.loai === 'video' ? 'phim' : m.loai === 'anh' ? 'khung' : 'nhac'));
    o.appendChild(anh);
    if (m.loai !== 'anh') o.appendChild(tao('span', 'tv-gio', mmss(m.ms)));
    const ten = tao('div', 'tv-ten');
    ten.appendChild(icon(m.loai === 'video' ? 'phim' : m.loai === 'anh' ? 'khung' : 'nhac'));
    ten.appendChild(tao('span', '', m.ten));
    o.appendChild(ten);
    const xoa = tao('button', 'tv-xoa');
    xoa.type = 'button';
    xoa.title = 'Xoá khỏi thư viện dùng chung (dự án đã dùng vẫn giữ bản chép)';
    xoa.setAttribute('aria-label', 'Xoá khỏi thư viện dùng chung');
    xoa.appendChild(icon('trash'));
    xoa.dataset.tvcXoa = m.id;
    o.appendChild(xoa);
    return o;
  }

  /** Một dòng MẪU. */
  function oMau(x) {
    const o = tao('div', 'tv-mau');
    o.dataset.mau = x.id;
    const anh = tao('div', 'tv-mau-anh');
    if (x.anh) { const im = tao('img'); im.src = x.anh; im.alt = ''; im.draggable = false; anh.appendChild(im); }
    o.appendChild(anh);
    const than = tao('div', 'tv-mau-than');
    than.appendChild(tao('b', '', x.ten));
    than.appendChild(tao('span', '', `${x.soKhoi} khối · ${(x.daiMs / 1000).toFixed(1)} giây`));
    o.appendChild(than);
    const chen = tao('button', 'tv-nhap tv-chu', 'Chèn');
    chen.type = 'button';
    chen.title = 'Chèn mẫu vào dự án tại đầu phát';
    chen.dataset.mauChen = x.id;
    o.appendChild(chen);
    const xoa = tao('button', 'tv-xoa');
    xoa.type = 'button';
    xoa.title = 'Xoá mẫu';
    xoa.setAttribute('aria-label', 'Xoá mẫu');
    xoa.appendChild(icon('trash'));
    xoa.dataset.mauXoa = x.id;
    o.appendChild(xoa);
    return o;
  }

  /** Một dòng NHẠC CÓ SẴN: nghe thử · thêm tại đầu phát · kéo xuống timeline. */
  function oNhac(x) {
    const o = tao('div', 'tv-mau tv-nhac');
    o.dataset.nhac = x.id;
    o.draggable = true;
    o.title = `${x.ten} — ${x.moTa}\nKéo xuống track tiếng, hoặc bấm "Thêm" (đặt tại đầu phát, lặp tới hết video)`;
    const anh = tao('div', 'tv-mau-anh tv-nhac-anh');
    anh.appendChild(icon('nhac'));
    o.appendChild(anh);
    const than = tao('div', 'tv-mau-than');
    than.appendChild(tao('b', '', x.ten));
    than.appendChild(tao('span', '', x.moTa));
    o.appendChild(than);
    const nghe = tao('button', 'tv-nhap tv-chu tv-nghe', ngheAm && ngheAm.id === x.id ? '■ Dừng' : '▶ Nghe');
    nghe.type = 'button';
    nghe.title = 'Nghe thử (lần đầu dựng bản nhạc mất ~1 giây)';
    nghe.dataset.nhacNghe = x.id;
    o.appendChild(nghe);
    const them = tao('button', 'tv-nhap tv-chu', 'Thêm');
    them.type = 'button';
    them.title = 'Thêm vào track tiếng tại đầu phát — lặp tới hết video';
    them.dataset.nhacThem = x.id;
    o.appendChild(them);
    return o;
  }

  function oLopPhu(x) {
    const o = tao('button', 'tv-lp');
    o.type = 'button';
    o.dataset.lpThem = x.id;
    o.draggable = true;
    o.title = `${x.ten} — ${x.moTa}\nBấm: thêm tại đầu phát · Kéo xuống track hình`;
    const anh = tao('span', `tv-lp-anh${lpDoc === false ? ' ngang' : ''}`);
    if (x.anh) { const im = tao('img'); im.src = x.anh; im.alt = ''; im.draggable = false; anh.appendChild(im); }
    o.appendChild(anh);
    o.appendChild(tao('span', 'tv-lp-ten', x.ten));
    return o;
  }

  function oSfx(x) {
    const o = tao('div', 'tv-mau tv-nhac tv-sfx');
    o.dataset.sfx = x.id;
    o.draggable = true;
    o.title = `${x.ten} — ${x.moTa}\nKéo xuống track tiếng, hoặc bấm "Thêm" (đặt đúng tại đầu phát)`;
    const anh = tao('div', 'tv-mau-anh tv-nhac-anh');
    anh.appendChild(icon('loa'));
    o.appendChild(anh);
    const than = tao('div', 'tv-mau-than');
    than.appendChild(tao('b', '', `${x.ten} · ${String(x.dai).replace('.', ',')} s`));
    than.appendChild(tao('span', '', x.moTa));
    o.appendChild(than);
    const nghe = tao('button', 'tv-nhap tv-chu tv-nghe', ngheAm && ngheAm.id === `sfx:${x.id}` ? '■ Dừng' : '▶ Nghe');
    nghe.type = 'button';
    nghe.title = 'Nghe thử';
    nghe.dataset.sfxNghe = x.id;
    o.appendChild(nghe);
    const them = tao('button', 'tv-nhap tv-chu', 'Thêm');
    them.type = 'button';
    them.title = 'Thêm vào track tiếng ĐÚNG tại đầu phát';
    them.dataset.sfxThem = x.id;
    o.appendChild(them);
    return o;
  }

  /** Sóng âm thu nhỏ cho ô âm thanh (SVG thuần, vẽ từ đỉnh đã có). */
  function veSongNho(song) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 40');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('tv-song');
    if (!song || !song.dinh || !song.dinh.length) return svg;
    const n = 50;
    const buoc = song.dinh.length / n;
    let d = '';
    for (let i = 0; i < n; i += 1) {
      let v = 0;
      for (let j = Math.floor(i * buoc); j < Math.floor((i + 1) * buoc); j += 1) v = Math.max(v, song.dinh[j] || 0);
      const h = Math.max(1, (v / 100) * 18);
      d += `M${i * 2 + 1} ${20 - h}V${20 + h}`;
    }
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return svg;
  }

  function ve() {
    const dg = RP.dung;
    const d = dg && dg.duAn();
    luoi.textContent = '';
    if (!dg || !dg.deck()) {
      bao('Bấm "Dự án" trên thanh trên cùng để mở một dự án.');
      trongEl.hidden = true;
      chanEl.textContent = '';
      return;
    }
    if (dg.chiDoc()) bao(dg.loiDoc()[0] || 'Dự án dựng đang ở chế độ chỉ đọc.', 'loi');
    else if (dg.loiLuu()) bao(`Chưa lưu được: ${dg.loiLuu()}`, 'loi');
    else if (dg.loiDoc().length) bao(dg.loiDoc().join(' · '), 'canh-bao');
    else if (!dg.coVideo()) bao('Deck chưa có video slide: vẫn sắp được media lên timeline, nhưng xem ghép và xuất cần bấm "Tạo video" trước.', 'canh-bao');
    else bao('');
    pane.querySelector('[data-dau-du-an]').hidden = che !== 'duAn';
    /* MẪU DỰNG VIDEO: dự án có ô giữ chỗ ⇒ dải nhắc + "Lấp nhanh" (chọn nhiều ảnh / video một lượt, điền theo số ô). */
    const oDa = che === 'duAn' && dg.cacO && !dg.chiDoc() ? dg.cacO() : [];
    const lapEl = pane.querySelector('[data-lap]');
    lapEl.hidden = !oDa.length;
    if (oDa.length) {
      const con = oDa.filter((x) => !x.daThay).length;
      pane.querySelector('[data-lap-chu]').textContent = con
        ? `Mẫu có ${oDa.length} ô — ${con} ô còn ảnh / video mẫu. Chọn ${oDa.length} tệp của bạn để lấp một lượt, hoặc kéo từng tệp thả lên ô trên timeline.`
        : `Đã thay đủ ${oDa.length} ô. Lấp lại cả mẫu: chọn ${oDa.length} tệp.`;
    }
    pane.querySelector('[data-dau-chung]').hidden = che !== 'chung';
    pane.querySelector('[data-dau-mau]').hidden = che !== 'mau';
    pane.querySelector('[data-dau-nhac]').hidden = che !== 'nhac';
    pane.querySelector('[data-dau-hieu-ung]').hidden = che !== 'hieuUng';
    luoi.classList.toggle('tv-luoi-mau', che === 'mau' || che === 'nhac' || che === 'hieuUng');
    if (che === 'hieuUng') {
      // Đổi sang dự án khác khổ (dọc ↔ ngang) trong lúc đang ở mục này: nạp lại ảnh thu nhỏ rồi vẽ lại.
      const Kh = RP.dung && RP.dung.khungXuat && RP.dung.khungXuat();
      const docH = !Kh || Kh.cao >= Kh.rong;
      if (lpDs.length && lpDoc !== docH && !napSfx.dang) {
        napSfx.dang = true;
        napSfx().finally(() => { napSfx.dang = false; if (che === 'hieuUng') ve(); });
      }
      trongEl.hidden = true;
      if (lpDs.length) {
        luoi.appendChild(tao('div', 'tv-nhom-ten', 'Lớp phủ'));
        const lw = tao('div', 'tv-lp-luoi');
        lpDs.forEach((x) => lw.appendChild(oLopPhu(x)));
        luoi.appendChild(lw);
      }
      if (sfxDs.length) luoi.appendChild(tao('div', 'tv-nhom-ten', 'Tiếng hiệu ứng'));
      sfxDs.forEach((x) => luoi.appendChild(oSfx(x)));
      if (!sfxDs.length && !lpDs.length) luoi.appendChild(tao('div', 'tv-trong-chu', 'Không đọc được danh sách hiệu ứng.'));
      veIcon(luoi);
      chanEl.textContent = `${lpDs.length} lớp phủ · ${sfxDs.length} tiếng hiệu ứng`;
      return;
    }
    if (che === 'nhac') {
      trongEl.hidden = true;
      nhacDs.forEach((x) => luoi.appendChild(oNhac(x)));
      if (!nhacDs.length) luoi.appendChild(tao('div', 'tv-trong-chu', 'Không đọc được danh sách nhạc.'));
      veIcon(luoi);
      chanEl.textContent = nhacDs.length ? `${nhacDs.length} bản nhạc` : '';
      return;
    }
    if (che === 'chung') {
      const ds = tvcDs.media.filter((m) => !loc || m.loai === loc);
      trongEl.hidden = true;
      ds.forEach((m) => luoi.appendChild(oChung(m)));
      if (!tvcDs.media.length) luoi.appendChild(tao('div', 'tv-trong-chu', 'Thư viện dùng chung trống. Bấm "Thêm vào thư viện dùng chung", hoặc bấm ★ trên một media của dự án.'));
      veIcon(luoi);
      const tong = tvcDs.media.reduce((a, m) => a + (m.byte || 0), 0);
      chanEl.textContent = tvcDs.media.length ? `${tvcDs.media.length} mục dùng chung · ${coByte(tong)}` : '';
      return;
    }
    if (che === 'mau') {
      trongEl.hidden = true;
      const soChon = dg.chon().length;
      const nutLuu = pane.querySelector('[data-mau-luu]');
      nutLuu.disabled = !soChon || dg.chiDoc();
      nutLuu.textContent = soChon ? `Lưu ${soChon} khối đang chọn` : 'Chọn khối trên timeline để lưu';
      // Lưu cả dự án làm mẫu: chỉ dự án VIDEO (không slide) — deck slide đã có trang Mẫu riêng.
      const nutDa = pane.querySelector('[data-mau-du-an]');
      const pj = RP.projectMap && dg.deck() ? RP.projectMap.get(dg.deck()) : null;
      nutDa.hidden = !(pj && pj.loai === 'video');
      nutDa.disabled = dg.chiDoc();
      tvcDs.mau.forEach((x) => luoi.appendChild(oMau(x)));
      if (!tvcDs.mau.length) luoi.appendChild(tao('div', 'tv-trong-chu', 'Chưa có mẫu. Chọn các khối intro/outro trên timeline (chữ, logo, nhạc…), đặt tên rồi bấm "Lưu".'));
      veIcon(luoi);
      chanEl.textContent = tvcDs.mau.length ? `${tvcDs.mau.length} mẫu` : '';
      return;
    }
    const ds = d ? d.media.filter((m) => !loc || m.loai === loc) : [];
    trongEl.hidden = !!(d && d.media.length);
    ds.forEach((m) => luoi.appendChild(oMedia(m)));
    veIcon(luoi);
    const tong = d ? d.media.reduce((a, m) => a + (m.byte || 0), 0) : 0;
    chanEl.textContent = d && d.media.length ? `${d.media.length} media · ${coByte(tong)}` : '';
  }

  /* ── nhập ─────────────────────────────────────────────────────────────── */
  async function nhapVa(fn) {
    if (!RP.dung || !RP.dung.deck()) { bao('Mở một dự án trước khi nhập media.', 'loi'); return null; }
    tienEl.hidden = false;
    tienEl.textContent = 'Đang nhập…';
    try {
      const r = await fn();
      if (r && r.loi && r.loi.length) bao(r.loi.join(' · '), 'loi');
      return r;
    } catch (e) {
      bao(e.message || String(e), 'loi');
      return null;
    } finally {
      tienEl.hidden = true;
    }
  }
  if (api && api.dung && api.dung.onTienTrinh) {
    api.dung.onTienTrinh((x) => {
      if (!x || x.loai !== 'nhap' || !RP.dung || x.deck !== RP.dung.deck()) return;
      tienEl.hidden = false;
      tienEl.textContent = `Đang nhập ${x.i + 1}/${x.n}: ${x.ten}`;
      // Nhập từ timeline (thả tệp xuống track) không đi qua nhapVa — tự tắt sau tệp cuối.
      clearTimeout(tienEl._hen);
      tienEl._hen = setTimeout(() => { tienEl.hidden = true; }, x.i + 1 >= x.n ? 2500 : 60000);
    });
  }

  /** Đường dẫn thật của các tệp kéo từ hệ điều hành (preload: webUtils). */
  function duongTuDrop(e) {
    const files = [...((e.dataTransfer && e.dataTransfer.files) || [])];
    const f = api && api.projects && api.projects.duongDanFile;
    return f ? files.map((x) => f(x)).filter(Boolean) : [];
  }

  pane.addEventListener('click', async (e) => {
    const n = e.target.closest('button');
    if (!n) return;
    if (n.dataset.nhap != null) { await nhapVa(() => RP.dung.chonTep()); return; }
    if (n.dataset.lapNhanh != null) {
      const r = await nhapVa(() => RP.dung.chonTep());
      // Thứ tự lấp = TÊN tệp (hộp chọn tệp của hệ điều hành trả thứ tự không đoán được): đặt 01-, 02- là đúng ô.
      const ds = ((r && r.media) || []).filter((m) => m.loai !== 'tieng')
        .sort((a, b) => String(a.ten).localeCompare(String(b.ten), 'vi', { numeric: true }));
      if (!ds.length) return;
      const k = RP.dung.lapNhanh(ds.map((m) => m.id));
      if (!k.ok) bao(k.loi.join(' · '), 'loi');
      else bao(`Đã lấp ${k.soO} ô${k.thieu ? ` · còn ${k.thieu} ô dùng ảnh mẫu` : ''}${k.thua ? ` · thừa ${k.thua} tệp (đã vào thư viện dự án)` : ''}.`);
      ve();
      return;
    }
    if (n.dataset.che) {
      che = n.dataset.che;
      pane.querySelectorAll('[data-che]').forEach((x) => x.classList.toggle('dang-chon', x === n));
      dungNghe();
      if (che === 'nhac') await napNhac();
      if (che === 'hieuUng') await napSfx();
      if (che === 'chung' || che === 'mau') await napTvc();
      ve();
      return;
    }
    if (n.dataset.nhacNghe) {
      const id = n.dataset.nhacNghe;
      if (ngheAm && ngheAm.id === id) { dungNghe(); ve(); return; }
      dungNghe();
      const luot = luotNghe;
      n.disabled = true;
      n.textContent = 'Đang dựng…';
      try {
        const r = await api.dung.ngheNhacSan(id);
        if (luot !== luotNghe || che !== 'nhac') return;   // đã bấm bản khác / rời mục Nhạc trong lúc dựng
        if (!r || !r.ok) { bao(((r && r.loi) || ['Không nghe được.']).join(' · '), 'loi'); return; }
        const el = new Audio(r.url);
        el.volume = 0.6;
        el.addEventListener('ended', () => { if (ngheAm && ngheAm.el === el) { ngheAm = null; ve(); } });
        ngheAm = { id, el };
        el.play().catch(() => { ngheAm = null; });
        bao('');
      } finally { ve(); }
      return;
    }
    if (n.dataset.lpThem) {
      if (!RP.dung.duAn() || RP.dung.chiDoc()) return;
      n.disabled = true;
      try {
        const r = await RP.dung.themLopPhu(n.dataset.lpThem, RP.timeline && RP.timeline.tDauMs ? RP.timeline.tDauMs() : 0);
        if (!r.ok) bao((r.loi || ['Không thêm được lớp phủ.']).join(' · '), 'loi'); else bao('');
      } finally { ve(); }
      return;
    }
    if (n.dataset.sfxNghe) {
      const id = `sfx:${n.dataset.sfxNghe}`;
      if (ngheAm && ngheAm.id === id) { dungNghe(); ve(); return; }
      dungNghe();
      const luot = luotNghe;
      try {
        const r = await api.dung.ngheTiengHieuUng(n.dataset.sfxNghe);
        if (luot !== luotNghe || che !== 'hieuUng') return;
        if (!r || !r.ok) { bao(((r && r.loi) || ['Không nghe được.']).join(' · '), 'loi'); return; }
        const el = new Audio(r.url);
        el.volume = 0.8;
        el.addEventListener('ended', () => { if (ngheAm && ngheAm.el === el) { ngheAm = null; ve(); } });
        ngheAm = { id, el };
        el.play().catch(() => { ngheAm = null; });
        bao('');
      } finally { ve(); }
      return;
    }
    if (n.dataset.sfxThem) {
      if (!RP.dung.duAn() || RP.dung.chiDoc()) return;
      n.disabled = true;
      n.textContent = 'Đang thêm…';
      try {
        const r = await RP.dung.themTiengHieuUng(n.dataset.sfxThem, RP.timeline && RP.timeline.tDauMs ? RP.timeline.tDauMs() : 0);
        if (!r.ok) bao((r.loi || ['Không thêm được tiếng hiệu ứng.']).join(' · '), 'loi'); else bao('');
      } finally { ve(); }
      return;
    }
    if (n.dataset.nhacThem) {
      if (!RP.dung.duAn() || RP.dung.chiDoc()) return;
      n.disabled = true;
      n.textContent = 'Đang thêm…';
      try {
        const r = await RP.dung.themNhac(n.dataset.nhacThem, RP.timeline && RP.timeline.tDauMs ? RP.timeline.tDauMs() : 0);
        if (!r.ok) bao((r.loi || ['Không thêm được nhạc.']).join(' · '), 'loi'); else bao('');
      } finally { ve(); }
      return;
    }
    const dau = () => (RP.timeline && RP.timeline.tDauMs ? RP.timeline.tDauMs() : 0);
    if (n.dataset.tvcThem != null && tvc) {
      n.disabled = true;
      try {
        const r = await tvc.chonTep();
        tvcDs = { media: r.media, mau: r.mau };
        if (r.loi && r.loi.length) bao(r.loi.join(' · '), 'loi'); else bao('');
        ve();
      } finally { n.disabled = false; }
      return;
    }
    if (n.dataset.sao && tvc) {
      const r = await RP.dung.luuVaoThuVien([n.dataset.sao]);
      if (r.loi && r.loi.length) bao(r.loi.join(' · '), 'loi');
      else { bao('Đã lưu vào thư viện dùng chung — xem ở mục "Dùng chung".'); tvcDs = { media: r.media, mau: r.mau }; }
      return;
    }
    if (n.dataset.tvcXoa && tvc) {
      const m = tvcDs.media.find((x) => x.id === n.dataset.tvcXoa);
      const dongY = window.__beeHoi ? await window.__beeHoi({ tieuDe: 'Xoá khỏi thư viện dùng chung?',
        chu: [`"${m ? m.ten : ''}" sẽ bị xoá khỏi thư viện dùng chung.`, 'Các dự án đã dùng nó vẫn giữ bản chép riêng — không hỏng gì.'],
        nutDong: 'Xoá', nguyHiem: true }) : false;
      if (dongY) { const r = await tvc.xoa(n.dataset.tvcXoa); if (!r.ok) bao(r.loi, 'loi'); tvcDs = { media: r.media, mau: r.mau }; ve(); }
      return;
    }
    if (n.dataset.mauLuu != null && tvc) {
      const o = pane.querySelector('[data-mau-ten]');
      const tenMau = o.value.trim();
      if (!tenMau) { bao('Đặt tên cho mẫu trước (vd "Intro kênh").', 'loi'); o.focus(); return; }
      n.disabled = true;
      try {
        const r = await RP.dung.luuMau(tenMau, RP.dung.chon());
        if (!r || !r.ok) bao(((r && r.loi) || ['Không lưu được mẫu.']).join(' · '), 'loi');
        else { bao(`Đã lưu mẫu "${tenMau}".`); o.value = ''; tvcDs = { media: r.media, mau: r.mau }; ve(); }
      } finally { n.disabled = false; }
      return;
    }
    if (n.dataset.mauDuAn != null) {
      const o = pane.querySelector('[data-mau-ten]');
      const tenMau = o.value.trim();
      if (!tenMau) { bao('Đặt tên cho mẫu trước (vd "Du lịch hè").', 'loi'); o.focus(); return; }
      n.disabled = true;
      try {
        if (RP.dung.luuNgay) await RP.dung.luuNgay();   // mẫu chép từ đĩa — thay đổi còn chờ lưu phải xuống trước
        const r = await window.beeknoee.templates.luuMauDung({ ten: RP.dung.deck(), tenMau });
        if (!r || !r.ok) bao((r && r.loi) || 'Không lưu được mẫu.', 'loi');
        else {
          o.value = '';
          bao(`Đã lưu mẫu "${tenMau}" (${r.soO} ô) — xem ở trang Mẫu, nhóm "Mẫu của tôi".${r.coVideo ? '' : ' Xuất video một lần rồi lưu lại để mẫu có video xem trước.'}`);
          if (window.__beePages && window.__beePages.lamMoiMau) window.__beePages.lamMoiMau();
        }
      } finally { n.disabled = false; }
      return;
    }
    if (n.dataset.mauChen && tvc) {
      n.disabled = true;
      try {
        const r = await RP.dung.chenMau(n.dataset.mauChen, dau());
        if (!r || !r.ok) bao(((r && r.loi) || ['Không chèn được mẫu.']).join(' · '), 'loi'); else bao('');
      } finally { n.disabled = false; }
      return;
    }
    if (n.dataset.mauXoa && tvc) {
      const x = tvcDs.mau.find((y) => y.id === n.dataset.mauXoa);
      const dongY = window.__beeHoi ? await window.__beeHoi({ tieuDe: 'Xoá mẫu?', chu: [`Mẫu "${x ? x.ten : ''}" sẽ bị xoá. Dự án đã chèn mẫu không đổi gì.`],
        nutDong: 'Xoá', nguyHiem: true }) : false;
      if (dongY) { const r = await tvc.xoaMau(n.dataset.mauXoa); tvcDs = { media: r.media, mau: r.mau }; ve(); }
      return;
    }
    if (n.dataset.chu != null) {
      if (!RP.dung.duAn() || RP.dung.chiDoc()) return;
      n.disabled = true;
      try { await RP.dung.themChu(RP.timeline && RP.timeline.tDauMs ? RP.timeline.tDauMs() : 0); } finally { n.disabled = false; }
      return;
    }
    if (n.dataset.loc != null) {
      loc = n.dataset.loc;
      pane.querySelectorAll('[data-loc]').forEach((x) => x.classList.toggle('dang-chon', x === n));
      ve();
      return;
    }
    if (n.dataset.xoa) {
      const id = n.dataset.xoa;
      const m = RP.dung.mediaCua(id);
      const dung = RP.dung.duAn().khoi.filter((c) => c.media === id).length;
      /* Hộp xác nhận CỦA APP (ai-caidat.js `__beeHoi`) — không dùng window.confirm
         (hộp hệ điều hành lạc giao diện, xem chú thích ở đó). */
      const chu = [`"${m.ten}" sẽ bị gỡ khỏi dự án.`];
      if (dung) chu.push(`${dung} khối trên timeline đang dùng nó cũng bị xoá.`);
      chu.push('Hoàn tác được bằng Ctrl+Z. Tệp đã chép vẫn nằm trong dung/media cho tới khi Dọn dẹp.');
      const dongY = window.__beeHoi
        ? await window.__beeHoi({ tieuDe: 'Xoá media khỏi dự án?', chu, nutDong: 'Xoá', nguyHiem: true })
        : false;
      if (dongY) RP.dung.xoaMedia(id);
    }
  });

  luoi.addEventListener('dblclick', async (e) => {
    const o = e.target.closest('.tv-o');
    if (!o || !RP.dung) return;
    const ms = RP.timeline && RP.timeline.tDauMs ? RP.timeline.tDauMs() : 0;
    if (o.dataset.tvc) {
      const r = await RP.dung.themTuThuVien([o.dataset.tvc], ms);
      if (!r.ok) bao((r.loi || ['Không thêm được.']).join(' · '), 'loi');
      return;
    }
    RP.dung.themKhoi(o.dataset.id, null, ms);
  });

  // Kéo một ô sang timeline (timeline-sua.js nhận `application/x-bee-media`).
  luoi.addEventListener('dragstart', (e) => {
    const lp = e.target.closest('.tv-lp');
    if (lp) {
      e.dataTransfer.setData('application/x-bee-lop-phu', lp.dataset.lpThem);
      e.dataTransfer.effectAllowed = 'copy';
      document.body.classList.add('dung-dang-keo');
      return;
    }
    const sf = e.target.closest('.tv-sfx');
    if (sf) {
      e.dataTransfer.setData('application/x-bee-sfx', sf.dataset.sfx);
      e.dataTransfer.effectAllowed = 'copy';
      document.body.classList.add('dung-dang-keo');
      return;
    }
    const nh = e.target.closest('.tv-nhac');
    if (nh) {
      e.dataTransfer.setData('application/x-bee-nhac', nh.dataset.nhac);
      e.dataTransfer.effectAllowed = 'copy';
      document.body.classList.add('dung-dang-keo');
      return;
    }
    const o = e.target.closest('.tv-o');
    if (!o) return;
    if (o.dataset.tvc) e.dataTransfer.setData('application/x-bee-thu-vien', o.dataset.tvc);
    else e.dataTransfer.setData('application/x-bee-media', o.dataset.id);
    e.dataTransfer.effectAllowed = 'copy';
    document.body.classList.add('dung-dang-keo');
  });
  luoi.addEventListener('dragend', () => document.body.classList.remove('dung-dang-keo'));

  // Thả tệp từ Explorer vào tab.
  const coTep = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  pane.addEventListener('dragover', (e) => {
    if (!coTep(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    thaEl.hidden = false;
  });
  pane.addEventListener('dragleave', (e) => { if (!pane.contains(e.relatedTarget)) thaEl.hidden = true; });
  pane.addEventListener('drop', async (e) => {
    if (!coTep(e)) return;
    e.preventDefault();
    thaEl.hidden = true;
    const ds = duongTuDrop(e);
    if (ds.length) await nhapVa(() => RP.dung.nhap(ds));
  });

  function khoi() {
    if (!RP.dung) { bao('Trình dựng chưa sẵn sàng.', 'loi'); return; }
    /* Gom vào một nhịp khung hình; kéo khối trên timeline (mỗi nhịp chuột một sự kiện 'duAn')
       không đổi gì ở thư viện — chỉ dựng lại khi danh sách media đổi (audit: dựng lại cả lưới
       ảnh mỗi lần chuột di). */
    let henVe = 0;
    let mediaCu = null;
    RP.dung.nghe((loai) => {
      // Chế độ Mẫu: nút "Lưu N khối đang chọn" theo vùng chọn.
      if (loai === 'chon') { if (che === 'mau' && !henVe) henVe = requestAnimationFrame(() => { henVe = 0; ve(); }); return; }
      if (loai === 'duAn') {
        const d = RP.dung.duAn();
        // Ngăn hoàn tác chép sâu mỗi bước — so CHỮ KÝ (id/tệp/tên), không so tham chiếu.
        const m = d ? d.media.map((x) => `${x.id}|${x.tep}|${x.ten}`).join('|') : '';
        if (m === mediaCu) return;
        mediaCu = m;
      }
      if (henVe) return;
      henVe = requestAnimationFrame(() => { henVe = 0; ve(); });
    });
    ve();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', khoi);
  else khoi();

  window.__beeThuVien = { duongTuDrop, nhapVa };
})();
