# TC-06 · Tiền của bạn

Sáu slide: câu hỏi đời thường → đáp số gây sốc → phép tính hai bước → biểu đồ
hai kịch bản → một việc làm được hôm nay. Hợp tiết kiệm, lãi kép, chi tiêu,
mua trả góp.

⚠ **Khác hẳn năm mẫu `TC` còn lại trong kho**: chúng là tiền mã hoá cho người
giao dịch, cái này là **tiền hằng ngày cho người thường**. Đừng chép bảng màu
hay giọng điệu từ mấy mẫu kia sang.

## Ba thứ làm nên mẫu này

**1. Đáp số ra TRƯỚC, phép tính sau.** Người xem thể loại này không chờ hết
phép tính mới quyết định có xem tiếp hay không.

⚠ Và con số đứng một mình thì không biết là nhiều hay ít. Phải cho nó một cái
để tựa vào — mẫu này đặt ngay dưới đáp số một dòng *"cất dưới gối thì chỉ được
182 triệu"*. Đó mới là chỗ chữ "sốc" đến từ.

**2. Giả thiết ghi RÕ trên màn hình.** Lãi suất bao nhiêu, bao nhiêu tháng,
lãi có nhập gốc không. Thiếu nó thì con số thành lời hứa, mà đây là tiền của
người ta.

⚠ **Chọn giả thiết thận trọng.** Deck mẫu dùng 6%/năm trong khi mặt bằng lúc
tra cứu là 6,8–7,2%. Thà ra con số nhỏ hơn thực tế còn hơn hứa quá tay.

**3. Biểu đồ theo NHIỀU MỐC thời gian, không phải hai cột đầu–cuối.** Cả bài
học của lãi kép nằm ở chỗ khoảng cách giãn ra càng về sau càng nhanh — hai cột
thì không thấy được điều đó. Mẫu dùng bốn mốc: năm 5, 10, 15, 20.

⚠ **Chiều cao cột tính bằng Python từ bảng số liệu**, không ước lượng bằng mắt.
Bảng và công thức nằm trong `source/source.md`. Đổi số liệu thì tính lại.

⚠ **Cột mọc bằng `scaleY`, KHÔNG bằng `height`.** `height` đụng bố cục nên bộ
soát sẽ đo trúng khung hình đang dở và báo sai vùng an toàn.

## Viết lời

- **Chọn một thứ người xem LÀM THẬT mỗi ngày**, đừng chọn một khoản tiền trừu
  tượng. Ly cà phê ai cũng uống nên ai cũng tự tính theo được; "gửi 2 triệu mỗi
  tháng" thì đúng nhưng không ai thấy mình trong đó.
- **Kết KHÔNG dạy đời.** Đưa cái giá của một thói quen rồi dừng; chọn hay không
  là việc của người xem.
- **Việc chốt phải làm được trong hôm nay, bằng một thao tác.**
- ⚠ **Mẫu này đầy số mà bộ soát tách câu theo dấu chấm** — `25.000` viết trong
  SCRIPT bị tính thành hai câu. Đọc hết bằng chữ; chữ số chỉ để **trên màn
  hình**.

## ⚠ Bẫy engine: flex cài sẵn trên `.slide-element`

Engine đặt ở `style.css` dòng 177:

```
.slide-element { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
```

Bốn thuộc tính đó **không biến mất** khi khai `display: block`, và **rò xuống**
mọi khối con khai lại `display: flex` mà quên khai chúng. Đầu khối CSS của mẫu
đã đặt lại cả bốn — giữ nguyên phần đó.

⚠ Và khi viết luật hiện cho phần tử **bên trong** một `.slide-element`, dùng tổ
hợp không dấu cách — `.slide-element.visible.tc-tinh > *` — nếu lớp đó chính là
cái `.slide-element`. Viết có dấu cách là luật không bao giờ khớp và khối kẹt ở
`opacity: 0`, mà **`validate_slide.py` vẫn báo PASS** vì phần tử trong suốt vẫn
có hộp đúng kích thước. Chụp deck ra nhìn, đừng tin mỗi bộ soát.

## Mặc định chung — giữ nguyên trừ khi được yêu cầu khác

- `preview-settings.json` phụ đề: `enabled: true`, `fontSize: 18`, `bottom: 100`, `maxLines: 1`.
- Nhạc nền: tệp riêng `preview-assets/bgm/meta.mp3`.
- Tắt lưới căn. Safezone nội dung: `100px 24px 200px`.
- Bảng màu: xanh rêu đậm nền, vàng đồng cho tiền. `--accent-light` là xanh xám
  nhạt dùng cho chữ phụ trên nền tối.

## Ba nơi phải khớp từng chữ

1. `script-90s.txt`
2. `slideScripts` trong `app.js`
3. `slides.scriptLines` trong `preview-settings.json`

## Số câu phải bằng số `.slide-element`

Mẫu này là **2 / 2 / 2 / 2 / 2 / 2**.

## Soát trước khi coi là xong

```
python validate_slide.py slide/<ten-deck> --expected-slides 6
```
