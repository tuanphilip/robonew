'use strict';
/**
 * Dải báo "có bản mới" — chạy độc lập, không đụng render-page.js.
 *
 * Dựng bằng JS thay vì viết sẵn trong index.html: bản chạy từ mã nguồn và bản
 * chưa cấu hình máy chủ phát hành thì KHÔNG có gì để báo, mà một dải trống nằm
 * đó chỉ tổ làm người dùng tưởng app hỏng (cạm bẫy #44 — đừng viết cứng những
 * thứ phụ thuộc trạng thái lúc chạy).
 */
(() => {
  const api = window.beeknoee && window.beeknoee.update;
  if (!api) return;

  let bar = null;
  /* Trạng thái mà người dùng đã bấm × để đóng.
     ⚠ CẦN BIẾN NÀY từ lúc dải biết hiện tiến độ tải: sự kiện `download-progress`
     bắn liên tục, mà `render()` lại `ensureBar()` mỗi lần — không nhớ gì thì
     bấm × xong nó mọc lại ngay ở nhịp sau, tức cái nút thành đồ trang trí.
     Nhớ THEO TRẠNG THÁI chứ không phải một cờ chung: đóng dải tiến độ là "đừng
     làm phiền trong lúc tải", không có nghĩa là "đừng báo khi tải xong" — lúc
     xong mới là lúc có việc để bấm. */
  let trangThaiDaTat = null;

  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'bee-update-bar';
    bar.innerHTML = `
      <span class="upd-text"></span>
      <button type="button" class="upd-action"></button>
      <button type="button" class="upd-close" title="Để sau">×</button>`;
    // CSS của module này nằm ở css/updater-ui.css (tách 02/09/2026, nạp bằng <link> trong index.html).
    bar.querySelector('.upd-close').addEventListener('click', () => {
      trangThaiDaTat = bar.dataset.trangThai || null;
      bar.remove();
      bar = null;
    });
    document.body.appendChild(bar);
    return bar;
  }


  const soMB = (b) => (Number(b) / 1024 / 1024).toFixed(1);

  function render(s) {
    /* ⚠ ĐỔI NGÀY 13/09/2026, ngược lại quyết định cũ.
     *
     * Cũ: "App tự tải ngầm, nên KHÔNG hiện gì trong lúc tải — người dùng không
     * có việc gì để làm với thông tin đó." Lý lẽ đó đúng nếu lượt tải nhỏ và
     * nhanh. Đo ra thì không: bộ cài **465 MB**, trên đường 10 Mbps là **6 phút
     * 12 giây** không một dấu hiệu nào. Mà electron-updater KHÔNG tải tiếp được
     * chỗ dở — đóng app giữa chừng là lần sau tải lại từ đầu. Tức người dùng
     * đang bị phạt vì một việc họ không hề biết là đang diễn ra.
     *
     * Nên vẫn có việc để làm với thông tin đó: biết mà đừng tắt app.
     *
     * Giữ đúng tinh thần cũ ở chỗ khác — lúc tải thì đây chỉ là một dòng chữ,
     * KHÔNG có nút nào để bấm (giấu `.upd-action`), nên nó không mời gọi, không
     * cắt ngang việc đang làm. Nút chỉ mọc ra khi đã tải xong.
     */
    if (!s || (s.state !== 'ready' && s.state !== 'downloading')) {
      if (bar) { bar.remove(); bar = null; }
      return;
    }
    if (s.state === trangThaiDaTat) {
      if (bar) { bar.remove(); bar = null; }
      return;
    }
    const el = ensureBar();
    el.dataset.trangThai = s.state;
    const action = el.querySelector('.upd-action');

    if (s.state === 'downloading') {
      /* `total` có thể thiếu ở vài nhịp đầu — khi đó chỉ nói đã tải bao nhiêu,
         đừng vẽ "NaN%". Thà ít chữ còn hơn một con số sai.
         ⚠ Kiểm KIỂU trước, đừng `Number(s.percent)`: `Number(null)` ra 0 nên
         thiếu số lại thành "0%" — đúng họ với cái bẫy `Number('' || 1.1)`. */
      const manh = [];
      if (typeof s.percent === 'number' && Number.isFinite(s.percent)) manh.push(`${Math.round(s.percent)}%`);
      if (s.total) manh.push(`${soMB(s.transferred)}/${soMB(s.total)} MB`);
      else if (s.transferred) manh.push(`${soMB(s.transferred)} MB`);
      // Ghép bằng filter+join chứ không nối chuỗi: thiếu mảnh nào thì mất luôn
      // dấu phân cách của nó, không để lại dấu cách đúp hay dấu · lửng.
      el.querySelector('.upd-text').textContent =
        ['Đang tải bản mới', manh.join(' · ')].filter(Boolean).join(' ');
      action.hidden = true;
      return;
    }

    action.hidden = false;
    el.querySelector('.upd-text').textContent = `Đã có bản ${s.version}`;
    action.textContent = 'Khởi động lại';
    action.disabled = false;
    /* `install()` trả về `{ ok }` chứ không phải boolean: nó có thể TỪ CHỐI
       (đang dựng video, dọn tiến trình phụ hỏng). Bản trước bắn rồi quên, nên
       lúc bị từ chối nút cứ đứng nguyên ở "Đang cài…" — người dùng ngồi chờ
       một việc không hề bắt đầu. */
    action.onclick = async () => {
      action.disabled = true;
      action.textContent = 'Đang cài…';
      let kq = null;
      try { kq = await api.install(); } catch { /* rơi xuống nhánh báo lỗi */ }
      if (kq && kq.ok) return;   // app sắp thoát, đừng vẽ thêm gì
      action.disabled = false;
      action.textContent = 'Thử lại';
      el.querySelector('.upd-text').textContent = kq && kq.ly === 'dang-dung'
        ? 'Đang dựng video — xong rồi hãy cập nhật'
        : `Chưa cài được bản ${s.version}`;
    };
  }

  api.onState(render);
  // Hỏi lại trạng thái sau khi nạp lại trang: nút "Làm mới" nạp lại toàn bộ
  // renderer, còn tiến trình chính vẫn giữ nguyên tiến độ tải.
  api.status().then(render).catch(() => {});
})();
