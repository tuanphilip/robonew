# XH-02 · Đố vui

Sáu slide: câu hỏi → bốn lựa chọn → ba giây không chữ → đáp án → vì sao → mời
bình luận. Hợp đố kiến thức, "bạn có biết", kiểm tra nhanh.

## Ba thứ làm nên mẫu này

**1. Mỗi lựa chọn một ẢNH THẬT.** Đố vui mà chỉ có bốn dòng chữ thì người xem
lướt qua; có ảnh thì họ dừng lại để nhìn và so sánh — mà dừng lại chính là thứ
mẫu này cần.

**2. Một nhịp BA GIÂY KHÔNG CHỮ.** Slide đếm ngược cố ý trống chữ. Đây là chỗ
người xem tự chốt một đáp án, và chốt rồi thì mới ở lại xem mình đúng hay sai.

⚠ Đừng chèn chữ vào slide đó "cho đỡ trống". Cái trống đó chính là chức năng.
Nhưng vẫn nên có HÌNH: mẫu đặt bốn ảnh lựa chọn ở dạng mờ quanh vòng đếm, để
người xem có thứ mà cân nhắc trong ba giây đó.

**3. Slide đáp án dùng LẠI ĐÚNG LƯỚI của slide lựa chọn.** Mắt đã nhớ vị trí
bốn ô, nên chỉ cần một ô sáng lên là đọc ra ngay, không phải đọc lại từ đầu.

⚠ **Đừng thu nhỏ lưới ở slide đáp án** dù có cần chỗ cho con số. Mất vị trí là
mất luôn ý đồ. Cần chỗ thì cắt ở con số, ở khe lưới, ở dòng chú — đừng cắt ở
lưới.

⚠ Ba ô sai làm mờ bằng `filter: grayscale()`, **không** bằng cách đổi kích
thước. `filter` không đụng bố cục nên phép đo vùng an toàn vẫn ra đúng số.

## ⚠ Bẫy engine: flex cài sẵn trên `.slide-element`

Engine đặt ở `style.css` dòng 177:

```
.slide-element { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
```

Bốn thuộc tính đó **không biến mất** khi khai `display: block`, và **rò xuống**
mọi khối con khai lại `display: flex` mà quên khai chúng. Hậu quả trông y như
*thiếu CSS*: đoạn văn có thẻ `<b>` bị xé mỗi mảnh một hàng, khối hai cột xếp
dọc, mỗi `<li>` co lại nằm giữa dù `text-align` là `left`.

Đầu khối CSS của mẫu đã đặt lại cả bốn. Giữ nguyên phần đó.

## Ảnh

⚠ **Chỉ dùng ảnh có giấy phép rõ ràng cho dùng thương mại** — ảnh đi theo bộ
cài tới tay người dùng cuối. Năm tấm trong mẫu đều Public domain (ảnh NASA);
nguồn và giấy phép từng tấm ghi trong `source/source.md`.

⚠ **Giấy phép đúng mới là điều kiện cần.** Còn phải nhìn tấm ảnh và hỏi người
xem có đọc ra nó là cái gì không. Mẫu này từng dùng một ảnh Mặt Trời tử ngoại
giả màu xanh: thật, đúng giấy phép, và không ai nhận ra đó là Mặt Trời.

⚠ **Cắt vuông giữa ngay lúc chuẩn bị ảnh**, đừng ỷ vào `object-fit`: ảnh hiển
thị trong khung tròn, lệch tâm là lẹm mất vật chính.

Thu nhỏ về khoảng 2,8 lần bề rộng hiển thị (khung dựng 1080 so với khung CSS
390). Năm tấm của mẫu tổng cộng 74 KB.

## Viết câu đố

- **Đáp án nên phản trực giác.** Câu mà đa số đoán đúng ngay thì không ai buồn
  bình luận.
- **Ba lựa chọn sai phải hợp lý**, để người không chắc còn phải nghĩ.
- **Phần "vì sao" là thứ làm video lan đi.** Chỉ có đáp án thì xem xong quên
  ngay; có lý do thì người ta kể lại được cho người khác.
- **Câu mời ở cuối phải trả lời được bằng một chữ cái.** Càng dễ gõ càng nhiều
  người gõ.
- ⚠ **Sai một câu là mất uy tín cả kênh.** Người xem thể loại này vào bình luận
  để cãi, và họ sẽ tra lại. Ghi nguồn vào `source/source.md`.

## Mặc định chung — giữ nguyên trừ khi được yêu cầu khác

- `preview-settings.json` phụ đề: `enabled: true`, `fontSize: 18`, `bottom: 100`, `maxLines: 1`.
- Nhạc nền: tệp riêng `preview-assets/bgm/meta.mp3`.
- `backgroundFx: "stars"` cho chủ đề vũ trụ. Các preset engine nhận: `scan`,
  `particles`, `rings`, `lorenz`, `grid`, `rain`, `wave`, `stars`, `aurora`, `none`.
- Tắt lưới căn. Safezone nội dung: `100px 24px 200px`.

## Ba nơi phải khớp từng chữ

1. `script-90s.txt`
2. `slideScripts` trong `app.js`
3. `slides.scriptLines` trong `preview-settings.json`

## Số câu phải bằng số `.slide-element`

Bộ soát tách câu theo `(?<=[.!?])\s+`. Mẫu này là **2 / 2 / 1 / 3 / 3 / 2**.

⚠ **Đừng viết số bằng chữ số trong script** — số có dấu chấm bị tính thành hai
câu. Trong script đọc thành chữ; chữ số chỉ để **trên màn hình**.

⚠ Muốn thêm chi tiết nhìn mà không làm lệch bộ soát thì đặt nó **bên trong**
một `.slide-element` sẵn có. Bốn ảnh mờ ở slide đếm ngược và dòng mời câu sau ở
slide cuối đều làm như vậy.

## Soát trước khi coi là xong

```
python validate_slide.py slide/<ten-deck> --expected-slides 6
```
