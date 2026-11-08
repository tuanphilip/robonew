# Tạp chí tiền số (TIN-05) — kem biên tập, chủ đề crypto

Anh em CÙNG MÀU với "Tạp chí công nghệ" (TIN-02): nền kem `#f2ead9`, quầng
đào/xô thơm, tít serif hai dòng (dòng hai đỏ gạch `#c2431f`), chip đỏ + kẻ
ngang + số trang, thẻ trắng bóng mềm. KHÔNG đổi bảng màu — chỉ thêm chất
"bảng giá" cho tiền số: số liệu dùng font mono (`tc-so`), bảng hai cột kẻ
mảnh (`tc-card-bang`), nhấn đỏ gạch (`tc-do`). Hợp bài giải thích crypto,
điểm tin tài sản số, kiến thức đầu tư.

Giữ các mặc định sau trừ khi người dùng yêu cầu khác:

- `visuals.colorMode: "cream"`, `backgroundFx: "none"` — chất liệu nằm ở
  quầng màu CSS trong `.tc-bg`, không dùng canvas nền.
- Phụ đề: chữ TỐI (`#3c332a`), chữ đang đọc đỏ gạch — nền sáng, đừng đổi trắng.
- Serif của tít là **Times New Roman (font hệ thống)** — Georgia thiếu glyph
  dấu chồng tiếng Việt (ố, ắ, ệ). KHÔNG thêm Google Fonts: offline chỉ có Inter.
- Số liệu trong thẻ bọc `tc-so` để ăn font mono; con số cần nhấn thêm `tc-do`.
  Số chỉ mang tính MINH HOẠ hoặc là sự kiện bền (21 triệu, mốc halving) —
  đừng ghi giá coin theo ngày, video sẽ lỗi thời.
- Mỗi slide nội dung có đúng 3 `slide-element` (tít, thân, thẻ) — dòng script
  tương ứng phải có ĐÚNG 3 câu. Slide mở đầu: 1 element = 1 câu duy nhất.
- Cập nhật `tc-count` (01 · 07…) khi thêm/bớt slide.
- Bốn kiểu thẻ trắng:
  `tc-card-bang` (bảng hai cột, hàng đầu `tc-bang-dau` — MỚI của mẫu này),
  `tc-card-shot` (giả ảnh chụp/checklist, `mark` vàng),
  `tc-card-duo` (hai vế so sánh, vế nhấn mạnh mang `tc-pill-do`),
  `tc-card-list` (danh sách icon + dòng chốt `tc-row-mark`).
- Tít viết NGẮN: mỗi dòng 2–3 từ, dòng hai trong `<em>` để ăn màu đỏ.

Khi copy sang `slide/<project>/`, cập nhật:

- `index.html` title/meta, chữ trong slide, `tc-chip`, `tc-count`.
- `script-90s.txt` và `scriptLines` trong `preview-settings.json` giống hệt nhau.
- `upload-metadata.json`.
