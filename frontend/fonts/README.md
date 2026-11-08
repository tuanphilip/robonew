# Font offline

Thay cho phụ thuộc CDN của template gốc. **[XÁC NHẬN]** 86/86 `index.html` trong
source gốc nạp Inter từ `fonts.googleapis.com` và Font Awesome từ
`cdnjs.cloudflare.com`, nên nếu không bundle thì render mất chữ/mất icon khi
người dùng offline hoặc mạng chậm.

| Thư mục | Nội dung | Dung lượng |
|---|---|---|
| `inter/` | Inter v20, subset `latin` + `latin-ext` + `vietnamese`, 21 @font-face trỏ 3 file woff2 | ~160 KB |
| `fontawesome/` | Font Awesome Free 6.5.1, CSS đã bỏ tham chiếu `.ttf` (chỉ dùng woff2) | ~408 KB |

Cách tải lại: xem `scripts/fetch-fonts.md`.
