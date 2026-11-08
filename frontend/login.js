'use strict';
/**
 * Màn hình đăng nhập + nút tài khoản trên thanh menu.
 *
 * Đi theo đúng khuôn `first-run.js`: lớp phủ toàn màn dựng bằng JS, không phải
 * một trang riêng — app chỉ nạp `index.html`, thêm trang thứ hai là phải dựng
 * cả đường điều hướng cho một màn hình hiện đúng một lần.
 *
 * Đăng nhập 100% bằng Google: mở TRÌNH DUYỆT HỆ THỐNG (Google chặn OAuth trong
 * webview nhúng), bắt mã ở cổng loopback, đổi ID token lấy phiên của app. Cần
 * chủ dự án cấu hình GOOGLE_CLIENT_ID; thiếu thì nút báo lỗi rõ, không giả vờ.
 * Nút "Dùng thử chưa đăng nhập" CHỈ có ở bản chạy từ mã nguồn.
 */
(() => {
  const api = window.beeknoee;
  if (!api || !api.auth) return;

  const clean = (m) => String(m || 'Lỗi không rõ')
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');

  let el = null;

  function style() {
    if (document.getElementById('bee-login-style')) return;
    // CSS của module này nằm ở css/login.css (tách 02/09/2026, nạp bằng <link> trong index.html).
  }

  /**
   * Chỉ CÒN một chế độ: đăng nhập bằng Google. Email/mật khẩu, đăng ký và quên
   * mật khẩu đã gỡ hẳn — 100% qua Google (máy chủ tài khoản trả 410 cho các
   * đường cũ). Giữ dạng bảng `CHE_DO` để `paint()` không phải viết lại.
   */
  const CHE_DO = {
    login: {
      tieuDe: 'Đăng nhập',
      phu: 'Đăng nhập bằng Google để đồng bộ gói dịch vụ và quản lý thiết bị.',
    },
  };

  let cheDo = 'login';
  let trangThai = null;

  /* Bảng tài khoản chia 3 TAB như Bee Platform (28/09/2026, chủ dự án yêu cầu): Thông tin (gói + hồ sơ cá nhân
     dùng chung Bee Account) · Doanh nghiệp (thông tin xuất hoá đơn) · Cài đặt (giao diện, cỡ chữ, AI, phiên bản).
     Giữ tab đang mở ở ĐÂY chứ không trong DOM: `paintAccount()` vẽ lại cả thẻ (vd lúc đổi Sáng/Tối) — không nhớ
     thì đang ở Cài đặt bấm đổi nền là bị đá về tab đầu. Mở bảng mới thì về "Thông tin". */
  const TAB_TK = [
    { id: 'thongtin', ten: 'Thông tin', icon: 'user' },
    { id: 'doanhnghiep', ten: 'Doanh nghiệp', icon: 'toanha' },
    { id: 'caidat', ten: 'Cài đặt', icon: 'gear' },
  ];
  let tabTK = 'thongtin';

  // Esc để đóng: popup tài khoản luôn đóng được; màn đăng nhập chỉ đóng ở bản
  // dev (bản phát hành bắt buộc đăng nhập, đừng cho Esc lách ra).
  function onEsc(e) {
    if (e.key !== 'Escape') return;
    if (cheDo === 'account' || trangThai?.isDev) close();
  }

  function render(state) {
    trangThai = state;
    el = document.createElement('div');
    el.id = 'bee-login';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    document.body.appendChild(el);
    document.addEventListener('keydown', onEsc);
    paint();
  }

  /* ⚠ TỪNG CÓ `theTaiKhoan` Ở ĐÂY — gỡ 16/09/2026, đừng đưa lại.
     Nó chọn vẽ PHẦN THÔNG TIN hay PHẦN CÀI ĐẶT tuỳ nút nào mở bảng, nên cùng
     một cái popup mà mở từ hai chỗ lại ra hai mặt khác hẳn nhau: người dùng
     đang xem gói cước, muốn đổi cỡ chữ thì phải đóng đi, tìm nút khác ở đáy
     thanh trái, mở lại. Nay MỘT thẻ có cả hai, mở từ đâu cũng thấy đủ. */

  const ngayVN = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
  };

  /**
   * Số hiệu bản đang chạy.
   *
   * ⚠ `version-badge.js` đọc nó bằng `appInfo()` — một lời gọi BẤT ĐỒNG BỘ chạy
   * lúc nạp trang. Mở bảng trước khi lời gọi đó về thì ra `'?'`; chấp nhận, còn
   * hơn để hàng "Phiên bản" trống rồi nhảy số sau.
   */
  function banApp() {
    return (window.__beeVersion && window.__beeVersion.so) || '?';
  }

  /** Còn bao nhiêu ngày nữa hết hạn. Âm = đã hết. */
  function conLai(v) {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return Math.ceil((d - Date.now()) / 86400000);
  }

  /**
   * Popup tài khoản — NEO dưới nút ở đáy thanh trái, không phải giữa màn hình.
   *
   * Popup giữa màn hình là kiểu của hộp thoại chặn việc; đây chỉ là một bảng
   * phụ, neo cạnh nút bấm ra nó thì mắt không phải nhảy đi đâu.
   */
  function paintAccount() {
    const s = trangThai;
    const sub = s.subscription || {};
    const goi = sub.plan || 'free';
    const laTraPhi = goi !== 'free';
    const con = conLai(sub.currentPeriodEnd);

    el.classList.add('popup', 'neo');
    el.innerHTML = `
      <div class="card">
        <div class="tk-dau">
          ${/* Nút Nâng cấp / Gia hạn ở BÊN PHẢI hàng tên + email (28/09/2026, chủ dự án yêu cầu) — thấy ngay dù đang
                ở tab nào, không chiếm cả một hàng rộng trong tab Thông tin nữa. */ ''}
          <div class="tk-dau-trai">
          <div class="tk-ten">
            <span class="btn-icon tk-ic" data-icon="user"></span>
            <span class="tk-ten-chu">${esc(s.user?.name || 'Tài khoản')}</span>
            ${laTraPhi
              ? `<span class="tk-huy" title="Gói ${esc(goi.toUpperCase())}"><span class="btn-icon" data-icon="crown"></span><span>${esc(goi.charAt(0).toUpperCase() + goi.slice(1))}</span></span>`
              : `<span class="tk-huy free">Free</span>`}
          </div>
          <div class="tk-mail">
            <span class="btn-icon tk-ic" data-icon="mail"></span>
            <span>${esc(s.user?.email || '')}</span>
          </div>
          </div>
          <button class="primary tk-nangcap" id="bee-nangcap" type="button">
            <span class="btn-icon" data-icon="${laTraPhi ? 'refresh' : 'the'}"></span>
            <span>${laTraPhi ? 'Gia hạn gói' : 'Nâng cấp gói'}</span>
          </button>
        </div>
        ${laTraPhi && con != null && con <= 7
          ? `<div class="tk-nhac tk-nhac-dau">Gói sắp hết hạn. Gia hạn trước ${esc(ngayVN(sub.currentPeriodEnd))} để không bị gián đoạn.</div>`
          : ''}
        <div class="tk-tabs" role="tablist">
          ${TAB_TK.map((t) => `
            <button type="button" role="tab" class="tk-tab${t.id === tabTK ? ' dang-mo' : ''}" data-tab="${t.id}"
                    aria-selected="${t.id === tabTK}">
              <span class="btn-icon" data-icon="${t.icon}" aria-hidden></span><span>${t.ten}</span>
            </button>`).join('')}
        </div>
        <div class="tk-than">
          <section class="tk-panel" data-panel="thongtin" ${tabTK === 'thongtin' ? '' : 'hidden'}>
            <div id="bee-hs-canhan"></div>
          </section>
          <section class="tk-panel" data-panel="doanhnghiep" ${tabTK === 'doanhnghiep' ? '' : 'hidden'}>
            <div id="bee-hs-hoadon"></div>
          </section>
          <section class="tk-panel" data-panel="caidat" ${tabTK === 'caidat' ? '' : 'hidden'}>
          ${/* Thông tin GÓI (trạng thái, số máy, hết hạn) ở tab Cài đặt — 28/09/2026 chủ dự án yêu cầu. */ ''}
          <dl class="tk">
            <div><dt><span class="btn-icon tk-ic" data-icon="ok"></span>Trạng thái</dt><dd>${esc(sub.status || 'active')}</dd></div>
            <div><dt><span class="btn-icon tk-ic" data-icon="monitor"></span>Số máy tối đa</dt><dd>${esc(sub.maxDevices ?? 2)}</dd></div>
            ${laTraPhi ? `<div><dt><span class="btn-icon tk-ic" data-icon="calendar"></span>Hết hạn</dt><dd>${esc(ngayVN(sub.currentPeriodEnd))}</dd></div>` : ''}
          </dl>
          <div class="tk-caidat">
            <div class="tk-hang">
              <span>Giao diện</span>
              ${/* MỘT nút thay cho hai (20/09/2026, chủ dự án yêu cầu). Hai nút
                    Sáng/Tối là một cặp loại trừ nhau, mà cặp loại trừ chỉ có
                    đúng hai vế thì một công tắc nói đủ — và đỡ một nút luôn
                    nằm đó ở trạng thái mờ. Nhãn + icon đặt bằng JS ở dưới. */ ''}
              <div class="tk-theme">
                <button type="button" class="tk-theme-1" id="bee-theme-nut">
                  <span class="btn-icon" data-icon="sun"></span><span data-chu></span>
                </button>
              </div>
            </div>
            <div class="tk-hang">
              <span>Cỡ chữ</span>
              <div class="tk-chon" id="bee-zoom-chon"></div>
            </div>
            ${/* Hàng PHIÊN BẢN: số hiệu + huy hiệu trạng thái + nút kiểm tra.
                  Trước đây chỗ này là một nút "Kiểm tra cập nhật" trần, không hề
                  nói app đang ở bản nào — mà đó mới là câu hỏi người ta mở bảng
                  này để tìm. Nay số hiệu đứng trước, huy hiệu trả lời luôn "có
                  bản mới chưa", nút chỉ còn là icon cho ai muốn hỏi lại. */ ''}
            ${/* Cửa vào CÀI ĐẶT AI. Đặt ở đây chứ không thêm một trang mới:
                  chủ dự án chốt "có nút cài đặt mở pop là được" (16/09/2026). */ ''}
            <div class="tk-hang">
              <span>AI</span>
              <button type="button" class="tk-nut-tran" id="bee-ai-caidat">
                <span class="btn-icon" data-icon="bee" aria-hidden></span>
                <span>Cài đặt AI</span>
              </button>
            </div>
            <div class="tk-hang">
              <span>Phiên bản</span>
              <span class="tk-ver">
                <button type="button" class="tk-ver-so" id="bee-ver-so"
                        title="Xem có gì mới" aria-haspopup="dialog">v${esc(banApp())}</button>
                <span class="tk-ver-nhan" id="bee-ver-nhan" hidden></span>
                <button type="button" class="tk-ver-kiem" id="bee-check-update"
                        title="Kiểm tra bản cập nhật" aria-label="Kiểm tra bản cập nhật">
                  <span class="tk-quay btn-icon" data-icon="refresh" aria-hidden></span>
                </button>
              </span>
            </div>
            <div class="tk-ketqua" id="bee-update-ketqua" hidden></div>
          </div>
          </section>
        </div>
        <button class="ghost" id="bee-logout" type="button">Đăng xuất</button>
      </div>`;

    datViTri();

    // ⚠ `icons.js` chỉ quét MỘT LẦN lúc nạp trang, mà popup này dựng sau đó —
    // không gọi lại thì ô `data-icon` trống trơn, nút hiện ra thiếu hình mà
    // không báo lỗi gì. Cùng bẫy `guide.js` đã ghi trong `veTrang()`.
    if (window.__beeIcons) window.__beeIcons.apply(el);

    el.onclick = (e) => { if (e.target === el) close(); };

    /* ---- 3 tab ----
       Đổi tab chỉ ẩn/hiện `section`, KHÔNG vẽ lại: các nút trong tab Cài đặt (cỡ chữ, cập nhật…) đã gắn sự kiện
       ở dưới, vẽ lại là mất. Đổi tab thì bỏ chế độ sửa hồ sơ đang dở (như Platform). Thẻ đổi chiều cao ⇒ neo lại. */
    el.querySelectorAll('.tk-tab').forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        tabTK = b.dataset.tab;
        el.querySelectorAll('.tk-tab').forEach((x) => {
          const mo = x.dataset.tab === tabTK;
          x.classList.toggle('dang-mo', mo);
          x.setAttribute('aria-selected', String(mo));
        });
        el.querySelectorAll('.tk-panel').forEach((p) => { p.hidden = p.dataset.panel !== tabTK; });
        if (window.__beeHoSo) window.__beeHoSo.thoiSua();
        datViTri();
      };
    });
    // Hồ sơ người mua dùng chung (Bee Account) — ho-so.js vẽ + tải mới mỗi lần mở bảng.
    if (window.__beeHoSo) {
      window.__beeHoSo.mo(el.querySelector('#bee-hs-canhan'), el.querySelector('#bee-hs-hoadon'));
    }
    /* ---- Giao diện: MỘT công tắc ----
       Nút hiện TRẠNG THÁI ĐANG DÙNG (mặt trời = đang nền sáng), còn việc nó
       làm thì nằm ở tooltip. Đây là lối đọc đúng với cái nhãn bên trái:
       hàng tên là "Giao diện", nên ô bên phải phải trả lời "đang là gì", không
       phải "bấm sẽ ra gì". */
    const nutTheme = el.querySelector('#bee-theme-nut');
    if (nutTheme) {
      const hienTai = localStorage.getItem('bee-theme') || 'light';
      const laSang = hienTai !== 'dark';
      const ico = nutTheme.querySelector('[data-icon]');
      const chu = nutTheme.querySelector('[data-chu]');
      if (ico) ico.dataset.icon = laSang ? 'sun' : 'moon';
      if (chu) chu.textContent = laSang ? 'Sáng' : 'Tối';
      /* ⚠ Đổi `data-icon` xong PHẢI gọi lại `apply()` — nó chỉ thay ruột những
         phần tử có mặt lúc nó chạy, không theo dõi thuộc tính đổi về sau. */
      if (window.__beeIcons) window.__beeIcons.apply(nutTheme);
      nutTheme.title = laSang ? 'Đang dùng nền sáng — bấm để chuyển sang nền tối'
        : 'Đang dùng nền tối — bấm để chuyển sang nền sáng';
      nutTheme.setAttribute('aria-label', nutTheme.title);
      nutTheme.onclick = () => {
        /* Gọi THẲNG `applyTheme`, đừng bấm hộ `[data-theme-toggle]`: nút đó đã
           gỡ khỏi thanh trên (15/09/2026) nên `querySelector` trả null và cụm
           đổi nền ở đây chết lặng — `if (nut)` che mất luôn triệu chứng. */
        const RP = window.__renderPage;
        if (RP && RP.applyTheme) RP.applyTheme(laSang ? 'dark' : 'light');
        paintAccount();   // vẽ lại để nút mang icon + nhãn của nền mới
      };
    }
    /* ---- Cỡ chữ ----
       Mức đang dùng phải HỎI tiến trình chính (nó giữ trạng thái thật, xem
       `main.js` khối "phóng to"), nên dựng bằng JS chứ không viết cứng ở trên.

       Năm mức: 90 để xem được nhiều hơn trên màn nhỏ, rồi 100/125/150 — đúng ba
       mức mà app tự chọn theo màn hình — và 175 cho ai cần to hơn nữa. Muốn mức
       lẻ giữa chừng thì vẫn còn Ctrl +/− (bước 10%, tự do trong 70–200%). */
    const oZoom = el.querySelector('#bee-zoom-chon');
    if (oZoom && api.zoom) {
      const MUC = [0.9, 1, 1.25, 1.5, 1.75];
      api.zoom.get().then(({ zoom, macDinh }) => {
        /* Ô CHỌN XỔ XUỐNG thay cho hàng 5 nút (20/09/2026, chủ dự án yêu cầu).
           Hàng 5 nút phải nhét vào ~300px còn lại của một card rộng 420px, nên
           mỗi nút chỉ còn ~30px: con số dính sát nhau, phải bỏ cả ký hiệu %,
           và chấm • đánh dấu mức mặc định thì bé tới mức không ai thấy. Ô chọn
           trả lại chỗ để viết đủ "100%" và một dòng phụ nói mức đó là gì. */
        const ten = (m) => `${Math.round(m * 100)}%`;
        const laMacDinh = (m) => Math.abs(m - macDinh) < 0.01;
        let dangChon = MUC.find((m) => Math.abs(zoom - m) < 0.01);
        /* Ctrl +/− cho bước 10% tự do, nên mức đang dùng có thể KHÔNG nằm trong
           năm mức. Đừng ép nó về mức gần nhất — hiện đúng con số thật, và để
           danh sách không đánh dấu gì cả. */
        const ngoaiThang = dangChon === undefined;

        oZoom.innerHTML = `
          <button type="button" class="tk-chon-nut" aria-haspopup="listbox" aria-expanded="false">
            <span class="tk-chon-gia">${esc(ten(ngoaiThang ? zoom : dangChon))}</span>
            <span class="btn-icon tk-chon-mui" data-icon="xuong" aria-hidden></span>
          </button>
          <div class="tk-chon-ds" role="listbox" hidden>
            ${MUC.map((m) => `
              <button type="button" role="option" data-zoom="${m}"
                      aria-selected="${!ngoaiThang && m === dangChon}"
                      class="${!ngoaiThang && m === dangChon ? 'dang-chon' : ''}">
                <span class="tk-chon-so">${esc(ten(m))}</span>
                ${laMacDinh(m) ? '<span class="tk-chon-phu">app tự chọn cho màn này</span>' : ''}
                <span class="btn-icon tk-chon-dau" data-icon="check" aria-hidden></span>
              </button>`).join('')}
          </div>`;
        if (window.__beeIcons) window.__beeIcons.apply(oZoom);

        const nut = oZoom.querySelector('.tk-chon-nut');
        const ds = oZoom.querySelector('.tk-chon-ds');
        const dongDs = () => { ds.hidden = true; nut.setAttribute('aria-expanded', 'false'); };
        const moDs = () => {
          ds.hidden = false;
          nut.setAttribute('aria-expanded', 'true');
          /* ⚠ LẬT LÊN KHI KHÔNG ĐỦ CHỖ. Bảng tài khoản neo ở ĐÁY thanh trái nên
             hàng "Cỡ chữ" nằm sát mép dưới màn hình. Đo 20/09/2026 ở mức 150%:
             danh sách cao 181px xổ xuống từ y=635, chạm 816 trong một khung cao
             816 — mất đứt mục cuối, mà đó lại là mức to nhất, thứ người cần
             phóng chữ đi tìm đầu tiên. Đo RỒI mới quyết, đừng đoán theo số mục:
             chiều cao danh sách đổi theo mức phóng đang dùng.
             Bỏ lớp trước khi đo — còn lớp cũ thì đo ra vị trí đã lật. */
          /* ⚠ ĐẶT `fixed` THEO TOẠ ĐỘ NÚT (28/09/2026). Từ khi bảng có 3 tab + form, thẻ `.card` cuộn dọc
             (`overflow: hidden auto`) ⇒ danh sách `absolute` bên trong bị THẺ cắt (không phải màn hình): lật
             theo đáy cửa sổ như trước vẫn mất nửa danh sách. `fixed` thoát khỏi vùng cắt của thẻ; vẫn đo rồi
             mới lật (không đủ chỗ bên dưới thì mở lên trên). Cuộn thẻ ⇒ đóng, khỏi trôi lệch khỏi nút. */
          ds.classList.remove('len');
          const r = nut.getBoundingClientRect();
          const h = ds.offsetHeight;
          const LE = 8;
          ds.style.position = 'fixed';
          ds.style.right = `${Math.max(LE, Math.round(window.innerWidth - r.right))}px`;
          ds.style.left = 'auto';
          ds.style.bottom = 'auto';
          ds.style.top = r.bottom + 4 + h > window.innerHeight - LE
            ? `${Math.max(LE, Math.round(r.top - 4 - h))}px`
            : `${Math.round(r.bottom + 4)}px`;
          const card = el.querySelector('.card');
          if (card) card.addEventListener('scroll', dongDs, { once: true });
        };
        nut.onclick = (e) => { e.stopPropagation(); if (ds.hidden) moDs(); else dongDs(); };
        /* Bấm ra ngoài / Esc thì đóng. ⚠ Nghe trên chính `el` (lớp phủ của
           popup) chứ không phải `document`: popup này tự gỡ khỏi tài liệu khi
           đóng, nghe ở `document` là để lại một trình xử lý mồ côi mỗi lần mở. */
        el.addEventListener('click', () => { if (!ds.hidden) dongDs(); });
        el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ds.hidden) { e.stopPropagation(); dongDs(); } });
        ds.onclick = (e) => e.stopPropagation();

        ds.querySelectorAll('[data-zoom]').forEach((b) => {
          b.onclick = async () => {
            const m = Number(b.dataset.zoom);
            await api.zoom.set(m);
            dangChon = m;
            oZoom.querySelector('.tk-chon-gia').textContent = ten(m);
            ds.querySelectorAll('[data-zoom]').forEach((x) => {
              const chon = Number(x.dataset.zoom) === m;
              x.classList.toggle('dang-chon', chon);
              x.setAttribute('aria-selected', String(chon));
            });
            dongDs();
          };
        });
      }).catch(() => { oZoom.textContent = '—'; });
    }

    /* ---- Kiểm tra cập nhật ----
       Bản chạy từ mã nguồn không có luồng cập nhật (`updater.js` tự tắt), nên
       phải nói thẳng thay vì để nút bấm mãi không ra gì. */
    /* Số hiệu bấm được → bảng "Có gì mới?" (`version-badge.js`). Ô số hiệu ở
       góc màn hình đã gỡ, nên đây là đường DUY NHẤT còn lại vào nhật ký. */
    const nutSo = el.querySelector('#bee-ver-so');
    if (nutSo) {
      nutSo.title = (window.__beeVersion && window.__beeVersion.thuMucApp)
        ? `Bấm để xem có gì mới\nThư mục app: ${window.__beeVersion.thuMucApp}`
        : 'Bấm để xem có gì mới';
      nutSo.onclick = () => {
        close();
        if (window.__beeVersion && window.__beeVersion.moNhatKy) window.__beeVersion.moNhatKy();
      };
    }

    /* Huy hiệu trạng thái. Đọc bằng `status()` chứ KHÔNG bằng `check()`:
       `status()` chỉ trả bản ghi cuối mà `updater.js` giữ sẵn (`update:status`
       là `() => last`), còn `check()` gọi ra máy chủ — mở bảng Cài đặt mà lần
       nào cũng bắn một lượt hỏi mạng là sai việc. Bản đóng gói tự hỏi một lượt
       lúc khởi động nên tới lúc người dùng mở bảng thì đã có kết luận. */
    const oNhan = el.querySelector('#bee-ver-nhan');
    const NHAN = {
      current: ['Mới nhất', ''],
      available: ['Có bản mới', 'tot'],
      downloading: ['Đang tải bản mới', 'tot'],
      ready: ['Mở lại app để cài', 'tot'],
      checking: ['Đang kiểm tra…', ''],
      idle: ['Chưa kiểm tra', ''],
      disabled: ['Không tự cập nhật', ''],
      error: ['Không kiểm tra được', 'xau'],
    };
    const datNhan = (st) => {
      if (!oNhan) return;
      const m = NHAN[(st && st.state) || ''];
      if (!m) { oNhan.hidden = true; return; }
      oNhan.hidden = false;
      oNhan.textContent = m[0];
      oNhan.className = `tk-ver-nhan ${m[1]}`;
    };
    if (oNhan && api.update && api.update.status) {
      api.update.status().then(datNhan).catch(() => { oNhan.hidden = true; });
    }

    const nutAI = el.querySelector('#bee-ai-caidat');
    if (nutAI) {
      nutAI.onclick = () => {
        close();                                   // nhường màn cho popup AI
        /* CHỈ KHOÁ cho AI agent — chọn nhà cung cấp / model là của tab "Tạo bằng AI" đã gỡ (16/10/2026). */
        if (window.__beeAI) window.__beeAI.mo({ chiKhoa: ['beeknoee'], nha: 'beeknoee' });
      };
    }

    const nutUp = el.querySelector('#bee-check-update');
    const oKq = el.querySelector('#bee-update-ketqua');
    if (nutUp && oKq && api.update) {
      const hien = (chu, tone) => {
        oKq.hidden = false;
        oKq.textContent = chu;
        oKq.className = `tk-ketqua ${tone || ''}`;
      };
      nutUp.onclick = async () => {
        nutUp.disabled = true;
        nutUp.classList.add('dang-quay');
        datNhan({ state: 'checking' });
        try {
          const st = await api.update.check();
          const s = st && st.state;
          datNhan(st);
          /* Bảy trạng thái `updater.js` có thể trả (đã liệt kê từ mã nguồn):
             available · checking · current · disabled · downloading · error · ready.
             ⚠ Phải bắt `checking` RIÊNG. Để nó rơi vào nhánh mặc định là báo
             "đang dùng bản mới nhất" trong khi thực ra CHƯA có kết luận —
             người dùng tin lời đó rồi bỏ qua một bản vá thật. */
          if (s === 'disabled') hien(st.reason || 'Bản này không tự cập nhật.', '');
          else if (s === 'checking') hien('Máy chủ chưa trả lời kịp — thử lại sau giây lát.', '');
          else if (s === 'available' || s === 'downloading') hien('Có bản mới — đang tải về.', 'tot');
          else if (s === 'ready') hien('Bản mới đã tải xong, mở lại app để cài.', 'tot');
          else if (s === 'error') hien(st.message || 'Không kiểm tra được.', 'xau');
          else if (s === 'current') hien('Bạn đang dùng bản mới nhất.', '');
          else hien('Không rõ trạng thái cập nhật.', '');
        } catch (e) {
          hien(e?.message || 'Không kiểm tra được.', 'xau');
          datNhan({ state: 'error' });
        }
        nutUp.disabled = false;
        nutUp.classList.remove('dang-quay');
      };
    }

    const nc = el.querySelector('#bee-nangcap');
    if (nc) {
      nc.onclick = () => {
        close();
        /* Người ĐANG trả phí bấm "Gia hạn gói" thì đi thẳng tới trang thanh
           toán — họ đã biết gói có gì rồi, bắt xem lại bảng tính năng là thêm
           một cú bấm vô nghĩa. Người chưa trả phí thì vẫn qua trang Nâng cấp
           để xem gói gồm những gì trước khi quyết. */
        // Một trang duy nhất cho cả nâng cấp lẫn gia hạn — xem chú thích ở mục
        // 'thanhtoan' trong pages.js.
        if (window.__beePages) window.__beePages.moTrang('thanhtoan');
      };
    }
    el.querySelector('#bee-logout').onclick = async () => {
      const st = await api.auth.logout();
      paintAccountButton(st);
      trangThai = st;
      cheDo = 'login';
      el.classList.remove('popup', 'neo');
      el.style.cssText = '';
      paint();
      showMsg('Đã đăng xuất.', true);
    };
  }

  /**
   * Neo thẻ theo NÚT TÀI KHOẢN, dù nút đó đứng ở đâu.
   *
   * Bản trước neo cứng "bên phải nút, căn mép dưới" vì nút nằm ở đáy thanh dọc
   * bên trái. Từ 10/09/2026 nút chuyển lên góc trên bên PHẢI của thanh trên —
   * giữ nguyên cách neo cũ là thẻ bay hẳn ra ngoài mép phải màn hình
   * (left = r.right + 10, mà r.right lúc này gần bằng innerWidth).
   *
   * Nay chọn hướng theo vị trí thật: nút ở nửa TRÊN màn hình thì thả xuống dưới
   * và căn mép phải; nút ở nửa DƯỚI thì giữ đúng nếp cũ. Không đoán theo tên
   * lớp hay theo chỗ nút được gắn — đo toạ độ thì đổi chỗ nút lần nữa cũng
   * không phải sửa lại hàm này.
   */
  /**
   * Nút NÀO vừa mở bảng — bảng neo theo chính nó.
   *
   * Trước đây neo cứng vào nút tài khoản, nên bấm "Cài đặt" ở ĐÁY thanh dọc mà
   * bảng lại bay lên góc trên bên phải, cạnh một cái nút khác hẳn. Mắt vừa bấm
   * ở dưới thì phải nhảy lên trên tìm kết quả.
   */
  let neoTheo = null;

  function datViTri() {
    const nut = neoTheo || document.getElementById('bee-account-btn');
    const card = el.querySelector('.card');
    if (!nut || !card) return;
    const r = nut.getBoundingClientRect();
    const LE = 10;
    card.style.position = 'fixed';
    if (r.top + r.height / 2 < window.innerHeight / 2) {
      card.style.top = `${Math.round(r.bottom + 8)}px`;
      card.style.bottom = 'auto';
      card.style.left = 'auto';
      card.style.right = `${Math.max(LE, Math.round(window.innerWidth - r.right))}px`;
    } else {
      card.style.left = `${Math.round(r.right + LE)}px`;
      card.style.right = 'auto';
      card.style.bottom = `${Math.max(LE, Math.round(window.innerHeight - r.bottom))}px`;
      card.style.top = 'auto';
    }
  }

  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  function paint() {
    if (cheDo === 'account') return paintAccount();
    // Rời khỏi chế độ popup thì phải gỡ lớp nền mờ, nếu không màn đăng nhập
    // hiện ra vẫn nhìn xuyên xuống app phía sau.
    el.classList.remove('popup', 'neo');
    el.onclick = null;
    const m = CHE_DO[cheDo];
    // Giữ lại giá trị đã gõ khi đổi chế độ — bắt gõ lại email chỉ vì bấm nhầm
    // "Quên mật khẩu" là chuyện nhỏ mà rất khó chịu.
    const giu = {};
    el.querySelectorAll('input[data-o]').forEach((i) => { giu[i.dataset.o] = i.value; });

    // MỘT nút Google — không còn email/mật khẩu. `giu` giữ lại chẳng còn ô nào
    // để giữ, nhưng để nguyên biến cho khỏi vỡ các nhánh khác.
    void giu;
    el.innerHTML = `
      <div class="card">
        <div class="brand"><img class="logo-dark" src="assets/beeknoee-logo.svg" alt="Beeknoee Studio" /><img class="logo-light" src="assets/beeknoee-logo-light.svg" alt="" /></div>
        <h2>${m.tieuDe}</h2>
        <div class="sub">${m.phu}</div>
        <button class="gg-nut" id="bee-google" type="button">
          <span class="gg-logo" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="18" height="18"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          </span>
          Đăng nhập bằng Google
        </button>
        ${trangThai.isDev
          ? '<button class="skip" type="button" id="bee-skip">Dùng thử chưa đăng nhập →</button>'
            + '<div class="note">Nút bỏ qua này CHỈ có ở bản chạy từ mã nguồn. '
            + 'Bản phát hành cho người dùng bắt buộc đăng nhập.</div>'
          : ''}
      </div>`;

    const ggBtn = el.querySelector('#bee-google');
    ggBtn.onclick = submit;
    // Đưa tiêu điểm vào nút chính để bấm Enter/Space là đăng nhập được ngay.
    setTimeout(() => { try { ggBtn.focus(); } catch { /* el có thể đã đóng */ } }, 0);
    const skipBtn = el.querySelector('#bee-skip');
    if (skipBtn) skipBtn.onclick = skip;

    if (!trangThai.canRemember) {
      showMsg('Máy này không lưu được phiên an toàn — mỗi lần mở app sẽ phải đăng nhập lại.');
    }
  }

  const val = (k) => (el.querySelector(`input[data-o="${k}"]`)?.value || '');

  function showMsg(text, tot = false) {
    let box = el.querySelector('.msg');
    if (!box) {
      box = document.createElement('div');
      box.className = 'msg';
      el.querySelector('.card').appendChild(box);
    }
    box.classList.toggle('good', tot);
    box.textContent = text;
  }

  /**
   * Nút "Đăng xuất các máy khác" — chỉ hiện khi máy chủ báo ĐÚNG lỗi quá số máy.
   *
   * Cảnh thật người dùng gặp: đăng nhập 2 máy ở công ty, về nhà mở máy thứ 3 thì
   * bị chặn — mà hai máy kia đang ở chỗ khác, không với tới để gỡ. Trước đây
   * đường duy nhất là quay lại công ty, hoặc chờ 30 ngày cho phiên hết hạn.
   *
   * ⚠ Nhận diện bằng MÃ `QUA_SO_MAY` do máy chủ gửi kèm, KHÔNG dò câu chữ tiếng
   * Việt — máy chủ sửa một chữ là nút này biến mất mà không ai biết.
   */
  function themNutGoMayKhac() {
    if (!el || el.querySelector('#bee-go-may')) return;
    const box = el.querySelector('.msg');
    if (!box) return;
    const b = document.createElement('button');
    b.id = 'bee-go-may';
    b.type = 'button';
    b.className = 'go-may';
    b.textContent = 'Đăng xuất các máy khác và đăng nhập ở đây';
    b.onclick = async () => {
      // Hỏi trước: nó đá người đang dùng máy khác ra thật, không hoàn tác được.
      const hoi = 'Đăng xuất TẤT CẢ các máy khác đang dùng tài khoản này?'
        + String.fromCharCode(10, 10)
        + 'Các máy đó sẽ phải đăng nhập lại. Máy này sẽ được vào ngay.';
      if (!window.confirm(hoi)) return;
      b.disabled = true;
      b.textContent = 'Đang đăng xuất các máy khác…';
      await submit({ goBotMayKhac: true });
      // `submit` tự đóng cửa sổ nếu thành công; còn ở đây tức là vẫn lỗi.
      if (el && el.querySelector('#bee-go-may')) {
        b.disabled = false;
        b.textContent = 'Đăng xuất các máy khác và đăng nhập ở đây';
      }
    };
    box.insertAdjacentElement('afterend', b);
  }

  function goNutGoMayKhac() {
    const b = el && el.querySelector('#bee-go-may');
    if (b) b.remove();
  }

  async function submit(tuyChon = {}) {
    const btn = el.querySelector('#bee-google');
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add('dang-cho');
    const chuCu = btn.lastChild;
    showMsg('Đang mở trình duyệt để đăng nhập Google… Xong ở trình duyệt rồi quay lại đây.', true);

    // Nút Huỷ: cổng loopback chờ tới 5 phút, người dùng đóng tab giữa chừng mà
    // không có đường thoát thì app nhìn y như treo.
    themNutHuy();

    goNutGoMayKhac();   // lần thử mới: dẹp nút cũ đi đã
    try {
      const st = await api.auth.google(tuyChon);
      close();
      paintAccountButton(st);
      // Nhãn "(3/10 lượt miễn phí)" trên nút Tạo video chỉ hỏi máy chủ MỘT LẦN
      // lúc mở app. Ai mở app rồi mới đăng nhập thì lúc đó chưa có phiên, máy
      // chủ không trả gì, và nhãn im lặng cho tới lần mở app sau. Báo cho
      // render_page vẽ lại ngay.
      if (window.__beeRender && window.__beeRender.napHanMuc) window.__beeRender.napHanMuc();
    } catch (e) {
      /* Mã lỗi máy chủ đi kèm ở ĐẦU câu dạng `[MÃ] câu` — xem chú thích ở
         `auth:google` trong main.js (lỗi qua IPC chỉ còn `message`). Tách mã ra
         rồi BỎ khỏi câu trước khi hiện, đừng để người dùng đọc phải nó. */
      const tho = String((e && e.message) || e);
      const khop = clean(tho).match(/^\[([A-Z_]+)\]\s*/);
      const maLoi = khop ? khop[1] : '';
      const msg = khop ? clean(tho).slice(khop[0].length) : tho;
      // Chưa cấu hình Client ID là lỗi của bản dựng, không phải người dùng —
      // nói thẳng để chủ dự án biết thiếu bước nào.
      showMsg(/CLIENT_ID|client id|BEE_ISSUER/i.test(msg)
        ? 'Bản này chưa cấu hình đăng nhập Bee Account. Liên hệ nhà phát triển.'
        : clean(msg));
      /* Quá số máy → mời đăng xuất các máy khác ngay tại đây.
         Nhận diện bằng MÃ máy chủ gửi kèm, không dò câu chữ. `status` 409 là
         lưới đỡ cho bản máy chủ cũ chưa gửi mã. */
      if (maLoi === 'QUA_SO_MAY') themNutGoMayKhac();
    } finally {
      if (el) {
        const b = el.querySelector('#bee-google');
        if (b) { b.disabled = false; b.classList.remove('dang-cho'); }
        goNutHuy();
      }
    }
    void chuCu;
  }

  /** Nút Huỷ hiện trong lúc chờ trình duyệt. */
  function themNutHuy() {
    if (!el || el.querySelector('#bee-google-huy')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'bee-google-huy';
    b.className = 'gg-huy';
    b.textContent = 'Huỷ và thử lại';
    b.onclick = async () => {
      b.disabled = true;
      b.textContent = 'Đang huỷ…';
      // Dẹp phiên ở TIẾN TRÌNH CHÍNH — đóng cổng loopback đang chờ. Không làm
      // thế thì cổng vẫn treo tới 5 phút dù giao diện đã mở lại.
      try { await api.auth.googleHuy(); } catch { /* không sao, vẫn mở khoá nút */ }
      goNutHuy();
      const g = el && el.querySelector('#bee-google');
      if (g) { g.disabled = false; g.classList.remove('dang-cho'); }
      showMsg('Đã huỷ. Bấm "Đăng nhập bằng Google" để thử lại.');
    };
    const card = el.querySelector('.card');
    if (card) card.appendChild(b);
  }

  function goNutHuy() {
    const b = el && el.querySelector('#bee-google-huy');
    if (b) b.remove();
  }

  async function skip() {
    try { await api.auth.skip(); } catch { /* bỏ qua được thì vẫn đóng */ }
    close();
  }

  function close() {
    if (window.__beeHoSo) window.__beeHoSo.dong();
    document.removeEventListener('keydown', onEsc);
    if (el) { el.remove(); el = null; }
    neoTheo = null;
  }

  /**
   * Nút tài khoản trên thanh menu — hiện email khi đã đăng nhập.
   *
   * Lúc BẤM thì đọc lại trạng thái từ tiến trình chính, KHÔNG dùng lại biến
   * `state` bắt được lúc vẽ. Bản đầu đóng gói `state` vào closure nên sau khi
   * phiên đổi ở chỗ khác (hết hạn, đăng xuất từ luồng khác) nút vẫn hành xử
   * theo trạng thái cũ — bấm vào thì mở bảng tài khoản của một phiên đã chết.
   */
  /**
   * Tô lại nút tài khoản — NẾU còn nút nào.
   *
   * ⚠ Từ 16/09/2026 thanh trên KHÔNG CÒN nút tài khoản (`pages.js` thôi dựng):
   * bảng tài khoản và bảng cài đặt đã gộp làm một, mở bằng nút "Cài đặt" ở đáy
   * thanh trái. Hàm này giữ lại vì `boot()` và `window.__beeAuth.lamMoi()` vẫn
   * gọi, và vì bản dựng cũ / trang khác có thể còn nút đó — thấy thì tô, không
   * thấy thì thôi, không phải lỗi.
   */
  function paintAccountButton(state) {
    const btn = document.getElementById('bee-account-btn');
    if (!btn) return;
    btn.classList.toggle('da-dang-nhap', !!state.signedIn);
    btn.title = state.signedIn
      ? `${state.user?.email || ''} · gói ${state.subscription?.plan || 'free'}`
      : 'Đăng nhập tài khoản Beeknoee';
    btn.onclick = async () => {
      // Bấm lần nữa khi popup đang mở là ĐÓNG — nút toggle, không phải nút mở.
      if (el && el.classList.contains('neo')) { close(); return; }
      const moi = await api.auth.state();
      paintAccountButton(moi);
      neoTheo = btn;
      tabTK = 'thongtin';
      cheDo = moi.signedIn ? 'account' : 'login';
      show(moi);
    };
  }

  function show(state) {
    style();
    trangThai = state;
    if (el) paint();
    else render(state);
  }

  async function boot() {
    let state;
    try {
      state = await api.auth.state();
    } catch (e) {
      console.warn('[auth] không đọc được trạng thái:', e.message);
      return;
    }
    // pages.js dựng nút ở đáy thanh trái; nó chạy sau file này nên phải đợi
    // một nhịp, nếu không querySelector trả null và nút không có hành động nào.
    setTimeout(() => paintAccountButton(state), 0);
    // Đã đăng nhập thì thôi. Chưa đăng nhập thì:
    //   - bản dev  : hiện một lần, bấm bỏ qua là không quấy nữa
    //   - bản thật : LUÔN hiện, không có đường vòng (state.isDev = false)
    if (state.signedIn) return;
    if (state.isDev && state.skipped) return;
    show(state);
  }

  // Cho màn thanh toán bảo nút tài khoản tô lại sau khi nâng cấp xong.
  window.__beeAuth = {
    lamMoi: async () => paintAccountButton(await api.auth.state()),
    /**
     * Mở bảng TÀI KHOẢN + CÀI ĐẶT — nút "Cài đặt" ở đáy thanh trái gọi vào đây,
     * và đó là đường DUY NHẤT còn lại.
     *
     * Đường đi của nó: Cài đặt vốn là một THẺ bên trong bảng tài khoản → tách
     * làm hai mặt của cùng một bảng, mở từ hai nút khác nhau → nay GỘP HẲN làm
     * một thẻ, thanh trên bỏ luôn nút tài khoản (chủ dự án yêu cầu 16/09/2026).
     * Lý do cuối cùng cũng là lý do đầu tiên: chỉ có một cái bảng, không có gì
     * để phải chọn trước khi mở.
     *
     * ⚠ Đặt `cheDo = 'account'` kể cả khi chưa đăng nhập, để Cài đặt luôn với
     * tới được: theme, cỡ chữ và nút kiểm tra cập nhật không cần phiên nào cả.
     * Bản phát hành bắt buộc đăng nhập nên nhánh này chỉ gặp ở bản mã nguồn.
     */
    // `tab` (tuỳ chọn): mở thẳng tab đó — trang thanh toán bấm "Chỉnh sửa" hồ sơ hoá đơn thì vào Thông tin / Doanh nghiệp.
    async moCaiDat(nut, tab) {
      // Bấm lần nữa lúc bảng đang mở là ĐÓNG — cùng nếp với nút tài khoản.
      if (el && el.classList.contains('neo')) { close(); return; }
      const st = await api.auth.state();
      paintAccountButton(st);
      // Neo theo chính nút Cài đặt, không phải nút tài khoản trên thanh trên.
      neoTheo = nut || document.getElementById('bee-caidat-btn') || null;
      cheDo = 'account';
      tabTK = TAB_TK.some((t) => t.id === tab) ? tab : 'thongtin';
      show(st);
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
