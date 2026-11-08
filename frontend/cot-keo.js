'use strict';
/**
 * KÉO GIÃN BA CỘT của trang Dựng video.
 *
 * Bố cục ba cột (`.dashboard-shell.bt-ba-cot`) là một lưới:
 *
 *     var(--bt-cot-trai) | minmax(0, 1fr) | var(--bt-cot-phai)
 *      danh sách dự án      sân khấu         bảng sửa
 *
 * Hai đường kẻ ngăn giữa ba cột trước đây chỉ là viền — nay chúng là chỗ BẤM
 * VÀO KÉO. Kéo là đổi thẳng hai biến trên, cột giữa `1fr` tự nuốt phần dôi ra.
 *
 * ⚠ ĐẶT BIẾN LÊN CHÍNH `.dashboard-shell`, KHÔNG phải lên `:root`. Cùng hai
 * tên biến đó còn được `bien-tap.css` dùng để tính bề ngang khối logo trên
 * thanh trên (`width: calc(var(--nav-w) + var(--bt-cot-trai) - var(--sp-14))`).
 * Ghi đè ở `:root` là khối logo co giãn theo mỗi lần kéo cột — thanh trên nhảy
 * theo cột danh sách, không ai muốn thế.
 *
 * ⚠ KHÔNG dựng tay cầm khi lưới đã rơi về hai cột. Dưới 1180px `bien-tap.css`
 * bỏ cột danh sách xuống dưới, lúc đó đường kẻ thứ nhất không còn ngăn cách gì
 * — để tay cầm ở đó là kéo một thứ không tồn tại.
 */
