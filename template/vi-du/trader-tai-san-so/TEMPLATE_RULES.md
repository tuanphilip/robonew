# Trader tài sản số (TIN-03) — bảng điện ban đêm

Anh em cùng DNA với "Tạp chí công nghệ" (TIN-02): chip + kẻ ngang + số trang,
tít serif hai dòng, thân Inter, khung 390×693. Khác ở thế giới màu: nền navy
đen `#0a0e17` + quầng xanh lãi/tím, dòng hai của tít màu XANH LÃI `#16c784`,
đỏ lỗ `#ea3943`, vàng nhấn `#f0b90b`, số liệu dùng font MONO hệ thống.
Hợp nội dung tiền số, trading, quản lý vốn, tài chính cá nhân.

Giữ các mặc định sau trừ khi người dùng yêu cầu khác:

- `visuals.colorMode: "dark"`, `backgroundFx: "none"` — chất liệu nằm ở quầng
  màu CSS trong `.tt-bg`, không dùng canvas nền.
- Phụ đề: chữ SÁNG (`#e8ecf4`), chữ đang đọc màu xanh lãi — nền tối, đừng đổi
  về chữ tối của mẫu kem.
- Serif của tít là **Times New Roman (font hệ thống)** — Georgia thiếu glyph
  dấu chồng tiếng Việt (ố, ắ, ệ). KHÔNG thêm Google Fonts: offline chỉ có Inter.
- MỌI con số (giá, %, đòn bẩy) bọc trong `tt-so` để ăn font mono; lãi/dương
  thêm `tt-xanh`, lỗ/âm thêm `tt-do`. Số trong thẻ chỉ mang tính MINH HOẠ —
  đừng ghi giá thật của một đồng coin cụ thể, hôm sau video sẽ sai.
- Mỗi slide nội dung có đúng 3 `slide-element` (tít, thân, thẻ) — dòng script
  tương ứng phải có ĐÚNG 3 câu. Slide mở đầu: 1 element = 1 câu duy nhất.
- Cập nhật `tt-count` (01 · 07…) khi thêm/bớt slide.
- Bốn kiểu thẻ tối có sẵn:
  `tt-card-chart` (biểu đồ NẾN xanh/đỏ SVG + đường dừng lỗ đứt nét đỏ, vùng
  đỏ mờ dưới — nến vẽ tay bằng line wick + rect thân, xanh #16c784 đỏ #ea3943),
  `tt-card-bang` (bảng hai cột kiểu bảng điện, hàng đầu `tt-bang-dau`),
  `tt-card-duo` (hai vế, vế khuyên dùng `tt-pill-xanh`),
  `tt-card-list` / `tt-card-shot` (danh sách icon, checklist, `mark` vàng).
- Tít viết NGẮN: mỗi dòng 2–3 từ, dòng hai trong `<em>` để ăn màu xanh.

Khi copy sang `slide/<project>/`, cập nhật:

- `index.html` title/meta, chữ trong slide, `tt-chip`, `tt-count`.
- `script-90s.txt` và `scriptLines` trong `preview-settings.json` giống hệt nhau.
- `upload-metadata.json`.
