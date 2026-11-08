'use strict';
/**
 * Bảng "Có gì mới?" — nhật ký thay đổi của app.
 *
 * ⚠ TỪNG CÓ MỘT Ô SỐ HIỆU Ở GÓC DƯỚI BÊN PHẢI (id mang tên cũ, kèm nút
 * tròn kiểm tra cập nhật và ô chữ kết quả) — gỡ 16/09/2026 theo yêu cầu chủ dự
 * án, đừng dựng lại. Nó nằm đè lên góc khung slide, mà chỗ đọc số hiệu và hỏi
 * "có bản mới chưa" nay đã nằm gọn trong bảng Cài đặt (xem hàng "Phiên bản" ở
 * `login.js#paintAccount`).
 *
 * Tệp này giờ chỉ còn giữ BẢNG nhật ký và mở nó qua `window.__beeVersion`.
 * Số hiệu vẫn đọc từ `appInfo()` chứ không viết cứng trong `index.html`: nó nằm
 * ở `package.json` và đổi theo từng bản dựng — viết cứng là chắc chắn có ngày
 * lệch, mà lệch số hiệu thì mọi báo lỗi sau đó đều sai địa chỉ.
 *
 * ⚠ NHẬT KÝ THAY ĐỔI MỞ BẰNG CÚ BẤM, KHÔNG PHẢI RÊ CHUỘT (đổi 12/09/2026).
 * Bản trước bung một bảng nhỏ ngay khi chuột đi ngang qua góc. Hai chỗ hỏng:
 *   · Bảng cao 340px neo vào ô số hiệu (z 20) nên nút "?" (z 21) đè LÊN nó —
 *     đo được: bảng 482→822, nút 803→829, chồng nhau 19px.
 *   · Bung ra chỉ vì chuột đi ngang qua góc là bung nhầm; mà một bảng đã cần
 *     nút đóng và nút "xem tất cả" thì nó không còn là tooltip nữa.
 * Nay là hộp thoại giữa màn hình, nền mờ phủ hết mọi thứ phía sau (kể cả nút
 * "?"), đóng bằng ×, bằng nút Đóng, bằng Esc hoặc bấm ra nền.
 */