(() => {
  const SHELL = '.dashboard-shell.bt-ba-cot';
  /* Trần dưới của mỗi cột. Không phải số cho đẹp: dưới mức này thì cột danh
     sách bóp tên dự án còn một hai ký tự, còn bảng sửa thì hai ô chọn của
     thanh kiểu chữ chồng lên nhau (xem chú thích ở `bang-sua.js`). */
  const MIN_TRAI = 260;
  const MIN_PHAI = 300;
  const MIN_GIUA = 420;   // sân khấu hẹp hơn nữa thì khung deck không còn chỗ
  const MAC_DINH = { trai: 340, phai: 360 };
  /* Ngưỡng lưới rơi về hai cột — PHẢI khớp `@media (max-width: 1180px)` trong
     `bien-tap.css`. Lệch một bên là tay cầm hiện ra ở bố cục không có nó. */
  const NGUONG_HAI_COT = 1180;

  let cot = { ...MAC_DINH };
  let henGhi = null;

  const shell = () => document.querySelector(SHELL);

  function ap() {
    const el = shell();
    if (!el) return;
    el.style.setProperty('--bt-cot-trai', cot.trai + 'px');
    el.style.setProperty('--bt-cot-phai', cot.phai + 'px');
    datCho();
  }

  function ghiNho() {
    clearTimeout(henGhi);
    henGhi = setTimeout(() => {
      try { window.beeknoee.settings.set({ btCot: { ...cot } }); } catch { /* không lưu được thì thôi */ }
    }, 400);
  }

  /** Lưới đã rơi về HAI CỘT chưa (cột danh sách tụt xuống hàng dưới). */
  const laHaiCot = () => window.innerWidth <= NGUONG_HAI_COT;

  /** Bó hai số về khoảng dùng được với bề ngang hiện có. */
  function bo(moi) {
    const el = shell();
    const rong = el ? el.getBoundingClientRect().width : 0;
    const trai = Math.max(MIN_TRAI, Math.round(moi.trai));
    const phai = Math.max(MIN_PHAI, Math.round(moi.phai));
    if (!rong) return { trai, phai };
    /* Cột giữa là phần còn lại. Hết chỗ thì NHƯỜNG bằng cách bóp chính cột vừa
       kéo, chứ đừng bóp cột bên kia — người dùng đang cầm cột nào thì cột đó
       phải là cái dừng lại.
       ⚠ Ở bố cục HAI CỘT, cột danh sách nằm nguyên một hàng riêng bên dưới nên
       nó KHÔNG ăn bề ngang của hàng trên. Trừ `trai` vào đây là tính thiếu hơn
       ba trăm pixel, và mỗi lần kéo lại bị bó oan về mức tối thiểu — đo được
       19/09/2026: kéo cho bảng sửa rộng ra mà nó tụt từ 360 xuống 300. */
    const con = rong - (laHaiCot() ? 0 : trai) - phai;
    if (con >= MIN_GIUA) return { trai, phai };
    const thieu = MIN_GIUA - con;
    return moi.dangKeo === 'phai'
      ? { trai, phai: Math.max(MIN_PHAI, phai - thieu) }
      : { trai: Math.max(MIN_TRAI, trai - thieu), phai };
  }

  /* ── Tay cầm ──────────────────────────────────────────────────────────── */
  function datCho() {
    const el = shell();
    if (!el) return;
    const t = el.querySelector('.bt-keo[data-ben="trai"]');
    const p = el.querySelector('.bt-keo[data-ben="phai"]');
    if (t) t.style.left = cot.trai + 'px';
    if (p) p.style.right = cot.phai + 'px';
  }

  function hienTheoBeNgang() {
    const el = shell();
    if (!el) return;
    const hep = window.innerWidth <= NGUONG_HAI_COT;
    el.querySelectorAll('.bt-keo').forEach((x) => {
      /* Hẹp thì CHỈ tay cầm bên trái vô nghĩa (cột danh sách tụt xuống dưới);
         tay cầm bên phải vẫn ngăn sân khấu với bảng sửa nên giữ lại. */
      x.hidden = hep && x.dataset.ben === 'trai';
    });
  }

  function batKeo(tay, e) {
    e.preventDefault();
    const ben = tay.dataset.ben;
    const x0 = e.clientX;
    const dau = { ...cot };
    tay.classList.add('dang-keo');
    document.body.classList.add('bt-dang-keo');

    const di = (ev) => {
      const lech = ev.clientX - x0;
      /* Bên phải kéo NGƯỢC: chuột sang phải là cột phải hẹp lại. */
      const moi = ben === 'trai'
        ? { trai: dau.trai + lech, phai: dau.phai, dangKeo: 'trai' }
        : { trai: dau.trai, phai: dau.phai - lech, dangKeo: 'phai' };
      cot = bo(moi);
      ap();
    };
    const thoi = () => {
      tay.classList.remove('dang-keo');
      document.body.classList.remove('bt-dang-keo');
      window.removeEventListener('pointermove', di);
      window.removeEventListener('pointerup', thoi);
      window.removeEventListener('pointercancel', thoi);
      ghiNho();
    };
    window.addEventListener('pointermove', di);
    window.addEventListener('pointerup', thoi);
    window.addEventListener('pointercancel', thoi);
  }

  /** Bàn phím: mũi tên trái/phải xê 16px, Home trả về mặc định. */
  function phim(tay, e) {
    const ben = tay.dataset.ben;
    const buoc = e.shiftKey ? 48 : 16;
    let moi = null;
    if (e.key === 'ArrowLeft') moi = ben === 'trai' ? { trai: cot.trai - buoc, phai: cot.phai } : { trai: cot.trai, phai: cot.phai + buoc };
    else if (e.key === 'ArrowRight') moi = ben === 'trai' ? { trai: cot.trai + buoc, phai: cot.phai } : { trai: cot.trai, phai: cot.phai - buoc };
    else if (e.key === 'Home') moi = { ...MAC_DINH };
    if (!moi) return;
    e.preventDefault();
    cot = bo({ ...moi, dangKeo: ben });
    ap();
    ghiNho();
  }

  function dungTay(ben, nhan) {
    const tay = document.createElement('div');
    tay.className = 'bt-keo';
    tay.dataset.ben = ben;
    tay.tabIndex = 0;
    tay.setAttribute('role', 'separator');
    tay.setAttribute('aria-orientation', 'vertical');
    tay.setAttribute('aria-label', nhan);
    tay.title = nhan + ' — kéo để đổi bề ngang, bấm đúp để trả về mặc định';
    tay.addEventListener('pointerdown', (e) => batKeo(tay, e));
    tay.addEventListener('keydown', (e) => phim(tay, e));
    tay.addEventListener('dblclick', () => { cot = { ...MAC_DINH }; ap(); ghiNho(); });
    return tay;
  }

  async function khoi() {
    const el = shell();
    if (!el || el.querySelector('.bt-keo')) return;
    try {
      const s = await window.beeknoee.settings.get();
      const c = s && s.btCot;
      if (c && Number.isFinite(c.trai) && Number.isFinite(c.phai)) cot = bo({ ...c });
    } catch { /* chưa có thiết lập thì dùng mặc định */ }
    el.appendChild(dungTay('trai', 'Ranh giới danh sách dự án'));
    el.appendChild(dungTay('phai', 'Ranh giới bảng sửa'));
    ap();
    hienTheoBeNgang();
    /* Đổi bề ngang cửa sổ có thể đẩy cột giữa xuống dưới mức tối thiểu — bó lại
       ngay chứ đừng đợi lần kéo sau. */
    window.addEventListener('resize', () => { cot = bo({ ...cot }); ap(); hienTheoBeNgang(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', khoi);
  } else {
    khoi();
  }
})();
