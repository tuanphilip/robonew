# Giá coin hôm nay (TIN-04) — theme vàng kim, bản tin giá theo ngày

Anh em cùng phong cách và CÙNG MÀU với "Giá vàng hôm nay" (TIN-01): nền nâu
đen + quầng vàng, chữ gradient vàng kim, panel viền vàng, xanh tăng `--up`
đỏ giảm `--down`. Bitcoin vốn màu vàng cam nên theme vàng ăn khớp tự nhiên.
Đây là dạng BẢN TIN THEO NGÀY — mỗi lần dùng phải thay toàn bộ số liệu.

Cấu trúc 8 slide (giữ khi copy, đổi số liệu):

1. Hero: đồng ₿ SVG + giá lớn + tag %/24h — 1 câu script.
2. Hai đồng dẫn dắt (BTC, ETH): price-row Giá / Vốn hoá — 3 câu.
3. Bốn altcoin (chip-pair × 2) — 3 câu.
4. Toàn thị trường: chart + vốn hoá + khối lượng 24h — 3 câu.
5. BTC thống trị: gap-bars % + badge — 3 câu.
6. `data-mode="highlight"`: sec-head + 3 hàng `highlightable` — 4 CÂU
   (câu mở + mỗi hàng một câu).
7. Kịch bản: range-track vùng giá + counter-card — 3 câu.
8. Chốt phiên + note-card miễn trừ — 2 câu.

Quy tắc:

- Không dùng framework style.css 4000 dòng — deck này TỰ CHỨA (style.css
  ~300 dòng, app.js runtime riêng). CÓ preview-settings.json để bộ dựng đọc
  phụ đề/bgm/âm thanh (fontSize 26, bottom 220 — bị zoom 1.9 nhân lên thành
  ~49px/418px trên khung 1080).
- Deck kiểu cũ quay 1:1 ở 1080×1920 nên body có `zoom:1.9` cho mật độ giống
  demo Giá vàng, và `.slide-container` phải là `height:calc(100vh / 1.9)`
  (100vh KHÔNG chia theo zoom — quên là nội dung trôi xuống đáy). Hạt bụi
  vàng nằm ở `.slide-container::after` (CSS thuần, engine không vẽ hạt hộ
  deck tự chứa).
- `script-90s.txt` và `slideScripts` trong app.js phải giống hệt nhau;
  số câu mỗi dòng phải khớp số đơn vị reveal ở trên.
- Ký hiệu ₿ là chữ U+20BF vẽ trong SVG bằng font hệ thống (Segoe UI có sẵn
  glyph) — không cần Font Awesome brands.
- Số liệu chỉ MINH HOẠ cho demo; khi dùng thật phải cập nhật giá, ngày
  (tiêu đề + hero-date + kicker + final-kicker), % và câu đọc cùng lúc.
- Gradient `barGrad`/`barTop` định nghĩa MỘT LẦN trong SVG của slide 1,
  các slide sau tham chiếu `url(#barGrad)` — đừng xoá defs ở slide 1.
- Luôn giữ note-card cuối: giá đổi từng phút, tham khảo, không phải lời
  khuyên đầu tư.