(() => {
  const api = window.beeknoee;
  if (!api || !api.appInfo) return;

  // CSS của module này nằm ở css/version-badge.css (tách 02/09/2026, nạp bằng <link> trong index.html).

  /** Escape: nội dung nhật ký là dữ liệu, không phải markup. */
  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /**
   * So hai số hiệu kiểu `1.0.10` — trả về âm / 0 / dương như `Array#sort`.
   *
   * So từng chặng bằng SỐ chứ không so chuỗi: so chuỗi thì "1.0.10" < "1.0.9",
   * tức bản mới lại bị coi là cũ. Chặng thiếu tính là 0 nên "1.0" = "1.0.0".
   * Phần đuôi kiểu "-beta.1" bị bỏ qua — ở đây chỉ cần biết ai lớn hơn ai.
   */
  function soSanhBan(a, b) {
    const tach = (s) => String(s || '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
    const x = tach(a);
    const y = tach(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (x[i] || 0) - (y[i] || 0);
      if (d) return d;
    }
    return 0;
  }

  /* Bao nhiêu bản hiện ngay lúc mở. Đang có 16 bản; đổ hết ra một lượt thì
     bảng thành một cuộn dài, mà thứ người ta vào đây tìm gần như luôn là bản
     mới nhất. Phần còn lại nằm sau nút "Xem tất cả phiên bản" ở chân bảng. */
  const SO_DAU = 5;
  /* Hai bản đầu MỞ SẴN, còn lại gập. Gập hết thì mở bảng ra không đọc được gì;
     mở hết thì phải cuộn mới thấy tới bản thứ hai. */
  const SO_MO = 2;

  let banDangDung = '?';

  function dsNhatKy() {
    const tatCa = Array.isArray(window.__BEE_CHANGELOG__) ? window.__BEE_CHANGELOG__ : [];
    /* Chỉ hiện bản ĐANG CÀI trở về trước.
       Lý do: file nhật ký nằm chung trong mã, nên trong lúc đang làm bản kế
       tiếp là nó đã có sẵn dòng của bản chưa phát hành. Không lọc thì người
       dùng bản cũ mở bảng ra là đọc được kế hoạch chưa công bố — đã xảy ra
       thật (bản đang cài 1.0.1 mà bảng liệt kê tới tận một bản sau).
       Lọc ở đây là lưới AN TOÀN; luật "đừng thêm bản chưa phát hành" bên
       `changelog.js` vẫn là tuyến đầu. */
    return banDangDung && banDangDung !== '?'
      ? tatCa.filter((b) => soSanhBan(b.version, banDangDung) <= 0)
      : tatCa;
  }

  /** Một chặng trên trục dọc: chấm, hàng tiêu đề bấm được, hộp ghi chú. */
  function veBan(b, i) {
    const nay = b.version === banDangDung;
    const mo = i < SO_MO;
    const muc = Array.isArray(b.muc) && b.muc.length
      ? `<ul>${b.muc.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`
      : '<p class="cl-trong">Không có ghi chú cho bản này.</p>';
    return `
      <li class="cl-ban${nay ? ' nay' : ''}${mo ? ' mo' : ''}${i >= SO_DAU ? ' an' : ''}">
        <span class="cl-cham" aria-hidden="true"></span>
        <button class="cl-hang" type="button" data-cl-gap aria-expanded="${mo}">
          <span class="cl-so">v${esc(b.version)}</span>
          ${b.ngay ? `<span class="cl-ngay">${esc(b.ngay)}</span>` : ''}
          ${nay ? '<span class="cl-nay">Đang dùng</span>' : ''}
          <span class="cl-mui btn-icon" data-icon="xuong" aria-hidden="true"></span>
        </button>
        <div class="cl-noi">${muc}</div>
      </li>`;
  }

  function moNhatKy() {
    const ds = dsNhatKy();
    if (!ds.length) return;
    dongNhatKy();
    const nen = document.createElement('div');
    nen.id = 'bee-changelog';
    nen.innerHTML = `
      <div class="cl-hop" role="dialog" aria-modal="true" aria-labelledby="cl-tieu">
        <header class="cl-dinh">
          <span class="cl-bieu" aria-hidden="true"><span class="btn-icon" data-icon="cuon"></span></span>
          <h2 id="cl-tieu">Có gì mới?</h2>
          <button class="cl-x" type="button" data-cl-dong aria-label="Đóng">×</button>
        </header>
        <div class="cl-than">
          <ol class="cl-doc">${ds.map(veBan).join('')}</ol>
        </div>
        <footer class="cl-chan">
          ${ds.length > SO_DAU
            ? `<button class="cl-tatca" type="button" data-cl-tatca>
                 <span class="btn-icon" data-icon="cho"></span>Xem tất cả phiên bản
               </button>`
            : ''}
          <button class="cl-dong" type="button" data-cl-dong>Đóng</button>
        </footer>
      </div>`;
    document.body.appendChild(nen);
    // `icons.js` chỉ quét một lần lúc nạp trang, mà bảng này dựng sau — không
    // gọi lại thì mọi ô icon trống trơn và không báo lỗi gì.
    if (window.__beeIcons) window.__beeIcons.apply(nen);

    nen.addEventListener('click', (e) => {
      // Bấm ra NỀN cũng là đóng — cùng nếp với popup hướng dẫn và thanh toán.
      if (e.target === nen || e.target.closest('[data-cl-dong]')) { dongNhatKy(); return; }
      const tatCa = e.target.closest('[data-cl-tatca]');
      if (tatCa) {
        nen.querySelectorAll('.cl-ban.an').forEach((el) => el.classList.remove('an'));
        /* Bỏ hẳn nút đi chứ không đổi thành "Thu gọn": đã bung ra rồi mà thu
           lại thì bản người ta vừa cuộn tới biến mất khỏi dưới chân trỏ. */
        tatCa.remove();
        return;
      }
      const hang = e.target.closest('[data-cl-gap]');
      if (hang) {
        const li = hang.closest('.cl-ban');
        hang.setAttribute('aria-expanded', String(li.classList.toggle('mo')));
      }
    });
    document.addEventListener('keydown', phim, true);
  }

  function phim(e) { if (e.key === 'Escape') { e.preventDefault(); dongNhatKy(); } }

  function dongNhatKy() {
    const el = document.getElementById('bee-changelog');
    if (el) el.remove();
    document.removeEventListener('keydown', phim, true);
  }

  /**
   * Cửa duy nhất cho phần còn lại của app.
   *
   * `so` và `thuMucApp` đọc một lần lúc nạp rồi giữ lại: bảng Cài đặt mở ra là
   * phải có số ngay, không đợi một vòng `await` nữa. Ai mở sớm hơn thì thấy
   * `'?'` — thà vậy còn hơn hàng "Phiên bản" nhấp nháy.
   */
  window.__beeVersion = { so: '?', thuMucApp: '', moNhatKy };

  api.appInfo().then((info) => {
    banDangDung = info.version || '?';
    window.__beeVersion.so = banDangDung;
    window.__beeVersion.thuMucApp = info.appRoot || '';
  }).catch(() => { /* không có số hiệu thì thôi, không làm hỏng trang */ });

  /* ⚠ TỪNG CÓ `dungNutCapNhat()` Ở ĐÂY — nút tròn kiểm tra cập nhật kèm ô chữ
     kết quả tự tắt sau 4,2 giây, đứng cạnh số hiệu ở góc dưới bên phải. Gỡ cùng
     ô số hiệu (16/09/2026). Việc đó nay nằm ở hàng "Phiên bản" trong bảng Cài
     đặt: cùng bảng trạng thái, cùng `api.update.check()`, chỉ khác chỗ đứng —
     xem `login.js#paintAccount`. Đừng dựng lại bản thứ hai ở góc màn hình. */
})();
