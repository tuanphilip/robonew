# XH-01 · Top N xếp hạng

Đếm ngược từ hạng N về hạng 1, mỗi hạng một slide. Hợp top công cụ, top địa
điểm, top sai lầm — mọi danh sách có thứ tự.

## Bảy slide, đúng thứ tự này

| # | Vai | Lớp chính |
|---|---|---|
| 1 | Móc: nêu hạng 1 mà chưa nói là gì | `.xh-hero` + `.xh-bieu-do` |
| 2–6 | Năm hạng, đếm ngược 5 → 1 | `.xh-hang` + `.xh-chi-so` |
| 7 | Chốt lại cả bảng | `.xh-ket` + `.xh-bieu-do` |

Slide hạng 1 mang thêm lớp `xh-nhat` trên chính thẻ `.slide` — nó làm khung
sáng lên và cho thanh một vệt sáng chạy qua. Đây là chỗ **duy nhất** trong deck
dùng vệt sáng đó.

## Ba thứ làm nên mẫu này

**1. Mỗi hạng phải có HÌNH VẼ đúng vật đang nói tới.** Liệt kê vật hữu hình mà
chỉ có chữ thì quá trừu tượng — người xem không hình dung được "miếng rửa bát"
bẩn cỡ nào. Vẽ bằng **SVG nội tuyến** đặt trong `<defs>` rồi gọi bằng `<use>`:
deck dựng được offline và nét vẽ ăn theo biến màu chủ đề.

⚠ **Để style NGAY TRONG `<symbol>`**, đừng đẩy ra CSS ngoài — CSS ngoài không
với tới bên trong shadow tree của `<use>`.

⚠ **Đặt hình NẰM NGANG cạnh tên hạng**, đừng xếp dọc bên trên. Hình cao 76px
đứng cạnh tên hai dòng ~70px thì tổng chiều cao gần như không đổi; xếp dọc là
vỡ vùng an toàn ngay.

**2. Cùng bộ hình đó lặp lại nhỏ trong biểu đồ** ở slide mở và slide chốt. Nhờ
vậy slide mở đọc ra thành một mục lục bằng hình chứ không phải một bảng số.

**3. Thanh so sánh dùng THANG LOGARIT**, không dùng thang thẳng:

```
rộng% = 8 + log10(n) / log10(nMax) * 88
```

Số liệu kiểu xếp hạng thường lệch nhau hàng nghìn lần. Thang thẳng thì hạng 1
chiếm hết còn bốn hạng kia dí sát vạch không, nhìn không ra chênh lệch. Thang
log giữ được thứ tự mà vẫn đọc được cả năm.

## Chuyển động: chỉ `transform` và `opacity`

Hai thứ này không đụng bố cục nên phép đo vùng an toàn vẫn ra đúng số. Hoạt
cảnh bằng `width`/`height` thì bộ soát đo trúng khung hình đang dở và báo sai.

## Mặc định chung — giữ nguyên trừ khi được yêu cầu khác

- `preview-settings.json` phụ đề: `enabled: true`, `fontSize: 18`, `bottom: 100`, `maxLines: 1`.
- Nhạc nền: tệp riêng `preview-assets/bgm/meta.mp3`.
- Tắt lưới căn.
- Safezone TikTok cho nội dung slide: `100px 26px 200px`.

## Ba nơi phải khớp từng chữ

Lời thoại nằm ở **ba** nơi. Lệch một chữ là bộ soát báo lỗi:

1. `script-90s.txt`
2. `slideScripts` trong `app.js`
3. `slides.scriptLines` trong `preview-settings.json`

## Số câu phải bằng số `.slide-element`

Bộ soát tách câu theo `(?<=[.!?])\s+`.

⚠ **Đừng viết số bằng chữ số trong script.** `200.000` bị tính thành **hai**
câu vì có dấu chấm. Trong script thì đọc thành chữ; chữ số chỉ để **trên màn
hình**.

## Soát trước khi coi là xong

```
python validate_slide.py slide/<ten-deck> --expected-slides <N>
```
