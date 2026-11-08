'use strict';
/**
 * TAB RIÊNG ở bảng phải — "Thuộc tính" (bang-khoi.js) và "Thư viện" (thu-vien.js) — đứng sau các tab của
 * bảng sửa deck ("Nội dung", "Âm thanh" — bang-sua.js). GĐ1 lộ trình gộp slide + timeline (16/10/2026,
 * docs/video-editor/LO-TRINH-GOP-SLIDE-TIMELINE.md).
 *
 * Một lúc chỉ MỘT tab mở: mở tab riêng là ẩn `#bsThan` của bảng sửa (và bỏ tô nút tab của nó, nhớ lại để
 * trả về khi đóng); bấm một tab của bảng sửa là đóng tab riêng đang mở.
 *
 * ⚠ `bang-sua.js#dung()` ghi đè `#bangSua.innerHTML` lúc DOMContentLoaded — mọi nút / thân tab riêng phải
 * gắn SAU lượt đó (dangKy trả false khi khung chưa có ⇒ bên gọi thử lại).
 */
(function () {
  const RP = (window.__renderPage = window.__renderPage || {});
  const KHOA = 'bee:bang-phai:tab-rieng';
  const ds = new Map();   // ma → { nut, than, thuTu, onDoi }
  let dang = null;
  let daGanHang = false;

  const hang = () => document.querySelector('#bangSua .bs-tab');
  const thanBs = () => document.querySelector('#bsThan');
  const luu = (ma) => { try { localStorage.setItem(KHOA, ma || ''); } catch { /* không có kho */ } };

  function ganHang(h) {
    if (daGanHang) return;
    daGanHang = true;
    // Bấm tab CỦA BẢNG SỬA: đóng tab riêng TRƯỚC khi bảng sửa vẽ tab của nó (pha bắt — chạy trước onclick).
    h.addEventListener('click', (e) => {
      if (e.target.closest('[data-tab]') && dang) dong();
    }, true);
  }

  /**
   * @param {string} ma 'khoi' | 'thuvien'
   * @param {{ ten: string, icon: string, than: HTMLElement, thuTu: number, dau?: boolean, onDoi?: (bat: boolean) => void }} o
   *   `dau`: nút đứng ĐẦU hàng tab (trước cả tab của bảng sửa) — Thư viện.
   * @returns {boolean} false = khung bảng sửa chưa dựng xong, gọi lại sau
   */
  function dangKy(ma, o) {
    const h = hang();
    const tb = thanBs();
    if (!h || !tb) return false;
    if (ds.has(ma)) return true;
    ganHang(h);
    const nut = document.createElement('button');
    nut.type = 'button';
    nut.className = 'bs-tab-nut';
    nut.dataset.tabRieng = ma;
    nut.innerHTML = `<span class="btn-icon" data-icon="${o.icon}"></span><span>${o.ten}</span>`;
    // Giữ đúng thứ tự giữa các tab riêng (Thuộc tính trước Thư viện) dù ai đăng ký trước.
    o.than.hidden = true;
    const sau = [...ds.values()].filter((x) => x.thuTu > o.thuTu).sort((a, b) => a.thuTu - b.thuTu)[0];
    if (o.dau) {
      h.insertBefore(nut, h.firstChild);
      tb.after(o.than);
    } else if (sau && !sau.dau) {
      h.insertBefore(nut, sau.nut);
      sau.than.before(o.than);
    } else {
      h.appendChild(nut);
      // Thân đứng ngay sau thân tab riêng cuối cùng (hoặc sau #bsThan) — vẫn TRƯỚC dòng trạng thái đáy bảng.
      const cuoi = [...ds.values()].sort((a, b) => b.thuTu - a.thuTu)[0];
      (cuoi ? cuoi.than : tb).after(o.than);
    }
    ds.set(ma, { nut, than: o.than, thuTu: o.thuTu, dau: !!o.dau, onDoi: o.onDoi || null });
    nut.addEventListener('click', () => mo(ma));
    if (window.__beeIcons) window.__beeIcons.apply(nut);
    return true;
  }

  function mo(ma) {
    const x = ds.get(ma);
    if (!x) return;
    if (dang === ma) return;
    const cu = dang ? ds.get(dang) : null;
    if (cu) {
      cu.than.hidden = true;
      cu.nut.classList.remove('dang-chon');
    } else {
      // Từ một tab của bảng sửa sang: nhớ nút đang tô để trả lại khi đóng.
      document.querySelectorAll('#bangSua .bs-tab [data-tab]').forEach((n) => {
        n.dataset.rienGiu = n.classList.contains('dang-chon') ? '1' : '';
        n.classList.remove('dang-chon');
      });
      const tb = thanBs();
      if (tb) tb.hidden = true;
    }
    const maCu = dang;
    dang = ma;
    x.nut.classList.add('dang-chon');
    x.than.hidden = false;
    if (maCu && cu && cu.onDoi) cu.onDoi(false);
    if (x.onDoi) x.onDoi(true);
    luu(ma === 'thuvien' ? ma : '');   // chỉ nhớ Thư viện — Thuộc tính đi theo thứ đang chọn
  }

  function dong() {
    if (!dang) return;
    const x = ds.get(dang);
    dang = null;
    if (x) {
      x.than.hidden = true;
      x.nut.classList.remove('dang-chon');
    }
    document.querySelectorAll('#bangSua .bs-tab [data-tab]').forEach((n) => {
      if (n.dataset.rienGiu === '1') n.classList.add('dang-chon');
      n.dataset.rienGiu = '';
    });
    const tb = thanBs();
    if (tb) tb.hidden = false;
    if (x && x.onDoi) x.onDoi(false);
    luu('');
  }

  /* ── THƯ VIỆN (dời từ cột trái 16/10/2026) ─────────────────────────────────
     thu-vien.js dựng ruột vào `#paneThuVien` NGAY lúc nạp script (cột trái). Ở đây chỉ DỜI nguyên nút đó
     (giữ mọi trình xử lý) vào một thân tab của bảng phải.
     Chốt 17/10/2026: Thư viện là tab ĐẦU và MỞ SẴN mỗi lần vào app — tab người dùng xem nhiều nhất; các tab khác
     bấm sang khi cần. */
  function ganThuVien() {
    const pane = document.getElementById('paneThuVien');
    if (!pane) return true;   // bản dựng không có thư viện: thôi
    const than = document.createElement('div');
    than.className = 'bs-than tv-phai';
    than.id = 'bsThuVien';
    if (!dangKy('thuvien', { ten: 'Thư viện', icon: 'phim', than, thuTu: 2, dau: true })) return false;
    pane.classList.remove('rl-pane');
    pane.hidden = false;
    pane.removeAttribute('role');
    than.appendChild(pane);
    mo('thuvien');
    return true;
  }

  function khoi() {
    if (!ganThuVien()) { setTimeout(khoi, 300); }
  }

  RP.tabPhai = { dangKy, mo, dong, dangMo: (ma) => dang === ma, dang: () => dang };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(khoi, 0));
  else setTimeout(khoi, 0);
})();
