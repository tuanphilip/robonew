# DV-01 · Thủ tục & giấy tờ

Bảy slide: tên thủ tục → giấy tờ cần → ba bước → lệ phí & thời hạn → lỗi hay
mắc. Hợp hộ chiếu, sổ đỏ, phạt nguội, bảo hiểm, đăng ký xe.

## ⚠ Đây là mẫu NỀN SÁNG — khác mọi mẫu còn lại

Trong kho mẫu, đây là mẫu đầu tiên không dùng nền tối. Bốn cái bẫy, đều là
chép từ mẫu khác sang rồi dính:

| | |
|---|---|
| `colorMode` | phải là **`cream`**. Engine chỉ nhận `dark` và `cream`; đưa `light` vào thì nó tự ép về `cream` |
| `--bg-dark` | `cream` **ép** nó thành `#fff3df`. Tên nói "tối" nhưng giá trị là màu giấy — đừng dùng làm màu chữ |
| `--accent-light` | ở mẫu này giữ một màu **mực xám đậm**, ngược hẳn với tên. Trên nền kem thì màu nhạt là màu vô hình |
| `subtitles.color` | mặc định là **trắng**, trên nền kem sẽ mất hút. Mẫu này đặt `#1c2b22`. Đổi bảng màu thì phải xem lại khoá đó |

## ⚠ Bẫy lớn nhất: engine cài sẵn flex trên `.slide-element`

Engine đặt ở `style.css` dòng 177:

```
.slide-element { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
```

Bốn thuộc tính đó **không biến mất** khi bạn khai `display: block`, và **rò
xuống** mọi khối con khai lại `display: flex` mà quên khai chúng. Cả ba lần
dính trong lúc dựng mẫu này đều trông như *thiếu CSS* chứ không ai nghĩ tới đó:

- một đoạn văn có ba thẻ `<b>` cao **192px** thay vì 57px, vì mỗi mảnh chữ và
  mỗi thẻ `<b>` thành một hàng riêng kèm khe 10px;
- huy hiệu số bước và tên bước **chồng lên nhau**, khối hai cột cao 270px thay
  vì 130px, vì `flex-direction` vẫn là `column`;
- mỗi `<li>` **co lại bằng bề rộng chữ rồi nằm giữa**, nên danh sách nhìn như
  căn giữa dù `text-align` đang là `left`, vì `align-items` vẫn là `center`.

Cách chữa nằm ngay đầu khối CSS của mẫu: đặt lại cả bốn thuộc tính trên
`.slide-element`, rồi mỗi khối tự khai đủ hướng và cách căn của nó.

## Ba thứ làm nên mẫu này

**1. Ảnh THẬT của chính giấy tờ đang nói tới.** Mẫu thủ tục mà chỉ có chữ thì
đọc ra như một trang văn bản. Ảnh dán kiểu kẹp vào hồ sơ: viền trắng, bóng đổ,
hơi nghiêng.

⚠ **Chỉ dùng ảnh có giấy phép rõ ràng cho dùng thương mại** — ảnh đi theo bộ
cài tới tay người dùng cuối. Bốn tấm trong mẫu đều Public domain lấy từ
Wikimedia Commons; nguồn và giấy phép từng tấm ghi trong `source/source.md`.
Thêm ảnh mới thì ghi tiếp vào đó.

⚠ **Không dùng ảnh giấy tờ của người thật.** Hai tấm trong mẫu đều là bản mẫu:
ô thông tin để trống hoặc đã che, số hộ chiếu toàn số 0.

⚠ **Thu nhỏ ảnh về đúng bề rộng cần dùng.** Khung dựng rộng 1080 còn khung CSS
rộng 390, tức 2,77× — ảnh nguồn chỉ cần gấp khoảng 2,8 lần bề rộng hiển thị.
Bốn tấm của mẫu tổng cộng 164 KB.

**2. Ô TÍCH, không phải gạch đầu dòng.** Ô tích là thứ người xem soi lại khi
chuẩn bị hồ sơ thật; nó biến slide thành tờ kiểm kê.

**3. Nền giấy có kẻ dòng.** Nhạt tới mức gần không thấy, nhưng đủ để cả deck
trông như một tờ khai thay vì một trang web.

## ⚠ Số liệu thủ tục thì HẾT HẠN, còn video thì không

Đây là rủi ro riêng của thể loại này. Lệ phí trong deck mẫu đang được giảm một
nửa và mức giảm hết hiệu lực 31/12/2026; ngay trang thủ tục chính thức, lúc tra
cứu, vẫn còn ghi mức của năm 2023.

Nên: tra lại tận văn bản pháp luật, ghi nguồn vào `source/source.md`, và **in
ngày tra lên chính slide cuối** như deck này đang làm.

## Mặc định chung — giữ nguyên trừ khi được yêu cầu khác

- `preview-settings.json` phụ đề: `enabled: true`, `fontSize: 18`, `bottom: 100`, `maxLines: 1`.
- Nhạc nền: tệp riêng `preview-assets/bgm/meta.mp3`, để nhỏ (0.16) vì đây là nội dung phải nghe rõ lời.
- `backgroundFx: "none"` — hướng dẫn thủ tục cần đọc được, hoạt cảnh nền kéo mắt đi chỗ khác.
- Tắt lưới căn. Safezone nội dung: `100px 24px 200px`.

## Ba nơi phải khớp từng chữ

Lời thoại nằm ở **ba** nơi. Lệch một chữ là bộ soát báo lỗi:

1. `script-90s.txt`
2. `slideScripts` trong `app.js`
3. `slides.scriptLines` trong `preview-settings.json`

## Số câu phải bằng số `.slide-element`

Bộ soát tách câu theo `(?<=[.!?])\s+`.

⚠ **Đừng viết số bằng chữ số trong script.** `100.000` bị tính thành **hai**
câu vì có dấu chấm — mà mẫu này thì đầy số. Trong script đọc thành chữ; chữ số
chỉ để **trên màn hình**.

⚠ Muốn thêm chi tiết nhìn mà không làm lệch bộ soát thì đặt nó **bên trong**
một `.slide-element` sẵn có, đừng thêm `.slide-element` mới.

## Soát trước khi coi là xong

```
python validate_slide.py slide/<ten-deck> --expected-slides 7
```
