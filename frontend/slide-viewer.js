'use strict';
/**
 * Xem slide NGAY TRONG APP thay vì bật cửa sổ trắng.
 *
 * Giao diện gốc trích từ `web_server.py` dựng nút "Xem" thành
 *     <a href="/slide/<tên>/" target="_blank">
 * tức đường dẫn của HTTP server cũ. App Electron không có server, và
 * `api-shim.js` chỉ chặn `fetch('/api/*')` — thẻ <a> điều hướng thẳng, không đi
 * qua fetch. Kết quả: bấm "Xem" ra một cửa sổ trắng, không xem được gì.
 *
 * Ở đây chặn ở tầng CLICK (capture phase) để không phải sửa `render-page.js` —
 * giữ nguyên tắc đã chốt ở Giai đoạn D: lấy bản mới từ source về là dùng ngay,
 * không phải merge tay.
 */
(function () {
  const api = window.beeknoee;
  if (!api || !api.preview) return;

  // Thanh menu dùng chung (app-bar.js). Có đường lùi tối giản phòng khi thứ tự
  // nạp script bị đổi — thà thanh xấu còn hơn không mở được lớp phủ.
  const appBar = (o) => (window.__beeAppBar
    ? window.__beeAppBar.build(o)
    : Object.assign(document.createElement('header'), { className: 'app-bar' }));
  const addBarButton = (bar, o) => (window.__beeAppBar
    ? window.__beeAppBar.addButton(bar, o)
    : null);

  /** Gỡ vỏ mà ipcRenderer.invoke bọc quanh lỗi, để thông báo đọc được. */
  const clean = (m) => String(m || '')
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');

  /** `/slide/<tên>/` hoặc `beeknoee://slide/<tên>/` -> tên deck */
  function deckNameFromHref(href) {
    if (!href) return null;
    const m = String(href).match(/(?:^|\/)slide\/([^/?#]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  /**
   * `/slide/<tên>/output/final_video.mp4` -> { deck, file }
   *
   * Nút "Mở" của MỖI hàng deck dùng dạng này — 69 link trong trang, cùng lớp
   * lỗi với nút "Xem" và cũng ra cửa sổ trắng. Phải bắt riêng vì regex của
   * `deckNameFromHref` đòi kết thúc ngay sau tên deck.
   */
  function videoFromHref(href) {
    if (!href) return null;
    const m = String(href).match(/(?:^|\/)slide\/([^/?#]+)\/output\/([^/?#]+\.(?:mp4|webm|mov))$/i);
    return m ? { deck: decodeURIComponent(m[1]), file: decodeURIComponent(m[2]) } : null;
  }

  /** Trang của web server cũ mà app desktop không có. */
  const LEGACY_PAGES = {
    '/upload': {
      title: 'Tải deck lên',
      body: 'Trang này thuộc bản web cũ. Ở bản desktop, deck lấy thẳng từ thư mục '
        + 'trên máy — bấm nút "Thư mục…" để chọn thư mục chứa các deck.',
    },
    // `/elevenlabs-guide` ĐÃ GỠ khỏi đây: nội dung nay nằm trong app
    // (`guide.js`). Để lại thì hai lớp cùng bắt một cú bấm, mà lớp này đăng ký
    // TRƯỚC nên nó thắng — đã chụp thấy trang hướng dẫn thật bị ô "thuộc bản
    // web cũ" đè lên.
  };

  function legacyPageFor(href) {
    if (!href) return null;
    const p = String(href).split(/[?#]/)[0];
    return LEGACY_PAGES[p] ? { key: p, ...LEGACY_PAGES[p] } : null;
  }

  // KHÔNG tra `window.__PROJECTS__` nữa.
  //
  // Biến đó là ẢNH CHỤP lúc nạp trang do preload bơm vào một lần. Bảng deck thì
  // render lại về sau (bấm "Làm mới", đổi thư mục nguồn, thêm deck mới), nên DOM
  // có thể chứa deck mà ảnh chụp không có → báo "Không tìm thấy thư mục của
  // deck" dù deck vẫn nằm trong thư mục. Lỗi phụ thuộc thời điểm, chạy thử tự
  // động gần như không tái hiện — người dùng thật gặp ngay.
  //
  // Giờ chỉ truyền TÊN deck xuống main; main đọc thẳng từ đĩa theo thiết lập
  // hiện tại nên luôn đúng tại thời điểm bấm.

  // ------------------------------------------------- trả lời /api cho iframe
  //
  // Trang deck trong iframe không có `window.beeknoee` (preload không vào khung
  // con), nên nó chuyển tiếp `/api/*` lên đây. Ở trang này `fetch` đã bị
  // `api-shim.js` vá sẵn — chỉ việc gọi lại rồi gửi kết quả về.
  //
  // CHỈ nhận từ iframe do chính mình tạo (`apiFrames`) và CHỈ đường dẫn `/api/`.
  // Thiếu hai chốt này thì bất kỳ khung nào cũng gọi được IPC của app.

  /* khung → TÊN deck của nó. Khung (origin riêng `bee-deck://`) chỉ được gọi BA đường deck
     thật sự cần — lời thoại, thiết lập xem trước, nhạc nền — và CHỈ cho chính deck của nó.
     Trước 10/10/2026 cầu chuyển tiếp MỌI `/api/*`: mã deck gọi được cả `/api/project/delete`,
     `/api/render` (tốn lượt), `/api/source-root`… */
  const apiFrames = new Map();
  const DUONG_KHUNG = { '/api/slide-script': ['GET', 'POST'], '/api/preview-settings': ['GET', 'POST'], '/api/preview-bgm': ['POST'] };
  /** Lý do từ chối (chuỗi) hoặc '' khi cho qua. (Thuần — đọc được, thử được.) */
  function chanKhung(deck, url, init) {
    let u;
    try { u = new URL(url, 'http://khung.invalid'); } catch { return 'URL sai'; }
    const pt = DUONG_KHUNG[u.pathname];
    const method = (init && init.method) || 'GET';
    if (!pt || !pt.includes(method)) return `Khung deck không được gọi ${method} ${u.pathname}`;
    let project = u.searchParams.get('project');
    if (method !== 'GET') {
      try { project = (JSON.parse((init && init.body) || '{}') || {}).project; } catch { return 'Thân yêu cầu sai'; }
    }
    if (!deck || project !== deck) return 'Khung deck chỉ được đọc / ghi deck của chính nó';
    return '';
  }

  /* Sân khấu (`render/san-khau.js`) dựng khung deck của RIÊNG nó, nhưng cầu
     `/api/` thì DÙNG CHUNG cái ở đây — khung nào không đăng ký vào
     `apiFrames` sẽ bị chốt an toàn bên dưới bỏ qua, và deck trong đó mất
     sạch đường gọi API mà không báo lỗi gì. */
  {
    const RP = (window.__renderPage = window.__renderPage || {});
    RP.dangKyKhungApi = (f, deck) => { if (f) apiFrames.set(f, String(deck || '')); };
    RP.boKhungApi = (f) => { apiFrames.delete(f); };
  }

  window.addEventListener('message', async (e) => {
    const d = e.data;
    if (!d || d.__beeApi !== 'req') return;
    const khung = [...apiFrames.keys()].find((f) => f.contentWindow === e.source);
    if (!khung) return;
    // Khung tự điều hướng sang trang khác (deck khác) thì không còn là khung đã đăng ký.
    if (e.origin !== String(khung.getAttribute('src') || '').split('/').slice(0, 3).join('/')) return;
    if (typeof d.url !== 'string' || d.url.indexOf('/api/') !== 0) return;
    const chan = chanKhung(apiFrames.get(khung), d.url, d.init);
    if (chan) {
      e.source.postMessage({ __beeApi: 'res', id: d.id, status: 403, body: JSON.stringify({ error: chan }),
        type: 'application/json; charset=utf-8' }, '*');
      return;
    }

    let status = 500;
    let body = JSON.stringify({ error: 'Không gọi được API.' });
    try {
      const init = d.init && d.init.method && d.init.method !== 'GET'
        ? { method: d.init.method, body: d.init.body || undefined,
            headers: { 'Content-Type': 'application/json' } }
        : undefined;
      const res = await fetch(d.url, init);
      status = res.status;
      body = await res.text();
    } catch (err) {
      body = JSON.stringify({ error: clean(err && err.message) });
    }
    e.source.postMessage(
      { __beeApi: 'res', id: d.id, status, body, type: 'application/json; charset=utf-8' },
      '*'
    );
  });

  // ---------------------------------------------------------------- lớp phủ

  let overlay = null;

  function style() {
    if (document.getElementById('bee-viewer-style')) return;
    // CSS của module này nằm ở css/slide-viewer.css (tách 02/09/2026, nạp bằng <link> trong index.html).
  }

  /**
   * Khối "đang tải" — vòng quay + chữ, ở CHÍNH GIỮA khung.
   *
   * ⚠ Trước đây ba chỗ này dùng chung lớp `.err`, tức là kiểu BÁO LỖI: chữ
   * hồng #ffb4c4, canh trái, chặn 620px. Nên lúc đang chờ dựng deck, người
   * dùng thấy một dòng hồng nép ở mép trái — nhìn y như vừa hỏng cái gì.
   *
   * Dùng `position:absolute; inset:0` để canh giữa BẤT KỂ `.stage` đang ở dạng
   * nào: sau lần dựng đầu, stage được gắn thêm lớp `.full` đổi `align-items`
   * thành `stretch`, và khi đó flex-center của stage không còn canh giữa nữa.
   */
  const KHOI_DANG_TAI = (chu) =>
    `<div class="dangtai"><span class="vong"></span><span>${chu}</span></div>`;


  function close() {
    if (!overlay) return;
    const deck = overlay.dataset.deck;
    // Tắt theo dõi thư mục TRƯỚC khi bỏ overlay: để lại watcher là nó vẫn bắn
    // sự kiện vào một hàm load() trỏ tới stage đã bị gỡ khỏi DOM.
    if (api.preview.unwatch) api.preview.unwatch().catch(() => {});
    overlay.querySelectorAll('iframe').forEach((f) => apiFrames.delete(f));
    overlay.remove();
    overlay = null;
    document.removeEventListener('keydown', onKey, true);
    // Dọn `_preview.html` để không để rác trong thư mục deck của người dùng.
    if (deck) api.preview.cleanup(deck).catch(() => {});
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  /**
   * MỞ DECK — nay là CHỌN DỰ ÁN, không còn lớp phủ nào nữa.
   *
   * Lớp phủ xem deck toàn màn hình đã gỡ hẳn (15/09/2026): deck nằm thường
   * trú ở giữa trang dựng video (`render/san-khau.js`) và bảng sửa ở cột phải,
   * nên một lớp phủ đè lên tất cả chỉ là một chế độ thứ hai không còn lý do.
   *
   * ⚠ Hàm này VẪN CẦN: mọi thẻ `<a href="/slide/…">` và `window.open('/slide/…')`
   * còn sót từ bản web cũ đều đổ về đây. Bỏ nó là mấy đường đó lại mở ra một
   * cửa sổ trắng — đúng lỗi mà cả tệp này sinh ra để chữa.
   */
  function open(name) {
    const RP = window.__renderPage;
    if (RP && RP.setSelectedProject) RP.setSelectedProject(name);
  }
  // ---------------------------------------------------------------- xem video

  async function openVideo(deck, file) {
    style();
    close();
    overlay = document.createElement('div');
    overlay.id = 'bee-viewer';
    overlay.innerHTML = '<div class="stage">' + KHOI_DANG_TAI('Đang mở video…') + '</div>';

    let dir = null;
    const bar = appBar({ title: deck, note: file, back: true, onHome: close });
    addBarButton(bar, { label: 'Mở thư mục', icon: 'folder', onClick: () => {
      if (dir) api.projects.reveal(dir);
    } });
    overlay.prepend(bar);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey, true);

    const stage = overlay.querySelector('.stage');
    try {
      const r = await api.preview.video(deck, file);
      dir = r.path || r.dir;
      const v = document.createElement('video');
      v.src = r.url;
      v.controls = true;
      v.autoplay = true;
      stage.innerHTML = '';
      stage.appendChild(v);
    } catch (e) {
      stage.innerHTML = `<div class="err">${clean(e.message)}</div>`;
    }
  }

  // ------------------------------------------------------- trang của bản web cũ

  function openNotice(info) {
    style();
    close();
    overlay = document.createElement('div');
    overlay.id = 'bee-viewer';
    overlay.innerHTML = '<div class="stage"><div class="err"></div></div>';
    overlay.querySelector('.err').textContent = info.body;

    const bar = appBar({ title: info.title, onHome: close });
    if (info.link) {
      addBarButton(bar, {
        label: info.linkLabel || 'Mở trang',
        icon: '↗',
        primary: true,
        onClick: () => api.openExternal(info.link),
      });
    }
    overlay.prepend(bar);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey, true);
  }

  // ---------------------------------------------------------------- chặn click
  //
  // Bắt ở pha CAPTURE để chạy trước handler của render-page.js, và chặn cả
  // trường hợp thẻ <a> có target="_blank".
  document.addEventListener(
    'click',
    (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      const href = a.getAttribute('href');

      const vid = videoFromHref(href);
      if (vid) { e.preventDefault(); e.stopPropagation(); openVideo(vid.deck, vid.file); return; }

      const name = deckNameFromHref(href);
      if (name) { e.preventDefault(); e.stopPropagation(); open(name); return; }

      const page = legacyPageFor(href);
      if (page) { e.preventDefault(); e.stopPropagation(); openNotice(page); }
    },
    true
  );

  // Chặn nốt đường window.open — `render-page.js:1401` gọi thẳng
  // `/api/social/youtube/connect`, cũng là đường của server cũ.
  const nativeOpen = window.open;
  window.open = function (url, ...rest) {
    const vid = videoFromHref(url);
    if (vid) { openVideo(vid.deck, vid.file); return null; }
    const name = deckNameFromHref(url);
    if (name) { open(name); return null; }
    const page = legacyPageFor(url);
    if (page) { openNotice(page); return null; }
    if (typeof url === 'string' && url.startsWith('/api/')) {
      openNotice({
        title: 'Chưa có ở bản desktop',
        body: `Chức năng này gọi \`${url}\` của bản web cũ, chưa chuyển sang bản desktop.`,
      });
      return null;
    }
    return nativeOpen.call(window, url, ...rest);
  };
})();
