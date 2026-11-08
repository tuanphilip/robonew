'use strict';
/**
 * Dựng thanh menu dùng chung. Xem ghi chú kiến trúc ở `app-bar.css`.
 *
 * Bày ra `window.__beeAppBar` chứ không dùng module ES: trang này nạp script
 * bằng thẻ <script> thường, và `slide-viewer.js` cũng vậy — thêm `type="module"`
 * sẽ đổi thứ tự chạy và làm hỏng thứ tự nạp mà `api-shim.js` đang dựa vào.
 */
(() => {
  /** Dấu hiệu Beeknoee, hai bản cho hai theme. Dùng ở trang chủ. */
  const HOME_MARK =
    '<img src="assets/beeknoee-mark.svg" alt="" class="mark-dark" />'
    + '<img src="assets/beeknoee-mark-light.svg" alt="" class="mark-light" />';

  /**
   * MŨI TÊN QUAY LẠI cho các lớp phủ (xem slide, xem video).
   *
   * Logo không nói được là "bấm để quay lại" — người dùng nhìn vào chỉ thấy
   * thương hiệu. Mũi tên trái là ký hiệu ai cũng đọc được ngay.
   */
  const BACK_MARK =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"'
    + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M15 5 8 12l7 7"/></svg>';

  /**
   * @param {object} o
   * @param {string} [o.title]  tên màn hình (in đậm)
   * @param {string} [o.note]   chú thích mờ bên cạnh
   * @param {Function} [o.onHome] bấm nút quay lại
   * @param {boolean} [o.back]   true = mũi tên quay lại; false = dấu hiệu Beeknoee
   * @returns {HTMLElement}
   */
  function build(o = {}) {
    const bar = document.createElement('header');
    bar.className = 'app-bar';
    bar.innerHTML =
      // Chỉ dấu hiệu, không kèm chữ "Beeknoee Studio": nút này chỉ xuất hiện ở
      // lớp phủ (trang chủ ẩn nó đi), mà ở đó ngay bên cạnh đã là tên deck —
      // thêm tên app nữa thành hai nhãn tranh chỗ nhau.
      `<button type="button" class="app-bar-home${o.back ? ' is-back' : ''}" title="Quay lại danh sách dự án" aria-label="Quay lại danh sách dự án">
         ${o.back ? BACK_MARK : HOME_MARK}
       </button>
       <div class="app-bar-title">
         ${o.title ? `<b></b>` : ''}
         ${o.note ? '<span class="app-bar-note"></span>' : ''}
       </div>
       <div class="app-bar-tools"></div>`;
    // Gán bằng textContent, KHÔNG nhét thẳng vào chuỗi HTML: tên deck là tên
    // thư mục do người dùng đặt, có thể chứa dấu ngoặc kép hoặc thẻ.
    if (o.title) bar.querySelector('.app-bar-title b').textContent = o.title;
    if (o.note) bar.querySelector('.app-bar-note').textContent = o.note;
    if (o.onHome) bar.querySelector('.app-bar-home').addEventListener('click', o.onHome);
    return bar;
  }

  /** Thêm một nút vào cụm bên phải. Trả về nút để gắn tiếp sự kiện. */
  function addButton(bar, { label, icon, primary, onClick, title }) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `refresh-btn icon-btn${primary ? ' primary' : ''}`;
    if (title) b.title = title;
    if (icon) {
      const i = document.createElement('span');
      i.className = 'btn-icon';
      // Tên trong bộ icon SVG (icons.js) thì để nó vẽ; ký tự thì dùng thẳng.
      // Trước đây chỉ nhận ký tự Unicode nên nút "Mở thư mục" ra dấu ⌕ — cái
      // kính lúp, không phải thư mục.
      if (window.__beeIcons && window.__beeIcons.ICONS[icon]) {
        i.dataset.icon = icon;
        i.innerHTML = window.__beeIcons.ICONS[icon];
      } else {
        i.textContent = icon;
      }
      b.appendChild(i);
    }
    const s = document.createElement('span');
    s.textContent = label;
    b.appendChild(s);
    if (onClick) b.addEventListener('click', onClick);
    bar.querySelector('.app-bar-tools').appendChild(b);
    return b;
  }

  window.__beeAppBar = { build, addButton, HOME_MARK, BACK_MARK };
})();
