# Tạp chí công nghệ (TIN-02) — kem biên tập, tít serif

Mẫu theo phong cách tạp chí in trên nền kem: quầng màu đào/xô thơm mờ ở góc,
tít serif hai dòng (dòng hai màu đỏ gạch), chip đỏ + kẻ ngang + số trang,
thân chữ Inter, thẻ trắng bo góc đổ bóng mềm. Hợp bản tin công nghệ, tổng hợp
AI, điểm tin sản phẩm.

Giữ các mặc định sau trừ khi người dùng yêu cầu khác:

- `visuals.colorMode: "cream"`, `backgroundFx: "none"` — mẫu này KHÔNG dùng
  canvas nền; chất liệu nằm ở quầng màu CSS trong `.tc-bg`.
- Phụ đề: `enabled: true`, `fontSize: 18`, `bottom: 100`, `maxLines: 1`,
  màu chữ TỐI (`#3c332a`) vì nền sáng — đừng đổi về trắng.
- Serif của tít là **Times New Roman (font hệ thống)** — Georgia thiếu glyph dấu chồng tiếng Việt (ố, ắ, ệ) nên KHÔNG đứng đầu stack, KHÔNG thêm Google Fonts serif:
  bộ font offline của app chỉ có Inter, lúc render mạng bị chặn nên font
  ngoài sẽ không nạp.
- Mỗi slide nội dung có đúng 3 `slide-element`: khối tít (chip + tít),
  đoạn thân, và một thẻ trắng — nên dòng script tương ứng phải có ĐÚNG 3 câu.
  Slide mở đầu và slide chốt: xem số element hiện có mà viết số câu khớp.
- Cập nhật `tc-count` (01 · 07…) khi thêm/bớt slide.
- Ba kiểu thẻ trắng có sẵn, chọn theo nội dung:
  `tc-card-shot` (giả ảnh chụp màn hình, có `mark` vàng để nhấn số liệu),
  `tc-card-duo` (hai vế so sánh, vế được khuyên dùng mang `tc-pill-do`),
  `tc-card-list` (danh sách icon + dòng chốt `tc-row-mark`).
- Tít viết NGẮN: mỗi dòng 2–3 từ, dòng hai nằm trong `<em>` để ăn màu đỏ.

Khi copy sang `slide/<project>/`, cập nhật:

- `index.html` title/meta, chữ trong slide, `tc-chip`, `tc-count`.
- `script-90s.txt` và `scriptLines` trong `preview-settings.json` giống hệt nhau.
- `upload-metadata.json`.
