'use strict';
/**
 * Ô báo mức phóng to, chỉ hiện khi vừa đổi rồi tự tắt.
 *
 * VÌ SAO CẦN: phím tắt Ctrl `+` / Ctrl `-` được cắm lại ở tiến trình chính
 * (`main.js`, khối "phóng to"), nhưng nếu bấm mà không thấy phản hồi gì bằng số
 * thì người dùng không biết mình đang ở đâu — nhất là lúc muốn quay về mức cũ.
 *
 * Cố ý KHÔNG làm nút bấm thường trực: đây là thứ chỉnh một lần rồi thôi, để một
 * ô cố định trên màn hình chỉ tổ chiếm chỗ. Hiện 1,4 giây rồi biến mất.
 */
(() => {
  const api = window.beeknoee;
  if (!api || !api.zoom) return;

  let o = null;
  let hen = null;

  function dungO() {
    if (o) return o;
    // CSS của module này nằm ở css/zoom-badge.css (tách 02/09/2026, nạp bằng <link> trong index.html).

    o = document.createElement('div');
    o.id = 'bee-zoom';
    o.setAttribute('role', 'status');
    document.body.appendChild(o);
    return o;
  }

  api.zoom.onDoi(({ zoom }) => {
    const el = dungO();
    // `Ctrl 0` đưa về mức gợi ý theo màn hình, không phải luôn luôn 100% — nên
    // nói "mặc định" thay vì ghi một con số có thể sai.
    el.innerHTML = `${Math.round(zoom * 100)}%<small>Ctrl 0 để về mặc định</small>`;
    el.classList.add('hien');
    clearTimeout(hen);
    hen = setTimeout(() => el.classList.remove('hien'), 1400);
  });
})();
