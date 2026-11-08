'use strict';
/**
 * Nút "?" ở góc dưới phải, ngay TRÊN số hiệu bản.
 *
 * Gom hai thứ trước đây nằm rải rác và không ai tìm ra:
 *   · ba hướng dẫn (tạo audio MP3 · lấy API key + Voice ID · cách làm video),
 *     trước chỉ hiện khi người dùng tình cờ mở đúng trang có nút
 *   · nút "Báo lỗi" gửi thẳng về máy chủ
 *
 * Vì sao đặt cạnh số hiệu bản chứ không phải trên thanh điều hướng: hai thứ
 * này đi đôi. Lúc người ta cần báo lỗi thì thứ đầu tiên phải nói là "đang chạy
 * bản nào" — để cạnh nhau thì mắt tự thấy, không phải đi tìm.
 *
 * Mở bằng RÊ CHUỘT, nhưng cũng mở bằng BẤM và bằng bàn phím: chỉ hover thì
 * người dùng bàn phím và màn hình cảm ứng không bao giờ vào được.
 */
(() => {
  const api = window.beeknoee;
  if (!api) return;

  /* Nhật ký lỗi gần nhất, để đính kèm khi người dùng báo lỗi. Vòng tròn 10 mục:
     đủ để thấy chuyện gì vừa xảy ra, không đủ để phình bộ nhớ. */
  const nhatKyLoi = [];
  window.addEventListener('error', (e) => {
    nhatKyLoi.push(`[${new Date().toISOString()}] ${e.message} @ ${e.filename}:${e.lineno}`);
    if (nhatKyLoi.length > 10) nhatKyLoi.shift();
  });
  window.addEventListener('unhandledrejection', (e) => {
    nhatKyLoi.push(`[${new Date().toISOString()}] promise: ${e.reason?.message || e.reason}`);
    if (nhatKyLoi.length > 10) nhatKyLoi.shift();
  });

  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  let daCss = false;
  function css() {
    if (daCss) return;
    daCss = true;
    // CSS của module này nằm ở css/help-hub.css (tách 02/09/2026, nạp bằng <link> trong index.html).
  }

  /* ------------------------------------------------------------- hộp báo lỗi */

  function dongHopLoi() {
    document.getElementById('bee-loi-nen')?.remove();
  }

  async function batDauGuiLoi(nen) {
    const oMoTa = nen.querySelector('#bee-loi-mota');
    const oKemKT = nen.querySelector('#bee-loi-kem');
    const nutGui = nen.querySelector('#bee-loi-gui');
    const ketQua = nen.querySelector('#bee-loi-ketqua');
    const moTa = oMoTa.value.trim();

    if (!moTa) {
      ketQua.className = 'loi-ketqua xau';
      ketQua.textContent = 'Viết vài dòng mô tả trước đã — không có mô tả thì gần như không sửa được.';
      oMoTa.focus();
      return;
    }

    nutGui.disabled = true;
    nutGui.textContent = 'Đang gửi…';
    ketQua.className = 'loi-ketqua';
    ketQua.textContent = '';

    let r;
    try {
      r = await api.baoLoi.gui({
        moTa,
        keoTheoKyThuat: oKemKT.checked,
        boiCanh: { nhatKy: nhatKyLoi.join('\n') },
      });
    } catch (e) {
      r = { ok: false, loi: e?.message || String(e) };
    }

    if (!r || !r.ok) {
      nutGui.disabled = false;
      nutGui.textContent = 'Gửi báo lỗi';
      ketQua.className = 'loi-ketqua xau';
      ketQua.textContent = r?.loi || 'Không gửi được. Thử lại giúp mình.';
      return;
    }

    /* ⚠ `daGui:false` KHÔNG phải thất bại — báo lỗi đã nằm trong hàng đợi trên
       đĩa và sẽ tự gửi ở lần mở app sau. Nói "gửi thất bại" ở đây là khiến
       người ta gõ lại lần nữa, rồi mình nhận hai bản của cùng một chuyện. */
    ketQua.className = 'loi-ketqua tot';
    ketQua.textContent = r.daGui
      ? 'Đã gửi. Cảm ơn bạn — mình sẽ xem và sửa.'
      : 'Đã lưu. Máy đang không nối được máy chủ, app sẽ tự gửi lần mở sau.';
    nutGui.textContent = 'Đã gửi';
    setTimeout(dongHopLoi, 2200);
  }

  async function moHopLoi() {
    css();
    dongHopLoi();

    let tin = {};
    try { tin = await api.appInfo(); } catch { /* không có thì thôi */ }

    const keKhai = [
      `Phiên bản app: ${tin.version || '?'}`,
      `Hệ điều hành: ${navigator.platform || '?'}`,
      'Trạng thái đăng nhập (không gồm mật khẩu hay token)',
      `${nhatKyLoi.length} dòng lỗi kỹ thuật gần nhất, đã xoá tên tài khoản khỏi đường dẫn`,
    ].join('\n');

    const nen = document.createElement('div');
    nen.id = 'bee-loi-nen';
    nen.innerHTML = `
      <div id="bee-loi" role="dialog" aria-modal="true" aria-labelledby="bee-loi-tieu">
        <h2 id="bee-loi-tieu">Báo lỗi</h2>
        <p class="loi-phu">Kể lại bạn đang làm gì thì gặp lỗi, và bạn mong nó chạy ra sao.
          Càng cụ thể càng nhanh sửa được.</p>
        <textarea id="bee-loi-mota" placeholder="Ví dụ: bấm Tạo video ở dự án gia-vang thì chạy tới bước Quay hình rồi dừng, không báo gì."></textarea>
        <label class="loi-chon">
          <input type="checkbox" id="bee-loi-kem" checked />
          <span>Gửi kèm thông tin kỹ thuật. Không có nó thì phần lớn lỗi chỉ đoán được, không tìm ra.</span>
        </label>
        <details>
          <summary>Xem chính xác những gì được gửi đi</summary>
          <pre>${esc(keKhai)}</pre>
        </details>
        <p class="loi-phu" style="margin:12px 0 0">Nội dung slide, giọng đọc và video của bạn
          <b>không</b> được gửi đi.</p>
        <div class="loi-ketqua" id="bee-loi-ketqua"></div>
        <div class="loi-nut">
          <button type="button" id="bee-loi-huy">Huỷ</button>
          <button type="button" class="chinh" id="bee-loi-gui">Gửi báo lỗi</button>
        </div>
      </div>`;

    nen.addEventListener('click', (e) => { if (e.target === nen) dongHopLoi(); });
    nen.querySelector('#bee-loi-huy').addEventListener('click', dongHopLoi);
    nen.querySelector('#bee-loi-gui').addEventListener('click', () => batDauGuiLoi(nen));
    document.addEventListener('keydown', function thoat(e) {
      if (e.key !== 'Escape') return;
      document.removeEventListener('keydown', thoat);
      dongHopLoi();
    });

    document.body.appendChild(nen);
    nen.querySelector('#bee-loi-mota').focus();
  }

  /* ------------------------------------------------------------------ menu */

  /**
   * Mở hướng dẫn làm video ở trang Template.
   *
   * Khác hai hướng dẫn kia: nó không phải một trang riêng mà là một khối gấp
   * nằm trong trang kho mẫu, nên phải chuyển trang RỒI mới bung khối đó.
   * `setTimeout` vì trang đó nạp danh sách mẫu không đồng bộ — nút chưa tồn
   * tại ngay sau khi đổi trang.
   *
   * Trỏ vào trang MẪU DỌC: từ 15/09/2026 kho mẫu tách làm hai trang, và bài
   * hướng dẫn này nói về đường làm video nói chung, không riêng khổ nào.
   */
  function moHuongDanTemplate() {
    window.__beePages?.moTrang('mau-doc');
    let con = 20;
    const thu = () => {
      const nut = document.querySelector('#page-mau-doc [data-mo-hd]');
      if (!nut) { if (--con > 0) setTimeout(thu, 100); return; }
      if (nut.getAttribute('aria-expanded') !== 'true') nut.click();
      nut.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    setTimeout(thu, 80);
  }

  const MUC = [
    { nhan: 'Cách làm video (chi tiết)', chay: moHuongDanTemplate },
    { nhan: 'Tạo audio MP3 bằng ElevenLabs', chay: () => window.__beePages?.moHuongDan('manual') },
    { nhan: 'Lấy API key + Voice ID', chay: () => window.__beePages?.moHuongDan('api-credit') },
  ];

  function dung() {
    css();

    const nut = document.createElement('button');
    nut.id = 'bee-hub';
    nut.type = 'button';
    nut.setAttribute('aria-expanded', 'false');
    nut.setAttribute('aria-label', 'Trợ giúp và báo lỗi');
    nut.textContent = '?';

    const menu = document.createElement('div');
    menu.id = 'bee-hub-menu';
    menu.innerHTML = `
      <div class="hub-nhom">Hướng dẫn</div>
      ${MUC.map((m, i) => `<button type="button" data-hub="${i}">${esc(m.nhan)}</button>`).join('')}
      <hr />
      <button type="button" class="hub-loi" data-hub="loi">Báo lỗi cho Beeknoee</button>`;

    let dongTimer = null;
    const mo = () => {
      clearTimeout(dongTimer);
      menu.classList.add('mo');
      nut.setAttribute('aria-expanded', 'true');
    };
    /* Đóng CÓ TRỄ. Giữa nút và menu có một khoảng hở 6px; đóng ngay khi chuột
       rời nút thì menu biến mất đúng lúc người ta đang đưa chuột sang nó. */
    const dong = () => {
      clearTimeout(dongTimer);
      dongTimer = setTimeout(() => {
        menu.classList.remove('mo');
        nut.setAttribute('aria-expanded', 'false');
      }, 260);
    };

    nut.addEventListener('mouseenter', mo);
    nut.addEventListener('mouseleave', dong);
    nut.addEventListener('focus', mo);
    nut.addEventListener('click', () => (menu.classList.contains('mo') ? dong() : mo()));
    menu.addEventListener('mouseenter', mo);
    menu.addEventListener('mouseleave', dong);

    menu.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-hub]');
      if (!b) return;
      const k = b.dataset.hub;
      menu.classList.remove('mo');
      nut.setAttribute('aria-expanded', 'false');
      if (k === 'loi') { moHopLoi(); return; }
      MUC[Number(k)]?.chay();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('mo')) {
        menu.classList.remove('mo');
        nut.setAttribute('aria-expanded', 'false');
      }
    });

    document.body.appendChild(menu);
    document.body.appendChild(nut);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', dung);
  } else {
    dung();
  }

  window.__beeHub = { moHopLoi };
})();
