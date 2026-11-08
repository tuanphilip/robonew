'use strict';
/**
 * Lõi dùng chung của trang Dựng video: state, danh sách dự án, $/$all, setStatus,
 * apiGoi/apiPost, theme. Nạp TRƯỚC mọi module khác (project-list, tts-panel,
 * jobs) và trước render-page.js (điều phối). Tách từ render-page.js 02/09/2026,
 * audit Phase 2.3 — xem chú thích đầu các module về cơ chế `window.__renderPage`.
 */
(() => {
  const RP = (window.__renderPage = window.__renderPage || {});

  const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
  const fallbackProject = window.__RENDER_PROJECT__;
  const fallbackOutputUrl = window.__RENDER_OUTPUT_URL__;
  // MẢNG SỬA ĐƯỢC TẠI CHỖ, không phải bản chụp một lần.
  //
  // Trước đây nút "Làm mới" gọi location.reload() cho chắc ăn — nạp lại cả
  // trang, mất chỗ đang cuộn, mất dự án đang chọn, nháy trắng cả màn hình cho
  // một việc là đọc lại danh sách thư mục. Nay chỉ thay NỘI DUNG mảng này rồi
  // vẽ lại bảng; mọi chỗ khác vẫn giữ đúng tham chiếu cũ.
  const projects = Array.isArray(window.__PROJECTS__) && window.__PROJECTS__.length
    ? window.__PROJECTS__.slice()
    : (fallbackProject ? [{ name: fallbackProject, url: `/slide/${fallbackProject}/`, output_url: fallbackOutputUrl, video_url: fallbackOutputUrl, script_count: 0 }] : []);
  const projectMap = new Map(projects.map((project) => [project.name, project]));

  const state = {
    engine: 'elevenlabs',
    jobId: null,
    pollTimer: null,
    project: null,
    outputUrl: null,
    busy: false,
    canceling: false,
    daBamKetQua: false,      // đã vẽ xong kết quả cuối (done/failed/cancelled) của job hiện tại
    deckLoi: null,           // deck vừa dựng HỎNG — giữ bảng lỗi khỏi bị các lượt vẽ lại lau mất
    renderStep: -1,          // chỉ số bước đang sáng trên vạch 5 bước; -1 = chưa chạy
    /* Bật lúc mở app, tắt khi đã dò xong — xem `tinhTrangThai()`. */
    dangDoTrangThai: true,
    /* TÊN dự án đang chờ tới lượt, theo đúng thứ tự. Nguồn thật nằm ở tiến
       trình chính; đây chỉ là ảnh chụp do sự kiện `render:hangdoi` đẩy xuống. */
    hangDoi: [],
    /* Lần vẽ tiến độ GẦN NHẤT của lượt đang chạy: {deck, title, logs, tone,
       step, status}. Bảng 5 bước nay thuộc về deck ĐANG CHỌN, nên chuyển sang
       deck khác rồi quay lại deck đang dựng là khôi phục từ đây — không có nó
       thì bảng trống 1.5 giây chờ lần poll kế. */
    tienDoCuoi: null,
    /* Lượt vừa KẾT THÚC trong lúc người dùng đang xem deck khác: {deck, icon,
       chu, tone}. Dải mỏng hiện nó cho tới khi người dùng bấm xem hoặc một
       lượt mới bắt đầu — không có thì render xong trong im lặng. */
    ketQuaCho: null,
    /* Tên gói ElevenLabs của tài khoản (tier từ /v1/user/subscription) — chỉ
       biết khi key có quyền User → Read; rỗng = chưa biết. */
    elevenGoi: '',
    /* Kết quả THỬ THẬT từng định dạng audio (formatId → true/false) — dùng khi
       không đọc được gói. Xem thuFormatBiKhoa. */
    fmtChoPhep: {},
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function setButtonLabel(button, label) {
    const labelEl = button?.querySelector?.('span:last-child');
    if (labelEl) labelEl.textContent = label;
    else if (button) button.textContent = label;
  }

  /**
   * Đổi tông cho KHUNG XEM TRƯỚC đang mở.
   *
   * Khung đó lấy tông màu ĐÚNG MỘT LẦN lúc nạp, qua `?theme=` trên URL (xem
   * EDITOR_THEME_SCRIPT ở previewHtml.js). Nên đang mở trang sửa mà bấm đổi
   * sáng/tối thì bảng sửa đứng im — phải đóng ra mở lại mới thấy, mà chẳng có
   * gì nói cho người dùng biết điều đó.
   *
   * Khung deck ở ORIGIN RIÊNG (`bee-deck://`, từ 10/10/2026) nên không đặt thẳng lớp
   * lên tài liệu con được — nhắn xuống đại diện trong khung (deck-cau.js#doiTong).
   *
   * Lọc theo `?theme=` để chỉ đụng khung của chính mình, không quét bừa mọi
   * iframe có thể có trên trang.
   *
   * KHÔNG sửa thuộc tính `src`: gán lại src là nạp lại khung, mất hết thứ
   * người dùng đang sửa dở. Lần mở sau slide-viewer tự dựng URL với tông hiện
   * tại nên không lệch.
   */
  function dongBoTongKhungXem(nextTheme) {
    document.querySelectorAll('iframe').forEach((frame) => {
      if (!/[?&]theme=/.test(frame.getAttribute('src') || '')) return;
      // Khung deck ở origin riêng (bee-deck://) — nhắn xuống đại diện trong khung.
      if (RP.deckCau && RP.deckCau.doiTong) RP.deckCau.doiTong(frame, nextTheme === 'light');
    });
  }

  function applyTheme(theme) {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    document.body.classList.toggle('theme-light', nextTheme === 'light');
    localStorage.setItem('bee-theme', nextTheme);
    // Icon mặt trời/mặt trăng đổi bằng CSS theo `body.theme-light` (app-bar.css),
    // không ghi đè textContent nữa — xem ghi chú ở .theme-toggle-btn.
    dongBoTongKhungXem(nextTheme);
  }

  function toggleTheme() {
    applyTheme(document.body.classList.contains('theme-light') ? 'dark' : 'light');
  }

  function currentProject() {
    return projectMap.get(state.project) || null;
  }

  function rowForProject(projectName) {
    return $all('.project-row[data-project]').find((element) => element.dataset.project === projectName) || null;
  }

  /* ══ Gọi API — MỘT chỗ xử lý res.ok / data.error / câu lỗi ═══════════════
     Trước đây 20+ chỗ lặp nguyên văn: fetch → json → if (!res.ok) throw
     `Không gọi được chức năng này (mã …)`. Nơi cần xử lý lỗi kiểu khác (danh
     sách giọng, số dư, /api/jobs/current) vẫn gọi fetch thẳng — cố ý. */
  /**
   * @param {boolean} kiemLoiTrongThan  false cho các endpoint trả về OBJECT JOB:
   *   một job đã hỏng mang `error` là DỮ LIỆU (thông điệp lỗi của lượt đó),
   *   không phải lỗi của lời gọi — coi nó là lỗi là rẽ nhầm sang nhánh "mất
   *   liên lạc" thay vì vẽ bảng lỗi (harness đã bắt được đúng cái này).
   */
  async function apiGoi(url, init, kiemLoiTrongThan = true) {
    const res = await fetch(url, init);
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok || (kiemLoiTrongThan && data && data.error)) {
      throw new Error((data && data.error) || `Không gọi được chức năng này (mã ${res.status})`);
    }
    return data;
  }
  const apiPost = (url, body, kiemLoiTrongThan = true) => apiGoi(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  }, kiemLoiTrongThan);

  /**
   * Dòng thông báo dưới tên dự án — MỘT chỗ cho ba loại việc:
   *
   *   good  việc vừa làm xong    'Đã copy script của X.'
   *   warn  nhắc / đang chờ      'Còn 2 video trong hàng đợi'
   *   bad   HỎNG, phải đọc       'Không tìm thấy dự án để xoá.'
   *
   * Trước đây ba loại chỉ khác nhau MÀU CHỮ. Màu một mình là tín hiệu yếu:
   * nhạt đi theo nền, và người phân biệt màu kém thì không thấy gì cả — dòng
   * báo lỗi trông y hệt dòng báo xong. Nay mỗi loại có thêm một hình.
   *
   * ⚠ Dựng lại ruột mỗi lần chứ không gán textContent rồi thêm icon: gán
   * textContent XOÁ SẠCH phần tử con, icon vừa gắn sẽ biến mất ở lần gọi sau.
   */
  const ICON_TRANG_THAI = { good: 'ok', warn: 'info', bad: 'warn' };

  function setStatus(message, tone = 'warn') {
    const status = $('#renderStatus');
    if (!status) return;
    status.hidden = !message;
    status.className = `status ${tone}`;
    /* ⚠ `title` LÀ BẮT BUỘC từ 20/09/2026, không phải thêm cho đẹp. Dòng này
       nay nằm trên THANH TRÊN, bề ngang có hạn nên câu dài bị cắt bằng dấu ba
       chấm — mà tên dự án thường nằm cuối câu ("Đã mở thư mục video của
       uniface-face-analysis-library."), tức đúng phần bị cắt. Rê chuột vào là
       đọc được nguyên câu. */
    if (message) status.title = message; else status.removeAttribute('title');
    status.replaceChildren();
    if (!message) return;
    const bo = window.__beeIcons;
    const ten = ICON_TRANG_THAI[tone];
    if (bo && ten && bo.ICONS[ten]) {
      const ic = document.createElement('span');
      ic.className = 'status-ic';
      ic.innerHTML = bo.ICONS[ten];
      status.appendChild(ic);
    }
    const chu = document.createElement('span');
    chu.textContent = message;
    status.appendChild(chu);
  }

  Object.assign(RP, { $, $all, MAX_AUDIO_BYTES, apiGoi, apiPost, applyTheme, currentProject, fallbackOutputUrl, fallbackProject, projectMap, projects, rowForProject, setButtonLabel, setStatus, state, toggleTheme });
})();
