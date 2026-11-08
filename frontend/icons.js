'use strict';
/**
 * Bộ icon SVG dùng chung.
 *
 * Thay cho các ký tự Unicode (`↻ ⌕ ↗ ⧉ ▶ ■ ↑ ?`) mà giao diện gốc dùng làm icon.
 * Ký tự thì phụ thuộc font hệ thống: cùng một mã, mỗi máy vẽ một nét, độ dày và
 * chiều cao lệch nhau, có máy còn thay bằng emoji màu. SVG ăn theo `currentColor`
 * nên luôn khớp màu chữ và đồng bộ nét ở mọi máy.
 *
 * Cách dùng: đặt `data-icon="tên"` lên phần tử `.btn-icon`, script cuối file sẽ
 * thay nội dung. Thêm icon mới thì thêm một dòng vào `ICONS` — không phải sửa
 * markup ở nhiều chỗ.
 *
 * NGUỒN (từ 10/09/2026): bộ giao diện lấy từ **Lucide** (giấy phép ISC,
 * https://lucide.dev) và nhúng thẳng vào tệp này — không thêm phụ thuộc lúc
 * chạy, không tải gì qua mạng. Trước đó là bộ tự vẽ theo lối Feather; đổi vì bộ
 * cũ pha lẫn icon tô đặc với icon nét rỗng nên một hàng nút nhìn không đều.
 * Hai dấu hiệu thương hiệu ở cuối bảng KHÔNG thuộc Lucide.
 */
(() => {
  const svg = (body, extra = '') =>
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"'
    + ` stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>`
    + body + '</svg>';

  /**
   * SVG TÔ ĐẶC — dành cho dấu hiệu thương hiệu, khác hẳn `svg()` ở trên.
   *
   * Ba khác biệt, đều bắt buộc: `fill="currentColor"` thay cho nét; không có
   * stroke; và viewBox truyền vào được, vì logo của người khác không vẽ trong
   * khung 24x24 của bộ icon này.
   *
   * ⚠ Dùng `currentColor` nên nó TỰ đổi trắng/đen theo màu chữ của nút —
   * không cần file thứ hai cho nền tối.
   */
  const svgDac = (body, vb = '0 0 24 24') =>
    `<svg viewBox="${vb}" width="16" height="16" fill="currentColor" aria-hidden="true">${body}</svg>`;

  const ICONS = {
    /* ── Bộ giao diện: LUCIDE (ISC) ───────────────────────────────────────
     * Sinh bằng script từ gói `lucide-static`, KHÔNG chép tay. Đổi/bổ sung
     * icon thì lấy tiếp từ đó chứ đừng tự vẽ — tự vẽ một cái là bộ lệch một cái.
     *
     * ⚠ TÊN icon là hợp đồng với markup (`data-icon="..."`), không phải tên file
     * bên Lucide. Đổi tên ở đây là mọi chỗ dùng nó im lặng mất hình — `apply()`
     * cố ý để nguyên nội dung cũ khi không tra được tên.
     *
     * Lucide vẽ trên khung 24 với nét 2; hàm svg() ở trên dùng 1.9 cho khớp
     * nhịp sẵn có của app — chênh 0,1 không thấy được ở cỡ 15-19px.
     */
    info:    svg('<circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />'),
    help:    svg('<circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />'),
    /* Nút "Dự án:" ở thanh trên (11/10/2026) — Lucide `list-video`: danh sách + nút
       phát, không dùng thư mục để khỏi lẫn với nút "Mở thư mục chứa video" cạnh đó. */
    danhsach: svg('<path d="M12 12H3" /><path d="M16 6H3" /><path d="M12 18H3" /><path d="m16 12 5 3-5 3v-6" />'),
    folder:  svg('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />'),
    upload:  svg('<path d="M12 3v12" /><path d="m17 8-5-5-5 5" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />'),
    refresh: svg('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />'),
    eye:     svg('<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" />'),
    /* Ba cái này cho trang Nâng cấp (thêm 12/09/2026): biểu tượng ngân hàng ở
       bước chuyển khoản, hộp quà ở dải gia hạn, và mã QR ở ô chưa có mã. */
    nganhang: svg('<path d="M10 18v-7" /><path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z" /><path d="M14 18v-7" /><path d="M18 18v-7" /><path d="M3 22h18" /><path d="M6 18v-7" />'),
    qua:     svg('<path d="M12 7v14" /><path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" /><path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5" /><rect x="3" y="7" width="18" height="4" rx="1" />'),
    maqr:    svg('<rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" /><rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" /><path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /><path d="M3 12h.01" /><path d="M12 3h.01" /><path d="M12 16v.01" /><path d="M16 12h1" /><path d="M21 12v.01" /><path d="M12 21v-1" />'),
    tim:     svg('<path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" />'),
    copy:    svg('<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />'),
    edit:    svg('<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />'),
    play:    svg('<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />'),
    stop:    svg('<rect width="18" height="18" x="3" y="3" rx="2" />'),
    check:   svg('<path d="M20 6 9 17l-5-5" />'),
    warn:    svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />'),
    trash:   svg('<path d="M10 11v6" /><path d="M14 11v6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />'),
    mic:     svg('<path d="M12 19v3" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><rect x="9" y="2" width="6" height="13" rx="3" />'),
    bolt:    svg('<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />'),
    user:    svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />'),
    bell:    svg('<path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />'),
    mail:    svg('<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" />'),
    crown:   svg('<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" />'),
    monitor: svg('<rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />'),
    calendar: svg('<path d="M8 2v3" /><path d="M16 2v3" /><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" />'),
    xu:      svg('<ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19A9 3 0 0 0 21 19V5" /><path d="M3 12A9 3 0 0 0 21 12" />'),
    cho:     svg('<path d="M12 6v6l4 2" /><circle cx="12" cy="12" r="10" />'),
    ok:      svg('<circle cx="12" cy="12" r="10" /><path d="m16 9-5.5 5.5L8 12" />'),
    /* Cặp với `ok`: CÙNG hình tròn, khác dấu bên trong. Dùng `warn` (tam giác)
       cho lỗi của một bước thì hai trạng thái nằm cùng một chỗ mà lại khác họ
       hình — mắt phải đọc mới biết, thay vì liếc là thấy. Cùng họ + khác dấu +
       khác màu mới là ba tín hiệu cùng chỉ một hướng. */
    loi:     svg('<circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />'),
    /* Nút GỬI: tam giác đặc, không phải mũi tên nét. Nút này không có nền nên
       một hình nét mảnh trông như chưa vẽ xong; hình đặc mới đủ nặng để làm
       nút chính của thanh chat. */
    gui:     svgDac('<path d="M4.6 3.4 20.3 11.1a1 1 0 0 1 0 1.8L4.6 20.6a1 1 0 0 1-1.4-1.1L5 12 3.2 4.5a1 1 0 0 1 1.4-1.1z"/>'),
    the:     svg('<rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /><path d="M6 14h2" />'),
    nhac:    svg('<path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />'),
    amluong: svg('<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" /><path d="M16 9a5 5 0 0 1 0 6" />'),
    luu:     svg('<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h7" />'),
    song:    svg('<path d="M2 10v3" /><path d="M6 6v11" /><path d="M10 3v18" /><path d="M14 8v7" /><path d="M18 5v13" /><path d="M22 10v3" />'),
    dongho:  svg('<path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" />'),
    khung:   svg('<rect width="12" height="20" x="6" y="2" rx="2" /><rect width="20" height="12" x="2" y="6" rx="2" />'),
    /* Hai khổ video, dùng ở nhãn cạnh tên deck. Đều là Lucide: `smartphone`
       (điện thoại dựng đứng = short 9:16) và `tablet` xoay ngang (= 16:9).
       ⚠ Hai icon phải KHÁC HẲN nhau về hình bao — cùng là hình chữ nhật bo
       góc, chỉ khác chiều, nên cái chấm nút bấm ở cạnh ngắn là thứ giúp mắt
       biết đâu là "đứng" đâu là "nằm" khi icon chỉ cao 13px. */
    /* Bốn góc mở ra — dấu hiệu "cho vừa khung" ai cũng đọc được, dùng ở mọi
       trình xem ảnh/video. Lucide `maximize`. */
    vuakhung: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />'),
    dienthoai: svg('<rect width="14" height="20" x="5" y="2" rx="2" /><path d="M12 18h.01" />'),
    bangngang: svg('<rect width="20" height="14" x="2" y="5" rx="2" /><path d="M6 12h.01" />'),
    sao:     svg('<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /><path d="M20 2v4" /><path d="M22 4h-4" /><circle cx="4" cy="20" r="2" />'),
    khoa:    svg('<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" /><circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />'),
    gear:    svg('<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /><circle cx="12" cy="12" r="3" />'),
    sun:     svg('<circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />'),
    moon:    svg('<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />'),

    /* ── Dùng ở bảng sửa slide (_preview.html) ─────────────────────────── */
    khoi:     svg('<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />'),
    slide:    svg('<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />'),
    nen:      svg('<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" /><path d="m14 7 3 3" /><path d="M5 6v4" /><path d="M19 14v4" /><path d="M10 2v2" /><path d="M7 8H3" /><path d="M21 16h-4" /><path d="M11 3H9" />'),
    phim:     svg('<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 3v18" /><path d="M3 7.5h4" /><path d="M3 12h18" /><path d="M3 16.5h4" /><path d="M17 3v18" /><path d="M17 7.5h4" /><path d="M17 16.5h4" />'),
    chu:     svg('<path d="M12 4v16" /><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" /><path d="M9 20h6" />'),
    but:     svg('<path d="m9 11-6 6v3h9l3-3" /><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />'),
    // Hồ sơ người mua (bảng tài khoản, 28/09/2026) — Lucide pencil / building-2 / shield-check.
    butchi:  svg('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" />'),
    toanha:  svg('<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />'),
    khien:   svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" />'),
    cochu:   svg('<path d="m15 16 2.536-7.328a1.02 1.02 1 0 1 1.928 0L22 16" /><path d="M15.697 14h5.606" /><path d="m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16" /><path d="M3.304 13h6.392" />'),
    doc:      svg('<path d="M12 2v20" /><path d="m8 18 4 4 4-4" /><path d="m8 6 4-4 4 4" />'),
    loa:      svg('<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" /><path d="M16 9a5 5 0 0 1 0 6" /><path d="M19.364 18.364a9 9 0 0 0 0-12.728" />'),

    /* Mười cái dưới đây thêm vào để THAY bộ Font Awesome mà markup của deck
       dùng trong trang sửa slide (xem doiIconFA() bên editor.js). FA vẽ lối tô
       đặc, bộ này vẽ nét rỗng — hai bộ đứng cạnh nhau trong một bảng là thấy
       ngay. Tên đặt theo NGHĨA, không theo tên tệp bên Lucide. */
    cuon:      svg('<path d="M15 12h-5" /><path d="M15 8h-5" /><path d="M19 17V5a2 2 0 0 0-2-2H4" /><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />'),
    truot:     svg('<path d="M10 5H3" /><path d="M12 19H3" /><path d="M14 3v4" /><path d="M16 17v4" /><path d="M21 12h-9" /><path d="M21 19h-5" /><path d="M21 5h-7" /><path d="M8 10v4" /><path d="M8 12H3" />'),
    tua:       svg('<path d="M12 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 12 18z" /><path d="M2 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 2 18z" />'),
    loatat:    svg('<path d="M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z" /><path d="m16.5 14.5 5-5" /><path d="m16.5 9.5 5 5" />'),
    len:       svg('<path d="m18 15-6-6-6 6" />'),
    /* Thêm 16/09/2026 cho ô chat kiểu mới ở tab "Tạo bằng AI". */
    /* Đăng xuất (Lucide log-out) — nút đăng xuất ChatGPT ở menu AI agent. */
    dangXuat:  svg('<path d="m16 17 5-5-5-5" /><path d="M21 12H9" /><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />'),
    gim:       svg('<path d="M13.234 20.252 21 12.3a3.89 3.89 0 0 0 0-5.5 3.89 3.89 0 0 0-5.5 0l-9.4 9.4a2.5 2.5 0 0 0 0 3.54 2.5 2.5 0 0 0 3.54 0l8.69-8.69a1.1 1.1 0 0 0 0-1.56 1.1 1.1 0 0 0-1.56 0l-7.2 7.2" />'),
    cong:      svg('<path d="M5 12h14" /><path d="M12 5v14" />'),
    muiLen:    svg('<path d="M12 19V5" /><path d="m5 12 7-7 7 7" />'),
    /* Thêm 16/09/2026 cho popup chọn mẫu + form "Tạo bằng AI" (Lucide). */
    saoAI:     svg('<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" />'),
    bongDen:   svg('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" />'),
    sapXep:    svg('<path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" />'),
    luoi:      svg('<rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />'),
    /* Nút "Dự án mới" trên thanh trên cùng (Lucide circle-plus — tròn như nút "?" cạnh nó; chủ dự án chọn 23/10/2026). */
    duAnMoi:   svg('<circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" />'),
    /* Thêm 23/10/2026 cho thanh công cụ timeline (Lucide mouse-pointer-2, scissors, magnet, locate-fixed). */
    conTro:    svg('<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" />'),
    dao:       svg('<circle cx="6" cy="6" r="3" /><path d="M8.12 8.12 12 12" /><path d="M20 4 8.12 15.88" /><circle cx="6" cy="18" r="3" /><path d="M14.8 14.8 20 20" />'),
    namCham:   svg('<path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15" /><path d="m5 8 4 4" /><path d="m12 15 4 4" />'),
    bamDau:    svg('<line x1="2" x2="5" y1="12" y2="12" /><line x1="19" x2="22" y1="12" y2="12" /><line x1="12" x2="12" y1="2" y2="5" /><line x1="12" x2="12" y1="19" y2="22" /><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="3" />'),
    danhSach:  svg('<path d="M3 5h.01" /><path d="M3 12h.01" /><path d="M3 19h.01" /><path d="M8 5h13" /><path d="M8 12h13" /><path d="M8 19h13" />'),
    xuong:     svg('<path d="m6 9 6 6 6-6" />'),
    // Lucide "brain" — dòng "suy nghĩ" của AI agent (agent-tab.js).
    naoBo:     svg('<path d="M12 18V5" /><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" /><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" /><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" /><path d="M18 18a4 4 0 0 0 2-7.464" /><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" /><path d="M6 18a4 4 0 0 1-2-7.464" /><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />'),
    trai:      svg('<path d="m15 18-6-6 6-6" />'),
    phai:      svg('<path d="m9 18 6-6-6-6" />'),
    tuongphan: svg('<circle cx="12" cy="12" r="10" /><path d="M12 18a6 6 0 0 0 0-12v12z" />'),
    hoantac:   svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />'),
    /* Hai nhãn trong bảng quầng sáng: mặt đồng hồ cho MỨC, tâm ngắm cho CHỖ. */
    mucdo:     svg('<path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" />'),
    vitri:     svg('<circle cx="12" cy="12" r="10" /><line x1="22" x2="18" y1="12" y2="12" /><line x1="6" x2="2" y1="12" y2="12" /><line x1="12" x2="12" y1="6" y2="2" /><line x1="12" x2="12" y1="22" y2="18" />'),

    /* ── Dấu hiệu thương hiệu — KHÔNG thuộc Lucide, đừng thay ────────────── */
    eleven:  svgDac('<rect x="8.5" y="6" width="2.45" height="12"/><rect x="13.05" y="6" width="2.45" height="12"/>'),
    bee:     svgDac('<g transform="translate(0.000000,50.000000)scale(0.009091,-0.009091)"><path d="M1123 5252 l-303 -177 0 -355 0 -355 305 -177 305 -177 305 177 305 177 0 355 0 355 -302 175 c-166 96 -304 176 -307 177 -3 0 -142 -78 -308 -175z"/><path d="M4253 4797 l-343 -201 0 -401 0 -400 338 -197 c187 -108 344 -198 350 -200 6 -2 166 87 356 197 l346 200 0 400 0 400 -338 197 c-185 108 -344 199 -352 202 -8 2 -169 -86 -357 -197z"/><path d="M2148 4002 l-528 -307 0 -620 0 -620 530 -307 529 -307 508 296 c279 162 518 300 531 306 l22 10 -2 621 -3 621 -529 307 c-291 170 -530 308 -530 307 -1 0 -238 -139 -528 -307z"/><path d="M357 3171 l-147 -86 2 -180 3 -179 140 -82 c77 -45 145 -83 150 -83 6 -1 75 37 155 83 l145 84 2 178 3 179 -97 55 c-53 30 -121 69 -152 86 l-56 32 -148 -87z"/><path d="M972 2092 l-152 -87 0 -175 0 -176 151 -88 151 -87 147 84 146 85 3 179 2 180 -127 73 c-71 41 -137 79 -148 86 -18 12 -37 4 -173 -74z"/><path d="M2335 1450 l-340 -199 -3 -404 -2 -405 344 -201 344 -200 346 201 346 201 0 402 0 402 -342 199 c-188 109 -344 200 -347 201 -3 1 -159 -88 -346 -197z"/></g>', '0 0 50 50'),
    /* Ba nhà cung cấp AI. Nguồn: logo chính chủ, chép nguyên đường nét.
       · OpenAI: bản gốc tô cứng `#0D0D0D` — ĐEN, nền tối là biến mất. Đổi sang
         `currentColor` để nó tự lật trắng/đen, đúng như `bee` ở trên. Chỉ đổi
         MÀU, không đụng đường nét.
       · Claude và Gemini giữ NGUYÊN màu thương hiệu (cam #D97757, dải tím-xanh)
         vì hai màu đó đọc được trên cả nền sáng lẫn nền tối — lật màu thương
         hiệu của người khác là làm sai logo của họ. */
    openai:  svgDac('<path d="M37.5324 16.8707C37.9808 15.5241 38.1363 14.0974 37.9886 12.6859C37.8409 11.2744 37.3934 9.91076 36.676 8.68622C35.6126 6.83404 33.9882 5.3676 32.0373 4.4985C30.0864 3.62941 27.9098 3.40259 25.8215 3.85078C24.8796 2.7893 23.7219 1.94125 22.4257 1.36341C21.1295 0.785575 19.7249 0.491269 18.3058 0.500197C16.1708 0.495044 14.0893 1.16803 12.3614 2.42214C10.6335 3.67624 9.34853 5.44666 8.6917 7.47815C7.30085 7.76286 5.98686 8.3414 4.8377 9.17505C3.68854 10.0087 2.73073 11.0782 2.02839 12.312C0.956464 14.1591 0.498905 16.2988 0.721698 18.4228C0.944492 20.5467 1.83612 22.5449 3.268 24.1293C2.81966 25.4759 2.66413 26.9026 2.81182 28.3141C2.95951 29.7256 3.40701 31.0892 4.12437 32.3138C5.18791 34.1659 6.8123 35.6322 8.76321 36.5013C10.7141 37.3704 12.8907 37.5973 14.9789 37.1492C15.9208 38.2107 17.0786 39.0587 18.3747 39.6366C19.6709 40.2144 21.0755 40.5087 22.4946 40.4998C24.6307 40.5054 26.7133 39.8321 28.4418 38.5772C30.1704 37.3223 31.4556 35.5506 32.1119 33.5179C33.5027 33.2332 34.8167 32.6547 35.9659 31.821C37.115 30.9874 38.0728 29.9178 38.7752 28.684C39.8458 26.8371 40.3023 24.6979 40.0789 22.5748C39.8556 20.4517 38.9639 18.4544 37.5324 16.8707ZM22.4978 37.8849C20.7443 37.8874 19.0459 37.2733 17.6994 36.1501C17.7601 36.117 17.8666 36.0586 17.936 36.0161L25.9004 31.4156C26.1003 31.3019 26.2663 31.137 26.3813 30.9378C26.4964 30.7386 26.5563 30.5124 26.5549 30.2825V19.0542L29.9213 20.998C29.9389 21.0068 29.9541 21.0198 29.9656 21.0359C29.977 21.052 29.9842 21.0707 29.9867 21.0902V30.3889C29.9842 32.375 29.1946 34.2791 27.7909 35.6841C26.3872 37.0892 24.4838 37.8806 22.4978 37.8849ZM6.39227 31.0064C5.51397 29.4888 5.19742 27.7107 5.49804 25.9832C5.55718 26.0187 5.66048 26.0818 5.73461 26.1244L13.699 30.7248C13.8975 30.8408 14.1233 30.902 14.3532 30.902C14.583 30.902 14.8088 30.8408 15.0073 30.7248L24.731 25.1103V28.9979C24.7321 29.0177 24.7283 29.0376 24.7199 29.0556C24.7115 29.0736 24.6988 29.0893 24.6829 29.1012L16.6317 33.7497C14.9096 34.7416 12.8643 35.0097 10.9447 34.4954C9.02506 33.9811 7.38785 32.7263 6.39227 31.0064ZM4.29707 13.6194C5.17156 12.0998 6.55279 10.9364 8.19885 10.3327C8.19885 10.4013 8.19491 10.5228 8.19491 10.6071V19.808C8.19351 20.0378 8.25334 20.2638 8.36823 20.4629C8.48312 20.6619 8.64893 20.8267 8.84863 20.9404L18.5723 26.5542L15.206 28.4979C15.1894 28.5089 15.1703 28.5155 15.1505 28.5173C15.1307 28.5191 15.1107 28.516 15.0924 28.5082L7.04046 23.8557C5.32135 22.8601 4.06716 21.2235 3.55289 19.3046C3.03862 17.3858 3.30624 15.3413 4.29707 13.6194ZM31.955 20.0556L22.2312 14.4411L25.5976 12.4981C25.6142 12.4872 25.6333 12.4805 25.6531 12.4787C25.6729 12.4769 25.6928 12.4801 25.7111 12.4879L33.7631 17.1364C34.9967 17.849 36.0017 18.8982 36.6606 20.1613C37.3194 21.4244 37.6047 22.849 37.4832 24.2684C37.3617 25.6878 36.8382 27.0432 35.9743 28.1759C35.1103 29.3086 33.9415 30.1717 32.6047 30.6641C32.6047 30.5947 32.6047 30.4733 32.6047 30.3889V21.188C32.6066 20.9586 32.5474 20.7328 32.4332 20.5338C32.319 20.3348 32.154 20.1698 31.955 20.0556ZM35.3055 15.0128C35.2464 14.9765 35.1431 14.9142 35.069 14.8717L27.1045 10.2712C26.906 10.1554 26.6803 10.0943 26.4504 10.0943C26.2206 10.0943 25.9948 10.1554 25.7963 10.2712L16.0726 15.8858V11.9982C16.0715 11.9783 16.0753 11.9585 16.0837 11.9405C16.0921 11.9225 16.1048 11.9068 16.1207 11.8949L24.1719 7.25025C25.4053 6.53903 26.8158 6.19376 28.2383 6.25482C29.6608 6.31589 31.0364 6.78077 32.2044 7.59508C33.3723 8.40939 34.2842 9.53945 34.8334 10.8531C35.3826 12.1667 35.5464 13.6095 35.3055 15.0128ZM14.2424 21.9419L10.8752 19.9981C10.8576 19.9893 10.8423 19.9763 10.8309 19.9602C10.8195 19.9441 10.8122 19.9254 10.8098 19.9058V10.6071C10.8107 9.18295 11.2173 7.78848 11.9819 6.58696C12.7466 5.38544 13.8377 4.42659 15.1275 3.82264C16.4173 3.21869 17.8524 2.99464 19.2649 3.1767C20.6775 3.35876 22.0089 3.93941 23.1034 4.85067C23.0427 4.88379 22.937 4.94215 22.8668 4.98473L14.9024 9.58517C14.7025 9.69878 14.5366 9.86356 14.4215 10.0626C14.3065 10.2616 14.2466 10.4877 14.2479 10.7175L14.2424 21.9419ZM16.071 17.9991L20.4018 15.4978L24.7325 17.9975V22.9985L20.4018 25.4983L16.071 22.9985V17.9991Z"/>', '0 0 41 41'),
    claude:  svgDac('<path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z" fill="#D97757"/>', '0 0 100 100'),
    gemini:  svgDac('<path d="M16 8.016A8.522 8.522 0 008.016 16h-.032A8.521 8.521 0 000 8.016v-.032A8.521 8.521 0 007.984 0h.032A8.522 8.522 0 0016 7.984v.032z" fill="url(#beeGemini)"/>'
      + '<defs><radialGradient id="beeGemini" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"'
      + ' gradientTransform="matrix(16.1326 5.4553 -43.70045 129.2322 1.588 6.503)">'
      + '<stop offset=".067" stop-color="#9168C0"/><stop offset=".343" stop-color="#5684D1"/>'
      + '<stop offset=".672" stop-color="#1BA1E3"/></radialGradient></defs>', '0 0 16 16'),
  };

  function apply(root = document) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      const key = el.dataset.icon;
      const html = ICONS[key];
      // Không có tên đó thì ĐỂ NGUYÊN nội dung cũ. Xoá trắng sẽ thành nút không
      // có gì mà chẳng báo lỗi — đúng kiểu hỏng im lặng khó lần ra.
      if (html) el.innerHTML = html;
    });
  }

  window.__beeIcons = { ICONS, apply };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply());
  } else {
    apply();
  }
})();
